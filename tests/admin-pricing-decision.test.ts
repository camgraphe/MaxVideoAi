import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProviderCostComparisonRows } from '../frontend/server/pricing-admin/provider-cost-comparison';
import { pricingDecisionMetrics, simulateCustomerUnitPrice, customerCentsForTargetMargin }
  from '../frontend/app/(core)/admin/pricing/_lib/pricing-decision';

function mini() {
  const [row] = buildProviderCostComparisonRows([{ scenarioId: 'mini', brandId: 'bytedance',
    engineId: 'seedance-2-0-mini', executionProvider: 'byteplus_modelark', mediaType: 'video',
    mode: 't2v', resolution: '720p', durationSec: 5, step: 'normal', billingInputType: 'no_video_input',
    videoTokens: 67_500, tokenEvidence: 'scenario_estimate', customerQuote: { totalCents: 95, currency: 'USD',
      source: 'database', ruleId: 'current', pricingMode: 'legacy_margin_rule' } }], '2026-09-30T12:00:00Z');
  row.supplierList.amountUsd = 0.378;
  return row;
}

test('unit metrics distinguish gross margin on sales from markup on provider cost', () => {
  const metrics = pricingDecisionMetrics(mini());
  assert.equal(metrics.unit, 'second');
  assert.equal(metrics.quantity, 5);
  assert.equal(metrics.supplierUnitUsd, 0.0756);
  assert.equal(metrics.customerUnitUsd, 0.19);
  assert.equal(metrics.grossUnitUsd, 0.1144);
  assert.equal(metrics.grossTotalUsd, 0.572);
  assert.ok(Math.abs(metrics.marginPercent! - 60.21052631578947) < 1e-8);
  assert.ok(Math.abs(metrics.markupPercent! - 151.32275132275132) < 1e-8);
  assert.equal(metrics.costBasis, 'list');
});

test('images use output quantity and missing video duration never invents a per-second price', () => {
  const row = mini(); row.mediaType = 'image'; row.outputQuantity = 2;
  assert.equal(pricingDecisionMetrics(row).supplierUnitUsd, 0.189);
  assert.equal(pricingDecisionMetrics(row).unit, 'image');
  row.mediaType = 'video'; row.durationSec = null;
  assert.equal(pricingDecisionMetrics(row).customerUnitUsd, null);
});

test('current account cost takes precedence, while old observed invoice is not a current tariff', () => {
  const row = mini(); row.supplierObserved = { status: 'invoice_observed', amountUsd: 0.1,
    source: 'old-invoice', observedAt: '2026-09-20T00:00:00Z' };
  assert.equal(pricingDecisionMetrics(row).supplierTotalUsd, 0.378);
  row.supplierEffective = { status: 'confirmed', amountUsd: 0.3, source: 'account-contract',
    confirmedAt: '2026-09-29T00:00:00Z' };
  assert.equal(pricingDecisionMetrics(row).supplierTotalUsd, 0.3);
  assert.equal(pricingDecisionMetrics(row).costBasis, 'contract');
  row.supplierEffective.amountUsd = null; row.supplierList.routeMatches = false;
  assert.equal(pricingDecisionMetrics(row).costBasis, 'other_provider');
});

test('unknown costs, non-USD revenue and zero denominators stay unavailable', () => {
  const row = mini(); row.customerQuote!.currency = 'EUR';
  assert.equal(pricingDecisionMetrics(row).marginPercent, null);
  row.customerQuote!.currency = 'USD'; row.customerQuote!.totalCents = 0;
  assert.equal(pricingDecisionMetrics(row).marginPercent, null);
  assert.equal(pricingDecisionMetrics(row).grossTotalUsd, -0.378);
  row.supplierList.amountUsd = null;
  assert.equal(pricingDecisionMetrics(row).costBasis, 'unknown');
  assert.equal(customerCentsForTargetMargin(row, 50, 0), null);
});

test('simulation converts a unit price into explicit rounded scenario cents and entered fees', () => {
  const row = mini(); const before = JSON.stringify(row);
  const result = simulateCustomerUnitPrice(row, 0.15, 0.01, 100)!;
  assert.equal(result.customerCents, 75);
  assert.equal(result.metrics.customerUnitUsd, 0.15);
  assert.equal(result.contributionTotalUsd, 0.322);
  assert.equal(result.breakEvenUnitUsd, 0.0856);
  assert.equal(result.volumeContributionUsd, 32.2);
  assert.equal(JSON.stringify(row), before, 'simulation does not mutate the live quote');
  assert.equal(simulateCustomerUnitPrice(row, -1, 0, 100), null);
  assert.equal(simulateCustomerUnitPrice(row, 0.1, -1, 100), null);
  assert.equal(simulateCustomerUnitPrice(row, Number.NaN, 0, 100), null);
});

test('a target margin rounds up scenario cents to meet the target after entered fees', () => {
  const row = mini(); row.supplierList.amountUsd = 0.423;
  assert.equal(customerCentsForTargetMargin(row, 30, 0.01), 68);
  assert.equal(customerCentsForTargetMargin(row, 100, 0), null);
});

test('decimal half cents round up in the exact scenario total sent to the editor', () => {
  for (const [unit, cents] of [[0.285, 143], [0.255, 128], [0.28499, 142], [0.28501, 143]]) {
    assert.equal(simulateCustomerUnitPrice(mini(), unit, 0, 100)!.customerCents, cents);
  }
});

test('overflow in entered costs cannot produce infinite simulated profitability', () => {
  assert.equal(simulateCustomerUnitPrice(mini(), 0.15, 1e308, 100), null);
  assert.equal(customerCentsForTargetMargin(mini(), 50, 1e308), null);
});
