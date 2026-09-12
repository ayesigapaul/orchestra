"""Bearer credential verification against the identity provider's signing keys (ADR-0017)."""

from typing import Any

import jwt


class Unauthenticated(Exception):
    """The credential is missing, malformed, expired, or was not issued for this Gateway."""


class TokenVerifier:
    """Verifies an access token's signature, issuer, audience and lifetime.

    Algorithms are fixed here rather than read from the token's header, so a token cannot
    choose a weaker algorithm, or "none".
    """

    ALGORITHMS = ("RS256",)

    def __init__(
        self,
        *,
        issuer: str,
        jwks_url: str,
        audience: str,
        cache_seconds: int = 300,
        jwks_client: Any = None,
    ) -> None:
        self._issuer = issuer
        self._audience = audience
        self._jwks = jwks_client or jwt.PyJWKClient(
            jwks_url, cache_jwk_set=True, lifespan=cache_seconds
        )

    def verify(self, token: str) -> dict[str, Any]:
        try:
            signing_key = self._jwks.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=list(self.ALGORITHMS),
                issuer=self._issuer,
                audience=self._audience,
                options={"require": ["exp", "iat", "iss", "sub", "aud"]},
            )
        except jwt.PyJWTError as exc:
            raise Unauthenticated(str(exc)) from exc
