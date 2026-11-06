import assert from 'node:assert/strict';
import test from 'node:test';
import { getVersionedPricingPolicy } from '../frontend/src/lib/pricing-policy-defaults';
import { validateOverrides } from '../frontend/server/pricing-admin/policy-rules';
import { quoteCanonicalAdminScenarios, selectAffectedPricingScenarios } from '../frontend/server/pricing-admin/canonical-scenarios';
import { createPricingPolicyDraft, buildPricingPolicyProposal, type PricingPolicyInventoryRow } from '../frontend/app/(core)/admin/pricing/_lib/pricing-cockpit-view-model';
import { buildLiveProductPolicyFacts } from '../frontend/server/pricing-admin/product-policy-scenarios';
import { buildRecastPublicPricingFacts } from '../frontend/server/character-studio/recast-public-price';

const selector = { engineId: 'character-recast', mode: 'recast', resolution: 'video' };
const rule = { id: 'recast-only', ...selector, marginPercent: 1, marginFlatCents: 0,
  surchargeAudioPercent: 0, surchargeUpscalePercent: 0, currency: 'USD', compatibilityProfile: 'standard' };

test('Recast scenarios cover bounded output and fractional source facts without changing Wan selectors', () => {
  const scenarios = selectAffectedPricingScenarios(selector);
  assert.ok(scenarios.length >= 18);
  assert.deepEqual(new Set(scenarios.map(s => s.input.outputResolution)), new Set(['480p', '720p', '1080p']));
  assert.ok(scenarios.some(s => s.input.inputVideoDurationSec === 3.25));
  assert.ok(scenarios.some(s => s.input.hasVideoInput === false));
  assert.ok(scenarios.some(s => s.durationSec === 2));
  assert.ok(scenarios.some(s => s.durationSec === 30));
  assert.ok(scenarios.every(s => s.engineId === 'character-recast'));
});

test('Recast admin quotes reject global fallback and apply the multiplier only to supplier facts', () => {
  const scenarios = selectAffectedPricingScenarios(selector);
  assert.ok(scenarios.length);
  const missing = quoteCanonicalAdminScenarios({ databaseRules: [], scenarios });
  assert.ok(missing.every(s => s.status === 'unsupported' && s.reason === 'product_policy_not_authoritative'));
  const quoted = quoteCanonicalAdminScenarios({ databaseRules: [rule], scenarios });
  assert.ok(quoted.every(s => s.status === 'quoted'));
  const sample = quoted.find(s => s.scenarioId === 'admin-recast:720p:5:3.25');
  assert.ok(sample && sample.status === 'quoted');
  // Prime 720p: (5 output + 3.25 source) × 14 cents = 115.5 exact supplier cents.
  assert.equal(sample.vendorSubtotalCents, 116);
  assert.equal(sample.customerTotalCents, 232);
  assert.equal(sample.policyProvenance.sourceRuleId, 'recast-only');
});

test('every authored Recast admin scenario preserves the public resolver supplier facts', () => {
  for (const scenario of selectAffectedPricingScenarios(selector)) {
    const publicFacts = buildRecastPublicPricingFacts({ modelId: 'wan-3-prime', mode: 'ref2v',
      durationSec: scenario.durationSec!, resolution: String(scenario.input.outputResolution),
      hasVideoInput: scenario.input.hasVideoInput === true,
      ...(scenario.input.hasVideoInput ? { inputVideoDurationSec: Number(scenario.input.inputVideoDurationSec) } : {}),
      aspectRatio: '16:9' });
    assert.ok(publicFacts, scenario.id);
    const adminFacts = buildLiveProductPolicyFacts(scenario);
    assert.ok(adminFacts, scenario.id);
    assert.equal(adminFacts.engineId, scenario.engineId);
    for (const field of ['currency', 'vendorSubtotalExactCents', 'unit', 'quantity'] as const) {
      assert.equal(adminFacts[field], publicFacts.facts[field], `${scenario.id}.${field}`);
    }
  }
});

test('Recast rules require the exact scope, standard USD cost multiplier, and no extras', () => {
  const policy = getVersionedPricingPolicy();
  assert.equal(validateOverrides([rule], policy)[0].marginPercent, 1);
  for (const invalid of [
    { mode: undefined }, { resolution: undefined }, { mode: 'ref2v' }, { resolution: '720p' },
    { marginPercent: 9.01 }, { marginPercent: -0.1 }, { marginFlatCents: 1 },
    { surchargeAudioPercent: 0.1 }, { surchargeUpscalePercent: 0.1 },
    { compatibilityProfile: 'audio-current' }, { currency: 'EUR' }, { arbitrary: 2 },
  ]) assert.throws(() => validateOverrides([{ ...rule, ...invalid }], policy));
});

test('an unavailable Recast product opens a scoped ×2 draft without inheriting the global rule', () => {
  const row: PricingPolicyInventoryRow = { selector, versionedRule: null, databaseOverride: null,
    effectiveProvenance: null, representativeQuotes: [], routingContext: null, lastEvent: null };
  const draft = createPricingPolicyDraft(row, true);
  assert.equal(draft.marginPercent, '100');
  assert.equal(draft.surchargeAudioPercent, '0');
  assert.equal(draft.surchargeUpscalePercent, '0');
  const proposal = buildPricingPolicyProposal(row, draft);
  assert.equal(proposal.operation, 'create');
  if (proposal.operation === 'create') assert.deepEqual(proposal.rule, { ...rule, id: 'admin-character-recast-recast-video' });
});
