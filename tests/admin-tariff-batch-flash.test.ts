import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { buildTariffBatchPlan } from '../frontend/server/pricing-admin/tariff-batches/planner';
import { klingBatchClasses, klingBatchSourceFacts } from '../frontend/server/pricing-admin/tariff-batches/kling';
import { batchSelectorKey, parseTariffBatchProposal } from '../frontend/server/pricing-admin/tariff-batches/input';
import type { TariffBatchProposal } from '../frontend/server/pricing-admin/tariff-batches/contract';

const policy = { status: 'loaded' as const, rules: [] };
const state = { status: 'loaded' as const, active: true, revision: 7, databaseCells: [] as ManualTariffCell[], versionedCells: [] as ManualTariffCell[] };
const flashProposal = (): TariffBatchProposal => ({ schemaVersion: 1, modelId: 'kling-v4-flash', intent: 'create_missing',
  reason: 'Approved Flash LIST plus thirty percent', pricing: { kind: 'list_multiplier', multiplier: '1.30' },
  selections: klingBatchClasses('kling-v4-flash').map(row => ({ selector: row.selector })) });

test('Flash has its own 72 canonical classes and supplier provenance', () => {
  const classes = klingBatchClasses('kling-v4-flash');
  assert.equal(classes.length, 72);
  assert.equal(classes.filter(row => row.selector.billingInputType === 'no_video_input').length, 54);
  assert.equal(classes.filter(row => row.selector.billingInputType === 'video_input').length, 18);
  assert.ok(classes.every(row => row.selector.engineId === 'kling-v4-flash' && row.selector.resolution === '720p'));
  assert.ok(classes.every(row => row.selector.mode !== 'v2v' && Number(row.selector.durationSec) <= 20));
  const facts = klingBatchSourceFacts('kling-v4-flash');
  assert.equal(facts.sourceDate, '2026-11-05');
  assert.match(facts.source, /kling\/v4\/flash\//);
  assert.deepEqual([...new Set(facts.classes.map(row => row.usage.centsPerSecond))].sort(), [6.3, 9.4]);
  assert.equal(klingBatchClasses().length, 226);
});

test('all Flash batch prices exactly match the 72 approved native previews', async () => {
  const approved = JSON.parse(readFileSync(new URL('../docs/launch/2026-11-05-model-refresh/flash-tariff-preview.json', import.meta.url), 'utf8'));
  const plan = await buildTariffBatchPlan({ proposal: flashProposal(), state, policy });
  const exactImport = JSON.parse(readFileSync(new URL('../docs/launch/2026-11-05-model-refresh/flash-tariff-batch.json', import.meta.url), 'utf8'));
  const imported = await buildTariffBatchPlan({ proposal: exactImport, state, policy });
  assert.deepEqual(imported.rows, plan.rows);
  assert.equal(plan.modelId, 'kling-v4-flash');
  assert.equal(plan.fullScopeCount, 72);
  assert.deepEqual(plan.counts, { create: 72, update: 0, unchanged: 0, conflict: 0 });
  for (const row of plan.rows) {
    const reviewed = approved.rows.find((item: { preview: { proposedCell: ManualTariffCell } }) =>
      batchSelectorKey(item.preview.proposedCell.selector) === row.key);
    assert.ok(reviewed, row.key);
    assert.deepEqual(row.proposedCell?.price, reviewed.preview.proposedCell.price, row.key);
    assert.equal(row.proposedCents, reviewed.preview.proposedCents, row.key);
    if (row.domain) assert.equal(row.domain.maxInputSeconds, 20);
  }
});

test('Flash batches reject cross-model selectors and unsupported V4 classes', async () => {
  assert.throws(() => parseTariffBatchProposal({ ...flashProposal(), modelId: 'kling-v4' }), /selector/i);
  const first = klingBatchClasses('kling-v4-flash')[0].selector;
  for (const unsupported of [{ resolution: '1080p' }, { mode: 'v2v' }, { durationSec: '21' }]) {
    await assert.rejects(buildTariffBatchPlan({ proposal: { ...flashProposal(), intent: 'create_missing',
      pricing: { kind: 'list_multiplier', multiplier: '1.30' }, selections: [{ selector: { ...first, ...unsupported } }] }, state, policy }), /unsupported/i);
  }
  assert.throws(() => parseTariffBatchProposal({ ...flashProposal(), modelId: 'gpt-image-2-6-flare' }), /selector|field/i);
});
