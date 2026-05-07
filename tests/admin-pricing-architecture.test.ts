import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/admin/pricing/page.tsx');
const helpersPath = join(root, 'frontend/app/(core)/admin/pricing/_lib/pricing-admin-helpers.ts');
const typesPath = join(root, 'frontend/app/(core)/admin/pricing/_lib/pricing-admin-types.ts');
const componentPaths = [
  join(root, 'frontend/app/(core)/admin/pricing/_components/BillingProductCard.tsx'),
  join(root, 'frontend/app/(core)/admin/pricing/_components/PricingRuleCard.tsx'),
  join(root, 'frontend/app/(core)/admin/pricing/_components/NewPricingRuleCard.tsx'),
  join(root, 'frontend/app/(core)/admin/pricing/_components/PricingAdminField.tsx'),
];

const pageSource = readFileSync(pagePath, 'utf8');

test('admin pricing page delegates types, helpers, and cards to route-local modules', () => {
  assert.ok(existsSync(helpersPath), 'admin pricing helpers should stay route-local');
  assert.ok(existsSync(typesPath), 'admin pricing types should stay route-local');
  for (const componentPath of componentPaths) {
    assert.ok(existsSync(componentPath), `${componentPath} should exist`);
  }

  assert.match(pageSource, /from '\.\/_lib\/pricing-admin-helpers'/, 'pricing page should import helper logic');
  assert.match(pageSource, /from '\.\/_lib\/pricing-admin-types'/, 'pricing page should import route-local types');
  assert.match(pageSource, /from '\.\/_components\/BillingProductCard'/, 'pricing page should import the tool pricing card');
  assert.match(pageSource, /from '\.\/_components\/PricingRuleCard'/, 'pricing page should import the rule card');
  assert.match(pageSource, /from '\.\/_components\/NewPricingRuleCard'/, 'pricing page should import the new rule card');
});

test('admin pricing page stays focused on route orchestration', () => {
  assert.doesNotMatch(pageSource, /type PricingRule =/, 'pricing rule contracts belong in _lib/pricing-admin-types.ts');
  assert.doesNotMatch(pageSource, /const fetcher =/, 'SWR fetcher belongs in _lib/pricing-admin-helpers.ts');
  assert.doesNotMatch(pageSource, /function buildPricingOverviewItems\(/, 'overview metrics belong in _lib/pricing-admin-helpers.ts');
  assert.doesNotMatch(pageSource, /function BillingProductCard\(/, 'tool card JSX belongs in _components/BillingProductCard.tsx');
  assert.doesNotMatch(pageSource, /function PricingRuleCard\(/, 'rule card JSX belongs in _components/PricingRuleCard.tsx');
  assert.doesNotMatch(pageSource, /function NewPricingRuleCard\(/, 'new rule JSX belongs in _components/NewPricingRuleCard.tsx');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 360, `admin pricing page should stay below 360 lines after extraction, got ${lineCount}`);
});

test('admin pricing helper and component modules expose the expected route contract', () => {
  const helpersSource = readFileSync(helpersPath, 'utf8');
  const typesSource = readFileSync(typesPath, 'utf8');
  const componentSources = componentPaths.map((componentPath) => readFileSync(componentPath, 'utf8')).join('\n');

  for (const helperName of [
    'fetcher',
    'formatCurrencyCents',
    'formatPercent',
    'buildPricingOverviewItems',
    'isLegacyProduct',
    'formatProductSubtitle',
    'convertRuleToForm',
    'convertFormToPayload',
  ]) {
    assert.match(helpersSource, new RegExp(`export (const|function) ${helperName}`), `${helperName} should be exported`);
  }

  for (const typeName of ['PricingRule', 'MembershipTier', 'BillingProduct', 'MembershipDraft', 'RuleForm']) {
    assert.match(typesSource, new RegExp(`export type ${typeName}`), `${typeName} should be exported`);
  }

  for (const componentName of ['BillingProductCard', 'PricingRuleCard', 'NewPricingRuleCard', 'PricingAdminField']) {
    assert.match(componentSources, new RegExp(`export function ${componentName}\\(`), `${componentName} should be exported`);
  }
});
