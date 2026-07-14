import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import type { QueryExecutor } from '../frontend/src/lib/db';

const root = process.cwd();
const migrationDirectory = join(root, 'neon/migrations');
const migrationPath = join(migrationDirectory, '33_mcp_acquisition_funnel.sql');
const consentPagePath = join(root, 'frontend/app/(core)/oauth/consent/page.tsx');
const decisionRoutePath = join(root, 'frontend/app/api/oauth/decision/route.ts');
const migrationRunnerPath = join(root, 'scripts/apply-neon-migrations.sh');
const migrationReadmePath = join(migrationDirectory, 'README.md');

type FunnelModule = typeof import('../frontend/src/server/agent-api/mcp-funnel');

async function loadFunnel(): Promise<FunnelModule> {
  return import('../frontend/src/server/agent-api/mcp-funnel');
}

test('migration 33 is reserved after absent prerequisites and fails closed until 30-32 exist', () => {
  assert.equal(existsSync(migrationPath), true, 'Task 7 must reserve migration 33');
  const names = readdirSync(migrationDirectory).filter((name) => /^\d+_.+\.sql$/.test(name));
  assert.equal(names.includes('30_mcp_paid_generation.sql'), false);
  assert.equal(names.includes('31_mcp_trial_entitlements.sql'), false);
  assert.equal(names.includes('32_mcp_reference_uploads.sql'), false);
  assert.equal(names.includes('33_mcp_acquisition_funnel.sql'), true);
  assert.deepEqual(names.filter((name) => name.startsWith('33_')), ['33_mcp_acquisition_funnel.sql']);

  const migration = readFileSync(migrationPath, 'utf8');
  for (const table of [
    'mcp_generation_quotes',
    'mcp_trial_entitlements',
    'mcp_reference_upload_sessions',
  ]) {
    assert.match(migration, new RegExp(`to_regclass\\('public\\.${table}'\\)`, 'i'));
  }
  assert.match(migration, /RAISE EXCEPTION[\s\S]*30[\s\S]*31[\s\S]*32/i);
  assert.match(readFileSync(migrationRunnerPath, 'utf8'), /DATABASE_URL_UNPOOLED|pooler|direct/i);
  assert.match(readFileSync(migrationReadmePath, 'utf8'), /30_mcp_paid_generation[\s\S]*31_mcp_trial_entitlements[\s\S]*32_mcp_reference_uploads[\s\S]*33_mcp_acquisition_funnel/i);
  assert.match(readFileSync(migrationReadmePath, 'utf8'), /reserved|unapplied|prerequisite/i);
});

test('funnel migration creates a constrained explicit immutable ledger without sensitive columns', () => {
  assert.equal(existsSync(migrationPath), true);
  const migration = readFileSync(migrationPath, 'utf8');

  assert.match(migration, /CREATE TABLE(?: IF NOT EXISTS)? mcp_funnel_events/i);
  for (const column of [
    'occurred_at', 'user_id', 'oauth_client_id', 'event_type', 'stage', 'source', 'medium',
    'campaign', 'acquisition_client', 'acquisition_id', 'quote_id', 'job_id', 'amount_cents',
    'currency', 'idempotency_key', 'receipt_hash',
  ]) {
    assert.match(migration, new RegExp(`\\b${column}\\b`, 'i'), column);
  }
  for (const forbiddenColumn of [
    'metadata', 'prompt', 'email', 'token', 'raw_url', 'provider_response', 'provider_body',
    'payment_method', 'client_secret', 'fraud_signal', 'stripe_payment_intent_id', 'stripe_charge_id',
  ]) {
    assert.doesNotMatch(migration, new RegExp(`^\\s*${forbiddenColumn}\\s+`, 'im'), forbiddenColumn);
  }
  assert.doesNotMatch(migration, /\bJSONB?\b/i);
  assert.match(migration, /currency[\s\S]*~ '\^\[A-Z\]\{3\}\$'/i);
  assert.match(migration, /amount_cents[\s\S]*(?:>=\s*0|BETWEEN\s+0)/i);
  assert.match(migration, /BEFORE UPDATE[\s\S]*mcp_funnel_events/i);
  assert.doesNotMatch(migration, /BEFORE[\s\S]{0,24}DELETE[\s\S]{0,80}mcp_funnel_events/i);
});

test('funnel migration has exact event and stage allowlists, indexes, and database dedupe', () => {
  const migration = readFileSync(migrationPath, 'utf8');
  for (const event of [
    'landing_cta_clicked', 'oauth_connection_started', 'oauth_connection_completed',
    'oauth_connection_revoked', 'trial_quote_prepared', 'trial_generation_accepted',
    'trial_generation_completed', 'trial_generation_released', 'trial_generation_blocked',
    'topup_handoff_created', 'wallet_funded', 'paid_quote_prepared', 'paid_generation_accepted',
    'paid_generation_completed', 'paid_generation_failed', 'tool_called', 'tool_failed',
  ]) {
    assert.match(migration, new RegExp(`'${event}'`, 'i'), event);
  }
  for (const stage of [
    'oauth_connected', 'trial_prepared', 'trial_completed', 'wallet_funded',
    'first_paid_generation', 'repeat_paid_generation',
  ]) {
    assert.match(migration, new RegExp(`'${stage}'`, 'i'), stage);
  }
  for (const dimension of [
    'occurred_at', 'user_id', 'oauth_client_id', 'acquisition_id', 'quote_id', 'job_id',
  ]) {
    assert.match(migration, new RegExp(`CREATE INDEX[\\s\\S]{0,180}\\b${dimension}\\b`, 'i'), dimension);
  }
  assert.match(migration, /CREATE UNIQUE INDEX[\s\S]{0,220}idempotency_key/i);
  assert.match(migration, /CREATE UNIQUE INDEX[\s\S]{0,220}receipt_hash/i);
  assert.match(migration, /source[\s\S]*'mcp_landing'[\s\S]*'direct_mcp'/i);
  assert.match(migration, /medium[\s\S]*'owned'[\s\S]*'mcp'/i);
  assert.match(migration, /campaign[\s\S]*'mcp_connect'[\s\S]*'none'/i);
  assert.match(migration, /acquisition_client[\s\S]*'claude'[\s\S]*'codex'[\s\S]*'other'/i);
});

test('recordMcpFunnelEvent validates an exact DTO and inserts only positional explicit columns', async () => {
  const { recordMcpFunnelEvent } = await loadFunnel();
  let capturedSql = '';
  let capturedParams: ReadonlyArray<unknown> | undefined;
  const executor: QueryExecutor = {
    async query<TRecord>(sql, params) {
      capturedSql = sql;
      capturedParams = params;
      return [{ id: 1 }] as TRecord[];
    },
  };
  const base = {
    eventType: 'trial_generation_completed' as const,
    stage: 'trial_completed' as const,
    occurredAt: new Date('2026-07-02T10:00:00.000Z'),
    userId: 'user-1',
    oauthClientId: 'oauth-client-1',
    acquisitionId: 'acq_ABCDEFGHIJKLMNOPQRSTUVWX',
    quoteId: '5ab7db2e-d820-46a9-a3ae-17f8fb61a69f',
    jobId: 'job-1',
    amountCents: null,
    currency: null,
    source: 'mcp_landing' as const,
    medium: 'owned' as const,
    campaign: 'mcp_connect' as const,
    client: 'claude' as const,
    idempotencyKey: 'trial-completed:job-1',
    receiptHash: null,
  };

  assert.equal(await recordMcpFunnelEvent(base, { executor }), true);
  assert.match(capturedSql, /INSERT INTO mcp_funnel_events/i);
  assert.match(capturedSql, /ON CONFLICT \(idempotency_key\) WHERE idempotency_key IS NOT NULL DO NOTHING/i);
  assert.doesNotMatch(capturedSql, /metadata|prompt|token|stripe_/i);
  assert.equal(capturedParams?.length, 16);

  let rejectedQueries = 0;
  const rejectingExecutor: QueryExecutor = {
    async query<TRecord>() {
      rejectedQueries += 1;
      return [] as TRecord[];
    },
  };
  for (const key of [
    'prompt', 'email', 'accessToken', 'rawUrl', 'providerBody', 'paymentMethod', 'clientSecret', 'fraudSignal',
  ]) {
    assert.equal(
      await recordMcpFunnelEvent({ ...base, [key]: 'private' } as never, { executor: rejectingExecutor }),
      false,
      key,
    );
  }
  assert.equal(rejectedQueries, 0);
});

test('KPI uses distinct trial users and only funding after trial inside the UTC conversion window', async () => {
  const { getMcpFunnelSummary } = await loadFunnel();
  let capturedSql = '';
  let capturedParams: ReadonlyArray<unknown> | undefined;
  const rows = [
    ['trial_generation_completed', 'trial_completed', 'u1', '2026-07-01T10:00:00Z', 'mcp_landing', 'claude', 'acq-a'],
    ['trial_generation_completed', 'trial_completed', 'u1', '2026-07-01T11:00:00Z', 'mcp_landing', 'claude', 'acq-a'],
    ['wallet_funded', 'wallet_funded', 'u1', '2026-07-01T09:00:00Z', 'mcp_landing', 'claude', 'acq-a'],
    ['wallet_funded', 'wallet_funded', 'u1', '2026-07-01T12:00:00Z', 'mcp_landing', 'claude', 'acq-a'],
    ['wallet_funded', 'wallet_funded', 'u1', '2026-07-01T13:00:00Z', 'mcp_landing', 'claude', 'acq-a'],
    ['trial_generation_completed', 'trial_completed', 'u2', '2026-07-02T10:00:00Z', 'direct_mcp', 'other', null],
    ['wallet_funded', 'wallet_funded', 'u2', '2026-07-20T10:00:00Z', 'direct_mcp', 'other', null],
    ['wallet_funded', 'wallet_funded', 'u3', '2026-07-02T10:00:00Z', 'mcp_landing', 'codex', 'acq-c'],
    ['trial_generation_completed', 'trial_completed', 'u4', '2026-07-03T10:00:00Z', 'mcp_landing', 'codex', 'acq-d'],
    ['wallet_funded', 'wallet_funded', 'u4', '2026-07-04T10:00:00Z', 'direct_mcp', 'other', null],
    ['trial_generation_completed', 'trial_completed', 'u5', '2026-06-30T10:00:00Z', 'mcp_landing', 'claude', 'acq-e'],
    ['wallet_funded', 'wallet_funded', 'u5', '2026-07-02T10:00:00Z', 'mcp_landing', 'claude', 'acq-e'],
  ].map(([event_type, stage, user_id, occurred_at, source, acquisition_client, acquisition_id]) => ({
    event_type, stage, user_id, occurred_at, source, acquisition_client, acquisition_id,
  }));
  const executor: QueryExecutor = {
    async query<TRecord>(sql, params) {
      capturedSql = sql;
      capturedParams = params;
      return rows as TRecord[];
    },
  };

  const summary = await getMcpFunnelSummary({
    from: new Date('2026-07-01T00:00:00.000Z'),
    to: new Date('2026-07-08T00:00:00.000Z'),
    conversionWindowSeconds: 7 * 24 * 60 * 60,
    timeZone: 'UTC',
  }, { executor });

  assert.match(capturedSql, /SELECT[\s\S]*event_type[\s\S]*occurred_at[\s\S]*FROM mcp_funnel_events/i);
  assert.match(capturedSql, /occurred_at\s*>=\s*\$1[\s\S]*occurred_at\s*<\s*\$2/i);
  assert.equal(capturedParams?.length, 2);
  assert.equal(summary.completedTrialUsers, 3);
  assert.equal(summary.fundedAfterTrialUsers, 2);
  assert.equal(summary.trialToWalletRate, 2 / 3);
  assert.deepEqual(summary.window, {
    from: '2026-07-01T00:00:00.000Z', to: '2026-07-08T00:00:00.000Z',
    conversionWindowSeconds: 604800, timeZone: 'UTC',
  });
  assert.deepEqual(summary.cohorts.map((cohort) => [
    cohort.source, cohort.client, cohort.completedTrialUsers, cohort.fundedAfterTrialUsers,
    cohort.trialToWalletRate,
  ]), [
    ['direct_mcp', 'other', 1, 0, 0],
    ['mcp_landing', 'claude', 1, 1, 1],
    ['mcp_landing', 'codex', 1, 1, 1],
  ]);
});

test('KPI returns null for a zero denominator and keeps raw attribution window configuration immutable', async () => {
  const { getMcpFunnelSummary } = await loadFunnel();
  const executor: QueryExecutor = { async query<TRecord>() { return [] as TRecord[]; } };
  const config = Object.freeze({
    from: new Date('2026-07-01T00:00:00.000Z'),
    to: new Date('2026-07-08T00:00:00.000Z'),
    conversionWindowSeconds: 900,
    timeZone: 'UTC' as const,
  });
  const summary = await getMcpFunnelSummary(config, { executor });
  assert.equal(summary.completedTrialUsers, 0);
  assert.equal(summary.fundedAfterTrialUsers, 0);
  assert.equal(summary.trialToWalletRate, null);
  assert.equal(config.conversionWindowSeconds, 900);
});

test('consent start uses the signed HttpOnly cookie only after fresh user and authoritative client checks', () => {
  const page = readFileSync(consentPagePath, 'utf8');
  const decision = readFileSync(decisionRoutePath, 'utf8');
  assert.match(page, /cookies\(\)/);
  assert.match(page, /MCP_ACQUISITION_COOKIE_NAME/);
  assert.match(page, /verifySignedMcpAcquisitionCookie/);
  assert.match(page, /resolveMcpAcquisitionSigningSecret/);
  assert.match(page, /auth\.getClaims\(\)/);
  assert.match(page, /auth\.getUser\(\)/);
  assert.match(page, /user\.id\s*!==\s*subject/);
  assert.match(page, /data\.client\.id/);
  assert.match(page, /recordMcpOAuthConnectionStarted/);
  assert.doesNotMatch(page, /oauth_connection_completed/);
  assert.doesNotMatch(page, /user_metadata/);
  assert.match(decision, /auth\.getClaims\(\)/);
  assert.match(decision, /auth\.getUser\(\)/);
  assert.match(decision, /user\.id\s*!==\s*subject/);
  assert.doesNotMatch(decision, /user_metadata/);
});

test('post-auth connection binding uses one idempotent query with latest same-user/client start or direct fallback', async () => {
  const { bindAuthenticatedMcpConnection } = await loadFunnel();
  let sql = '';
  let params: ReadonlyArray<unknown> | undefined;
  const executor: QueryExecutor = {
    async query<TRecord>(text, values) {
      sql = text;
      params = values;
      return [{ acquisition_id: 'acq_ABCDEFGHIJKLMNOPQRSTUVWX', source: 'mcp_landing' }] as TRecord[];
    },
  };
  const outcome = await bindAuthenticatedMcpConnection(
    { userId: 'user-1', clientId: 'oauth-client-1', emailVerified: true, authMethod: 'oauth' },
    { executor, now: new Date('2026-07-14T10:00:00.000Z'), bindingWindowSeconds: 900 },
  );
  assert.equal(outcome, 'attributed');
  assert.match(sql, /oauth_connection_started/);
  assert.match(sql, /oauth_connection_completed/);
  assert.match(sql, /ORDER BY occurred_at DESC/);
  assert.match(sql, /user_id\s*=\s*\$\d+/);
  assert.match(sql, /oauth_client_id\s+IS NOT DISTINCT FROM\s+\$\d+/);
  assert.match(sql, /ON CONFLICT \(idempotency_key\)/);
  assert.match(sql, /direct_mcp/);
  assert.doesNotMatch(sql, /authorization_id|access_token|token_hash|user_metadata/i);
  assert.ok(params?.includes(900));
});
