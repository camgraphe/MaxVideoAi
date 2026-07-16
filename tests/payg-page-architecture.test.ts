import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
const dataPath = join(routeRoot, '_lib/payg-page-data.ts');
const jsonLdPath = join(routeRoot, '_lib/payg-jsonld.ts');
const showcasePath = join(componentsRoot, 'PayAsYouGoVideoShowcase.tsx');
const showcaseDataPath = join(routeRoot, '_lib/payg-video-showcase.ts');
const contentRoot = join(routeRoot, '_content');

function read(path: string): string {
  assert.equal(existsSync(path), true, `${path} must exist`);
  return readFileSync(path, 'utf8');
}

function listFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function assertLineCap(path: string, cap: number): void {
  assert.ok(read(path).split('\n').length <= cap, `${path} must be <= ${cap} lines`);
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

  const iconMap = primitives.match(/const ICONS: Record<PaygIconId, LucideIcon> = \{([\s\S]*?)\n\};/)?.[1];
  assert.ok(iconMap, 'the semantic icon map must remain statically inspectable');
  assert.deepEqual(
    Object.fromEntries([...iconMap.matchAll(/^\s*(\w+):\s*(\w+),$/gm)].map((match) => [match[1], match[2]])),
    {
      model: 'Layers3',
      engine: 'SlidersHorizontal',
      preview: 'Eye',
      video: 'Film',
      refund: 'RotateCcw',
      duration: 'Film',
      resolution: 'Sparkles',
      audio: 'BadgeDollarSign',
      credits: 'CreditCard',
    },
  );
});

test('the permanent page call site does not pass locale into the final view', () => {
  const pageSource = read(pagePath);
  const viewSource = read(viewPath);
  const pageViewCall = pageSource.match(/<PayAsYouGoPageView[\s\S]*?\/>/)?.[0];
  assert.ok(pageViewCall, 'page.tsx must render PayAsYouGoPageView');
  assert.match(pageViewCall, /\bdata=\{data\}/);
  assert.doesNotMatch(pageViewCall, /\blocale=/);
  assert.doesNotMatch(viewSource, /locale:\s*AppLocale/);
  assert.match(viewSource, /showcaseCopy: PayAsYouGoContent\['showcase'\]\['section'\]/);
  assert.match(viewSource, /showcaseVideos: PayAsYouGoShowcaseVideo\[\]/);
});

test('all Pay-as-you-go authored locale selection lives only in _content', () => {
  const productionFiles = listFiles(routeRoot).filter(
    (path) => /\.(?:ts|tsx)$/.test(path) && !path.includes('/_content/'),
  );
  const source = productionFiles.map((path) => read(path)).join('\n');
  assert.doesNotMatch(
    source,
    /copy\.text|getPayAsYouGoViewCopy|getShowcaseCopy|PAYG_COPY_BY_LOCALE|PRICE_LOOKUP_COPY|translatedTitles/,
  );
  assert.doesNotMatch(source, /\{\s*en:\s*['"`]/);
  const nonFormatterSource = productionFiles
    .filter((path) => !path.endsWith('/payg-video-showcase.ts'))
    .map((path) => read(path))
    .join('\n');
  assert.doesNotMatch(nonFormatterSource, /locale === ['"](?:en|fr|es)['"]\s*\?\s*['"`]/);
  const formatterSource = read(showcaseDataPath);
  assert.match(formatterSource, /new Intl\.NumberFormat/);
  assert.doesNotMatch(
    formatterSource,
    /Price shown first|Precio visible antes de generar|Prix affiché avant la génération|translatedTitles/,
  );
});

test('Pay-as-you-go files satisfy final physical boundaries', () => {
  assertLineCap(pagePath, 120);
  assertLineCap(viewPath, 100);
  assertLineCap(heroPath, 250);
  assertLineCap(guidePath, 250);
  assertLineCap(pricingPath, 250);
  assertLineCap(trustPath, 250);
  assertLineCap(primitivesPath, 120);
  assertLineCap(dataPath, 400);
  assertLineCap(jsonLdPath, 120);
  assertLineCap(showcasePath, 250);
  assertLineCap(showcaseDataPath, 250);
  for (const locale of ['en', 'fr', 'es']) {
    assertLineCap(join(contentRoot, `${locale}.ts`), 350);
  }
  assertLineCap(join(contentRoot, 'types.ts'), 180);
  assertLineCap(join(contentRoot, 'index.ts'), 180);
});
