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
const faqSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-faq.ts',
  'utf8'
);
const metadataSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-metadata.ts',
  'utf8'
);
const scorecardSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-scorecard.ts',
  'utf8'
);
const copySource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-copy.ts',
  'utf8'
);
const specRowsSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-rows.ts',
  'utf8'
);
const detailContentSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareDetailContent.tsx',
  'utf8'
);
const generateCardSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareGenerateCard.tsx',
  'utf8'
);

test('comparison detail page delegates copy, helper, and media responsibilities', () => {
  const lineCount = pageSource.split('\n').length;

  assert.ok(lineCount <= 500, `comparison page should stay under 500 lines after section extraction, got ${lineCount}`);
  assert.ok(pageSource.includes("from './_lib/compare-page-helpers'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-overrides'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-faq'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-metadata'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-scorecard'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-spec-rows'"));
  assert.ok(pageSource.includes("from './_components/CompareDetailContent'"));
  assert.doesNotMatch(pageSource, /const COMPARE_PAGE_OVERRIDES/);
  assert.doesNotMatch(pageSource, /type ComparePageCopy =/);
  assert.doesNotMatch(pageSource, /const generatedFaqItems =/);
  assert.doesNotMatch(pageSource, /const comparisonMetrics = \[/);
  assert.doesNotMatch(pageSource, /<section className=/);
  assert.doesNotMatch(pageSource, /buildSeoMetadata/);
});

test('comparison detail helpers own routing, pricing, specs, and localized overrides', () => {
  assert.match(helperSource, /export function getCanonicalCompareSlug/);
  assert.match(helperSource, /export async function loadEngineScores/);
  assert.match(helperSource, /export async function resolvePricingDisplay/);
  assert.match(helperSource, /export function buildSpecValues/);
  assert.match(overrideSource, /export function getComparePageOverride/);
});

test('comparison detail split helpers own FAQ, scorecard, and generate card responsibilities', () => {
  assert.match(faqSource, /export function buildCompareFaqItems/);
  assert.match(faqSource, /export function buildCompareFaqJsonLd/);
  assert.match(scorecardSource, /export function buildComparisonMetrics/);
  assert.match(scorecardSource, /export function buildCompareSummaryRows/);
  assert.match(scorecardSource, /export function deriveCompareStrengths/);
  assert.match(metadataSource, /export async function buildComparePageMetadata/);
  assert.match(metadataSource, /buildSeoMetadata/);
  assert.match(copySource, /export function buildCompareDetailLabels/);
  assert.match(specRowsSource, /export function buildCompareSpecRows/);
  assert.match(detailContentSource, /export function CompareDetailContent/);
  assert.match(generateCardSource, /export function CompareGenerateCard/);
  assert.match(detailContentSource, /CompareShowdownMedia/);
  assert.match(detailContentSource, /CompareSpecValue/);
});
