import { describe, expect, it } from 'vitest';
import http from '../lib/http';
import { getServerStatus, subscribeServerStatus, wakeServer, whenServerReady } from '../lib/serverStatus';

const ok = () => Promise.resolve(new Response('{}', { status: 200 }));
const fakeAdapter = (config) => Promise.resolve({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config });

/** Every status the store moves through until it settles. */
const recordStatuses = () => {
  const seen = [getServerStatus()];
  const stop = subscribeServerStatus(() => seen.push(getServerStatus()));
  return { seen, stop };
};

describe('wakeServer', () => {
  it('stays quiet when the API answers straight away', async () => {
    const { seen, stop } = recordStatuses();
    wakeServer({ fetchImpl: ok, slowAfterMs: 50 });
    await whenServerReady();
    await new Promise((r) => setTimeout(r, 80));
    stop();
    expect(seen).not.toContain('waking');
    expect(getServerStatus()).toBe('ready');
  });

  it('reports waking and holds API requests until the API answers', async () => {
    let wake;
    const slowHealth = () => new Promise((resolve) => { wake = () => resolve(new Response('{}', { status: 200 })); });
    wakeServer({ fetchImpl: slowHealth, slowAfterMs: 10 });

    let settled = false;
    const request = http.get('/api/auth/profile', { adapter: fakeAdapter }).then((res) => {
      settled = true;
      return res;
    });

    await new Promise((r) => setTimeout(r, 40));
    expect(getServerStatus()).toBe('waking');
    expect(settled).toBe(false);

    wake();
    const res = await request;
    expect(res.data).toEqual({ ok: true });
    expect(getServerStatus()).toBe('ready');
  });

  it('retries until the API is reachable', async () => {
    let calls = 0;
    const flaky = () => {
      calls += 1;
      return calls < 3 ? Promise.reject(new TypeError('Failed to fetch')) : ok();
    };
    wakeServer({ fetchImpl: flaky, slowAfterMs: 1000, retryMs: 5 });
    await whenServerReady();
    expect(calls).toBe(3);
    expect(getServerStatus()).toBe('ready');
  });

  it('gives up and releases held requests when the API never answers', async () => {
    wakeServer({ fetchImpl: () => new Promise(() => {}), giveUpAfterMs: 0 });
    await whenServerReady();
    expect(getServerStatus()).toBe('offline');
    const res = await http.get('/api/health', { adapter: fakeAdapter });
    expect(res.status).toBe(200);
  });
});
