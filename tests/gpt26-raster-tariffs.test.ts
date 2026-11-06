import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateGptImage26ListOutputComponents } from '../frontend/lib/image/gptImage26Pricing';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { buildTariffBatchPlan } from '../frontend/server/pricing-admin/tariff-batches/planner';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { GPT_IMAGE_2_6_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/gpt-image-2-6';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { evaluateManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';
import { gpt26RasterEnvelope, gpt26RasterProposal } from '../frontend/server/pricing-admin/tariff-batches/gpt26';
import { resolvePublicModelScenario, quotePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import type { TariffBatchProposal } from '../frontend/server/pricing-admin/tariff-batches/contract';

const state = { status: 'loaded' as const, active: true, revision: 7, databaseCells: [] as ManualTariffCell[], versionedCells: [] as ManualTariffCell[] };
const policy = { status: 'loaded' as const, rules: [] };
const engine = GPT_IMAGE_2_6_ENGINE_REGISTRY[0].engine;
const proposal: TariffBatchProposal = { schemaVersion: 1, modelId: 'gpt-image-2-6-flare', intent: 'create_missing',
  reason: 'Explicit raster coverage qualification', pricing: { kind: 'explicit' }, selections: [{
    selector: { engineId: engine.id, mode: 'i2i', resolution: 'continuous', quality: 'high', durationSec: 'continuous', referenceImageCount: 'continuous' },
    price: { kind: 'unit_terms', rounding: 'up', terms: [
      { unit: 'output_image_tokens', centsPerUnit: 0.0045 }, { unit: 'output_units', centsPerUnit: 1.5 },
      { unit: 'reference_image_outputs', centsPerUnit: 3 },
    ] },
  }] };

test('custom raster pricing consumes exact requested pixels and all output/reference quantities', () => {
  const output = calculateGptImage26ListOutputComponents({ mode: 'i2i', resolution: 'custom',
    customImageSize: { width: 1536, height: 864 }, quality: 'high', durationSec: 10, referenceImageCount: 16 }, 'USD');
  assert.equal(output.meta.providerOutputImageTokens, 10780);
  assert.equal(output.partialListUsd, 0.3234);
  assert.equal(output.meta.providerCostIncomplete, true);
});

test('reviewed raster native preview prices custom n10/ref16 while exact exceptions remain authoritative', async () => {
  const plan = await buildTariffBatchPlan({ proposal, state, policy });
  assert.deepEqual(plan.counts, { create: 1, update: 0, unchanged: 0, conflict: 0 });
  const cell = plan.rows[0].proposedCell!;
  const context = { engine, mode: 'i2i' as const, resolution: 'custom', customImageSize: { width: 1536, height: 864 },
    quality: 'high', durationSec: 10, referenceImageCount: 16 };
  const quote = (databaseCells: ManualTariffCell[]) => computeCanonicalPublicSnapshot(context, {
    loadCustomerTariffState: async () => ({ ...state, databaseCells }), pricingPolicy: { loadOverrides: async () => policy },
  });
  assert.equal((await quote([cell])).totalCents, 544);
  await assert.rejects(quote([]), /tariff|cell|missing/i);
  const exact: ManualTariffCell = { ...cell, id: 'synthetic-exact', selector: { engineId: engine.id, mode: 'i2i',
    resolution: '1536x864', quality: 'high', durationSec: '10', referenceImageCount: '16' }, price: { kind: 'fixed', customerCents: 600 } };
  assert.equal((await quote([cell, exact])).totalCents, 600);
  const repriced = { ...cell, price: { ...cell.price, terms: [{ unit: 'output_units', centsPerUnit: 1 }] } } as ManualTariffCell;
  await assert.rejects(quote([repriced]), /authored|unit/i);
});

test('automatic provider settings retain separate conservative output provenance and no input bound', () => {
  const output = calculateGptImage26ListOutputComponents({ mode: 't2i', resolution: 'auto', quality: 'auto', durationSec: 1 }, 'USD');
  assert.equal(output.meta.providerOutputImageTokens, null);
  assert.equal(output.meta.providerConservativeOutputImageTokens, 23719);
  assert.equal(output.meta.providerCostKind, 'conservative-list-output-bound');
  assert.equal(output.meta.quality, 'auto');
  assert.equal(output.meta.providerInvoiceCostUsd, null);
  assert.equal(output.meta.providerInputImageTokens, null);
});

test('a native raster class preserves quality and automatic-size identity while validating exact dimensions', () => {
  const exact = { engineId: 'gpt-image-2-6-flare', mode: 'i2i', resolution: '1536x864', quality: 'high', durationSec: '10', referenceImageCount: '16' };
  assert.deepEqual(continuousInputTariffSelector(exact), { ...exact, resolution: 'continuous', durationSec: 'continuous', referenceImageCount: 'continuous' });
  assert.deepEqual(continuousInputTariffSelector({ ...exact, resolution: 'auto' }), { ...exact, resolution: 'auto', durationSec: 'continuous', referenceImageCount: 'continuous' });
  for (const resolution of ['3840x3840', '1536x865', '16x16']) assert.throws(() => continuousInputTariffSelector({ ...exact, resolution }));
  assert.throws(() => continuousInputTariffSelector({ ...exact, durationSec: '11' }));
});

test('48 bounded classes cover explicit and automatic output quantities without changing historical exact cells', async () => {
  const envelope = gpt26RasterEnvelope();
  assert.ok(envelope.checkedDimensions > 20_000);
  for (const range of Object.values(envelope.tokens)) assert.ok(range.max <= range.autoBound);
  for (const modelId of ['gpt-image-2-6-flare', 'gpt-image-2-6-sunburst'] as const) {
    const plan = await buildTariffBatchPlan({ proposal: gpt26RasterProposal(modelId), state, policy });
    assert.equal(plan.rows.length, 24);
    assert.deepEqual(plan.counts, { create: 24, update: 0, unchanged: 0, conflict: 0 });
    assert.equal(plan.rows.filter(row => row.rasterDomain?.conservativeOutput).length, 14);
    assert.ok(plan.rows.every(row => row.supplierCostIncomplete && row.rasterDomain?.maxOutputCount === 10));
  }
});

test('literal raster units agree with independent integer retail arithmetic throughout the bounded token/count domain', () => {
  const price = proposal.selections[0].price!;
  for (let tokens = 1; tokens <= 23719; tokens++) for (let n = 1; n <= 10; n++) for (const refs of [0, 1, 16]) {
    const expected = Math.floor((n * (tokens * 45 + 15000 + refs * 30000) + 9999) / 10000);
    const result = evaluateManualTariffPrice(price, { output_image_tokens: tokens * n, output_units: n, reference_image_outputs: refs * n });
    assert.equal(result.customerTotalCents, expected, `${tokens}/${n}/${refs}`);
  }
});

test('native raster preview rejects wrong token provenance and prices below the output-only supplier domain', async () => {
  const entry = proposal.selections[0];
  assert.equal(entry.price?.kind, 'unit_terms');
  if (entry.price?.kind !== 'unit_terms') return;
  for (const terms of [
    entry.price.terms.map(term => ({ ...term, centsPerUnit: 0 })),
    entry.price.terms.map(term => ({ ...term, unit: term.unit === 'output_image_tokens' ? 'conservative_output_image_tokens' : term.unit })),
  ]) {
    const plan = await buildTariffBatchPlan({ proposal: { ...proposal, selections: [{ ...entry, price: { ...entry.price, terms } }] }, state, policy });
    assert.equal(plan.counts.conflict, 1);
    assert.equal(plan.rows[0].proposedCell, null);
  }
});

test('public scenario admission accepts the expanded raster domain without treating the launch grid as complete', async () => {
  const plan = await buildTariffBatchPlan({ proposal: gpt26RasterProposal('gpt-image-2-6-flare'), state, policy });
  const databaseCells = plan.rows.map(row => row.proposedCell!);
  for (const [resolution, quality, durationSec, customImageSize, amountCents] of [
    ['3840x2160', 'high', 1, undefined, 17], ['2160x3840', 'high', 1, undefined, 17],
    ['custom', 'high', 10, { width: 1536, height: 864 }, 64], ['auto', 'auto', 1, undefined, 109],
  ] as const) {
    const input = { modelId: engine.id, mode: 't2i', resolution, quality, durationSec, customImageSize };
    const scenario = resolvePublicModelScenario(input);
    assert.ok(scenario, resolution);
    assert.deepEqual(scenario.context.customImageSize, customImageSize);
    const quoted = await quotePublicModelScenario(input, scenario => computeCanonicalPublicSnapshot(scenario.context, {
      loadCustomerTariffState: async () => ({ ...state, databaseCells }), pricingPolicy: { loadOverrides: async () => policy },
    }));
    assert.equal(quoted.status, 'exact');
    if (quoted.status === 'exact') assert.equal(quoted.amountCents, amountCents);
  }
  const valid = { modelId: engine.id, mode: 't2i', resolution: '3840x2160', quality: 'high', durationSec: 1 };
  for (const input of [{ ...valid, durationSec: 11 }, { ...valid, referenceImageCount: 1 },
    { ...valid, aspectRatio: '9:16' }, { ...valid, quality: 'ultra' },
    { ...valid, resolution: 'custom', customImageSize: { width: 3840, height: 3840 } }]) assert.equal(resolvePublicModelScenario(input), null);
});
