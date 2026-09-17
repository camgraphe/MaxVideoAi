import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMcpClient } from '../frontend/src/server/mcp/client-family.ts';
import { loadAdminMcpOutcomes, MCP_CLIENT_LABELS } from '../frontend/server/admin-mcp-outcomes.ts';
import { readMcpAuthMetadata } from '../frontend/server/admin-mcp-auth-metadata.ts';
import { recordMcpEvent } from '../frontend/src/server/agent-api/audit-events.ts';

const range = { from: new Date('2026-07-01Z'), to: new Date('2026-07-08Z'), timeZone: 'UTC' as const, conversionWindowSeconds: 60 };

test('client families are coarse self-reported metadata with an explicit unknown bucket', () => {
  for (const [name, expected] of [
    ['Claude', 'claude'], ['claude-ai', 'claude'], ['claude-code', 'claude'],
    ['Codex', 'codex'], ['codex_cli_rs', 'codex'], ['OpenAI Codex', 'codex'],
    ['ChatGPT', 'chatgpt'], ['OpenAI ChatGPT', 'chatgpt'],
    ['OpenClaw', 'openclaw'], ['open-claw gateway', 'openclaw'],
    ['n8n', 'n8n'], ['n8n-mcp-client', 'n8n'],
    ['Glama', 'glama'], ['glama.ai MCP inspector', 'glama'],
    ['Cursor', 'cursor'], ['cursor-agent', 'cursor'],
    ['GitHub Copilot', 'githubCopilot'], ['copilot-cli', 'githubCopilot'],
    ['Gemini CLI', 'geminiCli'], ['google-gemini-cli', 'geminiCli'],
    ['Microsoft Copilot', 'microsoftCopilot'], ['Copilot Studio', 'microsoftCopilot'],
    ['openai', 'other'], ['my-claude-proxy', 'other'], ['unrelated', 'other'],
    ['copilot', 'other'], ['visual-studio-code', 'other'], ['glamorous-client', 'other'],
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
  const families = [
    'chatgpt', 'claude', 'codex', 'openclaw', 'n8n', 'glama', 'cursor',
    'githubCopilot', 'geminiCli', 'microsoftCopilot', 'other',
  ];
  assert.deepEqual(Object.keys(MCP_CLIENT_LABELS), families);
  for (const family of families) {
    assert.equal(await recordMcpEvent({ ...base, clientFamily: family } as never, deps), true, family);
    assert.equal(calls.at(-1)?.at(-1), family);
  }
  for (const invalid of [
    { ...base, clientFamily: 'raw-client' },
    { ...base, clientFamily: null },
    { ...base, clientFamily: ['codex'] },
    { ...base, eventType: 'tool_call', clientFamily: 'codex' },
    { ...base, clientFamily: 'codex', clientInfo: { name: 'private-value' } },
  ]) {
    assert.equal(await recordMcpEvent(invalid as never, deps), false);
  }
  assert.equal(calls.length, families.length);
});

test('admin outcomes expose every registered application family while preserving the unidentified bucket', async () => {
  const relations = { audit: true, quotes: true, jobs: true, profiles: false, funnel: false, clientFamily: true };
  const row = {
    accounts: 0,
    new_signups: 0,
    missing_profiles: 0,
    generators: 0,
    submitted: 0,
    videos: 0,
    failed: 0,
    pending: 0,
  };
  const executor = {
    async query<T>(sql: string): Promise<T[]> {
      if (sql.includes('admin-mcp:outcome-relations')) return [relations] as T[];
      return [
        { ...row, client: 'all', accounts: 3, generators: 1, submitted: 1, videos: 1 },
        { ...row, client: 'openclaw', accounts: 1, generators: 1, submitted: 1, videos: 1 },
        { ...row, client: 'n8n', accounts: 1 },
        { ...row, client: 'glama', accounts: 1 },
      ] as T[];
    },
  };

  const result = await loadAdminMcpOutcomes(range, { configured: () => true, executor });

  assert.deepEqual(result.clients.map(({ client }) => client), [
    'chatgpt',
    'claude',
    'codex',
    'openclaw',
    'n8n',
    'glama',
    'cursor',
    'githubCopilot',
    'geminiCli',
    'microsoftCopilot',
    'other',
  ]);
  assert.equal(result.clients.find(({ client }) => client === 'openclaw')?.videos, 1);
  assert.equal(result.clients.find(({ client }) => client === 'n8n')?.accounts, 1);
  assert.equal(result.clients.find(({ client }) => client === 'glama')?.accounts, 1);
  assert.equal(result.clients.find(({ client }) => client === 'other')?.accounts, 0);
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
