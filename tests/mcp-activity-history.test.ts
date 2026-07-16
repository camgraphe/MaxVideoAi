import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { QueryExecutor } from '../frontend/src/lib/db';
import { listMcpActivityHistory } from '../frontend/src/server/agent-api/activity-history';

type Captured = { sql: string; params?: ReadonlyArray<unknown> };

function row(overrides: Record<string, unknown> = {}) {
  return {
    quote_id: '00000000-0000-4000-8000-000000000001',
    oauth_client_id: 'codex-raw-id',
    model: 'seedance-2-0-mini',
    price_cents: 125,
    currency: 'USD',
    state: 'prepared',
    payment_status: null,
    event_at: '2026-07-16T12:00:00.000Z',
    ...overrides,
  };
}

function executor(rows: Record<string, unknown>[], captured: Captured[]): QueryExecutor {
  return {
    async query<TRecord>(sql, params) {
      captured.push({ sql, params });
      return rows as TRecord[];
    },
  };
}

test('safe activity projects only owner-scoped fields with deterministic newest-first limit', async () => {
  const captured: Captured[] = [];
  const items = await listMcpActivityHistory({
    userId: 'activity-owner',
    clientLabels: { 'codex-raw-id': 'Codex Desktop' },
  }, { executor: executor([row()], captured) });

  assert.deepEqual(items, [{
    clientLabel: 'Codex Desktop',
    tool: 'prepare_generation',
    model: 'seedance-2-0-mini',
    amountCents: 125,
    currency: 'USD',
    outcome: 'prepared',
    timestamp: '2026-07-16T12:00:00.000Z',
  }]);
  assert.equal(captured.length, 1);
  assert.deepEqual(captured[0].params, ['activity-owner']);
  assert.match(captured[0].sql, /WHERE\s+q\.user_id\s*=\s*\$1/i);
  assert.match(captured[0].sql, /q\.request_json\s*->>\s*'engineId'\s+AS\s+model/i);
  assert.match(captured[0].sql, /ORDER BY[\s\S]*event_at\s+DESC[\s\S]*quote_id\s+DESC/i);
  assert.match(captured[0].sql, /LIMIT\s+20/i);
  assert.doesNotMatch(captured[0].sql, /\bq\.request_json\s*(?:,|AS\b)/i);
  assert.doesNotMatch(captured[0].sql, /prompt|references|pricing_snapshot|settings_snapshot|media_url|video_url|provider_job_id|stripe_|email|acquisition|description/i);
});

test('every quote outcome maps to the exact safe tool and immutable quoted wallet amount', async () => {
  const rows = [
    row({ quote_id: '00000000-0000-4000-8000-000000000001', state: 'prepared' }),
    row({ quote_id: '00000000-0000-4000-8000-000000000002', state: 'expired' }),
    row({ quote_id: '00000000-0000-4000-8000-000000000003', state: 'claimed' }),
    row({ quote_id: '00000000-0000-4000-8000-000000000004', state: 'accepted' }),
    row({ quote_id: '00000000-0000-4000-8000-000000000005', state: 'failed', payment_status: 'paid_wallet' }),
    row({ quote_id: '00000000-0000-4000-8000-000000000006', state: 'failed', payment_status: 'refunded_wallet' }),
  ];
  const items = await listMcpActivityHistory({
    userId: 'activity-owner',
    clientLabels: { 'codex-raw-id': 'Codex Desktop' },
  }, { executor: executor(rows, []) });
  assert.deepEqual(items.map(({ tool, outcome, amountCents }) => ({ tool, outcome, amountCents })), [
    { tool: 'prepare_generation', outcome: 'prepared', amountCents: 125 },
    { tool: 'prepare_generation', outcome: 'expired', amountCents: 125 },
    { tool: 'confirm_generation', outcome: 'claimed', amountCents: 125 },
    { tool: 'confirm_generation', outcome: 'accepted', amountCents: 125 },
    { tool: 'confirm_generation', outcome: 'failed', amountCents: 125 },
    { tool: 'confirm_generation', outcome: 'refunded', amountCents: 125 },
  ]);
});

test('labels come only from current grants and raw client IDs never leave the owner', async () => {
  const rawIds = [
    'known-client-id',
    'revoked-client-id',
    'empty-label-id',
    'control-label-id',
    'separator-label-id',
    'long-label-id',
  ];
  const rows = rawIds.map((oauth_client_id, index) => row({
    quote_id: `00000000-0000-4000-8000-00000000001${index}`,
    oauth_client_id,
  }));
  const items = await listMcpActivityHistory({
    userId: 'activity-owner',
    clientLabels: {
      'known-client-id': ' Claude Desktop ',
      'empty-label-id': '   ',
      'control-label-id': 'Unsafe\nLabel',
      'separator-label-id': 'Unsafe\u2028Label',
      'long-label-id': 'x'.repeat(121),
    },
  }, { executor: executor(rows, []) });

  assert.deepEqual(items.map((item) => item.clientLabel), [
    'Claude Desktop',
    'Connected application',
    'Connected application',
    'Connected application',
    'Connected application',
    'Connected application',
  ]);
  const serialized = JSON.stringify(items);
  for (const rawId of rawIds) assert.equal(serialized.includes(rawId), false, rawId);
});

test('malformed rows are omitted fail-closed and safe output contains no forbidden fields or values', async () => {
  const privatePrompt = 'secret private prompt';
  const rows = [
    row({ quote_id: 'not-a-uuid' }),
    row({ model: '' }),
    row({ price_cents: -1 }),
    row({ price_cents: 1.5 }),
    row({ currency: 'usd' }),
    row({ state: 'deleted' }),
    row({ event_at: 'invalid' }),
    row({ event_at: '1' }),
    row({
      quote_id: '00000000-0000-4000-8000-000000000099',
      oauth_client_id: null,
      model: 'flux-pro',
      price_cents: 45,
      currency: 'USD',
      state: 'accepted',
      payment_status: 'paid_wallet',
      event_at: '2026-07-16T13:00:00.000Z',
      prompt: privatePrompt,
      video_url: 'https://private.example/video.mp4',
      provider: 'private-provider',
    }),
  ];
  const items = await listMcpActivityHistory({
    userId: 'activity-owner',
    clientLabels: {},
  }, { executor: executor(rows, []) });
  assert.equal(items.length, 1);
  assert.deepEqual(Object.keys(items[0]).sort(), [
    'amountCents', 'clientLabel', 'currency', 'model', 'outcome', 'timestamp', 'tool',
  ]);
  const serialized = JSON.stringify(items);
  for (const forbidden of [privatePrompt, 'private.example', 'private-provider', 'request_json', 'oauth_client_id']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('activity owner is focused and default database access remains server-only', () => {
  const source = readFileSync('frontend/src/server/agent-api/activity-history.ts', 'utf8');
  assert.match(source, /import \{ query/);
  assert.doesNotMatch(source, /NextResponse|createSupabase|service.role|fetch\(/i);
});
