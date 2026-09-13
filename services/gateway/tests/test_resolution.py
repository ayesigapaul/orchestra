"""The Gateway's call to Tenant User Management, checked against that service's document (HC16)."""

import json
from collections.abc import Callable

import httpx2
import pytest
from opentelemetry.trace import SpanKind, StatusCode, format_span_id
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

from orchestra_gateway import tracing
from orchestra_gateway.resolution import (
    CredentialResolver,
    Identity,
    Rejected,
    ResolutionUnavailable,
    ServiceTokens,
)

TOKEN_URL = "http://idp.test/realms/orchestra/protocol/openid-connect/token"
CALLEE = "http://tenant-user-management.test"
PATH = "/credential-resolutions"
JSON_API = "application/vnd.api+json"
CREDENTIAL = "credential-under-test"
CLIENT_SECRET = "client-secret-under-test"
TENANT_ID = "11111111-1111-4111-8111-111111111111"
PRINCIPAL_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
RESOLVED = {
    "outcome": "resolved",
    "tenant_id": TENANT_ID,
    "principal_id": PRINCIPAL_ID,
    "principal_kind": "platform-user",
}
TITLES = {
    "auth.unauthenticated": "A valid credential is required",
    "auth.forbidden": "This operation needs a grant the caller does not hold",
    "request.validation_failed": "A request member is missing or invalid",
    "upstream.unavailable": "A dependency is unavailable",
    "server.internal": "Something went wrong on our side",
}


def document(status: int, members: dict, headers: dict | None = None) -> httpx2.Response:
    body = json.dumps({"jsonapi": {"version": "1.1"}, **members}).encode()
    headers = {"Content-Type": JSON_API, "Orchestra-Request-Id": "<request-id>", **(headers or {})}
    return httpx2.Response(status, headers=headers, content=body)


def resolution(attributes: dict) -> httpx2.Response:
    data = {"type": "credential-resolutions", "id": "<request-id>", "attributes": attributes}
    return document(200, {"data": data})


def failure(status: int, code: str, retry: str) -> httpx2.Response:
    error = {
        "id": "<request-id>",
        "status": str(status),
        "code": code,
        "title": TITLES[code],
        "meta": {"retry": retry},
    }
    challenge = {"WWW-Authenticate": 'Bearer error="invalid_token"'} if status == 401 else {}
    return document(status, {"errors": [error]}, challenge)


class Clock:
    def __init__(self) -> None:
        self.now = 1_000.0

    def __call__(self) -> float:
        return self.now


type Answer = httpx2.Response | type[httpx2.TransportError] | Callable[[], httpx2.Response]


class Upstreams:
    """The identity provider's token endpoint and Tenant User Management, answering from a script.

    Every scripted answer is checked against Tenant User Management's document first, unless the
    test is about an answer that document does not allow.
    """

    def __init__(self, callee, answers: list[Answer], *, token_status=200, documented=True):
        self.callee = callee
        self.answers = answers
        self.token_status = token_status
        self.documented = documented
        self.token_requests: list[httpx2.Request] = []
        self.resolutions: list[httpx2.Request] = []

    def __call__(self, request: httpx2.Request) -> httpx2.Response:
        if str(request.url) == TOKEN_URL:
            self.token_requests.append(request)
            if self.token_status != 200:
                return httpx2.Response(self.token_status)
            token = f"service-token-{len(self.token_requests)}"
            return httpx2.Response(200, json={"access_token": token, "expires_in": 300})
        assert str(request.url) == CALLEE + PATH
        self.resolutions.append(request)
        answer = self.answers.pop(0)
        if isinstance(answer, type):
            raise answer("scripted failure", request=request)
        response = answer if isinstance(answer, httpx2.Response) else answer()
        if self.documented:
            self.callee.assert_documented(response, PATH, "POST")
        return response


@pytest.fixture
def clock() -> Clock:
    return Clock()


def resolver(upstreams: Upstreams, clock: Clock) -> CredentialResolver:
    client = httpx2.Client(transport=httpx2.MockTransport(upstreams))
    tokens = ServiceTokens(
        client,
        token_url=TOKEN_URL,
        client_id="orchestra-gateway",
        client_secret=CLIENT_SECRET,
        clock=clock,
    )
    return CredentialResolver(
        client, tokens, url=CALLEE, deadline_seconds=5.0, clock=clock, sleep=lambda _: None
    )


def test_sends_the_documented_request_authenticated_as_itself(callee, clock):
    upstreams = Upstreams(callee, [resolution(RESOLVED)])
    identity = resolver(upstreams, clock).resolve(CREDENTIAL)

    assert identity == Identity(TENANT_ID, PRINCIPAL_ID, "platform-user")
    [token_request] = upstreams.token_requests
    assert token_request.headers["authorization"].startswith("Basic ")
    assert token_request.content == b"grant_type=client_credentials"
    [sent] = upstreams.resolutions
    assert sent.method == "POST"
    assert sent.headers["authorization"] == "Bearer service-token-1"
    assert sent.headers["content-type"] == JSON_API
    body = json.loads(sent.content)
    callee.assert_request(body, PATH, "POST")
    assert body["data"]["attributes"]["credential"] == CREDENTIAL


def test_each_call_is_a_client_span_whose_context_the_call_carries(callee, clock, spans):
    upstreams = Upstreams(callee, [resolution(RESOLVED)])
    trace_id = "4bf92f3577b34da6a3ce929d0e0e4736"
    incoming = TraceContextTextMapPropagator().extract(
        {"traceparent": f"00-{trace_id}-00f067aa0ba902b7-01", "tracestate": "congo=t61rcWkgMzE"}
    )
    # Stands for the request being served, in whose span the call is made.
    with tracing.tracer.start_as_current_span("request", context=incoming) as request:
        resolver(upstreams, clock).resolve(CREDENTIAL)

    [call] = [span for span in spans.get_finished_spans() if span.name == f"POST {PATH}"]
    assert call.kind is SpanKind.CLIENT
    assert call.parent.span_id == request.get_span_context().span_id
    assert call.attributes["http.response.status_code"] == 200
    [sent] = upstreams.resolutions
    span_id = format_span_id(call.get_span_context().span_id)
    assert sent.headers["traceparent"] == f"00-{trace_id}-{span_id}-01"
    assert sent.headers["tracestate"] == "congo=t61rcWkgMzE"


def test_a_repeated_call_is_a_span_of_its_own_counted_as_a_resend(callee, clock, spans):
    answers = [failure(503, "upstream.unavailable", "safe"), resolution(RESOLVED)]
    upstreams = Upstreams(callee, answers)
    resolver(upstreams, clock).resolve(CREDENTIAL)

    calls = [span for span in spans.get_finished_spans() if span.name == f"POST {PATH}"]
    assert [call.attributes.get("http.request.resend_count") for call in calls] == [None, 1]
    assert calls[0].status.status_code is StatusCode.ERROR
    assert calls[0].attributes["error.type"] == "503"
    first, repeat = upstreams.resolutions
    assert first.headers["traceparent"] != repeat.headers["traceparent"]


def test_a_rejection_is_final(callee, clock):
    upstreams = Upstreams(callee, [resolution({"outcome": "rejected"})])
    with pytest.raises(Rejected):
        resolver(upstreams, clock).resolve(CREDENTIAL)
    assert len(upstreams.resolutions) == 1


def test_the_service_token_is_reused_until_it_nears_expiry(callee, clock):
    upstreams = Upstreams(callee, [resolution(RESOLVED) for _ in range(3)])
    resolve = resolver(upstreams, clock).resolve

    resolve(CREDENTIAL)
    clock.now += 269
    resolve(CREDENTIAL)
    assert len(upstreams.token_requests) == 1

    clock.now += 2
    resolve(CREDENTIAL)
    assert len(upstreams.token_requests) == 2
    assert upstreams.resolutions[-1].headers["authorization"] == "Bearer service-token-2"


def test_a_refused_service_token_is_replaced_once(callee, clock):
    unauthenticated = failure(401, "auth.unauthenticated", "unsafe")
    upstreams = Upstreams(callee, [unauthenticated, resolution(RESOLVED)])

    assert resolver(upstreams, clock).resolve(CREDENTIAL).principal_id == PRINCIPAL_ID
    presented = [sent.headers["authorization"] for sent in upstreams.resolutions]
    assert presented == ["Bearer service-token-1", "Bearer service-token-2"]


def test_a_service_token_refused_twice_fails_closed(callee, clock):
    upstreams = Upstreams(
        callee, [failure(401, "auth.unauthenticated", "unsafe") for _ in range(2)]
    )
    with pytest.raises(ResolutionUnavailable):
        resolver(upstreams, clock).resolve(CREDENTIAL)
    assert len(upstreams.resolutions) == 2


def test_a_failure_marked_safe_is_repeated_once(callee, clock):
    upstreams = Upstreams(
        callee, [failure(503, "upstream.unavailable", "safe"), resolution(RESOLVED)]
    )
    assert resolver(upstreams, clock).resolve(CREDENTIAL).tenant_id == TENANT_ID
    assert len(upstreams.resolutions) == 2


def test_a_failure_marked_safe_twice_fails_closed(callee, clock):
    upstreams = Upstreams(callee, [failure(503, "upstream.unavailable", "safe") for _ in range(2)])
    with pytest.raises(ResolutionUnavailable):
        resolver(upstreams, clock).resolve(CREDENTIAL)
    assert len(upstreams.resolutions) == 2


@pytest.mark.parametrize(
    ("status", "code", "retry"),
    [
        (403, "auth.forbidden", "unsafe"),
        (422, "request.validation_failed", "unsafe"),
        (500, "server.internal", "indeterminate"),
    ],
)
def test_a_failure_not_marked_safe_is_never_repeated(callee, clock, status, code, retry):
    upstreams = Upstreams(callee, [failure(status, code, retry)])
    with pytest.raises(ResolutionUnavailable):
        resolver(upstreams, clock).resolve(CREDENTIAL)
    assert len(upstreams.resolutions) == 1


def test_an_unreachable_service_is_tried_once_more(callee, clock):
    upstreams = Upstreams(callee, [httpx2.ConnectError, resolution(RESOLVED)])
    assert resolver(upstreams, clock).resolve(CREDENTIAL).principal_kind == "platform-user"
    assert len(upstreams.resolutions) == 2


def test_a_service_that_stays_unreachable_fails_closed(callee, clock):
    upstreams = Upstreams(callee, [httpx2.ConnectError, httpx2.ConnectTimeout])
    with pytest.raises(ResolutionUnavailable):
        resolver(upstreams, clock).resolve(CREDENTIAL)
    assert len(upstreams.resolutions) == 2


def test_an_answer_that_never_arrives_is_not_repeated(callee, clock):
    upstreams = Upstreams(callee, [httpx2.ReadTimeout])
    with pytest.raises(ResolutionUnavailable):
        resolver(upstreams, clock).resolve(CREDENTIAL)
    assert len(upstreams.resolutions) == 1


def test_the_deadline_bounds_every_attempt(callee, clock):
    def late_failure() -> httpx2.Response:
        clock.now += 6
        return failure(503, "upstream.unavailable", "safe")

    upstreams = Upstreams(callee, [late_failure, resolution(RESOLVED)])
    with pytest.raises(ResolutionUnavailable):
        resolver(upstreams, clock).resolve(CREDENTIAL)
    assert len(upstreams.resolutions) == 1
    assert upstreams.resolutions[0].extensions["timeout"]["read"] <= 5.0


@pytest.mark.parametrize(
    "answer",
    [
        httpx2.Response(200, content=b"<html></html>"),
        resolution({"outcome": "undecided"}),
        resolution({"outcome": "resolved", "tenant_id": TENANT_ID}),
        document(200, {"data": {"type": "identity-probes", "id": "x", "attributes": RESOLVED}}),
    ],
    ids=["not-json", "unknown-outcome", "no-principal", "another-type"],
)
def test_an_answer_that_establishes_no_identity_fails_closed(callee, clock, answer):
    upstreams = Upstreams(callee, [answer], documented=False)
    with pytest.raises(ResolutionUnavailable):
        resolver(upstreams, clock).resolve(CREDENTIAL)


def test_a_token_endpoint_that_fails_means_nothing_is_sent(callee, clock):
    upstreams = Upstreams(callee, [], token_status=500)
    with pytest.raises(ResolutionUnavailable):
        resolver(upstreams, clock).resolve(CREDENTIAL)
    assert upstreams.resolutions == []


def test_the_log_names_the_callees_request_and_never_a_secret(callee, clock, caplog):
    upstreams = Upstreams(callee, [failure(403, "auth.forbidden", "unsafe")])
    with caplog.at_level("DEBUG"), pytest.raises(ResolutionUnavailable):
        resolver(upstreams, clock).resolve(CREDENTIAL)
    assert "auth.forbidden" in caplog.text
    assert "<request-id>" in caplog.text
    for secret in (CREDENTIAL, "service-token", CLIENT_SECRET):
        assert secret not in caplog.text
