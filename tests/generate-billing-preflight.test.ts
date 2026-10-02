import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { resolveGenerateBillingPreflight } from '../frontend/app/api/generate/_lib/billing-preflight';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { MINIMAX_H3_MAX_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3-max';
import type { PricingSnapshot } from '../frontend/types/engines';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/billing-preflight.ts');

const routeSource = readFileSync(routePath, 'utf8');
const serviceSource = readFileSync(join(root, 'frontend/src/server/video-generation/execute-video-generation.ts'), 'utf8');
const helperSource = existsSync(helperPath) ? readFileSync(helperPath, 'utf8') : '';

const engine = {
  id: 'seedance-2-0',
  label: 'Seedance 2.0',
  pricingDetails: undefined,
} as never;

const pricing = {
  totalCents: 1200,
  currency: 'USD',
  meta: { cost_breakdown_usd: { provider: 400 } },
} as PricingSnapshot;

function createReq(country = 'US') {
  return {
    headers: {
      get(name: string) {
        return name === 'x-vercel-ip-country' ? country : null;
      },
    },
  } as never;
}

test('a stale manual customer tariff rejects before currency conversion or payment preparation', async () => {
  let converted = false;
  const result = await resolveGenerateBillingPreflight({
    req: createReq(), engine, mode: 't2v', userId: 'user_123', payment: { mode: 'wallet' },
    jobId: 'stale-tariff', durationSec: 5, durationLabel: '5s', pricingResolution: '720p',
    effectiveResolution: '720p', aspectRatio: '16:9', membershipTier: 'member', isLumaRay2: false,
    loop: false, rawDurationOption: null, lumaDurationLabel: null, audioEnabled: false, voiceControl: false,
    deps: { getUserPreferredCurrencyFn: async () => 'usd', resolveCurrencyFn: () => ({ currency: 'usd', source: 'user_pref' }),
      computePricingSnapshotFn: async () => ({ ...pricing, meta: { pricingMode: 'manual_tariff', customerTariffRevision: 7 } }),
      convertCentsFn: async () => { converted = true; return { cents: 1200, rate: 1, source: 'test' }; },
      applyEngineVariantPricingFn: (value) => value, buildEngineAddonInputFn: () => ({}) },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'PRICING_REFRESH_REQUIRED');
  assert.equal(converted, false);
});

test('generate route delegates billing and payment preflight', () => {
  assert.ok(existsSync(helperPath), 'billing preflight should live in the generate route _lib folder');
  assert.match(serviceSource, /generate\/_lib\/billing-preflight/);
  assert.doesNotMatch(routeSource, /computePricingSnapshot/, 'pricing computation belongs in billing-preflight.ts');
  assert.doesNotMatch(routeSource, /new Stripe/, 'direct payment preflight belongs in billing-preflight.ts');
  assert.doesNotMatch(routeSource, /getUserPreferredCurrency/, 'currency preference lookup belongs in billing-preflight.ts');
  assert.doesNotMatch(routeSource, /buildReceiptSnapshot/, 'receipt snapshot selection belongs in billing-preflight.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 1745, `/api/generate route should stay below 1745 lines after billing preflight extraction, got ${lineCount}`);
});

test('billing preflight helper exposes the route contract', () => {
  assert.match(helperSource, /export type GenerateBillingPreflight/, 'GenerateBillingPreflight should be exported');
  assert.match(helperSource, /export async function resolveGenerateBillingPreflight/, 'billing preflight resolver should be exported');
});

test('billing preflight builds wallet receipts and pricing metadata', async () => {
  const result = await resolveGenerateBillingPreflight({
    req: createReq('FR'),
    engine,
    mode: 't2v',
    userId: 'user_123',
    payment: { mode: 'wallet', paymentIntentId: null },
    jobId: 'job_123',
    durationSec: 8,
    durationLabel: '8s',
    pricingResolution: '1080p',
    effectiveResolution: '1080p',
    aspectRatio: '16:9',
    membershipTier: 'member',
    isLumaRay2: false,
    loop: false,
    rawDurationOption: null,
    lumaDurationLabel: null,
    audioEnabled: true,
    voiceControl: false,
    deps: {
      getUserPreferredCurrencyFn: async () => 'eur',
      resolveCurrencyFn: () => ({ currency: 'eur', source: 'user_pref' }),
      computePricingSnapshotFn: async () => ({ ...pricing, meta: { ...pricing.meta } }),
      convertCentsFn: async () => ({ cents: 1104, rate: 0.92, source: 'test' }),
      getPlatformFeeCentsFn: () => 300,
      receiptsPriceOnlyEnabledFn: () => true,
      buildReceiptSnapshotFn: () => ({ totalCents: 1200, currency: 'USD' }),
      applyEngineVariantPricingFn: (value) => value,
      buildEngineAddonInputFn: () => ({ audio: true }),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.preflight.paymentMode, 'wallet');
  assert.equal(result.preflight.paymentStatus, 'paid_wallet');
  assert.equal(result.preflight.preferredCurrency, 'eur');
  assert.equal(result.preflight.resolvedCurrencyUpper, 'EUR');
  assert.deepEqual(result.preflight.pricing.meta?.request, {
    engineId: 'seedance-2-0',
    engineLabel: 'Seedance 2.0',
    mode: 't2v',
    durationSec: 8,
    variant: undefined,
    aspectRatio: '16:9',
    resolution: '1080p',
    effectiveResolution: '1080p',
    durationLabel: '8s',
  });
  assert.equal(result.preflight.pricing.meta?.settlement_amount_cents, 1104);
  assert.equal(result.preflight.pricingSnapshotJson, '{"totalCents":1200,"currency":"USD"}');
  assert.equal(result.preflight.costBreakdownJson, null);
  assert.deepEqual(result.preflight.pendingReceipt, {
    userId: 'user_123',
    amountCents: 1200,
    currency: 'USD',
    description: 'Run Seedance 2.0 - 8s',
    jobId: 'job_123',
    snapshot: { totalCents: 1200, currency: 'USD' },
    auditPricingSnapshot: result.preflight.pricing,
    applicationFeeCents: null,
    vendorAccountId: null,
  });
});

test('billing preflight passes aspect ratio into pricing calculation', async () => {
  let capturedAspectRatio: unknown = undefined;

  const result = await resolveGenerateBillingPreflight({
    req: createReq('US'),
    engine,
    mode: 't2v',
    userId: 'user_123',
    payment: { mode: 'wallet', paymentIntentId: null },
    jobId: 'job_123',
    durationSec: 12,
    durationLabel: '12s',
    pricingResolution: '720p',
    effectiveResolution: '720p',
    aspectRatio: '1:1',
    membershipTier: 'member',
    isLumaRay2: false,
    loop: false,
    rawDurationOption: null,
    lumaDurationLabel: null,
    audioEnabled: true,
    voiceControl: false,
    deps: {
      getUserPreferredCurrencyFn: async () => 'usd',
      resolveCurrencyFn: () => ({ currency: 'usd', source: 'user_pref' }),
      computePricingSnapshotFn: async (context) => {
        capturedAspectRatio = context.aspectRatio;
        return { ...pricing, totalCents: 202, meta: { ...pricing.meta } };
      },
      convertCentsFn: async () => ({ cents: 202, rate: 1, source: 'test' }),
      getPlatformFeeCentsFn: () => 0,
      receiptsPriceOnlyEnabledFn: () => true,
      buildReceiptSnapshotFn: (value) => ({ totalCents: value.totalCents, currency: value.currency }),
      applyEngineVariantPricingFn: (value) => value,
      buildEngineAddonInputFn: () => ({ audio: true }),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(capturedAspectRatio, '1:1');
  assert.equal(result.preflight.pricing.totalCents, 202);
});

test('billing preflight passes the Seedance video-input class into canonical pricing', async () => {
  let capturedHasVideoInput: unknown = undefined;
  const seedance25Engine = listFalEngines().find((entry) => entry.id === 'seedance-2-5')?.engine;
  assert.ok(seedance25Engine);

  const result = await resolveGenerateBillingPreflight({
    req: createReq('US'),
    engine: seedance25Engine,
    mode: 'v2v',
    userId: 'user_123',
    payment: { mode: 'wallet', paymentIntentId: null },
    jobId: 'job_123',
    durationSec: 15,
    durationLabel: '15s',
    pricingResolution: '720p',
    effectiveResolution: '720p',
    aspectRatio: '16:9',
    membershipTier: 'member',
    isLumaRay2: false,
    loop: false,
    hasVideoInput: true,
    rawDurationOption: null,
    lumaDurationLabel: null,
    audioEnabled: true,
    voiceControl: false,
    deps: {
      getUserPreferredCurrencyFn: async () => 'usd',
      resolveCurrencyFn: () => ({ currency: 'usd', source: 'user_pref' }),
      computePricingSnapshotFn: async (context) => {
        capturedHasVideoInput = context.hasVideoInput;
        return { ...pricing, meta: { ...pricing.meta } };
      },
      convertCentsFn: async () => ({ cents: 1200, rate: 1, source: 'test' }),
      getPlatformFeeCentsFn: () => 0,
      receiptsPriceOnlyEnabledFn: () => true,
      buildReceiptSnapshotFn: (value) => ({
        totalCents: value.totalCents,
        currency: value.currency,
      }),
      applyEngineVariantPricingFn: (value) => value,
      buildEngineAddonInputFn: () => ({ audio: true }),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(capturedHasVideoInput, true);
});

test('billing preflight persists verified media counts and durations in the canonical pricing context', async () => {
  let capturedContext: Record<string, unknown> | null = null;
  const result = await resolveGenerateBillingPreflight({
    req: createReq('US'),
    engine,
    mode: 'a2v',
    userId: 'user_123',
    payment: { mode: 'wallet', paymentIntentId: null },
    jobId: 'job_p0_audio',
    durationSec: 6,
    durationLabel: '6s',
    pricingResolution: '1080p',
    effectiveResolution: '1080p',
    aspectRatio: '16:9',
    membershipTier: 'member',
    isLumaRay2: false,
    loop: false,
    referenceImageCount: 3,
    inputImageCount: 4,
    inputVideoDurationSec: 7.5,
    inputAudioDurationSec: 9.25,
    rawDurationOption: null,
    lumaDurationLabel: null,
    audioEnabled: true,
    voiceControl: false,
    deps: {
      getUserPreferredCurrencyFn: async () => 'usd',
      resolveCurrencyFn: () => ({ currency: 'usd', source: 'user_pref' }),
      computePricingSnapshotFn: async (context) => {
        capturedContext = context as unknown as Record<string, unknown>;
        return { ...pricing, meta: { ...pricing.meta } };
      },
      convertCentsFn: async () => ({ cents: 1200, rate: 1, source: 'test' }),
      getPlatformFeeCentsFn: () => 0,
      receiptsPriceOnlyEnabledFn: () => false,
      buildReceiptSnapshotFn: (value) => value,
      applyEngineVariantPricingFn: (value) => value,
      buildEngineAddonInputFn: () => ({}),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(capturedContext?.referenceImageCount, 3);
  assert.equal(capturedContext?.inputImageCount, 4);
  assert.equal(capturedContext?.inputVideoDurationSec, 7.5);
  assert.equal(capturedContext?.inputAudioDurationSec, 9.25);
  assert.equal(result.preflight.pricing.meta?.request?.referenceImageCount, 3);
  assert.equal(result.preflight.pricing.meta?.request?.inputImageCount, 4);
  assert.equal(result.preflight.pricing.meta?.request?.inputVideoDurationSec, 7.5);
  assert.equal(result.preflight.pricing.meta?.request?.inputAudioDurationSec, 9.25);
  assert.equal(result.preflight.receiptSnapshot.meta?.request?.inputAudioDurationSec, 9.25);
});

test('billing preflight forwards only server-trusted H3 Max reference tokens into wallet pricing', async () => {
  let capturedContext: Record<string, unknown> | null = null;
  const result = await resolveGenerateBillingPreflight({
    req: createReq('US'),
    engine: MINIMAX_H3_MAX_ENGINE,
    mode: 'ref2v',
    userId: 'user_h3_max',
    payment: { mode: 'wallet', paymentIntentId: null },
    jobId: 'job_h3_max',
    durationSec: 5,
    durationLabel: '5s',
    pricingResolution: '768P',
    effectiveResolution: '768P',
    aspectRatio: null,
    membershipTier: 'member',
    isLumaRay2: false,
    loop: false,
    trustedMediaPricingFacts: { verifiedReferenceTokenCount: 4_597 },
    rawDurationOption: 5,
    lumaDurationLabel: null,
    audioEnabled: undefined,
    voiceControl: false,
    deps: {
      getUserPreferredCurrencyFn: async () => 'usd',
      resolveCurrencyFn: () => ({ currency: 'usd', source: 'user_pref' }),
      computePricingSnapshotFn: async (context) => {
        capturedContext = context as unknown as Record<string, unknown>;
        return { ...pricing, totalCents: 41, meta: { ...pricing.meta } };
      },
      convertCentsFn: async (cents) => ({ cents, rate: 1, source: 'identity' }),
      getPlatformFeeCentsFn: () => 0,
      receiptsPriceOnlyEnabledFn: () => false,
      buildReceiptSnapshotFn: (value) => value,
      applyEngineVariantPricingFn: (value) => value,
      buildEngineAddonInputFn: () => ({}),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(capturedContext?.verifiedReferenceTokenCount, 4_597);
  if (!result.ok) return;
  assert.equal(
    (result.preflight.pricing.meta?.request as { verifiedReferenceTokenCount?: number })
      .verifiedReferenceTokenCount,
    4_597,
  );
});

test('billing preflight fails H3 Max reference pricing closed before wallet reservation without trusted tokens', async () => {
  let pricingCalls = 0;
  const result = await resolveGenerateBillingPreflight({
    req: createReq('US'),
    engine: MINIMAX_H3_MAX_ENGINE,
    mode: 'ref2v',
    userId: 'user_h3_max',
    payment: { mode: 'wallet', paymentIntentId: null },
    jobId: 'job_h3_max_missing_tokens',
    durationSec: 5,
    durationLabel: '5s',
    pricingResolution: '768P',
    effectiveResolution: '768P',
    aspectRatio: null,
    membershipTier: 'member',
    isLumaRay2: false,
    loop: false,
    rawDurationOption: 5,
    lumaDurationLabel: null,
    audioEnabled: undefined,
    voiceControl: false,
    deps: {
      getUserPreferredCurrencyFn: async () => 'usd',
      resolveCurrencyFn: () => ({ currency: 'usd', source: 'user_pref' }),
      computePricingSnapshotFn: async () => {
        pricingCalls += 1;
        return { ...pricing, meta: { ...pricing.meta } };
      },
      applyEngineVariantPricingFn: (value) => value,
      buildEngineAddonInputFn: () => ({}),
    },
  });

  assert.deepEqual(result, {
    ok: false,
    status: 422,
    body: {
      ok: false,
      error: 'PRICING_MEDIA_FACTS_UNVERIFIED',
      message: 'Trusted reference-token pricing metadata is required.',
    },
    metric: { errorCode: 'PRICING_MEDIA_FACTS_UNVERIFIED' },
  });
  assert.equal(pricingCalls, 0);
});

test('billing preflight passes trusted inherited edit duration independently of the selected duration', async () => {
  for (const mode of ['v2v', 'retake'] as const) {
    let capturedContext: Record<string, unknown> | null = null;
    const result = await resolveGenerateBillingPreflight({
      req: createReq('US'),
      engine,
      mode,
      userId: 'user_123',
      payment: { mode: 'wallet', paymentIntentId: null },
      jobId: `job_${mode}`,
      durationSec: 10,
      inheritedDurationSec: 4,
      durationLabel: '10s',
      pricingResolution: '720p',
      effectiveResolution: '720p',
      aspectRatio: '16:9',
      membershipTier: 'member',
      isLumaRay2: false,
      loop: false,
      inputVideoDurationSec: mode === 'v2v' ? 4 : 0,
      rawDurationOption: 10,
      lumaDurationLabel: null,
      audioEnabled: true,
      voiceControl: false,
      deps: {
        getUserPreferredCurrencyFn: async () => 'usd',
        resolveCurrencyFn: () => ({ currency: 'usd', source: 'user_pref' }),
        computePricingSnapshotFn: async (context) => {
          capturedContext = context as unknown as Record<string, unknown>;
          return { ...pricing, meta: { ...pricing.meta } };
        },
        convertCentsFn: async () => ({ cents: 1200, rate: 1, source: 'test' }),
        getPlatformFeeCentsFn: () => 0,
        receiptsPriceOnlyEnabledFn: () => true,
        buildReceiptSnapshotFn: (value) => ({ totalCents: value.totalCents, currency: value.currency }),
        applyEngineVariantPricingFn: (value) => value,
        buildEngineAddonInputFn: () => ({}),
      },
    });

    assert.equal(result.ok, true);
    assert.equal(capturedContext?.durationSec, 10);
    assert.equal(capturedContext?.inheritedDurationSec, 4);
    assert.equal(result.preflight.pricing.meta?.request?.inheritedDurationSec, 4);
    assert.equal(result.preflight.pricingSnapshotJson, '{"totalCents":1200,"currency":"USD"}');
  }
});

test('billing preflight accepts captured direct payment intents', async () => {
  const ensuredCurrencies: string[] = [];
  const result = await resolveGenerateBillingPreflight({
    req: createReq(),
    engine,
    mode: 't2v',
    userId: 'user_123',
    payment: { mode: 'direct', paymentIntentId: 'pi_123' },
    jobId: 'job_123',
    durationSec: 8,
    durationLabel: undefined,
    pricingResolution: '720p',
    effectiveResolution: '720p',
    aspectRatio: null,
    membershipTier: undefined,
    isLumaRay2: false,
    loop: false,
    rawDurationOption: null,
    lumaDurationLabel: null,
    audioEnabled: false,
    voiceControl: false,
    deps: {
      getUserPreferredCurrencyFn: async () => null,
      resolveCurrencyFn: () => ({ currency: 'usd', source: 'default' }),
      computePricingSnapshotFn: async () => ({ ...pricing, meta: { ...pricing.meta } }),
      convertCentsFn: async () => ({ cents: 1200, rate: 1, source: 'test' }),
      getPlatformFeeCentsFn: () => 300,
      receiptsPriceOnlyEnabledFn: () => false,
      buildReceiptSnapshotFn: (value) => ({ totalCents: value.totalCents, currency: value.currency }),
      applyEngineVariantPricingFn: (value) => value,
      buildEngineAddonInputFn: () => ({}),
      retrievePaymentIntentFn: async () => ({
        id: 'pi_123',
        status: 'succeeded',
        amount: 1200,
        amount_received: 1200,
        currency: 'usd',
        latest_charge: { id: 'ch_123' },
        metadata: {
          kind: 'run', user_id: 'user_123', direct_quote_id: 'quote_123',
          job_id: 'job_123',
          wallet_amount_cents: '1000',
          settlement_amount_cents: '1200',
        },
      }),
      loadDirectPaymentQuoteFn: async () => directQuoteFixture(1000),
      ensureUserPreferredCurrencyFn: async (_userId, currency) => {
        ensuredCurrencies.push(currency);
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.preflight.paymentStatus, 'paid_direct');
  assert.equal(result.preflight.stripePaymentIntentId, 'pi_123');
  assert.equal(result.preflight.stripeChargeId, 'ch_123');
  assert.deepEqual(ensuredCurrencies, ['usd']);
  assert.equal(result.preflight.pendingReceipt?.amountCents, 1000);
  assert.equal(result.preflight.pendingReceipt?.stripePaymentIntentId, 'pi_123');
  assert.equal(result.preflight.pendingReceipt?.stripeChargeId, 'ch_123');
});

test('billing preflight rejects underpaid direct payment intents', async () => {
  const result = await resolveGenerateBillingPreflight({
    req: createReq(),
    engine,
    mode: 't2v',
    userId: 'user_123',
    payment: { mode: 'direct', paymentIntentId: 'pi_123' },
    jobId: 'job_123',
    durationSec: 8,
    durationLabel: undefined,
    pricingResolution: '720p',
    effectiveResolution: '720p',
    aspectRatio: null,
    membershipTier: undefined,
    isLumaRay2: false,
    loop: false,
    rawDurationOption: null,
    lumaDurationLabel: null,
    audioEnabled: false,
    voiceControl: false,
    deps: {
      getUserPreferredCurrencyFn: async () => 'usd',
      resolveCurrencyFn: () => ({ currency: 'usd', source: 'user_pref' }),
      computePricingSnapshotFn: async () => ({ ...pricing, meta: { ...pricing.meta } }),
      convertCentsFn: async () => ({ cents: 1200, rate: 1, source: 'test' }),
      getPlatformFeeCentsFn: () => 300,
      receiptsPriceOnlyEnabledFn: () => false,
      buildReceiptSnapshotFn: (value) => ({ totalCents: value.totalCents, currency: value.currency }),
      applyEngineVariantPricingFn: (value) => value,
      buildEngineAddonInputFn: () => ({}),
      retrievePaymentIntentFn: async () => ({
        id: 'pi_123',
        status: 'succeeded',
        amount: 800,
        amount_received: 800,
        currency: 'usd',
        latest_charge: 'ch_123',
        metadata: { kind: 'run', user_id: 'user_123', job_id: 'job_123', direct_quote_id: 'quote_123' },
      }),
      loadDirectPaymentQuoteFn: async () => directQuoteFixture(1200),
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.metric, { errorCode: 'PAYMENT_NOT_CAPTURED', meta: { paymentIntentId: 'pi_123' } });
  assert.equal(result.status, 402);
  assert.deepEqual(result.body, { ok: false, error: 'PAYMENT_NOT_CAPTURED' });
});


test('captured direct generation keeps its original quote after a tariff edit without current-price or FX reads', async () => {
  const original = { totalCents: 1000, currency: 'USD', meta: { pricingMode: 'manual_tariff', customerTariffRevision: 7 } } as PricingSnapshot;
  const result = await resolveGenerateBillingPreflight({
    req: createReq(), engine, mode: 't2v', userId: 'user_123', payment: { mode: 'direct', paymentIntentId: 'pi_123' },
    jobId: 'job_123', durationSec: 8, durationLabel: undefined, pricingResolution: '720p', effectiveResolution: '720p',
    aspectRatio: null, membershipTier: 'plus', isLumaRay2: false, loop: false, rawDurationOption: null,
    lumaDurationLabel: null, audioEnabled: false, voiceControl: false,
    deps: {
      getUserPreferredCurrencyFn: async () => 'usd', resolveCurrencyFn: () => ({ currency: 'usd', source: 'user_pref' }),
      computePricingSnapshotFn: async () => { throw new Error('A captured payment must not be requoted'); },
      convertCentsFn: async () => { throw new Error('A captured payment must not use current FX'); },
      getPlatformFeeCentsFn: () => 0, receiptsPriceOnlyEnabledFn: () => false,
      applyEngineVariantPricingFn: (value: unknown) => value, buildEngineAddonInputFn: () => ({}),
      retrievePaymentIntentFn: async () => ({ id: 'pi_123', status: 'succeeded', amount: 1100, amount_received: 1100,
        currency: 'usd', latest_charge: 'ch_123', metadata: { kind: 'run', user_id: 'user_123', job_id: 'job_123', direct_quote_id: 'quote_123' } }),
      loadDirectPaymentQuoteFn: async () => ({ id: 'quote_123', userId: 'user_123', jobId: 'job_123',
        scenario: { engineId: 'seedance-2-0', mode: 't2v', durationSec: 8, resolution: '720p', aspectRatio: null, loop: false, audioEnabled: false, voiceControl: false },
        pricing: original, settlement: { currency: 'USD', amountCents: 1100, fxRate: 1.1, fxSource: 'original' } }),
    } as never,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.preflight.pricing.totalCents, 1000);
  assert.equal(result.preflight.pricing.meta?.customerTariffRevision, 7);
  assert.equal(result.preflight.pendingReceipt?.amountCents, 1000);
  assert.equal(result.preflight.pendingReceipt?.auditPricingSnapshot?.meta?.customerTariffRevision, 7);
  assert.equal(result.preflight.pricing.meta?.settlement_amount_cents, 1100);
  assert.equal(result.preflight.pricing.meta?.settlement_fx_source, 'original');
});

function directQuoteFixture(totalCents: number) {
  return { id: 'quote_123', userId: 'user_123', jobId: 'job_123',
    scenario: { engineId: engine.id, mode: 't2v' as const, durationSec: 8, resolution: '720p', aspectRatio: null, loop: false, audioEnabled: false, voiceControl: false },
    pricing: { ...pricing, totalCents }, settlement: { currency: 'USD', amountCents: 1200, fxRate: 1.2, fxSource: 'original' } };
}
test('captured EUR settlement survives a later USD profile currency without current-price or FX reads', async () => {
  const original = { totalCents: 1000, currency: 'USD', meta: { pricingMode: 'manual_tariff', customerTariffRevision: 7 } } as PricingSnapshot;
  const result = await resolveGenerateBillingPreflight({
    req: createReq(), engine, mode: 't2v', userId: 'user_123', payment: { mode: 'direct', paymentIntentId: 'pi_123' },
    jobId: 'job_123', durationSec: 8, durationLabel: undefined, pricingResolution: '720p', effectiveResolution: '720p',
    aspectRatio: null, membershipTier: 'plus', isLumaRay2: false, loop: false, rawDurationOption: null,
    lumaDurationLabel: null, audioEnabled: false, voiceControl: false,
    deps: {
      getUserPreferredCurrencyFn: async () => 'usd', resolveCurrencyFn: () => ({ currency: 'usd', source: 'user_pref' }),
      computePricingSnapshotFn: async () => { throw new Error('A captured payment must not be requoted'); },
      convertCentsFn: async () => { throw new Error('A captured payment must not use current FX'); },
      getPlatformFeeCentsFn: () => 0, receiptsPriceOnlyEnabledFn: () => false,
      applyEngineVariantPricingFn: (value: unknown) => value, buildEngineAddonInputFn: () => ({}),
      retrievePaymentIntentFn: async () => ({ id: 'pi_123', status: 'succeeded', amount: 1100, amount_received: 1100,
        currency: 'eur', latest_charge: 'ch_123', metadata: { kind: 'run', user_id: 'user_123', job_id: 'job_123', direct_quote_id: 'quote_123' } }),
      loadDirectPaymentQuoteFn: async () => ({ id: 'quote_123', userId: 'user_123', jobId: 'job_123',
        scenario: { engineId: 'seedance-2-0', mode: 't2v', durationSec: 8, resolution: '720p', aspectRatio: null, loop: false, audioEnabled: false, voiceControl: false },
        pricing: original, settlement: { currency: 'EUR', amountCents: 1100, fxRate: 1.1, fxSource: 'original' } }),
    } as never,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.preflight.resolvedCurrencyUpper, 'EUR');
  assert.equal(result.preflight.pricing.meta?.settlement_currency, 'EUR');
  assert.equal(result.preflight.pricing.totalCents, 1000);
  assert.equal(result.preflight.pricing.meta?.customerTariffRevision, 7);
  assert.equal(result.preflight.pendingReceipt?.amountCents, 1000);
  assert.equal(result.preflight.pendingReceipt?.auditPricingSnapshot?.meta?.customerTariffRevision, 7);
  assert.equal(result.preflight.pricing.meta?.settlement_amount_cents, 1100);
  assert.equal(result.preflight.pricing.meta?.settlement_fx_source, 'original');
});
test('captured explicit audio-off quote cannot fund a request that omits audio and gets the provider default', async () => {
  const original = { totalCents: 1000, currency: 'USD', meta: { pricingMode: 'manual_tariff', customerTariffRevision: 7 } } as PricingSnapshot;
  const result = await resolveGenerateBillingPreflight({
    req: createReq(), engine, mode: 't2v', userId: 'user_123', payment: { mode: 'direct', paymentIntentId: 'pi_123' },
    jobId: 'job_123', durationSec: 8, durationLabel: undefined, pricingResolution: '720p', effectiveResolution: '720p',
    aspectRatio: null, membershipTier: 'plus', isLumaRay2: false, loop: false, rawDurationOption: null,
    lumaDurationLabel: null, audioEnabled: undefined, voiceControl: false,
    deps: {
      getUserPreferredCurrencyFn: async () => 'usd', resolveCurrencyFn: () => ({ currency: 'usd', source: 'user_pref' }),
      computePricingSnapshotFn: async () => { throw new Error('A captured payment must not be requoted'); },
      convertCentsFn: async () => { throw new Error('A captured payment must not use current FX'); },
      getPlatformFeeCentsFn: () => 0, receiptsPriceOnlyEnabledFn: () => false,
      applyEngineVariantPricingFn: (value: unknown) => value, buildEngineAddonInputFn: () => ({}),
      retrievePaymentIntentFn: async () => ({ id: 'pi_123', status: 'succeeded', amount: 1100, amount_received: 1100,
        currency: 'usd', latest_charge: 'ch_123', metadata: { kind: 'run', user_id: 'user_123', job_id: 'job_123', direct_quote_id: 'quote_123' } }),
      loadDirectPaymentQuoteFn: async () => ({ id: 'quote_123', userId: 'user_123', jobId: 'job_123',
        scenario: { engineId: 'seedance-2-0', mode: 't2v', durationSec: 8, resolution: '720p', aspectRatio: null, loop: false, audioEnabled: false, voiceControl: false },
        pricing: original, settlement: { currency: 'USD', amountCents: 1100, fxRate: 1.1, fxSource: 'original' } }),
    } as never,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'PAYMENT_BINDING_MISMATCH');
});
test('a normalized loop survives paid continuation for engines beyond Ray 2', async () => {
  const original = { totalCents: 1000, currency: 'USD', meta: { pricingMode: 'manual_tariff', customerTariffRevision: 7 } } as PricingSnapshot;
  const result = await resolveGenerateBillingPreflight({
    req: createReq(), engine, mode: 't2v', userId: 'user_123', payment: { mode: 'direct', paymentIntentId: 'pi_123' },
    jobId: 'job_123', durationSec: 8, durationLabel: undefined, pricingResolution: '720p', effectiveResolution: '720p',
    aspectRatio: null, membershipTier: 'plus', isLumaRay2: false, loop: true, rawDurationOption: null,
    lumaDurationLabel: null, audioEnabled: false, voiceControl: false,
    deps: {
      getUserPreferredCurrencyFn: async () => 'usd', resolveCurrencyFn: () => ({ currency: 'usd', source: 'user_pref' }),
      computePricingSnapshotFn: async () => { throw new Error('A captured payment must not be requoted'); },
      convertCentsFn: async () => { throw new Error('A captured payment must not use current FX'); },
      getPlatformFeeCentsFn: () => 0, receiptsPriceOnlyEnabledFn: () => false,
      applyEngineVariantPricingFn: (value: unknown) => value, buildEngineAddonInputFn: () => ({}),
      retrievePaymentIntentFn: async () => ({ id: 'pi_123', status: 'succeeded', amount: 1100, amount_received: 1100,
        currency: 'usd', latest_charge: 'ch_123', metadata: { kind: 'run', user_id: 'user_123', job_id: 'job_123', direct_quote_id: 'quote_123' } }),
      loadDirectPaymentQuoteFn: async () => ({ id: 'quote_123', userId: 'user_123', jobId: 'job_123',
        scenario: { engineId: 'seedance-2-0', mode: 't2v', durationSec: 8, resolution: '720p', aspectRatio: null, loop: true, audioEnabled: false, voiceControl: false },
        pricing: original, settlement: { currency: 'USD', amountCents: 1100, fxRate: 1.1, fxSource: 'original' } }),
    } as never,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.preflight.pricing.totalCents, 1000);
  assert.equal(result.preflight.pricing.meta?.customerTariffRevision, 7);
  assert.equal(result.preflight.pendingReceipt?.amountCents, 1000);
  assert.equal(result.preflight.pendingReceipt?.auditPricingSnapshot?.meta?.customerTariffRevision, 7);
  assert.equal(result.preflight.pricing.meta?.settlement_amount_cents, 1100);
  assert.equal(result.preflight.pricing.meta?.settlement_fx_source, 'original');
});
