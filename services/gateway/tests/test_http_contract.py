"""Every response honours the HTTP contract of ADR-0025 and the Gateway's OpenAPI document."""

import json

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

JSON_API = "application/vnd.api+json"
HEALTH = "/healthz"
PROBE = "/_probe/identity"


def only_error(response) -> dict:
    [error] = response.json()["errors"]
    return error


def test_health_is_a_meta_document(client, contract):
    response = client.get(HEALTH)
    contract.assert_documented(response, HEALTH, "GET")
    assert response.json() == {"jsonapi": {"version": "1.1"}, "meta": {"status": "ok"}}


def test_head_is_answered_wherever_get_is(client):
    response = client.head(HEALTH)
    assert response.status_code == 200
    assert "orchestra-request-id" in response.headers


def test_identity_probe_is_a_resource_document(client, contract, mint):
    response = client.get(PROBE, headers={"Authorization": f"Bearer {mint()}"})
    contract.assert_documented(response, PROBE, "GET")
    assert response.json()["data"]["type"] == "identity-probes"


def test_missing_credential_is_an_auth_error_that_is_unsafe_to_retry(client, contract):
    response = client.get(PROBE)
    contract.assert_documented(response, PROBE, "GET")
    error = only_error(response)
    assert (error["code"], error["meta"]) == ("auth.unauthenticated", {"retry": "unsafe"})


def test_unknown_path_is_not_found(client, contract):
    response = client.get("/no-such-path")
    assert response.status_code == 404
    contract.assert_error_document(response)
    assert only_error(response)["code"] == "resource.not_found"


def test_wrong_method_names_the_allowed_ones(client, contract):
    response = client.delete(HEALTH)
    assert response.status_code == 405
    assert response.headers["allow"] == "GET, HEAD"
    contract.assert_error_document(response)
    assert only_error(response)["code"] == "request.method_not_allowed"


@pytest.mark.parametrize(
    "accept", [f"{JSON_API}; charset=utf-8", f'{JSON_API}; ext="https://example.test/ext"']
)
def test_json_api_accepted_only_with_unsupported_parameters_is_not_acceptable(
    client, contract, accept
):
    response = client.get(HEALTH, headers={"Accept": accept})
    contract.assert_documented(response, HEALTH, "GET")
    error = only_error(response)
    assert (error["code"], error["source"]) == ("request.not_acceptable", {"header": "Accept"})


@pytest.mark.parametrize(
    "accept",
    [
        "*/*",
        "application/json",
        f"{JSON_API}; charset=utf-8, {JSON_API}",
        f'{JSON_API}; profile="https://example.test/profile"; q=0.9',
    ],
)
def test_any_other_accept_is_served_json_api(client, contract, accept):
    response = client.get(HEALTH, headers={"Accept": accept})
    assert response.status_code == 200
    contract.assert_documented(response, HEALTH, "GET")


@pytest.mark.parametrize(
    ("method", "body", "content_type"),
    [
        ("POST", b"{}", "application/json"),
        ("POST", b"{}", None),
        ("GET", b"", f"{JSON_API}; charset=utf-8"),
    ],
    ids=["another-media-type", "no-media-type", "json-api-with-a-parameter"],
)
def test_content_type_outside_json_api_is_unsupported(client, contract, method, body, content_type):
    headers = {"Content-Type": content_type} if content_type else {}
    response = client.request(method, HEALTH, content=body, headers=headers)
    assert response.status_code == 415
    contract.assert_error_document(response)
    error = only_error(response)
    assert (error["code"], error["source"]) == (
        "request.unsupported_media_type",
        {"header": "Content-Type"},
    )


def test_unknown_query_parameter_is_refused_not_ignored(client, contract):
    response = client.get(f"{HEALTH}?verbose=1")
    contract.assert_documented(response, HEALTH, "GET")
    error = only_error(response)
    assert (error["code"], error["source"]) == (
        "request.invalid_parameter",
        {"parameter": "verbose"},
    )


class ItemAttributes(BaseModel):
    name: str


class Item(BaseModel):
    type: str
    attributes: ItemAttributes


class ItemDocument(BaseModel):
    data: Item


@pytest.fixture
def items(app):
    """Operations that exist only to exercise how input is refused."""

    @app.post("/_test/items")
    def create_item(document: ItemDocument) -> None:
        return None

    @app.get("/_test/items")
    def list_items(limit: int = 10) -> None:
        return None

    return app


def post_document(client, body: bytes):
    return client.post("/_test/items", content=body, headers={"Content-Type": JSON_API})


def test_invalid_member_is_pointed_at(items, client, contract):
    response = post_document(
        client, json.dumps({"data": {"type": "items", "attributes": {}}}).encode()
    )
    assert response.status_code == 422
    contract.assert_error_document(response)
    error = only_error(response)
    assert (error["code"], error["source"]) == (
        "request.validation_failed",
        {"pointer": "/data/attributes/name"},
    )


def test_body_that_is_not_json_is_malformed(items, client, contract):
    response = post_document(client, b"{not json")
    assert response.status_code == 400
    contract.assert_error_document(response)
    assert only_error(response)["code"] == "request.malformed"


def test_malformed_query_parameter_is_named(items, client, contract):
    response = client.get("/_test/items?limit=many")
    assert response.status_code == 400
    contract.assert_error_document(response)
    assert only_error(response)["source"] == {"parameter": "limit"}


@pytest.mark.parametrize(("method", "retry"), [("GET", "safe"), ("POST", "indeterminate")])
def test_unhandled_fault_is_logged_and_never_described(app, contract, caplog, method, retry):
    @app.api_route("/_test/fault", methods=[method])
    def fault() -> None:
        raise RuntimeError("connection to db.internal:5432 refused")

    with caplog.at_level("ERROR", logger="orchestra_gateway.errors"):
        response = TestClient(app, raise_server_exceptions=False).request(method, "/_test/fault")

    assert response.status_code == 500
    contract.assert_error_document(response)
    error = only_error(response)
    assert (error["code"], error["meta"]["retry"]) == ("server.internal", retry)
    assert "db.internal" not in response.text
    assert "db.internal" in caplog.text
