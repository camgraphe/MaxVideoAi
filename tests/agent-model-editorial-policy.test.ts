import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {studioVisualCapabilityDetails,studioVisualCapabilitySummary} from '../frontend/src/server/studio/conversation-capabilities';

const loadPolicy = () => import('../frontend/src/server/agent-api/model-editorial-policy').catch(() => null);
const asOf = new Date('2026-10-03T12:00:00Z');

function fixture() {
  return {schemaVersion: 1,version: '2026-10-04.1',basis: 'product_editorial_preference',reviewedAt: '2026-10-03',reviewAfterDays: 90,
    provenance: [{kind: 'product_decision',source: 'MaxVideoAI Studio editorial review',sourceVersion: null,reviewedAt: '2026-10-03',summary: 'A product preference, not a comparative quality benchmark.'}],
    entries: [{engineId: 'wan-3',level: 'reference',rationale: 'Reference choice when its exact capabilities match.'}]};
}

test('editorial review is exact-version, dated and honest about vendor evidence', async () => {
  const policy = await loadPolicy();
  assert.ok(policy?.getAgentModelEditorialGuidance, 'A shared editorial policy must be available to model consumers.');
  for (const id of ['seedance-2-5','wan-3','kling-o3-pro']) {
    const entry = policy.getAgentModelEditorialGuidance(id,asOf);
    assert.equal(entry.level,'reference');
    assert.equal(entry.basis,'product_editorial_preference');
    assert.equal(entry.reviewStatus,'current');
    assert.equal(entry.reviewAgeDays,0);
    assert.equal(entry.policyVersion,'2026-10-04.1');
    assert.ok(entry.provenance.some(source => source.kind === 'product_decision'));
    assert.ok(Object.isFrozen(entry));
  }
  assert.equal(policy.getAgentModelEditorialGuidance('minimax-h3',asOf).level,'alternative');
  assert.equal(policy.getAgentModelEditorialGuidance('pika-text-to-video',asOf).level,'on_request');
  const vendor = policy.getAgentModelEditorialGuidance('seedance-2-5',asOf).provenance.find(source => source.kind === 'vendor_policy');
  assert.equal(vendor?.sourceVersion,'0.13.0');
  assert.match(vendor?.summary ?? '',/not.*(ranking|benchmark)/i);
  const unreviewed = policy.getAgentModelEditorialGuidance('seedance-future-version',asOf);
  assert.equal(unreviewed.level,'alternative');
  assert.equal(unreviewed.reviewStatus,'unreviewed');
  assert.equal(unreviewed.reviewedAt,null);
  assert.equal(unreviewed.reviewAgeDays,null);
  assert.deepEqual(unreviewed.provenance,[]);
  assert.equal(policy.getAgentModelEditorialGuidance('wan-3',new Date('2027-01-02T00:00:00Z')).reviewStatus,'review_due');
  assert.equal(policy.getAgentModelEditorialGuidance('wan-3',new Date('2026-10-02T00:00:00Z')).reviewStatus,'not_yet_reviewed');
});

test('editorial validation rejects fabricated scores, unknown versions and unclassified provenance', async () => {
  const policy = await loadPolicy();
  assert.ok(policy?.parseAgentModelEditorialPolicy);
  const valid = fixture();
  const known = new Set(['wan-3']);
  assert.equal(policy.parseAgentModelEditorialPolicy(valid,known).entries[0].engineId,'wan-3');
  const invalid: unknown[] = [
    {...valid,schemaVersion: 2},
    {...valid,reviewAfterDays: 0},
    {...valid,reviewedAt: '2026-02-30'},
    {...valid,provenance: []},
    {...valid,entries: [{...valid.entries[0],engineId: 'wan-future'}]},
    {...valid,entries: [...valid.entries,...valid.entries]},
    {...valid,entries: [{...valid.entries[0],qualityScore: 99}]},
    {...valid,entries: [{...valid.entries[0],rationale: ' Untrimmed'}]},
    {...valid,entries: [{...valid.entries[0],level: 'best'}]},
    {...valid,provenance: [{...valid.provenance[0],kind: 'objective_quality'}]},
    {...valid,provenance: [{...valid.provenance[0],kind: 'vendor_policy',source: 'https://example.com/ranking',sourceVersion: '1'}]},
  ];
  for (const document of invalid) assert.throws(()=>policy.parseAgentModelEditorialPolicy(document,known));
});

test('Studio exposes editorial context beside exact certified capability facts without widening modes', () => {
  const entry = getFalEngineById('wan-3')!;
  const candidate = {engine: entry.engine,surface: 'video' as const,publicModes: ['t2v' as const],modeCaps: {t2v: entry.modes.find(mode=>mode.mode==='t2v')!.ui}};
  const summary = studioVisualCapabilitySummary(candidate);
  const details = studioVisualCapabilityDetails(candidate);
  assert.equal(summary.editorialGuidance?.level,'reference');
  assert.ok(!('provenance' in (summary.editorialGuidance ?? {})),'Catalog facts stay compact; exact details carry provenance.');
  assert.ok(JSON.stringify(summary.editorialGuidance).length<600);
  assert.notEqual(details.surface,'audio');
  if (details.surface === 'audio') return;
  assert.equal(details.editorialGuidance?.level,'reference');
  assert.ok(details.editorialGuidance?.provenance.length);
  assert.deepEqual(details.modes.map(mode=>mode.mode),['t2v']);
  assert.deepEqual(summary.modes,['t2v']);
});
