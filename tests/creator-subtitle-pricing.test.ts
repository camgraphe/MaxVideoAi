import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteSubtitleTranscription } from '../frontend/src/server/tools/creator-subtitle-pricing';

const policy = { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded' as const, rules: [{
  id: 'toolbox-subtitles', engineId: 'toolbox-subtitles', marginPercent: 1.5, marginFlatCents: 0,
  surchargeAudioPercent: 0, surchargeUpscalePercent: 0, currency: 'USD', compatibilityProfile: 'standard',
}] }) } };
test('subtitle list cost and keyterms surcharge pass through canonical customer rounding', async () => {
  const normal = await quoteSubtitleTranscription({ durationSec: 60 }, policy);
  const keyterms = await quoteSubtitleTranscription({ durationSec: 60, keyterms: ['MaxVideoAI'] }, policy);
  // Standard policy rounds the margin up before rounding the customer total.
  assert.equal(normal.totalCents, 2); assert.equal(keyterms.totalCents, 3);
  assert.equal((await quoteSubtitleTranscription({ durationSec: 240 }, policy)).totalCents, 7);
  assert.equal((await quoteSubtitleTranscription({ durationSec: 240, keyterms: ['MaxVideoAI'] }, policy)).totalCents, 9);
  assert.equal(normal.margin.percentApplied, 1.2);
  assert.equal(normal.meta?.providerCostKind, 'list-reference');
  assert.equal(normal.meta?.providerCostListUsd, 0.008);
  assert.equal(keyterms.meta?.keytermsSurchargePercent, 30);
  assert.equal((await quoteSubtitleTranscription({ durationSec: 7.412 }, policy)).base.seconds, 7.412);
});
test('subtitle billing refuses missing explicit policy or invalid measured duration', async () => {
  await assert.rejects(quoteSubtitleTranscription({ durationSec: 60 }, { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) } }), /TOOL_PRICING_UNAVAILABLE/);
  for (const durationSec of [0, -1, NaN, Infinity, 1800.01]) await assert.rejects(quoteSubtitleTranscription({ durationSec }, policy), /DURATION_INVALID/);
});
