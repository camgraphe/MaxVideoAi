import assert from 'node:assert/strict';
import test from 'node:test';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { buildTariffBatchPlan } from '../frontend/server/pricing-admin/tariff-batches/planner';
import { klingBatchClasses } from '../frontend/server/pricing-admin/tariff-batches/kling';
import { parseTariffBatchProposal } from '../frontend/server/pricing-admin/tariff-batches/input';
import type { TariffBatchProposal } from '../frontend/server/pricing-admin/tariff-batches/contract';

const policy = { status: 'loaded' as const, rules: [] };
const state = { status: 'loaded' as const, active: true, revision: 7, databaseCells: [] as ManualTariffCell[], versionedCells: [] as ManualTariffCell[] };
const selector = { engineId: 'kling-v4', mode: 't2v', resolution: '720p', durationSec: '5', billingInputType: 'no_video_input' };
const proposal = (selectors = [selector]): TariffBatchProposal => ({ schemaVersion: 1, modelId: 'kling-v4', intent: 'create_missing',
  reason: 'Reviewed launch prices', pricing: { kind: 'list_multiplier', multiplier: '1.50' }, selections: selectors.map(selector => ({ selector })) });

test('Kling batch inventory deduplicates Modify into 226 canonical classes without publishing the model', () => {
  const classes = klingBatchClasses();
  assert.equal(classes.length, 226);
  assert.equal(classes.filter(c => c.selector.billingInputType === 'no_video_input').length, 168);
  assert.equal(classes.filter(c => c.selector.mode === 'ref2v' && c.selector.billingInputType === 'video_input').length, 56);
  assert.equal(classes.filter(c => c.selector.mode === 'v2v').length, 2);
  assert.equal(new Set(classes.map(c => c.key)).size, 226);
});

test('the full canonical batch quotes unchanged approved fixed and continuous prices', async () => {
  const plan = await buildTariffBatchPlan({ proposal: proposal(klingBatchClasses().map(c => c.selector)), state, policy });
  assert.deepEqual(plan.counts, { create: 226, update: 0, unchanged: 0, conflict: 0 });
  const find = (mode: string, resolution: string, seconds: string, input = 'no_video_input') => plan.rows.find(r =>
    r.selector.mode === mode && r.selector.resolution === resolution && r.selector.durationSec === seconds && r.selector.billingInputType === input)!;
  assert.equal(find('t2v', '720p', '5').proposedCents, 118);
  assert.equal(find('t2v', '720p', '10').proposedCents, 236);
  assert.equal(find('t2v', '1080p', '5').proposedCents, 177);
  assert.deepEqual(find('ref2v', '720p', '5', 'video_input').proposedCell?.price,
    { kind: 'unit_terms', rounding: 'up', terms: [{ unit: 'billable_seconds', centsPerUnit: 14.1 }] });
  assert.equal(find('v2v', '1080p', 'continuous', 'video_input').proposedCents, 127);
  assert.deepEqual(state.databaseCells, []);
});

test('resume keeps arbitrary existing IDs and history; changing a selected price needs explicit replacement', async () => {
  const first = await buildTariffBatchPlan({ proposal: proposal(), state, policy });
  const cell: ManualTariffCell = { ...first.rows[0].proposedCell!, id: 'existing-stable-id', version: 4, effectiveFrom: '2026-10-01T00:00:00.000Z' };
  const current = { ...state, databaseCells: [cell] };
  const before = structuredClone(current);
  const same = await buildTariffBatchPlan({ proposal: proposal(), state: current, policy });
  assert.equal(same.rows[0].action, 'unchanged');
  assert.equal(same.rows[0].previousCell?.id, 'existing-stable-id');
  assert.deepEqual(current, before);
  const change = { ...proposal(), pricing: { kind: 'list_multiplier' as const, multiplier: '1.60' } };
  const conflict = await buildTariffBatchPlan({ proposal: change, state: current, policy });
  assert.equal(conflict.rows[0].action, 'conflict');
  const update = await buildTariffBatchPlan({ proposal: { ...change, intent: 'replace_selected' }, state: current, policy });
  assert.equal(update.rows[0].action, 'update');
  assert.equal(update.rows[0].proposedCell?.id, 'existing-stable-id');
  assert.equal(update.rows[0].proposedCents, 126);
});

test('an unavailable snapshot or a missing replacement target cannot become a create', async () => {
  await assert.rejects(buildTariffBatchPlan({ proposal: proposal(), state: { status: 'unavailable' }, policy }), /unavailable/i);
  await assert.rejects(buildTariffBatchPlan({ proposal: proposal(), state: { ...state, active: false }, policy }), /active/i);
  const plan = await buildTariffBatchPlan({ proposal: { ...proposal(), intent: 'replace_selected' }, state, policy });
  assert.equal(plan.counts.create, 0);
  assert.equal(plan.counts.conflict, 1);
});

test('a continuous target with an exact effective exception cannot hide or overwrite it', async () => {
  const target = klingBatchClasses().find(c => c.selector.mode === 'ref2v' && c.selector.billingInputType === 'video_input')!;
  const exception: ManualTariffCell = { id: 'exact-exception', source: 'database', version: 5, currency: 'USD',
    selector: { ...target.selector, inputVideoDurationSec: '3' }, effectiveFrom: '2026-10-01T00:00:00.000Z', price: { kind: 'fixed', customerCents: 999 } };
  const plan = await buildTariffBatchPlan({ proposal: proposal([target.selector]), state: { ...state, databaseCells: [exception] }, policy });
  assert.equal(plan.rows[0].action, 'conflict');
  assert.match(plan.rows[0].issue!, /exception/i);
});

test('proposal parsing rejects unknown fields, duplicate selectors, currency, invalid rates and unsupported options', () => {
  assert.deepEqual(parseTariffBatchProposal(proposal()), proposal());
  assert.throws(() => parseTariffBatchProposal({ ...proposal(), actorId: 'forged' }), /field/i);
  assert.throws(() => parseTariffBatchProposal(proposal([selector, selector])), /duplicate/i);
  assert.throws(() => parseTariffBatchProposal({ ...proposal(), pricing: { kind: 'list_multiplier', multiplier: 'NaN' } }), /multiplier/i);
  assert.throws(() => parseTariffBatchProposal({ ...proposal(), currency: 'EUR' }), /field|USD/i);
  assert.throws(() => parseTariffBatchProposal({ ...proposal(), pricing: { kind: 'explicit' }, selections: [{ selector, price: { kind: 'fixed', customerCents: -1 } }] }), /price/i);
});

test('unsupported classes and below-reference explicit prices are blocked by real canonical owners', async () => {
  await assert.rejects(buildTariffBatchPlan({ proposal: proposal([{ ...selector, resolution: '4k' }]), state, policy }), /unsupported/i);
  const low: TariffBatchProposal = { ...proposal(), pricing: { kind: 'explicit' }, selections: [{ selector, price: { kind: 'fixed', customerCents: 1 } }] };
  const plan = await buildTariffBatchPlan({ proposal: low, state, policy });
  assert.equal(plan.rows[0].action, 'conflict');
  assert.equal(plan.counts.create, 0);
});

test('compiled continuous rates retain approved fractional totals and upward cent rounding across the domain', async () => {
  const { evaluateManualTariffPrice } = await import('../packages/pricing/src/manual-tariff-price');
  const { compileKlingBatchPrice } = await import('../frontend/server/pricing-admin/tariff-batches/kling');
  for (const [resolution, rateHundredths, example] of [['720p', 1410, 216], ['1080p', 2115, 323]] as const) {
    const row = klingBatchClasses().find(c => c.selector.mode === 'ref2v' && c.selector.resolution === resolution && c.selector.billingInputType === 'video_input')!;
    const price = compileKlingBatchPrice(row, '1.50');
    assert.equal(evaluateManualTariffPrice(price, { billable_seconds: 15.25 }).customerTotalCents, example);
    for (let hundredths = 600; hundredths <= 6000; hundredths += 17) {
      const actual = evaluateManualTariffPrice(price, { billable_seconds: hundredths / 100 }).customerTotalCents;
      assert.equal(actual, Math.ceil(hundredths * rateHundredths / 10000), `${resolution} ${hundredths}/100 seconds`);
    }
  }
});

test('scheduled prices and future exact exceptions require review before an immediate batch', async () => {
  const first = await buildTariffBatchPlan({ proposal: proposal(), state, policy });
  const current = { ...first.rows[0].proposedCell!, source: 'versioned' as const, id: 'authored-current' };
  const future = { ...current, source: 'database' as const, id: 'future-price', effectiveFrom: '2099-01-01T00:00:00.000Z' };
  const p = await buildTariffBatchPlan({ proposal: proposal(), state: { ...state, databaseCells: [future], versionedCells: [current] }, policy });
  assert.equal(p.counts.conflict, 1); assert.match(p.rows[0].issue!, /future|scheduled/i);
  const continuous = klingBatchClasses().find(c => c.selector.mode === 'ref2v' && c.selector.billingInputType === 'video_input')!;
  const exception = { ...future, selector: { ...continuous.selector, inputVideoDurationSec: '3' } };
  const c = await buildTariffBatchPlan({ proposal: proposal([continuous.selector]), state: { ...state, databaseCells: [exception] }, policy });
  assert.equal(c.counts.conflict, 1);
});

test('full-model replacement remains bounded after fifty historical versions per selected class', async () => {
  const initial = await buildTariffBatchPlan({ proposal: proposal(klingBatchClasses().map(c => c.selector)), state, policy });
  const current = initial.rows.map((r, i) => ({ ...r.proposedCell!, version: i + 1 }));
  const history = current.flatMap(cell => Array.from({ length: 50 }, (_, i) => ({ ...cell,
    version: 1000 + i, effectiveFrom: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
    effectiveUntil: new Date(Date.UTC(2026, 0, i + 2)).toISOString() })));
  const started = performance.now();
  const result = await buildTariffBatchPlan({ proposal: { ...proposal(current.map(c => c.selector)), intent: 'replace_selected',
    pricing: { kind: 'list_multiplier', multiplier: '1.60' } }, state: { ...state, databaseCells: [...history, ...current] }, policy });
  const elapsedMs = performance.now() - started;
  assert.equal(result.counts.update, 226);
  console.log(JSON.stringify({ measurement: 'same-model-11526-rows-planner', elapsedMs }));
  assert.ok(elapsedMs < 3000, `Planner must leave room within the 5-second transaction: ${elapsedMs}ms`);
});
