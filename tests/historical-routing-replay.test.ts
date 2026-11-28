import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHistoricalReplay } from '../frontend/app/(core)/admin/routing/_lib/historical-replay';
import type { HistoricalReplayGroup } from '../frontend/app/(core)/admin/routing/_lib/historical-replay-types';
import type { CatalogueCard } from '../frontend/app/(core)/admin/routing/_lib/catalogue/types';
import { apimartH3 } from '../frontend/app/(core)/admin/routing/_lib/catalogue/minimax-h3';
import type { ComparisonRequest } from '../frontend/app/(core)/admin/routing/_lib/comparison-offers';

const textClip: ComparisonRequest = {
  engineId: 'wan-3-prime', mode: 't2v', durationSec: 15, resolution: '480p', aspectRatio: '16:9',
  audioEnabled: true, images: 0, hasVideo: false, hasStartFrame: false, hasEndFrame: false, inputVideoSeconds: 0,
  hasAudioReference: false, hasDocument: false, requiresDirectControls: false, hasUnpricedOptions: false, requestedRatioVerified: true,
};
function group(r: ComparisonRequest = textClip, overrides: Partial<HistoricalReplayGroup> = {}): HistoricalReplayGroup {
  return {engineId: r.engineId, request: r, jobs: 1, status: 'completed', paidWallet: true,
    historicalProvider: 'alibaba_model_studio', ceilingMicros: 10_000_000, ...overrides};
}

test('historical costing uses the delivered supplier tariff and shares a single population across comparisons', () => {
  const source = {...textClip, engineId: 'wan-3', mode: 'ref2v', resolution: '720p', durationSec: 5,
    hasVideo: true, referenceVideoSeconds: [5], inputVideoSeconds: 5};
  const report = buildHistoricalReplay([group(textClip, {jobs:2}), group(source)]);
  assert.deepEqual(report.totals, {jobs:3, completedPaidJobs:3, comparableJobs:3, excludedJobs:0, historicalPricedJobs:3, historicalPricedMicros:3_040_000, historicalMicros:3_040_000,
    installedMicros:3_040_000, allMicros:2_442_900, installedSavingsMicros:0, additionalSavingsMicros:597_100});
  assert.deepEqual(report.opportunities, [
    {provider:'apimart', standaloneSavingsMicros:497_100, incrementalSavingsMicros:497_100, jobsImproved:2, incrementalJobs:2},
    {provider:'wavespeed', standaloneSavingsMicros:115_000, incrementalSavingsMicros:100_000, jobsImproved:3, incrementalJobs:1},
  ]);
  assert.deepEqual(report.flows.map(f => [f.chosenProvider, f.jobs, f.savingsMicros]), [['apimart',2,497_100], ['wavespeed',1,100_000]]);
  assert.equal(report.traces.find(t => t.engineId === 'wan-3-prime')?.all?.order.at(-1), 'fal');
});

test('delivered H3 price survives loss of original framing, substitution needs separate proof', () => {
  const ref = {...textClip, engineId:'minimax-h3', mode:'ref2v', resolution:'480P', durationSec:15, images:2,
    requestedRatioVerified:false, aspectRatio:null, observedAspectRatio:'26:15', h3PromptExpansion:'balanced', promptCharacters:120};
  const unknown = {...ref,resolution:'768P',observedAspectRatio:'16:9',h3PromptExpansion:'disabled'};
  const rows = [group(ref,{jobs:3,historicalProvider:'fal'}),group(unknown,{historicalProvider:'fal'}),
    group({...ref,engineId:'minimax-h3-max'},{historicalProvider:'fal'})];
  const r = buildHistoricalReplay(rows);
  const qualified = r.traces.find(t => t.jobs === 3)!;
  assert.deepEqual(qualified.all?.order,['fal']);
  assert.ok(qualified.basisNote);
  assert.equal(qualified.profile?.observedAspectRatio,'26:15');
  assert.equal(r.totals.historicalPricedJobs,4);
  assert.equal(r.totals.comparableJobs,3);
  assert.equal(r.totals.historicalPricedMicros,3 * 750_000 + 900_000);
  assert.equal(r.totals.historicalMicros,3 * 750_000);
  assert.equal(r.totals.additionalSavingsMicros,0);
  assert.ok(r.coverageGaps.some(g => g.reason.includes('Original requested') && g.aspectRatio === '16:9'));
  assert.ok(r.coverageGaps.some(g => g.reason.includes('reference tokens')));
});

test('conditional standard discount affects the historical owner and the alternatives independently', () => {
  const standard = {...textClip, engineId: 'wan-3', durationSec: 5, resolution: '720p'};
  const groups = [group(standard), group(standard, {historicalProvider:'fal'})];
  const discounted = buildHistoricalReplay(groups, {alibabaStandardDiscount:true});
  assert.deepEqual(discounted.traces.map(t => [t.historicalProvider, t.historicalMicros, t.installed?.costMicros, t.all?.costMicros]),
    [['alibaba_model_studio',350000,350000,328750], ['fal',500000,350000,328750]]);
  assert.equal(discounted.traces[1].offers.find(o => o.provider === 'fal')?.reason, 'Above purchase ceiling');
  assert.equal(discounted.totals.installedSavingsMicros, 150000);
  assert.equal(discounted.totals.additionalSavingsMicros, 42500);
  assert.equal(buildHistoricalReplay(groups).totals.historicalMicros, 1_000_000);
});

test('unknown, unpaid, failed, incompatible and unaffordable rows stay in coverage without savings', () => {
  const rows = [
    group(textClip, {status:'failed'}), group(textClip, {paidWallet:false}), group(textClip, {ceilingMicros:null}),
    group(textClip, {historicalProvider:null}), group(textClip, {request:null}), group(textClip, {historicalProvider:'unmapped'}),
    group({...textClip, images:1}), group({...textClip, hasUnpricedOptions:true}), group(textClip, {ceilingMicros:60}),
    group({...textClip, hasUnpricedOptions:undefined}), group({...textClip, hasStartFrame:undefined}),
    group({...textClip, aspectRatio:null}), group({...textClip, audioEnabled:undefined}),
    group(textClip, {missingReason:'Conflicting accepted providers'}),
    group({...textClip, engineId:'veo-3-1'}, {historicalProvider:'fal'}),
  ];
  const r = buildHistoricalReplay(rows);
  assert.equal(r.totals.excludedJobs, rows.length);
  assert.equal(r.totals.comparableJobs, 0);
  assert.equal(r.totals.additionalSavingsMicros, 0);
  assert.ok(r.traces.every(t => t.excludedReason));
  assert.equal(r.excludedReasons.reduce((sum,row) => sum + row.jobs,0), rows.length);
  assert.deepEqual(r.opportunities, []);
  assert.deepEqual(r.flows, []);
  assert.deepEqual(r.singleRouteProfiles, []);
  assert.equal(r.traces.find(t => t.status === 'failed')?.all?.provider, 'apimart');
  assert.equal(r.traces.find(t => t.status === 'failed')?.historicalMicros, null);
  assert.equal(r.traces.find(t => t.historicalProvider === null)?.installed?.provider, 'alibaba_model_studio');
});

test('standby, native Seedance, engine coverage and pagination follow the actual profiles', () => {
  const kling = {...textClip, engineId:'kling-3-pro', resolution:'1080p', durationSec:5};
  const seedance = {...textClip, engineId:'seedance-2-5', resolution:'720p', durationSec:7, observedVideoTokens:67652};
  const rows = [group(kling, {historicalProvider:'fal', bucketAt:'2026-11-11T14:00:00.000Z'}),
    group(textClip), group(seedance, {historicalProvider:'byteplus_modelark'}), group(kling, {jobs:3, historicalProvider:'fal',
      bucketAt:'2026-11-13T13:00:00.000Z'})];
  const r = buildHistoricalReplay(rows, {engineId:'kling-3-pro', page:1, pageSize:1});
  assert.equal(r.coverage.length, 3);
  assert.equal(r.totals.jobs, 4);
  assert.equal(r.totalProfiles, 2);
  assert.equal(r.traces.length, 1);
  assert.equal(r.traces[0].jobs, 3);
  assert.equal(r.traces[0].installed?.provider, 'fal');
  assert.equal(r.traces[0].offers.find(o => o.provider === 'kling_direct')?.reason, 'Kling Direct pack on standby');
  const second = buildHistoricalReplay(rows, {engineId:'kling-3-pro', page:99, pageSize:1});
  assert.equal(second.page, 2);
  assert.deepEqual(second.flows,r.flows);
  assert.deepEqual(r.singleRouteProfiles, [{engineId:'kling-3-pro', mode:'t2v', resolution:'1080p',
    provider:'fal', jobs:4, historicalMicros:r.totals.historicalMicros}]);
  const direct = buildHistoricalReplay(rows, {engineId:'seedance-2-5'});
  assert.deepEqual(direct.traces[0].all?.order, ['byteplus_modelark']);
  assert.deepEqual(direct.opportunities, []);
  assert.equal(direct.totals.installedSavingsMicros, 0);
  assert.equal(direct.totals.additionalSavingsMicros, 0);
});

test('H3 handles the inherited start-frame ratio and compares Gold only with proven expansion and prompt conditions', () => {
  const h3 = {...textClip, engineId:'minimax-h3', mode:'i2v', resolution:'2K', durationSec:5,
    images:1, hasStartFrame:true, aspectRatio:null, promptCharacters:120};
  const data = ['disabled','balanced',undefined].map(h3PromptExpansion =>
    group({...h3, h3PromptExpansion}, {historicalProvider:'fal'}));
  data.push(group({...h3, h3PromptExpansion:'disabled', promptCharacters:undefined}, {historicalProvider:'fal'}));
  const report = buildHistoricalReplay(data);
  assert.equal(report.totals.comparableJobs, 4);
  assert.equal(report.totals.historicalMicros, 4 * 650_000);
  assert.equal(report.totals.additionalSavingsMicros, 650_000 - 457_200);
  assert.equal(report.flows.find(f => f.chosenProvider === 'apimart')?.jobs, 1);
  assert.equal(report.singleRouteProfiles[0].jobs, 3);
  assert.deepEqual(buildHistoricalReplay([...data].reverse(), {pageSize:1}).traces,
    buildHistoricalReplay(data, {pageSize:1}).traces);
});

test('a new supplier flows into replay savings and needs its own evidence when original framing is missing', () => {
  const negotiatedCard: CatalogueCard = {
    provider: 'wavespeed', engines: ['minimax-h3'],
    quote: r => ({
      tariff: 'Negotiated fixture', sourceUrl: 'https://example.test/contract',
      costMicros: r.aspectRatio === '16:9' ? 100_000 : null,
      excluded: r.aspectRatio === '16:9' ? null : 'Only 16:9 reviewed',
    }),
  };
  const r = { ...textClip, engineId: 'minimax-h3', resolution: '480P', h3PromptExpansion: 'balanced', promptCharacters: 120 };
  const report = buildHistoricalReplay([
    group(r, {jobs: 3, historicalProvider: 'fal'}),
    group({ ...r, requestedRatioVerified: false, aspectRatio: null }, {historicalProvider: 'fal'}),
  ], {cards: [apimartH3, negotiatedCard]});
  assert.equal(report.totals.comparableJobs, 3);
  assert.ok(report.totals.additionalSavingsMicros > 0);
  assert.equal(report.opportunities[0].provider, 'wavespeed');
  assert.equal(report.opportunities[0].jobsImproved, 3);
  assert.match(report.traces.find(t => t.jobs === 1)?.excludedReason ?? '', /ratio is unverified/);
});
