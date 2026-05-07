import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { resolveGenerateBillingPreflight } from '../frontend/app/api/generate/_lib/billing-preflight';
import type { PricingSnapshot } from '../frontend/types/engines';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/billing-preflight.ts');

const routeSource = readFileSync(routePath, 'utf8');
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

test('generate route delegates billing and payment preflight', () => {
  assert.ok(existsSync(helperPath), 'billing preflight should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/billing-preflight'/);
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
    membershipTier: 'pro',
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
    applicationFeeCents: null,
    vendorAccountId: null,
  });
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
          job_id: 'job_123',
          wallet_amount_cents: '1000',
          settlement_amount_cents: '1200',
        },
      }),
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
        metadata: {},
      }),
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.metric, { errorCode: 'PAYMENT_NOT_CAPTURED', meta: { paymentIntentId: 'pi_123' } });
  assert.equal(result.status, 402);
  assert.deepEqual(result.body, { ok: false, error: 'Payment not captured yet' });
});
