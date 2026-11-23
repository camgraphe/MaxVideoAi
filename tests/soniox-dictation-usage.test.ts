import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSonioxDictationUsage } from '../frontend/server/soniox-dictation-usage';

const options = { apiKey: 'usage-key', region: 'eu', now: new Date('2026-11-23T10:30:00Z') };
const accountA = 'maxvideoai-dictation:' + 'a'.repeat(64);
const accountB = 'maxvideoai-dictation:' + 'b'.repeat(64);

function usageLog(uuid: string, account: string) {
  return {
    uuid,
    request_scope: 'api',
    client_reference_id: account,
    model: 'stt-rt-v6',
    input_audio_duration_ms: 60000,
    input_audio_tokens: 420,
    input_text_tokens: 10,
    output_text_tokens: 70,
    cost_usd: '0.0020000000',
  };
}

test('counts unique accounts and completed dictations across Soniox pages', async (t) => {
  const firstDictation = usageLog('one', accountA);
  const pages = [
    {
      usage_logs: [
        firstDictation,
        usageLog('two', accountA),
        usageLog('old', ''),
        usageLog('other', 'another-integration'),
        { ...usageLog('test', accountA), request_scope: 'playground' },
        { ...usageLog('async', accountA), model: 'stt-async-v6' },
      ],
      next_page_cursor: 'page-two',
    },
    { usage_logs: [firstDictation, usageLog('three', accountB)], next_page_cursor: null },
  ];
  const urls: URL[] = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', async (input: URL, init: RequestInit) => {
    urls.push(new URL(input));
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer usage-key');
    assert.equal(init.cache, 'no-store');
    return Response.json(pages.shift());
  });

  assert.deepEqual(await loadSonioxDictationUsage(options), {
    status: 'ready',
    accounts: 2,
    sessions: 3,
    audioMs: 180000,
    inputAudioTokens: 1260,
    inputTextTokens: 30,
    outputTextTokens: 210,
    costUsd: 0.006,
  });
  assert.equal(fetchMock.mock.callCount(), 2);
  for (const url of urls) {
    assert.equal(url.origin + url.pathname, 'https://api.eu.soniox.com/v1/usage-logs');
    assert.equal(url.searchParams.get('start_time'), '2026-11-16T10:30:00.000Z');
    assert.equal(url.searchParams.get('end_time'), '2026-11-23T10:30:00.000Z');
  }
  assert.equal(urls[0].searchParams.get('cursor'), null);
  assert.equal(urls[1].searchParams.get('cursor'), 'page-two');
  assert.equal(fetchMock.mock.calls[0].arguments[1].signal, fetchMock.mock.calls[1].arguments[1].signal);
});

test('distinguishes empty Soniox usage from missing configuration and denied access', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ usage_logs: [], next_page_cursor: null }));
  assert.deepEqual(await loadSonioxDictationUsage({ apiKey: ' ' }), { status: 'not-configured' });
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.deepEqual(await loadSonioxDictationUsage(options), {
    status: 'ready',
    accounts: 0,
    sessions: 0,
    audioMs: 0,
    inputAudioTokens: 0,
    inputTextTokens: 0,
    outputTextTokens: 0,
    costUsd: 0,
  });
  fetchMock.mock.mockImplementation(async () => new Response(null, { status: 403 }));
  assert.deepEqual(await loadSonioxDictationUsage(options), { status: 'access-denied' });
});

test('discards incomplete totals when a subsequent Soniox page fails', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ usage_logs: [usageLog('one', accountA)], next_page_cursor: 'next' }));
  fetchMock.mock.mockImplementationOnce(async () => new Response(null, { status: 503 }), 1);
  assert.deepEqual(await loadSonioxDictationUsage(options), { status: 'unavailable' });
  assert.equal(fetchMock.mock.callCount(), 2);
});
