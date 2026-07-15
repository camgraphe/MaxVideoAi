import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const modelPagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx');
const layoutPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx');
const specsSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelSpecsSection.tsx');
const prepLinksPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prep-links.ts');
const schemaPayloadsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema-payloads.ts');
const schemaBuilderPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts');
const prepLinksSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPrepLinksSection.tsx');
const pricingCalloutsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing-callouts.ts');
const pricingCalloutSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPricingCallout.tsx');
const decisionDataPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts');
const decisionPricingPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts');
const oldTemplateCopyPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy.ts');
const oldAdditionalCopyPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy-additional.ts');
const decisionContentPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content.ts');
const modelPageMediaPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media.ts');
const decisionHeroSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionHeroSection.tsx');
const decisionMediaCardPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionMediaCard.tsx');
const decisionPricingCardPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPricingCard.tsx');
const pageContentSectionsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPageContentSections.tsx');
const decisionCardsSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionCardsSection.tsx');
const decisionPromptingSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptingSection.tsx');
const decisionDemoMediaPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionDemoMedia.client.tsx');
const decisionPromptTabsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptTabs.client.tsx');
const decisionCopyButtonPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionCopyButton.client.tsx');
const decisionTipsSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionTipsSection.tsx');
const decisionCompareSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionCompareSection.tsx');
const decisionSafetyFaqSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionSafetyFaqSection.tsx');

const readSource = (path: string) => readFileSync(path, 'utf8');
const lineCount = (source: string) => source.split('\n').length;

test('scored video model pages link their specs to the benchmark methodology', () => {
  const modelPageSource = readSource(modelPagePath);
  const layoutSource = readSource(layoutPath);
  const specsSectionSource = readSource(specsSectionPath);

  assert.match(modelPageSource, /loadBenchmarkScoreSlugs/);
  assert.match(layoutSource, /showBenchmarkLink/);
  assert.match(specsSectionSource, /BenchmarkMethodologyLink/);
});

test('model page layout delegates prep link copy and schema payload composition', () => {
  for (const path of [layoutPath, prepLinksPath, schemaPayloadsPath, schemaBuilderPath, prepLinksSectionPath, pricingCalloutsPath, pricingCalloutSectionPath]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  const layoutSource = readSource(layoutPath);
  const prepLinksSource = readSource(prepLinksPath);
  const schemaSource = readSource(schemaPayloadsPath);
  const schemaBuilderSource = readSource(schemaBuilderPath);
  const prepLinksSectionSource = readSource(prepLinksSectionPath);
  const pricingCalloutsSource = readSource(pricingCalloutsPath);
  const pricingCalloutSectionSource = readSource(pricingCalloutSectionPath);

  assert.match(layoutSource, /buildModelPrepLinksSection/, 'layout should delegate prep link copy selection');
  assert.match(layoutSource, /buildModelPricingCallout/, 'layout should delegate pricing callout copy selection');
  assert.match(layoutSource, /buildModelSchemaPayloads/, 'layout should delegate schema payload composition');
  assert.doesNotMatch(layoutSource, /NANO_BANANA_MODEL_SLUGS|VIDEO_PREP_MODEL_SLUGS|itemListElement/, 'layout should not own prep link copy tables or JSON-LD internals');
  assert.match(prepLinksSource, /NANO_BANANA_MODEL_SLUGS|VIDEO_PREP_MODEL_SLUGS|export function buildModelPrepLinksSection/, 'prep link helper should own localized prep link rules');
  assert.match(pricingCalloutsSource, /seedance-2-0-pricing|ltx-2-3-fast-pricing|kling-3-pro-pricing/, 'pricing callout helper should own stable pricing anchors');
  assert.match(pricingCalloutsSource, /buildSlugMap\('pricing'\)/, 'pricing callout helper should localize pricing URLs');
  assert.match(pricingCalloutSectionSource, /export function ModelPricingCallout/, 'pricing callout component should own section markup');
  assert.match(schemaSource, /buildProductSchema|BreadcrumbList|export function buildModelSchemaPayloads/, 'schema helper should own JSON-LD payloads');
  assert.match(schemaSource, /pricingEngine/, 'schema helper should pass pricing data into Product offers');
  assert.match(schemaBuilderSource, /offers: buildProductOffer/, 'Product schema should include a Google-valid offers property');
  assert.match(schemaBuilderSource, /priceCurrency/, 'Product offers should include price currency');
  assert.match(schemaBuilderSource, /price:/, 'Product offers should include price');
  assert.match(schemaBuilderSource, /shippingDetails/, 'Product offers should include Merchant listings shipping details');
  assert.match(schemaBuilderSource, /hasMerchantReturnPolicy/, 'Product offers should include a Merchant listings return policy');
  assert.match(schemaBuilderSource, /applicableCountry/, 'Product return policy should include the Google Merchant applicableCountry property');
  assert.match(schemaBuilderSource, /returnPolicyCountry/, 'Product return policy should include the required returnPolicyCountry property');
  assert.match(schemaBuilderSource, /MerchantReturnNotPermitted/, 'Digital Product offers should mark returns as not permitted');
  assert.match(prepLinksSectionSource, /export type PrepLinksSection/, 'prep links section should export its contract');
});

test('model page layout stays below the route orchestration threshold', () => {
  const layoutSource = readSource(layoutPath);
  const prepLinksSource = readSource(prepLinksPath);
  const schemaSource = readSource(schemaPayloadsPath);

  assert.ok(lineCount(layoutSource) <= 500, `MarketingModelPageLayout should stay below 500 lines, got ${lineCount(layoutSource)}`);
  assert.ok(lineCount(prepLinksSource) <= 120, `model-page-prep-links should stay below 120 lines, got ${lineCount(prepLinksSource)}`);
  assert.ok(lineCount(schemaSource) <= 100, `model-page-schema-payloads should stay below 100 lines, got ${lineCount(schemaSource)}`);
});

test('model page layout delegates template page ownership', () => {
  for (const path of [
    decisionDataPath,
    decisionPricingPath,
    modelPageMediaPath,
    decisionHeroSectionPath,
    decisionMediaCardPath,
    decisionPricingCardPath,
    pageContentSectionsPath,
    decisionCardsSectionPath,
    decisionPromptingSectionPath,
    decisionDemoMediaPath,
    decisionPromptTabsPath,
    decisionCopyButtonPath,
    decisionTipsSectionPath,
    decisionCompareSectionPath,
    decisionSafetyFaqSectionPath,
  ]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  const modelPageSource = readSource(modelPagePath);
  const layoutSource = readSource(layoutPath);
  const decisionDataSource = readSource(decisionDataPath);
  const decisionPricingSource = readSource(decisionPricingPath);
  const modelPageMediaSource = readSource(modelPageMediaPath);
  const decisionHeroSource = readSource(decisionHeroSectionPath);
  const decisionMediaCardSource = readSource(decisionMediaCardPath);
  const decisionPricingCardSource = readSource(decisionPricingCardPath);
  const pageContentSectionsSource = readSource(pageContentSectionsPath);
  const decisionCardsSource = readSource(decisionCardsSectionPath);
  const decisionPromptingSource = readSource(decisionPromptingSectionPath);
  const decisionDemoMediaSource = readSource(decisionDemoMediaPath);
  const decisionPromptTabsSource = readSource(decisionPromptTabsPath);
  const decisionCopyButtonSource = readSource(decisionCopyButtonPath);
  const decisionTipsSource = readSource(decisionTipsSectionPath);
  const decisionCompareSource = readSource(decisionCompareSectionPath);
  const decisionSafetyFaqSource = readSource(decisionSafetyFaqSectionPath);

  assert.match(layoutSource, /buildModelDecisionData/, 'layout should delegate template data building');
  assert.match(layoutSource, /parseModelPromptingContent/, 'layout should validate exact-locale Prompt Lab content');
  assert.match(layoutSource, /buildModelPromptingViewModel/, 'layout should derive Prompt Lab display state once');
  assert.match(layoutSource, /ModelDecisionHeroSection/, 'layout should render the template hero');
  assert.match(layoutSource, /ModelDecisionPricingCard/, 'layout should render the template pricing card');
  assert.match(layoutSource, /ModelPageContentSections/, 'layout should delegate ordered model content sections');
  assert.match(layoutSource, /templateData\s*\?/, 'layout should conditionally use templateData');
  assert.match(layoutSource, /!templateData\s*&&\s*pricingCallout/, 'layout should keep legacy pricing callouts out of template pages');

  assert.match(decisionDataSource, /getModelPageTemplateConfig\(engine\.modelSlug\)/, 'decision data should use the template registry route guard');
  assert.match(decisionDataSource, /if \(!template\) return null/, 'decision data should return null for non-template pages');
  assert.match(decisionDataSource, /parseModelDecisionContent/);
  assert.match(decisionDataSource, /decisionContent:\s*unknown/);
  assert.match(modelPageSource, /decisionContent:\s*localized\.decision/);
  assert.match(layoutSource, /decisionContent:\s*localizedContent\.decision/);
  assert.doesNotMatch(
    decisionDataSource,
    /SEEDANCE_20_COPY|SEEDANCE_20_FAST_COPY|LTX_23_FAST_COPY|COPY_BY_MODEL_SLUG|buildSlugMap\('pricing'\)|Seedance 2\.0 or Fast\?/,
    'decision data should not own localized template copy maps or copy-only URL helpers'
  );
  assert.match(decisionPricingSource, /getPresetQuote/, 'decision pricing should reuse pricing page quote formatting');
  assert.match(decisionPricingSource, /presets: ModelPagePricingPreset\[\]/, 'decision pricing should accept template scenario presets');
  assert.doesNotMatch(decisionPricingSource, /DECISION_PRICE_PRESETS/, 'decision pricing should not own model-page scenario presets');
  assert.match(modelPageMediaSource, /normalizeMediaUrl/, 'model page media helper should reject placeholder media URLs');

  assert.match(decisionHeroSource, /export function ModelDecisionHeroSection/, 'decision hero should export the section component');
  assert.match(decisionHeroSource, /lg:grid-cols-\[minmax\(440px,0\.9fr\)_minmax\(0,1\.1fr\)\]/, 'decision hero should own the mockup two-column hero grid');
  assert.match(decisionHeroSource, /<ModelDecisionMediaCard/, 'decision hero should render the decision media card');
  assert.match(decisionHeroSource, /decision\.features\.map/, 'decision hero should own the feature strip');
  assert.doesNotMatch(decisionHeroSource, /<h2[^>]*>\{feature\.title\}<\/h2>/, 'feature strip labels should not create early H2 headings');
  assert.match(decisionMediaCardSource, /ModelHeroMedia/, 'decision media card should own the overlay video preview');
  assert.match(decisionMediaCardSource, /renderLinkLabel/, 'decision media card should own the render link overlay');

  assert.match(decisionPricingCardSource, /export function ModelDecisionPricingCard/, 'pricing card should export the pricing component');
  assert.match(decisionPricingCardSource, /pricing\.scenarios\.map/, 'pricing card should own scenario pricing markup');
  assert.match(decisionPricingCardSource, /pricing\.footnote/, 'pricing card should own the pricing footnote');

  assert.match(pageContentSectionsSource, /ModelDecisionCardsSection/, 'content sections should render the decision cards for Seedance 2.0');
  assert.match(pageContentSectionsSource, /isDecision/, 'content sections should own decision vs legacy ordering');
  assert.match(decisionCardsSource, /export function ModelDecisionCardsSection/, 'cards section should export the decision cards component');
  assert.match(decisionCardsSource, /cards\.map/, 'cards section should map decisionCards');
  assert.match(decisionCardsSource, /UIIcon/, 'cards section should render lucide icons through UIIcon');

  assert.match(decisionPromptingSource, /ModelDecisionPromptTabs/, 'decision prompting should delegate interactive tabs');
  assert.match(decisionPromptingSource, /viewModel\.section\.referencesTitle/, 'decision prompting should render the reference workflow section');
  assert.match(decisionPromptingSource, /viewModel\.globalPrinciples\.map/, 'decision prompting should render global principles');
  assert.match(decisionDemoMediaSource, /function getMediaAspectRatio/, 'demo media should derive a stable media frame ratio from the visible aspect label');
  assert.match(decisionDemoMediaSource, /self-start/, 'demo media should opt out of grid stretch so the aspect ratio controls the poster height');
  assert.match(decisionDemoMediaSource, /style=\{\{\s*aspectRatio:\s*mediaAspectRatio\s*\}\}/, 'demo media should reserve the poster/video aspect ratio before playback');
  assert.match(decisionDemoMediaSource, /className="absolute inset-0 h-full w-full object-cover"/, 'demo media video should overlay the ratio-stable frame');
  assert.match(decisionPromptTabsSource, /ModelDecisionCopyButton/, 'decision prompt tabs should support copying templates');
  assert.match(decisionCopyButtonSource, /copyTextToClipboard/, 'decision copy button should use the clipboard helper fallback');
  assert.match(decisionCopyButtonSource, /useEffect\(\(\)\s*=>\s*\{\s*setCopied\(false\)/, 'decision copy button should reset copied state when copy text changes');
  assert.match(decisionPromptTabsSource, /usePromptHref/, 'decision prompt tabs should receive the active engine destination');
  assert.doesNotMatch(decisionPromptTabsSource, /encodeURIComponent\(engineSlug\)/, 'decision prompt tabs should not derive engine destinations');
  assert.doesNotMatch(
    decisionPromptTabsSource,
    /href="\/app\?engine=seedance-2-0"/,
    'decision prompt tabs should not hardcode Seedance for every template page'
  );
  assert.match(decisionTipsSource, /Tips and boundaries|tipsTitle/, 'decision tips should own the visual tips layout');
  assert.match(decisionCompareSource, /focusVsConfig|COMPARE_EXCLUDED_SLUGS/, 'decision compare should own focused and related comparison layouts');
  assert.match(decisionCompareSource, /getCardTitle/, 'decision compare should allow non-versus prep cards such as Seedream');
  assert.match(decisionSafetyFaqSource, /FAQSchema/, 'decision safety FAQ should preserve FAQ schema ownership');

  assert.doesNotMatch(layoutSource, /Seedance 2\.0 or Fast\?/, 'layout should not own Seedance decision copy');
});

test('model decision data consumes strict localized content without obsolete copy owners', () => {
  const decisionDataSource = readSource(decisionDataPath);

  assert.ok(lineCount(decisionDataSource) <= 180, `model-page-decision-data should stay below 180 lines, got ${lineCount(decisionDataSource)}`);
  assert.equal(existsSync(oldTemplateCopyPath), false);
  assert.equal(existsSync(oldAdditionalCopyPath), false);
  assert.ok(existsSync(decisionContentPath));
  assert.doesNotMatch(decisionDataSource, /getModelDecisionCopy|COPY_BY_MODEL_SLUG|ADDITIONAL_TEMPLATE_COPY/);
  assert.ok(lineCount(readSource(decisionContentPath)) <= 220);
});
