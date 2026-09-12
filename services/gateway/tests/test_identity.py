"""The Gateway accepts only a credential it verified itself."""

import base64
import json
import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from orchestra_gateway.app import create_app
from orchestra_gateway.auth import TokenVerifier

ISSUER = "http://idp.test/realms/orchestra"
AUDIENCE = "orchestra-gateway"
PROBE = "/_probe/identity"


@pytest.fixture(scope="module")
def signing_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


class StaticKeys:
    """Stands in for the JWKS endpoint: hands back one public key, whatever the token says."""

    def __init__(self, public_key):
        self._key = SimpleNamespace(key=public_key)

    def get_signing_key_from_jwt(self, _token):
        return self._key


@pytest.fixture
def client(signing_key):
    verifier = TokenVerifier(
        issuer=ISSUER,
        jwks_url="http://unused.test",
        audience=AUDIENCE,
        jwks_client=StaticKeys(signing_key.public_key()),
    )
    return TestClient(create_app(verifier=verifier))


def make_token(key, algorithm="RS256", **overrides):
    now = int(time.time())
    claims = {"iss": ISSUER, "aud": AUDIENCE, "sub": "user-123", "iat": now, "exp": now + 300}
    claims.update(overrides)
    return jwt.encode(claims, key, algorithm=algorithm)


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def forged_userinfo(subject):
    return base64.b64encode(json.dumps({"sub": subject}).encode()).decode()


def test_health_needs_no_credential(client):
    assert client.get("/healthz").json() == {"status": "ok"}


def test_missing_credential_is_rejected(client):
    response = client.get(PROBE)
    assert response.status_code == 401
    assert response.headers["www-authenticate"].startswith("Bearer")


def test_valid_credential_is_accepted(client, signing_key):
    response = client.get(PROBE, headers=bearer(make_token(signing_key)))
    assert response.status_code == 200
    assert response.json() == {"subject": "user-123", "issuer": ISSUER}


@pytest.mark.parametrize(
    "overrides",
    [
        {"iss": "http://someone-else.test/realms/orchestra"},
        {"aud": "another-service"},
        {"exp": int(time.time()) - 10},
    ],
    ids=["wrong-issuer", "wrong-audience", "expired"],
)
def test_credential_not_issued_for_this_gateway_is_rejected(client, signing_key, overrides):
    assert (
        client.get(PROBE, headers=bearer(make_token(signing_key, **overrides))).status_code == 401
    )


def test_credential_signed_by_another_key_is_rejected(client):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    assert client.get(PROBE, headers=bearer(make_token(other))).status_code == 401


def test_unsigned_credential_is_rejected(client):
    unsigned = make_token(None, algorithm="none")
    assert client.get(PROBE, headers=bearer(unsigned)).status_code == 401


def test_edge_asserted_identity_is_not_a_credential(client):
    # ADR-0018: a header an edge proxy adds is never read as identity.
    response = client.get(PROBE, headers={"X-Userinfo": forged_userinfo("attacker")})
    assert response.status_code == 401


def test_edge_asserted_identity_never_overrides_the_credential(client, signing_key):
    headers = bearer(make_token(signing_key)) | {"X-Userinfo": forged_userinfo("attacker")}
    assert client.get(PROBE, headers=headers).json()["subject"] == "user-123"


def test_rejection_reason_is_logged_and_never_returned(client, caplog):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with caplog.at_level("WARNING", logger="orchestra_gateway.auth"):
        response = client.get(PROBE, headers=bearer(make_token(other)))
    assert response.status_code == 401
    assert "credential rejected" in caplog.text
    assert "signature" not in response.text.lower()
