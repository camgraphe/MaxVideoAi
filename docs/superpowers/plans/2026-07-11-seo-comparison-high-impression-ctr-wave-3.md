# SEO Comparison High-Impression CTR Wave 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete localized SEO decision content for ten high-impression, low-CTR comparison pages in American English, French, and LATAM-neutral Spanish.

**Architecture:** Keep the comparison route, metadata builder, canonical/hreflang logic, schema builders, catalog, and publication rules unchanged. Add 30 static entries to the three established override maps and protect the wave with one focused contract that imports real catalog and publication data.

**Tech Stack:** TypeScript, Next.js App Router, Node test runner, `tsx`, static engine catalog JSON, existing `ComparePageOverride` maps.

## Global Constraints

- Work only in `codex/seo-comparison-high-impression-ctr-wave-3`, based on `main` at `e3d44407da9c6448358bd2e98eea3c8da816adf3`.
- Use the exact ten slugs, facts, availability rules, and internal links defined in `docs/superpowers/specs/2026-07-11-seo-comparison-high-impression-ctr-wave-3-design.md`.
- Write English copy in American English, French copy as a natural adaptation, and Spanish copy in LATAM-neutral Spanish.
- Spanish copy must use `video` without an accent and avoid `vídeo`, `móvil`, `ordenador`, `monedero`, and `vosotros`.
- Treat LTX Video 2.0 Pro, LTX Video 2.0 Fast, and Wan 2.5 as available earlier workflows. Never call or imply that they are unavailable, removed, abandoned, discontinued, or inaccessible.
- On each earlier-model comparison, state who can stay, who should migrate, and which current comparison supports the next decision.
- Keep titles at 30–65 characters, descriptions at 120–170 characters, hero introductions at 140 characters or more, verdict bodies at 120 characters or more, exactly four decision cards, at least three links, and three to five FAQ items.
- Do not invent quality percentages, speed multipliers, a universal Seedance price winner, or capabilities that combine incompatible modes.
- Keep every href canonical and locale-neutral. Every page must link to both exact model pages and the exact related comparison assigned in this plan.
- Do not change sitemap, robots, publication lists, canonicals, hreflang, JSON-LD architecture, pricing, scorecards, engine catalog, Studio, or workspace files.
- Add and verify the failing contract before adding any production override entry.

---

## File Map

**Create**

- `tests/comparison-high-impression-ctr-wave-3.test.ts` — completeness, uniqueness, localization, availability, migration, and canonical public-link contract.

**Modify**

- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts`
- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts`
- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts`

**Read-only sources**

- `docs/superpowers/specs/2026-07-11-seo-comparison-high-impression-ctr-wave-3-design.md`
- `frontend/config/engine-catalog.json`
- `frontend/lib/compare-hub/data.ts`
- `docs/seo/comparison-indexation-matrix-2026-07-08.json`
- `docs/seo/localization-notes.md`
- `tests/comparison-ctr-migration-wave-2.test.ts`
- `tests/compare-page-architecture.test.ts`

---

### Task 1: Add the failing wave-3 contract

**Files:**

- Create: `tests/comparison-high-impression-ctr-wave-3.test.ts`

**Interfaces:**

- Consumes: the three exported locale override maps, `engine-catalog.json`, `isPublishedComparisonSlug`, and `canonicalizePublishedCompareSlug`.
- Produces: ten target tuples, ten exact related links, seven earlier-model migration requirements, and seven executable contracts.

- [ ] **Step 1: Create the complete failing test**

Create `tests/comparison-high-impression-ctr-wave-3.test.ts` with this exact content:

```ts
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
```

- [ ] **Step 2: Run the contract and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-high-impression-ctr-wave-3.test.ts
```

Expected: seven tests execute and all seven fail because wave-3 overrides are absent. The first failure must include `missing EN wave-3 override for ltx-2-3-fast-vs-ltx-2-fast`.

- [ ] **Step 3: Confirm production maps remain untouched**

Run:

```bash
git status --short
git diff -- 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts'
```

Expected: only the new test is untracked; the three production maps have no diff.

- [ ] **Step 4: Commit the RED contract**

```bash
git add tests/comparison-high-impression-ctr-wave-3.test.ts
git commit -m "test: define high-impression comparison wave 3 contract"
```

---

### Task 2: Add the ten American-English overrides

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts`
- Test: `tests/comparison-high-impression-ctr-wave-3.test.ts`

**Interfaces:**

- Consumes: `ComparePageOverride`, `TARGET_COMPARISONS`, `REQUIRED_RELATED_LINKS`, catalog facts, and the approved design.
- Produces: ten complete entries in `EN_COMPARE_PAGE_OVERRIDES`.

- [ ] **Step 1: Add ten complete English entries**

Use `Quick verdict`, `Recommended next steps`, and `FAQ`. Use these exact titles and editorial decisions:

| Slug | Exact American-English title | Required verdict | Required related comparison |
| --- | --- | --- | --- |
| `ltx-2-3-fast-vs-ltx-2-fast` | `LTX 2.3 Fast vs LTX 2.0 Fast: Upgrade or Stay?` | Both remain available at the same listed tiers. Stay on 2.0 Fast for an established 16:9 workflow; choose 2.3 Fast for 9:16, start/end-frame control, and broader FPS choices. | `/ai-video-engines/ltx-2-3-fast-vs-ltx-2-3-pro` |
| `ltx-2-vs-ltx-2-3-fast` | `LTX 2.0 Pro vs LTX 2.3 Fast: Price, 4K & Upgrade` | Stay on 2.0 Pro for a familiar ten-second 16:9 route; choose 2.3 Fast for lower listed shared-resolution pricing, vertical delivery, and longer constrained clips. | `/ai-video-engines/ltx-2-vs-ltx-2-3-pro` |
| `ltx-2-vs-wan-2-6` | `LTX 2.0 Pro vs Wan 2.6: 4K, Duration & References` | Stay on LTX for high-resolution landscape delivery; choose Wan for broader ratios, longer text/image clips, or silent five/ten-second reference-video work. | `/ai-video-engines/ltx-2-3-fast-vs-wan-2-6` |
| `ltx-2-3-fast-vs-seedance-2-0` | `LTX 2.3 Fast vs Seedance 2.0: Price or Control?` | LTX for price-transparent high-resolution generation; Seedance for references, editing, extension, motion controls, or broad ratios. Do not declare a universal price winner. | `/ai-video-engines/ltx-2-3-pro-vs-seedance-2-0` |
| `ltx-2-3-pro-vs-ltx-2-fast` | `LTX 2.3 Pro vs LTX 2.0 Fast: Cost or Control?` | Stay on available 2.0 Fast for economical 16:9 work; choose current 2.3 Pro for 9:16, audio-to-video, extend, retake, and frame controls. | `/ai-video-engines/ltx-2-3-fast-vs-ltx-2-3-pro` |
| `seedance-2-0-vs-wan-2-5` | `Seedance 2.0 vs Wan 2.5: 4K, Audio & Upgrade` | Stay on available Wan 2.5 for simple fixed-price text/image clips; choose current Seedance for 4K, references, editing, extension, motion control, or fifteen seconds. | `/ai-video-engines/seedance-2-0-vs-wan-2-6` |
| `minimax-hailuo-02-text-vs-seedance-2-0` | `Hailuo 02 vs Seedance 2.0: Price, Audio & 4K` | Hailuo for inexpensive silent stylized clips at 512P/768P; Seedance for audio, 4K, references, editing, extension, or fifteen-second output. | `/ai-video-engines/minimax-hailuo-02-text-vs-wan-2-6` |
| `ltx-2-vs-ltx-2-3-pro` | `LTX 2.0 Pro vs LTX 2.3 Pro: Upgrade or Stay?` | Both remain available at the same listed tiers. Stay on 2.0 Pro for familiar 16:9 text/image work; choose 2.3 Pro for 9:16, longer clips, audio-to-video, extend, or retake. | `/ai-video-engines/ltx-2-3-fast-vs-ltx-2-3-pro` |
| `veo-3-1-vs-veo-3-1-lite` | `Veo 3.1 vs Veo 3.1 Lite: 4K, References & Price` | Lite for budget 720p/1080p drafts; standard Veo for reference-image mode or 4K. Both support audio, eight seconds, first/last frame, and extension. | `/ai-video-engines/veo-3-1-fast-vs-veo-3-1-lite` |
| `ltx-2-3-fast-vs-wan-2-5` | `LTX 2.3 Fast vs Wan 2.5: Price, 4K & Upgrade` | Stay on available Wan for existing simple or 1:1/lower-resolution work; choose current LTX for 4K, longer constrained clips, or lower listed 1080p price. | `/ai-video-engines/ltx-2-3-fast-vs-wan-2-6` |

For every entry, include unique metadata, a substantive hero, a direct verdict, exactly four cards, both model links, the required related comparison, and three pair-specific FAQs. Name both exact catalog marketing names in the combined copy. Keep all facts within the approved design; specifically separate Wan reference-video limits from text/image duration/audio, preserve the LTX long-duration restriction, and describe Seedance pricing as dynamic.

- [ ] **Step 2: Run the English contract and verify GREEN**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-name-pattern="EN wave-3" tests/comparison-high-impression-ctr-wave-3.test.ts
```

Expected: one English contract test passes with zero failures.

- [ ] **Step 3: Run shared comparison architecture tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/compare-page-architecture.test.ts
```

Expected: the current 17 comparison architecture tests pass.

- [ ] **Step 4: Commit English content**

```bash
git diff --check
git add 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts'
git commit -m "feat: enrich English high-impression comparisons wave 3"
```

---

### Task 3: Add ten natural-French adaptations

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts`
- Test: `tests/comparison-high-impression-ctr-wave-3.test.ts`

**Interfaces:**

- Consumes: the exact slugs, facts, hrefs, and approved English decisions from Task 2.
- Produces: ten complete entries in `FR_COMPARE_PAGE_OVERRIDES`.

- [ ] **Step 1: Add ten complete French adaptations**

Use `Verdict rapide`, `Prochaines étapes recommandées`, and `FAQ`. Use these exact metadata titles:

| Slug | Exact French title |
| --- | --- |
| `ltx-2-3-fast-vs-ltx-2-fast` | `LTX 2.3 Fast vs LTX 2.0 Fast : rester ou évoluer ?` |
| `ltx-2-vs-ltx-2-3-fast` | `LTX 2.0 Pro vs LTX 2.3 Fast : prix, 4K et évolution` |
| `ltx-2-vs-wan-2-6` | `LTX 2.0 Pro vs Wan 2.6 : 4K, durée et références` |
| `ltx-2-3-fast-vs-seedance-2-0` | `LTX 2.3 Fast vs Seedance 2.0 : prix ou contrôle ?` |
| `ltx-2-3-pro-vs-ltx-2-fast` | `LTX 2.3 Pro vs LTX 2.0 Fast : coût ou contrôle ?` |
| `seedance-2-0-vs-wan-2-5` | `Seedance 2.0 vs Wan 2.5 : 4K, audio et évolution` |
| `minimax-hailuo-02-text-vs-seedance-2-0` | `Hailuo 02 vs Seedance 2.0 : prix, audio et 4K` |
| `ltx-2-vs-ltx-2-3-pro` | `LTX 2.0 Pro vs LTX 2.3 Pro : rester ou évoluer ?` |
| `veo-3-1-vs-veo-3-1-lite` | `Veo 3.1 vs Veo 3.1 Lite : 4K, références et prix` |
| `ltx-2-3-fast-vs-wan-2-5` | `LTX 2.3 Fast vs Wan 2.5 : prix, 4K et évolution` |

Adapt intent instead of English sentence order. Preserve all exact hrefs and factual mode boundaries from Task 2. For the seven earlier-model pairs, use natural forms of `disponible`, `rester`, `évoluer` or `migrer`, and `actuel` or `plus récent`. Do not apply `historique` to the generated clips themselves. Include four unique cards and three pair-specific FAQs per page.

- [ ] **Step 2: Run the French and migration contracts**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-name-pattern="FR wave-3|availability, staying, and migration" tests/comparison-high-impression-ctr-wave-3.test.ts
```

Expected before Spanish exists: the French editorial contract passes; the shared migration test may still fail only on the first missing Spanish override. Record the French pass separately with:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-name-pattern="FR wave-3" tests/comparison-high-impression-ctr-wave-3.test.ts
```

Expected: one French contract test passes with zero failures.

- [ ] **Step 3: Run architecture tests and commit French content**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/compare-page-architecture.test.ts
git diff --check
git add 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts'
git commit -m "feat: enrich French high-impression comparisons wave 3"
```

Expected: 17 architecture tests pass before the commit is created.

---

### Task 4: Add ten LATAM-neutral Spanish adaptations

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts`
- Test: `tests/comparison-high-impression-ctr-wave-3.test.ts`

**Interfaces:**

- Consumes: the exact slugs, facts, hrefs, English decisions, and `docs/seo/localization-notes.md`.
- Produces: ten complete entries in `ES_COMPARE_PAGE_OVERRIDES`.

- [ ] **Step 1: Add ten complete LATAM-neutral Spanish adaptations**

Use `Veredicto rápido`, `Siguientes pasos recomendados`, and `Preguntas frecuentes`. Use these exact metadata titles:

| Slug | Exact LATAM Spanish title |
| --- | --- |
| `ltx-2-3-fast-vs-ltx-2-fast` | `LTX 2.3 Fast vs LTX 2.0 Fast: quedarse o migrar` |
| `ltx-2-vs-ltx-2-3-fast` | `LTX 2.0 Pro vs LTX 2.3 Fast: precio, 4K y migración` |
| `ltx-2-vs-wan-2-6` | `LTX 2.0 Pro vs Wan 2.6: 4K, duración y referencias` |
| `ltx-2-3-fast-vs-seedance-2-0` | `LTX 2.3 Fast vs Seedance 2.0: precio o control` |
| `ltx-2-3-pro-vs-ltx-2-fast` | `LTX 2.3 Pro vs LTX 2.0 Fast: costo o control` |
| `seedance-2-0-vs-wan-2-5` | `Seedance 2.0 vs Wan 2.5: 4K, audio y migración` |
| `minimax-hailuo-02-text-vs-seedance-2-0` | `Hailuo 02 vs Seedance 2.0: precio, audio y 4K` |
| `ltx-2-vs-ltx-2-3-pro` | `LTX 2.0 Pro vs LTX 2.3 Pro: quedarse o migrar` |
| `veo-3-1-vs-veo-3-1-lite` | `Veo 3.1 vs Veo 3.1 Lite: 4K, referencias y precio` |
| `ltx-2-3-fast-vs-wan-2-5` | `LTX 2.3 Fast vs Wan 2.5: precio, 4K y migración` |

Use LATAM-neutral phrasing throughout. Keep `video` unaccented. For the seven earlier-model pairs, state availability and use `quedarse`, `mantener`, `migrar`, or `actualizar` naturally. Preserve exact hrefs and every mode boundary from Task 2. Include four unique cards and three pair-specific FAQs per page.

- [ ] **Step 2: Run Spanish, localization, and full wave contracts**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-name-pattern="ES wave-3|LATAM-neutral|independently localized|availability, staying, and migration" tests/comparison-high-impression-ctr-wave-3.test.ts
```

Expected: four selected tests pass with zero failures.

Then run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-high-impression-ctr-wave-3.test.ts
```

Expected: all seven wave-3 tests pass.

- [ ] **Step 3: Run architecture tests and commit Spanish content**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/compare-page-architecture.test.ts
git diff --check
git add 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts'
git commit -m "feat: enrich LATAM high-impression comparisons wave 3"
```

Expected: 17 architecture tests pass before the commit is created.

---

### Task 5: Verify the complete wave

**Files:**

- Test: `tests/comparison-high-impression-ctr-wave-3.test.ts`
- Test: `tests/compare-page-architecture.test.ts`
- Verify: the three override maps and unchanged public SEO architecture.

**Interfaces:**

- Consumes: all 30 entries from Tasks 2–4.
- Produces: release evidence for content, links, localization, architecture, lint, full tests, build, localized rendering, and final scope.

- [ ] **Step 1: Run focused contracts**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-high-impression-ctr-wave-3.test.ts tests/compare-page-architecture.test.ts
```

Expected: 24 tests pass: seven wave-3 tests plus the current 17 comparison architecture tests.

- [ ] **Step 2: Run lint and branch-level whitespace checks**

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check origin/main...HEAD
```

Expected: all commands exit 0.

- [ ] **Step 3: Run the complete repository suite**

```bash
pnpm test:validate
```

Expected: all repository tests pass with zero failures. The baseline is 1,698 tests, so this branch should add seven tests if `main` remains otherwise unchanged. Restore only these generated historical files afterward if they change:

```bash
git restore --source=HEAD -- \
  docs/seo/comparison-indexation-matrix-2026-07-08.json \
  docs/seo/comparison-indexation-matrix-2026-07-08.md
```

- [ ] **Step 4: Build the frontend**

```bash
pnpm --prefix frontend run build
```

Expected: the Next.js production build exits 0 and generates every localized static route.

- [ ] **Step 5: Smoke-check the highest-impression target in three locales**

Start the production server:

```bash
pnpm --prefix frontend exec next start -p 3100
```

Request the same comparison in all locales while recording numeric status codes:

```bash
curl -LfsS -w '%{http_code}' http://localhost:3100/ai-video-engines/ltx-2-3-fast-vs-ltx-2-fast -o /tmp/maxvideo-wave3-en.html
curl -LfsS -w '%{http_code}' http://localhost:3100/fr/comparatif/ltx-2-3-fast-vs-ltx-2-fast -o /tmp/maxvideo-wave3-fr.html
curl -LfsS -w '%{http_code}' http://localhost:3100/es/comparativa/ltx-2-3-fast-vs-ltx-2-fast -o /tmp/maxvideo-wave3-es.html
```

Expected: each command prints `200`.

Verify localized content and SEO markup:

```bash
rg -n "LTX 2.3 Fast vs LTX 2.0 Fast|Quick verdict|Verdict rapide|Veredicto rápido|canonical|hrefLang|application/ld\\+json" /tmp/maxvideo-wave3-{en,fr,es}.html
```

Expected: each document contains localized metadata and verdict copy, a self-canonical, four hreflang links, and the existing JSON-LD scripts. Stop the server and confirm port 3100 is free.

- [ ] **Step 6: Review final scope**

```bash
git status --short --branch
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

Expected: only the design, implementation plan, focused wave-3 test, and the three locale override maps differ from `origin/main`. No historical GSC matrix, sitemap, robots, catalog, Studio, or workspace file differs.

---

## Completion Criteria

- Thirty complete localized overrides exist for the exact ten targets.
- All seven wave-3 tests and 17 comparison architecture tests pass.
- Every earlier model is described as available, with explicit stay and migrate guidance.
- Every page links to both exact models and its assigned canonical published comparison.
- EN, FR, and ES editorial blocks are independently localized and unique.
- Spanish stays LATAM-neutral and keeps `video` unaccented.
- Full lint, exposure, repository tests, production build, three-locale smoke tests, and branch-level whitespace checks pass.
- The final diff contains no sitemap, robots, publication, catalog, pricing, Studio, workspace, or historical audit change.
