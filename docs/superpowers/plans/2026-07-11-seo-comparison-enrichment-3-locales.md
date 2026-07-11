# Localized SEO Comparison Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete, fact-based SEO overrides for ten high-impression comparison pages in American English, French, and LATAM-neutral Spanish.

**Architecture:** Keep the comparison route and shared SEO builders unchanged. Add 30 static entries to the three existing route-local override maps and protect the editorial contract with one focused Node test file that imports the real maps, engine catalog, and comparison publication resolver.

**Tech Stack:** TypeScript, Next.js App Router, Node test runner, `tsx`, static engine catalog JSON, existing `ComparePageOverride` maps.

## Global Constraints

- Work only in `codex/seo-comparison-enrichment-3-locales`, based on `origin/main` at `9a72aedb4b2963d0d3b7ecdcb8ecbea8352264c3`.
- Write English copy in American English.
- Write Spanish copy in LATAM-neutral Spanish while retaining the generic `es` route and hreflang.
- In Spanish copy, use `video` without the Spain-specific accent and avoid `vídeo`, `móvil`, `ordenador`, `monedero`, and `vosotros`.
- Derive feature, duration, resolution, audio, pricing, and legacy claims from `frontend/config/engine-catalog.json`.
- Do not change sitemap, robots, publication lists, canonicals, hreflang, JSON-LD architecture, pricing, scorecards, or engine configuration.
- Do not touch unrelated Studio or workspace files.
- Use test-driven development: add the failing contract before adding any override entries.
- Keep internal hrefs canonical and unprefixed; the existing localized `Link` component adds locale routing.

---

## File Map

**Create**

- `tests/comparison-enrichment-locales.test.ts` — focused content, localization, route, and publication contract for this 30-entry wave.

**Modify**

- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts` — ten American-English overrides.
- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts` — ten French adaptations.
- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts` — ten LATAM-neutral Spanish adaptations.

**Read-only sources**

- `frontend/config/engine-catalog.json`
- `frontend/config/model-publication.ts`
- `frontend/lib/compare-hub/data.ts`
- `docs/seo/comparison-indexation-matrix-2026-07-08.json`
- `docs/seo/localization-notes.md`
- `tests/compare-page-architecture.test.ts`

---

### Task 1: Add the failing localized-enrichment contract

**Files:**

- Create: `tests/comparison-enrichment-locales.test.ts`

**Interfaces:**

- Consumes: `EN_COMPARE_PAGE_OVERRIDES`, `FR_COMPARE_PAGE_OVERRIDES`, `ES_COMPARE_PAGE_OVERRIDES`, `engine-catalog.json`, and `isPublishedComparisonSlug(slug: string): boolean`.
- Produces: `TARGET_COMPARISONS`, locale-specific structural tests, cross-locale localization checks, and internal-link publication checks.

- [ ] **Step 1: Create the focused contract test**

Create `tests/comparison-enrichment-locales.test.ts` with this complete content:

```ts
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
```

- [ ] **Step 2: Run the new test and confirm RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-enrichment-locales.test.ts
```

Expected: FAIL on the three locale contract tests with `missing EN override`, `missing FR override`, and `missing ES override` for the first target slug. This proves the test detects the missing 30-entry wave.

- [ ] **Step 3: Commit the failing contract**

```bash
git add tests/comparison-enrichment-locales.test.ts
git commit -m "test: define localized comparison enrichment contract"
```

---

### Task 2: Add the ten American-English overrides

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts`
- Test: `tests/comparison-enrichment-locales.test.ts`

**Interfaces:**

- Consumes: the existing `ComparePageOverride` object shape and Task 1 contract.
- Produces: ten complete entries in `EN_COMPARE_PAGE_OVERRIDES`, keyed by canonical slug.

- [ ] **Step 1: Add all ten English entries before the closing `satisfies ComparePageOverridesBySlug`**

Use this complete first entry as the field-shape reference:

```ts
'pika-text-to-video-vs-wan-2-6': {
  meta: {
    title: 'Pika 2.2 vs Wan 2.6: Price, Audio & Best Uses',
    description:
      'Compare Pika 2.2 and Wan 2.6 on price, clip length, audio, resolution, and reference workflows to choose the right AI video model.',
    titleBranding: 'none',
  },
  heroIntro:
    'Compare Pika 2.2 Text & Image to Video with Wan 2.6 Text & Image to Video when the real choice is a lower-cost short loop or a longer, audio-ready production workflow. Pika keeps simple prompt and image animation economical, while Wan adds 15-second output and reference-video control.',
  quickVerdict: {
    title: 'Quick verdict',
    body:
      'Choose Pika 2.2 for inexpensive 5- or 10-second silent loops, stylized tests, and straightforward image animation. Choose Wan 2.6 when the shot needs up to 15 seconds, native audio, or one to three reference videos, accepting the higher 720p and 1080p generation price.',
  },
  topCards: [
    {
      title: 'Choose Pika 2.2',
      body: 'Use Pika for lower-cost 720p tests, short silent loops, and simple text-to-video or image-to-video work.',
    },
    {
      title: 'Choose Wan 2.6',
      body: 'Use Wan for clips up to 15 seconds, optional audio, 1080p delivery, or a workflow guided by reference videos.',
    },
    {
      title: 'Key trade-off',
      body: 'Pika starts at $0.04 per second at 720p; Wan starts at $0.10 per second but adds duration, audio, and reference-video control.',
    },
    {
      title: 'Best workflows',
      body: 'Pika fits stylized social loops and concept tests. Wan fits longer general-purpose shots, narrated clips, and reference-led sequences.',
    },
  ],
  primaryLinksTitle: 'Recommended next steps',
  primaryLinks: [
    { href: '/models/pika-text-to-video', label: 'Open the Pika 2.2 model page' },
    { href: '/models/wan-2-6', label: 'Open the Wan 2.6 model page' },
    {
      href: '/ai-video-engines/minimax-hailuo-02-text-vs-pika-text-to-video',
      label: 'Compare Hailuo 02 vs Pika 2.2',
    },
  ],
  faq: {
    title: 'FAQ',
    subtitle: 'Short answers for choosing between Pika 2.2 and Wan 2.6.',
    items: [
      {
        question: 'Is Pika 2.2 or Wan 2.6 better for low-cost video tests?',
        answer:
          'Pika 2.2 is the lower-cost choice at 720p and works well for short silent loops. Wan 2.6 costs more but is justified when a test needs audio, longer duration, or reference videos.',
      },
      {
        question: 'What can Wan 2.6 do that Pika 2.2 cannot?',
        answer:
          'Wan 2.6 supports clips up to 15 seconds, optional audio, and a reference-to-video workflow with one to three video references. Pika 2.2 is limited to text-to-video and image-to-video without audio.',
      },
      {
        question: 'Which model should I use for a polished 1080p clip?',
        answer:
          'Both offer 1080p. Choose Pika for a straightforward silent shot at a lower price, or Wan when the final clip benefits from native audio, extra duration, or reference-video guidance.',
      },
    ],
  },
},
```

Use the following exact content decisions and links; do not add claims outside the listed catalog facts:

| Slug | Metadata title | Decision facts | Internal links |
| --- | --- | --- | --- |
| `pika-text-to-video-vs-wan-2-6` | `Pika 2.2 vs Wan 2.6: Price, Audio & Best Uses` | Pika: 5–10s, 720p/1080p, silent, $0.04/s at 720p. Wan: up to 15s, 720p/1080p, audio, reference-video mode, $0.10/s at 720p. Position Pika for inexpensive loops and Wan for longer, audio/reference workflows. | Both model pages; `minimax-hailuo-02-text-vs-pika-text-to-video`. |
| `kling-2-6-pro-vs-kling-3-pro` | `Kling 2.6 Pro vs Kling 3 Pro: Is It Worth Upgrading?` | Kling 2.6 Pro is legacy, 10s max, 1080p, audio, $0.14/s audio on. Kling 3 Pro is current, 15s max, 1080p, audio, positioned for multi-shot control, $0.168/s audio on. | Both model pages; `kling-3-pro-vs-kling-3-standard`. |
| `ltx-2-3-fast-vs-luma-ray-2` | `LTX 2.3 Fast vs Luma Ray 2: Speed, 4K & Editing` | LTX: up to 20s, audio, 1080p/1440p/4K, fast generation. Luma Ray 2: legacy, up to 9s, silent, 540p–1080p, video-to-video and reframe. | Both model pages; `ltx-2-3-fast-vs-veo-3-1-fast`. |
| `kling-2-6-pro-vs-minimax-hailuo-02-text` | `Kling 2.6 Pro vs Hailuo 02: Quality, Audio & Price` | Kling: 1080p and native audio for cinematic dialogue. Hailuo: 512P/768P, silent, $0.045/s and suited to stylized motion. | Both model pages; `kling-2-6-pro-vs-wan-2-6`. |
| `kling-3-standard-vs-kling-o3-standard` | `Kling 3 Standard vs Omni Standard: Which to Choose?` | Both: 15s, 1080p, audio, same catalog base price. Kling 3 Standard: streamlined text/start-image tests. Omni Standard: adds reference-to-video and video-to-video. | Both model pages; `kling-3-pro-vs-kling-3-standard`. |
| `seedance-2-0-fast-vs-veo-3-1` | `Seedance 2.0 Fast vs Veo 3.1: Drafts or Final 4K?` | Seedance Fast: 15s, 480p/720p, text/image/reference/video-edit/extend, audio. Veo: 8s, 720p/1080p/4K, text/image/reference/first-last/extend, audio, polished ads/B-roll positioning. | Both model pages; `seedance-2-0-fast-vs-veo-3-1-fast`. |
| `ltx-2-fast-vs-minimax-hailuo-02-text` | `LTX 2 Fast vs Hailuo 02: Resolution, Audio & Uses` | LTX 2 Fast: legacy, landscape-only, up to 20s, audio, 1080p/1440p/4K. Hailuo: up to 10s, silent, 512P/768P, adds vertical and square formats, stylized motion. | Both model pages; `ltx-2-3-fast-vs-ltx-2-fast`. |
| `minimax-hailuo-02-text-vs-veo-3-1-fast` | `Hailuo 02 vs Veo 3.1 Fast: Price, Audio & 4K` | Hailuo: $0.045/s, silent, 512P/768P, stylized work. Veo Fast: 720p/1080p/4K, audio, references, first/last frame and extend, starting at $0.10/s with audio. | Both model pages; `seedance-2-0-fast-vs-veo-3-1-fast`. |
| `kling-3-4k-vs-seedance-2-0` | `Kling 3 4K vs Seedance 2.0: Final 4K or Control?` | Kling 3 4K: native-4K-only, 3–15s, text/image, audio, dedicated final renders. Seedance: 480p through 4K, 4–15s, references, video edit, extend, motion controls, audio. Do not claim which costs less because Seedance uses token pricing. | Both model pages; `kling-3-4k-vs-veo-3-1`. |
| `minimax-hailuo-02-text-vs-wan-2-6` | `Hailuo 02 vs Wan 2.6: Price, Audio & Best Uses` | Hailuo: $0.045/s, 10s, 512P/768P, silent, stylized. Wan: $0.10/s at 720p, 15s, 720p/1080p, audio, reference-video, general purpose. | Both model pages; `veo-3-1-vs-wan-2-6`. |

Write a distinct 120–180 character description and three pair-specific FAQ items for every row. The description must summarize the listed decision facts; FAQs must cover workflow choice, the main capability difference, and when the more expensive or specialized route is justified.

- [ ] **Step 2: Run the English contract and confirm GREEN**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-name-pattern="EN comparison" tests/comparison-enrichment-locales.test.ts
```

Expected: the EN contract passes. FR and ES are excluded by the name filter.

- [ ] **Step 3: Check formatting and commit English content**

```bash
git diff --check
git add 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts'
git commit -m "feat: enrich English high-impression comparisons"
```

---

### Task 3: Add the ten natural-French overrides

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts`
- Test: `tests/comparison-enrichment-locales.test.ts`

**Interfaces:**

- Consumes: the same canonical slugs, factual matrix, and canonical hrefs from Task 2.
- Produces: ten complete entries in `FR_COMPARE_PAGE_OVERRIDES` with native French editorial phrasing.

- [ ] **Step 1: Add all ten French entries using the complete override shape from Task 2**

Use `Verdict rapide` for every quick-verdict title, `Prochaines étapes recommandées` for every primary-link section title, `FAQ` for the FAQ title, and a pair-specific French subtitle rather than an English fallback.

Use these exact French metadata titles and the same factual distinctions and hrefs as Task 2:

| Slug | French metadata title |
| --- | --- |
| `pika-text-to-video-vs-wan-2-6` | `Pika 2.2 vs Wan 2.6 : prix, audio et usages` |
| `kling-2-6-pro-vs-kling-3-pro` | `Kling 2.6 Pro vs Kling 3 Pro : faut-il évoluer ?` |
| `ltx-2-3-fast-vs-luma-ray-2` | `LTX 2.3 Fast vs Luma Ray 2 : vitesse, 4K et montage` |
| `kling-2-6-pro-vs-minimax-hailuo-02-text` | `Kling 2.6 Pro vs Hailuo 02 : qualité, audio et prix` |
| `kling-3-standard-vs-kling-o3-standard` | `Kling 3 Standard vs Omni Standard : lequel choisir ?` |
| `seedance-2-0-fast-vs-veo-3-1` | `Seedance 2.0 Fast vs Veo 3.1 : brouillon ou 4K ?` |
| `ltx-2-fast-vs-minimax-hailuo-02-text` | `LTX 2 Fast vs Hailuo 02 : résolution, audio et usages` |
| `minimax-hailuo-02-text-vs-veo-3-1-fast` | `Hailuo 02 vs Veo 3.1 Fast : prix, audio et 4K` |
| `kling-3-4k-vs-seedance-2-0` | `Kling 3 4K vs Seedance 2.0 : 4K finale ou contrôle ?` |
| `minimax-hailuo-02-text-vs-wan-2-6` | `Hailuo 02 vs Wan 2.6 : prix, audio et usages` |

For each row:

- translate meaning rather than English sentence order;
- keep the official catalog marketing names visible in the combined page copy;
- use four decision-card titles such as `Choisir …`, `Choisir …`, `Différence clé`, and `Usages recommandés`;
- localize every anchor label while preserving the canonical hrefs exactly;
- write a unique 120–180 character meta description and three pair-specific FAQ items.

- [ ] **Step 2: Run the French contract and confirm GREEN**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-name-pattern="FR comparison" tests/comparison-enrichment-locales.test.ts
```

Expected: the FR contract passes.

- [ ] **Step 3: Check formatting and commit French content**

```bash
git diff --check
git add 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts'
git commit -m "feat: enrich French high-impression comparisons"
```

---

### Task 4: Add the ten LATAM-neutral Spanish overrides

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts`
- Test: `tests/comparison-enrichment-locales.test.ts`

**Interfaces:**

- Consumes: the same canonical slugs, factual matrix, and canonical hrefs from Task 2 plus LATAM vocabulary rules from `docs/seo/localization-notes.md`.
- Produces: ten complete entries in `ES_COMPARE_PAGE_OVERRIDES` without Spain-specific vocabulary.

- [ ] **Step 1: Add all ten Spanish entries using the complete override shape from Task 2**

Use `Veredicto rápido` for every quick-verdict title, `Siguientes pasos recomendados` for every primary-link section title, `Preguntas frecuentes` for the FAQ title, and a pair-specific LATAM Spanish subtitle rather than an English fallback.

Use these exact Spanish metadata titles and the same factual distinctions and hrefs as Task 2:

| Slug | LATAM Spanish metadata title |
| --- | --- |
| `pika-text-to-video-vs-wan-2-6` | `Pika 2.2 vs Wan 2.6: precio, audio y mejores usos` |
| `kling-2-6-pro-vs-kling-3-pro` | `Kling 2.6 Pro vs Kling 3 Pro: ¿conviene actualizar?` |
| `ltx-2-3-fast-vs-luma-ray-2` | `LTX 2.3 Fast vs Luma Ray 2: velocidad, 4K y edición` |
| `kling-2-6-pro-vs-minimax-hailuo-02-text` | `Kling 2.6 Pro vs Hailuo 02: calidad, audio y precio` |
| `kling-3-standard-vs-kling-o3-standard` | `Kling 3 Standard vs Omni Standard: ¿cuál elegir?` |
| `seedance-2-0-fast-vs-veo-3-1` | `Seedance 2.0 Fast vs Veo 3.1: borradores o 4K final` |
| `ltx-2-fast-vs-minimax-hailuo-02-text` | `LTX 2 Fast vs Hailuo 02: resolución, audio y usos` |
| `minimax-hailuo-02-text-vs-veo-3-1-fast` | `Hailuo 02 vs Veo 3.1 Fast: precio, audio y 4K` |
| `kling-3-4k-vs-seedance-2-0` | `Kling 3 4K vs Seedance 2.0: 4K final o más control` |
| `minimax-hailuo-02-text-vs-wan-2-6` | `Hailuo 02 vs Wan 2.6: precio, audio y mejores usos` |

For each row:

- use `video`, `celular`, `billetera`, and `ustedes` only where those concepts are needed;
- never use `vídeo`, `móvil`, `ordenador`, `monedero`, or `vosotros`;
- keep the official catalog marketing names visible in the combined page copy;
- use four card titles such as `Elige …`, `Elige …`, `Diferencia clave`, and `Mejores flujos`;
- localize anchor labels but preserve canonical hrefs exactly;
- write a unique 120–180 character meta description and three pair-specific FAQ items.

- [ ] **Step 2: Run the Spanish and localization contracts and confirm GREEN**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-name-pattern="ES comparison|LATAM-neutral|localized instead" tests/comparison-enrichment-locales.test.ts
```

Expected: ES structure, cross-locale differentiation, and LATAM vocabulary tests pass.

- [ ] **Step 3: Check formatting and commit Spanish content**

```bash
git diff --check
git add 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts'
git commit -m "feat: enrich LATAM Spanish comparisons"
```

---

### Task 5: Verify public SEO behavior and repository quality

**Files:**

- Test: `tests/comparison-enrichment-locales.test.ts`
- Test: `tests/compare-page-architecture.test.ts`
- Verify: the three override maps and existing SEO route architecture.

**Interfaces:**

- Consumes: all 30 localized entries from Tasks 2–4.
- Produces: evidence that content contracts, public links, route architecture, lint, and exposure checks remain green.

- [ ] **Step 1: Run the complete focused enrichment contract**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-enrichment-locales.test.ts
```

Expected: 6 tests pass: EN contract, FR contract, ES contract, cross-locale localization, LATAM vocabulary, and public links.

- [ ] **Step 2: Run the existing comparison architecture contract**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/compare-page-architecture.test.ts
```

Expected: all comparison architecture tests pass with no canonical, override, schema, or route-boundary regression.

- [ ] **Step 3: Run the standard repository checks**

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected: all commands exit 0; no lint errors, public-exposure violations, or whitespace errors.

- [ ] **Step 4: Run the full validation suite**

```bash
pnpm test:validate
```

Expected: the full TypeScript test suite passes.

- [ ] **Step 5: Build the frontend**

```bash
pnpm --prefix frontend run build
```

Expected: the Next.js production build exits 0 and emits all existing localized comparison routes without metadata or type errors.

- [ ] **Step 6: Smoke-check one enriched comparison in every locale**

Start the production server in an interactive terminal:

```bash
pnpm --prefix frontend run start -- -p 3100
```

From a second terminal, request the English, French, and Spanish versions of the same target pair:

```bash
curl -fsS http://localhost:3100/ai-video-engines/pika-text-to-video-vs-wan-2-6 -o /tmp/maxvideo-compare-en.html
curl -fsS http://localhost:3100/fr/comparatif/pika-text-to-video-vs-wan-2-6 -o /tmp/maxvideo-compare-fr.html
curl -fsS http://localhost:3100/es/comparativa/pika-text-to-video-vs-wan-2-6 -o /tmp/maxvideo-compare-es.html
rg -n "Pika 2.2 vs Wan 2.6|canonical|hreflang|application/ld\\+json|Quick verdict|Verdict rapide|Veredicto rápido" /tmp/maxvideo-compare-{en,fr,es}.html
```

Expected: all three requests return 200; each HTML file contains its localized metadata and verdict, canonical and hreflang tags, and the existing JSON-LD script.

- [ ] **Step 7: Review the final diff and commit any test-only correction**

```bash
git status --short
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- tests/comparison-enrichment-locales.test.ts \
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts'
```

Expected: only the design, plan, focused test, and three override maps differ from `origin/main`; no sitemap, robots, engine catalog, publication, Studio, or workspace files appear.

If Task 5 required a correction to the focused test, commit only that correction:

```bash
git add tests/comparison-enrichment-locales.test.ts
git commit -m "test: finalize comparison enrichment coverage"
```

If no correction was required, do not create an empty commit.
