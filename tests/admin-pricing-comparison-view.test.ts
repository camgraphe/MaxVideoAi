import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';

import { buildProviderCostComparisonRows } from '../frontend/server/pricing-admin/provider-cost-comparison';

// The test transpiler uses the classic JSX transform for shared admin surfaces.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('admin comparison labels unknown supplier facts and canonical customer totals separately', async () => {
  const module = await import('../frontend/app/(core)/admin/pricing/_components/ProviderPriceComparisonTable')
    .catch(() => null);
  assert.ok(module?.ProviderPriceComparisonTable, 'comparison table must be available');
  const rows = buildProviderCostComparisonRows([{
    scenarioId: 'seedance-2-5:1080p', brandId: 'bytedance', engineId: 'seedance-2-5',
    executionProvider: 'byteplus_modelark', mediaType: 'video', mode: 't2v',
    resolution: '1080p', durationSec: 5, step: 'normal', billingInputType: 'no_video_input',
    videoTokens: 100_000, tokenEvidence: 'scenario_estimate',
    customerQuote: { totalCents: 200, currency: 'USD', source: 'database',
      ruleId: 'db-current', pricingMode: 'legacy_margin_rule' },
  }], '2026-09-29T12:00:00Z');
  const html = renderToStaticMarkup(createElement(module.ProviderPriceComparisonTable, {
    rows, disabled: false, onInspect: () => {},
  }));

  assert.match(html, /ByteDance/i);
  assert.match(html, /BytePlus/i);
  assert.match(html, /Supplier list/i);
  assert.match(html, /Published LIST estimate/i);
  assert.match(html, /Contract unconfirmed/i);
  assert.match(html, /Observed unavailable/i);
  assert.match(html, /Customer total/i);
  assert.match(html, /\$2\.00/);
  assert.match(html, /db-current/);
  assert.match(html, /Inspect policy/i);
  assert.doesNotMatch(html, /Supplier subtotal/);
});

test('missing supplier usage shows an explanation rather than a zero or green margin', async () => {
  const module = await import('../frontend/app/(core)/admin/pricing/_components/ProviderPriceComparisonTable')
    .catch(() => null);
  assert.ok(module?.ProviderPriceComparisonTable);
  const rows = buildProviderCostComparisonRows([{
    scenarioId: 'seedream:2K', brandId: 'bytedance', engineId: 'seedream',
    executionProvider: 'byteplus_modelark', mediaType: 'image', mode: 't2i',
    resolution: '2K', step: 'normal', customerQuote: null,
  }], '2026-09-29T12:00:00Z');
  const html = renderToStaticMarkup(createElement(module.ProviderPriceComparisonTable, {
    rows, disabled: false, onInspect: () => {},
  }));
  assert.match(html, /Data missing/i);
  assert.match(html, /Exact output dimensions or the number of input images are missing/i);
  assert.match(html, /Customer quote unavailable/i);
  assert.doesNotMatch(html, /\$0\.00/);
});

test('verified contract and invoice dates appear beside their distinct amounts', async () => {
  const module = await import('../frontend/app/(core)/admin/pricing/_components/ProviderPriceComparisonTable');
  const rows = buildProviderCostComparisonRows([{
    scenarioId: 'seedance-2-5:verified', brandId: 'bytedance', engineId: 'seedance-2-5',
    executionProvider: 'byteplus_modelark', mediaType: 'video', mode: 't2v',
    resolution: '1080p', durationSec: 5, step: 'normal', billingInputType: 'no_video_input',
    videoTokens: 100_000, tokenEvidence: 'provider_reported',
    confirmedEffectiveCost: { amountUsd: 0.49, source: 'contract:verified', confirmedAt: '2026-09-30T12:00:00Z' },
    observedInvoiceCost: { amountUsd: 0.51, source: 'invoice:settled', confirmedAt: '2026-10-01T12:00:00Z' },
    customerQuote: { totalCents: 200, currency: 'USD', source: 'database',
      ruleId: 'db-current', pricingMode: 'legacy_margin_rule' },
  }], '2026-10-02T12:00:00Z');
  const html = renderToStaticMarkup(createElement(module.ProviderPriceComparisonTable, {
    rows, disabled: false, onInspect: () => {},
  }));
  assert.match(html, /Confirmed 2026-09-30/);
  assert.match(html, /Observed 2026-10-01/);
  assert.match(html, /\$0\.49/);
  assert.match(html, /\$0\.51/);
});

test('family navigation accepts future supplier families from inventory data', async () => {
  const module = await import('../frontend/app/(core)/admin/pricing/_components/ProviderPriceComparisonTable');
  const rows = buildProviderCostComparisonRows([{
    scenarioId: 'runway-gen-4:720p', brandId: 'runway', engineId: 'runway-gen-4',
    executionProvider: 'fal', mediaType: 'video', mode: 't2v', resolution: '720p',
    durationSec: 5, step: 'normal', customerQuote: null,
  }], '2026-09-29T12:00:00Z');
  const html = renderToStaticMarkup(createElement(module.ProviderPriceComparisonTable, {
    rows, disabled: false, onInspect: () => {},
  }));
  assert.match(html, /All families/);
  assert.match(html, /Runway price comparison/);
  assert.match(html, /Runway Gen 4/);
  assert.doesNotMatch(html, /\$0\.00/);
});
