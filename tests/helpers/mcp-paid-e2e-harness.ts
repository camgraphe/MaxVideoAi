import assert from 'node:assert/strict';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Pool } from 'pg';

import { getFalEngineById } from '../../frontend/src/config/falEngines';
import { applyEngineVariantPricing, buildEngineAddonInput } from '../../frontend/src/lib/pricing-addons';
import { getActiveAccountRestriction } from '../../frontend/src/server/fraud-cleanup';
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
import { createMaxVideoAiMcpServer, type MaxVideoAiMcpServices } from '../../frontend/src/server/mcp/server';
import { getWalletSummary } from '../../frontend/src/server/wallet-summary';
import { estimateImageGeneration } from '../../frontend/src/server/images/estimate-image-generation';
import { computeCanonicalPublicSnapshot } from '../../frontend/server/pricing/quote-public';

export const TOPUP_SECRET = 'p11-local-topup-secret-0123456789abcdef';
const membership = {
  tier: 'member' as const,
  source: 'app_receipts_rolling_30d' as const,
  spent30Cents: 0,
  thresholdCents: 0,
  discountPercent: 0,
};

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
    prepareGeneration: createPrepareGenerationService('https://maxvideoai.com/account/connections', {
      paidGenerationEnabled: () => true,
      getAccountRestriction: getActiveAccountRestriction,
      listPublicEngines: async () => catalog,
      resolveMembershipPricing: async () => membership,
      priceGeneration: sharedWebPrice,
      ...(options.prepareNow ? { now: options.prepareNow } : {}),
    }),
    confirmGeneration: createConfirmGenerationService('https://maxvideoai.com/account/connections', {
      paidGenerationEnabled: () => true,
      listPublicEngines: async () => catalog,
      resolveMembershipPricing: async () => membership,
      priceGeneration: sharedWebPrice,
      submitPaidGeneration: options.submitPaidGeneration ?? (async () => ({ kind: 'accepted' })),
    }),
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

export async function ledger(pool: Pool, userId: string) {
  const rows = await pool.query<{ topups: string; charges: string; refunds: string; balance: string }>(`
    SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE type = 'topup'), 0)::text AS topups,
      COALESCE(SUM(amount_cents) FILTER (WHERE type = 'charge'), 0)::text AS charges,
      COALESCE(SUM(amount_cents) FILTER (WHERE type = 'refund'), 0)::text AS refunds,
      COALESCE(SUM(CASE
        WHEN type IN ('topup', 'refund') THEN amount_cents
        WHEN type = 'charge' THEN -amount_cents
        ELSE 0 END), 0)::text AS balance
      FROM app_receipts
     WHERE user_id = $1`, [userId]);
  const value = rows.rows[0];
  assert.ok(value);
  assert.equal(Number(value.balance), Number(value.topups) + Number(value.refunds) - Number(value.charges));
  return value;
}

export async function assertPriceParity(params: {
  pool: Pool;
  quoteId: string;
  input: Record<string, unknown>;
  prepared: Record<string, unknown>;
}): Promise<number> {
  const web = await sharedWebPrice(normalizeGenerationRequest(params.input), 'member');
  const rows = await params.pool.query<{
    price_cents: number;
    currency: string;
    pricing_snapshot: Record<string, unknown>;
  }>('SELECT price_cents, currency, pricing_snapshot FROM mcp_generation_quotes WHERE quote_id = $1', [params.quoteId]);
  const quote = rows.rows[0];
  assert.ok(quote);
  assert.equal(record(params.prepared.price).amountCents, web.priceCents);
  assert.equal(quote.price_cents, web.priceCents);
  assert.equal(quote.currency, web.currency);
  assert.deepEqual(
    record(quote.pricing_snapshot).canonicalPricing,
    JSON.parse(JSON.stringify(web.pricingSnapshot)),
  );
  return web.priceCents;
}
