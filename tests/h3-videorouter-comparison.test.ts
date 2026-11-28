import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteComparisonRequest, type ComparisonRequest } from '../frontend/app/(core)/admin/routing/_lib/comparison-offers';
import { buildHistoricalReplay } from '../frontend/app/(core)/admin/routing/_lib/historical-replay';
import { rankQuotedOffers } from '../frontend/src/lib/video-purchase-decision';
import { planVideoPurchase } from '../frontend/src/server/video-providers/purchase-router';

const balancedReference: ComparisonRequest = {
  engineId: 'minimax-h3', mode: 'ref2v', images: 2, durationSec: 15, resolution: '480p', aspectRatio: '21:9',
  hasStartFrame: false, hasEndFrame: false, hasVideo: false, inputVideoSeconds: 0, hasAudioReference: false,
  hasDocument: false, hasUnpricedOptions: false, audioEnabled: true, h3PromptExpansion: 'balanced',
  hasSeed: false, requestedRatioVerified: true,
};

test('H3 WaveSpeed standard-fee price is visible but unverified balanced expansion keeps Fal as the only choice', () => {
  const quote = quoteComparisonRequest(balancedReference)!;
  const offer = quote.candidates.find(row => row.provider === 'videorouter_wavespeed');
  assert.ok(offer);
  assert.equal(offer.simulationOnly, true);
  assert.equal(offer.costMicros, 615_000);
  assert.match(offer.excluded ?? '', /balanced expansion unverified/i);
  assert.match(offer.excluded ?? '', /\$0\.6075 at 1\.25%/);
  assert.equal(quote.baselineMicros, 750_000);
  assert.deepEqual(rankQuotedOffers(quote.candidates, { ceilingMicros: 750_000 }).order, ['fal']);
  assert.deepEqual(planVideoPurchase(balancedReference)?.order, ['fal']);

  const replay = buildHistoricalReplay([{
    engineId: balancedReference.engineId, request: balancedReference, jobs: 1,
    status: 'completed', paidWallet: true, historicalProvider: 'fal', ceilingMicros: 750_000,
  }]);
  assert.equal(replay.totals.comparableJobs, 1);
  assert.equal(replay.totals.allMicros, 750_000);
  assert.equal(replay.totals.additionalSavingsMicros, 0);
});

test('H3 WaveSpeed quote stays within the observed options, media roles and edition', () => {
  const outside: Partial<ComparisonRequest>[] = [
    { mode: 'i2v', hasStartFrame: true }, { hasEndFrame: true }, { mode: 't2v', images: 0 }, { images: 1 },
    { durationSec: 14 }, { aspectRatio: null }, { aspectRatio: '16:9' }, { resolution: '768p' },
    { h3PromptExpansion: 'disabled' }, { h3PromptExpansion: 'quality' }, { h3PromptExpansion: 'fast' },
    { h3PromptExpansion: undefined }, { hasSeed: true }, { audioEnabled: false }, { hasVideo: true },
    { hasDocument: true }, { hasAudioReference: true }, { requiresDirectControls: true }, { hasUnpricedOptions: true },
    { referenceVideoSeconds: [5] }, { inputVideoSeconds: 5 }, { promptExpansionEnabled: false },
  ];
  for (const change of outside) {
    const quote = quoteComparisonRequest({ ...balancedReference, ...change });
    const offer = quote?.candidates.find(row => row.provider === 'videorouter_wavespeed');
    assert.equal(offer?.costMicros, null, JSON.stringify(change));
    assert.ok(offer?.excluded);
  }
  const max = quoteComparisonRequest({ ...balancedReference, engineId: 'minimax-h3-max' });
  assert.equal(max?.candidates.some(row => row.provider === 'videorouter_wavespeed'), false);
});
