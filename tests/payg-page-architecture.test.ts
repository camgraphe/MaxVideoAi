import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const routeRoot = join(
  process.cwd(),
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator',
);
const componentsRoot = join(routeRoot, '_components');
const pagePath = join(routeRoot, 'page.tsx');
const viewPath = join(componentsRoot, 'PayAsYouGoPageView.tsx');
const heroPath = join(componentsRoot, 'PayAsYouGoHeroSections.tsx');
const guidePath = join(componentsRoot, 'PayAsYouGoGuideSections.tsx');
const pricingPath = join(componentsRoot, 'PayAsYouGoPricingSections.tsx');
const trustPath = join(componentsRoot, 'PayAsYouGoTrustSections.tsx');
const primitivesPath = join(componentsRoot, 'PayAsYouGoSectionPrimitives.tsx');

function read(path: string): string {
  assert.equal(existsSync(path), true, `${path} must exist`);
  return readFileSync(path, 'utf8');
}

test('Pay-as-you-go view is a short pure section orchestrator', () => {
  const source = read(viewPath);
  assert.ok(source.split('\n').length <= 100);
  assert.doesNotMatch(
    source,
    /AppLocale|getPayAsYouGoViewCopy|copy\.text|function .*Section|isVisiblePrice|findModelForExampleCost|lucide-react/,
  );
  const ordered = [
    'PayAsYouGoHeroSection',
    'PayAsYouGoVideoShowcase',
    'PayAsYouGoNaturalQuestionsSection',
    'PayAsYouGoModelTestingOrderSection',
    'PayAsYouGoMeaningSection',
    'PayAsYouGoAudienceFitSection',
    'PayAsYouGoSubscriptionComparisonSection',
    'PayAsYouGoWorkflowSection',
    'PayAsYouGoQuoteFactorsSection',
    'PayAsYouGoPricePerModelSection',
    'PayAsYouGoPriceLookupShortcutsSection',
    'PayAsYouGoExampleCostsSection',
    'PayAsYouGoRefundPolicySection',
    'PayAsYouGoFaqSection',
  ];
  let cursor = -1;
  for (const name of ordered) {
    const next = source.indexOf(`<${name}`, cursor + 1);
    assert.ok(next > cursor, `${name} must appear in order`);
    cursor = next;
  }
});

test('section files render only and obey physical caps', () => {
  for (const [path, cap] of [
    [heroPath, 250],
    [guidePath, 250],
    [pricingPath, 250],
    [trustPath, 250],
    [primitivesPath, 120],
  ] as const) {
    const source = read(path);
    assert.ok(source.split('\n').length <= cap, `${path} must be <= ${cap} lines`);
    assert.doesNotMatch(
      source,
      /AppLocale|copy\.text|buildPricingHubData|PAYG_COPY_BY_LOCALE|PRICE_LOOKUP_COPY|buildPayAsYouGo.*JsonLd/,
    );
  }
});

test('section ownership and renderer interfaces remain explicit', () => {
  const owners = [
    [heroPath, ['PayAsYouGoHeroSection', 'PayAsYouGoNaturalQuestionsSection', 'PayAsYouGoModelTestingOrderSection']],
    [guidePath, ['PayAsYouGoMeaningSection', 'PayAsYouGoAudienceFitSection', 'PayAsYouGoSubscriptionComparisonSection', 'PayAsYouGoWorkflowSection', 'PayAsYouGoQuoteFactorsSection']],
    [pricingPath, ['PayAsYouGoPricePerModelSection', 'PayAsYouGoPriceLookupShortcutsSection', 'PayAsYouGoExampleCostsSection']],
    [trustPath, ['PayAsYouGoRefundPolicySection', 'PayAsYouGoFaqSection']],
  ] as const;

  for (const [path, exports] of owners) {
    const source = read(path);
    for (const exportName of exports) {
      assert.match(source, new RegExp(`export function ${exportName}\\b`));
    }
    assert.doesNotMatch(source, /\blocale\b|translation selector/);
  }

  const primitives = read(primitivesPath);
  assert.match(primitives, /export const PAYG_CONTAINER_CLASS_NAME/);
  assert.match(primitives, /export function PayAsYouGoSectionHeader\b/);
  assert.match(primitives, /export function PayAsYouGoSemanticIcon\b/);
  assert.match(primitives, /Record<PaygIconId, LucideIcon>/);
});

test('page and parity call sites do not pass locale into the final view', () => {
  const pageSource = read(pagePath);
  const viewSource = read(viewPath);
  assert.doesNotMatch(pageSource, /<PayAsYouGoPageView\s+locale=/);
  assert.doesNotMatch(viewSource, /locale:\s*AppLocale/);
  assert.match(viewSource, /showcaseCopy: PayAsYouGoContent\['showcase'\]\['section'\]/);
  assert.match(viewSource, /showcaseVideos: PayAsYouGoShowcaseVideo\[\]/);
});
