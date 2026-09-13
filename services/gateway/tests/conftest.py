"""Fixtures every test shares: a Gateway with a known signing key, and its OpenAPI contract."""

import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import jwt
import pytest
import yaml
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from orchestra_gateway.app import create_app
from orchestra_gateway.auth import TokenVerifier
from orchestra_gateway.jsonapi import MEDIA_TYPE, REQUEST_ID_HEADER

ISSUER = "http://idp.test/realms/orchestra"
AUDIENCE = "orchestra-gateway"

# A copy of docs/30-protocol/openapi/gateway.openapi.yaml that scripts/build-openapi.mjs keeps
# identical, because a service reads nothing outside its own directory (ADR-0020).
DOCUMENT = Path(__file__).resolve().parent.parent / "openapi.yaml"
BASE_URI = "urn:orchestra:gateway:openapi"


class StaticKeys:
    """Stands in for the JWKS endpoint: hands back one public key, whatever the token says."""

    def __init__(self, public_key):
        self._key = SimpleNamespace(key=public_key)

    def get_signing_key_from_jwt(self, _token):
        return self._key


def _escape(token: str) -> str:
    return token.replace("~", "~0").replace("/", "~1")


class Contract:
    """Checks a response against the service's OpenAPI document (HC15)."""

    def __init__(self, path: Path) -> None:
        self.document = yaml.safe_load(path.read_text())
        resource = Resource.from_contents(self.document, default_specification=DRAFT202012)
        self._registry = Registry().with_resource(BASE_URI, resource)

    def assert_documented(self, response, path: str, method: str) -> None:
        """The response is one its operation documents: a listed status, headers and body."""
        responses = self.document["paths"][path][method.lower()]["responses"]
        status = str(response.status_code)
        assert status in responses, f"{method} {path} answered {status}, which is not documented"
        pointer = f"/paths/{_escape(path)}/{method.lower()}/responses/{status}"
        documented = self._follow(responses[status], pointer)
        for name, header in documented[1].get("headers", {}).items():
            if self._follow(header, "")[1].get("required"):
                assert name.lower() in response.headers, f"required header {name} is missing"
        self._assert_body(response, f"{documented[0]}/content/{_escape(MEDIA_TYPE)}/schema")

    def assert_error_document(self, response) -> None:
        """A failure on a path or method with no operation is still an error document."""
        self._assert_body(response, "/components/schemas/ErrorDocument")

    def _follow(self, node: dict[str, Any], pointer: str) -> tuple[str, dict[str, Any]]:
        if "$ref" not in node:
            return pointer, node
        pointer = node["$ref"].removeprefix("#")
        target: Any = self.document
        for token in pointer.lstrip("/").split("/"):
            target = target[token.replace("~1", "/").replace("~0", "~")]
        return pointer, target

    def _assert_body(self, response, schema_pointer: str) -> None:
        assert response.headers["content-type"] == MEDIA_TYPE
        body = response.json()
        validator = Draft202012Validator(
            {"$ref": f"{BASE_URI}#{schema_pointer}"}, registry=self._registry
        )
        problems = [f"{error.json_path}: {error.message}" for error in validator.iter_errors(body)]
        assert not problems, problems
        for error in body.get("errors", []):
            assert error["id"] == response.headers[REQUEST_ID_HEADER]


@pytest.fixture(scope="session")
def contract() -> Contract:
    return Contract(DOCUMENT)


@pytest.fixture(scope="session")
def signing_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def issuer() -> str:
    return ISSUER


@pytest.fixture
def app(signing_key) -> FastAPI:
    verifier = TokenVerifier(
        issuer=ISSUER,
        jwks_url="http://unused.test",
        audience=AUDIENCE,
        jwks_client=StaticKeys(signing_key.public_key()),
    )
    return create_app(verifier=verifier)


@pytest.fixture
def client(app) -> TestClient:
    return TestClient(app)


@pytest.fixture
def mint(signing_key):
    """Mints an access token for this Gateway. A claim, the key or the algorithm can be varied."""

    def mint_token(key: Any = signing_key, algorithm: str = "RS256", **claims: Any) -> str:
        now = int(time.time())
        payload = {"iss": ISSUER, "aud": AUDIENCE, "sub": "user-123", "iat": now, "exp": now + 300}
        return jwt.encode(payload | claims, key, algorithm=algorithm)

    return mint_token
