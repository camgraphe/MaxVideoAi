import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteComparisonRequest, type ComparisonRequest } from '../frontend/app/(core)/admin/routing/_lib/comparison-offers';
import { buildHistoricalReplay } from '../frontend/app/(core)/admin/routing/_lib/historical-replay';
import { rankQuotedOffers } from '../frontend/src/lib/video-purchase-decision';
import { installedRoutes } from '../frontend/app/(core)/admin/routing/_lib/installed-routes';
import { routingScenarios } from '../frontend/app/(core)/admin/routing/_lib/routing-scenarios';

const balancedReference: ComparisonRequest = {
  engineId: 'minimax-h3', mode: 'ref2v', images: 2, durationSec: 15, resolution: '480p', aspectRatio: '21:9',
  hasStartFrame: false, hasEndFrame: false, hasVideo: false, inputVideoSeconds: 0, hasAudioReference: false,
  hasDocument: false, hasUnpricedOptions: false, audioEnabled: true, h3PromptExpansion: 'balanced',
  hasSeed: false, ownedReferenceImages: true, requestedRatioVerified: true,
};

test('the qualified H3 simulation and economic replay use the installed WaveSpeed route and standard fee', () => {
  const quote = quoteComparisonRequest(balancedReference)!;
  const offer = quote.candidates.find(row => row.provider === 'videorouter');
  assert.ok(offer);
  assert.equal(offer.simulationOnly, undefined);
  assert.equal(offer.costMicros, 615_000);
  assert.equal(offer.excluded, null);
  assert.match(offer.tariff, /proxy for Balanced/);
  assert.equal(quote.baselineMicros, 750_000);
  assert.deepEqual(rankQuotedOffers(quote.candidates, { ceilingMicros: 750_000 }).order, ['videorouter', 'fal']);
  assert.deepEqual(rankQuotedOffers(quote.candidates, { ceilingMicros: 614_999 }).order, []);

  const scenario = routingScenarios().find(row => row.id === 'h3-balanced-wavespeed');
  assert.deepEqual(scenario?.candidates, quote.candidates);
  assert.match(scenario?.priceAssumption ?? '', /\$0\.6075/);
  const replay = buildHistoricalReplay([{
    engineId: balancedReference.engineId, request: balancedReference, jobs: 1,
    status: 'completed', paidWallet: true, historicalProvider: 'fal', ceilingMicros: 750_000,
  }]);
  assert.equal(replay.totals.comparableJobs, 1);
  assert.equal(replay.totals.historicalMicros, 750_000);
  assert.equal(replay.totals.installedMicros, 615_000);
  assert.equal(replay.totals.installedSavingsMicros, 135_000);
  assert.equal(replay.totals.additionalSavingsMicros, 0);

  const missingRatio = { ...balancedReference, aspectRatio: null, requestedRatioVerified: false };
  const trace = buildHistoricalReplay([{ engineId: missingRatio.engineId, request: missingRatio, jobs: 1,
    status: 'completed', paidWallet: true, historicalProvider: 'fal', ceilingMicros: 750_000 }]).traces[0];
  assert.match(trace.excludedReason ?? '', /Original requested aspect ratio/);
  assert.equal(trace.historicalMicros, 750_000);
});

test('H3 route map reflects the current environment independently of installed support', t => {
  const env = process.env;
  for (const key of ['MINIMAX_H3_VIDEOROUTER_CANARY', 'VIDEOROUTER_API_KEY']) {
    const saved = env[key];
    t.after(() => { if (saved === undefined) delete env[key]; else env[key] = saved; });
  }
  const h3 = () => installedRoutes().find(row => row.engineId === 'minimax-h3')!;
  delete env.MINIMAX_H3_VIDEOROUTER_CANARY;
  env.VIDEOROUTER_API_KEY = 'fixture';
  assert.deepEqual(h3().installedTargets, ['videorouter', 'fal']);
  assert.deepEqual(h3().targets, ['fal']);
  env.MINIMAX_H3_VIDEOROUTER_CANARY = 'public';
  assert.deepEqual(h3().targets, ['videorouter', 'fal']);
  delete env.VIDEOROUTER_API_KEY;
  assert.deepEqual(h3().targets, ['fal']);
});

test('H3 WaveSpeed quote stays within the observed options, media roles and edition', () => {
  const outside: Partial<ComparisonRequest>[] = [
    { mode: 'i2v', hasStartFrame: true }, { hasEndFrame: true }, { mode: 't2v', images: 0 }, { images: 1 },
    { durationSec: 14 }, { aspectRatio: null }, { aspectRatio: '16:9' }, { resolution: '768p' },
    { h3PromptExpansion: 'disabled' }, { h3PromptExpansion: 'quality' }, { h3PromptExpansion: 'fast' },
    { h3PromptExpansion: undefined }, { hasSeed: true }, { audioEnabled: false }, { hasVideo: true },
    { hasDocument: true }, { hasAudioReference: true }, { requiresDirectControls: true }, { hasUnpricedOptions: true },
    { referenceVideoSeconds: [5] }, { inputVideoSeconds: 5 }, { promptExpansionEnabled: false }, { promptExpansionEnabled: true },
    { hasSeed: undefined }, { ownedReferenceImages: undefined }, { ownedReferenceImages: false }, { audioEnabled: undefined },
    { hasUnpricedOptions: undefined }, { hasStartFrame: undefined },
  ];
  for (const change of outside) {
    const quote = quoteComparisonRequest({ ...balancedReference, ...change });
    const offer = quote?.candidates.find(row => row.provider === 'videorouter');
    assert.ok(!offer || offer.costMicros === null && offer.excluded, JSON.stringify(change));
  }
  const max = quoteComparisonRequest({ ...balancedReference, engineId: 'minimax-h3-max' });
  assert.equal(max?.candidates.some(row => row.provider === 'videorouter'), false);
});
