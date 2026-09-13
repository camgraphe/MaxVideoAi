import assert from 'node:assert/strict';
import test from 'node:test';
import { quotePublicAudioPricingSnapshot } from '../frontend/src/lib/pricing-public-quote';
import { computeCanonicalAudioBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { getVersionedPricingPolicy } from '../frontend/src/lib/pricing-policy-defaults';
import { validatePricingPolicyDocument } from '../packages/pricing/src/policy';
import type { AudioPricingInput } from '../frontend/src/lib/audio-generation';
import { quoteCanonicalAdminScenarios, quoteHistoricalCanonicalAuditScenarios } from '../frontend/server/pricing-admin/canonical-scenarios';
import { buildPricingAuditScenarios } from '../frontend/src/lib/pricing-audit/scenarios';

const cases: Array<[string, AudioPricingInput, number]> = [
  ['shortest SFX', { pack: 'sfx_only', durationSec: 3 }, 5],
  ['ten-second SFX', { pack: 'sfx_only', durationSec: 10 }, 5],
  ['longest SFX', { pack: 'sfx_only', durationSec: 30 }, 10],
  ['instrumental clip', { pack: 'music_only', durationSec: 30, musicModel: 'clip' }, 15],
  ['long instrumental', { pack: 'music_only', durationSec: 120, musicModel: 'pro' }, 25],
  ['song', { pack: 'song', durationSec: 3 }, 45],
  ['ambience', { pack: 'ambience_only', durationSec: 60 }, 60],
  ['1000 characters', { pack: 'voice_only', voiceModel: 'minimax', script: 'a'.repeat(1000), durationSec: 30 }, 30],
  ['one character', { pack: 'voice_only', voiceModel: 'minimax', script: 'a', durationSec: 3 }, 5],
  ['rounding threshold', { pack: 'voice_only', voiceModel: 'minimax', script: 'a'.repeat(500), durationSec: 20 }, 15],
  ['after threshold', { pack: 'voice_only', voiceModel: 'minimax', script: 'a'.repeat(501), durationSec: 20 }, 20],
  ['exact fractional Seed cost', { pack: 'voice_only', voiceModel: 'seed', script: 'Reference narration', durationSec: 21 }, 20],
  ['one minute Seed', { pack: 'voice_only', voiceModel: 'seed', durationSec: 60 }, 60],
  ['video sound only', { pack: 'cinematic', durationSec: 10, musicEnabled: false }, 30],
  ['combined stems round only once', { pack: 'cinematic_voice', durationSec: 10, musicEnabled: true }, 55],
];
for (const [label, input, expected] of cases) test(`Audio canonical price: ${label}`, async () => {
  const browser = quotePublicAudioPricingSnapshot(input);
  const server = await computeCanonicalAudioBillingSnapshot(input, { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [], routingRules: [] }) } });
  assert.equal(browser.totalCents, expected);
  assert.equal(server.totalCents, expected);
  assert.equal(server.margin.percentApplied, 2);
  assert.equal(server.vendorShareCents! + server.platformFeeCents!, expected);
  assert.equal(server.margin.amountCents, server.platformFeeCents);
});

test('rounding policy validates positive integer increments and preserves old profile', () => {
  const policy = getVersionedPricingPolicy();
  assert.equal(policy.compatibilityProfiles.find(profile => profile.id === 'audio-current')?.subtotalRoundingIncrementCents, undefined);
  for (const increment of [0, -1, 1.5, NaN]) {
    const candidate = structuredClone(policy);
    candidate.compatibilityProfiles.find(profile => profile.id === 'audio-tripled-rounded')!.subtotalRoundingIncrementCents = increment;
    assert.throws(() => validatePricingPolicyDocument(candidate));
  }
});

test('explicit database Audio overrides retain precedence over versioned defaults', async () => {
  const rule = getVersionedPricingPolicy().rules.find(rule => rule.engineId === 'audio-generation')!;
  const snapshot = await computeCanonicalAudioBillingSnapshot({ pack: 'song', durationSec: 3 }, { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [{ ...rule, id: 'db-audio-rule', marginPercent: 1 }], routingRules: [] }) } });
  assert.equal(snapshot.totalCents, 30);
});

test('Audio override without a profile has the same live admin and billed total while historical interpretation stays fixed', async () => {
  const rule = { id: 'db-without-profile', engineId: 'audio-generation', marginPercent: 2, marginFlatCents: 0, surchargeAudioPercent: 0.2, surchargeUpscalePercent: 0.5, currency: 'USD' };
  const scenario = buildPricingAuditScenarios().find(row => row.id === 'audio:music_only:30')!;
  const [admin] = quoteCanonicalAdminScenarios({ databaseRules: [rule], scenarios: [scenario] });
  const [historical] = quoteHistoricalCanonicalAuditScenarios({ databaseRules: [rule], scenarios: [scenario] });
  const billed = await computeCanonicalAudioBillingSnapshot({ pack: 'music_only', durationSec: 30, musicModel: 'clip' }, { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [rule], routingRules: [] }) } });
  assert.equal(admin.status, 'quoted');
  assert.equal(historical.status, 'quoted');
  if (admin.status !== 'quoted' || historical.status !== 'quoted') throw new Error('Expected canonical quotes');
  assert.equal(admin.customerTotalCents, 15);
  assert.equal(admin.customerTotalCents, billed.totalCents);
  assert.equal(admin.policyProvenance.compatibilityProfile, 'audio-tripled-rounded');
  assert.equal(historical.customerTotalCents, 12);
  assert.equal(historical.policyProvenance.compatibilityProfile, 'audio-current');
});

test('old Audio clients must refresh their price before the charge boundary', async () => {
  const { AUDIO_PRICING_POLICY_HEADER, AUDIO_PRICING_POLICY_REVISION, isCurrentAudioPricingPolicy } = await import('../frontend/src/lib/audio-pricing-policy');
  assert.equal(isCurrentAudioPricingPolicy(new Headers()), false);
  assert.equal(isCurrentAudioPricingPolicy(new Headers({ [AUDIO_PRICING_POLICY_HEADER]: 'old' })), false);
  assert.equal(isCurrentAudioPricingPolicy(new Headers({ [AUDIO_PRICING_POLICY_HEADER]: AUDIO_PRICING_POLICY_REVISION })), true);
  const { readFile } = await import('node:fs/promises');
  const route = await readFile('frontend/app/api/audio/generate/route.ts', 'utf8');
  assert.ok(route.indexOf('if (!isCurrentAudioPricingPolicy') < route.indexOf('await generateAudioRun('));
  const client = await readFile('frontend/lib/api-generation.ts', 'utf8');
  assert.match(client, /runAudioGenerate[\s\S]*\[AUDIO_PRICING_POLICY_HEADER\]: AUDIO_PRICING_POLICY_REVISION/);
});
