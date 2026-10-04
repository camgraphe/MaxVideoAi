import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { chooseCustomerTariffScenario } from '../frontend/server/pricing-admin/customer-tariff-service';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { resolveGenerateBillingPreflight } from '../frontend/app/api/generate/_lib/billing-preflight';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { resolveCapturedDirectPaymentQuote } from '../frontend/server/pricing/direct-payment-quotes';

test('HDR and EXR have distinct supported admin/public cells; omitted and disabled effects alias SDR', () => {
  const engine = getFalEngineById('luma-ray-3-2')!.engine;
  const rows = collectSellableManualTariffCoverage().scenarios.filter(row => row.modelId === engine.id);
  for (const mode of ['t2v', 'i2v', 'v2v'] as const) for (const resolution of ['720p', '1080p']) {
    const input = { modelId: engine.id, mode, durationSec: 5, resolution };
    const sdr = resolvePublicModelScenario(input)!;
    const hdr = resolvePublicModelScenario({ ...input, hdr: true })!;
    const exr = resolvePublicModelScenario({ ...input, hdr: true, exrExport: true })!;
    assert.ok(sdr && hdr && exr);
    assert.equal(hdr.selector.hdr, 'true');
    assert.equal(exr.selector.exrExport, 'true');
    assert.notEqual(sdr.id, hdr.id);
    assert.notEqual(hdr.id, exr.id);
    for (const scenario of [sdr, hdr, exr]) {
      const chosen = chooseCustomerTariffScenario(rows, scenario.selector);
      assert.equal(chosen.scenario.id, scenario.id);
      const facts = buildBillingPricingFacts(scenario.context, engine.pricingDetails, 'USD').facts;
      assert.deepEqual(buildManualTariffScenario(scenario.context, facts).selector, scenario.selector);
    }
    const disabled = { ...sdr.context, addons: { hdr: false, exr_export: false } };
    assert.deepEqual(buildManualTariffScenario(disabled, buildBillingPricingFacts(disabled, engine.pricingDetails, 'USD').facts).selector, sdr.selector);
    assert.equal(resolvePublicModelScenario({ ...input, exrExport: true }), null);
    assert.equal(resolvePublicModelScenario({ ...input, resolution: '540p', hdr: true }), null);
    assert.equal(resolvePublicModelScenario({ ...input, durationSec: 10, hdr: true }), null);
  }
  assert.ok(!collectSellableManualTariffCoverage().gaps.some(gap => gap.reason.includes('HDR/EXR')));
});

test('generation bills the same validated HDR/EXR options as preflight, keeping SDR unchanged', async () => {
  const engine = getFalEngineById('luma-ray-3-2')!.engine;
  for (const [validatedExtraInputValues, expected] of [[{}, 130], [{ hdr: true }, 260], [{ hdr: true, exr_export: true }, 390]] as const) {
    const result = await resolveGenerateBillingPreflight({ req: { headers: { get: () => null } } as never,
      engine, mode: 't2v', userId: 'local-test', payment: { mode: 'wallet' }, jobId: 'extra-test', durationSec: 5,
      durationLabel: '5s', pricingResolution: '720p', effectiveResolution: '720p', aspectRatio: '16:9', membershipTier: null,
      isLumaRay2: false, loop: false, rawDurationOption: 5, lumaDurationLabel: null, audioEnabled: false, voiceControl: false,
      validatedExtraInputValues,
      deps: { getUserPreferredCurrencyFn: async () => 'usd', resolveCurrencyFn: () => ({ currency: 'usd', source: 'user_pref' }),
        computePricingSnapshotFn: context => computeCanonicalBillingSnapshot(context, {
          pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
          loadCustomerTariffState: async () => ({ status: 'loaded', active: false, revision: 0, versionedCells: [], databaseCells: [] }) }),
        convertCentsFn: async cents => ({ cents, rate: 1, source: 'test' }), getPlatformFeeCentsFn: () => 0,
        receiptsPriceOnlyEnabledFn: () => true, buildReceiptSnapshotFn: pricing => pricing },
    });
    assert.ok(result.ok);
    assert.equal(result.preflight.pricing.totalCents, expected);
  }
});

test('captured direct payments bind HDR/EXR and preserve historical SDR quotes', async () => {
  const scenario = { engineId: 'luma-ray-3-2', mode: 't2v' as const, durationSec: 5, resolution: '720p',
    aspectRatio: '16:9', loop: false, audioEnabled: false, voiceControl: false };
  const quote = { id: 'extra-paid', userId: 'local', jobId: 'local-job', scenario,
    pricing: { totalCents: 130, currency: 'USD' } as never, settlement: { currency: 'USD', amountCents: 130, fxRate: 1, fxSource: 'test' } };
  const intent = { id: 'pi-local', status: 'succeeded', currency: 'usd', amount: 130, amount_received: 130,
    metadata: { kind: 'run', user_id: 'local', job_id: 'local-job', direct_quote_id: 'extra-paid' } };
  const input = { intent, userId: 'local', jobId: 'local-job', loadQuote: async () => quote };
  assert.equal((await resolveCapturedDirectPaymentQuote({ ...input, scenario: { ...scenario, hdr: false, exrExport: false } })).pricing.totalCents, 130);
  await assert.rejects(resolveCapturedDirectPaymentQuote({ ...input, scenario: { ...scenario, hdr: true } }), /PAYMENT_BINDING_MISMATCH/);
  const paidHdr = { ...quote, scenario: { ...scenario, hdr: true, exrExport: true } };
  await assert.rejects(resolveCapturedDirectPaymentQuote({ ...input, loadQuote: async () => paidHdr, scenario }), /PAYMENT_BINDING_MISMATCH/);
});
