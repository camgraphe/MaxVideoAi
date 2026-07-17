import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { Pool } from 'pg';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getDb, withDbTransaction, type TransactionQueryExecutor } from '../frontend/src/lib/db';
import { getActiveAccountRestrictionInExecutor } from '../frontend/src/server/fraud-cleanup';
import { computeGenerationCatalogRevision } from '../frontend/src/server/agent-api/catalog-revision';
import {
  confirmGeneration,
  type ConfirmGenerationDependencies,
} from '../frontend/src/server/agent-api/confirm-generation';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import { hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import {
  reserveIncludedTrialGenerationInitialJob,
  type IncludedTrialGenerationProviderOutcome,
} from '../frontend/src/server/agent-api/paid-generation-execution';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import {
  claimPreparedQuote,
  insertPreparedQuote,
  lockOwnedQuote,
  markQuoteAccepted,
  markQuoteExpired,
  markQuoteFailed,
} from '../frontend/src/server/agent-api/quote-repository';
import { lockReservableEntitlement, reserveEntitlement } from '../frontend/src/server/agent-api/trial-entitlement-repository';
import { acceptTrialRisk } from '../frontend/src/server/agent-api/trial-risk';
import { getGenerationStatus } from '../frontend/src/server/generations/generation-status';
import {
  createPaidGenerationTestSchema,
  missingDisposablePostgresCommand,
  startDisposablePostgres,
} from './helpers/disposable-postgres';

const RISK_SECRET = 'trial-confirm-risk-secret-0123456789abcdef';

function trialCandidate(): AgentPublicGenerationEngine {
  const entry = getFalEngineById('seedance-2-0-mini');
  assert.ok(entry);
  const t2v = entry.modes.find((mode) => mode.mode === 't2v');
  assert.ok(t2v);
  return {
    engine: entry.engine,
    surface: 'video',
    publicModes: ['t2v'],
    modeCaps: { t2v: t2v.ui },
  };
}

const candidate = trialCandidate();
const catalogRevision = computeGenerationCatalogRevision([candidate]);
const membership = {
  tier: 'member' as const,
  source: 'app_receipts_rolling_30d' as const,
  spent30Cents: 0,
  thresholdCents: 0,
  discountPercent: 0,
};

function request(prompt: string): CanonicalGenerationRequest {
  return {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'seedance-2-0-mini',
    mode: 't2v',
    prompt,
    settings: { durationSec: 5, resolution: '480p', aspectRatio: '16:9', audio: true },
    references: [],
    outputCount: 1,
  };
}

function canonicalPricing() {
  return {
    totalCents: 125,
    currency: 'USD',
    membershipTier: 'member',
    base: { amountCents: 55 },
    platformRevenueCents: 70,
    provenance: { source: 'trial-confirm-pg' },
  };
}

function pricingSnapshot() {
  return {
    schemaVersion: 1,
    catalogRevision,
    surface: 'video',
    engineId: 'seedance-2-0-mini',
    membership,
    canonicalPricing: canonicalPricing(),
    funding: {
      kind: 'included_trial',
      customerChargeCents: 0,
      normalPriceCents: 125,
      providerCostCents: 55,
    },
  };
}

function transactionRunner() {
  return async <TResult>(callback: (executor: TransactionQueryExecutor) => Promise<TResult>) => {
    return withDbTransaction((executor) => callback(executor));
  };
}

async function insertTrialQuote(params: {
  pool: Pool;
  quoteId: string;
  userId: string;
  clientId: string;
  prompt: string;
}) {
  const canonicalRequest = request(params.prompt);
  return transactionRunner()((executor) => insertPreparedQuote({
    userId: params.userId,
    oauthClientId: params.clientId,
    request: canonicalRequest,
    requestHash: hashCanonicalGenerationRequest(canonicalRequest),
    catalogRevision,
    pricingSnapshot: pricingSnapshot(),
    priceCents: 0,
    currency: 'USD',
    fundingMode: 'trial',
  }, {
    executor,
    randomUUID: () => params.quoteId,
  }));
}

function principal(userId: string, clientId: string): AgentPrincipal {
  return { userId, clientId, emailVerified: true, authMethod: 'oauth' };
}

function dependencies(params: {
  pool: Pool;
  provider: () => Promise<IncludedTrialGenerationProviderOutcome>;
}): ConfirmGenerationDependencies {
  const queryRows = async <TRecord>(sql: string, values?: ReadonlyArray<unknown>) =>
    (await params.pool.query<TRecord>(sql, values as unknown[] | undefined)).rows;
  return {
    paidGenerationEnabled: () => false,
    trialGenerationEnabled: () => true,
    trialRiskContext: { clientIp: '203.0.113.88', userAgent: 'Codex/1.0' },
    withTransaction: transactionRunner(),
    lockOwnedQuote,
    markQuoteExpired,
    getAccountRestriction: (userId, { executor }) =>
      getActiveAccountRestrictionInExecutor(userId, executor),
    listPublicEngines: async () => [candidate],
    resolveMembershipPricing: async () => membership,
    priceGeneration: async () => ({
      priceCents: 125,
      currency: 'USD',
      membershipTier: 'member',
      pricingSnapshot: canonicalPricing(),
    }),
    checkSpendingLimits: async () => assert.fail('trial race must not check wallet spending'),
    acceptTrialRisk: (input, { executor }) => acceptTrialRisk(input, {
      executor,
      secret: RISK_SECRET,
      limits: {
        perUserAcceptedPerUtcDay: 3,
        perOauthClientAcceptedPerUtcDay: 25,
        perFingerprintAcceptedPerUtcDay: 3,
        globalAcceptedProviderCostCentsPerUtcDay: 10_000,
      },
    }),
    lockReservableEntitlement,
    reserveEntitlement,
    reserveInitialJob: async () => assert.fail('trial race must not reserve a paid job'),
    reserveTrialInitialJob: reserveIncludedTrialGenerationInitialJob,
    claimPreparedQuote,
    submitPaidGeneration: async () => assert.fail('trial race must not submit a paid generation'),
    submitTrialGeneration: params.provider,
    markQuoteAccepted: (input) => markQuoteAccepted(input, { executor: { query: queryRows } }),
    markQuoteFailed: (input) => markQuoteFailed(input, { executor: { query: queryRows } }),
    readGenerationStatus: ({ userId, jobId }) => getGenerationStatus({ userId, jobId, queryFn: queryRows }),
    accountUrl: 'https://maxvideoai.com/account/connections',
  };
}

async function counts(pool: Pool, userId: string) {
  const result = await pool.query<{
    jobs: string; receipts: string; reserved: string; claimed: string; risk_events: string;
  }>(`
    SELECT
      (SELECT count(*) FROM app_jobs WHERE user_id = $1)::text AS jobs,
      (SELECT count(*) FROM app_receipts WHERE user_id = $1)::text AS receipts,
      (SELECT count(*) FROM mcp_trial_entitlements WHERE user_id = $1 AND status = 'reserved')::text AS reserved,
      (SELECT count(*) FROM mcp_generation_quotes WHERE user_id = $1 AND state = 'claimed')::text AS claimed,
      (SELECT count(*) FROM mcp_trial_risk_events WHERE user_id = $1 AND outcome = 'allowed')::text AS risk_events
  `, [userId]);
  return result.rows[0];
}

test('same trial quote and two trial quotes for one user race safely in disposable PostgreSQL', async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) {
    t.skip(`${missing} is unavailable`);
    return;
  }
  const postgres = await startDisposablePostgres('mcp-trial-confirm');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = postgres.databaseUrl;
  t.after(async () => {
    await getDb().end().catch(() => undefined);
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await postgres.cleanup();
  });
  await createPaidGenerationTestSchema(postgres.pool);
  await postgres.pool.query(readFileSync('neon/migrations/31_mcp_trial_entitlements.sql', 'utf8'));

  const sameUser = 'same-trial-user';
  const sameClient = 'same-trial-client';
  const sameQuote = '10000000-0000-4000-8000-000000000001';
  await insertTrialQuote({
    pool: postgres.pool, quoteId: sameQuote, userId: sameUser, clientId: sameClient,
    prompt: 'same quote race',
  });
  let providerCalls = 0;
  let signalStarted!: () => void;
  let releaseProvider!: () => void;
  const providerStarted = new Promise<void>((resolve) => { signalStarted = resolve; });
  const providerRelease = new Promise<void>((resolve) => { releaseProvider = resolve; });
  const sameDependencies = dependencies({
    pool: postgres.pool,
    provider: async () => {
      providerCalls += 1;
      signalStarted();
      await providerRelease;
      return { kind: 'accepted' };
    },
  });
  const samePrincipal = principal(sameUser, sameClient);
  const first = confirmGeneration({ quoteId: sameQuote, confirmed: true }, samePrincipal, sameDependencies);
  await providerStarted;
  const repeat = await confirmGeneration({ quoteId: sameQuote, confirmed: true }, samePrincipal, sameDependencies);
  releaseProvider();
  const winner = await first;
  assert.equal(winner.jobId, sameQuote);
  assert.equal(repeat.jobId, sameQuote);
  const storedTrialStatus = await getGenerationStatus({
    userId: sameUser,
    jobId: sameQuote,
    queryFn: async <TRecord>(sql: string, values?: ReadonlyArray<unknown>) => (
      await postgres.pool.query<TRecord>(sql, values as unknown[] | undefined)
    ).rows,
  });
  assert.ok(storedTrialStatus);
  assert.equal(storedTrialStatus.priceCents, 0);
  assert.equal(storedTrialStatus.paymentStatus, 'included_mcp_trial');
  assert.equal('pricingSnapshot' in storedTrialStatus, false);
  assert.equal('providerCostCents' in storedTrialStatus, false);
  assert.doesNotMatch(JSON.stringify(storedTrialStatus), /providerCostCents|normalPriceCents|pricingSnapshot/iu);
  assert.equal(providerCalls, 1);
  assert.deepEqual(await counts(postgres.pool, sameUser), {
    jobs: '1', receipts: '0', reserved: '1', claimed: '1', risk_events: '1',
  });

  const twoUser = 'two-trial-user';
  const twoClient = 'two-trial-client';
  const quoteA = '20000000-0000-4000-8000-000000000001';
  const quoteB = '20000000-0000-4000-8000-000000000002';
  await Promise.all([
    insertTrialQuote({ pool: postgres.pool, quoteId: quoteA, userId: twoUser, clientId: twoClient, prompt: 'quote A' }),
    insertTrialQuote({ pool: postgres.pool, quoteId: quoteB, userId: twoUser, clientId: twoClient, prompt: 'quote B' }),
  ]);
  let twoProviderCalls = 0;
  const twoDependencies = dependencies({
    pool: postgres.pool,
    provider: async () => { twoProviderCalls += 1; return { kind: 'accepted' }; },
  });
  const twoPrincipal = principal(twoUser, twoClient);
  const results = await Promise.allSettled([
    confirmGeneration({ quoteId: quoteA, confirmed: true }, twoPrincipal, twoDependencies),
    confirmGeneration({ quoteId: quoteB, confirmed: true }, twoPrincipal, twoDependencies),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const loser = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  assert.ok(loser?.reason instanceof AgentApiError);
  assert.equal(loser.reason.code, 'TRIAL_NOT_ELIGIBLE');
  assert.equal(twoProviderCalls, 1);
  assert.deepEqual(await counts(postgres.pool, twoUser), {
    jobs: '1', receipts: '0', reserved: '1', claimed: '1', risk_events: '1',
  });
  const loserState = await postgres.pool.query<{ state: string }>(
    `SELECT state FROM mcp_generation_quotes
      WHERE user_id = $1 AND state = 'prepared'`,
    [twoUser],
  );
  assert.deepEqual(loserState.rows, [{ state: 'prepared' }]);
});
