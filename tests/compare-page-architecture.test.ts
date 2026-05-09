import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routePath = 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx';
const pageSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-helpers.ts',
  'utf8'
);
const loaderSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-data-loaders.ts',
  'utf8'
);
const localizationSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-localization.ts',
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
const relatedLinksSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-related-links.ts',
  'utf8'
);
const routeDataSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-route-data.ts',
  'utf8'
);
const schemaSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-schema.ts',
  'utf8'
);
const showdownsSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-showdowns.ts',
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
const detailHeroSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareDetailHero.tsx',
  'utf8'
);
const engineHeroCardsSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareEngineHeroCards.tsx',
  'utf8'
);
const scorecardSectionSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareScorecardSection.tsx',
  'utf8'
);
const specsSectionSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareSpecsSection.tsx',
  'utf8'
);
const showdownSectionSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareShowdownSection.tsx',
  'utf8'
);
const relatedSectionSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareRelatedSection.tsx',
  'utf8'
);
const faqSectionSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareFaqSection.tsx',
  'utf8'
);
const generateCardSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareGenerateCard.tsx',
  'utf8'
);

test('comparison detail page delegates copy, data, schema, and media responsibilities', () => {
  const lineCount = pageSource.split('\n').length;

  assert.ok(lineCount <= 300, `comparison page should stay under 300 lines after orchestration extraction, got ${lineCount}`);
  assert.ok(pageSource.includes("from './_lib/compare-page-helpers'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-overrides'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-faq'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-metadata'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-related-links'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-route-data'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-schema'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-scorecard'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-spec-rows'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-showdowns'"));
  assert.ok(pageSource.includes("from './_components/CompareDetailContent'"));
  assert.doesNotMatch(pageSource, /const COMPARE_PAGE_OVERRIDES/);
  assert.doesNotMatch(pageSource, /type ComparePageCopy =/);
  assert.doesNotMatch(pageSource, /const generatedFaqItems =/);
  assert.doesNotMatch(pageSource, /const comparisonMetrics = \[/);
  assert.doesNotMatch(pageSource, /<section className=/);
  assert.doesNotMatch(pageSource, /buildSeoMetadata/);
  assert.doesNotMatch(pageSource, /getPublicVideosByIds/);
  assert.doesNotMatch(pageSource, /getLatestPublicVideoByPromptAndEngine/);
  assert.doesNotMatch(pageSource, /SHOWDOWN_OVERRIDES/);
  assert.doesNotMatch(pageSource, /RELATED_COMPARISONS/);
  assert.doesNotMatch(pageSource, /fetchEngineAverageDurations/);
  assert.doesNotMatch(pageSource, /loadEngineScores/);
  assert.doesNotMatch(pageSource, /BreadcrumbList/);
  assert.doesNotMatch(pageSource, /'@type': 'WebPage'/);
});

test('comparison detail helpers own routing, pricing, specs, and localized overrides', () => {
  const helperLineCount = helperSource.split('\n').length;

  assert.ok(helperLineCount <= 760, `compare-page-helpers.ts should stay below 760 lines after helper extraction, got ${helperLineCount}`);
  assert.match(helperSource, /export function getCanonicalCompareSlug/);
  assert.match(helperSource, /from '\.\/compare-page-data-loaders'/);
  assert.match(helperSource, /from '\.\/compare-page-localization'/);
  assert.match(helperSource, /export async function resolvePricingDisplay/);
  assert.match(helperSource, /export function buildSpecValues/);
  assert.match(overrideSource, /export function getComparePageOverride/);
  assert.doesNotMatch(helperSource, /const LOCALIZED_BEST_FOR/);
  assert.doesNotMatch(helperSource, /export async function loadEngineScores/);
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
  assert.match(copySource, /export function buildCompareDetailPageText/);
  assert.match(relatedLinksSource, /export function buildRelatedComparisonLinks/);
  assert.match(routeDataSource, /export async function buildCompareRouteData/);
  assert.match(schemaSource, /export function buildCompareBreadcrumbJsonLd/);
  assert.match(schemaSource, /export function buildCompareWebPageJsonLd/);
  assert.match(showdownsSource, /export async function buildCompareShowdownSlots/);
  assert.match(showdownsSource, /getPublicVideosByIds/);
  assert.match(showdownsSource, /getLatestPublicVideoByPromptAndEngine/);
  assert.match(specRowsSource, /export function buildCompareSpecRows/);
  assert.match(detailContentSource, /export function CompareDetailContent/);
  assert.match(generateCardSource, /export function CompareGenerateCard/);
  assert.match(detailContentSource, /CompareDetailHero/);
  assert.match(detailContentSource, /CompareEngineHeroCards/);
  assert.match(detailContentSource, /CompareScorecardSection/);
  assert.match(detailContentSource, /CompareSpecsSection/);
  assert.match(detailContentSource, /CompareShowdownSection/);
  assert.match(detailContentSource, /CompareFaqSection/);
  assert.match(detailHeroSource, /export function CompareDetailHero/);
  assert.match(engineHeroCardsSource, /export function CompareEngineHeroCards/);
  assert.match(scorecardSectionSource, /export function CompareScorecardSection/);
  assert.match(specsSectionSource, /export function CompareSpecsSection/);
  assert.match(showdownSectionSource, /export function CompareShowdownSection/);
  assert.match(relatedSectionSource, /export function CompareRelatedSection/);
  assert.match(faqSectionSource, /export function CompareFaqSection/);
  assert.match(showdownSectionSource, /CompareShowdownMedia/);
  assert.match(specsSectionSource, /CompareSpecValue/);
  assert.match(faqSectionSource, /dangerouslySetInnerHTML/);
});

test('comparison detail data and localization helpers expose focused contracts', () => {
  assert.match(loaderSource, /export async function loadEngineScores/);
  assert.match(loaderSource, /export async function loadEngineKeySpecs/);
  assert.match(loaderSource, /export async function hydrateShowdowns/);
  assert.match(localizationSource, /const LOCALIZED_BEST_FOR/);
  assert.match(localizationSource, /export const LOCALIZED_SHOWDOWN_TITLES/);
  assert.match(localizationSource, /export const LOCALIZED_SHOWDOWN_TESTS/);
  assert.match(localizationSource, /export function localizeMappedValue/);
  assert.match(localizationSource, /export function localizeBestFor/);
});

test('comparison detail content stays a visual orchestrator', () => {
  const lineCount = detailContentSource.split('\n').length;

  assert.ok(lineCount <= 230, `CompareDetailContent should stay below 230 lines after section extraction, got ${lineCount}`);
  assert.doesNotMatch(detailContentSource, /showdownSlots\.map/);
  assert.doesNotMatch(detailContentSource, /specRows\.map/);
  assert.doesNotMatch(detailContentSource, /faqItems\.map/);
  assert.doesNotMatch(detailContentSource, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(detailContentSource, /DeferredSourcePrompt/);
  assert.doesNotMatch(detailContentSource, /CopyPromptButton/);
});
