import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { QueryExecutor, TransactionQueryExecutor } from '../frontend/src/lib/db';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import { hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import {
  createPrepareGenerationService,
  prepareGeneration,
} from '../frontend/src/server/agent-api/prepare-generation';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import { insertPreparedQuote } from '../frontend/src/server/agent-api/quote-repository';
import type { TrialStatus } from '../frontend/src/server/agent-api/types';
import * as httpHandler from '../frontend/src/server/mcp/http-handler';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';
import type { EngineCaps, EngineInputField, EngineModeUiCaps } from '../frontend/types/engines';

const paidMigrationPath = 'neon/migrations/30_mcp_paid_generation.sql';
const trialMigrationPath = 'neon/migrations/31_mcp_trial_entitlements.sql';
const auditRepositoryPath = 'frontend/src/server/agent-api/trial-quote-audit-repository.ts';
const quoteId = '123e4567-e89b-42d3-a456-426614174000';
const now = new Date('2026-07-17T10:00:00.000Z');
const expiresAt = new Date('2026-07-17T10:10:00.000Z');
const principal: AgentPrincipal = {
  userId: 'trial-user',
  clientId: 'codex-client',
  emailVerified: true,
  authMethod: 'oauth',
};
const trialInput = {
  surface: 'video',
  engineId: 'seedance-2-0-mini',
  mode: 't2v',
  prompt: 'A paper fox crossing a quiet moonlit street',
  settings: { aspectRatio: '9:16', audio: false },
} as const;

function trialCapability(): AgentPublicGenerationEngine {
  const fields: EngineInputField[] = [
    { id: 'prompt', type: 'text', label: 'Prompt' },
    { id: 'duration', type: 'enum', label: 'Duration', values: ['5', '10'] },
    { id: 'resolution', type: 'enum', label: 'Resolution', values: ['480p', '720p'] },
    { id: 'aspect_ratio', type: 'enum', label: 'Ratio', values: ['16:9', '9:16', '1:1'] },
    { id: 'generate_audio', type: 'boolean', label: 'Audio' },
  ];
  const modeCaps: EngineModeUiCaps = {
    modes: ['t2v'],
    duration: { options: [5, 10], default: 5 },
    resolution: ['480p', '720p'],
    aspectRatio: ['16:9', '9:16', '1:1'],
    fps: [24],
    audioToggle: true,
  };
  const engine: EngineCaps = {
    id: 'seedance-2-0-mini',
    label: 'Seedance 2 Mini',
    provider: 'test',
    status: 'live',
    latencyTier: 'standard',
    modes: ['t2v'],
    maxDurationSec: 10,
    resolutions: ['480p', '720p'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    fps: [24],
    audio: true,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: { promptMaxChars: 12_000 },
    inputSchema: { required: [fields[0]!], optional: fields.slice(1) },
    updatedAt: '2026-07-17T00:00:00.000Z',
    ttlSec: 600,
    availability: 'available',
  };
  return { engine, surface: 'video', publicModes: ['t2v'], modeCaps: { t2v: modeCaps } };
}

const available: TrialStatus = {
  status: 'available',
  preset: {
    engineId: 'seedance-2-0-mini',
    surface: 'video',
    mode: 't2v',
    durationSec: 5,
    resolution: '480p',
    aspectRatios: ['16:9', '9:16', '1:1'],
    audioOptional: true,
    outputCount: 1,
  },
};

type PrepareCaptures = {
  eligibility: number;
  risk: Array<Record<string, unknown>>;
  spending: number;
  inserted: Array<Record<string, unknown>>;
  audits: Array<Record<string, unknown>>;
};

function pricingSnapshot(baseAmountCents = 85, totalCents = 125) {
  return {
    totalCents,
    currency: 'USD',
    membershipTier: 'member' as const,
    base: { seconds: 5, rate: 0.17, unit: 'sec', amountCents: baseAmountCents },
    addons: [],
    provenance: { source: 'canonical-test' },
  };
}

function prepareDependencies(options: {
  paidEnabled?: boolean;
  eligibility?: TrialStatus;
  risk?: Readonly<Record<string, unknown>>;
  baseAmountCents?: number;
  normalPriceCents?: number;
} = {}) {
  const captures: PrepareCaptures = {
    eligibility: 0,
    risk: [],
    spending: 0,
    inserted: [],
    audits: [],
  };
  const executor = {
    async query() { throw new Error('unexpected SQL in injected trial prepare test'); },
  } as TransactionQueryExecutor;
  const deps = {
    paidGenerationEnabled: () => options.paidEnabled ?? true,
    getAccountRestriction: async () => null,
    listPublicEngines: async () => [trialCapability()],
    resolveMembershipPricing: async () => ({
      tier: 'member' as const,
      source: 'app_receipts_rolling_30d' as const,
      spent30Cents: 0,
      thresholdCents: 0,
      discountPercent: 0,
    }),
    priceGeneration: async () => ({
      priceCents: options.normalPriceCents ?? 125,
      currency: 'USD',
      membershipTier: 'member' as const,
      pricingSnapshot: pricingSnapshot(
        options.baseAmountCents,
        options.normalPriceCents ?? 125,
      ),
    }),
    getWalletSummary: async () => ({
      balanceCents: 500,
      currency: 'USD',
      pendingCents: 0,
      hasCompletedTopUp: true,
    }),
    withTransaction: async <TResult>(callback: (tx: TransactionQueryExecutor) => Promise<TResult>) =>
      callback(executor),
    checkSpendingLimits: async () => {
      captures.spending += 1;
      return {
        allowed: true as const,
        acceptedTodayCents: 0,
        projectedTodayCents: 125,
        limits: { perGenerationCents: null, dailyCents: null, webApprovalAboveCents: null },
      };
    },
    insertPreparedQuote: async (input: Record<string, unknown>, dependencies: { executor: QueryExecutor }) => {
      captures.inserted.push({ ...input, executor: dependencies.executor });
      return {
        quoteId,
        userId: input.userId,
        oauthClientId: input.oauthClientId,
        request: input.request,
        requestHash: input.requestHash,
        catalogRevision: input.catalogRevision,
        pricingSnapshot: input.pricingSnapshot,
        priceCents: input.priceCents,
        currency: input.currency,
        fundingMode: input.fundingMode,
        trialFunding: input.fundingMode === 'trial'
          ? (input.pricingSnapshot as Record<string, unknown>).funding
          : null,
        state: 'prepared',
        jobId: null,
        expiresAt,
        claimedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    },
    getTrialEligibility: async () => {
      captures.eligibility += 1;
      return options.eligibility ?? available;
    },
    checkTrialRisk: async (input: Record<string, unknown>) => {
      captures.risk.push(input);
      return options.risk ?? { allowed: true as const };
    },
    recordTrialQuotePreparedAudit: async (
      input: Record<string, unknown>,
      dependencies: { executor: QueryExecutor },
    ) => {
      captures.audits.push({ ...input, executor: dependencies.executor });
      return true;
    },
    trialRiskContext: { clientIp: '203.0.113.17', userAgent: 'Codex/1.0' },
    accountUrl: 'https://maxvideoai.com/account/connections',
    now: () => now,
  };
  return { captures, deps, executor };
}

test('a qualifying original request prepares a zero-charge trial without reducing the wallet', async () => {
  const { captures, deps, executor } = prepareDependencies({ paidEnabled: false });
  const prepared = await prepareGeneration(trialInput, principal, deps as never);

  assert.equal(prepared.fundingMode, 'trial');
  assert.deepEqual(prepared.price, { amountCents: 0, currency: 'USD' });
  assert.deepEqual(prepared.balance, { beforeCents: 500, afterCents: 500 });
  assert.equal(prepared.topupRequired, false);
  assert.equal(JSON.stringify(prepared).includes('providerCostCents'), false);
  assert.equal(captures.eligibility, 1);
  assert.equal(captures.spending, 0);
  assert.deepEqual(captures.risk, [{
    userId: 'trial-user',
    oauthClientId: 'codex-client',
    clientIp: '203.0.113.17',
    userAgent: 'Codex/1.0',
    providerCostCents: 17,
  }]);
  assert.equal(captures.inserted.length, 1);
  const inserted = captures.inserted[0]!;
  assert.equal(inserted.fundingMode, 'trial');
  assert.equal(inserted.priceCents, 0);
  assert.equal(inserted.executor, executor);
  const storedPricing = inserted.pricingSnapshot as Record<string, unknown>;
  assert.deepEqual(storedPricing.canonicalPricing, pricingSnapshot());
  assert.deepEqual(storedPricing.funding, {
    kind: 'included_trial',
    customerChargeCents: 0,
    normalPriceCents: 125,
    providerCostCents: 17,
  });
  assert.deepEqual(captures.audits, [{
    quoteId,
    engineId: 'seedance-2-0-mini',
    aspectRatio: '9:16',
    audio: false,
    oauthClientId: 'codex-client',
    outcome: 'success',
    executor,
  }]);
});

test('prepare_generation SDK validation rejects unknown top-level routing and funding fields', async (t) => {
  const received: unknown[] = [];
  const prepared = {
    quoteId,
    expiresAt: expiresAt.toISOString(),
    requestHash: 'a'.repeat(64),
    summary: {
      schemaVersion: 1 as const,
      ...trialInput,
      references: [],
      outputCount: 1 as const,
    },
    price: { amountCents: 0, currency: 'USD' },
    balance: { beforeCents: 500, afterCents: 500 },
    fundingMode: 'trial' as const,
    confirmationRequired: true as const,
    topupRequired: false,
  };
  const services: MaxVideoAiMcpServices = {
    async getAccountStatus() { throw new Error('unused'); },
    async listModels() { return []; },
    async recommendModels() {
      return { recommendations: [], nextAction: 'clarify_requirements' };
    },
    async prepareGeneration(input) {
      received.push(input);
      return prepared;
    },
    async confirmGeneration() { throw new Error('unused'); },
    async getGenerationStatus() { throw new Error('unused'); },
    async listRecentGenerations() { throw new Error('unused'); },
    async createTopupLink() { throw new Error('unused'); },
  };
  const server = createMaxVideoAiMcpServer(principal, services, { paidGeneration: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'trial-strict-input-contract', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const unknownExtras = [
    { providerRoute: 'private-provider-route' },
    { funding: { kind: 'included_trial' } },
    { provider: { id: 'private-provider' } },
    { referenceUrl: 'https://private.example/reference.png' },
    { walletCredit: 500 },
    { reservation: { id: 'private-reservation' } },
  ];
  for (const extra of unknownExtras) {
    const invalid = await client.callTool({
      name: 'prepare_generation',
      arguments: { ...trialInput, ...extra },
    });
    assert.equal(invalid.isError, true, JSON.stringify(extra));
  }
  assert.equal(received.length, 0);

  const prepareTool = (await client.listTools()).tools
    .find((tool) => tool.name === 'prepare_generation');
  assert.equal(prepareTool?.inputSchema.additionalProperties, false);

  const valid = await client.callTool({
    name: 'prepare_generation',
    arguments: trialInput,
  });
  assert.notEqual(valid.isError, true);
  assert.deepEqual(received, [trialInput]);
});

test('explicit extra settings never call trial services and preserve the paid wallet quote', async () => {
  const { captures, deps } = prepareDependencies();
  const prepared = await prepareGeneration({
    ...trialInput,
    settings: {
      ...trialInput.settings,
      durationSec: 5,
      resolution: '480p',
    },
  }, principal, deps as never);

  assert.equal(prepared.fundingMode, 'wallet');
  assert.equal(prepared.price.amountCents, 125);
  assert.deepEqual(prepared.balance, { beforeCents: 500, afterCents: 375 });
  assert.equal(captures.eligibility, 0);
  assert.equal(captures.risk.length, 0);
  assert.equal(captures.spending, 1);
  assert.equal(captures.inserted[0]?.fundingMode, 'wallet');
  assert.equal(
    Object.hasOwn(captures.inserted[0]?.pricingSnapshot as object, 'funding'),
    false,
  );
});

test('a consumed trial candidate becomes a newly prepared explicit wallet quote', async () => {
  const { captures, deps } = prepareDependencies({
    eligibility: { status: 'consumed', jobId: 'previous-job' },
  });
  const prepared = await prepareGeneration(trialInput, principal, deps as never);

  assert.equal(prepared.fundingMode, 'wallet');
  assert.equal(prepared.price.amountCents, 125);
  assert.deepEqual(prepared.balance, { beforeCents: 500, afterCents: 375 });
  assert.equal(captures.risk.length, 0);
  assert.equal(captures.spending, 1);
  assert.equal(captures.inserted.length, 1);
  assert.equal(captures.audits.length, 0);
});

test('trial risk denial falls back to paid while rate limiting creates no quote', async () => {
  const fallback = prepareDependencies({
    risk: {
      allowed: false,
      code: 'TRIAL_NOT_ELIGIBLE',
      nextAction: { type: 'use_paid_generation' },
    },
  });
  assert.equal(
    (await prepareGeneration(trialInput, principal, fallback.deps as never)).fundingMode,
    'wallet',
  );
  assert.equal(fallback.captures.spending, 1);
  assert.equal(fallback.captures.inserted.length, 1);
  assert.equal(fallback.captures.audits.length, 0);

  const limited = prepareDependencies({
    paidEnabled: false,
    risk: {
      allowed: false,
      code: 'RATE_LIMITED',
      nextAction: { type: 'retry_later' },
    },
  });
  await assert.rejects(
    prepareGeneration(trialInput, principal, limited.deps as never),
    (error: unknown) => {
      assert.ok(error instanceof AgentApiError);
      assert.equal(error.code, 'RATE_LIMITED');
      assert.equal(error.message.toLowerCase().includes('risk'), false);
      assert.deepEqual(error.nextAction, { type: 'retry_later' });
      return true;
    },
  );
  assert.equal(limited.captures.spending, 0);
  assert.equal(limited.captures.inserted.length, 0);
  assert.equal(limited.captures.audits.length, 0);
});

test('trial provider cost is independent from the marked-up public canonical base', async () => {
  for (const baseAmountCents of [0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const { captures, deps } = prepareDependencies({ paidEnabled: false, baseAmountCents });
    const prepared = await prepareGeneration(trialInput, principal, deps as never);
    assert.equal(prepared.fundingMode, 'trial');
    assert.equal(captures.risk[0]?.providerCostCents, 17);
    assert.equal(captures.inserted.length, 1);
  }

  const zeroNormalPrice = prepareDependencies({ paidEnabled: false, normalPriceCents: 0 });
  await assert.rejects(
    prepareGeneration(trialInput, principal, zeroNormalPrice.deps as never),
    (error: unknown) => error instanceof AgentApiError && error.code === 'INTERNAL_ERROR',
  );
  assert.equal(zeroNormalPrice.captures.risk.length, 0);
  assert.equal(zeroNormalPrice.captures.inserted.length, 0);
});

function canonicalTrialRequest(): CanonicalGenerationRequest {
  return {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'seedance-2-0-mini',
    mode: 't2v',
    prompt: trialInput.prompt,
    settings: {
      aspectRatio: '9:16', audio: false, durationSec: 5, resolution: '480p',
    },
    references: [],
    outputCount: 1,
  };
}

function storedTrialRow(request: CanonicalGenerationRequest, pricing: Record<string, unknown>) {
  return {
    quote_id: quoteId,
    user_id: principal.userId,
    oauth_client_id: principal.clientId,
    request_json: request,
    request_hash: hashCanonicalGenerationRequest(request),
    catalog_revision: 'catalog-1',
    pricing_snapshot: pricing,
    price_cents: 0,
    currency: 'USD',
    funding_mode: 'trial',
    state: 'prepared',
    job_id: null,
    expires_at: expiresAt,
    claimed_at: null,
    created_at: now,
    updated_at: now,
  };
}

function validTrialPricingSnapshot(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    catalogRevision: 'catalog-1',
    surface: 'video',
    engineId: 'seedance-2-0-mini',
    membership: {
      tier: 'member', source: 'app_receipts_rolling_30d', spent30Cents: 0,
      thresholdCents: 0, discountPercent: 0,
    },
    canonicalPricing: pricingSnapshot(),
    funding: {
      kind: 'included_trial', customerChargeCents: 0, normalPriceCents: 125,
      providerCostCents: 85,
    },
  };
}

test('quote repository requires explicit funding mode and parses a private typed trial snapshot', async () => {
  const request = canonicalTrialRequest();
  const persisted = validTrialPricingSnapshot();
  const trialFunding = persisted.funding;
  const calls: Array<{ sql: string; params?: ReadonlyArray<unknown> }> = [];
  const executor: QueryExecutor = {
    async query<TRecord>(sql, params) {
      calls.push({ sql, params });
      return [storedTrialRow(request, persisted)] as TRecord[];
    },
  };
  const input = {
    userId: principal.userId,
    oauthClientId: principal.clientId,
    request,
    requestHash: hashCanonicalGenerationRequest(request),
    catalogRevision: 'catalog-1',
    pricingSnapshot: persisted,
    priceCents: 0,
    currency: 'USD',
    fundingMode: 'trial' as const,
  };
  const quote = await insertPreparedQuote(input, {
    executor, now: () => now, randomUUID: () => quoteId,
  });

  assert.equal(quote.fundingMode, 'trial');
  assert.deepEqual((quote as unknown as { trialFunding: unknown }).trialFunding, trialFunding);
  assert.ok(calls[0]?.params?.includes('trial'));
  assert.ok(calls[0]?.params?.includes(0));
  await assert.rejects(
    insertPreparedQuote({ ...input, fundingMode: undefined } as never, {
      executor, now: () => now, randomUUID: () => quoteId,
    }),
    /invalid prepared quote input/i,
  );
});

test('trial quote insert rejects noncanonical top-level and nested funding semantics before SQL', async () => {
  const request = canonicalTrialRequest();
  const valid = validTrialPricingSnapshot();
  const input = {
    userId: principal.userId,
    oauthClientId: principal.clientId,
    request,
    requestHash: hashCanonicalGenerationRequest(request),
    catalogRevision: 'catalog-1',
    pricingSnapshot: valid,
    priceCents: 0,
    currency: 'USD',
    fundingMode: 'trial' as const,
  };
  const attacks = [
    { ...structuredClone(valid), private: true },
    { ...structuredClone(valid), walletCredit: 500 },
    { ...structuredClone(valid), refund: { amountCents: 125 } },
    { ...structuredClone(valid), reservation: 'private-reservation' },
    {
      ...structuredClone(valid),
      membership: { ...(valid.membership as object), Wallet_Credit: 500 },
    },
    {
      ...structuredClone(valid),
      canonicalPricing: { ...(valid.canonicalPricing as object), REFUND: true },
    },
    {
      ...structuredClone(valid),
      canonicalPricing: {
        ...(valid.canonicalPricing as object),
        provenance: { source: 'canonical-test', re_ser_va_tion: 'private' },
      },
    },
  ];
  for (const pricingSnapshotAttack of attacks) {
    let queries = 0;
    const executor: QueryExecutor = {
      async query<TRecord>() {
        queries += 1;
        return [storedTrialRow(request, valid)] as TRecord[];
      },
    };
    await assert.rejects(
      insertPreparedQuote({ ...input, pricingSnapshot: pricingSnapshotAttack }, {
        executor, now: () => now, randomUUID: () => quoteId,
      }),
      /invalid prepared quote input/i,
    );
    assert.equal(queries, 0);
  }
});

test('trial quote row parsing rejects noncanonical top-level and nested funding semantics', async () => {
  const request = canonicalTrialRequest();
  const valid = validTrialPricingSnapshot();
  const input = {
    userId: principal.userId,
    oauthClientId: principal.clientId,
    request,
    requestHash: hashCanonicalGenerationRequest(request),
    catalogRevision: 'catalog-1',
    pricingSnapshot: valid,
    priceCents: 0,
    currency: 'USD',
    fundingMode: 'trial' as const,
  };
  const attacks = [
    { ...structuredClone(valid), wallet_credit: 500 },
    {
      ...structuredClone(valid),
      canonicalPricing: { ...(valid.canonicalPricing as object), Reservation: true },
    },
    {
      ...structuredClone(valid),
      membership: { ...(valid.membership as object), reFund: { amountCents: 125 } },
    },
  ];
  for (const pricingSnapshotAttack of attacks) {
    const executor: QueryExecutor = {
      async query<TRecord>() {
        return [storedTrialRow(request, pricingSnapshotAttack)] as TRecord[];
      },
    };
    await assert.rejects(
      insertPreparedQuote(input, { executor, now: () => now, randomUUID: () => quoteId }),
      /invalid quote row/i,
    );
  }
});

test('trial quote preparation audit has a narrow exact parameterized repository contract', async () => {
  assert.equal(existsSync(auditRepositoryPath), true, `${auditRepositoryPath} should exist`);
  if (!existsSync(auditRepositoryPath)) return;

  const modulePath = '../frontend/src/server/agent-api/trial-quote-audit-repository';
  const auditModule = await import(modulePath) as Record<string, unknown>;
  const recordAudit = auditModule.recordTrialQuotePreparedAudit as (
    input: Record<string, unknown>,
    dependencies: { executor: QueryExecutor },
  ) => Promise<boolean>;
  assert.equal(typeof recordAudit, 'function');
  const calls: Array<{ sql: string; params?: ReadonlyArray<unknown> }> = [];
  const executor: QueryExecutor = {
    async query<TRecord>(sql, params) {
      calls.push({ sql, params });
      return [{ quote_id: quoteId }] as TRecord[];
    },
  };
  const audit = {
    quoteId,
    engineId: 'seedance-2-0-mini',
    aspectRatio: '9:16',
    audio: false,
    oauthClientId: 'codex-client',
    outcome: 'success',
  };
  assert.equal(await recordAudit(audit, { executor }), true);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO mcp_trial_quote_prepared_audit/i);
  assert.doesNotMatch(calls[0]!.sql, /trial-user|paper fox|203\.0\.113\.17|Codex\/1\.0/);
  assert.deepEqual(calls[0]!.params, [
    quoteId, 'seedance-2-0-mini', '9:16', false, 'codex-client', 'success',
  ]);
  for (const privateField of ['userId', 'prompt', 'clientIp', 'userAgent', 'providerCostCents']) {
    await assert.rejects(
      recordAudit({ ...audit, [privateField]: 'private' }, { executor }),
      /invalid trial quote prepared audit/i,
    );
  }
});

test('trial quote audit rejects exotic DTO properties without invoking accessors or SQL', async () => {
  const modulePath = '../frontend/src/server/agent-api/trial-quote-audit-repository';
  const auditModule = await import(modulePath) as Record<string, unknown>;
  const recordAudit = auditModule.recordTrialQuotePreparedAudit as (
    input: Record<string, unknown>,
    dependencies: { executor: QueryExecutor },
  ) => Promise<boolean>;
  const validAudit = {
    quoteId,
    engineId: 'seedance-2-0-mini',
    aspectRatio: '9:16',
    audio: false,
    oauthClientId: 'codex-client',
    outcome: 'success',
  };
  let getterCalls = 0;
  let queries = 0;
  const accessorAudit = { ...validAudit } as Record<string, unknown>;
  Object.defineProperty(accessorAudit, 'quoteId', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return quoteId;
    },
  });
  const symbolAudit = { ...validAudit } as Record<PropertyKey, unknown>;
  symbolAudit[Symbol('private')] = true;
  const hiddenAudit = { ...validAudit };
  Object.defineProperty(hiddenAudit, 'private', { enumerable: false, value: true });
  const inheritedAudit = Object.assign(Object.create({ private: true }), validAudit);
  const executor: QueryExecutor = {
    async query<TRecord>() {
      queries += 1;
      return [{ quote_id: quoteId }] as TRecord[];
    },
  };

  for (const attack of [accessorAudit, symbolAudit, hiddenAudit, inheritedAudit]) {
    await assert.rejects(
      recordAudit(attack as Record<string, unknown>, { executor }),
      /invalid trial quote prepared audit input/i,
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(queries, 0);
});

test('HTTP request context honors trusted IP precedence and passes no tool-controlled fields', () => {
  const resolver = (httpHandler as unknown as Record<string, unknown>)
    .resolveTrialRiskRequestContext as ((headers: Headers) => Record<string, unknown>) | undefined;
  assert.equal(typeof resolver, 'function');
  if (!resolver) return;

  assert.deepEqual(resolver(new Headers({
    'cf-connecting-ip': '203.0.113.1',
    'x-real-ip': '203.0.113.2',
    'x-vercel-forwarded-for': '203.0.113.3',
    'x-forwarded-for': '203.0.113.4, 198.51.100.8',
    'user-agent': 'Codex/1.0',
  })), { clientIp: '203.0.113.1', userAgent: 'Codex/1.0' });
  assert.deepEqual(resolver(new Headers({
    'x-forwarded-for': '203.0.113.4, 198.51.100.8',
  })), { clientIp: '203.0.113.4', userAgent: null });

  const source = readFileSync('frontend/src/server/mcp/http-handler.ts', 'utf8');
  assert.match(source, /createDefaultMaxVideoAiMcpServices\([\s\S]{0,180}resolveTrialRiskRequestContext\(request\.headers\)/);
  assert.doesNotMatch(
    readFileSync('frontend/src/server/mcp/tools/prepare-generation.ts', 'utf8'),
    /clientIp|userAgent|x-forwarded-for|cf-connecting-ip/i,
  );
});

test('direct prepare service construction requires an explicit exact request context', () => {
  assert.throws(
    () => createPrepareGenerationService(
      'https://maxvideoai.com/account/connections',
      undefined as never,
    ),
    /invalid trial risk request context/i,
  );
  assert.throws(
    () => createPrepareGenerationService(
      'https://maxvideoai.com/account/connections',
      { clientIp: null, userAgent: null, sharedFingerprint: 'unsafe' } as never,
    ),
    /invalid trial risk request context/i,
  );
});

test('trial risk context rejects exotic DTO properties without invoking accessors or dependencies', () => {
  let getterCalls = 0;
  let riskCalls = 0;
  let transactionCalls = 0;
  const accessorContext = { userAgent: null } as Record<string, unknown>;
  Object.defineProperty(accessorContext, 'clientIp', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return null;
    },
  });
  const symbolContext = { clientIp: null, userAgent: null } as Record<PropertyKey, unknown>;
  symbolContext[Symbol('private')] = true;
  const hiddenContext = { clientIp: null, userAgent: null };
  Object.defineProperty(hiddenContext, 'private', { enumerable: false, value: true });
  const inheritedContext = Object.assign(
    Object.create({ private: true }),
    { clientIp: null, userAgent: null },
  );
  const overrides = {
    checkTrialRisk: async () => {
      riskCalls += 1;
      return { allowed: true as const };
    },
    withTransaction: async () => {
      transactionCalls += 1;
      throw new Error('must not start a transaction');
    },
  };

  for (const attack of [accessorContext, symbolContext, hiddenContext, inheritedContext]) {
    assert.throws(
      () => createPrepareGenerationService(
        'https://maxvideoai.com/account/connections',
        attack as never,
        overrides as never,
      ),
      /invalid trial risk request context/i,
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(riskCalls, 0);
  assert.equal(transactionCalls, 0);
});

function commandExists(command: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
}

function commandOutput(result: ReturnType<typeof spawnSync>): string {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

test('migration 31 replaces wallet-only funding with exact trial shape and private audit constraints', () => {
  const source = readFileSync(trialMigrationPath, 'utf8');
  assert.match(source, /DROP CONSTRAINT IF EXISTS mcp_generation_quotes_funding_wallet/i);
  assert.match(source, /funding_mode\s+IN\s*\(\s*'wallet'\s*,\s*'trial'\s*\)/i);
  assert.match(source, /included_trial/i);
  assert.match(source, /normalPriceCents/);
  assert.match(source, /providerCostCents/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS mcp_trial_quote_prepared_audit/i);
  const table = source.match(
    /CREATE TABLE IF NOT EXISTS mcp_trial_quote_prepared_audit\s*\(([\s\S]*?)\n\);/i,
  )?.[1] ?? '';
  assert.doesNotMatch(
    table,
    /user_id|prompt|\bip\b|user_agent|fingerprint|price|provider_cost|email|token|url|reference_url|json|metadata|reason/i,
  );
  assert.match(table, /quote_id[\s\S]*engine_id[\s\S]*aspect_ratio[\s\S]*audio[\s\S]*oauth_client_id[\s\S]*outcome[\s\S]*created_at/i);
});

test('migration 30 to 31, reapplication, funding attacks and audit privacy execute in PostgreSQL', async (t) => {
  for (const command of ['initdb', 'pg_ctl', 'psql']) {
    if (!commandExists(command)) {
      t.skip(`${command} is unavailable`);
      return;
    }
  }
  const root = process.cwd();
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'mcp-trial-quote-postgres-'));
  const dataDirectory = join(temporaryRoot, 'data');
  const socketDirectory = join(temporaryRoot, 'socket');
  mkdirSync(socketDirectory);
  const init = spawnSync('initdb', [
    '-A', 'trust', '-U', 'postgres', '-D', dataDirectory, '--no-locale', '--encoding=UTF8',
  ], { encoding: 'utf8' });
  assert.equal(init.status, 0, commandOutput(init));
  const start = spawnSync('pg_ctl', [
    '-D', dataDirectory, '-o', `-F -k ${socketDirectory} -c listen_addresses=''`, '-w', 'start',
  ], { encoding: 'utf8', stdio: 'ignore' });
  assert.equal(start.status, 0, commandOutput(start));
  t.after(() => {
    spawnSync('pg_ctl', ['-D', dataDirectory, '-m', 'immediate', '-w', 'stop'], {
      encoding: 'utf8', stdio: 'ignore',
    });
    rmSync(temporaryRoot, { recursive: true, force: true });
  });
  const psql = (...args: string[]) => spawnSync('psql', [
    '-X', '-h', socketDirectory, '-U', 'postgres', '-d', 'postgres', ...args,
  ], { encoding: 'utf8' });
  const appJobs = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    CREATE TABLE app_jobs (
      job_id TEXT PRIMARY KEY
    );
  `);
  assert.equal(appJobs.status, 0, commandOutput(appJobs));
  for (const migration of [paidMigrationPath, trialMigrationPath]) {
    const applied = psql('--single-transaction', '-v', 'ON_ERROR_STOP=1', '-f', join(root, migration));
    assert.equal(applied.status, 0, commandOutput(applied));
  }

  const request = JSON.stringify(canonicalTrialRequest()).replaceAll("'", "''");
  const trialPricing = JSON.stringify({
    schemaVersion: 1,
    catalogRevision: 'catalog-1',
    surface: 'video',
    engineId: 'seedance-2-0-mini',
    membership: {
      tier: 'member', source: 'app_receipts_rolling_30d', spent30Cents: 0,
      thresholdCents: 0, discountPercent: 0,
    },
    canonicalPricing: pricingSnapshot(),
    funding: {
      kind: 'included_trial', customerChargeCents: 0, normalPriceCents: 125,
      providerCostCents: 85,
    },
  }).replaceAll("'", "''");
  const valid = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    INSERT INTO mcp_generation_quotes (
      quote_id, user_id, oauth_client_id, request_json, request_hash, catalog_revision,
      pricing_snapshot, price_cents, currency, funding_mode, state,
      expires_at, created_at, updated_at
    ) VALUES (
      '${quoteId}', 'trial-user', 'codex-client', '${request}'::jsonb,
      '${hashCanonicalGenerationRequest(canonicalTrialRequest())}', 'catalog-1',
      '${trialPricing}'::jsonb, 0, 'USD', 'trial', 'prepared',
      '2026-07-17T10:10:00Z', '2026-07-17T10:00:00Z', '2026-07-17T10:00:00Z'
    );
    INSERT INTO mcp_generation_quotes (
      quote_id, user_id, request_json, request_hash, catalog_revision, pricing_snapshot,
      price_cents, currency, funding_mode, state, expires_at, created_at, updated_at
    ) VALUES (
      '123e4567-e89b-42d3-a456-426614174001', 'wallet-user', '{"schemaVersion":1}',
      repeat('b', 64), 'catalog-wallet', '{}', 25, 'USD', 'wallet', 'prepared',
      '2026-07-17T10:10:00Z', '2026-07-17T10:00:00Z', '2026-07-17T10:00:00Z'
    );
    INSERT INTO mcp_generation_quotes (
      quote_id, user_id, oauth_client_id, request_json, request_hash, catalog_revision,
      pricing_snapshot, price_cents, currency, funding_mode, state,
      expires_at, created_at, updated_at
    ) VALUES (
      '123e4567-e89b-42d3-a456-426614174002', 'trial-user-2', 'codex-client',
      '${request}'::jsonb, '${hashCanonicalGenerationRequest(canonicalTrialRequest())}',
      'catalog-1', '${trialPricing}'::jsonb, 0, 'USD', 'trial', 'prepared',
      '2026-07-17T10:10:00Z', '2026-07-17T10:00:00Z', '2026-07-17T10:00:00Z'
    );
    INSERT INTO mcp_trial_quote_prepared_audit (
      quote_id, engine_id, aspect_ratio, audio, oauth_client_id, outcome
    ) VALUES (
      '${quoteId}', 'seedance-2-0-mini', '9:16', FALSE, 'codex-client', 'success'
    );
  `);
  assert.equal(valid.status, 0, commandOutput(valid));

  const cloneQuoteAttack = (
    sequence: number,
    sourceUserId: 'trial-user' | 'wallet-user',
    changes: { pricingSnapshot?: string; priceCents?: string; fundingMode?: string },
  ) => `
    INSERT INTO mcp_generation_quotes (
      quote_id, user_id, oauth_client_id, request_json, request_hash, catalog_revision,
      pricing_snapshot, price_cents, currency, funding_mode, state, job_id,
      expires_at, claimed_at, created_at, updated_at
    )
    SELECT
      '223e4567-e89b-42d3-a456-${String(426_614_174_000 + sequence)}',
      'trial-attack-${sequence}', oauth_client_id, request_json, request_hash, catalog_revision,
      ${changes.pricingSnapshot ?? 'pricing_snapshot'},
      ${changes.priceCents ?? 'price_cents'}, currency,
      ${changes.fundingMode ?? 'funding_mode'}, state, job_id,
      expires_at, claimed_at, created_at, updated_at
    FROM mcp_generation_quotes
    WHERE user_id = '${sourceUserId}'
  `;
  const quoteAttacks = [
    cloneQuoteAttack(1, 'wallet-user', { fundingMode: "'trial'" }),
    cloneQuoteAttack(2, 'trial-user', { priceCents: '1' }),
    cloneQuoteAttack(3, 'trial-user', { pricingSnapshot: "pricing_snapshot - 'funding'" }),
    cloneQuoteAttack(4, 'trial-user', {
      pricingSnapshot: "jsonb_set(pricing_snapshot, '{funding,providerCostCents}', '0')",
    }),
    cloneQuoteAttack(5, 'trial-user', {
      pricingSnapshot: "jsonb_set(pricing_snapshot, '{funding,normalPriceCents}', '124')",
    }),
    cloneQuoteAttack(6, 'trial-user', {
      pricingSnapshot: "jsonb_set(pricing_snapshot, '{funding,private}', 'true')",
    }),
    cloneQuoteAttack(7, 'trial-user', {
      pricingSnapshot: "jsonb_set(pricing_snapshot, '{funding,providerCostCents}', '9007199254740992')",
    }),
    cloneQuoteAttack(8, 'trial-user', {
      pricingSnapshot: "jsonb_set(pricing_snapshot, '{private}', 'true')",
    }),
    cloneQuoteAttack(9, 'trial-user', {
      pricingSnapshot: "jsonb_set(pricing_snapshot, '{walletCredit}', '500')",
    }),
    cloneQuoteAttack(10, 'trial-user', {
      pricingSnapshot: "jsonb_set(pricing_snapshot, '{wallet_credit}', '500')",
    }),
    cloneQuoteAttack(11, 'trial-user', {
      pricingSnapshot: "jsonb_set(pricing_snapshot, '{REFUND}', 'true')",
    }),
    cloneQuoteAttack(12, 'trial-user', {
      pricingSnapshot: `jsonb_set(pricing_snapshot, '{reservation}', '"private"')`,
    }),
    cloneQuoteAttack(13, 'trial-user', {
      pricingSnapshot: "jsonb_set(pricing_snapshot, '{membership,Wallet_Credit}', '500')",
    }),
    cloneQuoteAttack(14, 'trial-user', {
      pricingSnapshot: "jsonb_set(pricing_snapshot, '{canonicalPricing,reFund}', 'true')",
    }),
    cloneQuoteAttack(15, 'trial-user', {
      pricingSnapshot: `jsonb_set(pricing_snapshot, '{canonicalPricing,provenance,re_ser_va_tion}', '"private"')`,
    }),
  ];
  for (const sql of quoteAttacks) {
    const attacked = psql('-v', 'ON_ERROR_STOP=1', '-c', sql);
    assert.notEqual(attacked.status, 0, `${sql}\nunexpectedly succeeded`);
    assert.match(commandOutput(attacked), /mcp_generation_quotes_funding_shape/i, sql);
  }

  const auditAttacks = [
    `UPDATE mcp_trial_quote_prepared_audit SET outcome = 'failure' WHERE quote_id = '${quoteId}'`,
    `DELETE FROM mcp_trial_quote_prepared_audit WHERE quote_id = '${quoteId}'`,
    `INSERT INTO mcp_trial_quote_prepared_audit (quote_id, engine_id, aspect_ratio, audio, oauth_client_id, outcome)
       VALUES ('123e4567-e89b-42d3-a456-426614174001', 'seedance-2-0-mini', '9:16', FALSE, 'codex-client', 'success')`,
    `INSERT INTO mcp_trial_quote_prepared_audit (quote_id, engine_id, aspect_ratio, audio, oauth_client_id, outcome)
       VALUES ('123e4567-e89b-42d3-a456-426614174002', 'seedance-2-0-mini', '9:16', FALSE, 'codex-client', 'failure')`,
  ];
  for (const sql of auditAttacks) {
    const attacked = psql('-v', 'ON_ERROR_STOP=1', '-c', sql);
    assert.notEqual(attacked.status, 0, `${sql}\nunexpectedly succeeded`);
  }

  const reapplied = psql(
    '--single-transaction', '-v', 'ON_ERROR_STOP=1', '-f', join(root, trialMigrationPath),
  );
  assert.equal(reapplied.status, 0, commandOutput(reapplied));
  const predicate = psql('-At', '-v', 'ON_ERROR_STOP=1', '-c', `
    SELECT pg_get_expr(indexprs.indpred, indexprs.indrelid)
      FROM pg_index AS indexprs
      JOIN pg_class AS indexes ON indexes.oid = indexprs.indexrelid
     WHERE indexes.relname = 'mcp_generation_quotes_accepted_spend_idx'
  `);
  assert.equal(predicate.status, 0, commandOutput(predicate));
  assert.match(predicate.stdout, /funding_mode.*wallet/i);
});
