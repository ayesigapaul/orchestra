"""Gateway configuration, read from the environment with the ORCHESTRA_GATEWAY_ prefix."""

from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ORCHESTRA_GATEWAY_")

    # The exact `iss` a token must carry.
    issuer: str
    # Where signing keys are fetched. Inside a container network this can differ from the
    # issuer's host, which is why it is configured separately from the issuer.
    jwks_url: str
    # The audience a token must name. The identity provider adds it for this Gateway.
    audience: str
    jwks_cache_seconds: int = 300

    # Tenant User Management, which resolves every verified credential to one Principal and one
    # Tenant (docs/30-protocol/credential-resolution.md).
    tenant_user_management_url: str
    # How long one resolution may take, the one repeat the contract allows included (HC19).
    resolution_deadline_seconds: float = 5.0
    # The Gateway's own client, and where it obtains the token it calls other services with (HC17).
    token_url: str
    client_id: str
    client_secret: SecretStr


@lru_cache
def get_settings() -> Settings:
    return Settings()
