import assert from 'node:assert/strict';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Pool } from 'pg';

import { getFalEngineById } from '../../frontend/src/config/falEngines';
import { applyEngineVariantPricing, buildEngineAddonInput } from '../../frontend/src/lib/pricing-addons';
import { getAgentAccountStatus } from '../../frontend/src/server/agent-api/account-status';
import { createConfirmGenerationService } from '../../frontend/src/server/agent-api/confirm-generation';
import { getAgentGenerationStatus, listAgentRecentGenerations } from '../../frontend/src/server/agent-api/generation-status';
import { normalizeGenerationRequest } from '../../frontend/src/server/agent-api/generation-normalization';
import { priceCanonicalGeneration } from '../../frontend/src/server/agent-api/generation-pricing';
import { listAgentModels, type AgentPublicGenerationEngine } from '../../frontend/src/server/agent-api/model-catalog';
import { recommendAgentModels } from '../../frontend/src/server/agent-api/model-recommendations';
import {
  submitReservedPaidGeneration,
  type PaidGenerationExecution,
  type PaidGenerationProviderOutcome,
} from '../../frontend/src/server/agent-api/paid-generation-execution';
import { createPrepareGenerationService } from '../../frontend/src/server/agent-api/prepare-generation';
import type { AgentPrincipal } from '../../frontend/src/server/agent-api/principal';
import { createMcpTopupHandoffService } from '../../frontend/src/server/agent-api/topup-handoff';
import { paidProviderSubmissionDependencies } from '../../frontend/src/server/generations/paid-provider-execution';
import { getUserMembershipStatus } from '../../frontend/src/server/membership/user-membership-status';
import { createMaxVideoAiMcpServer, type MaxVideoAiMcpServices } from '../../frontend/src/server/mcp/server';
import { getWalletSummary } from '../../frontend/src/server/wallet-summary';
import { estimateImageGeneration } from '../../frontend/src/server/images/estimate-image-generation';
import { computeCanonicalPublicSnapshot } from '../../frontend/server/pricing/quote-public';

export const TOPUP_SECRET = 'p11-local-topup-secret-0123456789abcdef';

function candidate(engineId: 'gpt-image-2' | 'seedance-2-0-mini'): AgentPublicGenerationEngine {
  const entry = getFalEngineById(engineId);
  assert.ok(entry, `missing real catalog fixture ${engineId}`);
  const surface = entry.category;
  assert.ok(surface === 'image' || surface === 'video');
  const publicModes = entry.modes
    .map((mode) => mode.mode)
    .filter((mode): mode is 't2v' | 'i2v' | 'ref2v' | 't2i' | 'i2i' =>
      ['t2v', 'i2v', 'ref2v', 't2i', 'i2i'].includes(mode));
  const modeCaps = Object.fromEntries(
    entry.modes.flatMap((mode) => publicModes.includes(mode.mode as never) ? [[mode.mode, mode.ui]] : []),
  ) as AgentPublicGenerationEngine['modeCaps'];
  return { engine: entry.engine, surface, publicModes, modeCaps };
}

const catalog = [candidate('gpt-image-2'), candidate('seedance-2-0-mini')];
const catalogDeps = {
  async listEngines() { return catalog.map((entry) => entry.engine); },
  surfaceByEngineId(engineId: string) {
    return catalog.find((entry) => entry.engine.id === engineId)?.surface ?? null;
  },
};

export async function sharedWebPrice(
  request: Parameters<typeof priceCanonicalGeneration>[0],
  tier: Parameters<typeof priceCanonicalGeneration>[1],
) {
  return priceCanonicalGeneration(request, tier, {
    estimateImage: estimateImageGeneration,
    async computeVideoPreflight(input) {
      const selected = catalog.find((entry) => entry.engine.id === input.engine);
      assert.ok(selected && selected.surface === 'video');
      const engine = applyEngineVariantPricing(selected.engine, input.mode);
      const pricing = await computeCanonicalPublicSnapshot({
        engine,
        durationSec: input.durationSec,
        resolution: input.resolution,
        aspectRatio: input.aspectRatio,
        mode: input.mode,
        membershipTier: input.user?.memberTier,
        addons: buildEngineAddonInput(engine, { audioEnabled: input.audio }),
      });
      return { ok: true, total: pricing.totalCents, currency: pricing.currency, pricing };
    },
  });
}

export function principal(userId: string, clientId = `${userId}-oauth-client`): AgentPrincipal {
  return { userId, clientId, emailVerified: true, authMethod: 'oauth' };
}

export function createServices(options: {
  submitPaidGeneration?: (execution: PaidGenerationExecution) => Promise<PaidGenerationProviderOutcome>;
  prepareNow?: () => Date;
} = {}): MaxVideoAiMcpServices {
  return {
    getAccountStatus: (identity) => getAgentAccountStatus(identity, {
      getWalletSummary,
      accountUrl: 'https://maxvideoai.com/account/connections',
    }),
    listModels: (filter) => listAgentModels(filter, catalogDeps),
    recommendModels: (input) => recommendAgentModels(input, catalogDeps),
    prepareGeneration: createPrepareGenerationService(
      'https://maxvideoai.com/account/connections',
      { clientIp: null, userAgent: null },
      {
        paidGenerationEnabled: () => true,
        listPublicEngines: async () => catalog,
        ...(options.prepareNow ? { now: options.prepareNow } : {}),
      },
    ),
    confirmGeneration: createConfirmGenerationService(
      'https://maxvideoai.com/account/connections',
      { clientIp: null, userAgent: null },
      {
        paidGenerationEnabled: () => true,
        listPublicEngines: async () => catalog,
        submitPaidGeneration: options.submitPaidGeneration ?? (async () => ({ kind: 'accepted' })),
      },
    ),
    getGenerationStatus: (input, identity) => getAgentGenerationStatus(input, identity),
    listRecentGenerations: (input, identity) => listAgentRecentGenerations(input, identity),
    createTopupLink: createMcpTopupHandoffService({
      secret: TOPUP_SECRET,
      billingBaseUrl: 'https://maxvideoai.com',
    }),
  };
}

type ProviderPlan = 'image_complete' | 'video_accept' | 'reject' | 'ambiguous' | 'blocked_accept';
export type ProviderCapture = {
  quoteId: string;
  surface: 'video' | 'image';
  body: Record<string, unknown>;
  options: Record<string, unknown>;
};

export class ProviderHarness {
  readonly captures: ProviderCapture[] = [];
  readonly plans = new Map<string, ProviderPlan>();
  private readonly blockers = new Map<string, {
    started: Promise<void>;
    signalStarted(): void;
    release: Promise<void>;
    signalRelease(): void;
  }>();

  constructor(private readonly pool: Pool) {}

  block(quoteId: string) {
    let signalStarted!: () => void;
    let signalRelease!: () => void;
    const blocker = {
      started: new Promise<void>((resolve) => { signalStarted = resolve; }),
      signalStarted: () => signalStarted(),
      release: new Promise<void>((resolve) => { signalRelease = resolve; }),
      signalRelease: () => signalRelease(),
    };
    this.blockers.set(quoteId, blocker);
    this.plans.set(quoteId, 'blocked_accept');
    return blocker;
  }

  calls(quoteId: string): number {
    return this.captures.filter((capture) => capture.quoteId === quoteId).length;
  }

  submit = async (execution: PaidGenerationExecution): Promise<PaidGenerationProviderOutcome> =>
    submitReservedPaidGeneration(execution, {
      executeVideo: async (options) => {
        this.captures.push({
          quoteId: execution.quoteId,
          surface: 'video',
          body: options.body,
          options: options as unknown as Record<string, unknown>,
        });
        const plan = this.plans.get(execution.quoteId) ?? 'video_accept';
        if (plan === 'reject') return { status: 400, body: { ok: false } };
        if (plan === 'ambiguous') return { status: 503, body: { ok: false } };
        if (plan === 'blocked_accept') {
          const blocker = this.blockers.get(execution.quoteId);
          assert.ok(blocker);
          blocker.signalStarted();
          await blocker.release;
        }
        await this.pool.query(
          `UPDATE app_jobs
              SET status = 'accepted', progress = 0, provider_job_id = $2,
                  provisional = false, updated_at = clock_timestamp()
            WHERE job_id = $1`,
          [execution.quoteId, `private-provider-${execution.quoteId}`],
        );
        return { status: 202, body: { ok: true, jobId: execution.quoteId } };
      },
      executeImage: async (options) => {
        this.captures.push({
          quoteId: execution.quoteId,
          surface: 'image',
          body: options.body,
          options: options as unknown as Record<string, unknown>,
        });
        const plan = this.plans.get(execution.quoteId) ?? 'image_complete';
        if (plan === 'reject') return { ok: false, paymentStatus: 'refunded_wallet' };
        if (plan === 'ambiguous') return { ok: false };
        const imageUrl = `https://cdn.maxvideoai.com/p11/${execution.quoteId}.png`;
        await this.pool.query(
          `UPDATE app_jobs
              SET status = 'completed', progress = 100,
                  render_ids = $2::jsonb, hero_render_id = $3,
                  thumb_url = $3, provisional = false, updated_at = clock_timestamp()
            WHERE job_id = $1`,
          [execution.quoteId, JSON.stringify([{ url: imageUrl, thumb_url: imageUrl }]), imageUrl],
        );
        return { ok: true };
      },
      ensureKnownRejectionRefund: paidProviderSubmissionDependencies.ensureKnownRejectionRefund,
    });
}

export async function connect(identity: AgentPrincipal, services = createServices(), paidGeneration = true) {
  const server = createMaxVideoAiMcpServer(identity, services, { paidGeneration });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: `p11-${identity.userId}`, version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    server,
    async close() { await Promise.allSettled([client.close(), server.close()]); },
  };
}

export function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

export function structured(result: CallToolResult): Record<string, unknown> {
  return record(result.structuredContent);
}

export function errorCode(result: CallToolResult): string {
  assert.equal(result.isError, true);
  return String(record(structured(result).error).code);
}

export async function callPrepared(client: Client, input: Record<string, unknown>) {
  const result = await client.callTool({ name: 'prepare_generation', arguments: input });
  assert.notEqual(result.isError, true, JSON.stringify(result.structuredContent));
  return structured(result);
}

export async function callConfirmed(client: Client, quoteId: string): Promise<CallToolResult> {
  return client.callTool({
    name: 'confirm_generation',
    arguments: { quoteId, confirmed: true },
  }) as Promise<CallToolResult>;
}

export function assertRecoverySafe(
  result: CallToolResult,
  forbidden: ReadonlyArray<string | null | undefined>,
): void {
  const serialized = JSON.stringify(result);
  for (const secret of forbidden) {
    if (secret) assert.equal(serialized.includes(secret), false, `serialized recovery leaked ${secret}`);
  }
  assert.doesNotMatch(
    serialized,
    /provider_job_id|providerJobId|pricing_snapshot|settings_snapshot|stripe_|"prompt"\s*:|"references"\s*:/iu,
  );
}

export async function addTopup(pool: Pool, userId: string, amountCents: number): Promise<void> {
  await pool.query(
    `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description)
     VALUES ($1, 'topup', $2, 'USD', 'P11 deterministic local funding fixture')`,
    [userId, amountCents],
  );
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export type PreparedPriceParity = {
  amountCents: number;
  currency: string;
  membershipTier: 'member' | 'plus' | 'pro';
  canonicalPricing: Record<string, unknown>;
  quotePricingSnapshot: Record<string, unknown>;
  settingsSnapshot: Record<string, unknown>;
};

export async function capturePreparedPriceParity(params: {
  pool: Pool;
  userId: string;
  quoteId: string;
  input: Record<string, unknown>;
  prepared: Record<string, unknown>;
}): Promise<PreparedPriceParity> {
  const canonical = normalizeGenerationRequest(params.input);
  const membership = (await getUserMembershipStatus(params.userId)).pricing;
  const web = await sharedWebPrice(canonical, membership.tier);
  const rows = await params.pool.query<{
    price_cents: number;
    currency: string;
    pricing_snapshot: Record<string, unknown>;
    request_json: Record<string, unknown>;
  }>(`SELECT price_cents, currency, pricing_snapshot, request_json
        FROM mcp_generation_quotes WHERE quote_id = $1`, [params.quoteId]);
  const quote = rows.rows[0];
  assert.ok(quote);
  assert.equal(record(params.prepared.price).amountCents, web.priceCents);
  assert.equal(record(params.prepared.price).currency, web.currency);
  assert.equal(quote.price_cents, web.priceCents);
  assert.equal(quote.currency, web.currency);
  const quotePricingSnapshot = record(quote.pricing_snapshot);
  const canonicalPricing = record(quotePricingSnapshot.canonicalPricing);
  assert.deepEqual(quotePricingSnapshot.membership, membership);
  assert.deepEqual(canonicalPricing, JSON.parse(JSON.stringify(web.pricingSnapshot)));
  assert.equal(canonicalPricing.membershipTier, membership.tier);
  assert.deepEqual(quote.request_json, canonical);
  return {
    amountCents: web.priceCents,
    currency: web.currency,
    membershipTier: membership.tier,
    canonicalPricing: cloneRecord(canonicalPricing),
    quotePricingSnapshot: cloneRecord(quotePricingSnapshot),
    settingsSnapshot: cloneRecord(canonical),
  };
}

export async function assertPersistedPriceParity(
  pool: Pool,
  quoteId: string,
  proof: PreparedPriceParity,
): Promise<void> {
  const rows = await pool.query<{
    price_cents: number; quote_currency: string; quote_pricing: Record<string, unknown>;
    request_json: Record<string, unknown>; amount_cents: number; receipt_currency: string;
    receipt_pricing: Record<string, unknown>; final_price_cents: number; job_currency: string;
    job_pricing: Record<string, unknown>; settings_snapshot: Record<string, unknown>;
  }>(`
    SELECT q.price_cents, q.currency AS quote_currency,
           q.pricing_snapshot AS quote_pricing, q.request_json,
           r.amount_cents, r.currency AS receipt_currency,
           r.pricing_snapshot AS receipt_pricing,
           j.final_price_cents, j.currency AS job_currency,
           j.pricing_snapshot AS job_pricing, j.settings_snapshot
      FROM mcp_generation_quotes q
      JOIN app_receipts r ON r.job_id = q.job_id AND r.type = 'charge'
      JOIN app_jobs j ON j.job_id = q.job_id
     WHERE q.quote_id = $1`, [quoteId]);
  const persisted = rows.rows[0];
  assert.ok(persisted);
  assert.equal(persisted.price_cents, proof.amountCents);
  assert.equal(persisted.amount_cents, proof.amountCents);
  assert.equal(persisted.final_price_cents, proof.amountCents);
  assert.equal(persisted.quote_currency, proof.currency);
  assert.equal(persisted.receipt_currency, proof.currency);
  assert.equal(persisted.job_currency, proof.currency);
  assert.deepEqual(persisted.quote_pricing, proof.quotePricingSnapshot);
  assert.deepEqual(persisted.request_json, proof.settingsSnapshot);
  assert.deepEqual(persisted.receipt_pricing, proof.canonicalPricing);
  assert.deepEqual(persisted.job_pricing, proof.canonicalPricing);
  assert.deepEqual(persisted.settings_snapshot, proof.settingsSnapshot);
  assert.equal(record(persisted.receipt_pricing).membershipTier, proof.membershipTier);
  assert.equal(record(persisted.job_pricing).membershipTier, proof.membershipTier);
}

type ExpectedLedgerComponent = { amountCents: number; count: number };

export async function assertWalletParity(params: {
  client: Client;
  pool: Pool;
  userId: string;
  expected: {
    topups: ExpectedLedgerComponent;
    charges: ExpectedLedgerComponent;
    refunds: ExpectedLedgerComponent;
  };
}): Promise<void> {
  const status = await params.client.callTool({ name: 'get_account_status', arguments: {} });
  assert.notEqual(status.isError, true, JSON.stringify(status.structuredContent));
  const wallet = record(structured(status as CallToolResult).wallet);
  const [topups, charges, refunds] = await Promise.all([
    params.pool.query<{ amount_cents: string; count: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS amount_cents, COUNT(*)::text AS count
         FROM app_receipts WHERE user_id = $1 AND type = 'topup'`, [params.userId],
    ),
    params.pool.query<{ amount_cents: string; count: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS amount_cents, COUNT(*)::text AS count
         FROM app_receipts WHERE user_id = $1 AND type = 'charge'`, [params.userId],
    ),
    params.pool.query<{ amount_cents: string; count: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS amount_cents, COUNT(*)::text AS count
         FROM app_receipts WHERE user_id = $1 AND type = 'refund'`, [params.userId],
    ),
  ]);
  const actual = {
    topups: { amountCents: Number(topups.rows[0]?.amount_cents), count: Number(topups.rows[0]?.count) },
    charges: { amountCents: Number(charges.rows[0]?.amount_cents), count: Number(charges.rows[0]?.count) },
    refunds: { amountCents: Number(refunds.rows[0]?.amount_cents), count: Number(refunds.rows[0]?.count) },
  };
  assert.deepEqual(actual, params.expected);
  assert.equal(
    wallet.amountCents,
    actual.topups.amountCents + actual.refunds.amountCents - actual.charges.amountCents,
  );
  assert.equal(wallet.currency, 'USD');
  assert.equal(wallet.pendingCents, 0);
}

export async function assertOAuthQuoteMutationScope(params: {
  sameUserOtherClient: Client;
  wrongUser: Client;
  quoteId: string;
  forbidden: ReadonlyArray<string | null | undefined>;
}): Promise<void> {
  for (const quoteNonOwner of [params.sameUserOtherClient, params.wrongUser]) {
    const confirmation = await callConfirmed(quoteNonOwner, params.quoteId);
    assert.equal(errorCode(confirmation), 'QUOTE_EXPIRED');
    const topup = await quoteNonOwner.callTool({
      name: 'create_topup_link', arguments: { quoteId: params.quoteId },
    }) as CallToolResult;
    assert.equal(errorCode(topup), 'QUOTE_EXPIRED');
    assertRecoverySafe(confirmation, params.forbidden);
    assertRecoverySafe(topup, params.forbidden);
  }
}

export async function assertOAuthRecoveryScope(params: {
  sameUserOtherClient: Client;
  wrongUser: Client;
  jobId: string;
  forbidden: ReadonlyArray<string | null | undefined>;
}): Promise<void> {
  const crossClientStatus = await params.sameUserOtherClient.callTool({
    name: 'get_generation_status', arguments: { jobId: params.jobId },
  }) as CallToolResult;
  assert.equal(structured(crossClientStatus).status, 'completed');
  const crossClientRecent = await params.sameUserOtherClient.callTool({
    name: 'list_recent_generations', arguments: { limit: 20 },
  }) as CallToolResult;
  assert.ok((structured(crossClientRecent).items as unknown[])
    .some((item) => record(item).jobId === params.jobId));
  const wrongStatus = await params.wrongUser.callTool({
    name: 'get_generation_status', arguments: { jobId: params.jobId },
  }) as CallToolResult;
  assert.equal(errorCode(wrongStatus), 'JOB_FAILED');
  const wrongRecent = await params.wrongUser.callTool({
    name: 'list_recent_generations', arguments: { limit: 20 },
  }) as CallToolResult;
  assert.deepEqual(structured(wrongRecent).items, []);
  for (const result of [crossClientStatus, crossClientRecent, wrongStatus, wrongRecent]) {
    assertRecoverySafe(result, params.forbidden);
  }
}
