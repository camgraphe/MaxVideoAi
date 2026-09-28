import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProviderCostComparisonRows,
  customerQuoteFromCanonical,
  providerComparisonInputFromScenario,
  type ProviderCostComparisonInput,
} from '../frontend/server/pricing-admin/provider-cost-comparison';
import { quoteCanonicalAdminScenarios } from '../frontend/server/pricing-admin/canonical-scenarios';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildPricingAuditScenarios } from '../frontend/src/lib/pricing-audit/scenarios';
import {
  filterProviderComparisonRows,
  formatProviderComparisonScenario,
  providerComparisonPolicySelectorKey,
  summarizeProviderDraftFinalPairs,
} from '../frontend/app/(core)/admin/pricing/_lib/pricing-cockpit-view-model';

const customerQuote = {
  totalCents: 200,
  currency: 'USD',
  source: 'database' as const,
  ruleId: 'current-customer-rule',
  pricingMode: 'legacy_margin_rule' as const,
};

function video(overrides: Partial<ProviderCostComparisonInput> = {}): ProviderCostComparisonInput {
  return {
    scenarioId: 'seedance-2-5:1080p:video-input',
    brandId: 'bytedance',
    engineId: 'seedance-2-5',
    executionProvider: 'byteplus_modelark',
    mode: 'v2v',
    resolution: '1080p',
    durationSec: 5,
    aspectRatio: '16:9',
    step: 'normal',
    billingInputType: 'video_input',
    videoTokens: 100_000,
    tokenEvidence: 'scenario_estimate',
    customerQuote,
    ...overrides,
  };
}

test('2.5 1080p supplier list and current customer quote remain independent', () => {
  const [row] = buildProviderCostComparisonRows([video()], '2026-09-28T12:00:00Z');
  assert.equal(row.supplierList.amountUsd, 0.7);
  assert.equal(row.supplierList.unitPriceUsdPer1kTokens, 0.007);
  assert.equal(row.supplierList.status, 'published_list_estimate');
  assert.equal(row.supplierEffective.amountUsd, null);
  assert.equal(row.supplierEffective.status, 'account_contract_unconfirmed');
  assert.equal(row.supplierObserved.amountUsd, null);
  assert.equal(row.customerQuote?.totalCents, 200);
  assert.equal(row.customerQuote?.ruleId, 'current-customer-rule');
  assert.equal(row.billingInputType, 'video_input');
  assert.equal(row.tokenEvidence, 'scenario_estimate');
  assert.equal(row.videoTokens, 100_000);
  assert.equal(row.indicativeDifferenceVsListCents, 130);
  assert.equal(row.realizedGrossDifferenceCents, null);
});

test('canonical customer total and DB rule provenance are projected without using padded vendor subtotal', () => {
  const scenario = buildPricingAuditScenarios().find((candidate) =>
    candidate.engineId === 'seedance-2-5' && candidate.surface === 'billing');
  assert.ok(scenario);
  const [outcome] = quoteCanonicalAdminScenarios({ databaseRules: [], scenarios: [scenario] });
  assert.equal(outcome.status, 'quoted');
  if (outcome.status !== 'quoted') return;
  const summary = customerQuoteFromCanonical({
    ...outcome,
    vendorSubtotalCents: 999_999,
    policyProvenance: { ...outcome.policyProvenance, source: 'database', sourceRuleId: 'db-live-rule' },
  });
  assert.equal(summary.totalCents, outcome.customerTotalCents);
  assert.equal(summary.ruleId, 'db-live-rule');
  assert.equal(summary.source, 'database');
  assert.equal(summary.pricingMode, 'legacy_margin_rule');
  assert.notEqual(summary.totalCents, 999_999);
});

test('2.5 Draft and final are separate paid rows at 480p and 1080p', () => {
  const rows = buildProviderCostComparisonRows([
    video({ scenarioId: 'draft', mode: 't2v', billingInputType: 'no_video_input', resolution: '480p', step: 'draft' }),
    video({ scenarioId: 'final', mode: 't2v', billingInputType: 'no_video_input', resolution: '1080p', step: 'final' }),
  ], '2026-09-28T12:00:00Z');
  assert.deepEqual(rows.map((row) => row.scenarioId), ['draft', 'final']);
  assert.deepEqual(rows.map((row) => row.supplierList.amountUsd), [1.07, 1.17]);
  assert.deepEqual(rows.map((row) => row.step), ['draft', 'final']);
});

test('Fal execution cannot inherit a BytePlus supplier cost', () => {
  const [row] = buildProviderCostComparisonRows([video({ executionProvider: 'fal' })], '2026-09-28T12:00:00Z');
  assert.equal(row.supplierList.amountUsd, null);
  assert.equal(row.supplierList.status, 'unavailable');
  assert.equal(row.supplierList.reason, 'supplier_rate_unverified_for_route');
  assert.equal(row.indicativeDifferenceVsListCents, null);
  assert.equal(row.customerQuote?.totalCents, 200);
});

test('missing token evidence never becomes an invented supplier estimate', () => {
  const [row] = buildProviderCostComparisonRows([video({ videoTokens: null, tokenEvidence: null })], '2026-09-28T12:00:00Z');
  assert.equal(row.supplierList.amountUsd, null);
  assert.equal(row.supplierList.reason, 'billable_tokens_unavailable');
  assert.equal(row.indicativeDifferenceVsListCents, null);
});

test('Seedream Pro output tier and paid references have independent list cost', () => {
  const [row] = buildProviderCostComparisonRows([{
    scenarioId: 'seedream-pro:large:3refs', brandId: 'bytedance', engineId: 'seedream-5-0-pro',
    executionProvider: 'byteplus_modelark', mode: 'i2i', resolution: '2K',
    step: 'normal', outputPixels: [2_610_001], inputImages: 3,
    customerQuote: { ...customerQuote, totalCents: 20 },
  }], '2026-09-28T12:00:00Z');
  assert.equal(row.supplierList.amountUsd, 0.096);
  assert.equal(row.indicativeDifferenceVsListCents, 10.4);
  assert.equal(row.supplierEffective.amountUsd, null);
  assert.deepEqual(row.outputPixels, [2_610_001]);
  assert.equal(row.inputImages, 3);
});

test('an image scenario without an output is unavailable instead of a zero-cost item', () => {
  const [row] = buildProviderCostComparisonRows([{
    scenarioId: 'seedream-pro:no-output', brandId: 'bytedance', engineId: 'seedream-5-0-pro',
    executionProvider: 'byteplus_modelark', mode: 't2i', resolution: '2K',
    step: 'normal', outputPixels: [], inputImages: 0, customerQuote,
  }], '2026-09-28T12:00:00Z');
  assert.equal(row.supplierList.amountUsd, null);
  assert.equal(row.supplierList.reason, 'image_usage_unavailable');
  assert.equal(row.indicativeDifferenceVsListCents, null);
});

test('Seedance 1.5 draft multiplier applies only to normal-token estimates', () => {
  const base = video({ engineId: 'seedance-1-5-pro', resolution: '480p', mode: 't2v',
    billingInputType: 'no_video_input', audio: true, step: 'draft' });
  const rows = buildProviderCostComparisonRows([
    base,
    { ...base, scenarioId: 'reported-draft', tokenEvidence: 'provider_reported' },
  ], '2026-09-28T12:00:00Z');
  assert.deepEqual(rows.map((row) => row.supplierList.amountUsd), [0.144, 0.24]);
});

test('Fast promotion is dated and never populates the account-effective field', () => {
  const scenario = video({ engineId: 'seedance-2-0-fast', resolution: '720p',
    billingInputType: 'no_video_input', mode: 't2v' });
  const [during] = buildProviderCostComparisonRows([scenario], '2026-09-28T12:00:00Z');
  const [after] = buildProviderCostComparisonRows([scenario], '2026-10-07T06:00:00Z');
  assert.equal(during.supplierList.amountUsd, 0.56);
  assert.equal(during.publicPromotion?.amountUsd, 0.42);
  assert.equal(during.supplierEffective.amountUsd, null);
  assert.equal(after.publicPromotion, null);
});

test('contract evidence and settled billing evidence remain separate from list and customer prices', () => {
  const [row] = buildProviderCostComparisonRows([video({
    confirmedEffectiveCost: { amountUsd: 0.49, source: 'contract:verified-rate', confirmedAt: '2026-09-29T12:00:00Z' },
    observedInvoiceCost: { amountUsd: 0.51, source: 'usage:settled-line', confirmedAt: '2026-09-30T12:00:00Z' },
  })], '2026-09-30T13:00:00Z');
  assert.equal(row.supplierList.amountUsd, 0.7);
  assert.equal(row.supplierEffective.amountUsd, 0.49);
  assert.equal(row.supplierEffective.source, 'contract:verified-rate');
  assert.equal(row.supplierObserved.amountUsd, 0.51);
  assert.equal(row.supplierObserved.source, 'usage:settled-line');
  assert.equal(row.indicativeDifferenceVsListCents, 130);
  assert.equal(row.realizedGrossDifferenceCents, 149);
  assert.equal(row.customerQuote?.totalCents, 200);
});

test('unverifiable contract evidence never becomes a confirmed price', () => {
  const [row] = buildProviderCostComparisonRows([video({
    confirmedEffectiveCost: { amountUsd: 0, source: '', confirmedAt: 'not-a-date' },
  })], '2026-09-28T12:00:00Z');
  assert.equal(row.supplierEffective.amountUsd, null);
  assert.equal(row.supplierEffective.status, 'account_contract_unconfirmed');
});

test('future contract and invoice evidence cannot appear in an earlier comparison', () => {
  const [row] = buildProviderCostComparisonRows([video({
    confirmedEffectiveCost: { amountUsd: 0.49, source: 'contract:active-rate', confirmedAt: '2026-09-30T12:00:00Z' },
    observedInvoiceCost: { amountUsd: 0.51, source: 'invoice:settled-line', confirmedAt: '2026-10-01T12:00:00Z' },
  })], '2026-09-29T12:00:00Z');
  assert.equal(row.supplierEffective.status, 'account_contract_unconfirmed');
  assert.equal(row.supplierEffective.amountUsd, null);
  assert.equal(row.supplierObserved.status, 'unavailable');
  assert.equal(row.supplierObserved.amountUsd, null);
  assert.equal(row.realizedGrossDifferenceCents, null);
});

test('representative Seedance 2.5 cost uses output tokens while customer quote stays canonical', () => {
  const entry = getFalEngineById('seedance-2-5');
  assert.ok(entry);
  const scenario = buildPricingAuditScenarios().find((candidate) =>
    candidate.engineId === 'seedance-2-5' && candidate.surface === 'billing' &&
    candidate.mode === 't2v' && candidate.membershipTier === 'member');
  assert.ok(scenario);
  const [quote] = quoteCanonicalAdminScenarios({ databaseRules: [], scenarios: [scenario] });
  assert.equal(quote.status, 'quoted');
  if (quote.status !== 'quoted') return;
  const input = providerComparisonInputFromScenario({
    scenario, quote, engine: entry.engine, brandId: entry.brandId ?? 'bytedance',
    executionProvider: 'byteplus_modelark',
  });
  const [row] = buildProviderCostComparisonRows([input], '2026-09-29T12:00:00Z');
  assert.equal(row.videoTokens, 38_430);
  assert.equal(row.tokenEvidence, 'scenario_estimate');
  assert.equal(row.supplierList.amountUsd, 0.411201);
  assert.equal(row.customerQuote?.totalCents, quote.customerTotalCents);
  assert.equal(row.customerQuote?.ruleId, quote.policyProvenance.sourceRuleId);
  assert.equal(row.supplierEffective.amountUsd, null);
});

test('reference mode without known video inputs leaves its supplier rate unavailable', () => {
  const entry = getFalEngineById('seedance-2-5');
  assert.ok(entry);
  const input = providerComparisonInputFromScenario({
    scenario: {
      id: 'reference-with-unknown-media', surface: 'billing', engineId: 'seedance-2-5',
      mode: 'ref2v', resolution: '720p', durationSec: 5, membershipTier: 'member', input: {},
    },
    quote: null, engine: entry.engine, brandId: 'bytedance', executionProvider: 'byteplus_modelark',
  });
  const [row] = buildProviderCostComparisonRows([input], '2026-09-29T12:00:00Z');
  assert.equal(row.billingInputType, null);
  assert.equal(row.supplierList.amountUsd, null);
  assert.equal(row.supplierList.reason, 'billable_tokens_unavailable');
});

test('comparison rows retain a catalog-owned video or image category for filtering', () => {
  const rows = buildProviderCostComparisonRows([
    video({ scenarioId: 'video', mediaType: 'video' }),
    { scenarioId: 'image', brandId: 'bytedance', engineId: 'seedream', executionProvider: 'byteplus_modelark',
      mode: 't2i', resolution: '2K', mediaType: 'image', step: 'normal', customerQuote },
  ], '2026-09-29T12:00:00Z');

  assert.deepEqual(rows.map((row) => row.mediaType), ['video', 'image']);
  assert.equal(typeof filterProviderComparisonRows, 'function');
  assert.deepEqual(filterProviderComparisonRows(rows, {
    brandId: 'bytedance', executionProvider: 'byteplus_modelark', mediaType: 'image', query: '',
  }).map((row) => row.scenarioId), ['image']);
  assert.deepEqual(filterProviderComparisonRows(rows, {
    brandId: 'all', executionProvider: 'fal', mediaType: 'all', query: '',
  }), []);
});

test('scenario labels include paid Draft or final step and cost-changing options', () => {
  assert.equal(typeof formatProviderComparisonScenario, 'function');
  const [row] = buildProviderCostComparisonRows([video({
    scenarioId: 'final', mode: 'v2v', resolution: '1080p', durationSec: 8,
    audio: true, step: 'final', mediaType: 'video',
  })], '2026-09-29T12:00:00Z');
  assert.match(formatProviderComparisonScenario(row), /Final/);
  assert.match(formatProviderComparisonScenario(row), /1080p/);
  assert.match(formatProviderComparisonScenario(row), /8 s/);
  assert.match(formatProviderComparisonScenario(row), /audio/);
  assert.match(formatProviderComparisonScenario(row), /video input/);
});

test('Draft and final totals combine only when both steps share an explicit workflow pair', () => {
  assert.equal(typeof summarizeProviderDraftFinalPairs, 'function');
  const rows = buildProviderCostComparisonRows([
    video({ scenarioId: 'draft', resolution: '480p', step: 'draft', workflowPairId: 'pair-1',
      billingInputType: 'no_video_input',
      customerQuote: { ...customerQuote, totalCents: 80 } }),
    video({ scenarioId: 'final', resolution: '1080p', step: 'final', workflowPairId: 'pair-1',
      billingInputType: 'no_video_input',
      customerQuote: { ...customerQuote, totalCents: 220 } }),
    video({ scenarioId: 'unrelated-final', step: 'final', workflowPairId: 'pair-2' }),
  ], '2026-09-29T12:00:00Z');
  const summaries = summarizeProviderDraftFinalPairs(rows);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.workflowPairId, 'pair-1');
  assert.equal(summaries[0]?.customerTotalCents, 300);
  assert.equal(summaries[0]?.supplierListUsd, 2.24);
});

test('inspecting a comparison targets its exact canonical policy selector', () => {
  assert.equal(typeof providerComparisonPolicySelectorKey, 'function');
  const [row] = buildProviderCostComparisonRows([video({ mode: 't2v', resolution: '1080p' })], '2026-09-29T12:00:00Z');
  assert.equal(providerComparisonPolicySelectorKey(row), 'seedance-2-5|t2v|1080p');
});
