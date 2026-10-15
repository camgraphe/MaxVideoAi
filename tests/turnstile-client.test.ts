import assert from 'node:assert/strict';
import test from 'node:test';
import { readTurnstileClientStatus } from '../frontend/lib/turnstile-client';

test('widget recovery reads the current public configuration without deployment-pinning cookies', async t => {
  const saved = globalThis.fetch;
  t.after(() => { globalThis.fetch = saved; });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ activeSiteKey: 'B', acceptedSiteKeys: ['B'] });
  };
  assert.equal(await readTurnstileClientStatus('A', new AbortController().signal), 'reload');
  assert.equal(calls[0].url, '/api/turnstile/config');
  assert.equal(calls[0].init?.cache, 'no-store');
  assert.equal(calls[0].init?.credentials, 'omit');
});

test('malformed and failed public configuration stays unavailable and does not allow a challenge', async t => {
  const saved = globalThis.fetch;
  t.after(() => { globalThis.fetch = saved; });
  for (const body of [null, {}, { activeSiteKey: 'B', acceptedSiteKeys: [] },
    { activeSiteKey: 'B', acceptedSiteKeys: ['A'] }, { activeSiteKey: 'B', acceptedSiteKeys: [42, 'B'] }]) {
    globalThis.fetch = async () => Response.json(body);
    assert.equal(await readTurnstileClientStatus('B', new AbortController().signal), 'unavailable');
  }
  globalThis.fetch = async () => new Response('{', { status: 200 });
  assert.equal(await readTurnstileClientStatus('B', new AbortController().signal), 'unavailable');
  globalThis.fetch = async () => new Response('', { status: 503 });
  assert.equal(await readTurnstileClientStatus('B', new AbortController().signal), 'unavailable');
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  assert.equal(await readTurnstileClientStatus('B', new AbortController().signal), 'unavailable');
});
