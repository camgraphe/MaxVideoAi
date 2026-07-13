import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pricingPath = 'frontend/src/lib/pricing.ts';
const ruleStorePath = 'frontend/src/lib/pricing-rule-store.ts';
const snapshotsPath = 'frontend/src/lib/pricing-specialized-snapshots.ts';
const contextPath = 'frontend/src/lib/pricing-context.ts';

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

test('pricing module stays a public orchestration facade', () => {
  assert.equal(existsSync(pricingPath), true);
  assert.equal(existsSync(ruleStorePath), true);
  assert.equal(existsSync(snapshotsPath), true);

  const pricingSource = readFileSync(pricingPath, 'utf8');
  const pricingLines = pricingSource.split('\n').length;

  assert.ok(pricingLines < 360, `expected pricing.ts to stay under 360 lines, got ${pricingLines}`);
  assert.match(pricingSource, /export async function computePricingSnapshot/);
  assert.match(pricingSource, /from '@maxvideoai\/pricing'/);
  assert.match(pricingSource, /from '@\/lib\/pricing-rule-store'/);
  assert.match(pricingSource, /from '@\/lib\/pricing-specialized-snapshots'/);
  assert.match(pricingSource, /export type \{ RawPricingRule, PricingRule, UpsertPricingRuleInput \}/);
  assert.match(pricingSource, /export \{\s*deletePricingRule,/);
  assert.doesNotMatch(pricingSource, /SELECT id, engine_id, resolution/);
  assert.doesNotMatch(pricingSource, /function buildLumaRay2Snapshot/);
  assert.doesNotMatch(pricingSource, /function buildGptImage2Snapshot/);
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

test('specialized pricing snapshots own provider-specific quote builders', () => {
  const snapshotsSource = readFileSync(snapshotsPath, 'utf8');

  assert.match(snapshotsSource, /export function buildLumaRay2Snapshot/);
  assert.match(snapshotsSource, /export function buildLumaRay2EditSnapshot/);
  assert.match(snapshotsSource, /export function buildSeedance2Snapshot/);
  assert.match(snapshotsSource, /export function buildGptImage2Snapshot/);
  assert.match(snapshotsSource, /export function buildDefinitionFromEngine/);
  assert.match(snapshotsSource, /calculateLumaRay2Price/);
  assert.match(snapshotsSource, /computeSeedance2TokenQuote/);
  assert.match(snapshotsSource, /resolveGptImage2PricingTier/);
  assert.doesNotMatch(snapshotsSource, /INSERT INTO app_pricing_rules/);
});
