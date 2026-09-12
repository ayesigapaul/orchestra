"""The Orchestra Gateway application.

Phase 0 carries one probe route and nothing that belongs to the Gateway contract. The contract's
path layout and its error envelope are both ADR-required and unmade (gateway-api.md section 9), so
nothing here should be read as starting either.
"""

import logging
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Request, status

from orchestra_gateway.auth import TokenVerifier, Unauthenticated
from orchestra_gateway.settings import get_settings

logger = logging.getLogger("orchestra_gateway.auth")


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

    def verified_claims(
        request: Request, token_verifier: Annotated[TokenVerifier, Depends(get_verifier)]
    ) -> dict[str, Any]:
        # Only the Authorization header is read. Headers the edge adds, X-Userinfo in
        # particular, are never consulted: identity comes from a credential verified
        # here, not from what a proxy asserts (ADR-0018).
        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                headers={"WWW-Authenticate": "Bearer"},
            )
        try:
            return token_verifier.verify(token)
        except Unauthenticated as exc:
            # The reason goes to the log and never to the caller: telling a client why its
            # credential failed helps an attacker more than it helps an operator.
            logger.warning("credential rejected: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
            ) from None

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/_probe/identity")
    def identity_probe(
        claims: Annotated[dict[str, Any], Depends(verified_claims)],
    ) -> dict[str, str]:
        # Proves the path: the edge, then a credential verified here. Resolving these
        # claims to exactly one Principal and one Tenant (gateway-api.md G3 to G7) is
        # Phase 1, and this route does not pretend to.
        return {"subject": claims["sub"], "issuer": claims["iss"]}

    return app


app = create_app()
