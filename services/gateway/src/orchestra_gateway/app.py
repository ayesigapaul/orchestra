"""The Orchestra Gateway application.

Phase 0 carries one probe route and no resource of the Gateway contract, whose path layout is
ADR-required and unmade (gateway-api.md section 9). What is decided already applies: every response
is a JSON:API document, and every failure an error document from one error layer (ADR-0025).
"""

import logging
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Request

from orchestra_gateway import jsonapi
from orchestra_gateway.auth import TokenVerifier, Unauthenticated
from orchestra_gateway.jsonapi import UNAUTHENTICATED, ApiError, JsonApiResponse
from orchestra_gateway.settings import get_settings

logger = logging.getLogger("orchestra_gateway.auth")

# A resource that answers GET answers HEAD too, so Allow reads the same in every service.
READ = ["GET", "HEAD"]


def create_app(verifier: TokenVerifier | None = None) -> FastAPI:
    state: dict[str, TokenVerifier | None] = {"verifier": verifier}

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

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        # Fail at startup, not on the first request, when configuration is missing.
        get_verifier()
        yield

    app = FastAPI(
        title="Orchestra Gateway",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    jsonapi.install(app)

    def verified_claims(
        request: Request, token_verifier: Annotated[TokenVerifier, Depends(get_verifier)]
    ) -> dict[str, Any]:
        # Only the Authorization header is read. Headers the edge adds, X-Userinfo in
        # particular, are never consulted: identity comes from a credential verified
        # here, not from what a proxy asserts (ADR-0018).
        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise ApiError(UNAUTHENTICATED, headers={"WWW-Authenticate": "Bearer"})
        try:
            return token_verifier.verify(token)
        except Unauthenticated as exc:
            # The reason goes to the log and never to the caller: telling a client why its
            # credential failed helps an attacker more than it helps an operator.
            logger.warning("credential rejected: %s", exc)
            raise ApiError(
                UNAUTHENTICATED, headers={"WWW-Authenticate": 'Bearer error="invalid_token"'}
            ) from None

    @app.api_route("/healthz", methods=READ)
    def healthz() -> JsonApiResponse:
        return JsonApiResponse(jsonapi.document(meta={"status": "ok"}))

    @app.api_route("/_probe/identity", methods=READ)
    def identity_probe(
        claims: Annotated[dict[str, Any], Depends(verified_claims)],
    ) -> JsonApiResponse:
        # Proves the path: the edge, then a credential verified here. Resolving these
        # claims to exactly one Principal and one Tenant (gateway-api.md G3 to G7) is
        # Phase 1, and this route does not pretend to.
        subject = claims["sub"]
        probe = {"subject": subject, "issuer": claims["iss"]}
        return JsonApiResponse(
            jsonapi.document(data={"type": "identity-probes", "id": subject, "attributes": probe})
        )

    return app


app = create_app()
