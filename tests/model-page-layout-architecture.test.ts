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
const decisionHeroSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionHeroSection.tsx');
const decisionPricingCardPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPricingCard.tsx');
const decisionCardsSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionCardsSection.tsx');

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

test('model page layout delegates Seedance decision page ownership', () => {
  for (const path of [
    decisionDataPath,
    decisionPricingPath,
    decisionHeroSectionPath,
    decisionPricingCardPath,
    decisionCardsSectionPath,
  ]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  const layoutSource = readSource(layoutPath);
  const decisionDataSource = readSource(decisionDataPath);
  const decisionPricingSource = readSource(decisionPricingPath);
  const decisionHeroSource = readSource(decisionHeroSectionPath);
  const decisionPricingCardSource = readSource(decisionPricingCardPath);
  const decisionCardsSource = readSource(decisionCardsSectionPath);

  assert.match(decisionDataSource, /modelSlug !== 'seedance-2-0'/, 'decision data should own the Seedance 2.0 route guard');
  assert.match(decisionDataSource, /decisionCards/, 'decision data should own decision card copy');
  assert.match(decisionPricingSource, /getPresetQuote/, 'decision pricing should reuse pricing page quote formatting');
  assert.match(decisionPricingSource, /VIDEO_PRICE_PRESETS/, 'decision pricing should reuse pricing page presets');

  assert.match(decisionHeroSource, /export function ModelDecisionHeroSection/, 'decision hero should export the section component');
  assert.match(decisionHeroSource, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(360px,0\.86fr\)\]/, 'decision hero should own the two-column hero grid');
  assert.match(decisionHeroSource, /<MediaPreview/, 'decision hero should render media via MediaPreview');
  assert.match(decisionHeroSource, /decision\.features\.map/, 'decision hero should own the feature strip');

  assert.match(decisionPricingCardSource, /export function ModelDecisionPricingCard/, 'pricing card should export the pricing component');
  assert.match(decisionPricingCardSource, /pricing\.scenarios\.map/, 'pricing card should own scenario pricing markup');
  assert.match(decisionPricingCardSource, /pricing\.footnote/, 'pricing card should own the pricing footnote');

  assert.match(decisionCardsSource, /export function ModelDecisionCardsSection/, 'cards section should export the decision cards component');
  assert.match(decisionCardsSource, /cards\.map/, 'cards section should map decisionCards');
  assert.match(decisionCardsSource, /UIIcon/, 'cards section should render lucide icons through UIIcon');

  assert.doesNotMatch(layoutSource, /Seedance 2\.0 or Fast\?/, 'layout should not own Seedance decision copy');
  assert.match(layoutSource, /buildModelDecisionData/, 'layout should eventually build decision data');
  assert.match(layoutSource, /ModelDecisionHeroSection/, 'layout should eventually render the decision hero section');
  assert.match(layoutSource, /ModelDecisionPricingCard/, 'layout should eventually render the decision pricing card');
  assert.match(layoutSource, /ModelDecisionCardsSection/, 'layout should eventually render decision cards');
});
