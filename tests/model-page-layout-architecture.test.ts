import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const layoutPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx');
const prepLinksPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prep-links.ts');
const schemaPayloadsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema-payloads.ts');
const prepLinksSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPrepLinksSection.tsx');
const pricingCalloutsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing-callouts.ts');
const pricingCalloutSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPricingCallout.tsx');
const decisionDataPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts');
const decisionPricingPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts');
const templateCopyPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy.ts');
const modelPageMediaPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media.ts');
const decisionHeroSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionHeroSection.tsx');
const decisionMediaCardPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionMediaCard.tsx');
const decisionPricingCardPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPricingCard.tsx');
const pageContentSectionsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPageContentSections.tsx');
const decisionCardsSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionCardsSection.tsx');
const decisionPromptingSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptingSection.tsx');
const decisionPromptTabsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptTabs.client.tsx');
const decisionTipsSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionTipsSection.tsx');
const decisionCompareSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionCompareSection.tsx');
const decisionSafetyFaqSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionSafetyFaqSection.tsx');

const readSource = (path: string) => readFileSync(path, 'utf8');
const lineCount = (source: string) => source.split('\n').length;

test('model page layout delegates prep link copy and schema payload composition', () => {
  for (const path of [layoutPath, prepLinksPath, schemaPayloadsPath, prepLinksSectionPath, pricingCalloutsPath, pricingCalloutSectionPath]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  const layoutSource = readSource(layoutPath);
  const prepLinksSource = readSource(prepLinksPath);
  const schemaSource = readSource(schemaPayloadsPath);
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
    templateCopyPath,
    modelPageMediaPath,
    decisionHeroSectionPath,
    decisionMediaCardPath,
    decisionPricingCardPath,
    pageContentSectionsPath,
    decisionCardsSectionPath,
    decisionPromptingSectionPath,
    decisionPromptTabsPath,
    decisionTipsSectionPath,
    decisionCompareSectionPath,
    decisionSafetyFaqSectionPath,
  ]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  const layoutSource = readSource(layoutPath);
  const decisionDataSource = readSource(decisionDataPath);
  const decisionPricingSource = readSource(decisionPricingPath);
  const templateCopySource = readSource(templateCopyPath);
  const modelPageMediaSource = readSource(modelPageMediaPath);
  const decisionHeroSource = readSource(decisionHeroSectionPath);
  const decisionMediaCardSource = readSource(decisionMediaCardPath);
  const decisionPricingCardSource = readSource(decisionPricingCardPath);
  const pageContentSectionsSource = readSource(pageContentSectionsPath);
  const decisionCardsSource = readSource(decisionCardsSectionPath);
  const decisionPromptingSource = readSource(decisionPromptingSectionPath);
  const decisionPromptTabsSource = readSource(decisionPromptTabsPath);
  const decisionTipsSource = readSource(decisionTipsSectionPath);
  const decisionCompareSource = readSource(decisionCompareSectionPath);
  const decisionSafetyFaqSource = readSource(decisionSafetyFaqSectionPath);

  assert.match(layoutSource, /buildModelDecisionData/, 'layout should delegate template data building');
  assert.match(layoutSource, /ModelDecisionHeroSection/, 'layout should render the template hero');
  assert.match(layoutSource, /ModelDecisionPricingCard/, 'layout should render the template pricing card');
  assert.match(layoutSource, /ModelPageContentSections/, 'layout should delegate ordered model content sections');
  assert.match(layoutSource, /templateData\s*\?/, 'layout should conditionally use templateData');
  assert.match(layoutSource, /!templateData\s*&&\s*pricingCallout/, 'layout should keep legacy pricing callouts out of template pages');

  assert.match(decisionDataSource, /getModelPageTemplateConfig\(engine\.modelSlug\)/, 'decision data should use the template registry route guard');
  assert.match(decisionDataSource, /if \(!template\) return null/, 'decision data should return null for non-template pages');
  assert.match(decisionDataSource, /getModelDecisionCopy\(engine\.modelSlug,\s*locale\)/, 'decision data should delegate localized copy selection');
  assert.doesNotMatch(
    decisionDataSource,
    /SEEDANCE_20_COPY|SEEDANCE_20_FAST_COPY|LTX_23_FAST_COPY|COPY_BY_MODEL_SLUG|buildSlugMap\('pricing'\)|Seedance 2\.0 or Fast\?/,
    'decision data should not own localized template copy maps or copy-only URL helpers'
  );
  assert.match(templateCopySource, /COPY_BY_MODEL_SLUG/, 'template copy helper should own the model slug copy registry');
  assert.match(templateCopySource, /getModelDecisionCopy/, 'template copy helper should expose localized copy lookup');
  assert.match(templateCopySource, /Seedance 2\.0 or Fast\?|Fast or LTX 2\.3 Pro\?/, 'template copy helper should own model-specific decision card copy');
  assert.match(templateCopySource, /buildSlugMap\('pricing'\)|compareHref|examplesHref/, 'template copy helper should own copy href helpers');
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
  assert.match(decisionPromptingSource, /How Seedance 2\.0 uses references|referencesTitle/, 'decision prompting should render the reference workflow section');
  assert.match(decisionPromptingSource, /promptingGlobalPrinciples/, 'decision prompting should render global principles');
  assert.match(decisionPromptTabsSource, /navigator\.clipboard\.writeText|ModelDecisionCopyButton/, 'decision prompt tabs should support copying templates');
  assert.match(decisionTipsSource, /Tips and boundaries|tipsTitle/, 'decision tips should own the visual tips layout');
  assert.match(decisionCompareSource, /focusVsConfig|COMPARE_EXCLUDED_SLUGS/, 'decision compare should own focused and related comparison layouts');
  assert.match(decisionCompareSource, /getCardTitle/, 'decision compare should allow non-versus prep cards such as Seedream');
  assert.match(decisionSafetyFaqSource, /FAQSchema/, 'decision safety FAQ should preserve FAQ schema ownership');

  assert.doesNotMatch(layoutSource, /Seedance 2\.0 or Fast\?/, 'layout should not own Seedance decision copy');
});

test('model decision data delegates localized template copy to a route-local helper', () => {
  const decisionDataSource = readSource(decisionDataPath);
  const templateCopySource = readSource(templateCopyPath);

  assert.ok(lineCount(decisionDataSource) <= 180, `model-page-decision-data should stay below 180 lines, got ${lineCount(decisionDataSource)}`);
  assert.ok(lineCount(templateCopySource) > 500, `model-page-template-copy should own the larger copy tables, got ${lineCount(templateCopySource)}`);
});
