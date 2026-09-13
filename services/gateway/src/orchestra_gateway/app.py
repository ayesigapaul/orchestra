"""The Orchestra Gateway application.

Phase 0 carries one probe route and no resource of the Gateway contract, whose path layout is
ADR-required and unmade (gateway-api.md section 9). What is decided already applies: every response
is a JSON:API document, every failure an error document from one error layer (ADR-0025), and every
credential is resolved to exactly one Principal and one Tenant before anything proceeds
(gateway-api.md G7).
"""

import logging
from contextlib import asynccontextmanager
from typing import Annotated, Any

import httpx2
from fastapi import Depends, FastAPI, Request

from orchestra_gateway import jsonapi
from orchestra_gateway.auth import TokenVerifier, Unauthenticated
from orchestra_gateway.jsonapi import (
    UNAUTHENTICATED,
    UPSTREAM_UNAVAILABLE,
    ApiError,
    JsonApiResponse,
)
from orchestra_gateway.resolution import (
    CredentialResolver,
    Identity,
    Rejected,
    ResolutionUnavailable,
    Resolver,
    ServiceTokens,
)
from orchestra_gateway.settings import get_settings

logger = logging.getLogger("orchestra_gateway.auth")

# A resource that answers GET answers HEAD too, so Allow reads the same in every service.
READ = ["GET", "HEAD"]
# One refusal for a credential that fails verification and for one that does not resolve, so a
# caller cannot tell the two apart.
INVALID_TOKEN = {"WWW-Authenticate": 'Bearer error="invalid_token"'}


def create_app(verifier: TokenVerifier | None = None, resolver: Resolver | None = None) -> FastAPI:
    state: dict[str, Any] = {"verifier": verifier, "resolver": resolver, "client": None}

    def get_verifier() -> TokenVerifier:
        if state["verifier"] is None:
            settings = get_settings()
            state["verifier"] = TokenVerifier(
                issuer=settings.issuer,
                jwks_url=settings.jwks_url,
                audience=settings.audience,
                cache_seconds=settings.jwks_cache_seconds,
            )
        return state["verifier"]

    def get_resolver() -> Resolver:
        if state["resolver"] is None:
            settings = get_settings()
            client = state["client"] = httpx2.Client()
            tokens = ServiceTokens(
                client,
                token_url=settings.token_url,
                client_id=settings.client_id,
                client_secret=settings.client_secret.get_secret_value(),
            )
            state["resolver"] = CredentialResolver(
                client,
                tokens,
                url=settings.tenant_user_management_url,
                deadline_seconds=settings.resolution_deadline_seconds,
            )
        return state["resolver"]

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        # Fail at startup, not on the first request, when configuration is missing.
        get_verifier()
        get_resolver()
        yield
        if state["client"] is not None:
            state["client"].close()

    app = FastAPI(
        title="Orchestra Gateway",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    jsonapi.install(app)

    def verified_credential(
        request: Request, token_verifier: Annotated[TokenVerifier, Depends(get_verifier)]
    ) -> str:
        # Only the Authorization header is read. Headers the edge adds, X-Userinfo in
        # particular, are never consulted: identity comes from a credential verified
        # here, not from what a proxy asserts (ADR-0018).
        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise ApiError(UNAUTHENTICATED, headers={"WWW-Authenticate": "Bearer"})
        try:
            token_verifier.verify(token)
        except Unauthenticated as exc:
            # The reason goes to the log and never to the caller: telling a client why its
            # credential failed helps an attacker more than it helps an operator.
            logger.warning("credential rejected: %s", exc)
            raise ApiError(UNAUTHENTICATED, headers=INVALID_TOKEN) from None
        return token

    def resolved_identity(
        credential: Annotated[str, Depends(verified_credential)],
        credential_resolver: Annotated[Resolver, Depends(get_resolver)],
    ) -> Identity:
        # Only a resolution establishes a Principal and a Tenant. A credential that does not
        # resolve is refused like one that fails verification, and a resolution that cannot
        # complete fails closed, never as a pass (credential-resolution.md CR7).
        try:
            return credential_resolver.resolve(credential)
        except Rejected:
            logger.warning("credential did not resolve to a Principal")
            raise ApiError(UNAUTHENTICATED, headers=INVALID_TOKEN) from None
        except ResolutionUnavailable as exc:
            logger.error("credential resolution unavailable: %s", exc, exc_info=exc)
            raise ApiError(UPSTREAM_UNAVAILABLE) from None

    @app.api_route("/healthz", methods=READ)
    def healthz() -> JsonApiResponse:
        return JsonApiResponse(jsonapi.document(meta={"status": "ok"}))

    @app.api_route("/_probe/identity", methods=READ)
    def identity_probe(
        identity: Annotated[Identity, Depends(resolved_identity)],
    ) -> JsonApiResponse:
        # Proves the whole path: the edge, a credential verified here, and its resolution to one
        # Principal in one Tenant by Tenant User Management. Not part of the contract, and it goes
        # when the first resource arrives.
        attributes = {
            "tenant_id": identity.tenant_id,
            "principal_id": identity.principal_id,
            "principal_kind": identity.principal_kind,
        }
        data = {"type": "identity-probes", "id": identity.principal_id, "attributes": attributes}
        return JsonApiResponse(jsonapi.document(data=data))

    return app


app = create_app()
