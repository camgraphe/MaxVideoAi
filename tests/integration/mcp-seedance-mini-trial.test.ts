import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Pool } from 'pg';

import { getFalEngineById } from '../../frontend/src/config/falEngines';
import { getDb, type QueryExecutor, type TransactionQueryExecutor } from '../../frontend/src/lib/db';
import { getAgentAccountStatus } from '../../frontend/src/server/agent-api/account-status';
import { createConfirmGenerationService } from '../../frontend/src/server/agent-api/confirm-generation';
import {
  getAgentGenerationStatus,
  listAgentRecentGenerations,
} from '../../frontend/src/server/agent-api/generation-status';
import { listAgentModels } from '../../frontend/src/server/agent-api/model-catalog';
import type { AgentPublicGenerationEngine } from '../../frontend/src/server/agent-api/model-catalog';
import { recommendAgentModels } from '../../frontend/src/server/agent-api/model-recommendations';
import {
  submitReservedIncludedTrialGeneration,
  type IncludedTrialGenerationExecution,
  type IncludedTrialGenerationProviderOutcome,
} from '../../frontend/src/server/agent-api/paid-generation-execution';
import {
  createPrepareGenerationService,
  prepareGeneration,
} from '../../frontend/src/server/agent-api/prepare-generation';
import type { AgentPrincipal } from '../../frontend/src/server/agent-api/principal';
import { requireTrialProviderCostCents } from '../../frontend/src/server/agent-api/trial-provider-cost';
import { getTrialEligibility } from '../../frontend/src/server/agent-api/trial-eligibility';
import { acceptTrialRisk, checkTrialRisk } from '../../frontend/src/server/agent-api/trial-risk';
import { applyTrialJobOutcome } from '../../frontend/src/server/agent-api/trial-outcomes';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../../frontend/src/server/mcp/server';
import { resolveAgentPrincipal } from '../../frontend/src/server/mcp/oauth-adapter';
import { getWalletSummary } from '../../frontend/src/server/wallet-summary';
import { sharedWebPrice } from '../helpers/mcp-paid-e2e-harness';
import {
  createPaidGenerationTestSchema,
  missingDisposablePostgresCommand,
  startDisposablePostgres,
} from '../helpers/disposable-postgres';

const BYTEPLUS_PRICE_FIXTURE = Object.freeze({
  modelId: 'dreamina-seedance-2-0-mini-260615',
  productUrl: 'https://www.byteplus.com/en/product/modelark',
  pricingDocUrl: 'https://docs.byteplus.com/ja/docs/ModelArk/1544106',
  retrievedAt: '2026-07-17',
  noVideoUsdPerMillionTokens: 3.5,
  serverSafetyCeilingCents: 25,
});
const RISK_SECRET = 't9-risk-secret-0123456789abcdef0123456789abcdef';
const ACCOUNT_URL = 'https://maxvideoai.com/account/connections';

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
const principal = {
  userId: 't9-cost-user',
  clientId: 't9-cost-client',
  emailVerified: true,
  authMethod: 'oauth' as const,
};
const input = {
  surface: 'video' as const,
  engineId: 'seedance-2-0-mini',
  mode: 't2v' as const,
  prompt: 'A paper lantern drifting above a quiet lake',
  settings: { aspectRatio: '16:9', audio: true },
};

test('trial snapshot uses the official BytePlus no-video cost below the server safety ceiling', async () => {
  const inserted: Array<Record<string, unknown>> = [];
  const executor = {
    async query() { throw new Error('unexpected SQL'); },
    __transactionQueryExecutor: true as const,
  } as TransactionQueryExecutor;
  const prepared = await prepareGeneration(input, principal, {
    paidGenerationEnabled: () => true,
    getAccountRestriction: async () => null,
    listPublicEngines: async () => [candidate],
    resolveMembershipPricing: async () => ({
      tier: 'member', source: 'app_receipts_rolling_30d', spent30Cents: 0,
      thresholdCents: 0, discountPercent: 0,
    }),
    priceGeneration: sharedWebPrice,
    getWalletSummary: async () => ({
      balanceCents: 0, currency: 'USD', pendingCents: 0, hasCompletedTopUp: false,
    }),
    withTransaction: async (callback) => callback(executor),
    checkSpendingLimits: async () => assert.fail('trial must not check wallet limits'),
    insertPreparedQuote: async (quote) => {
      inserted.push(quote as unknown as Record<string, unknown>);
      return {
        ...quote,
        quoteId: '90000000-0000-4000-8000-000000000001',
        trialFunding: (quote.pricingSnapshot as Record<string, unknown>).funding as never,
        state: 'prepared',
        jobId: null,
        expiresAt: new Date('2026-07-17T12:10:00Z'),
        claimedAt: null,
        createdAt: new Date('2026-07-17T12:00:00Z'),
        updatedAt: new Date('2026-07-17T12:00:00Z'),
      };
    },
    getTrialEligibility: async () => ({
      status: 'available',
      preset: {
        engineId: 'seedance-2-0-mini', surface: 'video', mode: 't2v',
        durationSec: 5, resolution: '480p', aspectRatios: ['16:9', '9:16', '1:1'],
        audioOptional: true, outputCount: 1,
      },
    }),
    checkTrialRisk: async () => ({ allowed: true }),
    recordTrialQuotePreparedAudit: async () => true,
    trialRiskContext: { clientIp: null, userAgent: null },
    accountUrl: 'https://maxvideoai.com/account/connections',
    now: () => new Date('2026-07-17T12:00:00Z'),
  });

  assert.equal(prepared.fundingMode, 'trial');
  const snapshot = inserted[0]?.pricingSnapshot as Record<string, unknown>;
  const funding = snapshot.funding as Record<string, unknown>;
  const expectedTokens = (854 * 480 * 5 * 24) / 1024;
  const expectedCostCents = Math.ceil(
    expectedTokens * BYTEPLUS_PRICE_FIXTURE.noVideoUsdPerMillionTokens / 1_000_000 * 100,
  );
  assert.equal(new URL(BYTEPLUS_PRICE_FIXTURE.productUrl).hostname, 'www.byteplus.com');
  assert.equal(new URL(BYTEPLUS_PRICE_FIXTURE.pricingDocUrl).hostname, 'docs.byteplus.com');
  assert.match(BYTEPLUS_PRICE_FIXTURE.retrievedAt, /^2026-07-17$/);
  assert.equal(BYTEPLUS_PRICE_FIXTURE.modelId, 'dreamina-seedance-2-0-mini-260615');
  assert.equal(expectedCostCents, 17);
  assert.equal(funding.providerCostCents, expectedCostCents);
  assert.ok(expectedCostCents <= BYTEPLUS_PRICE_FIXTURE.serverSafetyCeilingCents);
  assert.equal(JSON.stringify(prepared).includes('providerCostCents'), false);
});

test('trial provider cost fails closed when its configurable safety ceiling drifts', () => {
  const request = {
    schemaVersion: 1 as const,
    ...input,
    settings: {
      durationSec: 5,
      resolution: '480p',
      aspectRatio: '16:9',
      audio: true,
    },
    references: [],
    outputCount: 1 as const,
  };
  assert.equal(requireTrialProviderCostCents(request, undefined), 17);
  assert.equal(requireTrialProviderCostCents(request, '17'), 17);
  for (const rawCeiling of ['16', '', '0', ' 25', '25.0', '101', '9007199254740992']) {
    assert.throws(
      () => requireTrialProviderCostCents(request, rawCeiling),
      /provider cost is unavailable/i,
    );
  }
});

async function oauthFixture(provider: 'email' | 'google', confirmed: boolean) {
  const userId = `t9-${provider}-${confirmed ? 'verified' : 'unverified'}`;
  return resolveAgentPrincipal(new Request('https://api.maxvideoai.com/mcp', {
    headers: { authorization: 'Bearer t9-local-fixture-token' },
  }), {
    async createAuthClient() {
      return {
        async getClaims() {
          return {
            data: { claims: { sub: userId, client_id: `t9-${provider}-client` } },
            error: null,
          };
        },
        async getUser() {
          return {
            data: {
              user: {
                id: userId,
                email_confirmed_at: confirmed ? '2026-07-17T10:00:00Z' : null,
                identities: [{ provider }],
              },
            },
            error: null,
          };
        },
      };
    },
  });
}

test('local OAuth fixtures normalize verified email and Google identities without claiming hosted signup', async () => {
  const email = await oauthFixture('email', true);
  const google = await oauthFixture('google', true);
  assert.deepEqual(email, {
    userId: 't9-email-verified', clientId: 't9-email-client',
    emailVerified: true, authMethod: 'oauth',
  });
  assert.deepEqual(google, {
    userId: 't9-google-verified', clientId: 't9-google-client',
    emailVerified: true, authMethod: 'oauth',
  });
  for (const provider of ['email', 'google'] as const) {
    const unverified = await oauthFixture(provider, false);
    assert.equal(unverified.emailVerified, false);
    assert.deepEqual(await getTrialEligibility(unverified, {
      featureEnabled: true,
      environmentEnabled: 'true',
      verificationUrl: ACCOUNT_URL,
    }), {
      status: 'verification_required',
      nextAction: { type: 'verify_email', url: ACCOUNT_URL },
    });
  }
});

function poolExecutor(pool: Pool): QueryExecutor {
  return {
    async query<T>(sql: string, params?: ReadonlyArray<unknown>) {
      return (await pool.query<T>(sql, params as unknown[] | undefined)).rows;
    },
  };
}

const riskLimits = {
  perUserAcceptedPerUtcDay: 8,
  perOauthClientAcceptedPerUtcDay: 100,
  perFingerprintAcceptedPerUtcDay: 100,
  globalAcceptedProviderCostCentsPerUtcDay: 100_000,
};

type TrialProviderPlan = 'accepted' | 'rejected' | 'ambiguous';

class TrialProviderHarness {
  readonly plans = new Map<string, TrialProviderPlan>();
  readonly captures: Array<{ jobId: string; body: Record<string, unknown> }> = [];

  constructor(private readonly pool: Pool) {}

  calls(jobId: string): number {
    return this.captures.filter((capture) => capture.jobId === jobId).length;
  }

  submit = async (
    execution: IncludedTrialGenerationExecution,
  ): Promise<IncludedTrialGenerationProviderOutcome> => {
    return submitReservedIncludedTrialGeneration(execution, {
      executeVideo: async (options) => {
        const jobId = String(options.body.jobId);
        this.captures.push({ jobId, body: options.body });
        const plan = this.plans.get(jobId) ?? 'accepted';
        if (plan === 'rejected') {
          await this.pool.query(
            `UPDATE app_jobs
                SET status = 'failed', progress = 0, provisional = FALSE,
                    updated_at = clock_timestamp()
              WHERE job_id = $1`,
            [jobId],
          );
          return { status: 400, body: { ok: false } };
        }
        if (plan === 'ambiguous') return { status: 503, body: { ok: false } };
        await this.pool.query(
          `UPDATE app_jobs
              SET status = 'accepted', progress = 0, provider_job_id = $2,
                  provisional = FALSE, updated_at = clock_timestamp()
            WHERE job_id = $1`,
          [jobId, `private-provider-${jobId}`],
        );
        return { status: 202, body: { ok: true, jobId } };
      },
      executeImage: async () => assert.fail('included video trial cannot execute an image'),
    });
  };
}

function trialEligibility(principal: AgentPrincipal, enabled = true) {
  return getTrialEligibility(principal, {
    featureEnabled: true,
    environmentEnabled: enabled ? 'true' : 'false',
    verificationUrl: ACCOUNT_URL,
    listPublicEngines: async () => [candidate],
  });
}

function trialServices(pool: Pool, provider: TrialProviderHarness, enabled = true): MaxVideoAiMcpServices {
  const executor = poolExecutor(pool);
  const catalogDependencies = {
    async listEngines() { return [candidate.engine]; },
    surfaceByEngineId(engineId: string) {
      return engineId === candidate.engine.id ? 'video' as const : null;
    },
  };
  return {
    getAccountStatus: (identity) => getAgentAccountStatus(identity, {
      getWalletSummary,
      accountUrl: ACCOUNT_URL,
      getTrialEligibility: (current) => trialEligibility(current, enabled),
    }),
    listModels: (filter) => listAgentModels(filter, catalogDependencies),
    recommendModels: (request) => recommendAgentModels(request, catalogDependencies),
    prepareGeneration: createPrepareGenerationService(
      ACCOUNT_URL,
      { clientIp: '203.0.113.42', userAgent: 'Codex/1.0' },
      {
        paidGenerationEnabled: () => true,
        listPublicEngines: async () => [candidate],
        getTrialEligibility: (current) => trialEligibility(current, enabled),
        checkTrialRisk: (risk) => checkTrialRisk(risk, {
          executor,
          secret: RISK_SECRET,
          limits: riskLimits,
        }),
      },
    ),
    confirmGeneration: createConfirmGenerationService(
      ACCOUNT_URL,
      { clientIp: '203.0.113.42', userAgent: 'Codex/1.0' },
      {
        paidGenerationEnabled: () => true,
        trialGenerationEnabled: () => enabled,
        listPublicEngines: async () => [candidate],
        acceptTrialRisk: (risk, { executor: transaction }) => acceptTrialRisk(risk, {
          executor: transaction,
          secret: RISK_SECRET,
          limits: riskLimits,
        }),
        submitTrialGeneration: provider.submit,
      },
    ),
    getGenerationStatus: (request, identity) => getAgentGenerationStatus(request, identity),
    listRecentGenerations: (request, identity) => listAgentRecentGenerations(request, identity),
    createTopupLink: async () => assert.fail('trial E2E must not create a top-up handoff'),
  };
}

async function connectTrial(identity: AgentPrincipal, services: MaxVideoAiMcpServices) {
  const server = createMaxVideoAiMcpServer(identity, services, { paidGeneration: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: `t9-${identity.userId}`, version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    async close() { await Promise.allSettled([client.close(), server.close()]); },
  };
}

function structured(result: CallToolResult): Record<string, unknown> {
  assert.ok(result.structuredContent && typeof result.structuredContent === 'object');
  return result.structuredContent as Record<string, unknown>;
}

function errorCode(result: CallToolResult): string {
  assert.equal(result.isError, true);
  const error = structured(result).error;
  assert.ok(error && typeof error === 'object');
  return String((error as Record<string, unknown>).code);
}

async function prepareTrial(client: Client, settings: { aspectRatio: string; audio: boolean }) {
  const result = await client.callTool({
    name: 'prepare_generation',
    arguments: {
      surface: 'video', engineId: 'seedance-2-0-mini', mode: 't2v',
      prompt: 'A private T9 paper-lantern prompt', settings,
    },
  }) as CallToolResult;
  assert.notEqual(result.isError, true, JSON.stringify(result.structuredContent));
  return { result, value: structured(result) };
}

async function confirmTrial(client: Client, quoteId: string) {
  return client.callTool({
    name: 'confirm_generation',
    arguments: { quoteId, confirmed: true },
  }) as Promise<CallToolResult>;
}

test('verified OAuth acquisition completes one local SDK trial without wallet or receipt mutation', async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) {
    t.skip(`${missing} is unavailable`);
    return;
  }
  const postgres = await startDisposablePostgres('mcp-trial-t9-e2e');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousStorageBaseUrl = process.env.S3_PUBLIC_BASE_URL;
  const previousCeiling = process.env.MCP_TRIAL_PROVIDER_COST_CEILING_CENTS;
  process.env.DATABASE_URL = postgres.databaseUrl;
  process.env.S3_PUBLIC_BASE_URL = 'https://media.maxvideoai.com';
  process.env.MCP_TRIAL_PROVIDER_COST_CEILING_CENTS = '25';
  t.after(async () => {
    await getDb().end().catch(() => undefined);
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousStorageBaseUrl === undefined) delete process.env.S3_PUBLIC_BASE_URL;
    else process.env.S3_PUBLIC_BASE_URL = previousStorageBaseUrl;
    if (previousCeiling === undefined) delete process.env.MCP_TRIAL_PROVIDER_COST_CEILING_CENTS;
    else process.env.MCP_TRIAL_PROVIDER_COST_CEILING_CENTS = previousCeiling;
    await postgres.cleanup();
  });
  await createPaidGenerationTestSchema(postgres.pool);
  await postgres.pool.query(readFileSync('neon/migrations/31_mcp_trial_entitlements.sql', 'utf8'));

  const identity: AgentPrincipal = {
    userId: 't9-lifecycle-user', clientId: 't9-lifecycle-client',
    emailVerified: true, authMethod: 'oauth',
  };
  await postgres.pool.query(
    `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description)
     VALUES ($1, 'topup', 5000, 'USD', 'T9 invariant fixture')`,
    [identity.userId],
  );
  const provider = new TrialProviderHarness(postgres.pool);
  const session = await connectTrial(identity, trialServices(postgres.pool, provider));
  t.after(() => session.close());

  const tools = (await session.client.listTools()).tools.map((tool) => tool.name);
  assert.ok(tools.includes('prepare_generation') && tools.includes('confirm_generation'));
  const accountBefore = await session.client.callTool({
    name: 'get_account_status', arguments: {},
  }) as CallToolResult;
  assert.equal((structured(accountBefore).trial as Record<string, unknown>).status, 'available');
  assert.deepEqual(structured(accountBefore).wallet, {
    amountCents: 5000, currency: 'USD', pendingCents: 0,
  });

  const prepared = await prepareTrial(session.client, { aspectRatio: '16:9', audio: true });
  const quoteId = String(prepared.value.quoteId);
  assert.equal(prepared.value.fundingMode, 'trial');
  assert.deepEqual(prepared.value.price, { amountCents: 0, currency: 'USD' });
  assert.deepEqual(prepared.value.balance, { beforeCents: 5000, afterCents: 5000 });
  assert.deepEqual(prepared.value.summary, {
    schemaVersion: 1,
    surface: 'video', engineId: 'seedance-2-0-mini', mode: 't2v',
    prompt: 'A private T9 paper-lantern prompt',
    settings: { aspectRatio: '16:9', audio: true, durationSec: 5, resolution: '480p' },
    references: [], outputCount: 1,
  });
  assert.equal(JSON.stringify(prepared.result).includes('providerCostCents'), false);
  const quote = (await postgres.pool.query<{
    funding_mode: string; price_cents: number; pricing_snapshot: Record<string, unknown>;
  }>(`SELECT funding_mode, price_cents, pricing_snapshot
        FROM mcp_generation_quotes WHERE quote_id = $1`, [quoteId])).rows[0];
  assert.ok(quote);
  assert.equal(quote.funding_mode, 'trial');
  assert.equal(quote.price_cents, 0);
  assert.equal(
    (quote.pricing_snapshot.funding as Record<string, unknown>).providerCostCents,
    17,
  );

  const confirmed = await confirmTrial(session.client, quoteId);
  assert.notEqual(confirmed.isError, true, JSON.stringify(confirmed.structuredContent));
  assert.equal(structured(confirmed).status, 'accepted');
  assert.equal(structured(confirmed).funding, 'included_trial');
  assert.equal(structured(confirmed).entitlementState, 'reserved');
  assert.equal(provider.calls(quoteId), 1);
  await postgres.pool.query(
    `UPDATE app_jobs SET status = 'running', progress = 47, updated_at = clock_timestamp()
      WHERE job_id = $1`,
    [quoteId],
  );
  const running = await session.client.callTool({
    name: 'get_generation_status', arguments: { jobId: quoteId },
  }) as CallToolResult;
  assert.equal(structured(running).status, 'running');
  assert.equal(structured(running).progress, 47);
  assert.equal(structured(running).entitlementState, 'reserved');

  const videoUrl = `https://media.maxvideoai.com/t9/${quoteId}.mp4`;
  await postgres.pool.query(
    `UPDATE app_jobs
        SET status = 'completed', progress = 100, video_url = $2,
            preview_video_url = $2, mcp_trial_outcome_disposition = 'completed',
            updated_at = clock_timestamp()
      WHERE job_id = $1`,
    [quoteId, videoUrl],
  );
  assert.deepEqual(await applyTrialJobOutcome(quoteId, { kind: 'completed' }), {
    funding: 'included_trial', entitlementState: 'consumed',
  });
  const completed = await session.client.callTool({
    name: 'get_generation_status', arguments: { jobId: quoteId },
  }) as CallToolResult;
  assert.equal(structured(completed).status, 'completed');
  assert.equal(structured(completed).entitlementState, 'consumed');
  assert.ok(completed.content.some((entry) => entry.type === 'resource_link' && entry.uri === videoUrl));

  const accounting = (await postgres.pool.query<{
    topups: string; charges: string; refunds: string; balance_cents: string;
  }>(`SELECT
        count(*) FILTER (WHERE type = 'topup')::text AS topups,
        count(*) FILTER (WHERE type = 'charge')::text AS charges,
        count(*) FILTER (WHERE type = 'refund')::text AS refunds,
        COALESCE(sum(CASE WHEN type = 'topup' THEN amount_cents
                          WHEN type = 'charge' THEN -amount_cents
                          WHEN type = 'refund' THEN amount_cents ELSE 0 END), 0)::text AS balance_cents
      FROM app_receipts WHERE user_id = $1`, [identity.userId])).rows[0];
  assert.deepEqual(accounting, {
    topups: '1', charges: '0', refunds: '0', balance_cents: '5000',
  });
  const accountAfter = await session.client.callTool({
    name: 'get_account_status', arguments: {},
  }) as CallToolResult;
  assert.equal((structured(accountAfter).trial as Record<string, unknown>).status, 'consumed');
  assert.deepEqual(structured(accountAfter).wallet, structured(accountBefore).wallet);
  const serializedRecovery = JSON.stringify([confirmed, running, completed, accountAfter]);
  assert.doesNotMatch(
    serializedRecovery,
    /providerCostCents|risk_fingerprint|pricing_snapshot|included_mcp_trial|private-provider|203\.0\.113\.42|Codex\/1\.0/iu,
  );

  await t.test('audio on/off and every allowed ratio keep the immutable preset and official cost', async () => {
    for (const aspectRatio of ['16:9', '9:16', '1:1']) {
      const providerCosts = new Set<number>();
      for (const audio of [false, true]) {
        const variantIdentity: AgentPrincipal = {
          userId: `t9-variant-${aspectRatio.replace(':', '-')}-${audio ? 'audio' : 'silent'}`,
          clientId: `t9-variant-client-${aspectRatio.replace(':', '-')}-${audio ? 'audio' : 'silent'}`,
          emailVerified: true,
          authMethod: 'oauth',
        };
        const variantSession = await connectTrial(
          variantIdentity,
          trialServices(postgres.pool, provider),
        );
        try {
          const variant = await prepareTrial(variantSession.client, { aspectRatio, audio });
          assert.deepEqual(variant.value.summary, {
            schemaVersion: 1,
            surface: 'video', engineId: 'seedance-2-0-mini', mode: 't2v',
            prompt: 'A private T9 paper-lantern prompt',
            settings: { aspectRatio, audio, durationSec: 5, resolution: '480p' },
            references: [], outputCount: 1,
          });
          const variantQuote = (await postgres.pool.query<{
            pricing_snapshot: Record<string, unknown>;
          }>(`SELECT pricing_snapshot FROM mcp_generation_quotes WHERE quote_id = $1`, [
            String(variant.value.quoteId),
          ])).rows[0];
          assert.ok(variantQuote);
          const providerCost = Number(
            (variantQuote.pricing_snapshot.funding as Record<string, unknown>).providerCostCents,
          );
          providerCosts.add(providerCost);
          assert.equal(providerCost, aspectRatio === '1:1' ? 10 : 17);
          assert.equal(JSON.stringify(variant.result).includes('providerCostCents'), false);
        } finally {
          await variantSession.close();
        }
      }
      assert.equal(providerCosts.size, 1, `audio changed ${aspectRatio} provider cost`);
    }
  });

  await t.test('one account can reserve only one of two concurrent trial quotes', async () => {
    const raceIdentity: AgentPrincipal = {
      userId: 't9-concurrency-user', clientId: 't9-concurrency-client',
      emailVerified: true, authMethod: 'oauth',
    };
    const raceSession = await connectTrial(raceIdentity, trialServices(postgres.pool, provider));
    try {
      const first = await prepareTrial(raceSession.client, { aspectRatio: '16:9', audio: true });
      const second = await prepareTrial(raceSession.client, { aspectRatio: '9:16', audio: false });
      const quoteIds = [String(first.value.quoteId), String(second.value.quoteId)];
      const results = await Promise.all(quoteIds.map((quoteId) => confirmTrial(raceSession.client, quoteId)));
      assert.equal(results.filter((result) => result.isError !== true).length, 1);
      const rejected = results.find((result) => result.isError === true);
      assert.ok(rejected);
      assert.equal(errorCode(rejected), 'TRIAL_NOT_ELIGIBLE');
      assert.equal(quoteIds.reduce((count, quoteId) => count + provider.calls(quoteId), 0), 1);
      const persisted = (await postgres.pool.query<{
        jobs: string; receipts: string; reserved: string;
      }>(`SELECT
          (SELECT count(*) FROM app_jobs WHERE user_id = $1)::text AS jobs,
          (SELECT count(*) FROM app_receipts WHERE user_id = $1)::text AS receipts,
          (SELECT count(*) FROM mcp_trial_entitlements
             WHERE user_id = $1 AND status = 'reserved')::text AS reserved`,
      [raceIdentity.userId])).rows[0];
      assert.deepEqual(persisted, { jobs: '1', receipts: '0', reserved: '1' });
    } finally {
      await raceSession.close();
    }
  });

  await t.test('definitive provider rejection releases once and a fresh trial quote can retry', async () => {
    const retryIdentity: AgentPrincipal = {
      userId: 't9-retry-user', clientId: 't9-retry-client',
      emailVerified: true, authMethod: 'oauth',
    };
    const retrySession = await connectTrial(retryIdentity, trialServices(postgres.pool, provider));
    try {
      const rejectedQuote = await prepareTrial(
        retrySession.client,
        { aspectRatio: '16:9', audio: false },
      );
      const rejectedQuoteId = String(rejectedQuote.value.quoteId);
      provider.plans.set(rejectedQuoteId, 'rejected');
      const rejected = await confirmTrial(retrySession.client, rejectedQuoteId);
      assert.notEqual(rejected.isError, true, JSON.stringify(rejected.structuredContent));
      assert.equal(structured(rejected).status, 'failed');
      assert.equal(structured(rejected).entitlementState, 'released');
      assert.equal(provider.calls(rejectedQuoteId), 1);
      const retryQuote = await prepareTrial(
        retrySession.client,
        { aspectRatio: '1:1', audio: true },
      );
      assert.equal(retryQuote.value.fundingMode, 'trial');
      const retryQuoteId = String(retryQuote.value.quoteId);
      const retry = await confirmTrial(retrySession.client, retryQuoteId);
      assert.notEqual(retry.isError, true, JSON.stringify(retry.structuredContent));
      assert.equal(structured(retry).entitlementState, 'reserved');
      assert.equal(provider.calls(retryQuoteId), 1);
      assert.equal((await postgres.pool.query(
        `SELECT count(*)::text AS count FROM app_receipts WHERE user_id = $1`,
        [retryIdentity.userId],
      )).rows[0]?.count, '0');
    } finally {
      await retrySession.close();
    }
  });

  await t.test('ambiguous provider timeout remains reserved for reconciliation', async () => {
    const timeoutIdentity: AgentPrincipal = {
      userId: 't9-timeout-user', clientId: 't9-timeout-client',
      emailVerified: true, authMethod: 'oauth',
    };
    const timeoutSession = await connectTrial(timeoutIdentity, trialServices(postgres.pool, provider));
    try {
      const preparedTimeout = await prepareTrial(
        timeoutSession.client,
        { aspectRatio: '9:16', audio: true },
      );
      const timeoutQuoteId = String(preparedTimeout.value.quoteId);
      provider.plans.set(timeoutQuoteId, 'ambiguous');
      const timeout = await confirmTrial(timeoutSession.client, timeoutQuoteId);
      assert.notEqual(timeout.isError, true, JSON.stringify(timeout.structuredContent));
      assert.equal(structured(timeout).entitlementState, 'reserved');
      assert.deepEqual(await applyTrialJobOutcome(timeoutQuoteId, { kind: 'timeout' }), {
        funding: 'included_trial', entitlementState: 'reserved',
      });
      const state = (await postgres.pool.query<{
        entitlement_state: string; disposition: string;
      }>(`SELECT entitlement.status AS entitlement_state,
                job.mcp_trial_outcome_disposition AS disposition
           FROM mcp_trial_entitlements entitlement
           JOIN app_jobs job ON job.job_id = entitlement.job_id
          WHERE entitlement.user_id = $1`, [timeoutIdentity.userId])).rows[0];
      assert.deepEqual(state, { entitlement_state: 'reserved', disposition: 'timeout' });
    } finally {
      await timeoutSession.close();
    }
  });

  await t.test('kill switch and consumed entitlement prepare paid fallback without auto-spend', async () => {
    const consumedFallback = await prepareTrial(
      session.client,
      { aspectRatio: '16:9', audio: true },
    );
    assert.equal(consumedFallback.value.fundingMode, 'wallet');
    assert.ok(Number((consumedFallback.value.price as Record<string, unknown>).amountCents) > 0);
    const mainCharges = (await postgres.pool.query(
      `SELECT count(*)::text AS count FROM app_receipts
        WHERE user_id = $1 AND type IN ('charge', 'refund')`,
      [identity.userId],
    )).rows[0]?.count;
    assert.equal(mainCharges, '0');

    const disabledIdentity: AgentPrincipal = {
      userId: 't9-kill-switch-user', clientId: 't9-kill-switch-client',
      emailVerified: true, authMethod: 'oauth',
    };
    const disabledSession = await connectTrial(
      disabledIdentity,
      trialServices(postgres.pool, provider, false),
    );
    try {
      const disabledAccount = await disabledSession.client.callTool({
        name: 'get_account_status', arguments: {},
      }) as CallToolResult;
      assert.equal(
        (structured(disabledAccount).trial as Record<string, unknown>).status,
        'disabled',
      );
      const paidFallback = await prepareTrial(
        disabledSession.client,
        { aspectRatio: '1:1', audio: false },
      );
      assert.equal(paidFallback.value.fundingMode, 'wallet');
      assert.ok(Number((paidFallback.value.price as Record<string, unknown>).amountCents) > 0);
      assert.equal((await postgres.pool.query(
        `SELECT count(*)::text AS count FROM app_receipts WHERE user_id = $1`,
        [disabledIdentity.userId],
      )).rows[0]?.count, '0');
    } finally {
      await disabledSession.close();
    }
  });

  const publication = JSON.parse(
    readFileSync('frontend/config/mcp-publication.json', 'utf8'),
  ) as Record<string, unknown>;
  assert.equal(Object.keys(publication).length, 8);
  assert.ok(Object.values(publication).every((value) => value === false));
});
