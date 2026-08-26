import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { Client, Pool } from 'pg';

import {
  createInitialVideoJobInExecutor,
} from '../frontend/app/api/generate/_lib/initial-video-job';
import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { computeGenerationCatalogRevision } from '../frontend/src/server/agent-api/catalog-revision';
import {
  confirmGeneration,
  type ConfirmGenerationDependencies,
} from '../frontend/src/server/agent-api/confirm-generation';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import { hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import { reservePaidGenerationInitialJob } from '../frontend/src/server/agent-api/paid-generation-execution';
import {
  claimPreparedQuote,
  insertPreparedQuote,
  lockOwnedQuote,
  markQuoteAccepted,
  markQuoteExpired,
  markQuoteFailed,
} from '../frontend/src/server/agent-api/quote-repository';
import { checkMcpConfirmationSpendingLimits } from '../frontend/src/server/agent-api/spending-limits';
import { getGenerationStatus } from '../frontend/src/server/generations/generation-status';
import { createInitialImageJobInExecutor } from '../frontend/src/server/images/image-initial-job';
import type { EngineCaps, EngineModeUiCaps } from '../frontend/types/engines';

const root = process.cwd();
const migrationPath = join(root, 'neon/migrations/30_mcp_paid_generation.sql');

function commandExists(command: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
}

function commandFailure(result: ReturnType<typeof spawnSync>): string {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

function capability(request: CanonicalGenerationRequest): AgentPublicGenerationEngine {
  const video = request.surface === 'video';
  const modeCaps: EngineModeUiCaps = {
    modes: [request.mode],
    ...(video ? { duration: { options: [5], default: 5 }, fps: [24], audioToggle: true } : {}),
    resolution: video ? ['720p'] : ['1024x1024'],
    aspectRatio: video ? ['16:9'] : ['1:1'],
  };
  const engine: EngineCaps = {
    id: request.engineId,
    label: video ? 'Test Video' : 'Test Image',
    provider: 'test',
    status: 'live',
    latencyTier: 'standard',
    modes: [request.mode],
    maxDurationSec: video ? 5 : 0,
    resolutions: (video ? ['720p'] : ['1024x1024']) as EngineCaps['resolutions'],
    aspectRatios: (video ? ['16:9'] : ['1:1']) as EngineCaps['aspectRatios'],
    fps: video ? [24] : [1],
    audio: video,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: { promptMaxChars: 12_000 },
    inputSchema: {
      required: [{ id: 'prompt', type: 'text', label: 'Prompt' }],
      optional: video
        ? [
            { id: 'duration', type: 'enum', label: 'Duration', values: ['5'] },
            { id: 'resolution', type: 'enum', label: 'Resolution', values: ['720p'] },
            { id: 'aspect_ratio', type: 'enum', label: 'Ratio', values: ['16:9'] },
            { id: 'generate_audio', type: 'boolean', label: 'Audio' },
          ]
        : [
            { id: 'resolution', type: 'enum', label: 'Resolution', values: ['1024x1024'] },
            { id: 'aspect_ratio', type: 'enum', label: 'Ratio', values: ['1:1'] },
            { id: 'quality', type: 'enum', label: 'Quality', values: ['high'] },
          ],
    },
    updatedAt: '2026-07-16T00:00:00.000Z',
    ttlSec: 600,
    availability: 'available',
    modeCaps: { [request.mode]: modeCaps },
  };
  return { engine, surface: request.surface, publicModes: [request.mode], modeCaps: { [request.mode]: modeCaps } };
}

function requestFor(surface: 'video' | 'image', suffix: string): CanonicalGenerationRequest {
  return surface === 'video'
    ? {
        schemaVersion: 1,
        surface,
        engineId: `test-video-${suffix}`,
        mode: 't2v',
        prompt: `private video prompt ${suffix}`,
        settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9', audio: true },
        references: [],
        outputCount: 1,
      }
    : {
        schemaVersion: 1,
        surface,
        engineId: `test-image-${suffix}`,
        mode: 't2i',
        prompt: `private image prompt ${suffix}`,
        settings: { resolution: '1024x1024', aspectRatio: '1:1', quality: 'high' },
        references: [],
        outputCount: 1,
      };
}

const membership = {
  tier: 'member' as const,
  source: 'app_receipts_rolling_30d' as const,
  spent30Cents: 0,
  thresholdCents: 0,
  discountPercent: 0,
};

function pricingSnapshot(request: CanonicalGenerationRequest, priceCents: number, catalogRevision: string) {
  return {
    schemaVersion: 1,
    catalogRevision,
    surface: request.surface,
    engineId: request.engineId,
    membership,
    canonicalPricing: {
      totalCents: priceCents,
      currency: 'USD',
      membershipTier: 'member',
      platformRevenueCents: 10,
      provenance: { source: 'canonical-pg-test' },
    },
  };
}

function asExecutor(client: { query: Client['query'] }): TransactionQueryExecutor {
  return {
    async query<TRecord>(sql: string, params?: ReadonlyArray<unknown>) {
      return (await client.query<TRecord>(sql, params as unknown[] | undefined)).rows;
    },
  } as TransactionQueryExecutor;
}

function transactionRunner(pool: Pool) {
  return async <TResult>(callback: (executor: TransactionQueryExecutor) => Promise<TResult>): Promise<TResult> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(asExecutor(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  };
}

function confirmationDependencies(params: {
  pool: Pool;
  request: CanonicalGenerationRequest;
  priceCents: number;
  provider?: () => Promise<{ kind: 'accepted' }>;
}): ConfirmGenerationDependencies {
  const candidate = capability(params.request);
  const catalogRevision = computeGenerationCatalogRevision([candidate]);
  const storedPricing = pricingSnapshot(params.request, params.priceCents, catalogRevision);
  const queryRows = async <TRecord>(sql: string, values?: ReadonlyArray<unknown>) =>
    (await params.pool.query<TRecord>(sql, values as unknown[] | undefined)).rows;
  return {
    paidGenerationEnabled: () => true,
    withTransaction: transactionRunner(params.pool),
    lockOwnedQuote,
    markQuoteExpired,
    getAccountRestriction: async () => null,
    listPublicEngines: async () => [candidate],
    resolveMembershipPricing: async () => membership,
    priceGeneration: async () => ({
      priceCents: params.priceCents,
      currency: 'USD',
      membershipTier: 'member',
      pricingSnapshot: storedPricing.canonicalPricing,
    }),
    checkSpendingLimits: checkMcpConfirmationSpendingLimits,
    reserveInitialJob: async ({ quote }, { executor }) => {
      const common = {
        jobId: quote.quoteId,
        userId: quote.userId,
        engineId: quote.request.engineId,
        engineLabel: candidate.engine.label,
        durationSec: quote.request.surface === 'video' ? 5 : 0,
        prompt: quote.request.prompt,
        aspectRatio: String(quote.request.settings.aspectRatio),
        canUpscale: false,
        finalPriceCents: quote.priceCents,
        pricingSnapshotJson: JSON.stringify(storedPricing.canonicalPricing),
        costBreakdownJson: null,
        settingsSnapshotJson: JSON.stringify({ schemaVersion: 1, surface: quote.request.surface }),
        visibility: 'private' as const,
        indexable: false,
      };
      if (quote.request.surface === 'video') {
        const state = await createInitialVideoJobInExecutor(executor, {
          jobId: quote.quoteId,
          userId: quote.userId,
          paymentMode: 'wallet',
          walletReservation: 'reserve',
          funding: { kind: 'wallet', reservation: 'reserve' },
          pendingReceipt: {
            userId: quote.userId,
            amountCents: quote.priceCents,
            currency: quote.currency,
            description: 'MCP video generation',
            jobId: quote.quoteId,
            snapshot: storedPricing.canonicalPricing,
            applicationFeeCents: 10,
            vendorAccountId: null,
          },
          preferredCurrency: 'usd',
          resolvedCurrencyLower: 'usd',
          jobInsert: {
            ...common,
            thumbUrl: '/assets/frames/thumb-16x9.svg',
            hasAudio: true,
            previewFrame: '/assets/frames/thumb-16x9.svg',
            batchId: null,
            groupId: null,
            iterationIndex: null,
            iterationCount: null,
            renderIdsJson: null,
            heroRenderId: null,
            localKey: null,
            message: null,
            etaSeconds: null,
            etaLabel: null,
            provider: 'test',
            currency: quote.currency,
            vendorAccountId: null,
            paymentStatus: 'paid_wallet',
            stripePaymentIntentId: null,
            stripeChargeId: null,
          },
        });
        assert.equal(state.kind, 'created');
      } else {
        const state = await createInitialImageJobInExecutor(executor, {
          ...common,
          mode: 't2i',
          surface: 'image',
          billingProductKey: null,
          description: 'MCP image generation',
          amountCents: quote.priceCents,
          currency: quote.currency,
          applicationFeeCents: 10,
          vendorAccountId: null,
          preferredCurrency: 'usd',
          walletReservation: 'reserve',
          walletChargeMode: 'charge',
        });
        assert.equal(state.kind, 'created');
      }
      return {
        jobId: quote.quoteId,
        surface: quote.request.surface,
        execution: { surface: quote.request.surface, quoteId: quote.quoteId },
      } as never;
    },
    claimPreparedQuote,
    submitPaidGeneration: params.provider ?? (async () => ({ kind: 'accepted' })),
    markQuoteAccepted: (input) => markQuoteAccepted(input, { executor: { query: queryRows } }),
    markQuoteFailed: (input) => markQuoteFailed(input, { executor: { query: queryRows } }),
    readGenerationStatus: ({ userId, jobId }) => getGenerationStatus({ userId, jobId, queryFn: queryRows }),
    accountUrl: 'https://maxvideoai.com/account/connections',
  };
}

async function insertQuote(params: {
  pool: Pool;
  quoteId: string;
  userId: string;
  clientId: string;
  request: CanonicalGenerationRequest;
  priceCents: number;
  createdAt?: Date;
}) {
  const candidate = capability(params.request);
  const catalogRevision = computeGenerationCatalogRevision([candidate]);
  return transactionRunner(params.pool)(async (executor) => insertPreparedQuote({
    userId: params.userId,
    oauthClientId: params.clientId,
    request: params.request,
    requestHash: hashCanonicalGenerationRequest(params.request),
    catalogRevision,
    pricingSnapshot: pricingSnapshot(params.request, params.priceCents, catalogRevision),
    priceCents: params.priceCents,
    currency: 'USD',
    fundingMode: 'wallet',
  }, {
    executor,
    randomUUID: () => params.quoteId,
    ...(params.createdAt ? { now: () => params.createdAt! } : {}),
  }));
}

test('P8 quote claim, claimed spending, and transaction-only owners are statically explicit', () => {
  assert.equal(existsSync('frontend/src/server/agent-api/confirm-generation.ts'), true);
  assert.equal(existsSync('frontend/src/server/agent-api/paid-generation-execution.ts'), true);
  const repository = readFileSync('frontend/src/server/agent-api/quote-repository.ts', 'utf8');
  const spending = readFileSync('frontend/src/server/agent-api/spending-limits.ts', 'utf8');
  assert.match(repository, /type QuoteLockDependencies\s*=\s*\{[\s\S]*?TransactionQueryExecutor/);
  assert.match(repository, /lockOwnedQuote\([\s\S]{0,180}QuoteLockDependencies/);
  assert.match(repository, /claimPreparedQuote\([\s\S]{0,180}QuoteClaimDependencies/);
  assert.match(repository, /clock_timestamp\(\)/i);
  assert.match(spending, /state\s+IN\s*\(\s*'claimed'\s*,\s*'accepted'\s*\)/i);
  assert.match(spending, /RETURNING[\s\S]*SELECT clock_timestamp\(\) AS spending_now/i);
});

test('same-quote video/image races, distinct-quote cap race, and expiry wait execute in disposable PostgreSQL', async (t) => {
  for (const command of ['initdb', 'pg_ctl', 'psql']) {
    if (!commandExists(command)) {
      t.skip(`${command} is unavailable`);
      return;
    }
  }

  const temporaryRoot = mkdtempSync(join(tmpdir(), 'mcp-confirm-pg-'));
  const dataDirectory = join(temporaryRoot, 'data');
  const socketDirectory = join(temporaryRoot, 'socket');
  mkdirSync(socketDirectory);
  const init = spawnSync('initdb', [
    '-A', 'trust', '-U', 'postgres', '-D', dataDirectory, '--no-locale', '--encoding=UTF8',
  ], { encoding: 'utf8' });
  assert.equal(init.status, 0, commandFailure(init));
  const start = spawnSync('pg_ctl', [
    '-D', dataDirectory, '-o', `-F -k ${socketDirectory} -c listen_addresses=''`, '-w', 'start',
  ], { encoding: 'utf8', stdio: 'ignore' });
  assert.equal(start.status, 0, commandFailure(start));
  t.after(() => {
    spawnSync('pg_ctl', ['-D', dataDirectory, '-m', 'immediate', '-w', 'stop'], {
      encoding: 'utf8', stdio: 'ignore',
    });
    rmSync(temporaryRoot, { recursive: true, force: true });
  });

  const psql = (...args: string[]) => spawnSync('psql', [
    '-X', '-h', socketDirectory, '-U', 'postgres', '-d', 'postgres', ...args,
  ], { encoding: 'utf8' });
  const migration = psql('--single-transaction', '-v', 'ON_ERROR_STOP=1', '-f', migrationPath);
  assert.equal(migration.status, 0, commandFailure(migration));
  const schema = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    CREATE TABLE app_receipts (
      id bigserial PRIMARY KEY, user_id text NOT NULL, type text NOT NULL, amount_cents integer NOT NULL,
      currency text, description text, job_id text, surface text, billing_product_key text,
      pricing_snapshot jsonb, application_fee_cents integer, vendor_account_id text,
      stripe_payment_intent_id text, stripe_charge_id text, platform_revenue_cents integer,
      destination_acct text, metadata jsonb, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    CREATE UNIQUE INDEX app_receipts_charge_job_unique ON app_receipts (job_id) WHERE type = 'charge';
    CREATE TABLE user_account_restrictions (
      user_id text PRIMARY KEY, reason text NOT NULL, message text, active boolean NOT NULL DEFAULT true,
      restricted_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    CREATE TABLE app_membership_tiers (
      tier text PRIMARY KEY, spend_threshold_cents integer NOT NULL, discount_percent numeric NOT NULL
    );
    INSERT INTO app_membership_tiers (tier, spend_threshold_cents, discount_percent) VALUES
      ('member', 0, 0), ('plus', 5000, 0.05), ('pro', 20000, 0.10);
    CREATE TABLE app_jobs (
      id bigserial PRIMARY KEY, job_id text UNIQUE NOT NULL, user_id text, surface text, billing_product_key text,
      engine_id text, engine_label text, duration_sec integer, prompt text, thumb_url text, aspect_ratio text,
      has_audio boolean, can_upscale boolean, preview_frame text, batch_id text, group_id text,
      iteration_index integer, iteration_count integer, render_ids jsonb, hero_render_id text,
      local_key text, message text, eta_seconds integer, eta_label text, provider text, video_url text,
      preview_video_url text, audio_url text, status text, progress integer, provider_job_id text,
      final_price_cents integer, pricing_snapshot jsonb, cost_breakdown_usd jsonb, settings_snapshot jsonb,
      currency text, vendor_account_id text, payment_status text, stripe_payment_intent_id text,
      stripe_charge_id text, visibility text, indexable boolean, provisional boolean,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
  `);
  assert.equal(schema.status, 0, commandFailure(schema));

  const connection = { host: socketDirectory, user: 'postgres', database: 'postgres' };
  const pool = new Pool(connection);
  const lockClient = new Client(connection);
  await lockClient.connect();
  t.after(async () => Promise.allSettled([pool.end(), lockClient.end()]));
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `postgresql://postgres@localhost/postgres?host=${encodeURIComponent(socketDirectory)}`;
  t.after(() => {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  for (const [index, surface] of (['video', 'image'] as const).entries()) {
    const quoteId = `00000000-0000-4000-8000-00000000000${index + 8}`;
    const userId = `jsonb-${surface}`;
    const clientId = `jsonb-client-${surface}`;
    const request = requestFor(surface, `jsonb-${index}`);
    if (surface === 'image') delete request.settings.aspectRatio;
    const candidate = capability(request);
    const catalogRevision = computeGenerationCatalogRevision([candidate]);
    const authoritativePricing = pricingSnapshot(request, 60, catalogRevision);
    await pool.query(
      `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description)
       VALUES ($1, 'topup', 1000, 'USD', 'local JSONB round-trip topup')`,
      [userId],
    );
    await insertQuote({ pool, quoteId, userId, clientId, request, priceCents: 60 });

    const reservation = await transactionRunner(pool)(async (executor) => {
      const locked = await lockOwnedQuote({ quoteId, userId, oauthClientId: clientId }, { executor });
      assert.ok(locked, `${surface} quote must survive the JSONB round-trip`);
      return reservePaidGenerationInitialJob({
        quote: locked.quote,
        candidate,
        pricingSnapshot: authoritativePricing,
      }, { executor });
    });
    assert.equal(reservation.surface, surface);
    assert.equal(reservation.jobId, quoteId);
    const persisted = await pool.query<{ jobs: string; charges: string; aspect_ratio: string | null }>(`
      SELECT
        (SELECT count(*) FROM app_jobs WHERE job_id = $1)::text AS jobs,
        (SELECT count(*) FROM app_receipts WHERE job_id = $1 AND type = 'charge')::text AS charges,
        (SELECT aspect_ratio FROM app_jobs WHERE job_id = $1) AS aspect_ratio
    `, [quoteId]);
    assert.deepEqual(persisted.rows[0], {
      jobs: '1',
      charges: '1',
      aspect_ratio: surface === 'image' ? null : '16:9',
    });
  }

  for (const [index, surface] of (['video', 'image'] as const).entries()) {
    const quoteId = `00000000-0000-4000-8000-00000000001${index + 1}`;
    const userId = `race-${surface}`;
    const clientId = `client-${surface}`;
    const request = requestFor(surface, `race-${index}`);
    await pool.query(
      `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description)
       VALUES ($1, 'topup', 1000, 'USD', 'local test topup')`,
      [userId],
    );
    await insertQuote({ pool, quoteId, userId, clientId, request, priceCents: 60 });
    let providerCalls = 0;
    let releaseProvider!: () => void;
    let providerStarted!: () => void;
    const started = new Promise<void>((resolve) => { providerStarted = resolve; });
    const release = new Promise<void>((resolve) => { releaseProvider = resolve; });
    const dependencies = confirmationDependencies({
      pool,
      request,
      priceCents: 60,
      provider: async () => {
        providerCalls += 1;
        providerStarted();
        await release;
        return { kind: 'accepted' };
      },
    });
    const racePrincipal: AgentPrincipal = {
      userId, clientId, emailVerified: true, authMethod: 'oauth',
    };
    const first = confirmGeneration({ quoteId, confirmed: true }, racePrincipal, dependencies);
    await started;
    const second = await confirmGeneration({ quoteId, confirmed: true }, racePrincipal, dependencies);
    releaseProvider();
    const firstResult = await first;
    assert.equal(firstResult.jobId, quoteId);
    assert.equal(second.jobId, quoteId);
    assert.equal(providerCalls, 1, `${surface} provider must run once`);
    const counts = await pool.query<{ jobs: string; charges: string; state: string }>(`
      SELECT
        (SELECT count(*) FROM app_jobs WHERE job_id = $1::text)::text AS jobs,
        (SELECT count(*) FROM app_receipts WHERE job_id = $1::text AND type = 'charge')::text AS charges,
        (SELECT state FROM mcp_generation_quotes WHERE quote_id = $1::uuid) AS state
    `, [quoteId]);
    assert.deepEqual(counts.rows[0], { jobs: '1', charges: '1', state: 'accepted' });
  }

  const capUser = 'daily-cap-user';
  const capClient = 'daily-cap-client';
  const capRequestA = requestFor('video', 'cap-a');
  const capRequestB = requestFor('image', 'cap-b');
  const capQuoteA = '00000000-0000-4000-8000-000000000121';
  const capQuoteB = '00000000-0000-4000-8000-000000000122';
  await pool.query(
    `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description)
     VALUES ($1, 'topup', 1000, 'USD', 'local cap topup')`,
    [capUser],
  );
  await pool.query(
    'INSERT INTO mcp_spending_limits (user_id, daily_cents) VALUES ($1, 100)',
    [capUser],
  );
  await Promise.all([
    insertQuote({ pool, quoteId: capQuoteA, userId: capUser, clientId: capClient, request: capRequestA, priceCents: 60 }),
    insertQuote({ pool, quoteId: capQuoteB, userId: capUser, clientId: capClient, request: capRequestB, priceCents: 60 }),
  ]);
  const capPrincipal: AgentPrincipal = {
    userId: capUser, clientId: capClient, emailVerified: true, authMethod: 'oauth',
  };
  let releaseEarlierClockWaiter!: () => void;
  let markEarlierClockRead!: () => void;
  const earlierClockRead = new Promise<void>((resolve) => { markEarlierClockRead = resolve; });
  const releaseWaiter = new Promise<void>((resolve) => { releaseEarlierClockWaiter = resolve; });
  const waiterDependencies = confirmationDependencies({ pool, request: capRequestA, priceCents: 60 });
  waiterDependencies.getAccountRestriction = async () => {
    markEarlierClockRead();
    await releaseWaiter;
    return null;
  };
  const waiter = confirmGeneration(
    { quoteId: capQuoteA, confirmed: true },
    capPrincipal,
    waiterDependencies,
  );
  await earlierClockRead;
  const laterClockWinner = await confirmGeneration(
    { quoteId: capQuoteB, confirmed: true },
    capPrincipal,
    confirmationDependencies({ pool, request: capRequestB, priceCents: 60 }),
  );
  assert.equal(laterClockWinner.jobId, capQuoteB);
  releaseEarlierClockWaiter();
  const capResults = await Promise.allSettled([waiter, Promise.resolve(laterClockWinner)]);
  assert.equal(capResults.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = capResults.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  assert.ok(rejected?.reason instanceof AgentApiError);
  assert.equal(rejected.reason.code, 'SPENDING_LIMIT_EXCEEDED');
  const capCounts = await pool.query<{ jobs: string; charges: string; claimed: string }>(`
    SELECT
      (SELECT count(*) FROM app_jobs WHERE user_id = $1)::text AS jobs,
      (SELECT count(*) FROM app_receipts WHERE user_id = $1 AND type = 'charge')::text AS charges,
      (SELECT count(*) FROM mcp_generation_quotes WHERE user_id = $1 AND state IN ('claimed','accepted'))::text AS claimed
  `, [capUser]);
  assert.deepEqual(capCounts.rows[0], { jobs: '1', charges: '1', claimed: '1' });

  const expiryUser = 'expiry-user';
  const expiryClient = 'expiry-client';
  const expiryQuote = '00000000-0000-4000-8000-000000000131';
  const expiryRequest = requestFor('video', 'expiry');
  const createdAt = new Date(Date.now() - 9 * 60_000 - 59_500);
  await pool.query(
    `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description)
     VALUES ($1, 'topup', 1000, 'USD', 'local expiry topup')`,
    [expiryUser],
  );
  await insertQuote({
    pool, quoteId: expiryQuote, userId: expiryUser, clientId: expiryClient,
    request: expiryRequest, priceCents: 60, createdAt,
  });
  await lockClient.query('BEGIN');
  await lockClient.query('SELECT quote_id FROM mcp_generation_quotes WHERE quote_id = $1 FOR UPDATE', [expiryQuote]);
  const expiryPrincipal: AgentPrincipal = {
    userId: expiryUser, clientId: expiryClient, emailVerified: true, authMethod: 'oauth',
  };
  let expirySettled = false;
  const expiring = confirmGeneration(
    { quoteId: expiryQuote, confirmed: true },
    expiryPrincipal,
    confirmationDependencies({ pool, request: expiryRequest, priceCents: 60 }),
  );
  void expiring.finally(() => { expirySettled = true; }).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(expirySettled, false, 'confirmation must wait on the quote row lock');
  await new Promise((resolve) => setTimeout(resolve, 700));
  await lockClient.query('COMMIT');
  await assert.rejects(expiring, (error: unknown) => error instanceof AgentApiError && error.code === 'QUOTE_EXPIRED');
  const expiryCounts = await pool.query<{ jobs: string; charges: string; state: string }>(`
    SELECT
      (SELECT count(*) FROM app_jobs WHERE user_id = $1)::text AS jobs,
      (SELECT count(*) FROM app_receipts WHERE user_id = $1 AND type = 'charge')::text AS charges,
      (SELECT state FROM mcp_generation_quotes WHERE quote_id = $2) AS state
  `, [expiryUser, expiryQuote]);
  assert.deepEqual(expiryCounts.rows[0], { jobs: '0', charges: '0', state: 'expired' });
});
