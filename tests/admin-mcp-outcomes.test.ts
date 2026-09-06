import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMcpClient } from '../frontend/src/server/mcp/client-family.ts';
import { loadAdminMcpOutcomes } from '../frontend/server/admin-mcp-outcomes.ts';
import { readMcpAuthMetadata } from '../frontend/server/admin-mcp-auth-metadata.ts';
import { recordMcpEvent } from '../frontend/src/server/agent-api/audit-events.ts';

const range = { from: new Date('2026-07-01Z'), to: new Date('2026-07-08Z'), timeZone: 'UTC' as const, conversionWindowSeconds: 60 };

test('client families are coarse self-reported metadata with an explicit unknown bucket', () => {
  for (const [name, expected] of [
    ['Claude', 'claude'], ['claude-ai', 'claude'], ['claude-code', 'claude'],
    ['Codex', 'codex'], ['codex_cli_rs', 'codex'], ['OpenAI Codex', 'codex'],
    ['ChatGPT', 'chatgpt'], ['OpenAI ChatGPT', 'chatgpt'],
    ['openai', 'other'], ['my-claude-proxy', 'other'], ['unrelated', 'other'],
    ['Claude'.repeat(30), 'other'], ['', 'other'],
  ]) {
    assert.equal(classifyMcpClient({ params: { clientInfo: { name } } }), expected, name);
  }
  for (const body of [null, [], {}, { params: null }, { params: { clientInfo: { name: 12 } } }]) {
    assert.equal(classifyMcpClient(body), 'other');
  }
});

test('audit accepts only the optional family enum on initialize and does not store raw metadata', async () => {
  const base = { eventType: 'connection_initialized' as const, userId: 'u', oauthClientId: 'c', tool: null, outcome: 'success' as const, surface: null, engineId: null, errorCode: null };
  const calls: unknown[][] = [];
  const deps = { ensureSchema: async () => {}, executor: { async query<T>(_sql: string, params?: ReadonlyArray<unknown>): Promise<T[]> { calls.push([...(params ?? [])]); return []; } } };
  assert.equal(await recordMcpEvent({ ...base, clientFamily: 'codex' }, deps), true);
  assert.equal(calls[0].at(-1), 'codex');
  for (const invalid of [
    { ...base, clientFamily: 'raw-client' },
    { ...base, clientFamily: null },
    { ...base, clientFamily: ['codex'] },
    { ...base, eventType: 'tool_call', clientFamily: 'codex' },
    { ...base, clientFamily: 'codex', clientInfo: { name: 'private-value' } },
  ]) {
    assert.equal(await recordMcpEvent(invalid as never, deps), false);
  }
  assert.equal(calls.length, 1);
});

test('outcome outages stay unavailable and invalid dates never query', async () => {
  let calls = 0;
  const deps = { configured: () => true, executor: { async query<T>(): Promise<T[]> { calls++; throw new Error('unavailable'); } } };
  assert.equal((await loadAdminMcpOutcomes(range, { ...deps, configured: () => false })).totals, null);
  assert.equal(calls, 0);
  await assert.rejects(() => loadAdminMcpOutcomes({ ...range, from: range.to }, deps), /window/);
  assert.equal(calls, 0);
  const failed = await loadAdminMcpOutcomes(range, deps);
  assert.equal(failed.totals, null);
  assert.match(failed.notices[0], /could not be loaded/);
});


test('Auth fallbacks retain only dates and coarse client families, with bounded concurrency and volume', async () => {
  let active = 0;
  let maximum = 0;
  let calls = 0;
  const read = async (value: unknown) => {
    calls++; active++; maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    return { data: value, error: null };
  };
  const getAdmin = (() => ({ auth: { admin: {
    getUserById: (id: string) => read({ user: { id, created_at: '2026-07-01Z', email: 'private@example.com' } }),
    oauth: { getClient: (id: string) => read({ client_id: id, client_name: 'Codex', client_secret: 'private-secret' }) },
  } } })) as unknown as NonNullable<Parameters<typeof readMcpAuthMetadata>[2]>;
  const result = await readMcpAuthMetadata(['u1', 'u2', 'u3', 'u4', 'u5'], ['c1'], getAdmin);
  assert.equal(result.profiles.length, 5);
  assert.deepEqual(result.clients, [{ oauth_client_id: 'c1', family: 'codex' }]);
  assert.equal(maximum, 4);
  assert.doesNotMatch(JSON.stringify(result), /private|email|secret|client_name/);
  await readMcpAuthMetadata(Array.from({ length: 101 }, (_, i) => String(i)), [], getAdmin);
  assert.equal(calls, 6, 'large missing cohorts must not trigger unbounded auth requests');
});
