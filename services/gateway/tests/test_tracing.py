"""W3C Trace Context: the Gateway continues a valid trace in a span of its own, and logs in it."""

import json
import logging

import pytest
from opentelemetry import trace
from opentelemetry.trace import SpanKind, StatusCode

from orchestra_gateway import tracing
from orchestra_gateway.tracing import JsonLogFormatter, TraceLogFilter

# The example the W3C Trace Context recommendation gives.
TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736"
PARENT_ID = "00f067aa0ba902b7"
TRACEPARENT = f"00-{TRACE_ID}-{PARENT_ID}-01"


def ids(span) -> tuple[str, str]:
    context = span.get_span_context()
    return trace.format_trace_id(context.trace_id), trace.format_span_id(context.span_id)


def served_in(spans):
    [span] = [span for span in spans.get_finished_spans() if span.kind is SpanKind.SERVER]
    return span


def test_continues_a_valid_trace_in_a_server_span_of_its_own(client, mint, spans, identity):
    headers = {"Authorization": f"Bearer {mint()}", "traceparent": TRACEPARENT}
    response = client.get("/_probe/identity", headers=headers)

    assert response.status_code == 200
    span = served_in(spans)
    trace_id, span_id = ids(span)
    assert trace_id == TRACE_ID and span_id != PARENT_ID
    assert span.parent.is_remote and trace.format_span_id(span.parent.span_id) == PARENT_ID
    assert span.name == "GET /_probe/identity"
    assert span.attributes["http.route"] == "/_probe/identity"
    assert span.attributes["http.response.status_code"] == 200
    assert span.attributes["orchestra.tenant_id"] == identity.tenant_id
    assert "principal_id" not in json.dumps(dict(span.attributes))


def test_reads_the_known_fields_of_a_later_version(client, spans):
    client.get("/healthz", headers={"traceparent": f"cc-{TRACE_ID}-{PARENT_ID}-01-future-fields"})
    assert ids(served_in(spans))[0] == TRACE_ID


@pytest.mark.parametrize(
    "headers",
    [
        [],
        [("traceparent", f"00-{TRACE_ID.upper()}-{PARENT_ID}-01")],
        [("traceparent", f"00-{'0' * 32}-{PARENT_ID}-01")],
        [("traceparent", f"00-{TRACE_ID}-{'0' * 16}-01")],
        [("traceparent", f"ff-{TRACE_ID}-{PARENT_ID}-01")],
        [("traceparent", f"{TRACEPARENT}-extra")],
        [("traceparent", TRACEPARENT), ("traceparent", TRACEPARENT)],
    ],
    ids=[
        "missing",
        "uppercase",
        "all-zero-trace",
        "all-zero-parent",
        "version-ff",
        "more-after-00",
        "two-headers",
    ],
)
def test_starts_a_new_trace_when_there_is_none_to_continue(client, spans, headers):
    client.get("/healthz", headers=headers)
    span = served_in(spans)
    assert span.parent is None
    assert ids(span)[0] != TRACE_ID


def test_logs_one_line_per_request_inside_its_span(client, mint, spans, caplog, identity):
    caplog.handler.addFilter(TraceLogFilter())
    headers = {"Authorization": f"Bearer {mint()}", "traceparent": TRACEPARENT}
    with caplog.at_level("INFO", logger="orchestra_gateway.requests"):
        response = client.get("/_probe/identity", headers=headers)

    [record] = [record for record in caplog.records if record.getMessage() == "request served"]
    assert (record.trace_id, record.span_id) == ids(served_in(spans))
    assert record.request_id == response.headers["orchestra-request-id"]
    assert record.tenant_id == identity.tenant_id
    assert getattr(record, "http.route") == "/_probe/identity"
    assert getattr(record, "http.response.status_code") == 200


def test_a_refused_request_is_traced_and_logged_without_a_tenant(client, spans, caplog):
    with caplog.at_level("INFO", logger="orchestra_gateway.requests"):
        response = client.get("/_probe/identity")

    assert response.status_code == 401
    span = served_in(spans)
    assert span.attributes["http.response.status_code"] == 401
    assert span.status.status_code is StatusCode.UNSET
    assert "orchestra.tenant_id" not in span.attributes
    [record] = [record for record in caplog.records if record.getMessage() == "request served"]
    assert record.tenant_id is None


def test_an_unknown_path_names_no_route(client, spans):
    assert client.get("/no-such-path").status_code == 404
    span = served_in(spans)
    assert span.name == "GET" and "http.route" not in span.attributes


def test_a_fault_marks_its_span_as_an_error(app, client, spans):
    @app.get("/_test/fault")
    def fault():
        raise RuntimeError("connection to db.internal:5432 refused")

    faulty = type(client)(app, raise_server_exceptions=False)
    assert faulty.get("/_test/fault").status_code == 500
    span = served_in(spans)
    assert span.status.status_code is StatusCode.ERROR
    assert span.attributes["http.response.status_code"] == 500


def test_log_lines_are_json_with_their_trace_and_an_rfc_3339_time(spans):
    record = logging.makeLogRecord(
        {"name": "orchestra_gateway.test", "levelno": 20, "levelname": "INFO", "msg": "hello"}
    )
    with tracing.tracer.start_as_current_span("work") as span:
        TraceLogFilter().filter(record)
    line = json.loads(JsonLogFormatter().format(record))
    assert (line["trace_id"], line["span_id"]) == ids(span)
    assert (line["level"], line["message"]) == ("info", "hello")
    assert line["time"].endswith("+00:00")


def test_a_line_logged_outside_a_request_carries_no_trace():
    record = logging.makeLogRecord({"name": "orchestra_gateway.test", "msg": "starting"})
    TraceLogFilter().filter(record)
    line = json.loads(JsonLogFormatter().format(record))
    assert "trace_id" not in line and "span_id" not in line


def test_an_installed_tracer_provider_is_kept():
    assert tracing.configure_tracing("http://collector.test:4318") is None
