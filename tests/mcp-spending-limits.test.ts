import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import type { QueryExecutor } from '../frontend/src/lib/db';

const modulePath = 'frontend/src/server/agent-api/spending-limits.ts';
const now = new Date('2026-07-16T15:30:00.000Z');

type Captured = { sql: string; params?: ReadonlyArray<unknown> };

function executorWithRow(row: Record<string, unknown>, captured: Captured[]): QueryExecutor {
  return {
    async query<TRecord>(sql, params) {
      captured.push({ sql, params });
      return [row] as TRecord[];
    },
  };
}

test('spending-limit owner is present before behavior contracts load', () => {
  assert.equal(existsSync(modulePath), true, `${modulePath} should exist`);
});

test('null limits mean unlimited while accepted MCP spend is read in the UTC day', async () => {
  const { checkMcpSpendingLimits } = await import(
    '../frontend/src/server/agent-api/spending-limits'
  );
  const captured: Captured[] = [];
  const result = await checkMcpSpendingLimits({
    userId: 'user-1', priceCents: 25, currency: 'USD',
  }, { executor: executorWithRow({
    per_generation_cents: null,
    daily_cents: null,
    web_approval_above_cents: null,
    accepted_today_cents: '0',
  }, captured), now: () => now });

  assert.deepEqual(result, {
    allowed: true,
    acceptedTodayCents: 0,
    projectedTodayCents: 25,
    limits: { perGenerationCents: null, dailyCents: null, webApprovalAboveCents: null },
  });
  assert.equal(captured.length, 1);
  assert.match(captured[0].sql, /state\s*=\s*'accepted'/i);
  assert.match(captured[0].sql, /mcp_spending_limits[\s\S]*FOR UPDATE/i);
  assert.match(captured[0].sql, /funding_mode\s*=\s*'wallet'/i);
  assert.match(captured[0].sql, /claimed_at\s*>=\s*\(\s*date_trunc\('day',[\s\S]*AT TIME ZONE 'UTC'/i);
  assert.match(captured[0].sql, /claimed_at\s*<=\s*\$3/i);
  assert.match(captured[0].sql, /currency\s*=\s*\$2/i);
  assert.deepEqual(captured[0].params, ['user-1', 'USD', now]);
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
    }, { executor: executorWithRow({
      per_generation_cents: item.limits[0],
      daily_cents: item.limits[1],
      web_approval_above_cents: item.limits[2],
      accepted_today_cents: item.accepted,
    }, []), now: () => now });
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
  }, { executor: executorWithRow({
    per_generation_cents: 100, daily_cents: 100, web_approval_above_cents: 100,
    accepted_today_cents: '0',
  }, []), now: () => now });
  assert.equal(atThreshold.allowed, true, 'thresholds are inclusive; only values above are blocked');
});

test('accepted spend is account-wide, parameterized, and never contains prompt or URL analytics', async () => {
  const { checkMcpSpendingLimits } = await import(
    '../frontend/src/server/agent-api/spending-limits'
  );
  const captured: Captured[] = [];
  await checkMcpSpendingLimits({
    userId: "user-'private", priceCents: 10, currency: 'USD',
  }, { executor: executorWithRow({
    per_generation_cents: null, daily_cents: 100, web_approval_above_cents: null,
    accepted_today_cents: '20',
  }, captured), now: () => now });
  assert.doesNotMatch(captured[0].sql, /user-'private|prompt|request_json|reference|url/i);
  assert.match(captured[0].sql, /user_id\s*=\s*\$1/i);
  assert.doesNotMatch(captured[0].sql, /oauth_client_id/i);
});

test('invalid integers, overflow, malformed rows, and missing tables fail closed', async () => {
  const { checkMcpSpendingLimits } = await import(
    '../frontend/src/server/agent-api/spending-limits'
  );
  const validRow = {
    per_generation_cents: null, daily_cents: null, web_approval_above_cents: null,
    accepted_today_cents: '0',
  };
  const executor = executorWithRow(validRow, []);
  for (const priceCents of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER]) {
    await assert.rejects(
      checkMcpSpendingLimits({ userId: 'user-1', priceCents, currency: 'USD' }, { executor, now: () => now }),
      /invalid spending check input|spending amount overflow/i,
    );
  }

  await assert.rejects(
    checkMcpSpendingLimits({ userId: 'user-1', priceCents: 1, currency: 'USD' }, {
      executor: executorWithRow({ ...validRow, accepted_today_cents: '9007199254740992' }, []),
      now: () => now,
    }),
    /invalid spending limit row/i,
  );
  await assert.rejects(
    checkMcpSpendingLimits({ userId: 'user-1', priceCents: 1, currency: 'USD' }, {
      executor: { async query() { throw new Error('relation does not exist'); } },
      now: () => now,
    }),
    /relation does not exist/,
  );
});
