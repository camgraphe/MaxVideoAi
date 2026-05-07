import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routePath = 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx';
const pageSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-helpers.ts',
  'utf8'
);
const overrideSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts',
  'utf8'
);

test('comparison detail page delegates copy, helper, and media responsibilities', () => {
  const lineCount = pageSource.split('\n').length;

  assert.ok(lineCount < 1900, `comparison page should stay under 1900 lines after split, got ${lineCount}`);
  assert.ok(pageSource.includes("from './_lib/compare-page-helpers'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-overrides'"));
  assert.ok(pageSource.includes("from './_components/CompareShowdownMedia'"));
  assert.ok(pageSource.includes("from './_components/CompareSpecValue'"));
  assert.doesNotMatch(pageSource, /const COMPARE_PAGE_OVERRIDES/);
  assert.doesNotMatch(pageSource, /type ComparePageCopy =/);
});

test('comparison detail helpers own routing, pricing, specs, and localized overrides', () => {
  assert.match(helperSource, /export function getCanonicalCompareSlug/);
  assert.match(helperSource, /export async function loadEngineScores/);
  assert.match(helperSource, /export async function resolvePricingDisplay/);
  assert.match(helperSource, /export function buildSpecValues/);
  assert.match(overrideSource, /export function getComparePageOverride/);
});
