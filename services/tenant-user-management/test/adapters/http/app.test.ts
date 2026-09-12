import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/adapters/http/app.ts';

describe('HTTP adapter', () => {
  it('reports health', async () => {
    const res = await createApp().request('/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('exposes no endpoint its contract has not specified', async () => {
    expect((await createApp().request('/resolve')).status).toBe(404);
  });
});
