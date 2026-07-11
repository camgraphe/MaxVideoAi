# SEO Comparison CTR + Migration Wave 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete localized SEO decision content for the next ten high-impression, zero-click comparison pages in American English, French, and LATAM-neutral Spanish.

**Architecture:** Keep the existing comparison route, metadata builder, canonical/hreflang logic, schema builders, and publication rules unchanged. Add 30 static entries to the three established override maps and protect the wave with one focused contract that imports real catalog and publication data.

**Tech Stack:** TypeScript, Next.js App Router, Node test runner, `tsx`, static engine catalog JSON, existing `ComparePageOverride` maps.

## Global Constraints

- Work only in `codex/seo-comparison-ctr-migration-wave-2`, based on `origin/main` at `6b7cf74538f0883731c029065a5d9aff658383a8`.
- Write English copy in American English, French copy as a natural adaptation, and Spanish copy in LATAM-neutral Spanish.
- Spanish copy must use `video` without an accent and avoid `vídeo`, `móvil`, `ordenador`, `monedero`, and `vosotros`.
- Use the exact ten slugs and pair facts defined in `docs/superpowers/specs/2026-07-11-seo-comparison-ctr-migration-wave-2-design.md`.
- Describe catalog-marked legacy models as legacy or older routes without claiming they are unavailable or discontinued.
- Do not invent Luma prices, generation-speed percentages, non-rendered quality scores, or a universal Seedance-versus-Veo price winner.
- Do not change sitemap, robots, publication lists, canonicals, hreflang, JSON-LD architecture, pricing, scorecards, engine configuration, Studio, or workspace files.
- Add the failing contract before adding production override entries.
- Keep every internal href canonical and locale-neutral.

---

## File Map

**Create**

- `tests/comparison-ctr-migration-wave-2.test.ts` — structural, localization, migration-language, and public-link contract.

**Modify**

- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts`
- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts`
- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts`

**Read-only sources**

- `frontend/config/engine-catalog.json`
- `frontend/lib/compare-hub/data.ts`
- `docs/seo/comparison-indexation-matrix-2026-07-08.json`
- `docs/seo/localization-notes.md`
- `tests/comparison-enrichment-locales.test.ts`
- `tests/compare-page-architecture.test.ts`

---

### Task 1: Add the failing wave-2 contract

**Files:**

- Create: `tests/comparison-ctr-migration-wave-2.test.ts`

**Interfaces:**

- Consumes: the three exported locale override maps, `engine-catalog.json`, and `isPublishedComparisonSlug`.
- Produces: target constants and six executable contracts for content completeness, localization, migration framing, vocabulary, and link validity.

- [ ] **Step 1: Create the test file**

Create `tests/comparison-ctr-migration-wave-2.test.ts` with this complete content:

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
```

- [ ] **Step 2: Run the new test and confirm RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-ctr-migration-wave-2.test.ts
```

Expected: 7 tests fail on missing wave-2 overrides, beginning with `missing EN wave-2 override for ltx-2-3-fast-vs-sora-2-pro`.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/comparison-ctr-migration-wave-2.test.ts
git commit -m "test: define comparison migration wave 2 contract"
```

---

### Task 2: Add the ten American-English overrides

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts`
- Test: `tests/comparison-ctr-migration-wave-2.test.ts`

**Interfaces:**

- Consumes: `ComparePageOverride`, the catalog facts in the design spec, and Task 1 tests.
- Produces: ten complete entries in `EN_COMPARE_PAGE_OVERRIDES`.

- [ ] **Step 1: Add ten entries with the complete override contract**

Use these exact metadata titles, decision facts, and third links:

| Slug | English title | Required decision | Third link |
| --- | --- | --- | --- |
| `ltx-2-3-fast-vs-sora-2-pro` | `LTX 2.3 Fast vs Sora 2 Pro: Price, 4K & Best Uses` | LTX for longer economical high-resolution iteration; Sora Pro for studio-grade Sora output and references. | `/ai-video-engines/ltx-2-3-fast-vs-ltx-2-3-pro` |
| `veo-3-1-vs-wan-2-5` | `Veo 3.1 vs Wan 2.5: 4K, Audio, Price & Upgrade` | Veo for current 4K controls and polish; Wan for lower-cost legacy clips up to 10 seconds. | `/ai-video-engines/veo-3-1-vs-wan-2-6` |
| `kling-2-6-pro-vs-wan-2-5` | `Kling 2.6 Pro vs Wan 2.5: Quality, Audio & Price` | Kling for legacy 1080p cinematic dialogue; Wan for legacy low-resolution budget flexibility. | `/ai-video-engines/kling-3-pro-vs-wan-2-6` |
| `veo-3-1-fast-vs-wan-2-5` | `Veo 3.1 Fast vs Wan 2.5: Speed, 4K & Value` | Veo Fast for current controls and 4K; Wan for inexpensive simple clips with two extra seconds. | `/ai-video-engines/veo-3-1-fast-vs-wan-2-6` |
| `luma-ray-2-vs-luma-ray-2-flash` | `Luma Ray 2 vs Flash: Speed, Quality & Best Uses` | Flash for faster legacy drafts; Ray 2 for the standard legacy Luma workflow. Do not state prices or numeric speed gains. | `/ai-video-engines/luma-ray-2-vs-luma-ray-3-2` |
| `kling-3-4k-vs-kling-3-standard` | `Kling 3 4K vs Standard: Native 4K or Lower Cost?` | Standard for lower-cost 1080p drafts; 4K for approved native-4K finals. | `/ai-video-engines/kling-3-4k-vs-kling-3-pro` |
| `kling-2-5-turbo-vs-veo-3-1` | `Kling 2.5 Turbo vs Veo 3.1: Price, Audio & 4K` | Kling for inexpensive silent legacy drafts; Veo for current audio, references, controls, and 4K. | `/ai-video-engines/kling-3-pro-vs-veo-3-1` |
| `seedance-2-0-vs-veo-3-1-fast` | `Seedance 2.0 vs Veo 3.1 Fast: Control or Speed?` | Seedance for longer reference/edit workflows; Veo Fast for shorter fast iterations and a simpler price ladder. | `/ai-video-engines/seedance-2-0-vs-veo-3-1` |
| `luma-ray-2-vs-seedance-2-0-fast` | `Luma Ray 2 vs Seedance 2.0 Fast: Edit or Upgrade?` | Luma for legacy 1080p modify/reframe; Seedance Fast for current audio, references, edit, and extend at up to 720p. | `/ai-video-engines/seedance-2-0-fast-vs-veo-3-1-fast` |
| `kling-2-5-turbo-vs-wan-2-6` | `Kling 2.5 Turbo vs Wan 2.6: Price, Audio & Upgrade` | Kling for inexpensive silent legacy drafts; Wan for current 15-second audio and reference-video production. | `/ai-video-engines/kling-3-pro-vs-wan-2-6` |

Each entry must include `meta`, `heroIntro`, `quickVerdict`, four `topCards`, three `primaryLinks`, and three pair-specific FAQ items. Use `Quick verdict`, `Recommended next steps`, and `FAQ` as section labels. Include both exact catalog marketing names somewhere in the combined content.

- [ ] **Step 2: Run the English test and confirm GREEN**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-name-pattern="EN wave-2" tests/comparison-ctr-migration-wave-2.test.ts
```

Expected: the English contract passes.

- [ ] **Step 3: Commit the English wave**

```bash
git diff --check
git add 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts'
git commit -m "feat: enrich English comparison migration wave 2"
```

---

### Task 3: Add ten natural-French adaptations

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts`
- Test: `tests/comparison-ctr-migration-wave-2.test.ts`

**Interfaces:**

- Consumes: the same canonical slugs, facts, and hrefs from Task 2.
- Produces: ten complete entries in `FR_COMPARE_PAGE_OVERRIDES`.

- [ ] **Step 1: Add ten French entries**

Use `Verdict rapide`, `Prochaines étapes recommandées`, and `FAQ`. Use these exact metadata titles:

| Slug | French title |
| --- | --- |
| `ltx-2-3-fast-vs-sora-2-pro` | `LTX 2.3 Fast vs Sora 2 Pro : prix, 4K et usages` |
| `veo-3-1-vs-wan-2-5` | `Veo 3.1 vs Wan 2.5 : 4K, audio, prix et migration` |
| `kling-2-6-pro-vs-wan-2-5` | `Kling 2.6 Pro vs Wan 2.5 : qualité, audio et prix` |
| `veo-3-1-fast-vs-wan-2-5` | `Veo 3.1 Fast vs Wan 2.5 : vitesse, 4K et valeur` |
| `luma-ray-2-vs-luma-ray-2-flash` | `Luma Ray 2 vs Flash : vitesse, qualité et usages` |
| `kling-3-4k-vs-kling-3-standard` | `Kling 3 4K vs Standard : 4K native ou prix réduit ?` |
| `kling-2-5-turbo-vs-veo-3-1` | `Kling 2.5 Turbo vs Veo 3.1 : prix, audio et 4K` |
| `seedance-2-0-vs-veo-3-1-fast` | `Seedance 2.0 vs Veo 3.1 Fast : contrôle ou vitesse ?` |
| `luma-ray-2-vs-seedance-2-0-fast` | `Luma Ray 2 vs Seedance 2.0 Fast : éditer ou évoluer ?` |
| `kling-2-5-turbo-vs-wan-2-6` | `Kling 2.5 Turbo vs Wan 2.6 : prix, audio et migration` |

Translate intent rather than English sentence order. For legacy pages, use `historique`, `ancien`, `actuel`, `migrer`, or `évoluer` naturally. Localize all anchor labels while preserving hrefs exactly. Include four cards and three pair-specific FAQ items per page.

- [ ] **Step 2: Run the French test and confirm GREEN**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-name-pattern="FR wave-2|migration or stay" tests/comparison-ctr-migration-wave-2.test.ts
```

Expected: the French editorial and migration contracts pass.

- [ ] **Step 3: Commit the French wave**

```bash
git diff --check
git add 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts'
git commit -m "feat: enrich French comparison migration wave 2"
```

---

### Task 4: Add ten LATAM-neutral Spanish adaptations

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts`
- Test: `tests/comparison-ctr-migration-wave-2.test.ts`

**Interfaces:**

- Consumes: the same canonical slugs, facts, hrefs, and `docs/seo/localization-notes.md`.
- Produces: ten complete entries in `ES_COMPARE_PAGE_OVERRIDES`.

- [ ] **Step 1: Add ten LATAM Spanish entries**

Use `Veredicto rápido`, `Siguientes pasos recomendados`, and `Preguntas frecuentes`. Use these exact metadata titles:

| Slug | LATAM Spanish title |
| --- | --- |
| `ltx-2-3-fast-vs-sora-2-pro` | `LTX 2.3 Fast vs Sora 2 Pro: precio, 4K y usos` |
| `veo-3-1-vs-wan-2-5` | `Veo 3.1 vs Wan 2.5: 4K, audio, precio y migración` |
| `kling-2-6-pro-vs-wan-2-5` | `Kling 2.6 Pro vs Wan 2.5: calidad, audio y precio` |
| `veo-3-1-fast-vs-wan-2-5` | `Veo 3.1 Fast vs Wan 2.5: velocidad, 4K y valor` |
| `luma-ray-2-vs-luma-ray-2-flash` | `Luma Ray 2 vs Flash: velocidad, calidad y usos` |
| `kling-3-4k-vs-kling-3-standard` | `Kling 3 4K vs Standard: 4K nativo o menor precio` |
| `kling-2-5-turbo-vs-veo-3-1` | `Kling 2.5 Turbo vs Veo 3.1: precio, audio y 4K` |
| `seedance-2-0-vs-veo-3-1-fast` | `Seedance 2.0 vs Veo 3.1 Fast: control o velocidad` |
| `luma-ray-2-vs-seedance-2-0-fast` | `Luma Ray 2 vs Seedance 2.0 Fast: editar o migrar` |
| `kling-2-5-turbo-vs-wan-2-6` | `Kling 2.5 Turbo vs Wan 2.6: precio, audio y migración` |

Use `anterior`, `actual`, `migrar`, or `actualizar` naturally on legacy pages. Localize every label, preserve canonical hrefs, include four cards and three pair-specific FAQ items, and keep every occurrence of `video` unaccented.

- [ ] **Step 2: Run the Spanish and localization tests and confirm GREEN**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-name-pattern="ES wave-2|LATAM-neutral|localized instead|migration or stay" tests/comparison-ctr-migration-wave-2.test.ts
```

Expected: Spanish structure, LATAM vocabulary, localization, and migration framing all pass.

- [ ] **Step 3: Commit the Spanish wave**

```bash
git diff --check
git add 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts'
git commit -m "feat: enrich LATAM comparison migration wave 2"
```

---

### Task 5: Verify the complete wave

**Files:**

- Test: `tests/comparison-ctr-migration-wave-2.test.ts`
- Test: `tests/compare-page-architecture.test.ts`
- Verify: the three override maps and unchanged SEO architecture.

**Interfaces:**

- Consumes: all 30 entries from Tasks 2–4.
- Produces: release evidence for content, links, architecture, lint, full tests, build, and localized rendering.

- [ ] **Step 1: Run focused contracts**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-ctr-migration-wave-2.test.ts tests/compare-page-architecture.test.ts
```

Expected: 24 tests pass: 7 wave-2 tests plus the current 17 comparison architecture tests.

- [ ] **Step 2: Run lint and exposure checks**

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Run the complete repository suite**

```bash
pnpm test:validate
```

Expected: all repository tests pass with zero failures. Restore the two historical comparison-matrix files afterward if the generator test refreshes them.

- [ ] **Step 4: Build the frontend**

```bash
pnpm --prefix frontend run build
```

Expected: the Next.js production build exits 0 and generates all localized static routes.

- [ ] **Step 5: Smoke-check one target in three locales**

Start the production server:

```bash
pnpm --prefix frontend exec next start -p 3100
```

Request the same comparison in all locales:

```bash
curl -LfsS http://localhost:3100/ai-video-engines/ltx-2-3-fast-vs-sora-2-pro -o /tmp/maxvideo-wave2-en.html
curl -LfsS http://localhost:3100/fr/comparatif/ltx-2-3-fast-vs-sora-2-pro -o /tmp/maxvideo-wave2-fr.html
curl -LfsS http://localhost:3100/es/comparativa/ltx-2-3-fast-vs-sora-2-pro -o /tmp/maxvideo-wave2-es.html
rg -n "LTX 2.3 Fast vs Sora 2 Pro|canonical|hrefLang|application/ld\\+json|Quick verdict|Verdict rapide|Veredicto rápido" /tmp/maxvideo-wave2-{en,fr,es}.html
```

Expected: all requests return HTTP 200 and each document includes its localized metadata/verdict, canonical, hreflang, and JSON-LD.

- [ ] **Step 6: Review final scope**

```bash
git status --short --branch
git diff --stat origin/main...HEAD
git diff --check
```

Expected: only the design, plan, focused wave-2 test, and three locale override maps differ from `origin/main`. Historical GSC matrices, sitemap, robots, catalog, Studio, and workspace files remain unchanged.
