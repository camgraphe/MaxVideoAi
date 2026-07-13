import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const ruleStorePath = 'frontend/src/lib/pricing-rule-store.ts';
const contextPath = 'frontend/src/lib/pricing-context.ts';
const retiredPricingPaths = [
  'frontend/src/lib/pricing.ts',
  'frontend/src/lib/pricing-specialized-snapshots.ts',
  'frontend/src/lib/pricing-audit/legacy-collectors.ts',
] as const;

test('pricing context and settlement helpers have narrow owners outside the compatibility facade', () => {
  assert.equal(existsSync(contextPath), true, `${contextPath} should exist`);

  const runtimeConsumers = [
    'frontend/server/pricing/quote-billing.ts',
    'frontend/server/pricing/quote-public.ts',
    'frontend/src/lib/pricing-billing-facts.ts',
    'frontend/app/api/generate/_lib/billing-preflight.ts',
    'frontend/src/server/images/execute-image-generation.ts',
    'frontend/src/server/tools/angle.ts',
    'frontend/src/server/tools/upscale.ts',
    'frontend/src/server/tools/background-removal.ts',
  ];
  for (const path of runtimeConsumers) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /from ['"]@\/lib\/pricing['"]/);
  }
});

test('retired pricing compatibility and commercial snapshot layers are deleted', () => {
  assert.equal(existsSync(ruleStorePath), true);
  for (const path of retiredPricingPaths) {
    assert.equal(existsSync(path), false, `${path} should be deleted`);
  }
});

test('pricing rule store owns DB persistence and rule cache', () => {
  const ruleStoreSource = readFileSync(ruleStorePath, 'utf8');

  assert.match(ruleStoreSource, /export type RawPricingRule/);
  assert.match(ruleStoreSource, /export async function loadPricingRules/);
  assert.match(ruleStoreSource, /export async function loadPricingPolicyOverrides/);
  assert.match(ruleStoreSource, /export function selectPricingRuleForBilling/);
  assert.match(ruleStoreSource, /export function invalidatePricingRulesCache/);
  assert.match(ruleStoreSource, /export async function upsertPricingRule/);
  assert.match(ruleStoreSource, /export async function deletePricingRule/);
  assert.match(ruleStoreSource, /SELECT id, engine_id, resolution/);
  assert.match(ruleStoreSource, /INSERT INTO app_pricing_rules/);
  assert.doesNotMatch(ruleStoreSource, /computePricingSnapshot as computeKernelSnapshot/);
});

test('canonical billing facts contain provider facts but no specialized commercial snapshots', () => {
  const factsSource = readFileSync('frontend/src/lib/pricing-billing-facts.ts', 'utf8');
  const lumaConfigPath = 'frontend/src/lib/luma-ray2-pricing-config.ts';

  assert.equal(existsSync(lumaConfigPath), true, `${lumaConfigPath} should exist`);
  assert.doesNotMatch(factsSource, /pricing-specialized-snapshots/);
  assert.doesNotMatch(factsSource, /build(?:Luma|Seedance|GptImage).*Snapshot/);
  assert.match(factsSource, /calculateLumaAgentsImageReferencePrice/);
  assert.match(factsSource, /calculateLumaRay2Price/);
  assert.match(factsSource, /computeSeedance2TokenQuote/);
  assert.match(factsSource, /resolveGptImage2PricingTier/);
});

test('audio generation owns provider facts while canonical quote owners own commercial math', () => {
  const audioSource = readFileSync('frontend/src/lib/audio-generation.ts', 'utf8');
  const publicQuoteSource = readFileSync('frontend/src/lib/pricing-public-quote.ts', 'utf8');

  assert.doesNotMatch(audioSource, /AUDIO_PRICING_MARGIN_PERCENT/);
  assert.doesNotMatch(audioSource, /buildAudioPricingSnapshot/);
  assert.doesNotMatch(audioSource, /computeRoundedUpMarginCents/);
  assert.match(publicQuoteSource, /export function quotePublicAudioPricingSnapshot/);
  assert.match(publicQuoteSource, /quotePublicPricing/);
});

test('canonical quote is the sole commercial formula owner', () => {
  const canonicalSource = readFileSync('packages/pricing/src/canonical.ts', 'utf8');
  const definitionCatalogSource = readFileSync('packages/pricing/src/kernel.ts', 'utf8');
  const utilitySource = readFileSync('packages/pricing/src/utils.ts', 'utf8');
  const typesSource = readFileSync('packages/pricing/src/types.ts', 'utf8');
  const definitionSource = readFileSync('frontend/src/lib/pricing-definition.ts', 'utf8');
  const storyboardSource = readFileSync('frontend/src/lib/storyboard-pricing.ts', 'utf8');
  const serverBillingSource = readFileSync('frontend/server/pricing/quote-billing.ts', 'utf8');
  const serverPublicSource = readFileSync('frontend/server/pricing/quote-public.ts', 'utf8');
  const imageEstimateSource = readFileSync('frontend/app/api/images/estimate/route.ts', 'utf8');
  const enginesSource = readFileSync('frontend/src/lib/engines.ts', 'utf8');

  assert.match(canonicalSource, /export function quoteCanonicalPricing/);
  assert.doesNotMatch(definitionCatalogSource, /margin|discount|platformFeeCents|vendorShareCents/);
  assert.doesNotMatch(utilitySource, /computeRoundedUpMarginCents|applyRounding|toMemberTier/);
  assert.doesNotMatch(typesSource, /RoundingRule|rounding\?:/);
  assert.doesNotMatch(definitionSource, /rounding:\s*\{/);
  assert.doesNotMatch(storyboardSource, /discountAmountCents|discountAppliedToMargin|marginAmountCents/);
  assert.doesNotMatch(storyboardSource, /pricing-public-quote|quotePublicPricing/);
  assert.match(serverBillingSource, /export async function computeCanonicalStoryboardBillingSnapshot/);
  assert.match(serverPublicSource, /computeCanonicalStoryboardBillingSnapshot/);
  assert.match(imageEstimateSource, /computeCanonicalPublicStoryboardSnapshot/);
  assert.doesNotMatch(enginesSource, /export async function computePreflight/);
});
