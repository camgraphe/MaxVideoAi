import assert from 'node:assert/strict';
import test from 'node:test';
import { selectAffectedPricingScenarios, quoteCanonicalAdminScenarios } from '../frontend/server/pricing-admin/canonical-scenarios';
import { computeCanonicalAudioBillingSnapshot, computeCanonicalBillingSnapshot, computeCanonicalStoryboardBillingSnapshot, computeCanonicalFinishingBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { getFalEngineById } from '../frontend/src/config/falEngines';

const rules = [{ id: 'default', marginPercent: 0.3, marginFlatCents: 0, currency: 'USD' },
  { id: 'audio-specific', engineId: 'audio-generation', resolution: 'audio', marginPercent: 0.5, marginFlatCents: 3, currency: 'USD' },
  { id: 'board-create', engineId: 'storyboarder', mode: 'storyboard', marginPercent: 2, marginFlatCents: 0, currency: 'USD' },
  { id: 'board-edit', engineId: 'storyboarder', mode: 'storyboard_edit', marginPercent: 1, marginFlatCents: 0, currency: 'USD' }];
const pricingPolicy = { loadOverrides: async () => ({ status: 'loaded' as const, rules }) };

const finishingRule = { id: 'toolbox-finishing', engineId: 'toolbox-finishing', marginPercent: 1.5, marginFlatCents: 0, currency: 'USD', compatibilityProfile: 'standard' };

test('finishing previews cover each released tool and priced options with the actual block budgets', async () => {
  const scenarios = selectAffectedPricingScenarios({ engineId: 'toolbox-finishing' });
  assert.deepEqual([...new Set(scenarios.map(row => row.mode))].sort(), [
    'denoise:pro', 'denoise:standard', 'fix-blur:standard', 'restore-video:pro', 'restore-video:standard', 'smooth-motion:pro', 'smooth-motion:standard',
  ]);
  const toolRules = [...rules, finishingRule];
  const outcomes = quoteCanonicalAdminScenarios({ databaseRules: toolRules, scenarios });
  // Literal costs: 10s/30fps is one 300-frame block, 10.01s crosses into two.
  for (const [mode, seconds, cents] of [
    ['restore-video:standard', 10, 18], ['restore-video:pro', 10, 180],
    ['denoise:standard', 10, 25], ['denoise:standard', 10.01, 50],
    ['denoise:pro', 10, 25], ['fix-blur:standard', 10, 25],
    ['smooth-motion:standard', 10, 75], ['smooth-motion:pro', 10, 125],
  ] as const) {
    const scenario = scenarios.find(row => row.mode === mode && row.durationSec === seconds
      && row.input.width === 1280 && row.input.fps === 30
      && (row.input.outputResolution == null || row.input.outputResolution === '1080p')
      && (row.input.targetFps == null || row.input.targetFps === 60))!;
    assert.ok(scenario, mode);
    const outcome = outcomes.find(row => row.scenarioId === scenario.id)!;
    assert.equal(outcome.status, 'quoted');
    if (outcome.status === 'quoted') assert.equal(outcome.customerTotalCents, cents, `${mode}:${seconds}`);
  }
  assert.ok(scenarios.some(row => row.input.outputResolution === '4k'));
  assert.ok(scenarios.some(row => row.input.targetFps === 120));
  assert.ok(scenarios.every(row => row.input.targetFps == null || Number(row.input.targetFps) > Number(row.input.fps)));
  const snapshot = await computeCanonicalFinishingBillingSnapshot({ toolId: 'denoise', quality: 'standard',
    vendorBudgetUsd: 0.1, durationSec: 10, profileId: 'topaz-nyx-fast', pricingSource: 'fixture' },
    { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded' as const, rules: toolRules }) } });
  assert.equal(snapshot.totalCents, 25);
  assert.equal(snapshot.meta?.ruleId, 'toolbox-finishing');
});

test('finishing preview rejects a global fallback and scopes a price change to one tool quality', async () => {
  const selector = { engineId: 'toolbox-finishing', mode: 'denoise:standard', resolution: 'video' };
  const scoped = selectAffectedPricingScenarios(selector);
  assert.ok(scoped.length > 0);
  assert.ok(scoped.every(row => row.mode === 'denoise:standard'));
  const missing = quoteCanonicalAdminScenarios({ databaseRules: rules, scenarios: scoped });
  assert.ok(missing.every(row => row.status === 'unsupported' && row.reason === 'product_policy_not_authoritative'));
  await assert.rejects(computeCanonicalFinishingBillingSnapshot({ toolId: 'denoise', quality: 'standard',
    vendorBudgetUsd: 0.1, durationSec: 10, profileId: 'topaz-nyx-fast', pricingSource: 'fixture' }, { pricingPolicy }), /TOOL_PRICING_UNAVAILABLE/);
  const all = selectAffectedPricingScenarios({ engineId: 'toolbox-finishing' });
  const before = quoteCanonicalAdminScenarios({ databaseRules: [...rules, finishingRule], scenarios: all });
  const after = quoteCanonicalAdminScenarios({ databaseRules: [...rules, finishingRule,
    { id: 'denoise-only', ...selector, marginPercent: 2, marginFlatCents: 0, currency: 'USD' }], scenarios: all });
  for (let i = 0; i < all.length; i++) {
    const old = before.find(row => row.scenarioId === all[i].id)!, updated = after.find(row => row.scenarioId === all[i].id)!;
    assert.equal(old.status, 'quoted'); assert.equal(updated.status, 'quoted');
    if (old.status === 'quoted' && updated.status === 'quoted') {
      if (all[i].mode === 'denoise:standard') assert.ok(updated.customerTotalCents > old.customerTotalCents);
      else assert.equal(updated.customerTotalCents, old.customerTotalCents);
    }
  }
});

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
