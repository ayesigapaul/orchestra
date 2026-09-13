"""W3C Trace Context through OpenTelemetry (http-conventions.md HC12, tech-stack.md section 7).

A valid incoming traceparent is continued, never replaced: the Gateway serves the request in a
server span whose parent is the caller's span, and every line it logs inside the request carries
that trace and span. A missing or invalid traceparent starts a new trace. A call to another service
is made in a client span of its own whose context the call carries, so the callee's span names it as
the parent. Every line and server span also carries a tenant identifier: the request's Tenant once
its credential has resolved, and otherwise the Nil UUID, which marks work that belongs to no Tenant
(ADR-0028). Spans are exported over OTLP when an endpoint is configured, and telemetry is best
effort: a span that cannot be exported changes nothing a request does.
"""

import contextvars
import json
import logging
import time
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlsplit

from opentelemetry import trace
from opentelemetry.context import Context
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import ALWAYS_ON, ParentBased
from opentelemetry.trace import Span, SpanKind, StatusCode
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from starlette.types import ASGIApp, Message, Receive, Scope, Send

SERVICE_NAME = "gateway"

# RFC 9562's Nil UUID, which marks telemetry for work that belongs to no Tenant (ADR-0028). No
# Tenant ever has it as its identifier.
NIL_TENANT_ID = "00000000-0000-0000-0000-000000000000"

logger = logging.getLogger("orchestra_gateway.requests")
tracer = trace.get_tracer("orchestra_gateway")

# W3C Trace Context and nothing else, so baggage a caller sends is not carried into Orchestra.
_PROPAGATOR = TraceContextTextMapPropagator()
_TRACE_HEADERS = {b"traceparent", b"tracestate"}

# The state of the request being served, where its Tenant is recorded once its credential resolves.
# A request's dependencies run in copies of its context, and every copy holds this same dictionary.
_request_state: contextvars.ContextVar[dict[str, Any] | None] = contextvars.ContextVar(
    "orchestra_gateway_request_state", default=None
)


def current_tenant_id() -> str:
    """The Tenant of the request being served, or the Nil UUID when it has none (ADR-0028)."""
    state = _request_state.get()
    return (state or {}).get("tenant_id") or NIL_TENANT_ID


def configure_tracing(otlp_endpoint: str | None) -> TracerProvider | None:
    """Installs the Gateway's tracer provider, exporting over OTLP/HTTP when an endpoint is given.

    A trace the caller sampled is recorded, and so is every trace the Gateway starts. Returns the
    provider to shut down on exit, or None when one is installed already, as the tests install one.
    """
    if isinstance(trace.get_tracer_provider(), TracerProvider):
        return None
    provider = TracerProvider(
        sampler=ParentBased(ALWAYS_ON), resource=Resource.create({"service.name": SERVICE_NAME})
    )
    if otlp_endpoint:
        exporter = OTLPSpanExporter(endpoint=f"{otlp_endpoint.rstrip('/')}/v1/traces")
        provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return provider


def _incoming(scope: Scope) -> Context:
    """The caller's trace context. Repeated headers are joined, as HTTP joins them, so two
    traceparent headers make one invalid header and start a new trace."""
    carrier: dict[str, str] = {}
    for raw_name, raw_value in scope["headers"]:
        if raw_name in _TRACE_HEADERS:
            name, value = raw_name.decode("latin-1"), raw_value.decode("latin-1")
            carrier[name] = f"{carrier[name]},{value}" if name in carrier else value
    return _PROPAGATOR.extract(carrier)


@contextmanager
def outgoing_call(
    method: str, url: str, *, template: str | None = None, resend_count: int = 0
) -> Iterator[tuple[Span, dict[str, str]]]:
    """A call to another service, in a client span of its own. The headers it yields carry that
    span's trace context, so the callee serves the call in a span whose parent is this one."""
    target = urlsplit(url)
    attributes: dict[str, str | int] = {
        "http.request.method": method,
        "server.address": target.hostname or "",
        "url.full": url,
    }
    if target.port is not None:
        attributes["server.port"] = target.port
    if resend_count:
        attributes["http.request.resend_count"] = resend_count
    name = f"{method} {template}" if template else method
    with tracer.start_as_current_span(name, kind=SpanKind.CLIENT, attributes=attributes) as span:
        headers: dict[str, str] = {}
        _PROPAGATOR.inject(headers)
        yield span, headers


def record_answer(span: Span, status_code: int) -> None:
    """Records the status a call was answered with. To the caller, any refusal is an error."""
    span.set_attribute("http.response.status_code", status_code)
    if status_code >= 400:
        span.set_attribute("error.type", str(status_code))
        span.set_status(StatusCode.ERROR)


class TraceContextMiddleware:
    """Serves every request in a server span of its own, and logs one line once it is answered.

    Attribute names are those of OpenTelemetry's HTTP semantic conventions. The span and every line
    carry the request's Tenant once its credential has resolved, and the Nil UUID until then
    (invariant I1, ADR-0028). Neither ever carries a Principal.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        method = scope["method"]
        status = 500
        started = time.perf_counter()

        async def send_with_status(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        attributes = {
            "http.request.method": method,
            "url.path": scope["path"],
            "url.scheme": scope["scheme"],
        }
        state = scope.setdefault("state", {})
        token = _request_state.set(state)
        try:
            with tracer.start_as_current_span(
                method, context=_incoming(scope), kind=SpanKind.SERVER, attributes=attributes
            ) as span:
                try:
                    await self.app(scope, receive, send_with_status)
                finally:
                    # The router records the route it matched, so an unknown path has none.
                    route = getattr(scope.get("route"), "path", None)
                    tenant_id = current_tenant_id()
                    if route is not None:
                        span.update_name(f"{method} {route}")
                        span.set_attribute("http.route", route)
                    span.set_attribute("orchestra.tenant_id", tenant_id)
                    span.set_attribute("http.response.status_code", status)
                    if status >= 500:
                        span.set_status(StatusCode.ERROR)
                    logger.info(
                        "request served",
                        extra={
                            "request_id": state.get("request_id"),
                            "tenant_id": tenant_id,
                            "http.request.method": method,
                            "http.route": route,
                            "url.path": scope["path"],
                            "http.response.status_code": status,
                            "http.server.request.duration": time.perf_counter() - started,
                        },
                    )
        finally:
            _request_state.reset(token)


class TraceLogFilter(logging.Filter):
    """Puts the current trace and Tenant on every log record. The trace uses OpenTelemetry's log
    field names, and a line with no Tenant carries the Nil UUID (ADR-0028)."""

    def filter(self, record: logging.LogRecord) -> bool:
        context = trace.get_current_span().get_span_context()
        record.trace_id = trace.format_trace_id(context.trace_id) if context.is_valid else None
        record.span_id = trace.format_span_id(context.span_id) if context.is_valid else None
        if getattr(record, "tenant_id", None) is None:
            record.tenant_id = current_tenant_id()
        return True


_STANDARD_ATTRIBUTES = set(vars(logging.makeLogRecord({}))) | {"message", "asctime"}


class JsonLogFormatter(logging.Formatter):
    """One JSON object per line, with an RFC 3339 timestamp in UTC."""

    def format(self, record: logging.LogRecord) -> str:
        line = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
        }
        for name, value in vars(record).items():
            if name not in _STANDARD_ATTRIBUTES and value is not None:
                line[name] = value
        if record.exc_info:
            line["error"] = self.formatException(record.exc_info)
        return json.dumps(line, default=str)


def configure_logging(level: int = logging.INFO) -> None:
    """Sends the Gateway's own log records to standard error, as JSON lines carrying their trace."""
    gateway = logging.getLogger("orchestra_gateway")
    if any(isinstance(handler.formatter, JsonLogFormatter) for handler in gateway.handlers):
        return
    handler = logging.StreamHandler()
    handler.setFormatter(JsonLogFormatter())
    handler.addFilter(TraceLogFilter())
    gateway.setLevel(level)
    gateway.addHandler(handler)
    gateway.propagate = False
