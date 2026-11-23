import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { reserveDictationSession, issueDictationKey } from '../frontend/server/soniox-dictation';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('parallel token requests share a budget per account and reset the next hour', async (t) => {
  const db = await startDisposablePostgres('soniox-issuance');
  t.after(() => db.cleanup());
  await db.pool.query(await readFile('neon/migrations/102_dictation_session_windows.sql', 'utf8'));
  const runQuery = async <T,>(sql: string, params?: ReadonlyArray<unknown>): Promise<T[]> =>
    (await db.pool.query(sql, Array.from(params ?? []))).rows;
  const user = randomUUID();
  const claims = await Promise.all(Array.from({ length: 36 }, () => reserveDictationSession(user, runQuery)));
  assert.equal(claims.filter(Boolean).length, 30);
  assert.equal(await reserveDictationSession(randomUUID(), runQuery), true);
  await db.pool.query("UPDATE dictation_session_windows SET window_start = window_start - interval '1 hour' WHERE user_id = $1", [user]);
  assert.equal(await reserveDictationSession(user, runQuery), true);
});

test('Soniox grants one bounded STT stream and only returns the short-lived key', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url: string, _init: RequestInit) =>
    Response.json({ api_key: 'temporary', expires_at: 'later' }, { status: 201 }));
  const signal = new AbortController().signal;
  assert.deepEqual(await issueDictationKey('server-key', 'eu', signal), { api_key: 'temporary', region: 'eu' });
  const [url, options] = fetchMock.mock.calls[0].arguments as unknown as [string, RequestInit];
  assert.equal(url, 'https://api.eu.soniox.com/v1/auth/temporary-api-key');
  assert.equal(new Headers(options.headers).get('authorization'), 'Bearer server-key');
  assert.deepEqual(JSON.parse(String(options.body)), {
    usage_type: 'transcribe_websocket', expires_in_seconds: 60, single_use: true, max_session_duration_seconds: 300,
  });
  fetchMock.mock.mockImplementation(async () => Response.json({ api_key: 'server-key' }));
  await assert.rejects(issueDictationKey('server-key', 'us', signal));
  await assert.rejects(issueDictationKey('server-key', 'invalid-region', signal));
});
