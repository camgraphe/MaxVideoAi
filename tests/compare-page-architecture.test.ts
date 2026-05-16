import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { EN_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts';
import { buildSeoMetadata } from '../frontend/lib/seo/metadata.ts';

const routePath = 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx';
const pageSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-helpers.ts',
  'utf8'
);
const helperTextSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-text.ts',
  'utf8'
);
const helperRoutingSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-routing.ts',
  'utf8'
);
const helperEngineFormattingSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-engine-formatting.ts',
  'utf8'
);
const helperPricingSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-pricing.ts',
  'utf8'
);
const helperSpecValuesSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-values.ts',
  'utf8'
);
const helperScoreUtilsSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-score-utils.ts',
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
const overrideTypesSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-types.ts',
  'utf8'
);
const overrideEnSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts',
  'utf8'
);
const overrideFrSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts',
  'utf8'
);
const overrideEsSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts',
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

test('Seedance 2.0 vs Fast comparison owns CTR metadata without a site-name suffix', () => {
  const override = EN_COMPARE_PAGE_OVERRIDES['seedance-2-0-vs-seedance-2-0-fast'];
  const meta = override?.meta as { title?: string; description?: string; titleBranding?: string } | undefined;
  const title = 'Seedance 2.0 vs Fast: Quality, Speed, Price & Best Uses';
  const description =
    'Compare Seedance 2.0 and Fast with identical prompts, side-by-side video outputs, pricing, speed, quality tradeoffs and when to use each model.';

  assert.equal(meta?.title, title);
  assert.equal(meta?.description, description);
  assert.equal(meta?.titleBranding, 'none');
  assert.match(
    override?.heroIntro ?? '',
    /^Use Seedance 2\.0 when quality and consistency matter\. Use Seedance 2\.0 Fast when you want quicker, cheaper prompt tests and rapid iteration\./
  );
  assert.match(metadataSource, /titleBranding:\s*metaOverride\.titleBranding \?\? 'auto'/);

  const metadata = buildSeoMetadata({
    locale: 'en',
    title,
    description,
    englishPath: '/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
    titleBranding: meta?.titleBranding === 'none' ? 'none' : 'auto',
  });

  assert.equal(typeof metadata.title === 'object' ? metadata.title.absolute : metadata.title, title);
});

test('Veo 3.1 Lite vs Fast comparison owns tier CTR metadata without a site-name suffix', () => {
  const override = EN_COMPARE_PAGE_OVERRIDES['veo-3-1-fast-vs-veo-3-1-lite'];
  const meta = override?.meta as { title?: string; description?: string; titleBranding?: string } | undefined;
  const title = 'Veo 3.1 Lite vs Fast: Price, Quality & Best Uses';
  const description =
    'Compare Veo 3.1 Lite and Fast by pricing, output quality, audio control, workflow flexibility and when each tier is worth using.';

  assert.equal(meta?.title, title);
  assert.equal(meta?.description, description);
  assert.equal(meta?.titleBranding, 'none');
  assert.match(
    override?.heroIntro ?? '',
    /^Choose Veo 3\.1 Lite for lower-cost tests\. Choose Veo 3\.1 Fast when quality, audio control and workflow flexibility matter more\./
  );

  const metadata = buildSeoMetadata({
    locale: 'en',
    title,
    description,
    englishPath: '/ai-video-engines/veo-3-1-fast-vs-veo-3-1-lite',
    titleBranding: meta?.titleBranding === 'none' ? 'none' : 'auto',
  });

  assert.equal(typeof metadata.title === 'object' ? metadata.title.absolute : metadata.title, title);
});

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

test('comparison detail helper facade delegates routing, pricing, specs, and localized overrides', () => {
  const helperLineCount = helperSource.split('\n').length;

  assert.ok(helperLineCount <= 80, `compare-page-helpers.ts should stay a facade below 80 lines, got ${helperLineCount}`);
  assert.match(helperSource, /from '\.\/compare-page-data-loaders'/);
  assert.match(helperSource, /from '\.\/compare-page-localization'/);
  assert.match(helperSource, /from '\.\/compare-page-routing'/);
  assert.match(helperSource, /from '\.\/compare-page-pricing'/);
  assert.match(helperSource, /from '\.\/compare-page-spec-values'/);
  assert.match(helperSource, /from '\.\/compare-page-score-utils'/);
  assert.match(helperSource, /from '\.\/compare-page-engine-formatting'/);
  assert.match(helperSource, /from '\.\/compare-page-text'/);
  assert.match(helperRoutingSource, /export function getCanonicalCompareSlug/);
  assert.match(helperRoutingSource, /export function resolveExcludedCompareRedirect/);
  assert.match(helperPricingSource, /export async function resolvePricingDisplay/);
  assert.match(helperPricingSource, /export function computePricingScore/);
  assert.match(helperSpecValuesSource, /export function buildSpecValues/);
  assert.match(helperSpecValuesSource, /export function localizeSpecDetailValue/);
  assert.match(helperEngineFormattingSource, /export function formatEngineName/);
  assert.match(helperEngineFormattingSource, /export function formatSpeedChip/);
  assert.match(helperEngineFormattingSource, /export type EngineAccent/);
  assert.match(helperScoreUtilsSource, /export function computePairScores/);
  assert.match(helperScoreUtilsSource, /export function pickFirstCapabilityDifference/);
  assert.match(helperTextSource, /export function formatTemplate/);
  assert.match(helperTextSource, /export function stripAudioReferencesForSilentPair/);
  assert.ok(overrideSource.split('\n').length <= 40, 'compare-page-overrides.ts should stay a small facade');
  assert.match(overrideSource, /export function getComparePageOverride/);
  assert.match(overrideSource, /from '\.\/compare-page-overrides-en'/);
  assert.match(overrideSource, /from '\.\/compare-page-overrides-fr'/);
  assert.match(overrideSource, /from '\.\/compare-page-overrides-es'/);
  assert.match(overrideTypesSource, /export type ComparePageOverride/);
  assert.match(overrideEnSource, /export const EN_COMPARE_PAGE_OVERRIDES/);
  assert.match(overrideFrSource, /export const FR_COMPARE_PAGE_OVERRIDES/);
  assert.match(overrideEsSource, /export const ES_COMPARE_PAGE_OVERRIDES/);
  assert.doesNotMatch(helperSource, /const LOCALIZED_BEST_FOR/);
  assert.doesNotMatch(helperSource, /export async function loadEngineScores/);
  assert.doesNotMatch(helperSource, /computeMarketingPriceRange/);
  assert.doesNotMatch(helperSource, /canonicalizeFalModelSlug/);
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
