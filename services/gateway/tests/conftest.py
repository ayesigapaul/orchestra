"""Fixtures every test shares: a Gateway with a known signing key, and the OpenAPI contracts."""

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
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from orchestra_gateway.app import create_app
from orchestra_gateway.auth import TokenVerifier
from orchestra_gateway.jsonapi import MEDIA_TYPE, REQUEST_ID_HEADER
from orchestra_gateway.resolution import Identity, Rejected

ISSUER = "http://idp.test/realms/orchestra"
AUDIENCE = "orchestra-gateway"
SERVICE = Path(__file__).resolve().parent.parent

# A copy of docs/30-protocol/openapi/gateway.openapi.yaml that scripts/build-openapi.mjs keeps
# identical, because a service reads nothing outside its own directory (ADR-0020).
DOCUMENT = SERVICE / "openapi.yaml"
# The document of Tenant User Management, which the Gateway calls, kept identical the same way, so
# the Gateway's tests check that call against the callee's own contract (HC16).
CALLEE_DOCUMENT = SERVICE / "contracts" / "tenant-user-management.openapi.yaml"

# Every span the Gateway ends, kept in memory. A process installs its tracer provider once, so it is
# installed here before any test runs, and a test that reads spans starts with none.
SPANS = InMemorySpanExporter()
_provider = TracerProvider()
_provider.add_span_processor(SimpleSpanProcessor(SPANS))
trace.set_tracer_provider(_provider)

# What the stand-in resolver makes of the subject every minted token carries by default.
IDENTITY = Identity(
    tenant_id="11111111-1111-4111-8111-111111111111",
    principal_id="cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    principal_kind="platform-user",
)


class StaticKeys:
    """Stands in for the JWKS endpoint: hands back one public key, whatever the token says."""

    def __init__(self, public_key):
        self._key = SimpleNamespace(key=public_key)

    def get_signing_key_from_jwt(self, _token):
        return self._key


class StandInResolver:
    """Stands in for Tenant User Management: resolves the subjects it knows and rejects the rest."""

    def __init__(self) -> None:
        self.identities = {"user-123": IDENTITY}
        self.failure: Exception | None = None
        self.credentials: list[str] = []

    def resolve(self, credential: str) -> Identity:
        self.credentials.append(credential)
        if self.failure is not None:
            raise self.failure
        subject = jwt.decode(credential, options={"verify_signature": False})["sub"]
        if subject not in self.identities:
            raise Rejected
        return self.identities[subject]


def _escape(token: str) -> str:
    return token.replace("~", "~0").replace("/", "~1")


class Contract:
    """Checks what a service sends or answers against an OpenAPI document (HC15, HC16)."""

    def __init__(self, path: Path) -> None:
        self.document = yaml.safe_load(path.read_text())
        self._base_uri = f"urn:orchestra:openapi:{path.stem}"
        resource = Resource.from_contents(self.document, default_specification=DRAFT202012)
        self._registry = Registry().with_resource(self._base_uri, resource)

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

    def assert_request(self, body: Any, path: str, method: str) -> None:
        """A request body is one its operation documents."""
        operation = f"/paths/{_escape(path)}/{method.lower()}"
        self._assert_valid(body, f"{operation}/requestBody/content/{_escape(MEDIA_TYPE)}/schema")

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
        self._assert_valid(body, schema_pointer)
        for error in body.get("errors", []):
            assert error["id"] == response.headers[REQUEST_ID_HEADER]

    def _assert_valid(self, body: Any, schema_pointer: str) -> None:
        validator = Draft202012Validator(
            {"$ref": f"{self._base_uri}#{schema_pointer}"}, registry=self._registry
        )
        problems = [f"{error.json_path}: {error.message}" for error in validator.iter_errors(body)]
        assert not problems, problems


@pytest.fixture(scope="session")
def contract() -> Contract:
    return Contract(DOCUMENT)


@pytest.fixture(scope="session")
def callee() -> Contract:
    return Contract(CALLEE_DOCUMENT)


@pytest.fixture
def spans() -> InMemorySpanExporter:
    SPANS.clear()
    return SPANS


@pytest.fixture(scope="session")
def signing_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def issuer() -> str:
    return ISSUER


@pytest.fixture
def identity() -> Identity:
    return IDENTITY


@pytest.fixture
def resolver() -> StandInResolver:
    return StandInResolver()


@pytest.fixture
def app(signing_key, resolver) -> FastAPI:
    verifier = TokenVerifier(
        issuer=ISSUER,
        jwks_url="http://unused.test",
        audience=AUDIENCE,
        jwks_client=StaticKeys(signing_key.public_key()),
    )
    return create_app(verifier=verifier, resolver=resolver)


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
