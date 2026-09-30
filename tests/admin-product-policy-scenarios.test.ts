import assert from 'node:assert/strict';
import test from 'node:test';
import { selectAffectedPricingScenarios, quoteCanonicalAdminScenarios } from '../frontend/server/pricing-admin/canonical-scenarios';
import { computeCanonicalAudioBillingSnapshot, computeCanonicalBillingSnapshot, computeCanonicalStoryboardBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { getFalEngineById } from '../frontend/src/config/falEngines';

const rules = [{ id: 'default', marginPercent: 0.3, marginFlatCents: 0, currency: 'USD' },
  { id: 'audio-specific', engineId: 'audio-generation', resolution: 'audio', marginPercent: 0.5, marginFlatCents: 3, currency: 'USD' },
  { id: 'board-create', engineId: 'storyboarder', mode: 'storyboard', marginPercent: 2, marginFlatCents: 0, currency: 'USD' },
  { id: 'board-edit', engineId: 'storyboarder', mode: 'storyboard_edit', marginPercent: 1, marginFlatCents: 0, currency: 'USD' }];
const pricingPolicy = { loadOverrides: async () => ({ status: 'loaded' as const, rules }) };

test('active audio policy previews cover all packs and reuse the billed factual inputs', async () => {
  const scenarios = selectAffectedPricingScenarios({ engineId: 'audio-generation' });
  assert.ok(scenarios.some((row) => row.mode === 'sfx_only'));
  assert.ok(scenarios.some((row) => row.mode === 'song'));
  assert.ok(scenarios.some((row) => row.mode === 'ambience_only'));
  assert.ok(scenarios.some((row) => row.input.musicModel === 'pro'));
  const outcomes = quoteCanonicalAdminScenarios({ databaseRules: rules, scenarios });
  for (const scenario of scenarios) {
    if (String(scenario.mode).startsWith('cinematic')) assert.ok(scenario.durationSec! <= 10);
    const pricing = await computeCanonicalAudioBillingSnapshot({ ...scenario.input, pack: scenario.mode,
      durationSec: scenario.durationSec } as never, { pricingPolicy });
    const outcome = outcomes.find((row) => row.scenarioId === scenario.id)!;
    assert.equal(outcome.status, 'quoted');
    if (outcome.status === 'quoted') assert.equal(outcome.customerTotalCents, pricing.totalCents, scenario.id);
  }
});

test('Storyboard policy previews cover generation/edit tiers and match the canonical billed quote', async () => {
  const scenarios = selectAffectedPricingScenarios({ engineId: 'storyboarder' });
  assert.equal(scenarios.length, 6);
  const outcomes = quoteCanonicalAdminScenarios({ databaseRules: rules, scenarios });
  for (const scenario of scenarios) {
    const tier = scenario.resolution!;
    const base = await computeCanonicalBillingSnapshot({ engine: getFalEngineById('gpt-image-2')!.engine,
      durationSec: 1, mode: scenario.mode === 'storyboard_edit' ? 'i2i' : 't2i',
      resolution: tier === 'hd' ? '1920x1080' : '3840x2160', quality: tier === 'ultra' ? 'high' : 'medium',
      referenceImageCount: scenario.mode === 'storyboard_edit' ? 1 : 0 }, { pricingPolicy });
    const pricing = await computeCanonicalStoryboardBillingSnapshot({ snapshot: base, operation: scenario.mode, tier } as never, { pricingPolicy });
    const outcome = outcomes.find((row) => row.scenarioId === scenario.id)!;
    assert.equal(outcome.status, 'quoted');
    if (outcome.status === 'quoted') assert.equal(outcome.customerTotalCents, pricing.totalCents, scenario.id);
  }
});
