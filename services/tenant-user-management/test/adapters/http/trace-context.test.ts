import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { Hono } from 'hono';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { install, type JsonApiEnv, respond } from '../../../src/adapters/http/json-api.ts';
import { requestLogFields, scopeToTenant, traceRequests } from '../../../src/adapters/http/trace-context.ts';
import { NIL_UUID } from '../../../src/domain/identifiers.ts';

// The example the W3C Trace Context recommendation gives.
const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
const PARENT_ID = '00f067aa0ba902b7';
const TRACEPARENT = `00-${TRACE_ID}-${PARENT_ID}-01`;

// Every span a request ends, kept in memory by a provider installed for this file alone.
const spans = new InMemorySpanExporter();

beforeAll(() => {
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  trace.setGlobalTracerProvider(new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter: spans })] }));
});

afterAll(() => {
  trace.disable();
  context.disable();
});

beforeEach(() => spans.reset());

function served() {
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const app = new Hono<JsonApiEnv>();
  app.use(traceRequests(log));
  install(app, log);
  app.get('/_test/trace', (c) => respond(c, { meta: { fields: requestLogFields() } }));
  app.get('/_test/tenant', (c) => {
    scopeToTenant('tenant-a');
    return respond(c, { meta: { fields: requestLogFields() } });
  });
  app.get('/_test/fault', () => {
    throw new Error('connection to db.internal:5432 refused');
  });
  return { app, log };
}

async function fieldsOf(res: Response): Promise<Record<string, string>> {
  const { meta } = (await res.json()) as { meta: { fields: Record<string, string> } };
  return meta.fields;
}

function servedIn() {
  const found = spans.getFinishedSpans().filter((span) => span.kind === SpanKind.SERVER);
  expect(found).toHaveLength(1);
  const [span] = found;
  if (span === undefined) throw new Error('no server span');
  return span;
}

describe('traceRequests', () => {
  it('continues a valid trace in a server span of its own, and logs inside it', async () => {
    const { app, log } = served();
    const res = await app.request('/_test/trace', { headers: { traceparent: TRACEPARENT } });
    const fields = await fieldsOf(res);

    const span = servedIn();
    expect(span.spanContext().traceId).toBe(TRACE_ID);
    expect(span.spanContext().spanId).not.toBe(PARENT_ID);
    expect(span.parentSpanContext?.spanId).toBe(PARENT_ID);
    expect(span.name).toBe('GET /_test/trace');
    expect(span.attributes).toMatchObject({ 'http.route': '/_test/trace', 'http.response.status_code': 200 });
    expect(fields).toEqual({ tenant_id: NIL_UUID, trace_id: TRACE_ID, span_id: span.spanContext().spanId });
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: res.headers.get('Orchestra-Request-Id'),
        tenant_id: NIL_UUID,
        'http.request.method': 'GET',
        'http.route': '/_test/trace',
        'http.response.status_code': 200,
      }),
      'request served',
    );
  });

  it('reads the known fields of a later version, and ignores what follows them', async () => {
    const { app } = served();
    await app.request('/_test/trace', { headers: { traceparent: `cc-${TRACE_ID}-${PARENT_ID}-01-future-fields` } });
    expect(servedIn().spanContext().traceId).toBe(TRACE_ID);
  });

  it.each([
    ['a missing header', undefined],
    ['uppercase hex', `00-${TRACE_ID.toUpperCase()}-${PARENT_ID}-01`],
    ['an all-zero trace id', `00-${'0'.repeat(32)}-${PARENT_ID}-01`],
    ['an all-zero parent id', `00-${TRACE_ID}-${'0'.repeat(16)}-01`],
    ['the forbidden version ff', `ff-${TRACE_ID}-${PARENT_ID}-01`],
    ['version 00 with more after it', `${TRACEPARENT}-extra`],
    ['two headers joined into one', `${TRACEPARENT}, ${TRACEPARENT}`],
  ])('starts a new trace for %s', async (_why, traceparent) => {
    const { app } = served();
    await app.request('/_test/trace', { headers: traceparent === undefined ? {} : { traceparent } });
    const span = servedIn();
    expect(span.parentSpanContext).toBeUndefined();
    expect(span.spanContext().traceId).not.toBe(TRACE_ID);
  });

  it('traces and logs a request refused before it was routed with the Nil UUID, naming no route', async () => {
    const { app, log } = served();
    const res = await app.request('/nowhere');
    expect(res.status).toBe(404);
    const span = servedIn();
    expect(span.name).toBe('GET');
    expect(span.attributes['http.route']).toBeUndefined();
    expect(span.attributes['http.response.status_code']).toBe(404);
    expect(span.attributes['orchestra.tenant_id']).toBe(NIL_UUID);
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: NIL_UUID, 'http.response.status_code': 404 }),
      'request served',
    );
  });

  it('carries the Tenant a request concerns on its span and on every line logged after it is known', async () => {
    const { app, log } = served();
    const fields = await fieldsOf(await app.request('/_test/tenant'));
    expect(fields.tenant_id).toBe('tenant-a');
    expect(servedIn().attributes['orchestra.tenant_id']).toBe('tenant-a');
    expect(log.info).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: 'tenant-a' }), 'request served');
  });

  it('marks the span of a request that faulted as an error', async () => {
    const { app } = served();
    const res = await app.request('/_test/fault');
    expect(res.status).toBe(500);
    expect(servedIn().status.code).toBe(SpanStatusCode.ERROR);
  });

  it('gives a line logged outside any request the Nil UUID and no trace, whatever it is scoped to', () => {
    scopeToTenant('tenant-a');
    expect(requestLogFields()).toEqual({ tenant_id: NIL_UUID });
  });
});
