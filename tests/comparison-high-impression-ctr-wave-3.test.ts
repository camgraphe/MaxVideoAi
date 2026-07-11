import assert from 'node:assert/strict';
import test from 'node:test';

import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import { EN_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts';
import { ES_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts';
import { FR_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts';
import type { ComparePageOverride } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-types.ts';
import {
  canonicalizePublishedCompareSlug,
  isPublishedComparisonSlug,
} from '../frontend/lib/compare-hub/data.ts';

const TARGET_COMPARISONS = [
  ['ltx-2-3-fast-vs-ltx-2-fast', 'ltx-2-3-fast', 'ltx-2-fast'],
  ['ltx-2-vs-ltx-2-3-fast', 'ltx-2', 'ltx-2-3-fast'],
  ['ltx-2-vs-wan-2-6', 'ltx-2', 'wan-2-6'],
  ['ltx-2-3-fast-vs-seedance-2-0', 'ltx-2-3-fast', 'seedance-2-0'],
  ['ltx-2-3-pro-vs-ltx-2-fast', 'ltx-2-3-pro', 'ltx-2-fast'],
  ['seedance-2-0-vs-wan-2-5', 'seedance-2-0', 'wan-2-5'],
  ['minimax-hailuo-02-text-vs-seedance-2-0', 'minimax-hailuo-02-text', 'seedance-2-0'],
  ['ltx-2-vs-ltx-2-3-pro', 'ltx-2', 'ltx-2-3-pro'],
  ['veo-3-1-vs-veo-3-1-lite', 'veo-3-1', 'veo-3-1-lite'],
  ['ltx-2-3-fast-vs-wan-2-5', 'ltx-2-3-fast', 'wan-2-5'],
] as const;

const REQUIRED_RELATED_LINKS = {
  'ltx-2-3-fast-vs-ltx-2-fast': '/ai-video-engines/ltx-2-3-fast-vs-ltx-2-3-pro',
  'ltx-2-vs-ltx-2-3-fast': '/ai-video-engines/ltx-2-vs-ltx-2-3-pro',
  'ltx-2-vs-wan-2-6': '/ai-video-engines/ltx-2-3-fast-vs-wan-2-6',
  'ltx-2-3-fast-vs-seedance-2-0': '/ai-video-engines/ltx-2-3-pro-vs-seedance-2-0',
  'ltx-2-3-pro-vs-ltx-2-fast': '/ai-video-engines/ltx-2-3-fast-vs-ltx-2-3-pro',
  'seedance-2-0-vs-wan-2-5': '/ai-video-engines/seedance-2-0-vs-wan-2-6',
  'minimax-hailuo-02-text-vs-seedance-2-0': '/ai-video-engines/minimax-hailuo-02-text-vs-wan-2-6',
  'ltx-2-vs-ltx-2-3-pro': '/ai-video-engines/ltx-2-3-fast-vs-ltx-2-3-pro',
  'veo-3-1-vs-veo-3-1-lite': '/ai-video-engines/veo-3-1-fast-vs-veo-3-1-lite',
  'ltx-2-3-fast-vs-wan-2-5': '/ai-video-engines/ltx-2-3-fast-vs-wan-2-6',
} as const;

const EARLIER_MODEL_RELATED_LINKS = {
  'ltx-2-3-fast-vs-ltx-2-fast': REQUIRED_RELATED_LINKS['ltx-2-3-fast-vs-ltx-2-fast'],
  'ltx-2-vs-ltx-2-3-fast': REQUIRED_RELATED_LINKS['ltx-2-vs-ltx-2-3-fast'],
  'ltx-2-vs-wan-2-6': REQUIRED_RELATED_LINKS['ltx-2-vs-wan-2-6'],
  'ltx-2-3-pro-vs-ltx-2-fast': REQUIRED_RELATED_LINKS['ltx-2-3-pro-vs-ltx-2-fast'],
  'seedance-2-0-vs-wan-2-5': REQUIRED_RELATED_LINKS['seedance-2-0-vs-wan-2-5'],
  'ltx-2-vs-ltx-2-3-pro': REQUIRED_RELATED_LINKS['ltx-2-vs-ltx-2-3-pro'],
  'ltx-2-3-fast-vs-wan-2-5': REQUIRED_RELATED_LINKS['ltx-2-3-fast-vs-wan-2-5'],
} as const;

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
  assert.ok(entry, `missing ${locale.toUpperCase()} wave-3 override for ${slug}`);
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

function assertUniqueCopy(
  seen: Map<string, string>,
  value: string | undefined,
  locale: Locale,
  field: string,
  slug: string,
): void {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  assert.ok(normalized, `${locale} ${field} should not be empty for ${slug}`);
  const duplicateSlug = seen.get(normalized);
  assert.equal(duplicateSlug, undefined, `${locale} ${field} for ${slug} duplicates ${duplicateSlug}`);
  seen.set(normalized, slug);
}

function normalizeLocalizedValue(value: string | readonly string[] | undefined): string {
  const parts = typeof value === 'string' ? [value] : (value ?? []);
  return parts
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertLocalizedField(
  entries: Record<Locale, ComparePageOverride>,
  slug: string,
  field: string,
  select: (entry: ComparePageOverride) => string | readonly string[] | undefined,
): void {
  const localePairs = [
    ['en', 'fr'],
    ['en', 'es'],
    ['fr', 'es'],
  ] as const;

  localePairs.forEach(([leftLocale, rightLocale]) => {
    assert.notEqual(
      normalizeLocalizedValue(select(entries[leftLocale])),
      normalizeLocalizedValue(select(entries[rightLocale])),
      `${leftLocale.toUpperCase()}/${rightLocale.toUpperCase()} ${field} should be localized for ${slug}`,
    );
  });
}

function assertCompleteOverride(locale: Locale, slug: string): void {
  const entry = getEntry(locale, slug);
  const title = entry.meta?.title ?? '';
  const description = entry.meta?.description ?? '';

  assert.ok(title.length >= 30 && title.length <= 65, `${locale} title length for ${slug}: ${title.length}`);
  assert.ok(description.length >= 120 && description.length <= 170, `${locale} description length for ${slug}: ${description.length}`);
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
  test(`${locale.toUpperCase()} wave-3 entries satisfy the editorial contract`, () => {
    const uniqueCopy = {
      titles: new Map<string, string>(),
      descriptions: new Map<string, string>(),
      heroIntros: new Map<string, string>(),
      verdicts: new Map<string, string>(),
      cards: new Map<string, string>(),
      faqItems: new Map<string, string>(),
    };

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

      assertUniqueCopy(uniqueCopy.titles, entry.meta?.title, locale, 'title', slug);
      assertUniqueCopy(uniqueCopy.descriptions, entry.meta?.description, locale, 'description', slug);
      assertUniqueCopy(uniqueCopy.heroIntros, entry.heroIntro, locale, 'hero intro', slug);
      assertUniqueCopy(uniqueCopy.verdicts, entry.quickVerdict?.body, locale, 'verdict', slug);
      (entry.topCards ?? []).forEach((card, index) => {
        assertUniqueCopy(uniqueCopy.cards, `${card.title}\n${card.body}`, locale, `card ${index + 1}`, slug);
      });
      (entry.faq?.items ?? []).forEach((item, index) => {
        const answers = Array.isArray(item.answer) ? item.answer : [item.answer];
        assertUniqueCopy(
          uniqueCopy.faqItems,
          `${item.question}\n${answers.join('\n')}`,
          locale,
          `FAQ item ${index + 1}`,
          slug,
        );
      });
    });
  });
}

test('earlier-model comparisons explain availability, staying, and migration in every locale', () => {
  const migrationLanguage = {
    en: {
      available: /\b(available|accessible)\b/i,
      stay: /\b(stay|keep|remain|continue|stick)\b/i,
      migrate: /\b(migrate|upgrade|move|switch)\b/i,
      successor: /\b(current|successor|newer|latest)\b/i,
      unavailable: /\b(unavailable|removed|retired|abandoned|discontinued|deprecated|withdrawn|decommissioned|sunset(?:ted)?)\b|(?:not|no longer|isn['’]t|aren['’]t) (?:available|accessible)/i,
    },
    fr: {
      available: /\b(disponibles?|accessibles?)\b/i,
      stay: /\b(rester|restez|conserver|gardez|continuer)\b/i,
      migrate: /(?<![\p{L}\p{N}_])(?:migrer|migrez|évoluer|évoluez|passer)(?![\p{L}\p{N}_])/iu,
      successor: /\b(actuel(?:le)?s?|successeurs?|plus récent(?:e)?s?|nouvelle génération)\b/i,
      unavailable: /(?<![\p{L}\p{N}_])(?:indisponibles?|retir(?:é|ée|és|ées)|abandonn(?:é|ée|és|ées)|arrêt(?:é|ée|és|ées)|discontinu(?:é|ée|és|ées)|supprim(?:é|ée|és|ées)|obsolètes?|(?:pas|plus) (?:disponibles?|accessibles?))(?![\p{L}\p{N}_])/iu,
    },
    es: {
      available: /\b(disponibles?|accesibles?)\b/i,
      stay: /\b(quedarse|mantener|seguir|conservar)\b/i,
      migrate: /\b(migrar|actualizar|pasar|cambiar)\b/i,
      successor: /\b(actual(?:es)?|sucesor(?:es)?|más reciente|nueva generación)\b/i,
      unavailable: /(?<![\p{L}\p{N}_])(?:indisponibles?|retirad[oa]s?|abandonad[oa]s?|descontinuad[oa]s?|discontinuad[oa]s?|eliminad[oa]s?|(?:no|ya no) (?:está |están |es |sigue )?(?:disponibles?|accesibles?))(?![\p{L}\p{N}_])/iu,
    },
  } as const;

  for (const locale of ['en', 'fr', 'es'] as const) {
    for (const [slug, successorHref] of Object.entries(EARLIER_MODEL_RELATED_LINKS)) {
      const entry = getEntry(locale, slug);
      const text = collectText(entry);
      const language = migrationLanguage[locale];
      assert.match(text, language.available, `${locale} should say the earlier model remains available for ${slug}`);
      assert.match(text, language.stay, `${locale} should explain who can stay on the earlier model for ${slug}`);
      assert.match(text, language.migrate, `${locale} should explain who should migrate for ${slug}`);
      assert.match(text, language.successor, `${locale} should identify the current successor for ${slug}`);
      assert.doesNotMatch(text, language.unavailable, `${locale} must not claim an available model is unavailable for ${slug}`);
      assert.ok(
        entry.primaryLinks?.some((link) => link.href === successorHref),
        `${locale} should link to current comparison ${successorHref} for ${slug}`,
      );
    }
  }
});

test('English, French, and LATAM Spanish wave-3 blocks are independently localized', () => {
  TARGET_COMPARISONS.forEach(([slug]) => {
    const entries = {
      en: getEntry('en', slug),
      fr: getEntry('fr', slug),
      es: getEntry('es', slug),
    };

    assertLocalizedField(entries, slug, 'meta.title', (entry) => entry.meta?.title);
    assertLocalizedField(entries, slug, 'meta.description', (entry) => entry.meta?.description);
    assertLocalizedField(entries, slug, 'heroIntro', (entry) => entry.heroIntro);
    assertLocalizedField(entries, slug, 'quickVerdict.body', (entry) => entry.quickVerdict?.body);

    const cardCount = Math.max(...Object.values(entries).map((entry) => entry.topCards?.length ?? 0));
    for (let index = 0; index < cardCount; index += 1) {
      assertLocalizedField(entries, slug, `topCards[${index}].title+body`, (entry) => {
        const card = entry.topCards?.[index];
        return card ? [card.title, card.body] : undefined;
      });
    }

    const faqCount = Math.max(...Object.values(entries).map((entry) => entry.faq?.items.length ?? 0));
    for (let index = 0; index < faqCount; index += 1) {
      assertLocalizedField(entries, slug, `faq.items[${index}].question+answer`, (entry) => {
        const item = entry.faq?.items[index];
        if (!item) return undefined;
        const answers = Array.isArray(item.answer) ? item.answer : [item.answer];
        return [item.question, ...answers];
      });
    }
  });
});

test('Spanish wave-3 copy stays LATAM-neutral', () => {
  const spainSpecificTerms = /\b(vídeo|vídeos|móvil|móviles|ordenador|ordenadores|monedero|monederos|vosotros)\b/i;
  TARGET_COMPARISONS.forEach(([slug]) => {
    assert.doesNotMatch(collectText(getEntry('es', slug)), spainSpecificTerms, `Spain-specific term in ${slug}`);
  });
});

test('wave-3 links resolve to exact public model and comparison routes', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    TARGET_COMPARISONS.forEach(([slug, leftSlug, rightSlug]) => {
      const links = getEntry(locale, slug).primaryLinks ?? [];
      const hrefs = links.map((link) => link.href);
      assert.ok(hrefs.includes(`/models/${leftSlug}`), `${locale} should link left model for ${slug}`);
      assert.ok(hrefs.includes(`/models/${rightSlug}`), `${locale} should link right model for ${slug}`);
      assert.ok(
        hrefs.includes(REQUIRED_RELATED_LINKS[slug]),
        `${locale} should link required comparison ${REQUIRED_RELATED_LINKS[slug]} for ${slug}`,
      );

      for (const link of links) {
        if (link.href.startsWith('/models/')) {
          const model = CATALOG_BY_SLUG.get(link.href.slice('/models/'.length));
          assert.ok(model, `missing model route ${link.href}`);
          assert.equal(model.surfaces.modelPage.indexable, true, `model route should be indexable: ${link.href}`);
        }
        if (link.href.startsWith('/ai-video-engines/')) {
          const comparisonSlug = link.href.slice('/ai-video-engines/'.length);
          assert.equal(
            canonicalizePublishedCompareSlug(comparisonSlug),
            comparisonSlug,
            `comparison href should use its exact canonical slug: ${link.href}`,
          );
          assert.ok(isPublishedComparisonSlug(comparisonSlug), `comparison route should be published: ${link.href}`);
        }
      }
    });
  }
});
