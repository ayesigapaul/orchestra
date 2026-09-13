"""The Gateway accepts only a credential it verified itself and resolved to one Principal."""

import base64
import json
import time

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from orchestra_gateway.resolution import ResolutionUnavailable

PROBE = "/_probe/identity"


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def forged_userinfo(subject):
    return base64.b64encode(json.dumps({"sub": subject}).encode()).decode()


def test_missing_credential_is_rejected(client, resolver):
    response = client.get(PROBE)
    assert response.status_code == 401
    assert response.headers["www-authenticate"].startswith("Bearer")
    assert resolver.credentials == []


def test_valid_credential_resolves_to_one_principal_in_one_tenant(client, mint, identity):
    response = client.get(PROBE, headers=bearer(mint()))
    assert response.status_code == 200
    assert response.json()["data"] == {
        "type": "identity-probes",
        "id": identity.principal_id,
        "attributes": {
            "tenant_id": identity.tenant_id,
            "principal_id": identity.principal_id,
            "principal_kind": "platform-user",
        },
    }


@pytest.mark.parametrize(
    "claims",
    [
        {"iss": "http://someone-else.test/realms/orchestra"},
        {"aud": "another-service"},
        {"exp": int(time.time()) - 10},
    ],
    ids=["wrong-issuer", "wrong-audience", "expired"],
)
def test_credential_not_issued_for_this_gateway_is_rejected(client, mint, resolver, claims):
    assert client.get(PROBE, headers=bearer(mint(**claims))).status_code == 401
    assert resolver.credentials == [], "a credential that failed verification was sent on"


def test_credential_signed_by_another_key_is_rejected(client, mint, resolver):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    assert client.get(PROBE, headers=bearer(mint(key=other))).status_code == 401
    assert resolver.credentials == []


def test_unsigned_credential_is_rejected(client, mint):
    unsigned = mint(key=None, algorithm="none")
    assert client.get(PROBE, headers=bearer(unsigned)).status_code == 401


def test_edge_asserted_identity_is_not_a_credential(client):
    # ADR-0018: a header an edge proxy adds is never read as identity.
    response = client.get(PROBE, headers={"X-Userinfo": forged_userinfo("attacker")})
    assert response.status_code == 401


def test_edge_asserted_identity_never_overrides_the_credential(client, mint, identity):
    headers = bearer(mint()) | {"X-Userinfo": forged_userinfo("attacker")}
    attributes = client.get(PROBE, headers=headers).json()["data"]["attributes"]
    assert attributes["principal_id"] == identity.principal_id


def test_rejection_reason_is_logged_and_never_returned(client, mint, caplog):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with caplog.at_level("WARNING", logger="orchestra_gateway.auth"):
        response = client.get(PROBE, headers=bearer(mint(key=other)))
    assert response.status_code == 401
    assert "credential rejected" in caplog.text
    assert "signature" not in response.text.lower()


def test_credential_that_does_not_resolve_is_refused_like_a_failed_one(
    client, contract, mint, resolver
):
    response = client.get(PROBE, headers=bearer(mint(sub="somebody-unknown")))
    assert response.status_code == 401
    contract.assert_documented(response, PROBE, "GET")
    assert response.headers["www-authenticate"] == 'Bearer error="invalid_token"'
    [error] = response.json()["errors"]
    assert (error["code"], error["meta"]) == ("auth.unauthenticated", {"retry": "unsafe"})
    assert "detail" not in error
    assert len(resolver.credentials) == 1


def test_resolution_that_cannot_complete_fails_closed(client, contract, mint, resolver, caplog):
    resolver.failure = ResolutionUnavailable("Tenant User Management is unreachable")
    with caplog.at_level("ERROR", logger="orchestra_gateway.auth"):
        response = client.get(PROBE, headers=bearer(mint()))
    assert response.status_code == 503
    contract.assert_documented(response, PROBE, "GET")
    [error] = response.json()["errors"]
    assert (error["code"], error["meta"]) == ("upstream.unavailable", {"retry": "safe"})
    assert "Tenant User Management" not in response.text
    assert "unreachable" in caplog.text
