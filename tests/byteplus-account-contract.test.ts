import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProviderCostComparisonRows, type ProviderCostComparisonInput } from '../frontend/server/pricing-admin/provider-cost-comparison';
import { pricingDecisionMetrics } from '../frontend/app/(core)/admin/pricing/_lib/pricing-decision';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { providerComparisonForTariffScenario } from '../frontend/server/pricing-admin/tariff-provider-comparison';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';

const at = '2026-10-01T12:00:00Z';
function scenario(overrides: Partial<ProviderCostComparisonInput> = {}): ProviderCostComparisonInput {
  return { scenarioId: 'mini', brandId: 'bytedance', engineId: 'seedance-2-0-mini',
    executionProvider: 'byteplus_modelark', accountContractRegion: 'ap-southeast-1',
    mode: 't2v', resolution: '720p', durationSec: 5, step: 'normal',
    billingInputType: 'no_video_input', videoTokens: 108_000, tokenEvidence: 'scenario_estimate',
    customerQuote: { totalCents: 95, currency: 'USD', source: 'database', ruleId: 'retail', pricingMode: 'manual_tariff' },
    ...overrides };
}

// A public promotion, retail subtotal or wrong discount must never become account cost.
test('Mini signed contract applies 60% off LIST and feeds margin without repricing the customer', () => {
  const [row] = buildProviderCostComparisonRows([scenario()], at);
  assert.equal(row.supplierList.amountUsd, 0.378);
  assert.equal(row.supplierEffective.amountUsd, 0.1512);
  assert.equal(row.supplierEffective.contract?.discountPercent, 60);
  assert.equal(row.supplierEffective.contract?.unitPriceUsdPer1kTokens, 0.0014);
  assert.equal(row.customerQuote?.totalCents, 95);
  assert.equal(row.supplierObserved.amountUsd, null);
  const decision = pricingDecisionMetrics(row);
  assert.equal(decision.supplierUnitUsd, 0.03024);
  assert.equal(decision.grossTotalUsd, 0.7988);
  assert.equal(Number(decision.marginPercent!.toFixed(1)), 84.1);
});

test('Fast and video-input SKUs use their own signed discount and native token rate', () => {
  const [fast, miniVideo, fastVideo, standard, standard1080, flagship] = buildProviderCostComparisonRows([
    scenario({ engineId: 'seedance-2-0-fast', customerQuote: { totalCents: 152, currency: 'USD', source: 'database', ruleId: 'retail', pricingMode: 'manual_tariff' } }),
    scenario({ billingInputType: 'video_input' }),
    scenario({ engineId: 'seedance-2-0-fast', billingInputType: 'video_input' }),
    scenario({ engineId: 'seedance-2-0' }),
    scenario({ engineId: 'seedance-2-0', resolution: '1080p', billingInputType: 'video_input' }),
    scenario({ engineId: 'seedance-2-5' }),
  ], at);
  assert.equal(fast.supplierEffective.amountUsd, 0.3024);
  assert.equal(fast.supplierEffective.contract?.discountPercent, 50);
  assert.equal(fast.customerQuote?.totalCents, 152);
  assert.equal(miniVideo.supplierEffective.amountUsd, 0.09072);
  assert.equal(fastVideo.supplierEffective.amountUsd, 0.1782);
  assert.equal(standard.supplierEffective.amountUsd, 0.756);
  assert.equal(standard1080.supplierEffective.amountUsd, 0.5076);
  assert.equal(flagship.supplierEffective.amountUsd, 1.1556);
});

test('Seedream contract discounts output tiers and paid references independently of retail', () => {
  const [lite, pro] = buildProviderCostComparisonRows([
    scenario({ engineId: 'seedream', mediaType: 'image', outputPixels: [4_194_304], inputImages: 3 }),
    scenario({ engineId: 'seedream-5-0-pro', mediaType: 'image', resolution: '2K', outputPixels: [2_610_000, 4_194_304], inputImages: 3 }),
  ], at);
  assert.equal(lite.supplierList.amountUsd, 0.035);
  assert.equal(lite.supplierEffective.amountUsd, 0.0315);
  assert.equal(pro.supplierList.amountUsd, 0.141);
  assert.equal(pro.supplierEffective.amountUsd, 0.1269);
  assert.equal(pro.supplierEffective.contract?.discountPercent, 10);
});

test('unlisted Seedream Pro output size does not inherit the signed 2K SKU', () => {
  const [row] = buildProviderCostComparisonRows([scenario({ engineId: 'seedream-5-0-pro',
    mediaType: 'image', resolution: '4K', outputPixels: [16_777_216], inputImages: 2 })], at);
  assert.equal(row.supplierEffective.amountUsd, null);
});

test('both admin summary and selected-scenario owner receive the account region', () => {
  const selected = collectSellableManualTariffCoverage().scenarios.find(row => row.modelId === 'seedance-2-0-mini'
    && row.selector.mode === 't2v' && row.selector.resolution === '720p');
  assert.ok(selected);
  const input = providerComparisonForTariffScenario(selected);
  assert.equal(input.accountContractRegion, 'ap-southeast-1');
  const [row] = buildProviderCostComparisonRows([input], at);
  assert.equal(row.supplierEffective.contract?.discountPercent, 60);
});

test('admin exposes contract discount, LIST, validity and native billing unit beside the estimated margin', async () => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  const { ProviderPriceComparisonTable } = await import('../frontend/app/(core)/admin/pricing/_components/ProviderPriceComparisonTable');
  const rows = buildProviderCostComparisonRows([scenario()], at);
  const html = renderToStaticMarkup(createElement(ProviderPriceComparisonTable, { rows, disabled: false, onInspect: () => {} }));
  assert.match(html, /60% off LIST/);
  assert.match(html, /\$0\.1512/);
  assert.match(html, /\$0\.378/);
  assert.match(html, /84\.1%/);
  assert.match(html, /Est\. gross margin/);
  assert.match(html, /CT20260925128931/);
  assert.match(html, /2027-08-26/);
  assert.match(html, /1,000 tokens/);
  assert.match(html, /\$0\.0014/);
  assert.match(html, /Observed unavailable/);
});

test('unlisted workflow, resolution, route, region and unknown usage never inherit a contract rate', () => {
  for (const change of [
    { engineId: 'seedance-2-5', step: 'draft', resolution: '480p' },
    { engineId: 'seedance-2-5', step: 'final', resolution: '1080p' },
    { engineId: 'seedance-2-5', resolution: '1080p' },
    { engineId: 'seedance-2-0', resolution: '4k' },
    { engineId: 'seedance-1-5-pro', audio: true },
    { executionProvider: 'fal' }, { accountContractRegion: 'eu-west-1' },
    { accountContractRegion: undefined }, { videoTokens: null },
  ] as Partial<ProviderCostComparisonInput>[]) {
    const [row] = buildProviderCostComparisonRows([scenario(change)], at);
    assert.equal(row.supplierEffective.amountUsd, null, JSON.stringify(change));
  }
});

test('contract validity has exact UTC+8 date boundaries and does not expire with the public promotion', () => {
  const [before] = buildProviderCostComparisonRows([scenario()], '2026-09-30T15:59:59Z');
  const [start] = buildProviderCostComparisonRows([scenario()], '2026-09-30T16:00:00Z');
  const [afterCampaign] = buildProviderCostComparisonRows([scenario()], '2026-10-08T00:00:00Z');
  const [last] = buildProviderCostComparisonRows([scenario()], '2027-08-26T15:59:59Z');
  const [expired] = buildProviderCostComparisonRows([scenario()], '2027-08-26T16:00:00Z');
  assert.equal(before.supplierEffective.amountUsd, null);
  assert.equal(start.supplierEffective.amountUsd, 0.1512);
  assert.equal(afterCampaign.supplierEffective.amountUsd, 0.1512);
  assert.equal(afterCampaign.publicPromotion, null);
  assert.equal(last.supplierEffective.amountUsd, 0.1512);
  assert.equal(expired.supplierEffective.amountUsd, null);
});
