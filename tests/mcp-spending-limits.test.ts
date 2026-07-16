import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import type { QueryExecutor, TransactionQueryExecutor } from '../frontend/src/lib/db';

const modulePath = 'frontend/src/server/agent-api/spending-limits.ts';
type Captured = { sql: string; params?: ReadonlyArray<unknown> };

function executorWithRows(rows: Record<string, unknown>[], captured: Captured[]): TransactionQueryExecutor {
  let index = 0;
  return {
    async query<TRecord>(sql, params) {
      captured.push({ sql, params });
      const row = rows[index];
      index += 1;
      return (row ? [row] : []) as TRecord[];
    },
  } as TransactionQueryExecutor;
}

test('spending-limit owner is present before behavior contracts load', () => {
  assert.equal(existsSync(modulePath), true, `${modulePath} should exist`);
  const source = readFileSync(modulePath, 'utf8');
  assert.match(source, /TransactionQueryExecutor/);
  assert.doesNotMatch(source, /executor:\s*\{\s*query\s*\}|defaultDependencies/);
  assert.doesNotMatch(source, /checkMcpSpendingLimits\([\s\S]{0,300}=\s*\{/);
});

test('null limits mean unlimited while accepted MCP spend is read in the UTC day', async () => {
  const { checkMcpSpendingLimits } = await import(
    '../frontend/src/server/agent-api/spending-limits'
  );
  const captured: Captured[] = [];
  const result = await checkMcpSpendingLimits({
    userId: 'user-1', priceCents: 25, currency: 'USD',
  }, { executor: executorWithRows([
    {
      paid_generation_enabled: true,
      per_generation_cents: null,
      daily_cents: null,
      web_approval_above_cents: null,
    },
    { accepted_today_cents: '0' },
  ], captured) });

  assert.deepEqual(result, {
    allowed: true,
    acceptedTodayCents: 0,
    projectedTodayCents: 25,
    limits: { perGenerationCents: null, dailyCents: null, webApprovalAboveCents: null },
  });
  assert.equal(captured.length, 2);
  assert.match(captured[0].sql, /INSERT INTO mcp_spending_limits/i);
  assert.match(captured[0].sql, /ON CONFLICT \(user_id\)[\s\S]*DO UPDATE/i);
  assert.match(captured[0].sql, /RETURNING paid_generation_enabled, per_generation_cents, daily_cents,[\s\S]*web_approval_above_cents/i);
  assert.deepEqual(captured[0].params, ['user-1']);
  assert.doesNotMatch(captured[0].sql, /mcp_generation_quotes|SUM\(/i);
  assert.match(captured[1].sql, /SELECT clock_timestamp\(\) AS spending_now/i);
  assert.match(captured[1].sql, /state\s*=\s*'accepted'/i);
  assert.match(captured[1].sql, /funding_mode\s*=\s*'wallet'/i);
  assert.match(captured[1].sql, /claimed_at\s*>=\s*\(\s*date_trunc\('day',[\s\S]*AT TIME ZONE 'UTC'/i);
  assert.match(captured[1].sql, /claimed_at\s*<=\s*spending_now/i);
  assert.match(captured[1].sql, /currency\s*=\s*\$2/i);
  assert.deepEqual(captured[1].params, ['user-1', 'USD']);
});

test('per-generation, daily, and strict-above approval thresholds return stable safe handoffs', async () => {
  const { checkMcpSpendingLimits, MCP_SPENDING_APPROVAL_PATH } = await import(
    '../frontend/src/server/agent-api/spending-limits'
  );
  assert.equal(MCP_SPENDING_APPROVAL_PATH, '/account/connections?focus=mcp-spending');
  assert.doesNotMatch(MCP_SPENDING_APPROVAL_PATH, /user|email|prompt|https?:/i);

  const cases = [
    {
      label: 'per generation', priceCents: 101, accepted: '0', limits: [100, null, null],
      reason: 'per_generation',
    },
    {
      label: 'daily', priceCents: 51, accepted: '50', limits: [null, 100, null],
      reason: 'daily',
    },
    {
      label: 'approval', priceCents: 101, accepted: '0', limits: [null, null, 100],
      reason: 'web_approval',
    },
  ] as const;
  for (const item of cases) {
    const result = await checkMcpSpendingLimits({
      userId: 'user-1', priceCents: item.priceCents, currency: 'USD',
    }, { executor: executorWithRows([
      {
        paid_generation_enabled: true,
        per_generation_cents: item.limits[0],
        daily_cents: item.limits[1],
        web_approval_above_cents: item.limits[2],
      },
      { accepted_today_cents: item.accepted },
    ], []) });
    assert.equal(result.allowed, false, item.label);
    if (!result.allowed) {
      assert.equal(result.code, 'SPENDING_LIMIT_EXCEEDED');
      assert.equal(result.reason, item.reason);
      assert.equal(result.approvalUrl, MCP_SPENDING_APPROVAL_PATH);
      assert.doesNotMatch(result.message, /user-1|USD|50|101/);
    }
  }

  const atThreshold = await checkMcpSpendingLimits({
    userId: 'user-1', priceCents: 100, currency: 'USD',
  }, { executor: executorWithRows([
    { paid_generation_enabled: true, per_generation_cents: 100, daily_cents: 100, web_approval_above_cents: 100 },
    { accepted_today_cents: '0' },
  ], []) });
  assert.equal(atThreshold.allowed, true, 'thresholds are inclusive; only values above are blocked');
});

test('accepted spend is account-wide, parameterized, and never contains prompt or URL analytics', async () => {
  const { checkMcpSpendingLimits } = await import(
    '../frontend/src/server/agent-api/spending-limits'
  );
  const captured: Captured[] = [];
  await checkMcpSpendingLimits({
    userId: "user-'private", priceCents: 10, currency: 'USD',
  }, { executor: executorWithRows([
    { paid_generation_enabled: true, per_generation_cents: null, daily_cents: 100, web_approval_above_cents: null },
    { accepted_today_cents: '20' },
  ], captured) });
  for (const call of captured) {
    assert.doesNotMatch(call.sql, /user-'private|prompt|request_json|reference|url/i);
    assert.doesNotMatch(call.sql, /oauth_client_id/i);
  }
  assert.match(captured[0].sql, /mcp_spending_limits \(user_id\)[\s\S]*VALUES \(\$1\)/i);
  assert.match(captured[1].sql, /user_id\s*=\s*\$1/i);
});

test('invalid integers, overflow, malformed rows, and missing tables fail closed', async () => {
  const { checkMcpSpendingLimits } = await import(
    '../frontend/src/server/agent-api/spending-limits'
  );
  const validRow = {
    paid_generation_enabled: true,
    per_generation_cents: null, daily_cents: null, web_approval_above_cents: null,
    accepted_today_cents: '0',
  };
  const executor = executorWithRows([validRow, { accepted_today_cents: '0' }], []);
  for (const priceCents of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER]) {
    await assert.rejects(
      checkMcpSpendingLimits({ userId: 'user-1', priceCents, currency: 'USD' }, { executor }),
      /invalid spending check input|spending amount overflow/i,
    );
  }

  await assert.rejects(
    checkMcpSpendingLimits({ userId: 'user-1', priceCents: 1, currency: 'USD' }, {
      executor: executorWithRows([validRow, { accepted_today_cents: '9007199254740992' }], []),
    }),
    /invalid spending limit row/i,
  );
  await assert.rejects(
    checkMcpSpendingLimits({ userId: 'user-1', priceCents: 1, currency: 'USD' }, {
      executor: { async query() { throw new Error('relation does not exist'); } } as TransactionQueryExecutor,
    }),
    /relation does not exist/,
  );
});

test('settings DTO defaults, exact update validation, and atomic upsert are repository-owned', async () => {
  const {
    getMcpSpendingSettings,
    updateMcpSpendingSettings,
  } = await import('../frontend/src/server/agent-api/spending-limits');

  const readCalls: Captured[] = [];
  const defaults = await getMcpSpendingSettings('user-settings', {
    executor: executorWithRows([{
      paid_generation_enabled: true,
      per_generation_cents: null,
      daily_cents: null,
      web_approval_above_cents: null,
      updated_at: '2026-07-16T12:00:00.000Z',
    }], readCalls) as QueryExecutor,
  });
  assert.deepEqual(defaults, {
    paidGenerationEnabled: true,
    perGenerationCents: null,
    dailyCents: null,
    webApprovalAboveCents: null,
    updatedAt: '2026-07-16T12:00:00.000Z',
  });
  assert.match(readCalls[0].sql, /INSERT INTO mcp_spending_limits/i);
  assert.match(readCalls[0].sql, /ON CONFLICT \(user_id\)[\s\S]*DO UPDATE/i);
  assert.match(readCalls[0].sql, /RETURNING paid_generation_enabled/i);
  assert.doesNotMatch(readCalls[0].sql, /mcp_generation_quotes|app_jobs|app_receipts/i);

  const updateCalls: Captured[] = [];
  const maximum = await updateMcpSpendingSettings('user-settings', {
    paidGenerationEnabled: false,
    perGenerationCents: 0,
    dailyCents: 2_147_483_647,
    webApprovalAboveCents: null,
  }, {
    executor: executorWithRows([{
      paid_generation_enabled: false,
      per_generation_cents: 0,
      daily_cents: 2_147_483_647,
      web_approval_above_cents: null,
      updated_at: '2026-07-16T12:01:00.000Z',
    }], updateCalls) as QueryExecutor,
  });
  assert.equal(maximum.paidGenerationEnabled, false);
  assert.equal(maximum.perGenerationCents, 0);
  assert.equal(maximum.dailyCents, 2_147_483_647);
  assert.match(updateCalls[0].sql, /INSERT INTO mcp_spending_limits/i);
  assert.match(updateCalls[0].sql, /ON CONFLICT \(user_id\) DO UPDATE/i);
  assert.match(updateCalls[0].sql, /paid_generation_enabled\s*=\s*EXCLUDED\.paid_generation_enabled/i);
  assert.match(updateCalls[0].sql, /updated_at\s*=\s*clock_timestamp\(\)/i);
  assert.deepEqual(updateCalls[0].params, ['user-settings', false, 0, 2_147_483_647, null]);

  const valid = {
    paidGenerationEnabled: true,
    perGenerationCents: null,
    dailyCents: null,
    webApprovalAboveCents: null,
  };
  const invalid: unknown[] = [
    null,
    [],
    { ...valid, extra: true },
    { ...valid, paidGenerationEnabled: 1 },
    { ...valid, perGenerationCents: -1 },
    { ...valid, perGenerationCents: 1.5 },
    { ...valid, perGenerationCents: '1' },
    { ...valid, dailyCents: Number.NaN },
    { ...valid, dailyCents: Number.POSITIVE_INFINITY },
    { ...valid, dailyCents: 2_147_483_648 },
    { ...valid, webApprovalAboveCents: Number.MAX_SAFE_INTEGER },
    Object.assign(Object.create({ inherited: true }), valid),
    Object.defineProperty({ ...valid }, 'dailyCents', { enumerable: true, get: () => 10 }),
    Object.assign({ ...valid }, { [Symbol('secret')]: true }),
  ];
  for (const body of invalid) {
    await assert.rejects(
      updateMcpSpendingSettings('user-settings', body as never, {
        executor: executorWithRows([], []) as QueryExecutor,
      }),
      /invalid mcp spending settings/i,
    );
  }

  await assert.rejects(
    getMcpSpendingSettings('user-settings', {
      executor: executorWithRows([{
        paid_generation_enabled: true,
        per_generation_cents: null,
        daily_cents: null,
        web_approval_above_cents: null,
        updated_at: '1',
      }], []) as QueryExecutor,
    }),
    /invalid spending limit row/i,
  );
});

test('disabled paid generation fails with a bounded distinct reason before spend aggregation', async () => {
  const { checkMcpConfirmationSpendingLimits } = await import(
    '../frontend/src/server/agent-api/spending-limits'
  );
  const captured: Captured[] = [];
  const decision = await checkMcpConfirmationSpendingLimits({
    userId: 'disabled-user', priceCents: 25, currency: 'USD',
  }, { executor: executorWithRows([{
    paid_generation_enabled: false,
    per_generation_cents: null,
    daily_cents: null,
    web_approval_above_cents: null,
  }], captured) });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.code, 'SPENDING_LIMIT_EXCEEDED');
    assert.equal(decision.reason, 'paid_generation_disabled');
  }
  assert.equal(captured.length, 1, 'disabled accounts must not need a spending aggregation query');
});
