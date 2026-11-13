import assert from 'node:assert/strict';
import test from 'node:test';
import { ENV } from '../frontend/src/lib/env';
import { prepareSeedanceAdminBatches, seedanceBatchClasses, validateSeedanceBatchDomain } from '../frontend/server/pricing-admin/tariff-batches/seedance';
import { parseTariffBatchProposal } from '../frontend/server/pricing-admin/tariff-batches/input';
import { buildTariffBatchPlan } from '../frontend/server/pricing-admin/tariff-batches/planner';
import { prepareSeedance25CommercialTariffs } from '../frontend/server/pricing/seedance25-commercial-tariffs';
import { estimateBytePlusBillableTokens } from '../frontend/server/byteplus-accounting';
import { getBytePlusVideoListRate } from '../frontend/server/byteplus-list-tariff';
import { evaluateManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';

test('the full approved Seedance grids use 31 bounded native admin batches and canonical quotes', async () => {
  const saved = ENV.SEEDANCE_2_5_EDIT_TRANSPORT;
  ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'modelark';
  try {
    for (const [modelId, count, batchCount] of [['seedance-2-5', 4860, 22], ['seedance-2-5-flash', 1944, 9]] as const) {
      const grid = prepareSeedance25CommercialTariffs({ modelId, at: '2026-11-13T00:00:00Z', standardEditTransport: 'modelark' });
      const state = { status: 'loaded' as const, active: true, revision: 7, versionedCells: [], databaseCells:
        modelId === 'seedance-2-5' ? grid.cells.map(cell => ({ ...cell, id: `existing-${cell.id}` })) : [] };
      const batches = prepareSeedanceAdminBatches(modelId);
      assert.equal(batches.length, batchCount);
      let checked = 0;
      for (const batch of batches) {
        assert.notEqual(batch.intent, 'rollback');
        const plan = await buildTariffBatchPlan({ proposal: parseTariffBatchProposal(batch), state,
          policy: { status: 'loaded', rules: [] } });
        assert.equal(plan.fullScopeCount, count);
        assert.equal(plan.counts.conflict, 0, JSON.stringify(plan.rows.filter(row => row.issue).slice(0, 2)));
        assert.ok(plan.rows.length <= 226);
        for (const row of plan.rows) {
          assert.ok(row.proposedCents! >= Math.ceil(row.supplierListCents - 1e-9));
          if (row.selector.billingInputType === 'video_input') assert.equal(row.domain?.maxInputSeconds, 30);
          if (modelId === 'seedance-2-5') assert.equal(row.proposedCell?.id, row.previousCell?.id);
        }
        checked += plan.rows.length;
      }
      assert.equal(checked, count);
    }
  } finally { ENV.SEEDANCE_2_5_EDIT_TRANSPORT = saved; }
});

test('Seedance imports reject mixed models, unsupported fields, altered minima, low slopes and LAS', () => {
  const saved = ENV.SEEDANCE_2_5_EDIT_TRANSPORT;
  ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'modelark';
  try {
    const first = prepareSeedanceAdminBatches('seedance-2-5-flash')[0];
    assert.throws(() => parseTariffBatchProposal({ ...first, modelId: 'seedance-2-5' }), /selector/);
    assert.throws(() => parseTariffBatchProposal({ ...first, pricing: { kind: 'list_multiplier', multiplier: '1.6' } }), /explicit/);
    assert.ok(first.intent !== 'rollback');
    assert.throws(() => parseTariffBatchProposal({ ...first, selections: Array.from({ length: 227 }, () => first.selections[0]) }), /226/);
    const row = seedanceBatchClasses('seedance-2-5-flash').find(row => row.selector.billingInputType === 'video_input')!;
    const grid = prepareSeedance25CommercialTariffs({ modelId: 'seedance-2-5-flash', at: '2026-11-13', standardEditTransport: 'modelark' });
    const cell = grid.cells.find(cell => JSON.stringify(cell.selector) === JSON.stringify(row.selector))!;
    const changed = structuredClone(cell.price);
    assert.equal(changed.kind, 'unit_components');
    if (changed.kind !== 'unit_components') throw new Error('expected source tariff');
    changed.components[0].flatCents = 1;
    assert.throws(() => validateSeedanceBatchDomain(row, changed), /minimum|proportional/);
    const low = structuredClone(cell.price);
    if (low.kind !== 'unit_components') throw new Error('expected source tariff');
    low.components[0].flatCents /= 10; low.components[0].terms[0].centsPerUnit /= 10;
    assert.throws(() => validateSeedanceBatchDomain(row, low), /below/);
    ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'las';
    assert.throws(() => seedanceBatchClasses('seedance-2-5'), /ModelArk/);
  } finally { ENV.SEEDANCE_2_5_EDIT_TRANSPORT = saved; }
});

test('literal continuous amounts equal LIST times the approved multiplier at fractional inputs in every class', () => {
  for (const modelId of ['seedance-2-5', 'seedance-2-5-flash'] as const) {
    const grid = prepareSeedance25CommercialTariffs({ modelId, at: '2026-11-13', standardEditTransport: 'modelark' });
    for (const { context, cell } of grid.scenarios.filter(row => row.context.hasVideoInput)) {
      const rate = getBytePlusVideoListRate({ profile: modelId === 'seedance-2-5' ? 'seedance25' : 'seedance25Flash',
        resolution: context.resolution, billingInputType: 'video_input' });
      for (const inputVideoDurationSec of [0.001, 2, 4.25, 14.999, 29.999, 30]) {
        const usage = estimateBytePlusBillableTokens({ engineId: modelId, durationSec: context.durationSec,
          resolution: context.resolution, aspectRatio: context.aspectRatio, billingInputType: 'video_input', inputVideoDurationSec })!;
        const expected = Math.ceil(usage.tokenCount * rate.unitPriceUsdPer1kTokens / 10 * grid.multiplier - 1e-9);
        assert.equal(evaluateManualTariffPrice(cell.price, { input_video_seconds: inputVideoDurationSec }).customerTotalCents, expected);
      }
    }
  }
});
