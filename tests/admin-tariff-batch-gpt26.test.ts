import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { gptImage26TariffScenarios } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { estimateGptImage26OutputTokens } from '../frontend/lib/image/gptImage26Pricing';
import { buildTariffBatchPlan } from '../frontend/server/pricing-admin/tariff-batches/planner';
import { batchSelectorKey, parseTariffBatchProposal } from '../frontend/server/pricing-admin/tariff-batches/input';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import type { TariffBatchProposal } from '../frontend/server/pricing-admin/tariff-batches/contract';

const policy = { status: 'loaded' as const, rules: [] };
const state = { status: 'loaded' as const, active: true, revision: 7, databaseCells: [] as ManualTariffCell[], versionedCells: [] as ManualTariffCell[] };
const root = new URL('../docs/launch/2026-11-05-model-refresh/gpt26-tariffs/', import.meta.url);
const approval = JSON.parse(readFileSync(new URL('approval.json', root), 'utf8'));
const batches: TariffBatchProposal[] = approval.batches.map((entry: { file: string }) => JSON.parse(readFileSync(new URL(entry.file, root), 'utf8')));

test('all 2040 approved GPT prices pass bounded native previews and the public quote with partial cost provenance', async () => {
  const scenarios = gptImage26TariffScenarios();
  const byKey = new Map(scenarios.map(scenario => [batchSelectorKey(scenario.selector), scenario]));
  const seen = new Set<string>();
  assert.equal(batches.length, 10);
  for (const proposal of batches) {
    const plan = await buildTariffBatchPlan({ proposal, state, policy });
    assert.equal(plan.fullScopeCount, 1044);
    assert.ok(plan.rows.length <= 226);
    assert.deepEqual(plan.counts, { create: plan.rows.length, update: 0, unchanged: 0, conflict: 0 });
    for (const row of plan.rows) {
      assert.ok(!seen.has(row.key)); seen.add(row.key);
      const scenario = byKey.get(row.key)!;
      assert.ok(scenario, row.key);
      const [width, height] = scenario.context.resolution.split('x').map(Number);
      const tokens = estimateGptImage26OutputTokens({ width, height, quality: scenario.context.quality as 'high' });
      const n = BigInt(scenario.context.durationSec), refs = BigInt(scenario.context.referenceImageCount ?? 0);
      const microUsd = BigInt(tokens) * n * 30n + 10000n * n + 20000n * refs * n;
      const approvedCents = Number((microUsd * 150n + 999999n) / 1000000n);
      assert.equal(row.proposedCents, approvedCents, row.key);
      assert.equal(row.supplierCostIncomplete, true);
      assert.equal(row.domain, undefined);
      const quoted = await computeCanonicalPublicSnapshot(scenario.context, {
        loadCustomerTariffState: async () => ({ ...state, databaseCells: [row.proposedCell!] }),
        pricingPolicy: { loadOverrides: async () => policy },
      });
      assert.equal(quoted.totalCents, approvedCents);
      assert.equal(quoted.meta?.customerTariffCellId, row.proposedCell!.id);
      assert.equal(quoted.meta?.providerCostIncomplete, true);
    }
  }
  assert.equal(seen.size, 2040);
  assert.equal(seen.size, byKey.size);
});

test('GPT batches require explicit fixed prices and reject mixed variants, video fields and oversized operations', async () => {
  const first = batches[0];
  assert.notEqual(first.intent, 'rollback');
  if (first.intent === 'rollback') return;
  const entry = first.selections[0];
  for (const value of [
    { ...first, pricing: { kind: 'list_multiplier', multiplier: '1.50' }, selections: [{ selector: entry.selector }] },
    { ...first, selections: [{ ...entry, price: { kind: 'unit_terms', rounding: 'up', terms: [{ unit: 'billable_seconds', centsPerUnit: 1 }] } }] },
    { ...first, selections: [{ ...entry, selector: { ...entry.selector, engineId: 'gpt-image-2-6-sunburst' } }] },
    { ...first, selections: [{ ...entry, selector: { ...entry.selector, billingInputType: 'no_video_input' } }] },
    { ...first, selections: [...first.selections, entry] },
  ]) assert.throws(() => parseTariffBatchProposal(value));
  for (const selector of [
    { ...entry.selector, quality: 'auto' }, { ...entry.selector, durationSec: '5' },
    { ...entry.selector, mode: 'i2i', referenceImageCount: '17' },
    { ...entry.selector, mode: 't2i', referenceImageCount: '1' },
  ]) await assert.rejects(buildTariffBatchPlan({ proposal: { ...first, selections: [{ ...entry, selector }] }, state, policy }), /unsupported/i);
});
