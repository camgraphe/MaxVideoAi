import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type {
  QueryExecutor,
  TransactionQueryExecutor,
} from '../frontend/src/lib/db';

type Call = { sql: string; params?: ReadonlyArray<unknown> };

const input = {
  userId: 'user-1',
  oauthClientId: 'client-1',
  clientIp: '203.0.113.42',
  userAgent: 'Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36',
  providerCostCents: 250,
};
const secretA = '0123456789abcdef0123456789abcdef';
const secretB = 'abcdef0123456789abcdef0123456789';
const limits = {
  perUserAcceptedPerUtcDay: 3,
  perOauthClientAcceptedPerUtcDay: 25,
  perFingerprintAcceptedPerUtcDay: 3,
  globalAcceptedProviderCostCentsPerUtcDay: 1_000,
};

function decision(code: 'TRIAL_NOT_ELIGIBLE' | 'RATE_LIMITED') {
  return code === 'TRIAL_NOT_ELIGIBLE'
    ? { allowed: false, code, nextAction: { type: 'use_paid_generation' } }
    : { allowed: false, code, nextAction: { type: 'retry_later' } };
}

function createRiskExecutor(options: {
  user?: number;
  oauthClient?: number;
  fingerprint?: number;
  global?: number;
  acceptedCost?: number;
  failOn?: 'clock' | 'count' | 'sum';
} = {}): { executor: QueryExecutor; calls: Call[] } {
  const calls: Call[] = [];
  const executor: QueryExecutor = {
    async query<T>(sql, params) {
      calls.push({ sql, params });
      if (/clock_timestamp\(\)/iu.test(sql)) {
        if (options.failOn === 'clock') throw new Error('private clock failure');
        return [{ current_time: '2026-07-17T12:34:56.123456Z' }] as T[];
      }
      if (/SUM\(provider_cost_cents\)/iu.test(sql)) {
        if (options.failOn === 'sum') throw new Error('private cost failure');
        return [{ accepted_provider_cost_cents: String(options.acceptedCost ?? 0) }] as T[];
      }
      if (/count\(\*\)/iu.test(sql)) {
        if (options.failOn === 'count') throw new Error('private count failure');
        const count = /user_id\s*=\s*\$2/iu.test(sql)
          ? options.user
          : /oauth_client_id\s*=\s*\$2/iu.test(sql)
            ? options.oauthClient
            : /risk_fingerprint_hash\s*=\s*\$2/iu.test(sql)
              ? options.fingerprint
              : options.global;
        return [{ count: String(count ?? 0) }] as T[];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  return { executor, calls };
}

function fingerprintFrom(calls: Call[]): string {
  const fingerprintCall = calls.find((call) => /risk_fingerprint_hash\s*=\s*\$2/iu.test(call.sql));
  const fingerprint = fingerprintCall?.params?.[1];
  assert.equal(typeof fingerprint, 'string');
  assert.match(fingerprint, /^[a-f0-9]{64}$/u);
  return fingerprint;
}

test('missing, short, or malformed risk secrets fail closed before any repository call', async () => {
  const { checkTrialRisk } = await import(
    '../frontend/src/server/agent-api/trial-risk'
  );
  for (const secret of [undefined, '', 'too-short', `${'a'.repeat(31)}\ud800`]) {
    const { executor, calls } = createRiskExecutor();
    assert.deepEqual(
      await checkTrialRisk(input, { executor, secret, limits }),
      decision('TRIAL_NOT_ELIGIBLE'),
    );
    assert.equal(calls.length, 0);
  }
});

test('fingerprints are stable HMACs of coarse IPv4 or canonical IPv6 and UA families, and rotate with the secret', async () => {
  const { checkTrialRisk } = await import(
    '../frontend/src/server/agent-api/trial-risk'
  );
  const run = async (overrides: Partial<typeof input>, secret: string) => {
    const { executor, calls } = createRiskExecutor();
    assert.deepEqual(
      await checkTrialRisk({ ...input, ...overrides }, { executor, secret, limits }),
      { allowed: true },
    );
    return fingerprintFrom(calls);
  };

  const ipv4A = await run({}, secretA);
  assert.equal(
    ipv4A,
    createHmac('sha256', secretA)
      .update('v1|ip=203.0.113.0/24|ua=chrome', 'utf8')
      .digest('hex'),
  );
  const ipv4SameCoarseFamily = await run({
    clientIp: '203.0.113.249',
    userAgent: 'Chrome/999.1',
  }, secretA);
  assert.equal(ipv4SameCoarseFamily, ipv4A);
  assert.notEqual(await run({}, secretB), ipv4A);
  assert.notEqual(await run({ clientIp: '203.0.114.1' }, secretA), ipv4A);

  const ipv6A = await run({
    clientIp: '2001:0DB8:ABCD:0001::1',
    userAgent: 'Mozilla/5.0 Firefox/128.0',
  }, secretA);
  const ipv6SamePrefix = await run({
    clientIp: '2001:db8:abcd:ffff:ffff::2',
    userAgent: 'Firefox/999.0',
  }, secretA);
  assert.equal(ipv6SamePrefix, ipv6A);
  assert.notEqual(await run({
    clientIp: '2001:db8:abce::1',
    userAgent: 'Firefox/999.0',
  }, secretA), ipv6A);
});

test('raw IP, user agent, prompt-like text, counts, thresholds, and fingerprint never leave the private risk boundary', async () => {
  const { checkTrialRisk } = await import(
    '../frontend/src/server/agent-api/trial-risk'
  );
  const rawUserAgent = 'Codex/42 private-prompt=https://example.test/?token=secret email=user@example.test';
  const { executor, calls } = createRiskExecutor({ user: 3 });
  const result = await checkTrialRisk({
    ...input,
    clientIp: '198.51.100.77',
    userAgent: rawUserAgent,
  }, { executor, secret: secretA, limits });
  assert.deepEqual(result, decision('TRIAL_NOT_ELIGIBLE'));
  assert.deepEqual(Object.keys(result), ['allowed', 'code', 'nextAction']);

  const serializedCalls = JSON.stringify(calls);
  const serializedResult = JSON.stringify(result);
  for (const forbidden of [
    '198.51.100.77', rawUserAgent, 'private-prompt', 'example.test', 'user@example.test', secretA,
  ]) {
    assert.equal(serializedCalls.includes(forbidden), false);
    assert.equal(serializedResult.includes(forbidden), false);
  }
  const hash = fingerprintFrom(calls);
  assert.equal(serializedResult.includes(hash), false);
  assert.equal(serializedResult.includes('3'), false);
  assert.equal(serializedResult.includes('25'), false);
  assert.equal(serializedResult.includes('1000'), false);
  assert.equal(serializedResult.includes('user_daily_limit'), false);
});

test('the risk input is one exact plain-data DTO and every malformed shape fails with one generic error', async () => {
  const { checkTrialRisk } = await import(
    '../frontend/src/server/agent-api/trial-risk'
  );
  const { executor, calls } = createRiskExecutor();
  let getterRead = false;
  const accessor = { ...input } as Record<string, unknown>;
  Object.defineProperty(accessor, 'clientIp', {
    enumerable: true,
    get() {
      getterRead = true;
      return '203.0.113.42';
    },
  });
  const inherited = Object.create({ prompt: 'private' }) as Record<string, unknown>;
  Object.assign(inherited, input);
  const nonEnumerable = { ...input } as Record<string, unknown>;
  Object.defineProperty(nonEnumerable, 'prompt', { enumerable: false, value: 'private' });
  const symbol = { ...input, [Symbol('private')]: 'private' };
  const invalid = [
    { ...input, extra: true },
    { ...input, oauthClientId: null },
    { ...input, userId: 'bad user' },
    { ...input, oauthClientId: 'bad\nclient' },
    { ...input, clientIp: '999.1.2.3' },
    { ...input, providerCostCents: 0 },
    { ...input, providerCostCents: Number.MAX_SAFE_INTEGER + 1 },
    accessor,
    inherited,
    nonEnumerable,
    symbol,
  ];
  for (const value of invalid) {
    await assert.rejects(
      checkTrialRisk(value as never, { executor, secret: secretA, limits }),
      (error: unknown) => error instanceof Error && error.message === 'Invalid trial risk input.',
    );
  }
  assert.equal(getterRead, false);
  assert.equal(calls.length, 0);
});

test('per-user, OAuth-client, fingerprint, and global cost controls use fixed precedence and safe actions', async () => {
  const { checkTrialRisk } = await import(
    '../frontend/src/server/agent-api/trial-risk'
  );
  const cases = [
    {
      counts: { user: 3, oauthClient: 25, fingerprint: 3, acceptedCost: 900 },
      expected: decision('TRIAL_NOT_ELIGIBLE'),
    },
    {
      counts: { oauthClient: 25, fingerprint: 3, acceptedCost: 900 },
      expected: decision('RATE_LIMITED'),
    },
    {
      counts: { fingerprint: 3, acceptedCost: 900 },
      expected: decision('RATE_LIMITED'),
    },
    {
      counts: { acceptedCost: 751 },
      expected: decision('RATE_LIMITED'),
    },
    {
      counts: { acceptedCost: 750 },
      expected: { allowed: true },
    },
  ] as const;

  for (const scenario of cases) {
    const { executor, calls } = createRiskExecutor(scenario.counts);
    assert.deepEqual(
      await checkTrialRisk(input, { executor, secret: secretA, limits }),
      scenario.expected,
    );
    assert.equal(calls.length, 6);
    assert.match(calls[0]!.sql, /clock_timestamp\(\)/iu);
    assert.match(calls[1]!.sql, /user_id\s*=\s*\$2/iu);
    assert.match(calls[2]!.sql, /oauth_client_id\s*=\s*\$2/iu);
    assert.match(calls[3]!.sql, /risk_fingerprint_hash\s*=\s*\$2/iu);
    assert.doesNotMatch(calls[4]!.sql, /user_id\s*=|oauth_client_id\s*=|risk_fingerprint_hash\s*=/iu);
    assert.match(calls[5]!.sql, /SUM\(provider_cost_cents\)/iu);
    assert.equal(calls.some((call) => /INSERT|pg_advisory/iu.test(call.sql)), false);
  }
});

test('invalid injected limits and repository read failures fail closed without leaking internals', async () => {
  const { checkTrialRisk } = await import(
    '../frontend/src/server/agent-api/trial-risk'
  );
  for (const invalidLimit of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const { executor, calls } = createRiskExecutor();
    assert.deepEqual(await checkTrialRisk(input, {
      executor,
      secret: secretA,
      limits: { ...limits, perUserAcceptedPerUtcDay: invalidLimit },
    }), decision('TRIAL_NOT_ELIGIBLE'));
    assert.equal(calls.length, 0);
  }

  for (const failOn of ['clock', 'count', 'sum'] as const) {
    const { executor } = createRiskExecutor({ failOn });
    const result = await checkTrialRisk(input, { executor, secret: secretA, limits });
    assert.deepEqual(result, decision('TRIAL_NOT_ELIGIBLE'));
    assert.doesNotMatch(JSON.stringify(result), /private|clock|count|cost/iu);
  }
});

test('atomic acceptance rejects plain and forged executors before an advisory lock can appear atomic', async () => {
  const { acceptTrialRisk } = await import(
    '../frontend/src/server/agent-api/trial-risk'
  );
  const { executor, calls } = createRiskExecutor();
  const forgedSymbol = Symbol('transactionQueryExecutorBrand');
  const forged = Object.assign(executor, {
    transactionQueryExecutorBrand: 'transaction-query-executor',
    [forgedSymbol]: 'transaction-query-executor',
  }) as unknown as TransactionQueryExecutor;
  assert.deepEqual(
    await acceptTrialRisk(input, { executor: forged, secret: secretA, limits }),
    decision('TRIAL_NOT_ELIGIBLE'),
  );
  assert.equal(calls.length, 0);
});

test('risk retention is fixed at 30 days and delegates cleanup scheduling to Task 8', async () => {
  const { MCP_TRIAL_RISK_RETENTION_DAYS } = await import(
    '../frontend/src/server/agent-api/trial-risk'
  );
  assert.equal(MCP_TRIAL_RISK_RETENTION_DAYS, 30);
  const documentation = readFileSync('docs/operations/mcp-trial-risk-retention.md', 'utf8');
  assert.match(documentation, /maximum[^\n]*30 days|30-day maximum/iu);
  assert.match(documentation, /fraud prevention/iu);
  assert.match(documentation, /Task 8|T8/iu);
  assert.doesNotMatch(documentation, /retain indefinitely|minimum[^\n]*30 days/iu);
});
