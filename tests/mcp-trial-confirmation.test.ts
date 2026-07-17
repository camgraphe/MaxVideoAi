import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { computeGenerationCatalogRevision } from '../frontend/src/server/agent-api/catalog-revision';
import {
  confirmGeneration,
  createConfirmGenerationService,
  type ConfirmGenerationDependencies,
} from '../frontend/src/server/agent-api/confirm-generation';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import { hashCanonicalGenerationRequest, stableJson } from '../frontend/src/server/agent-api/generation-normalization';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import {
  reserveIncludedTrialGenerationInitialJob,
  submitReservedIncludedTrialGeneration,
  type IncludedTrialGenerationExecution,
} from '../frontend/src/server/agent-api/paid-generation-execution';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type { McpGenerationQuote } from '../frontend/src/server/agent-api/quote-repository';
import type { AgentGenerationStatus } from '../frontend/src/server/generations/generation-status';
import { buildTrustedIncludedTrialVideoBilling } from '../frontend/src/server/video-generation/trusted-video-billing';
import type { EngineCaps } from '../frontend/types/engines';

const QUOTE_ID = '123e4567-e89b-42d3-a456-426614174000';
const USER_ID = 'trial-confirm-user';
const CLIENT_ID = 'trial-confirm-client';
const NOW = new Date('2026-07-17T10:00:00.000Z');
const EXPIRES_AT = new Date('2026-07-17T10:10:00.000Z');
const riskContext = Object.freeze({ clientIp: '203.0.113.24', userAgent: 'Codex/1.0' });

const principal: AgentPrincipal = {
  userId: USER_ID,
  clientId: CLIENT_ID,
  emailVerified: true,
  authMethod: 'oauth',
};

const request: CanonicalGenerationRequest = {
  schemaVersion: 1,
  surface: 'video',
  engineId: 'seedance-2-0-mini',
  mode: 't2v',
  prompt: 'A private trial prompt',
  settings: {
    durationSec: 5,
    resolution: '480p',
    aspectRatio: '16:9',
    audio: true,
  },
  references: [],
  outputCount: 1,
};

function candidate(): AgentPublicGenerationEngine {
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

const membership = {
  tier: 'member' as const,
  source: 'app_receipts_rolling_30d' as const,
  spent30Cents: 0,
  thresholdCents: 0,
  discountPercent: 0,
};

function canonicalPricing() {
  return {
    totalCents: 125,
    currency: 'USD',
    membershipTier: 'member',
    base: { amountCents: 55 },
    platformRevenueCents: 70,
    provenance: { source: 'trial-confirm-test' },
  };
}

function normalSnapshot() {
  const catalogRevision = computeGenerationCatalogRevision([candidate()]);
  return {
    schemaVersion: 1,
    catalogRevision,
    surface: 'video',
    engineId: request.engineId,
    membership,
    canonicalPricing: canonicalPricing(),
  };
}

function includedSnapshot() {
  return {
    ...normalSnapshot(),
    funding: {
      kind: 'included_trial',
      customerChargeCents: 0,
      normalPriceCents: 125,
      providerCostCents: 55,
    },
  };
}

function trialQuote(options: Partial<McpGenerationQuote> = {}): McpGenerationQuote {
  return {
    quoteId: QUOTE_ID,
    userId: USER_ID,
    oauthClientId: CLIENT_ID,
    request,
    requestHash: hashCanonicalGenerationRequest(request),
    catalogRevision: computeGenerationCatalogRevision([candidate()]),
    pricingSnapshot: includedSnapshot(),
    priceCents: 0,
    currency: 'USD',
    fundingMode: 'trial',
    trialFunding: {
      kind: 'included_trial', customerChargeCents: 0, normalPriceCents: 125, providerCostCents: 55,
    },
    state: 'prepared',
    jobId: null,
    expiresAt: EXPIRES_AT,
    claimedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...options,
  };
}

function status(state: 'accepted' | 'failed' = 'accepted'): AgentGenerationStatus {
  return {
    jobId: QUOTE_ID,
    surface: 'video',
    status: state,
    progress: 0,
    message: null,
    priceCents: 0,
    currency: 'USD',
    paymentStatus: 'included_mcp_trial',
    result: null,
    retryAfterSeconds: state === 'accepted' ? 5 : null,
  };
}

type Captures = { events: string[]; wallet: number; provider: number; refunds: number };

function dependencies(
  overrides: Partial<ConfirmGenerationDependencies> = {},
): { value: ConfirmGenerationDependencies; captures: Captures } {
  const captures: Captures = { events: [], wallet: 0, provider: 0, refunds: 0 };
  const executor = { async query() { throw new Error('unexpected SQL in unit trial confirmation'); } } as TransactionQueryExecutor;
  const quote = trialQuote();
  const value: ConfirmGenerationDependencies = {
    paidGenerationEnabled: () => { captures.events.push('paid_gate'); return false; },
    trialGenerationEnabled: () => { captures.events.push('trial_gate'); return true; },
    trialRiskContext: riskContext,
    withTransaction: async (callback) => {
      captures.events.push('transaction');
      const result = await callback(executor);
      captures.events.push('commit');
      return result;
    },
    lockOwnedQuote: async () => {
      captures.events.push('lock_quote');
      return { quote, databaseNow: NOW };
    },
    markQuoteExpired: async () => null,
    getAccountRestriction: async (_userId, input) => {
      captures.events.push('account');
      assert.equal(input.executor, executor);
      return null;
    },
    listPublicEngines: async () => { captures.events.push('catalog'); return [candidate()]; },
    resolveMembershipPricing: async () => { captures.events.push('membership'); return membership; },
    priceGeneration: async () => {
      captures.events.push('pricing');
      return { priceCents: 125, currency: 'USD', membershipTier: 'member', pricingSnapshot: canonicalPricing() };
    },
    checkSpendingLimits: async () => {
      captures.wallet += 1;
      throw new Error('trial must not check wallet spending');
    },
    acceptTrialRisk: async (input, inputDependencies) => {
      captures.events.push('risk');
      assert.equal(inputDependencies.executor, executor);
      assert.deepEqual(input, {
        userId: USER_ID,
        oauthClientId: CLIENT_ID,
        clientIp: riskContext.clientIp,
        userAgent: riskContext.userAgent,
        providerCostCents: 55,
      });
      return { allowed: true };
    },
    lockReservableEntitlement: async (_input, inputDependencies) => {
      captures.events.push('lock_entitlement');
      assert.equal(inputDependencies.executor, executor);
      return Object.freeze({}) as never;
    },
    reserveEntitlement: async (input, inputDependencies) => {
      captures.events.push('reserve_entitlement');
      assert.equal(inputDependencies.executor, executor);
      assert.equal(input.quoteId, QUOTE_ID);
      assert.equal(input.jobId, QUOTE_ID);
      return { status: 'reserved', userId: USER_ID, reservedQuoteId: QUOTE_ID, jobId: QUOTE_ID } as never;
    },
    reserveInitialJob: async () => {
      captures.wallet += 1;
      throw new Error('trial must not reserve a paid job');
    },
    reserveTrialInitialJob: async (input, inputDependencies) => {
      captures.events.push('create_trial_job');
      assert.equal(inputDependencies.executor, executor);
      assert.equal(input.quote.priceCents, 0);
      assert.equal(stableJson(input.pricingSnapshot), stableJson(includedSnapshot()));
      return {
        jobId: QUOTE_ID,
        surface: 'video',
        execution: {
          surface: 'video', quoteId: QUOTE_ID, userId: USER_ID, funding: {
            kind: 'mcp_trial', entitlementUserId: USER_ID, quoteId: QUOTE_ID,
          },
        },
      } as never;
    },
    claimPreparedQuote: async (input) => {
      captures.events.push('claim_quote');
      return trialQuote({ state: 'claimed', jobId: input.jobId, claimedAt: NOW });
    },
    submitPaidGeneration: async () => {
      captures.wallet += 1;
      throw new Error('trial must not enter paid submission');
    },
    submitTrialGeneration: async () => {
      captures.events.push('provider');
      captures.provider += 1;
      return { kind: 'accepted' };
    },
    applyTrialJobOutcome: async () => ({
      funding: 'included_trial', entitlementState: 'reserved',
    }),
    markQuoteAccepted: async () => {
      throw new Error('T7 owns trial outcome transitions');
    },
    markQuoteFailed: async () => {
      throw new Error('T7 owns trial outcome transitions');
    },
    readGenerationStatus: async () => { captures.events.push('status'); return status(); },
    accountUrl: 'https://maxvideoai.com/account/connections',
    ...overrides,
  };
  return { value, captures };
}

async function expectAgentError(operation: Promise<unknown>, code: AgentApiError['code']) {
  await assert.rejects(operation, (error: unknown) => error instanceof AgentApiError && error.code === code);
}

test('trial confirmation locks first, then atomically revalidates risk, entitlement, job, and claim before provider', async () => {
  const { value, captures } = dependencies();
  const result = await confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, value);
  assert.deepEqual(result, status());
  assert.deepEqual(captures.events, [
    'transaction', 'lock_quote', 'trial_gate', 'account', 'catalog', 'membership', 'pricing',
    'risk', 'lock_entitlement', 'reserve_entitlement', 'create_trial_job', 'claim_quote',
    'commit', 'provider', 'status',
  ]);
  assert.equal(captures.wallet, 0);
  assert.equal(captures.provider, 1);
});

test('trial confirmation rejects stale gates, principals, risk, and entitlement without paid fallback', async () => {
  for (const [label, identity, overrides, code] of [
    ['feature', principal, { trialGenerationEnabled: () => false }, 'TRIAL_NOT_ELIGIBLE'],
    ['email', { ...principal, emailVerified: false }, {}, 'TRIAL_NOT_ELIGIBLE'],
    ['client', { ...principal, clientId: null }, {}, 'TRIAL_NOT_ELIGIBLE'],
    ['risk', principal, { acceptTrialRisk: async () => ({ allowed: false, code: 'RATE_LIMITED', nextAction: { type: 'retry_later' } }) }, 'RATE_LIMITED'],
    ['entitlement', principal, { lockReservableEntitlement: async () => null }, 'TRIAL_NOT_ELIGIBLE'],
  ] as const) {
    const { value, captures } = dependencies(overrides as Partial<ConfirmGenerationDependencies>);
    await expectAgentError(
      confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, identity as AgentPrincipal, value),
      code,
    );
    assert.equal(captures.wallet, 0, label);
    assert.equal(captures.provider, 0, label);
    assert.equal(captures.events[0], 'transaction', label);
    assert.equal(captures.events[1], 'lock_quote', label);
  }
});

test('trial repricing compares the exact included envelope and canonical preset before risk or reservation', async () => {
  for (const [label, overrides] of [
    ['normal price', { priceGeneration: async () => ({ priceCents: 126, currency: 'USD', membershipTier: 'member', pricingSnapshot: { ...canonicalPricing(), totalCents: 126 } }) }],
    ['provider cost', { priceGeneration: async () => ({ priceCents: 125, currency: 'USD', membershipTier: 'member', pricingSnapshot: { ...canonicalPricing(), base: { amountCents: 56 } } }) }],
    ['preset', { lockOwnedQuote: async () => ({ quote: trialQuote({ request: { ...request, mode: 'i2v' } as never }), databaseNow: NOW }) }],
    ['membership authority', { resolveMembershipPricing: async () => ({ ...membership, source: 'unexpected' } as never) }],
  ] as const) {
    const { value, captures } = dependencies(overrides as Partial<ConfirmGenerationDependencies>);
    await expectAgentError(confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, value), 'TRIAL_NOT_ELIGIBLE');
    assert.equal(captures.events.includes('risk'), false, label);
    assert.equal(captures.events.includes('create_trial_job'), false, label);
    assert.equal(captures.wallet, 0, label);
  }
});

test('claimed trial repeats return the same included job without gates, risk, entitlement, wallet, or provider', async () => {
  const repeat = trialQuote({ state: 'claimed', jobId: QUOTE_ID, claimedAt: NOW });
  const { value, captures } = dependencies({
    lockOwnedQuote: async () => ({ quote: repeat, databaseNow: NOW }),
  });
  const result = await confirmGeneration({ quoteId: QUOTE_ID, confirmed: true }, principal, value);
  assert.equal(result.jobId, QUOTE_ID);
  assert.equal(captures.wallet, 0);
  assert.equal(captures.provider, 0);
  assert.equal(captures.events.includes('trial_gate'), false);
  assert.equal(captures.events.includes('risk'), false);
});

test('direct service construction requires the same explicit request risk context used by preparation', () => {
  assert.throws(
    () => createConfirmGenerationService('https://maxvideoai.com/account/connections', null as never),
    /trial risk request context/i,
  );
  assert.throws(
    () => createConfirmGenerationService(
      'https://maxvideoai.com/account/connections',
      { clientIp: 'x'.repeat(65), userAgent: null },
    ),
    /trial risk request context/i,
  );
  assert.throws(
    () => createConfirmGenerationService(
      'https://maxvideoai.com/account/connections',
      { clientIp: null, userAgent: 'injected\nheader' },
    ),
    /trial risk request context/i,
  );
  const source = readFileSync('frontend/src/server/mcp/server.ts', 'utf8');
  assert.match(source, /createConfirmGenerationService\(config\.accountUrl,\s*trialRiskContext\)/);
});

test('internal trial initial-job funding preserves private cost data and cannot masquerade as wallet-reserved', async () => {
  const calls: Array<{ sql: string; params?: ReadonlyArray<unknown> }> = [];
  const executor = {
    async query<TRecord>(sql: string, params?: ReadonlyArray<unknown>) {
      calls.push({ sql, params });
      return [] as TRecord[];
    },
  } as TransactionQueryExecutor;
  const quote = trialQuote();
  const reserved = await reserveIncludedTrialGenerationInitialJob({
    quote,
    candidate: candidate(),
    pricingSnapshot: includedSnapshot(),
  }, { executor });
  assert.equal(reserved.jobId, QUOTE_ID);
  assert.deepEqual(reserved.execution.trustedInitialState, {
    kind: 'created',
    jobId: QUOTE_ID,
    funding: { kind: 'mcp_trial', entitlementUserId: USER_ID, quoteId: QUOTE_ID },
  });
  assert.equal('walletChargeReserved' in reserved.execution.trustedInitialState, false);
  assert.equal(calls.some(({ sql }) => /app_receipts|reserveWalletCharge|WITH receipts AS/i.test(sql)), false);
  const insert = calls.find(({ sql }) => /INSERT INTO app_jobs/i.test(sql));
  assert.ok(insert);
  assert.equal(insert.params?.includes('included_mcp_trial'), true);
  assert.equal(insert.params?.includes(0), true);
  assert.equal(insert.params?.some((value) => typeof value === 'string' && value.includes('providerCostCents')), true);
});

test('trial provider continuation is explicit, validated, receipt-free, and never invokes wallet refund recovery', async () => {
  const quote = trialQuote();
  const execution: IncludedTrialGenerationExecution = {
    surface: 'video',
    quoteId: QUOTE_ID,
    userId: USER_ID,
    request,
    engine: candidate().engine,
    canonicalPricing: canonicalPricing(),
    pricingSnapshot: includedSnapshot(),
    funding: { kind: 'mcp_trial', entitlementUserId: USER_ID, quoteId: QUOTE_ID },
    trustedInitialState: {
      kind: 'created', jobId: QUOTE_ID,
      funding: { kind: 'mcp_trial', entitlementUserId: USER_ID, quoteId: QUOTE_ID },
    },
  };
  let refundCalls = 0;
  const outcome = await submitReservedIncludedTrialGeneration(execution, {
    executeVideo: async (options) => {
      assert.equal(options.funding.kind, 'mcp_trial');
      assert.equal(options.body.payment, undefined);
      assert.equal(options.preReservedInitialState.jobId, QUOTE_ID);
      assert.equal('walletChargeReserved' in options.preReservedInitialState, false);
      assert.equal(options.trustedIncludedTrialBilling.customerChargeCents, 0);
      assert.equal(options.trustedIncludedTrialBilling.paymentStatus, 'included_mcp_trial');
      assert.equal(stableJson(options.trustedIncludedTrialBilling.pricingSnapshot), stableJson(quote.pricingSnapshot));
      return { status: 422, body: { ok: false, error: 'known provider rejection' } };
    },
    executeImage: async () => assert.fail('trial is video-only'),
    ensureKnownRejectionRefund: async () => { refundCalls += 1; return true; },
  });
  assert.deepEqual(outcome, { kind: 'rejected' });
  assert.equal(refundCalls, 0);
});

test('trial continuation recognizes the safe BytePlus 4xx rejection marker behind its outward 502', async () => {
  const execution: IncludedTrialGenerationExecution = {
    surface: 'video', quoteId: QUOTE_ID, userId: USER_ID, request,
    engine: candidate().engine, canonicalPricing: canonicalPricing(),
    pricingSnapshot: includedSnapshot(),
    funding: { kind: 'mcp_trial', entitlementUserId: USER_ID, quoteId: QUOTE_ID },
    trustedInitialState: {
      kind: 'created', jobId: QUOTE_ID,
      funding: { kind: 'mcp_trial', entitlementUserId: USER_ID, quoteId: QUOTE_ID },
    },
  };
  const run = (error: string) => submitReservedIncludedTrialGeneration(execution, {
    executeVideo: async () => ({ status: 502, body: { ok: false, error } }),
    executeImage: async () => assert.fail('trial is video-only'),
  });
  assert.deepEqual(await run('PROVIDER_REQUEST_REJECTED'), { kind: 'rejected' });
  assert.deepEqual(await run('BYTEPLUS_PROVIDER_ERROR'), { kind: 'ambiguous', retryable: true });
});

test('trusted shared trial billing keeps private costs while forcing zero charge and no receipt', () => {
  const result = buildTrustedIncludedTrialVideoBilling({
    customerChargeCents: 0,
    paymentStatus: 'included_mcp_trial',
    membershipTier: 'member',
    normalPricing: canonicalPricing(),
    pricingSnapshot: includedSnapshot(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.preflight.paymentMode, 'mcp_trial');
  assert.equal(result.preflight.paymentStatus, 'included_mcp_trial');
  assert.equal(result.preflight.pricing.totalCents, 0);
  assert.equal(result.preflight.pendingReceipt, null);
  assert.equal(result.preflight.applicationFeeCents, 0);
  assert.equal(result.preflight.pricingSnapshotJson.includes('providerCostCents'), true);
});

test('trial initial-job runtime validation rejects cross-identity and accounting-confused internal calls before SQL', async () => {
  const { createInitialVideoJobInExecutor } = await import('../frontend/app/api/generate/_lib/initial-video-job');
  let sqlCalls = 0;
  const executor = { async query() { sqlCalls += 1; return []; } } as TransactionQueryExecutor;
  const base = {
    jobId: QUOTE_ID,
    userId: USER_ID,
    funding: { kind: 'mcp_trial', entitlementUserId: USER_ID, quoteId: QUOTE_ID } as const,
    pendingReceipt: null,
    preferredCurrency: null,
    resolvedCurrencyLower: 'usd',
    jobInsert: {
      jobId: QUOTE_ID, userId: USER_ID, engineId: request.engineId, engineLabel: 'Seedance 2.0 Mini',
      durationSec: 5, prompt: request.prompt, thumbUrl: '/thumb.svg', aspectRatio: '16:9',
      hasAudio: true, canUpscale: false, previewFrame: '/thumb.svg', batchId: null, groupId: null,
      iterationIndex: null, iterationCount: null, renderIdsJson: null, heroRenderId: null,
      localKey: null, message: null, etaSeconds: null, etaLabel: null, provider: 'fal',
      finalPriceCents: 0, pricingSnapshotJson: JSON.stringify(includedSnapshot()), costBreakdownJson: null,
      settingsSnapshotJson: JSON.stringify(request), currency: 'USD', vendorAccountId: null,
      paymentStatus: 'included_mcp_trial', stripePaymentIntentId: null, stripeChargeId: null,
      visibility: 'private' as const, indexable: false,
    },
  };
  for (const invalid of [
    { ...base, userId: 'another-user' },
    { ...base, jobId: 'another-job' },
    { ...base, pendingReceipt: { amountCents: 0 } },
    { ...base, jobInsert: { ...base.jobInsert, finalPriceCents: 1 } },
    { ...base, jobInsert: { ...base.jobInsert, paymentStatus: 'paid_wallet' } },
    { ...base, jobInsert: { ...base.jobInsert, visibility: 'public' } },
  ]) {
    await assert.rejects(createInitialVideoJobInExecutor(executor, invalid as never), /trial funding/i);
  }
  assert.equal(sqlCalls, 0);
});

test('initial video funding requires exact wallet, trial, or external discriminants before SQL', async () => {
  const { createInitialVideoJobInExecutor } = await import('../frontend/app/api/generate/_lib/initial-video-job');
  let sqlCalls = 0;
  let getterCalls = 0;
  const executor = { async query() { sqlCalls += 1; return []; } } as TransactionQueryExecutor;
  const trialBase = {
    jobId: QUOTE_ID,
    userId: USER_ID,
    funding: { kind: 'mcp_trial', entitlementUserId: USER_ID, quoteId: QUOTE_ID } as const,
    pendingReceipt: null,
    preferredCurrency: null,
    resolvedCurrencyLower: 'usd',
    jobInsert: {
      jobId: QUOTE_ID, userId: USER_ID, engineId: request.engineId, engineLabel: 'Seedance 2.0 Mini',
      durationSec: 5, prompt: request.prompt, thumbUrl: '/thumb.svg', aspectRatio: '16:9',
      hasAudio: true, canUpscale: false, previewFrame: '/thumb.svg', batchId: null, groupId: null,
      iterationIndex: null, iterationCount: null, renderIdsJson: null, heroRenderId: null,
      localKey: null, message: null, etaSeconds: null, etaLabel: null, provider: 'fal',
      finalPriceCents: 0, pricingSnapshotJson: JSON.stringify(includedSnapshot()), costBreakdownJson: null,
      settingsSnapshotJson: JSON.stringify(request), currency: 'USD', vendorAccountId: null,
      paymentStatus: 'included_mcp_trial', stripePaymentIntentId: null, stripeChargeId: null,
      visibility: 'private' as const, indexable: false,
    },
  };
  const { funding: _trialFunding, ...withoutFunding } = trialBase;
  const walletBase = {
    ...withoutFunding,
    paymentMode: 'wallet',
    walletReservation: 'reserve',
    funding: { kind: 'wallet', reservation: 'reserve' },
    preferredCurrency: 'usd',
    pendingReceipt: {
      userId: USER_ID, amountCents: 125, currency: 'USD', description: 'wallet job',
      jobId: QUOTE_ID, snapshot: canonicalPricing(), applicationFeeCents: 0, vendorAccountId: null,
    },
    jobInsert: {
      ...trialBase.jobInsert,
      finalPriceCents: 125,
      pricingSnapshotJson: JSON.stringify(normalSnapshot()),
      paymentStatus: 'paid_wallet',
    },
  };
  const accessorFunding = { ...walletBase } as Record<string, unknown>;
  Object.defineProperty(accessorFunding, 'funding', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return { kind: 'wallet', reservation: 'reserve' };
    },
  });
  for (const [label, invalid] of [
    ['mcp payment without funding', { ...withoutFunding, paymentMode: 'mcp_trial', walletReservation: 'reserve' }],
    ['mcp payment already reserved without funding', { ...withoutFunding, paymentMode: 'mcp_trial', walletReservation: 'already_reserved' }],
    ['wallet without funding', { ...withoutFunding, paymentMode: 'wallet', walletReservation: 'reserve', pendingReceipt: walletBase.pendingReceipt, preferredCurrency: 'usd', jobInsert: walletBase.jobInsert }],
    ['unknown wallet funding', { ...walletBase, funding: { kind: 'unknown' } }],
    ['trial with wallet funding', { ...trialBase, funding: { kind: 'wallet', reservation: 'reserve' } }],
    ['wallet with trial funding', { ...walletBase, funding: trialBase.funding }],
    ['wallet reservation mismatch', { ...walletBase, funding: { kind: 'wallet', reservation: 'already_reserved' } }],
    ['direct with wallet funding', { ...walletBase, paymentMode: 'direct' }],
    ['platform with unknown funding', { ...walletBase, paymentMode: 'platform', funding: { kind: 'unknown' } }],
    ['accessor funding', accessorFunding],
  ] as const) {
    await assert.rejects(
      createInitialVideoJobInExecutor(executor, invalid as never),
      /funding state/i,
      label,
    );
  }
  assert.equal(sqlCalls, 0);
  assert.equal(getterCalls, 0);
});

test('trial initial funding validates the complete private cost envelope before SQL', async () => {
  const { createInitialVideoJobInExecutor } = await import('../frontend/app/api/generate/_lib/initial-video-job');
  let sqlCalls = 0;
  const executor = { async query() { sqlCalls += 1; return []; } } as TransactionQueryExecutor;
  const baseSnapshot = includedSnapshot();
  const base = {
    jobId: QUOTE_ID,
    userId: USER_ID,
    funding: { kind: 'mcp_trial', entitlementUserId: USER_ID, quoteId: QUOTE_ID } as const,
    pendingReceipt: null,
    preferredCurrency: null,
    resolvedCurrencyLower: 'usd',
    jobInsert: {
      jobId: QUOTE_ID, userId: USER_ID, engineId: request.engineId, engineLabel: 'Seedance 2.0 Mini',
      durationSec: 5, prompt: request.prompt, thumbUrl: '/thumb.svg', aspectRatio: '16:9',
      hasAudio: true, canUpscale: false, previewFrame: '/thumb.svg', batchId: null, groupId: null,
      iterationIndex: null, iterationCount: null, renderIdsJson: null, heroRenderId: null,
      localKey: null, message: null, etaSeconds: null, etaLabel: null, provider: 'fal',
      finalPriceCents: 0, pricingSnapshotJson: JSON.stringify(baseSnapshot), costBreakdownJson: null,
      settingsSnapshotJson: JSON.stringify(request), currency: 'USD', vendorAccountId: null,
      paymentStatus: 'included_mcp_trial', stripePaymentIntentId: null, stripeChargeId: null,
      visibility: 'private' as const, indexable: false,
    },
  };
  const { normalPriceCents: _normal, ...withoutNormal } = baseSnapshot.funding;
  const { providerCostCents: _provider, ...withoutProvider } = baseSnapshot.funding;
  for (const [label, snapshot] of [
    ['missing normal price', { ...baseSnapshot, funding: withoutNormal }],
    ['missing provider cost', { ...baseSnapshot, funding: withoutProvider }],
    ['normal price mismatch', { ...baseSnapshot, funding: { ...baseSnapshot.funding, normalPriceCents: 126 } }],
    ['provider cost mismatch', { ...baseSnapshot, funding: { ...baseSnapshot.funding, providerCostCents: 56 } }],
    ['currency mismatch', { ...baseSnapshot, canonicalPricing: { ...baseSnapshot.canonicalPricing, currency: 'EUR' } }],
    ['nonzero customer charge', { ...baseSnapshot, funding: { ...baseSnapshot.funding, customerChargeCents: 1 } }],
  ] as const) {
    await assert.rejects(
      createInitialVideoJobInExecutor(executor, {
        ...base,
        jobInsert: { ...base.jobInsert, pricingSnapshotJson: JSON.stringify(snapshot) },
      }),
      /trial funding state/i,
      label,
    );
  }
  assert.equal(sqlCalls, 0);
});

test('trusted trial continuation accepts only exact data state before provider continuation', async () => {
  const exactFunding = { kind: 'mcp_trial', entitlementUserId: USER_ID, quoteId: QUOTE_ID } as const;
  const exactState = { kind: 'created' as const, jobId: QUOTE_ID, funding: exactFunding };
  const stateWithSymbol = { ...exactState } as Record<PropertyKey, unknown>;
  stateWithSymbol[Symbol('wallet')] = true;
  const stateWithHidden = { ...exactState };
  Object.defineProperty(stateWithHidden, 'recoveredCharge', { value: true, enumerable: false });
  let unknownGetterCalls = 0;
  const stateWithUnknownAccessor = { ...exactState };
  Object.defineProperty(stateWithUnknownAccessor, 'walletChargeReserved', {
    enumerable: true,
    get() { unknownGetterCalls += 1; return true; },
  });
  let fundingGetterCalls = 0;
  const stateWithFundingAccessor = {} as Record<string, unknown>;
  Object.defineProperties(stateWithFundingAccessor, {
    kind: { value: 'created', enumerable: true },
    jobId: { value: QUOTE_ID, enumerable: true },
    funding: {
      enumerable: true,
      get() { fundingGetterCalls += 1; return exactFunding; },
    },
  });
  const invalidStates = [
    { ...exactState, walletChargeReserved: true },
    { ...exactState, recoveredCharge: true },
    { ...exactState, walletReservation: 'already_reserved' },
    { ...exactState, recovery: true },
    { ...exactState, unknown: true },
    stateWithSymbol,
    stateWithHidden,
    stateWithUnknownAccessor,
    stateWithFundingAccessor,
  ];
  let providerContinuations = 0;
  for (const trustedInitialState of invalidStates) {
    const execution: IncludedTrialGenerationExecution = {
      surface: 'video', quoteId: QUOTE_ID, userId: USER_ID, request, engine: candidate().engine,
      canonicalPricing: canonicalPricing(), pricingSnapshot: includedSnapshot(), funding: exactFunding,
      trustedInitialState: trustedInitialState as never,
    };
    await assert.rejects(
      submitReservedIncludedTrialGeneration(execution, {
        executeVideo: async () => {
          providerContinuations += 1;
          return { body: { ok: true } };
        },
        executeImage: async () => assert.fail('trial is video-only'),
      }),
      /continuation state/i,
    );
  }
  assert.equal(providerContinuations, 0);
  assert.equal(unknownGetterCalls, 0);
  assert.equal(fundingGetterCalls, 0);
});

test('external billing rejects mcp_trial and included_mcp_trial payment attempts as unsupported public modes', async () => {
  const { resolveGenerateBillingPreflight } = await import('../frontend/app/api/generate/_lib/billing-preflight');
  const base = {
    req: { headers: new Headers() },
    engine: candidate().engine,
    mode: 't2v' as const,
    userId: USER_ID,
    jobId: QUOTE_ID,
    durationSec: 5,
    durationLabel: '5s',
    pricingResolution: '480p',
    effectiveResolution: '480p',
    aspectRatio: '16:9',
    membershipTier: 'member',
    isLumaRay2: false,
    loop: false,
    rawDurationOption: 5,
    lumaDurationLabel: null,
    audioEnabled: true,
    voiceControl: false,
    deps: {
      getUserPreferredCurrencyFn: async () => 'usd' as const,
      resolveCurrencyFn: () => ({ currency: 'usd' as const, source: 'default' as const, country: null }),
      applyEngineVariantPricingFn: (engine: EngineCaps) => engine,
      buildEngineAddonInputFn: () => ({}),
      computePricingSnapshotFn: async () => canonicalPricing() as never,
      convertCentsFn: async () => ({ cents: 125, rate: 1, source: 'identity' as const }),
      receiptsPriceOnlyEnabledFn: () => false,
      buildReceiptSnapshotFn: (pricing: unknown) => pricing as never,
      getPlatformFeeCentsFn: () => 0,
    },
  };
  for (const mode of ['mcp_trial', 'included_mcp_trial']) {
    const result = await resolveGenerateBillingPreflight({
      ...base,
      payment: { mode: mode as never, paymentIntentId: null },
    } as never);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.equal(result.body.error, 'Unsupported payment mode');
    }
  }
});
