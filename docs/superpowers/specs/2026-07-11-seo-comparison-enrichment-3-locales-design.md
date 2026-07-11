# SEO Comparison Enrichment — 10 Pages, 3 Locales

**Date:** 2026-07-11  
**Status:** Approved for planning  
**Branch:** `codex/seo-comparison-enrichment-3-locales`  
**Base:** `origin/main` at `9a72aedb4b2963d0d3b7ecdcb8ecbea8352264c3`

## Objective

Improve organic click-through rate and decision usefulness for ten English comparison URLs that already receive Google Search Console impressions but no clicks. Enrich the same comparisons in English, French, and Spanish so each public localized page has purposeful, locale-appropriate copy rather than generic fallback content.

This batch is an editorial SEO improvement. It does not change which comparisons are published or indexed.

## Target Pages

The pages are ordered by the GSC opportunity recorded in `docs/seo/comparison-indexation-matrix-2026-07-08.json`:

| Comparison slug | Impressions | Position |
| --- | ---: | ---: |
| `pika-text-to-video-vs-wan-2-6` | 476 | 10.8 |
| `kling-2-6-pro-vs-kling-3-pro` | 376 | 11.7 |
| `ltx-2-3-fast-vs-luma-ray-2` | 290 | 8.2 |
| `kling-2-6-pro-vs-minimax-hailuo-02-text` | 270 | 14.5 |
| `kling-3-standard-vs-kling-o3-standard` | 250 | 13.9 |
| `seedance-2-0-fast-vs-veo-3-1` | 242 | 10.1 |
| `ltx-2-fast-vs-minimax-hailuo-02-text` | 219 | 12.9 |
| `minimax-hailuo-02-text-vs-veo-3-1-fast` | 209 | 9.8 |
| `kling-3-4k-vs-seedance-2-0` | 203 | 7.9 |
| `minimax-hailuo-02-text-vs-wan-2-6` | 196 | 11.0 |

All ten rows are classified as `enrich`, have no current localized override, and have zero recorded clicks in the matrix snapshot.

## Locale Strategy

### English

- Write in American English.
- Use concise commercial language aimed primarily at the US market while remaining understandable globally.
- Prefer `quality`, `color`, and US product terminology where variants arise.

### French

- Write natural French copy rather than translating sentence structure literally.
- Preserve official model names and broadly recognized AI-video terms.
- Use clear decision language focused on workflow, quality, speed, and cost.

### Spanish

- Follow `docs/seo/localization-notes.md` and write LATAM-neutral Spanish.
- Keep the route locale and hreflang as generic `es`; do not introduce a new `es-419` route.
- Use vocabulary suitable across Mexico, Colombia, Argentina, Chile, and the US Hispanic market.
- Use `video` without the Spain-specific accent and avoid `vídeo`, `móvil`, `ordenador`, `monedero`, and `vosotros`.

Each locale must communicate the same factual comparison, but headings, phrasing, and calls to action should sound native rather than mechanically translated.

## Selected Approach

Add a complete override for every target slug to each existing locale map:

- `compare-page-overrides-en.ts`
- `compare-page-overrides-fr.ts`
- `compare-page-overrides-es.ts`

This produces 30 localized override entries. The existing comparison route, metadata builder, canonical logic, hreflang handling, spec table, pricing section, scorecard, and schema builders remain unchanged.

This approach was selected over:

1. English-only enrichment, which would leave the localized pages on generic copy.
2. Metadata-only French and Spanish translations, which would improve snippets but not page usefulness or internal linking.
3. A five-page pilot, which would reduce immediate scope but leave half of the already identified GSC opportunity untreated.

## Content Contract Per Page

Every localized override will contain:

### Metadata

- A unique title built around the exact model pair and a meaningful decision angle.
- `titleBranding: 'none'` when needed to keep the final title concise and prevent automatic branding from exceeding the target length.
- A unique description that identifies the principal trade-off and tells the searcher what the page compares.
- Titles should normally target roughly 50–60 characters after rendering.
- Descriptions should normally target roughly 140–160 characters after rendering, prioritizing natural copy over forced length.

### Hero introduction

- Explain what decision the comparison helps the reader make.
- Name the primary distinction between the two models.
- Avoid unsupported superiority claims and generic SEO filler.

### Quick verdict

- Give a direct recommendation for when to choose each model.
- Distinguish final quality, iteration speed, price/value, resolution, controls, audio, or use case only when supported by repository data.
- Avoid presenting subjective scorecard output as an objective fact.

### Decision cards

Use four short cards where the model data supports them:

1. Choose model A when…
2. Choose model B when…
3. Key trade-off
4. Best-fit workflows

The cards must add decision value instead of repeating the hero and verdict.

### Internal links

- Link to both model pages where those pages exist.
- Add an examples or closely related comparison link only when the destination is a real published route.
- Keep links locale-aware by using the existing localized `Link` component and English canonical hrefs, which the navigation layer localizes.
- Use descriptive anchors that name the model or comparison intent.

### FAQ

- Provide three to five questions unique to the pair.
- Cover the likely search decision: which is better for a named workflow, the important capability difference, value or speed, and when to choose each model.
- Keep answers consistent with the visible specs and pricing data.
- Do not add a new schema type or change current FAQ schema behavior in this batch.

## Fact-Sourcing Rules

Comparison claims must be derived from current repository sources, in this order:

1. Engine catalog and model configuration used by the comparison page.
2. Current key specs and pricing data rendered by the route.
3. Existing model-page copy and curated comparison showdowns.
4. Existing repository documentation for model-specific behavior.

If a capability is missing, pending, ambiguous, or inconsistent across sources, the localized copy must avoid that claim. No price, generation time, resolution, audio feature, or quality assertion may be invented to make the copy more persuasive.

## Architecture

No new rendering component or content system is required. The existing `ComparePageOverride` contract already supports all selected fields:

- `meta`
- `heroIntro`
- `quickVerdict`
- `topCards`
- `primaryLinksTitle`
- `primaryLinks`
- `faq`

The route remains an orchestrator. Overrides remain route-local static content. This keeps canonical, hreflang, JSON-LD, localized routing, and indexing decisions under the existing shared builders.

## Test Design

Use test-driven development by adding a focused contract test before the override entries.

The test should verify:

- all ten target slugs exist in all three locale maps;
- every entry contains unique metadata, hero copy, a quick verdict, decision cards, internal links, and FAQ items;
- titles and descriptions are non-empty and remain within practical snippet bounds;
- the two compared model names are represented appropriately in metadata or page copy;
- internal hrefs use supported public route prefixes and contain no locale prefix;
- French and Spanish entries do not simply reuse the English text;
- Spanish copy avoids the explicitly disallowed Spain-specific vocabulary;
- FAQ questions are unique within each localized page;
- existing canonical, hreflang, schema, publication, and indexing architecture tests continue to pass.

Exact character limits should act as regression guardrails, not as a reason to produce awkward language. Tests should allow a small practical range around the editorial targets.

## Verification

Run focused checks first:

```bash
node --import tsx --test tests/<focused-comparison-enrichment-test>.test.ts
node --import tsx --test tests/compare-page-architecture.test.ts
git diff --check
```

Then run repository checks proportionate to the public SEO surface:

```bash
npm --prefix frontend run lint
npm run lint:exposure
```

If feasible before merge, run the full relevant test suite and frontend build. Smoke-check at least one target comparison in each locale to confirm:

- localized URL behavior;
- canonical URL;
- hreflang output;
- rendered title and description;
- visible hero, verdict, cards, links, and FAQ;
- JSON-LD still renders without structural changes;
- the page remains indexable under existing publication and spec-completeness rules.

## Explicit Non-Goals

- No sitemap additions or removals.
- No `noindex` or robots changes.
- No canonical or hreflang architecture changes.
- No comparison publication-list changes.
- No new comparison videos or generated media.
- No scorecard, pricing, or engine-catalog changes.
- No new locale route or `es-419` URL.
- No redesign of the comparison template.
- No unrelated Studio or workspace changes.

## Rollout and Measurement

Ship the 30 overrides as one reviewable SEO content batch. After Google recrawls the pages, compare their clicks, CTR, impressions, and average position against the GSC snapshot used for selection. Evaluate by URL and locale rather than assuming the English signal will transfer equally to French and Spanish.
