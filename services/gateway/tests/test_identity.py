"""The Gateway accepts only a credential it verified itself."""

import base64
import json
import time

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

PROBE = "/_probe/identity"


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def forged_userinfo(subject):
    return base64.b64encode(json.dumps({"sub": subject}).encode()).decode()


def test_missing_credential_is_rejected(client):
    response = client.get(PROBE)
    assert response.status_code == 401
    assert response.headers["www-authenticate"].startswith("Bearer")


def test_valid_credential_is_accepted(client, mint, issuer):
    response = client.get(PROBE, headers=bearer(mint()))
    assert response.status_code == 200
    assert response.json()["data"]["attributes"] == {"subject": "user-123", "issuer": issuer}


@pytest.mark.parametrize(
    "claims",
    [
        {"iss": "http://someone-else.test/realms/orchestra"},
        {"aud": "another-service"},
        {"exp": int(time.time()) - 10},
    ],
    ids=["wrong-issuer", "wrong-audience", "expired"],
)
def test_credential_not_issued_for_this_gateway_is_rejected(client, mint, claims):
    assert client.get(PROBE, headers=bearer(mint(**claims))).status_code == 401


def test_credential_signed_by_another_key_is_rejected(client, mint):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    assert client.get(PROBE, headers=bearer(mint(key=other))).status_code == 401


def test_unsigned_credential_is_rejected(client, mint):
    unsigned = mint(key=None, algorithm="none")
    assert client.get(PROBE, headers=bearer(unsigned)).status_code == 401


def test_edge_asserted_identity_is_not_a_credential(client):
    # ADR-0018: a header an edge proxy adds is never read as identity.
    response = client.get(PROBE, headers={"X-Userinfo": forged_userinfo("attacker")})
    assert response.status_code == 401


def test_edge_asserted_identity_never_overrides_the_credential(client, mint):
    headers = bearer(mint()) | {"X-Userinfo": forged_userinfo("attacker")}
    assert client.get(PROBE, headers=headers).json()["data"]["attributes"]["subject"] == "user-123"


def test_rejection_reason_is_logged_and_never_returned(client, mint, caplog):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with caplog.at_level("WARNING", logger="orchestra_gateway.auth"):
        response = client.get(PROBE, headers=bearer(mint(key=other)))
    assert response.status_code == 401
    assert "credential rejected" in caplog.text
    assert "signature" not in response.text.lower()
