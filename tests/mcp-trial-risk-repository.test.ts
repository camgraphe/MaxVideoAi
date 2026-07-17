import assert from 'node:assert/strict';
import test from 'node:test';

import type { QueryExecutor } from '../frontend/src/lib/db';

type Call = { sql: string; params?: ReadonlyArray<unknown> };
const fingerprint = 'a'.repeat(64);

test('risk event persistence accepts only the exact safe DTO and parameterizes six business values', async () => {
  const { recordTrialRiskEvent } = await import(
    '../frontend/src/server/agent-api/trial-risk-repository'
  );
  const calls: Call[] = [];
  const executor: QueryExecutor = {
    async query<T>(sql, params) {
      calls.push({ sql, params });
      return [{ id: '7', created_at: '2026-07-17T10:00:00.123456Z' }] as T[];
    },
  };
  const saved = await recordTrialRiskEvent({
    userId: 'user-1', oauthClientId: 'client-1', riskFingerprintHash: fingerprint,
    outcome: 'allowed', reasonCode: 'accepted', providerCostCents: 250,
  }, { executor });
  assert.equal(saved.id, '7');
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO mcp_trial_risk_events/i);
  assert.match(calls[0]!.sql, /RETURNING id::text AS id, created_at/i);
  assert.match(calls[0]!.sql, /provider_cost_cents/i);
  assert.doesNotMatch(calls[0]!.sql, /user-1|client-1|accepted|\ba{64}\b|250/i);
  assert.deepEqual(calls[0]!.params, ['user-1', 'client-1', fingerprint, 'allowed', 'accepted', 250]);
  assert.doesNotMatch(JSON.stringify(saved), /user-1|client-1|accepted|a{64}|250/i);

  for (const extra of [
    'id', 'createdAt', 'ip', 'userAgent', 'prompt', 'email', 'token', 'referenceUrl', 'metadata',
  ]) {
    await assert.rejects(recordTrialRiskEvent({
      userId: 'user-1', oauthClientId: null, riskFingerprintHash: fingerprint,
      outcome: 'allowed', reasonCode: 'accepted', providerCostCents: 250, [extra]: 'private',
    } as never, { executor }), /invalid trial risk event input/i);
  }

  for (const bad of [
    { outcome: 'allowed', reasonCode: 'accepted', providerCostCents: 0 },
    { outcome: 'blocked', reasonCode: 'user_daily_limit', providerCostCents: 1 },
    { outcome: 'rate_limited', reasonCode: 'oauth_client_daily_limit', providerCostCents: -1 },
    { outcome: 'rate_limited', reasonCode: 'private_internal_reason', providerCostCents: 0 },
  ]) {
    await assert.rejects(recordTrialRiskEvent({
      userId: 'user-1', oauthClientId: 'client-1', riskFingerprintHash: fingerprint,
      ...bad,
    } as never, { executor }), /invalid trial risk event input/i);
  }
});

test('bounded risk counts use one allowlisted scope and optional allowlisted outcomes', async () => {
  const { countTrialRiskEvents } = await import(
    '../frontend/src/server/agent-api/trial-risk-repository'
  );
  const calls: Call[] = [];
  const executor: QueryExecutor = {
    async query<T>(sql, params) {
      calls.push({ sql, params });
      return [{ count: '3' }] as T[];
    },
  };
  const since = new Date('2026-07-17T09:00:00Z');
  assert.equal(await countTrialRiskEvents({
    scope: 'oauth_client', scopeValue: 'client-1', since, outcomes: ['allowed', 'blocked'],
  }, { executor }), 3);
  assert.match(calls[0]!.sql, /oauth_client_id = \$2/i);
  assert.match(calls[0]!.sql, /created_at >= \$1/i);
  assert.match(calls[0]!.sql, /outcome = ANY\(\$3::text\[\]\)/i);
  assert.deepEqual(calls[0]!.params, [since, 'client-1', ['allowed', 'blocked']]);

  await countTrialRiskEvents({ scope: 'user', scopeValue: 'user-1', since, outcomes: [] }, { executor });
  await countTrialRiskEvents({ scope: 'fingerprint', scopeValue: fingerprint, since, outcomes: [] }, { executor });
  await countTrialRiskEvents({ scope: 'global', scopeValue: null, since, outcomes: [] }, { executor });
  assert.match(calls[1]!.sql, /user_id = \$2/i);
  assert.match(calls[2]!.sql, /risk_fingerprint_hash = \$2/i);
  assert.doesNotMatch(calls[3]!.sql, /user_id =|oauth_client_id =|risk_fingerprint_hash =/i);
  assert.deepEqual(calls[3]!.params, [since]);

  await assert.rejects(countTrialRiskEvents({
    scope: 'global', scopeValue: 'client-1', since, outcomes: [],
  }, { executor }), /invalid trial risk count input/i);
  await assert.rejects(countTrialRiskEvents({
    scope: 'user', scopeValue: null, since, outcomes: [],
  }, { executor }), /invalid trial risk count input/i);
  await assert.rejects(countTrialRiskEvents({
    scope: 'user', scopeValue: 'u'.repeat(129), since, outcomes: [],
  }, { executor }), /invalid trial risk count input/i);
  await assert.rejects(countTrialRiskEvents({
    scope: 'anything', scopeValue: 'x', since, outcomes: [],
  } as never, { executor }), /invalid trial risk count input/i);
  await assert.rejects(countTrialRiskEvents({
    scope: 'global', scopeValue: null, since, outcomes: ['allowed', 'allowed'],
  }, { executor }), /invalid trial risk count input/i);
});

test('bounded cleanup deletes an indexed batch and returns only a validated count', async () => {
  const { cleanupTrialRiskEvents } = await import(
    '../frontend/src/server/agent-api/trial-risk-repository'
  );
  const calls: Call[] = [];
  const executor: QueryExecutor = {
    async query<T>(sql, params) {
      calls.push({ sql, params });
      return [{ count: '2' }] as T[];
    },
  };
  const cutoff = new Date('2026-06-17T00:00:00Z');
  assert.equal(await cleanupTrialRiskEvents({ cutoff, limit: 100 }, { executor }), 2);
  assert.match(calls[0]!.sql, /cleanup_mcp_trial_risk_events/i);
  assert.deepEqual(calls[0]!.params, [cutoff, 100]);
  await assert.rejects(cleanupTrialRiskEvents({ cutoff, limit: 0 }, { executor }), /invalid trial risk cleanup input/i);

  const badCount: QueryExecutor = { async query<T>() { return [{ count: '-1' }] as T[]; } };
  await assert.rejects(cleanupTrialRiskEvents({ cutoff, limit: 10 }, { executor: badCount }), /invalid trial risk count/i);
});

test('accepted provider-cost sums use one validated UTC window and fail closed on malformed totals', async () => {
  const { sumAcceptedTrialRiskProviderCost } = await import(
    '../frontend/src/server/agent-api/trial-risk-repository'
  );
  const calls: Call[] = [];
  const executor: QueryExecutor = {
    async query<T>(sql, params) {
      calls.push({ sql, params });
      return [{ accepted_provider_cost_cents: '750' }] as T[];
    },
  };
  const since = new Date('2026-07-17T00:00:00Z');
  assert.equal(await sumAcceptedTrialRiskProviderCost({ since }, { executor }), 750);
  assert.match(calls[0]!.sql, /SUM\(provider_cost_cents\)/i);
  assert.match(calls[0]!.sql, /outcome\s*=\s*'allowed'/i);
  assert.deepEqual(calls[0]!.params, [since]);
  assert.doesNotMatch(calls[0]!.sql, /750|2026-07-17/i);

  const malformed: QueryExecutor = {
    async query<T>() { return [{ accepted_provider_cost_cents: '9007199254740992' }] as T[]; },
  };
  await assert.rejects(
    sumAcceptedTrialRiskProviderCost({ since }, { executor: malformed }),
    /invalid trial risk provider cost/i,
  );
  await assert.rejects(
    sumAcceptedTrialRiskProviderCost({ since, prompt: 'private' } as never, { executor }),
    /invalid trial risk cost input/i,
  );
});
