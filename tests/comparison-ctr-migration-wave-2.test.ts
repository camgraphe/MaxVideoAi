import assert from 'node:assert/strict';
import test from 'node:test';

import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import { EN_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts';
import { ES_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts';
import { FR_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts';
import type { ComparePageOverride } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-types.ts';
import { isPublishedComparisonSlug } from '../frontend/lib/compare-hub/data.ts';

const TARGET_COMPARISONS = [
  ['ltx-2-3-fast-vs-sora-2-pro', 'ltx-2-3-fast', 'sora-2-pro'],
  ['veo-3-1-vs-wan-2-5', 'veo-3-1', 'wan-2-5'],
  ['kling-2-6-pro-vs-wan-2-5', 'kling-2-6-pro', 'wan-2-5'],
  ['veo-3-1-fast-vs-wan-2-5', 'veo-3-1-fast', 'wan-2-5'],
  ['luma-ray-2-vs-luma-ray-2-flash', 'luma-ray-2', 'luma-ray-2-flash'],
  ['kling-3-4k-vs-kling-3-standard', 'kling-3-4k', 'kling-3-standard'],
  ['kling-2-5-turbo-vs-veo-3-1', 'kling-2-5-turbo', 'veo-3-1'],
  ['seedance-2-0-vs-veo-3-1-fast', 'seedance-2-0', 'veo-3-1-fast'],
  ['luma-ray-2-vs-seedance-2-0-fast', 'luma-ray-2', 'seedance-2-0-fast'],
  ['kling-2-5-turbo-vs-wan-2-6', 'kling-2-5-turbo', 'wan-2-6'],
] as const;

const LEGACY_COMPARISONS = [
  'veo-3-1-vs-wan-2-5',
  'kling-2-6-pro-vs-wan-2-5',
  'veo-3-1-fast-vs-wan-2-5',
  'luma-ray-2-vs-luma-ray-2-flash',
  'kling-2-5-turbo-vs-veo-3-1',
  'luma-ray-2-vs-seedance-2-0-fast',
  'kling-2-5-turbo-vs-wan-2-6',
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
  assert.ok(entry, `missing ${locale.toUpperCase()} wave-2 override for ${slug}`);
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertCompleteOverride(locale: Locale, slug: string): void {
  const entry = getEntry(locale, slug);
  const title = entry.meta?.title ?? '';
  const description = entry.meta?.description ?? '';

  assert.ok(title.length >= 35 && title.length <= 80, `${locale} title length for ${slug}: ${title.length}`);
  assert.ok(description.length >= 120 && description.length <= 180, `${locale} description length for ${slug}: ${description.length}`);
  assert.equal(entry.meta?.titleBranding, 'none', `${locale} should disable title branding for ${slug}`);
  assert.ok((entry.heroIntro?.length ?? 0) >= 140, `${locale} hero should frame the decision for ${slug}`);
  assert.ok((entry.quickVerdict?.body.length ?? 0) >= 120, `${locale} verdict should be substantive for ${slug}`);
  assert.equal(entry.topCards?.length, 4, `${locale} should have four decision cards for ${slug}`);
  assert.ok((entry.primaryLinks?.length ?? 0) >= 3, `${locale} should have three internal links for ${slug}`);
  assert.ok((entry.faq?.items.length ?? 0) >= 3, `${locale} should have three FAQ items for ${slug}`);
  assert.ok((entry.faq?.items.length ?? 0) <= 5, `${locale} should have at most five FAQ items for ${slug}`);

  const questions = (entry.faq?.items ?? []).map((item) => item.question);
  const hrefs = (entry.primaryLinks ?? []).map((link) => link.href);
  assert.equal(new Set(questions).size, questions.length, `${locale} FAQ questions should be unique for ${slug}`);
  assert.equal(new Set(hrefs).size, hrefs.length, `${locale} hrefs should be unique for ${slug}`);
  hrefs.forEach((href) => {
    assert.match(href, /^\/(models|ai-video-engines)\//, `${locale} unsupported href ${href}`);
    assert.doesNotMatch(href, /^\/(fr|es)\//, `${locale} href must stay locale-neutral: ${href}`);
  });
}

for (const locale of ['en', 'fr', 'es'] as const) {
  test(`${locale.toUpperCase()} wave-2 entries satisfy the editorial contract`, () => {
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
      const text = collectText(entry);
      assert.match(text, new RegExp(escapeRegExp(left.marketingName), 'i'));
      assert.match(text, new RegExp(escapeRegExp(right.marketingName), 'i'));

      const title = entry.meta?.title ?? '';
      const description = entry.meta?.description ?? '';
      assert.ok(!titles.has(title), `${locale} title should be unique: ${title}`);
      assert.ok(!descriptions.has(description), `${locale} description should be unique: ${description}`);
      titles.add(title);
      descriptions.add(description);
    });
  });
}

test('legacy comparisons explain the migration or stay decision in every locale', () => {
  const migrationLanguage = {
    en: /legacy|older|current|upgrade/i,
    fr: /historique|ancien|actuel|migr|évolu/i,
    es: /anterior|actual|migr|actualizar/i,
  } as const;

  for (const locale of ['en', 'fr', 'es'] as const) {
    LEGACY_COMPARISONS.forEach((slug) => {
      assert.match(collectText(getEntry(locale, slug)), migrationLanguage[locale], `${locale} migration framing for ${slug}`);
    });
  }
});

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

test('Spanish wave-2 copy stays LATAM-neutral', () => {
  const spainSpecificTerms = /\b(vídeo|vídeos|móvil|móviles|ordenador|ordenadores|monedero|monederos|vosotros)\b/i;
  TARGET_COMPARISONS.forEach(([slug]) => {
    assert.doesNotMatch(collectText(getEntry('es', slug)), spainSpecificTerms, `Spain-specific term in ${slug}`);
  });
});

test('wave-2 links resolve to public model and comparison routes', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    TARGET_COMPARISONS.forEach(([slug]) => {
      for (const link of getEntry(locale, slug).primaryLinks ?? []) {
        if (link.href.startsWith('/models/')) {
          const model = CATALOG_BY_SLUG.get(link.href.slice('/models/'.length));
          assert.ok(model, `missing model route ${link.href}`);
          assert.equal(model.surfaces.modelPage.indexable, true, `model route should be indexable: ${link.href}`);
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
