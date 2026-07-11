# Comparison Indexation Controlled Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a reversible `noindex,follow` policy to exactly 30 French and 30 Spanish comparison URLs while keeping every English comparison indexable and every selected page accessible.

**Architecture:** A curated JSON file is the only production source of locale/slug exclusions. A pure TypeScript module exposes the policy to Next.js metadata, sitemap, and link selection; the Node IndexNow module reads the same JSON and is held to exact URL parity by tests. Publication, canonical routing, page rendering, and model availability remain independent from indexation.

**Tech Stack:** Next.js App Router, TypeScript, Node.js ESM, JSON configuration, `node:test`, `tsx`.

## Global Constraints

- Exactly 30 French and 30 Spanish locale/slug keys are excluded; no English key is excluded.
- All 292 published English comparison URLs remain indexable and present in sitemap/IndexNow selection.
- Selected localized routes remain HTTP 200, retain self-canonical URLs, existing content, and JSON-LD, and use `noindex,follow`.
- Selected localized routes are absent from hreflang alternates, sitemap entries, IndexNow submissions, and locale-specific public comparison discovery.
- Publication and indexability remain separate; do not modify `publishedPairs` or synthesize new pairs.
- Accessible legacy models remain accessible. Do not change model availability, generation behavior, pricing, copy, or catalog status.
- Existing unpublished, incomplete-specification, canonicalization, redirect, and `?order=` safety behavior remains unchanged.
- The production policy is static and curated; do not import GSC or dated audit artifacts into runtime application code.
- The July 8 evidence files remain unchanged after verification.
- Use TDD for every production behavior: add the assertion, run it and observe the expected failure, then implement the smallest passing change.
- No automatic wave 2.

---

## File Structure

- Create `frontend/config/comparison-indexation.json`: schema metadata plus the exact FR and ES exclusion arrays.
- Create `frontend/lib/compare-hub/indexation.ts`: pure locale/slug policy helpers; no publication imports and no runtime I/O.
- Create `tests/comparison-indexation-wave-1.test.ts`: focused policy, evidence, metadata, sitemap, IndexNow, and discovery contract.
- Modify `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-metadata.ts`: apply locale policy and pass indexable locales to hreflang generation.
- Modify `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-related-links.ts`: filter related destinations by current locale.
- Modify `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx`: pass the resolved locale to the related-link builder.
- Modify `frontend/lib/sitemap/route-discovery.ts`: emit only indexable locales per comparison and compensate the locale-count guard for intentional omissions.
- Modify `scripts/indexnow-url-selection.mjs`: read the shared JSON and add only indexable localized URLs.
- Modify `tests/indexnow-url-selection.test.ts`: replace the global `slug count × 3` assumption with exact locale-aware parity.
- Modify `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/page.tsx`: filter all hub comparison destinations by the current locale.
- Modify `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-related.ts`: make related and fallback selection locale-aware.
- Modify the best-for page/components that call those helpers so the existing `locale` value reaches each comparison decision.
- Modify focused architecture tests only when an intentional signature or ownership assertion changes.

---

### Task 1: Curated Policy and Evidence Contract

**Files:**
- Create: `frontend/config/comparison-indexation.json`
- Create: `frontend/lib/compare-hub/indexation.ts`
- Create: `tests/comparison-indexation-wave-1.test.ts`

**Interfaces:**
- Consumes: `AppLocale`, canonical published slugs supplied by callers, the current engine catalog, and `generateComparisonIndexationArtifacts()` in tests only.
- Produces: `isComparisonIndexable(locale: AppLocale, canonicalSlug: string): boolean`, `getIndexableComparisonLocales(canonicalSlug: string): AppLocale[]`, and `getIndexableComparisonSlugs(locale: AppLocale, canonicalSlugs: readonly string[]): string[]`.

- [ ] **Step 1: Write the failing policy-presence test**

Create the test with a dynamic import so absence fails as an assertion, then assert the approved cardinality and behavior:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('wave 1 exposes one shared locale indexation policy', async () => {
  const policy = await import('../frontend/lib/compare-hub/indexation.ts').catch(() => null);
  assert.ok(policy, 'missing comparison indexation policy module');
  assert.equal(policy.isComparisonIndexable('en', 'ltx-2-vs-veo-3-1-lite'), true);
  assert.equal(policy.isComparisonIndexable('fr', 'ltx-2-vs-veo-3-1-lite'), false);
  assert.equal(policy.isComparisonIndexable('es', 'kling-3-pro-vs-minimax-hailuo-02-text'), false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-indexation-wave-1.test.ts
```

Expected: FAIL with `missing comparison indexation policy module`.

- [ ] **Step 3: Add the exact curated JSON configuration**

Use this shape and exact arrays:

```json
{
  "schemaVersion": 1,
  "wave": "localized-low-signal-2026-07-11",
  "evidenceDate": "2026-07-08",
  "noindexByLocale": {
    "fr": [
      "ltx-2-vs-veo-3-1-lite",
      "luma-ray-2-flash-vs-seedance-2-0",
      "luma-ray-2-vs-minimax-hailuo-02-text",
      "kling-3-standard-vs-kling-o3-pro",
      "minimax-hailuo-02-text-vs-wan-2-5",
      "kling-3-4k-vs-luma-ray-2",
      "kling-3-pro-vs-wan-2-5",
      "ltx-2-vs-luma-ray-2",
      "kling-3-pro-vs-kling-o3-pro",
      "ltx-2-vs-wan-2-5",
      "kling-2-6-pro-vs-kling-3-4k",
      "kling-3-4k-vs-ltx-2",
      "kling-3-4k-vs-wan-2-6",
      "kling-2-5-turbo-vs-ltx-2",
      "kling-2-5-turbo-vs-ltx-2-3-fast",
      "kling-2-5-turbo-vs-ltx-2-3-pro",
      "kling-2-5-turbo-vs-ltx-2-fast",
      "kling-2-5-turbo-vs-luma-ray-2",
      "kling-2-5-turbo-vs-luma-ray-2-flash",
      "kling-2-5-turbo-vs-pika-text-to-video",
      "kling-2-5-turbo-vs-seedance-1-5-pro",
      "kling-2-5-turbo-vs-seedance-2-0",
      "kling-2-5-turbo-vs-seedance-2-0-fast",
      "kling-2-5-turbo-vs-sora-2-pro",
      "kling-2-5-turbo-vs-veo-3-1-lite",
      "kling-2-6-pro-vs-ltx-2",
      "kling-2-6-pro-vs-ltx-2-3-fast",
      "kling-2-6-pro-vs-ltx-2-3-pro",
      "kling-2-6-pro-vs-ltx-2-fast",
      "kling-2-6-pro-vs-luma-ray-2"
    ],
    "es": [
      "kling-3-pro-vs-minimax-hailuo-02-text",
      "kling-3-standard-vs-luma-ray-2-flash",
      "ltx-2-3-fast-vs-luma-ray-2-flash",
      "ltx-2-3-pro-vs-luma-ray-2-flash",
      "kling-3-4k-vs-veo-3-1-lite",
      "kling-3-pro-vs-luma-ray-2-flash",
      "ltx-2-fast-vs-sora-2",
      "luma-ray-2-vs-veo-3-1-lite",
      "luma-ray-2-vs-wan-2-5",
      "kling-3-4k-vs-seedance-1-5-pro",
      "kling-3-4k-vs-luma-ray-2",
      "ltx-2-vs-luma-ray-2",
      "sora-2-vs-veo-3-1-lite",
      "kling-3-4k-vs-ltx-2",
      "kling-3-4k-vs-wan-2-6",
      "kling-3-pro-vs-ltx-2",
      "kling-3-pro-vs-kling-o3-standard",
      "kling-o3-pro-vs-veo-3-1",
      "kling-3-pro-vs-wan-2-5",
      "kling-o3-4k-vs-seedance-2-0",
      "minimax-hailuo-02-text-vs-seedance-2-0-fast",
      "kling-3-4k-vs-sora-2",
      "kling-2-6-pro-vs-seedance-2-0-fast",
      "kling-3-pro-vs-kling-o3-pro",
      "kling-o3-standard-vs-veo-3-1",
      "minimax-hailuo-02-text-vs-seedance-1-5-pro",
      "kling-3-standard-vs-kling-o3-pro",
      "ltx-2-vs-wan-2-5",
      "kling-2-5-turbo-vs-kling-2-6-pro",
      "kling-2-5-turbo-vs-ltx-2-3-pro"
    ]
  }
}
```

- [ ] **Step 4: Implement the minimal pure helper**

```ts
import comparisonIndexation from '@/config/comparison-indexation.json';
import { locales, type AppLocale } from '@/i18n/locales';

const noindexByLocale: Record<AppLocale, ReadonlySet<string>> = {
  en: new Set(),
  fr: new Set(comparisonIndexation.noindexByLocale.fr),
  es: new Set(comparisonIndexation.noindexByLocale.es),
};

export function isComparisonIndexable(locale: AppLocale, canonicalSlug: string): boolean {
  return !noindexByLocale[locale].has(canonicalSlug);
}

export function getIndexableComparisonLocales(canonicalSlug: string): AppLocale[] {
  return locales.filter((locale) => isComparisonIndexable(locale, canonicalSlug));
}

export function getIndexableComparisonSlugs(
  locale: AppLocale,
  canonicalSlugs: readonly string[],
): string[] {
  return canonicalSlugs.filter((slug) => isComparisonIndexable(locale, slug));
}
```

- [ ] **Step 5: Expand the test to prove evidence and safety invariants**

Read the JSON and assert 30/30/60 with no duplicates and no `en` property. Regenerate the matrix in memory with `generateComparisonIndexationArtifacts()` and verify every selected row has `classification === 'noindex_candidate'`, zero clicks, fewer than 30 impressions, no override, and no strategic signals. Resolve both model slugs against `engine-catalog.json` and assert `availability === 'available'` plus `engine.status === 'live'`. Assert every published English slug remains indexable and every row with clicks, at least 30 impressions, a top-10 position, an override, or strategic signals remains indexable.

Use this deterministic comparator and compare the first 30 eligible rows per locale to the JSON arrays:

```ts
(a, b) =>
  Number(b.hasGscRow) - Number(a.hasGscRow) ||
  a.impressions - b.impressions ||
  a.slug.localeCompare(b.slug, 'en')
```

- [ ] **Step 6: Run policy tests and verify GREEN**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-indexation-wave-1.test.ts tests/comparison-indexation-matrix.test.ts
```

Expected: all tests pass and the historical matrix files are restored if the generator CLI test rewrites them.

- [ ] **Step 7: Commit Task 1**

```bash
git add frontend/config/comparison-indexation.json frontend/lib/compare-hub/indexation.ts tests/comparison-indexation-wave-1.test.ts
git commit -m "feat: add localized comparison indexation policy"
```

---

### Task 2: Metadata, Canonical, Hreflang, and Related Links

**Files:**
- Modify: `tests/comparison-indexation-wave-1.test.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-metadata.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-related-links.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx`

**Interfaces:**
- Consumes: Task 1's `isComparisonIndexable()` and `getIndexableComparisonLocales()`.
- Produces: `buildRelatedComparisonLinks(canonicalSlug: string, locale: AppLocale)` and locale-aware comparison metadata.

- [ ] **Step 1: Add failing metadata assertions**

Call `buildComparePageMetadata()` for a selected French URL, selected Spanish URL, their English counterparts, and an unselected localized URL. Assert selected metadata has `robots.index === false`, `robots.follow === true`, and the localized self-canonical. Assert its `alternates.languages` omits the selected locale, keeps `x-default` on English, and includes only indexable alternates. Assert English and unselected counterparts remain indexable. Preserve a separate assertion that a non-empty `order` query is noindex.

- [ ] **Step 2: Add a failing related-link architecture assertion**

The current `RELATED_COMPARISONS` graph has no edge to one of the 60 selected targets, so lock the future-safe ownership without manufacturing production data. Read the related-link and route-page source and assert the policy is applied at the point where a canonical destination is accepted:

```ts
const relatedSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-related-links.ts',
  'utf8',
);
const pageSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx',
  'utf8',
);

assert.match(relatedSource, /isComparisonIndexable\(locale, canonicalPair\)/);
assert.match(pageSource, /buildRelatedComparisonLinks\(canonicalSlug, activeLocale\)/);
```

- [ ] **Step 3: Run focused tests and verify RED**

Run the wave-1 test. Expected failures: selected localized metadata is currently indexable/hreflang-advertised and related links are locale-agnostic.

- [ ] **Step 4: Implement metadata behavior**

Import the Task 1 helpers. Treat an exact locale exclusion as an additional `noindex,follow` reason, and pass `availableLocales: getIndexableComparisonLocales(canonicalSlug)` to `buildSeoMetadata`. Do not change canonical override, titles, descriptions, content, or existing noindex reasons.

- [ ] **Step 5: Implement locale-aware related links**

Add `locale: AppLocale` to `buildRelatedComparisonLinks`, require both publication and `isComparisonIndexable(locale, canonicalPair)`, and pass `activeLocale` from the route page.

- [ ] **Step 6: Run focused and architecture tests and verify GREEN**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-indexation-wave-1.test.ts tests/compare-page-architecture.test.ts tests/hreflang-variants.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit Task 2**

```bash
git add tests/comparison-indexation-wave-1.test.ts frontend/app/'(localized)'/'[locale]'/'(marketing)'/ai-video-engines/'[slug]'
git commit -m "feat: apply comparison locale robots policy"
```

---

### Task 3: Sitemap and IndexNow Exact URL Parity

**Files:**
- Modify: `tests/comparison-indexation-wave-1.test.ts`
- Modify: `tests/indexnow-url-selection.test.ts`
- Modify: `frontend/lib/sitemap/route-discovery.ts`
- Modify: `scripts/indexnow-url-selection.mjs`

**Interfaces:**
- Consumes: Task 1's `getIndexableComparisonLocales()` and the shared JSON configuration.
- Produces: locale-aware comparison sitemap entries and `getIndexableComparisonLocalesForIndexNow(slug)` for parity tests.

- [ ] **Step 1: Add failing sitemap assertions**

Call `getCanonicalPathEntries()`, select `/ai-video-engines/{slug}` entries, and expand `entry.locales`. Assert the resulting comparison URL keys total `292 * 3 - 60 = 816`, contain all 292 English keys, omit the exact 60 configured keys, and contain every unselected French/Spanish key.

- [ ] **Step 2: Add failing IndexNow parity assertions**

Update `tests/indexnow-url-selection.test.ts` so `addComparisonUrls()` is expected to omit selected locales. Compare every published slug's IndexNow locale list to `getIndexableComparisonLocales(slug)`. Change the dry-run expected comparison count from `publishedSlugs.length * 3` to the sum of indexable locale counts.

- [ ] **Step 3: Run focused tests and verify RED**

Expected failures: sitemap still emits `LOCALES`, IndexNow still emits three URLs per slug, and dry-run count is 876 instead of 816.

- [ ] **Step 4: Implement locale-aware sitemap entries**

Import `getIndexableComparisonLocales` and replace `locales: LOCALES` on comparison entries. Keep `getHubComparisonSlugsForSitemap()` as the publication list.

Adjust `validateLocaleCounts()` only for the intentional comparison omissions:

```ts
const intentionalComparisonOmissions = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    getHubComparisonSlugsForSitemap().filter(
      (slug) => !getIndexableComparisonLocales(slug).includes(locale),
    ).length,
  ]),
) as Record<AppLocale, number>;

const adjustedLocaleCount = localeCount + intentionalComparisonOmissions[locale];
const difference = Math.abs(englishCount - adjustedLocaleCount);
```

Do not increase `SITEMAP_LOCALE_TOLERANCE` or disable the mismatch guard.

- [ ] **Step 5: Implement locale-aware IndexNow selection**

Read `frontend/config/comparison-indexation.json` once with `readFileSync(new URL(..., import.meta.url), 'utf8')`. Export a small locale resolver that uses the exact path map:

```js
const COMPARISON_PATH_BY_LOCALE = {
  en: '/ai-video-engines',
  fr: '/fr/comparatif',
  es: '/es/comparativa',
};
```

Have `addComparisonUrls()` loop only over returned indexable locales. Keep hub URLs unchanged.

- [ ] **Step 6: Run sitemap, IndexNow, and architecture tests and verify GREEN**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-indexation-wave-1.test.ts tests/indexnow-url-selection.test.ts tests/schema-sitemap-architecture.test.ts
```

Expected: all tests pass, dry-run reports exactly 816 comparison URLs, and no locale mismatch error occurs with intentional omissions compensated.

- [ ] **Step 7: Commit Task 3**

```bash
git add tests/comparison-indexation-wave-1.test.ts tests/indexnow-url-selection.test.ts frontend/lib/sitemap/route-discovery.ts scripts/indexnow-url-selection.mjs
git commit -m "feat: align comparison sitemap and IndexNow policy"
```

---

### Task 4: Locale-Specific Public Discovery

**Files:**
- Modify: `tests/comparison-indexation-wave-1.test.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/page.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/page.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-related.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_components/BestForTopPicksPanel.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_components/BestForDetailView.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_components/BestForShortlistSections.tsx`
- Modify focused best-for tests if signatures change.

**Interfaces:**
- Consumes: Task 1's `isComparisonIndexable()`.
- Produces: hub arrays and best-for comparison choices that never target a noindex URL in the active locale.

- [ ] **Step 1: Add failing discovery assertions**

Assert real hub pair sets filtered for `fr`/`es` contain no configured exclusions while the English set still contains the same published slugs. For best-for helpers, pass a locale and assert explicit related pairs and fallback pairs reject selected destinations only in that locale.

- [ ] **Step 2: Run focused tests and verify RED**

Expected failures: current hub arrays and best-for fallback selection use publication only.

- [ ] **Step 3: Filter hub destinations after pair construction**

In the server route, use one local predicate:

```ts
const isIndexablePair = (slug: string) => isComparisonIndexable(locale, slug);
```

Apply it to popular comparisons, every use-case bucket, suggested opponent actions, the ranked directory, and quick-start choices. For suggested opponents, request enough candidates before filtering and then cap at three so an excluded early candidate does not unnecessarily reduce the UI.

- [ ] **Step 4: Make best-for helpers locale-aware**

Change signatures to:

```ts
getPublishedRelatedComparisons(entry: BestForEntry, locale: AppLocale): string[];
pickComparisonSlug(picks: RankedPick[], relatedComparisons: string[], locale: AppLocale): string | null;
```

Require `isPublishedComparisonSlug(slug) && isComparisonIndexable(locale, canonicalSlug)` for explicit and generated choices. `findComparisonForPick()` can remain locale-agnostic because it consumes the already filtered `relatedComparisons` list.

Pass `locale` from the best-for page to `getPublishedRelatedComparisons`, from `BestForDetailView` to every `RankedShortlistCard`, and from `TopPicksPanel` to `pickComparisonSlug`.

- [ ] **Step 5: Run focused, best-for, and comparison architecture tests and verify GREEN**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-indexation-wave-1.test.ts tests/best-for-4k-ranking.test.ts tests/best-for-detail-architecture.test.ts tests/compare-page-architecture.test.ts
```

Expected: all tests pass; English expectations in existing tests are updated by passing `'en'`, without weakening their ranking assertions.

- [ ] **Step 6: Commit Task 4**

```bash
git add tests frontend/app/'(localized)'/'[locale]'/'(marketing)'/ai-video-engines
git commit -m "feat: filter localized comparison discovery"
```

---

### Task 5: Full Verification and Release Readiness

**Files:**
- Modify only if verification exposes an issue covered by a new failing regression test.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified branch ready for review and merge decision.

- [ ] **Step 1: Restore generated historical artifacts if tests changed them**

```bash
git restore -- docs/seo/comparison-indexation-matrix-2026-07-08.json docs/seo/comparison-indexation-matrix-2026-07-08.md
```

- [ ] **Step 2: Run the complete focused SEO contract**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-indexation-wave-1.test.ts tests/comparison-indexation-matrix.test.ts tests/indexnow-url-selection.test.ts tests/compare-page-architecture.test.ts tests/hreflang-variants.test.ts tests/schema-sitemap-architecture.test.ts tests/best-for-4k-ranking.test.ts tests/best-for-detail-architecture.test.ts
```

Expected: zero failures.

- [ ] **Step 3: Run repository verification**

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check origin/main...HEAD
pnpm --prefix frontend run build
```

Expected: every command exits 0.

- [ ] **Step 4: Run the full test suite**

Use the repository's root test command and record the exact pass count. Restore the two generated comparison matrix files afterward if needed. Expected: zero failures.

- [ ] **Step 5: Inspect the final diff and requirements**

Verify the branch diff changes only the approved comparison indexation surfaces, contains no secrets or generated matrix changes, retains 60 unique localized keys, and introduces no `publishedPairs`, catalog availability, redirect, or content edits.

- [ ] **Step 6: Commit any verification-only regression fix**

Only if Step 2–5 exposed a real issue, add a failing regression test first, implement the minimal fix, rerun the covering command, and commit with a focused message. Otherwise do not create an empty commit.
