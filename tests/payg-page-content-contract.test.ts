import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { AppLocale } from '../frontend/i18n/locales.ts';
import type { GalleryVideo } from '../frontend/server/videos.ts';
import { getPayAsYouGoContent } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/index.ts';
import {
  PAYG_EXAMPLE_COST_IDS,
  PAYG_ICON_IDS,
  PAYG_PRICE_LOOKUP_IDS,
  PAYG_SHOWCASE_TITLE_IDS,
  PAYG_SUPPORTED_MODEL_IDS,
} from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/types.ts';
import { buildPayAsYouGoShowcaseVideo } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-video-showcase.ts';

const contentRoot = join(
  process.cwd(),
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content',
);
const routeRoot = join(contentRoot, '..');
const pagePath = join(routeRoot, 'page.tsx');
const jsonLdPath = join(routeRoot, '_lib/payg-jsonld.ts');
const locales = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function signature(value: unknown): unknown {
  if (Array.isArray(value)) {
    return { kind: 'array', length: value.length, items: value.map(signature) };
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, child]) => [key, signature(child)]),
    );
  }
  return typeof value;
}

function assertNoBlankStrings(value: unknown, path = 'content'): void {
  if (typeof value === 'string') {
    assert.ok(value.trim(), `${path} must be non-empty`);
  } else if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoBlankStrings(child, `${path}[${index}]`));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => assertNoBlankStrings(child, `${path}.${key}`));
  }
}

test('Pay-as-you-go content is complete, exact-locale and structurally identical', () => {
  const documents = locales.map(getPayAsYouGoContent);
  documents.forEach((document) => assertNoBlankStrings(document));
  assert.deepEqual(signature(documents[1]), signature(documents[0]));
  assert.deepEqual(signature(documents[2]), signature(documents[0]));
  assert.notEqual(documents[0].metadata.title, documents[1].metadata.title);
  assert.notEqual(documents[0].metadata.title, documents[2].metadata.title);
  assert.throws(
    () => getPayAsYouGoContent('de' as AppLocale),
    /Missing complete Pay-as-you-go content for locale "de"/,
  );
});

test('metadata and JSON-LD read exact-locale editorial content', () => {
  const pageSource = read(pagePath);
  const jsonLdSource = read(jsonLdPath);
  assert.match(pageSource, /getPayAsYouGoContent\(locale\)/);
  assert.match(pageSource, /const meta = getPayAsYouGoContent\(locale\)\.metadata/);
  assert.match(pageSource, /copy: content\.jsonLd/);
  assert.doesNotMatch(pageSource, /const PAYG_META/);
  assert.doesNotMatch(jsonLdSource, /\ben:\s*\{|\bes:\s*\{|\bfr:\s*\{/);
  assert.match(jsonLdSource, /copy: PayAsYouGoContent\['jsonLd'\]/);
  assert.match(jsonLdSource, /price: '10\.00'/);
});

test('semantic ID inventories are fixed and exhaustive', () => {
  assert.deepEqual(PAYG_ICON_IDS, [
    'model', 'engine', 'preview', 'video', 'refund', 'duration', 'resolution', 'audio', 'credits',
  ]);
  assert.deepEqual(PAYG_PRICE_LOOKUP_IDS, [
    'seedance-2-0', 'kling-3-pro', 'veo-3-1', 'happy-horse-1-1', 'seedance-2-0-mini', 'ltx-2-3-fast',
  ]);
  assert.deepEqual(PAYG_EXAMPLE_COST_IDS, [
    'seedance-2-0', 'kling-3-pro', 'veo-3-1-fast', 'happy-horse-1-1', 'seedance-2-0-mini', 'ltx-2-3-fast',
  ]);
  assert.deepEqual(PAYG_SUPPORTED_MODEL_IDS, [
    'seedance-2-0', 'kling-3-pro', 'veo-3-1', 'happy-horse-1-1', 'seedance-2-0-mini', 'ltx-2-3-fast', 'wan-2-6',
  ]);
  assert.deepEqual(PAYG_SHOWCASE_TITLE_IDS, [
    'rooftop', 'museum', 'smooth-image', 'guided-image', 'racer', 'ugc', 'warrior', 'product-image', 'product-reveal',
  ]);
});

test('editorial content owns semantic strings but no computed pricing or React runtime', () => {
  const localeSources = ['en.ts', 'fr.ts', 'es.ts']
    .map((name) => read(join(contentRoot, name)))
    .join('\n');
  assert.doesNotMatch(
    localeSources,
    /buildPricingHubData|VideoPricingRow|priceCells|quotes\[|finalPriceCents|lucide-react|React/,
  );
  assert.match(localeSources, /Starter credits from \$10/);
  assert.deepEqual(
    getPayAsYouGoContent('en').workflow.items.map((item) => item.icon),
    ['engine', 'preview', 'video', 'refund'],
  );
  assert.deepEqual(
    getPayAsYouGoContent('en').quoteFactors.items.map((item) => item.icon),
    ['model', 'duration', 'resolution', 'audio'],
  );
});

test('showcase formatting uses exact-locale content while retaining runtime number formatting', () => {
  const fixtureGalleryVideo = (overrides: Partial<GalleryVideo> = {}) => ({
    id: 'showcase-fixture',
    engineId: 'kling-3-pro',
    engineLabel: 'Kling 3 Pro',
    prompt: 'A rooftop chase',
    promptExcerpt: 'A rooftop chase',
    durationSec: 8,
    currency: 'USD',
    ...overrides,
  }) as GalleryVideo;

  for (const locale of locales) {
    const copy = getPayAsYouGoContent(locale).showcase.runtime;
    const result = buildPayAsYouGoShowcaseVideo(
      fixtureGalleryVideo({ finalPriceCents: undefined, prompt: 'A rooftop chase' }),
      locale,
      copy,
    );
    assert.equal(result.priceLabel, copy.priceUnavailable);
    assert.equal(result.title, copy.titles.rooftop);
    assert.equal(result.useCase, copy.useCases.kling);
  }

  const priced = buildPayAsYouGoShowcaseVideo(
    fixtureGalleryVideo({ finalPriceCents: 123 }),
    'en',
    getPayAsYouGoContent('en').showcase.runtime,
  );
  assert.equal(priced.priceLabel, '$1.23');

  for (const locale of ['fr', 'es'] as const) {
    const copy = getPayAsYouGoContent(locale).showcase.runtime;
    const fallback = buildPayAsYouGoShowcaseVideo(
      fixtureGalleryVideo({
        engineId: '',
        engineLabel: '',
        prompt: 'Clouds move over a quiet valley',
        promptExcerpt: 'Clouds move over a quiet valley',
      }),
      locale,
      copy,
    );
    assert.equal(fallback.engineLabel, 'AI video model');
    assert.equal(
      fallback.title,
      locale === 'fr' ? 'Rendu d’exemple avec AI video' : 'Render de ejemplo con AI video',
    );
  }
});

test('each locale module exports one complete literal and imports only the content type', () => {
  for (const locale of locales) {
    const source = read(join(contentRoot, `${locale}.ts`));
    assert.match(source, /^import type \{ PayAsYouGoContent \} from '\.\/types';/);
    assert.equal((source.match(/^import /gm) ?? []).length, 1);
    assert.equal((source.match(/^export const /gm) ?? []).length, 1);
    assert.match(source, new RegExp(`export const ${locale}PayAsYouGoContent = \\{`));
    assert.match(source, /\} satisfies PayAsYouGoContent;\s*$/);
  }
});
