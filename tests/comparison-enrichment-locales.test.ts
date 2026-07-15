import assert from 'node:assert/strict';
import test from 'node:test';

import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import { EN_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts';
import { ES_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts';
import { FR_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts';
import type { ComparePageOverride } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-types.ts';
import { isPublishedComparisonSlug } from '../frontend/lib/compare-hub/data.ts';

const TARGET_COMPARISONS = [
  ['pika-text-to-video-vs-wan-2-6', 'pika-text-to-video', 'wan-2-6'],
  ['kling-2-6-pro-vs-kling-3-pro', 'kling-2-6-pro', 'kling-3-pro'],
  ['ltx-2-3-fast-vs-luma-ray-2', 'ltx-2-3-fast', 'luma-ray-2'],
  ['kling-2-6-pro-vs-minimax-hailuo-02-text', 'kling-2-6-pro', 'minimax-hailuo-02-text'],
  ['kling-3-standard-vs-kling-o3-standard', 'kling-3-standard', 'kling-o3-standard'],
  ['seedance-2-0-fast-vs-veo-3-1', 'seedance-2-0-fast', 'veo-3-1'],
  ['ltx-2-fast-vs-minimax-hailuo-02-text', 'ltx-2-fast', 'minimax-hailuo-02-text'],
  ['minimax-hailuo-02-text-vs-veo-3-1-fast', 'minimax-hailuo-02-text', 'veo-3-1-fast'],
  ['kling-3-4k-vs-seedance-2-0', 'kling-3-4k', 'seedance-2-0'],
  ['minimax-hailuo-02-text-vs-wan-2-6', 'minimax-hailuo-02-text', 'wan-2-6'],
] as const;

const PARITY_COMPLETION_SLUGS = [
  'seedance-2-0-vs-seedance-2-0-fast',
  'dreamina-seedance-2-0-mini-vs-seedance-2-0',
  'dreamina-seedance-2-0-mini-vs-seedance-2-0-fast',
  'dreamina-seedance-2-0-mini-vs-ltx-2-3-fast',
  'dreamina-seedance-2-0-mini-vs-veo-3-1-fast',
  'dreamina-seedance-2-0-mini-vs-luma-ray-3-2',
  'luma-ray-3-2-vs-veo-3-1-fast',
  'happy-horse-1-1-vs-kling-o3-pro',
  'happy-horse-1-1-vs-veo-3-1-fast',
  'happy-horse-1-1-vs-seedance-2-0-fast',
  'dreamina-seedance-2-0-mini-vs-happy-horse-1-1',
  'happy-horse-1-1-vs-ltx-2-3-pro',
  'veo-3-1-fast-vs-veo-3-1-lite',
] as const;

type Locale = 'en' | 'fr' | 'es';
type OverrideMap = Record<string, ComparePageOverride>;

const OVERRIDES_BY_LOCALE: Record<Locale, OverrideMap> = {
  en: EN_COMPARE_PAGE_OVERRIDES,
  fr: FR_COMPARE_PAGE_OVERRIDES,
  es: ES_COMPARE_PAGE_OVERRIDES,
};

const CATALOG_BY_SLUG = new Map(engineCatalog.map((entry) => [entry.modelSlug, entry]));

function getEntry(locale: Locale, slug: string): ComparePageOverride {
  const entry = OVERRIDES_BY_LOCALE[locale][slug];
  assert.ok(entry, `missing ${locale.toUpperCase()} override for ${slug}`);
  return entry;
}

function collectText(entry: ComparePageOverride): string {
  return [
    entry.meta?.title,
    entry.meta?.description,
    entry.heroIntro,
    entry.quickVerdict?.title,
    entry.quickVerdict?.body,
    ...(entry.topCards ?? []).flatMap((card) => [card.title, card.body]),
    ...(entry.primaryLinks ?? []).map((link) => link.label),
    entry.faq?.title,
    entry.faq?.subtitle,
    ...(entry.faq?.items ?? []).flatMap((item) => [
      item.question,
      ...(Array.isArray(item.answer) ? item.answer : [item.answer]),
    ]),
  ]
    .filter(Boolean)
    .join(' ');
}

function collectStructuralFieldPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((item) => collectStructuralFieldPaths(item, `${prefix}[]`)))].sort();
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, nested]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return [path, ...collectStructuralFieldPaths(nested, path)];
    })
    .sort();
}

function assertCompleteOverride(locale: Locale, slug: string): void {
  const entry = getEntry(locale, slug);
  const title = entry.meta?.title ?? '';
  const description = entry.meta?.description ?? '';

  assert.ok(title.length >= 35 && title.length <= 80, `${locale} title length for ${slug}: ${title.length}`);
  assert.ok(description.length >= 120 && description.length <= 180, `${locale} description length for ${slug}: ${description.length}`);
  assert.equal(entry.meta?.titleBranding, 'none', `${locale} should disable automatic branding for ${slug}`);
  assert.ok((entry.heroIntro?.length ?? 0) >= 140, `${locale} hero should be decision-focused for ${slug}`);
  assert.ok((entry.quickVerdict?.body.length ?? 0) >= 120, `${locale} verdict should be substantive for ${slug}`);
  assert.equal(entry.topCards?.length, 4, `${locale} should have four decision cards for ${slug}`);
  assert.ok((entry.primaryLinks?.length ?? 0) >= 3, `${locale} should have at least three internal links for ${slug}`);
  assert.ok((entry.faq?.items.length ?? 0) >= 3, `${locale} should have at least three FAQ items for ${slug}`);
  assert.ok((entry.faq?.items.length ?? 0) <= 5, `${locale} should have at most five FAQ items for ${slug}`);

  const faqQuestions = (entry.faq?.items ?? []).map((item) => item.question);
  assert.equal(new Set(faqQuestions).size, faqQuestions.length, `${locale} FAQ questions should be unique for ${slug}`);
  const hrefs = (entry.primaryLinks ?? []).map((link) => link.href);
  assert.equal(new Set(hrefs).size, hrefs.length, `${locale} internal links should be unique for ${slug}`);
  hrefs.forEach((href) => {
    assert.match(href, /^\/(models|examples|ai-video-engines)\//, `${locale} unsupported internal href ${href}`);
    assert.doesNotMatch(href, /^\/(fr|es)\//, `${locale} href must remain locale-neutral: ${href}`);
  });
}

for (const locale of ['en', 'fr', 'es'] as const) {
  test(`${locale.toUpperCase()} comparison enrichment entries satisfy the editorial contract`, () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();

    TARGET_COMPARISONS.forEach(([slug, leftSlug, rightSlug]) => {
      assert.ok(isPublishedComparisonSlug(slug), `${slug} should remain published`);
      const left = CATALOG_BY_SLUG.get(leftSlug);
      const right = CATALOG_BY_SLUG.get(rightSlug);
      assert.ok(left, `missing catalog entry ${leftSlug}`);
      assert.ok(right, `missing catalog entry ${rightSlug}`);

      assertCompleteOverride(locale, slug);
      const entry = getEntry(locale, slug);
      const pageText = collectText(entry);
      assert.match(pageText, new RegExp(left.marketingName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      assert.match(pageText, new RegExp(right.marketingName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

      const title = entry.meta?.title ?? '';
      const description = entry.meta?.description ?? '';
      assert.ok(!titles.has(title), `${locale} title should be unique: ${title}`);
      assert.ok(!descriptions.has(description), `${locale} description should be unique: ${description}`);
      titles.add(title);
      descriptions.add(description);
    });
  });
}

test('French and LATAM Spanish are localized instead of copying English', () => {
  TARGET_COMPARISONS.forEach(([slug]) => {
    const english = getEntry('en', slug);
    const french = getEntry('fr', slug);
    const spanish = getEntry('es', slug);
    assert.notEqual(french.meta?.title, english.meta?.title, `FR title should be localized for ${slug}`);
    assert.notEqual(spanish.meta?.title, english.meta?.title, `ES title should be localized for ${slug}`);
    assert.notEqual(french.quickVerdict?.body, english.quickVerdict?.body, `FR verdict should be localized for ${slug}`);
    assert.notEqual(spanish.quickVerdict?.body, english.quickVerdict?.body, `ES verdict should be localized for ${slug}`);
  });
});

test('Spanish comparison copy stays LATAM-neutral', () => {
  const spainSpecificTerms = /\b(vídeo|vídeos|móvil|móviles|ordenador|ordenadores|monedero|monederos|vosotros)\b/i;
  TARGET_COMPARISONS.forEach(([slug]) => {
    assert.doesNotMatch(collectText(getEntry('es', slug)), spainSpecificTerms, `Spain-specific term in ${slug}`);
  });
});

test('the bounded FR and ES metadata gaps are complete and independently localized', () => {
  for (const slug of PARITY_COMPLETION_SLUGS) {
    const english = getEntry('en', slug);
    for (const locale of ['fr', 'es'] as const) {
      const localized = getEntry(locale, slug);
      const title = localized.meta?.title ?? '';
      const description = localized.meta?.description ?? '';

      assert.ok(title.length >= 35 && title.length <= 80, `${locale} title length for ${slug}: ${title.length}`);
      assert.ok(
        description.length >= 120 && description.length <= 180,
        `${locale} description length for ${slug}: ${description.length}`,
      );
      assert.equal(localized.meta?.titleBranding, english.meta?.titleBranding, `${locale} branding for ${slug}`);
      assert.notEqual(title, english.meta?.title, `${locale} title should not copy English for ${slug}`);
      assert.notEqual(description, english.meta?.description, `${locale} description should not copy English for ${slug}`);
    }
  }
});

test('all 47 completed comparison entries have equivalent EN, FR and ES field presence', () => {
  const englishSlugs = Object.keys(EN_COMPARE_PAGE_OVERRIDES).sort();
  assert.equal(englishSlugs.length, 47);
  assert.deepEqual(Object.keys(FR_COMPARE_PAGE_OVERRIDES).sort(), englishSlugs);
  assert.deepEqual(Object.keys(ES_COMPARE_PAGE_OVERRIDES).sort(), englishSlugs);

  for (const slug of englishSlugs) {
    const englishPaths = collectStructuralFieldPaths(getEntry('en', slug));
    assert.deepEqual(collectStructuralFieldPaths(getEntry('fr', slug)), englishPaths, `FR structure for ${slug}`);
    assert.deepEqual(collectStructuralFieldPaths(getEntry('es', slug)), englishPaths, `ES structure for ${slug}`);
  }
});

test('Seedance 2.0 standard versus Fast has localized quick verdicts without fallback', () => {
  const slug = 'seedance-2-0-vs-seedance-2-0-fast';
  const english = getEntry('en', slug).quickVerdict;
  const french = getEntry('fr', slug).quickVerdict;
  const spanish = getEntry('es', slug).quickVerdict;

  assert.ok(french && french.body.length >= 120);
  assert.ok(spanish && spanish.body.length >= 120);
  assert.notEqual(french.title, english?.title);
  assert.notEqual(french.body, english?.body);
  assert.notEqual(spanish.title, english?.title);
  assert.notEqual(spanish.body, english?.body);
});

test('every comparison enrichment link resolves to a public model or comparison route', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    TARGET_COMPARISONS.forEach(([slug]) => {
      for (const link of getEntry(locale, slug).primaryLinks ?? []) {
        if (link.href.startsWith('/models/')) {
          const modelSlug = link.href.slice('/models/'.length);
          const model = CATALOG_BY_SLUG.get(modelSlug);
          assert.ok(model, `missing model route ${link.href}`);
          assert.equal(model.surfaces.modelPage.indexable, true, `model route should be public: ${link.href}`);
        }
        if (link.href.startsWith('/ai-video-engines/')) {
          assert.ok(
            isPublishedComparisonSlug(link.href.slice('/ai-video-engines/'.length)),
            `comparison route should be published: ${link.href}`,
          );
        }
      }
    });
  }
});
