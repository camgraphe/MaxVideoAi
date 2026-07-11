# Comparison Indexation Controlled Wave 1 Design

**Date:** 2026-07-11  
**Status:** Approved by user
**Branch:** `codex/seo-comparison-indexation-wave-1`  
**Base:** `origin/main` at `78838c99d63282bc81ee54bf0d29194e447a87c0`

## Objective

Reduce low-value localized comparison indexation without removing useful product pages or weakening proven English demand.

This first controlled wave applies `noindex,follow` to exactly 60 localized URLs:

- 30 French comparison URLs;
- 30 Spanish comparison URLs;
- 0 English URLs.

Every selected page remains directly accessible with HTTP 200, retains its own canonical URL, and continues to link to useful destinations. The selected localized URL is removed from the sitemap, IndexNow submissions, hreflang clusters, and locale-specific public comparison discovery.

The wave is intentionally reversible and limited to evidence-backed candidates. It does not automatically trigger a second wave.

## Evidence Baseline

The cohort is derived from the reproducible comparison indexation inventory generated from:

- `docs/seo/gsc-comparison-performance-2026-07-08.json`;
- the 292 comparison slugs currently published by the engine catalog;
- the current English, French, and Spanish comparison override maps;
- the current strategic comparison surfaces collected by the matrix generator.

The regenerated inventory on this branch contains 876 localized URLs and classifies 209 as `noindex_candidate` after the three completed editorial waves. Of those, 111 French and 72 Spanish URLs also pass the live/available model guard described below.

The saved July 8 GSC export covers the first 996 page rows. A missing row is therefore treated as an absence of observed signal in that snapshot, not as proof that the URL has never received an impression.

## Selection Contract

A localized URL is eligible only when its freshly generated matrix row satisfies all of these conditions:

1. locale is `fr` or `es`;
2. classification is `noindex_candidate`;
3. clicks equal 0;
4. impressions are below 30;
5. average position is above 10 when a GSC row exists;
6. no localized editorial override exists;
7. no strategic comparison signal exists;
8. both model catalog entries have `availability: "available"`;
9. both engine records have `status: "live"`;
10. the comparison slug is canonical and currently published.

Older or legacy model versions are not treated as unavailable. If they are marked `available` and `live` in the catalog, their pages remain accessible on MaxVideoAI and may appear in this cohort. This wave changes only the indexation treatment of the exact localized comparison URL; it does not change model availability, generation access, pricing, or English comparison indexation.

### Deterministic ordering

Within each locale, eligible rows are ordered as follows:

1. rows with observed GSC data before rows absent from the snapshot;
2. ascending impressions;
3. canonical slug in ascending English lexical order.

The first 30 rows are selected. Prioritizing observed low-impression rows is the conservative choice: Google has already supplied direct evidence of weak demand, whereas a missing row only means the URL was not present in the exported top 996 pages.

## Exact French Cohort

| # | Comparison slug | GSC impressions | Average position |
| ---: | --- | ---: | ---: |
| 1 | `ltx-2-vs-veo-3-1-lite` | 1 | 15.0 |
| 2 | `luma-ray-2-flash-vs-seedance-2-0` | 1 | 12.0 |
| 3 | `luma-ray-2-vs-minimax-hailuo-02-text` | 2 | 27.0 |
| 4 | `kling-3-standard-vs-kling-o3-pro` | 3 | 36.3 |
| 5 | `minimax-hailuo-02-text-vs-wan-2-5` | 3 | 12.7 |
| 6 | `kling-3-4k-vs-luma-ray-2` | 4 | 26.5 |
| 7 | `kling-3-pro-vs-wan-2-5` | 4 | 10.3 |
| 8 | `ltx-2-vs-luma-ray-2` | 5 | 80.6 |
| 9 | `kling-3-pro-vs-kling-o3-pro` | 9 | 17.2 |
| 10 | `ltx-2-vs-wan-2-5` | 9 | 12.1 |
| 11 | `kling-2-6-pro-vs-kling-3-4k` | 12 | 15.9 |
| 12 | `kling-3-4k-vs-ltx-2` | 12 | 23.3 |
| 13 | `kling-3-4k-vs-wan-2-6` | 16 | 20.3 |
| 14 | `kling-2-5-turbo-vs-ltx-2` | — | — |
| 15 | `kling-2-5-turbo-vs-ltx-2-3-fast` | — | — |
| 16 | `kling-2-5-turbo-vs-ltx-2-3-pro` | — | — |
| 17 | `kling-2-5-turbo-vs-ltx-2-fast` | — | — |
| 18 | `kling-2-5-turbo-vs-luma-ray-2` | — | — |
| 19 | `kling-2-5-turbo-vs-luma-ray-2-flash` | — | — |
| 20 | `kling-2-5-turbo-vs-pika-text-to-video` | — | — |
| 21 | `kling-2-5-turbo-vs-seedance-1-5-pro` | — | — |
| 22 | `kling-2-5-turbo-vs-seedance-2-0` | — | — |
| 23 | `kling-2-5-turbo-vs-seedance-2-0-fast` | — | — |
| 24 | `kling-2-5-turbo-vs-sora-2-pro` | — | — |
| 25 | `kling-2-5-turbo-vs-veo-3-1-lite` | — | — |
| 26 | `kling-2-6-pro-vs-ltx-2` | — | — |
| 27 | `kling-2-6-pro-vs-ltx-2-3-fast` | — | — |
| 28 | `kling-2-6-pro-vs-ltx-2-3-pro` | — | — |
| 29 | `kling-2-6-pro-vs-ltx-2-fast` | — | — |
| 30 | `kling-2-6-pro-vs-luma-ray-2` | — | — |

The affected public paths use `/fr/comparatif/{slug}`.

## Exact Spanish Cohort

| # | Comparison slug | GSC impressions | Average position |
| ---: | --- | ---: | ---: |
| 1 | `kling-3-pro-vs-minimax-hailuo-02-text` | 1 | 28.0 |
| 2 | `kling-3-standard-vs-luma-ray-2-flash` | 1 | 11.0 |
| 3 | `ltx-2-3-fast-vs-luma-ray-2-flash` | 1 | 35.0 |
| 4 | `ltx-2-3-pro-vs-luma-ray-2-flash` | 1 | 12.0 |
| 5 | `kling-3-4k-vs-veo-3-1-lite` | 2 | 17.5 |
| 6 | `kling-3-pro-vs-luma-ray-2-flash` | 2 | 24.5 |
| 7 | `ltx-2-fast-vs-sora-2` | 2 | 44.5 |
| 8 | `luma-ray-2-vs-veo-3-1-lite` | 2 | 10.5 |
| 9 | `luma-ray-2-vs-wan-2-5` | 2 | 20.0 |
| 10 | `kling-3-4k-vs-seedance-1-5-pro` | 3 | 23.0 |
| 11 | `kling-3-4k-vs-luma-ray-2` | 4 | 67.3 |
| 12 | `ltx-2-vs-luma-ray-2` | 4 | 22.5 |
| 13 | `sora-2-vs-veo-3-1-lite` | 4 | 11.0 |
| 14 | `kling-3-4k-vs-ltx-2` | 6 | 40.3 |
| 15 | `kling-3-4k-vs-wan-2-6` | 7 | 57.0 |
| 16 | `kling-3-pro-vs-ltx-2` | 7 | 35.7 |
| 17 | `kling-3-pro-vs-kling-o3-standard` | 8 | 16.9 |
| 18 | `kling-o3-pro-vs-veo-3-1` | 9 | 10.1 |
| 19 | `kling-3-pro-vs-wan-2-5` | 10 | 44.6 |
| 20 | `kling-o3-4k-vs-seedance-2-0` | 10 | 17.5 |
| 21 | `minimax-hailuo-02-text-vs-seedance-2-0-fast` | 10 | 16.0 |
| 22 | `kling-3-4k-vs-sora-2` | 11 | 26.8 |
| 23 | `kling-2-6-pro-vs-seedance-2-0-fast` | 12 | 22.0 |
| 24 | `kling-3-pro-vs-kling-o3-pro` | 12 | 14.6 |
| 25 | `kling-o3-standard-vs-veo-3-1` | 13 | 15.5 |
| 26 | `minimax-hailuo-02-text-vs-seedance-1-5-pro` | 18 | 20.2 |
| 27 | `kling-3-standard-vs-kling-o3-pro` | 22 | 10.7 |
| 28 | `ltx-2-vs-wan-2-5` | 23 | 13.7 |
| 29 | `kling-2-5-turbo-vs-kling-2-6-pro` | — | — |
| 30 | `kling-2-5-turbo-vs-ltx-2-3-pro` | — | — |

The affected public paths use `/es/comparativa/{slug}`. The existing generic `es` locale and hreflang remain unchanged; this wave does not add an `es-419` route.

## Approaches Considered

### 1. Curated locale exclusions with one shared source of truth — selected

Store the exact 60 locale/slug decisions in a small production configuration file and expose pure indexation helpers. Metadata, sitemap generation, IndexNow selection, and internal-link discovery all consume that same policy.

This keeps the release deterministic, reviewable, reversible, and independent of runtime access to GSC or audit documents.

### 2. Read the generated audit matrix at runtime

This would reduce manual transcription, but it would couple production routing to a dated operational snapshot and could apply new noindex decisions merely because editorial or catalog inputs changed. The matrix is a recommendation and evidence artifact, not a production control plane.

### 3. Remove the pairs from `publishedPairs`

This would conflate publication with localized indexation. Because `publishedPairs` is global, it could remove English pages and make direct comparison routes unavailable. It conflicts with the approved requirement to leave all English comparisons indexed and all selected localized pages accessible.

## Source of Truth and API

Add a static configuration under `frontend/config/` containing:

- schema version;
- wave identifier and evidence date;
- exactly 30 canonical slugs under `fr`;
- exactly 30 canonical slugs under `es`;
- no English exclusion list.

The production configuration stores decisions, not GSC metrics. Detailed evidence remains in this specification and the audit artifacts.

Add a pure comparison-indexation module under `frontend/lib/compare-hub/` with an API equivalent to:

```ts
type ComparisonLocale = 'en' | 'fr' | 'es';

isComparisonIndexable(locale, canonicalSlug): boolean;
getIndexableComparisonLocales(canonicalSlug): ComparisonLocale[];
getIndexableComparisonSlugs(locale): string[];
```

Required invariants:

- every published English comparison is indexable in wave 1;
- an exclusion is scoped to the exact locale/slug key;
- publication and indexability remain separate concepts;
- unknown or unpublished slugs are not made publishable by the indexation module;
- both TypeScript application code and the `.mjs` IndexNow script read the same static configuration;
- parity tests prevent the two consumers from interpreting the configuration differently.

## Metadata, Canonical, and Hreflang Behavior

For an exact selected locale/slug key:

- return `robots: { index: false, follow: true }`;
- retain the localized page's self-canonical URL;
- retain HTTP 200 and normal page content;
- omit that URL from the hreflang language map;
- retain `x-default` pointing to the English URL;
- advertise only the locale alternates that remain indexable for that slug.

The existing `buildSeoMetadata` and `buildMetadataUrls` APIs already support `availableLocales`. The comparison metadata builder will pass `getIndexableComparisonLocales(canonicalSlug)` so that indexable pages never advertise a noindex alternate. On a noindex page, `buildMetadataUrls` still adds the current locale internally to compute its self-canonical, but does not add it to the public hreflang language map.

Existing safety rules remain additive and unchanged:

- unpublished comparisons remain `noindex,follow`;
- pages with too many pending specifications remain `noindex,follow`;
- `?order=` variants remain `noindex,follow`;
- canonical slug normalization and existing redirects remain unchanged.

## Sitemap and IndexNow

The dynamic comparison route discovery must emit each published slug with only its indexable locales. The result is:

- all 292 English comparison URLs remain in the sitemap;
- exactly 30 French comparison URLs are removed;
- exactly 30 Spanish comparison URLs are removed;
- every unselected French and Spanish comparison URL remains included.

IndexNow comparison selection must derive the same locale-specific set from the shared static policy. It must not submit any of the 60 noindex URLs, and it must continue to submit the corresponding English URL and any unselected localized alternate.

The sitemap/IndexNow parity contract is strengthened from slug-level equality to exact localized-URL equality.

## Locale-Specific Internal Discovery

The site should not prominently discover URLs it explicitly asks search engines not to index. The locale must therefore be passed into comparison-link selection on:

- the comparison hub's popular comparison cards;
- use-case buckets;
- suggested opponents;
- the all-comparisons directory;
- related comparison links on comparison detail pages;
- related comparison choices on `best-for` detail pages.

Filtering applies only to the destination locale. An English page can still link to the English counterpart of a slug excluded in French or Spanish. A selected noindex page may still contain normal outbound links to indexable model, guide, and comparison pages because the directive is `follow`.

No generic engine ranking, model availability, comparison content, or generation behavior changes.

## Test Design

Implementation uses TDD. A focused wave-1 contract test must fail before production configuration and routing changes are added.

The test suite must verify:

1. the configuration contains exactly 30 French and 30 Spanish entries, no English entry, no duplicates, and exactly 60 locale/slug keys;
2. every selected slug is canonical and currently published;
3. both catalog entries for every selected comparison are `available` and `live`;
4. every selected row in a freshly generated matrix still has zero clicks, fewer than 30 impressions, no localized override, no strategic signal, and classification `noindex_candidate`;
5. selection order exactly matches the deterministic rule in this specification;
6. any URL with clicks, at least 30 impressions, a top-10 position, a localized override, or a strategic signal remains indexable;
7. all 292 published English URLs remain indexable;
8. selected metadata is `noindex,follow`, self-canonical, and omits noindex hreflang alternates;
9. unselected metadata behavior remains unchanged;
10. `?order=` remains `noindex,follow` independently of the cohort;
11. the sitemap excludes exactly the 60 localized keys and preserves English plus every unselected FR/ES key;
12. IndexNow's localized comparison URL set exactly equals the sitemap's indexable comparison URL set;
13. hub, related-comparison, suggested-opponent, and `best-for` link builders do not expose selected targets in their excluded locale;
14. the same slugs remain discoverable where their English or other localized URL is indexable;
15. direct selected routes render HTTP 200 with their self-canonical and existing JSON-LD;
16. no redirect, deletion, publication-list removal, or model availability change is introduced.

Relevant existing architecture, metadata, sitemap, hreflang, comparison, and IndexNow tests must remain green.

## Verification Strategy

Focused checks will cover the new contract and the touched architecture first, followed by:

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check origin/main...HEAD
pnpm --prefix frontend run build
```

Smoke checks will include:

- one French selected URL with observed GSC data;
- one French selected URL absent from the snapshot;
- one Spanish selected URL with observed GSC data;
- one Spanish selected URL absent from the snapshot;
- the English counterpart of each selected slug;
- one unselected French and one unselected Spanish comparison.

For each selected localized page, verify HTTP 200, `noindex,follow`, self-canonical, absence from its hreflang cluster, and unchanged structured data. For indexable counterparts, verify HTTP 200, indexability, correct canonical, and hreflang links containing only indexable alternates.

## Rollout, Observation, and Rollback

Release the 60 localized decisions as one controlled batch. Search-engine removal is asynchronous; sitemap removal and `noindex` do not imply immediate disappearance from results.

Observe the cohort for 28 days after deployment and recrawl. Report by locale and URL:

- indexed/not-indexed state in GSC;
- impressions and clicks;
- crawl activity where available;
- unexpected changes on English counterparts;
- changes in comparison-hub organic landing traffic.

Do not launch wave 2 automatically. A new cohort requires a fresh GSC export, regenerated matrix, explicit review, and a separate approval.

Rollback is a configuration-only decision: remove the affected locale/slug keys, redeploy, restore them to sitemap and IndexNow selection, and allow metadata/hreflang/internal discovery to become indexable again. No content restoration or redirect reversal should be necessary.

## Non-Goals

- No English noindex decisions.
- No page deletion, 404, redirect, or canonical consolidation.
- No removal from global `publishedPairs`.
- No change to model availability, including accessible legacy models.
- No comparison copy, pricing, schema content, or scorecard rewrite.
- No new language or locale route.
- No automatic dynamic noindexing from live GSC data or the dated audit matrix.
- No historical GSC snapshot edits.
- No Studio, workspace, billing, provider, or admin changes.
- No automatic second indexation wave.
