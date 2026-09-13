// W3C Trace Context through OpenTelemetry (http-conventions.md HC12). A valid incoming traceparent is
// continued, never replaced: the request is served in a server span whose parent is the caller's
// span, and every line logged inside it carries that trace and span. A missing or invalid traceparent
// starts a new trace. The composition root installs the tracer provider (../telemetry/tracing.ts);
// without one, a request is served exactly the same, untraced.
import { performance } from 'node:perf_hooks';
import { isSpanContextValid, ROOT_CONTEXT, SpanKind, SpanStatusCode, type TextMapGetter, trace } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import type { MiddlewareHandler } from 'hono';
import { routePath } from 'hono/route';
import type { JsonApiEnv, Log } from './json-api.ts';

// W3C Trace Context and nothing else, so baggage a caller sends is not carried into the service.
const propagator = new W3CTraceContextPropagator();

// Headers.get joins repeated headers with a comma, so two traceparent headers make one invalid
// header and start a new trace.
const fromHeaders: TextMapGetter<Headers> = {
  keys: (headers) => [...headers.keys()],
  get: (headers, key) => headers.get(key) ?? undefined,
};

/** What every log line inside a request carries, under OpenTelemetry's log field names. */
export function traceLogFields(): Record<string, string> {
  const span = trace.getActiveSpan()?.spanContext();
  return span !== undefined && isSpanContextValid(span) ? { trace_id: span.traceId, span_id: span.spanId } : {};
}

/**
 * Serves every request in a server span of its own, and logs one line for it once it is answered,
 * with the attribute names of OpenTelemetry's HTTP semantic conventions. The span and the line carry
 * the Tenant the request concerns once it is known (invariant I1), and never a Principal. Registered
 * before everything else, so a request refused before routing is traced and logged too.
 */
export function traceRequests(log: Log): MiddlewareHandler<JsonApiEnv> {
  const tracer = trace.getTracer('tenant-user-management');
  return async (c, next) => {
    const method = c.req.method;
    const attributes = {
      'http.request.method': method,
      'url.path': c.req.path,
      'url.scheme': new URL(c.req.url).protocol.replace(/:$/, ''),
    };
    const parent = propagator.extract(ROOT_CONTEXT, c.req.raw.headers, fromHeaders);
    await tracer.startActiveSpan(method, { kind: SpanKind.SERVER, attributes }, parent, async (span) => {
      const started = performance.now();
      try {
        await next();
      } finally {
        const status = c.res.status;
        // The last route the request matched; middleware alone, as for an unknown path, is no route.
        const matched = routePath(c, -1);
        const route = matched === '*' || matched === '/*' ? undefined : matched;
        const tenantId = c.get('tenantId');
        if (route !== undefined) {
          span.updateName(`${method} ${route}`);
          span.setAttribute('http.route', route);
        }
        if (tenantId !== undefined) span.setAttribute('orchestra.tenant_id', tenantId);
        span.setAttribute('http.response.status_code', status);
        if (status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
        log.info(
          {
            requestId: c.get('requestId'),
            tenant_id: tenantId,
            'http.request.method': method,
            'http.route': route,
            'url.path': c.req.path,
            'http.response.status_code': status,
            'http.server.request.duration': (performance.now() - started) / 1_000,
          },
          'request served',
        );
        span.end();
      }
    });
  };
}
