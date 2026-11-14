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
  assert.equal(normal.totalCents, 3); assert.equal(keyterms.totalCents, 4);
  assert.equal((await quoteSubtitleTranscription({ durationSec: 240 }, policy)).totalCents, 10);
  assert.equal((await quoteSubtitleTranscription({ durationSec: 240, keyterms: ['MaxVideoAI'] }, policy)).totalCents, 13);
  assert.equal(normal.margin.percentApplied, 2);
  assert.equal(normal.meta?.creatorPricingPolicy, 'creator-subtitles:provider-plus-200:v1');
  assert.equal(normal.meta?.providerCostMultiplier, 3);
  assert.equal(normal.meta?.providerCostKind, 'list-reference');
  assert.equal(normal.meta?.providerCostListUsd, 0.008);
  assert.equal(keyterms.meta?.keytermsSurchargePercent, 30);
  assert.equal((await quoteSubtitleTranscription({ durationSec: 7.412 }, policy)).base.seconds, 7.412);
});
test('subtitle billing refuses missing explicit policy or invalid measured duration', async () => {
  await assert.rejects(quoteSubtitleTranscription({ durationSec: 60 }, { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) } }), /TOOL_PRICING_UNAVAILABLE/);
  for (const durationSec of [0, -1, NaN, Infinity, 1800.01]) await assert.rejects(quoteSubtitleTranscription({ durationSec }, policy), /DURATION_INVALID/);
});

test('subtitle examples use exact provider list facts, 200% markup and unchanged fractional-cent rounding', async t => {
  const examples = [
    { seconds: 10, providerUsd: 0.0013333333333333333, cents: 1, keytermsCents: 1 },
    { seconds: 30, providerUsd: 0.004, cents: 1, keytermsCents: 3 },
    { seconds: 60, providerUsd: 0.008, cents: 3, keytermsCents: 4 },
    { seconds: 240, providerUsd: 0.032, cents: 10, keytermsCents: 13 },
    { seconds: 600, providerUsd: 0.08, cents: 24, keytermsCents: 31 },
    { seconds: 1800, providerUsd: 0.24, cents: 72, keytermsCents: 94 },
  ];
  for (const example of examples) {
    const normal = await quoteSubtitleTranscription({ durationSec: example.seconds }, policy);
    const keyterms = await quoteSubtitleTranscription({ durationSec: example.seconds, keyterms: ['MaxVideoAI'] }, policy);
    assert.equal(normal.totalCents, example.cents, `normal ${example.seconds}s`);
    assert.equal(keyterms.totalCents, example.keytermsCents, `keyterms ${example.seconds}s`);
    assert.ok(Math.abs(Number(normal.meta?.providerCostListUsd) - example.providerUsd) < 1e-12);
    assert.ok(Math.abs(Number(keyterms.meta?.providerCostListUsd) - example.providerUsd * 1.3) < 1e-12);
    assert.equal(normal.meta?.keytermsSurchargePercent, 0);
    assert.equal(keyterms.meta?.keytermsSurchargePercent, 30);
    t.diagnostic(`${example.seconds}s: LIST $${normal.meta?.providerCostListUsd}, customer $${(normal.totalCents / 100).toFixed(2)}; keyterms LIST $${keyterms.meta?.providerCostListUsd}, customer $${(keyterms.totalCents / 100).toFixed(2)}`);
  }
});
