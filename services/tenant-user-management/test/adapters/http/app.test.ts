import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../src/adapters/http/app.ts';
import { expectDocumented, expectErrorDocument } from './contract.ts';

const JSON_API = 'application/vnd.api+json';
const silent = { error: () => {} };
const request = (path: string, init?: RequestInit) =>
  createApp({ log: silent }).request(path, init);

describe('HTTP adapter', () => {
  it('reports health as a meta document', async () => {
    const body = await expectDocumented(await request('/healthz'), '/healthz', 'GET');
    expect(body).toEqual({ jsonapi: { version: '1.1' }, meta: { status: 'ok' } });
  });

  it('answers HEAD wherever it answers GET', async () => {
    const res = await request('/healthz', { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(res.headers.has('Orchestra-Request-Id')).toBe(true);
  });

  it('exposes no endpoint its contract has not specified', async () => {
    const res = await request('/resolve');
    expect(res.status).toBe(404);
    expect((await expectErrorDocument(res)).errors?.[0]?.code).toBe('resource.not_found');
  });

  it('names the allowed methods when the method is wrong', async () => {
    const res = await request('/healthz', { method: 'DELETE' });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET, HEAD');
    expect((await expectErrorDocument(res)).errors?.[0]?.code).toBe('request.method_not_allowed');
  });

  it.each([`${JSON_API}; charset=utf-8`, `${JSON_API}; ext="https://example.test/ext"`])(
    'refuses Accept: %s, which asks for JSON:API only with unsupported parameters',
    async (accept) => {
      const res = await request('/healthz', { headers: { Accept: accept } });
      const body = await expectDocumented(res, '/healthz', 'GET');
      expect(body.errors?.[0]).toMatchObject({
        code: 'request.not_acceptable',
        source: { header: 'Accept' },
      });
    },
  );

  it.each([
    '*/*',
    'application/json',
    `${JSON_API}; charset=utf-8, ${JSON_API}`,
    `${JSON_API}; profile="https://example.test/profile"; q=0.9`,
  ])('serves JSON:API for Accept: %s', async (accept) => {
    const res = await request('/healthz', { headers: { Accept: accept } });
    expect(res.status).toBe(200);
    await expectDocumented(res, '/healthz', 'GET');
  });

  it.each([
    ['POST', { 'Content-Type': 'application/json', 'Content-Length': '2' }],
    ['POST', { 'Content-Length': '2' }],
    ['GET', { 'Content-Type': `${JSON_API}; charset=utf-8` }],
  ] as const)('refuses %s with %j as an unsupported media type', async (method, headers) => {
    const body = method === 'POST' ? new TextEncoder().encode('{}') : null;
    const res = await request('/healthz', { method, headers, body });
    expect(res.status).toBe(415);
    expect((await expectErrorDocument(res)).errors?.[0]).toMatchObject({
      code: 'request.unsupported_media_type',
      source: { header: 'Content-Type' },
    });
  });

  it('refuses a query parameter the operation does not declare', async () => {
    const res = await request('/healthz?verbose=1');
    const body = await expectDocumented(res, '/healthz', 'GET');
    expect(body.errors?.[0]).toMatchObject({
      code: 'request.invalid_parameter',
      source: { parameter: 'verbose' },
    });
  });

  it.each([
    ['GET', 'safe'],
    ['POST', 'indeterminate'],
  ] as const)('logs a fault on %s and never describes it, with retry %s', async (method, retry) => {
    const log = { error: vi.fn() };
    const app = createApp({ log });
    app.on(method, '/_test/fault', () => {
      throw new Error('connection to db.internal:5432 refused');
    });

    const res = await app.request('/_test/fault', { method });
    expect(res.status).toBe(500);
    expect(await res.clone().text()).not.toContain('db.internal');
    const body = await expectErrorDocument(res);
    expect(body.errors?.[0]).toMatchObject({ code: 'server.internal', meta: { retry } });
    expect(log.error).toHaveBeenCalledOnce();
  });
});
