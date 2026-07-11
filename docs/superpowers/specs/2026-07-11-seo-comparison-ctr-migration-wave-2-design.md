# SEO Comparison CTR + Migration Wave 2 Design

**Date:** 2026-07-11  
**Status:** Approved for written-spec review  
**Branch:** `codex/seo-comparison-ctr-migration-wave-2`  
**Base:** `origin/main` at `6b7cf74538f0883731c029065a5d9aff658383a8`

## Objective

Improve click-through rate and decision usefulness for the next ten English comparison URLs in the GSC enrichment queue. The selected pages combine 1,781 impressions, zero clicks, and a weighted average position of 9.6 in the `2026-07-08` comparison audit.

Several pairs contain a legacy model. Those pages should not merely repeat specifications: they should answer the active search query, explain the real trade-off, and guide readers toward the current model or workflow when upgrading is the better decision.

This wave enriches the same ten comparisons in American English, French, and LATAM-neutral Spanish. It does not change publication or indexation rules.

## Target Pages

| Comparison slug | Impressions | Position | Primary search decision |
| --- | ---: | ---: | --- |
| `ltx-2-3-fast-vs-sora-2-pro` | 193 | 8.5 | Fast, low-cost 4K-capable iteration versus higher-priced studio-grade Sora output and references. |
| `veo-3-1-vs-wan-2-5` | 192 | 7.9 | Current polished Veo with 4K and advanced controls versus lower-cost legacy Wan. |
| `kling-2-6-pro-vs-wan-2-5` | 187 | 9.9 | Legacy 1080p cinematic dialogue versus lower-cost legacy multi-resolution generation. |
| `veo-3-1-fast-vs-wan-2-5` | 185 | 13.5 | Current fast Veo workflow and 4K controls versus legacy Wan value and longer clips. |
| `luma-ray-2-vs-luma-ray-2-flash` | 183 | 9.4 | Two legacy Luma tiers with matched modes; standard quality route versus faster draft route. |
| `kling-3-4k-vs-kling-3-standard` | 178 | 11.2 | Native 4K final rendering versus lower-cost 1080p drafts within the current Kling family. |
| `kling-2-5-turbo-vs-veo-3-1` | 175 | 7.5 | Low-cost silent legacy Kling versus polished current Veo with audio, references, and 4K. |
| `seedance-2-0-vs-veo-3-1-fast` | 174 | 10.1 | Broad 15-second reference/edit workflow versus faster 8-second Veo production and predictable resolution pricing. |
| `luma-ray-2-vs-seedance-2-0-fast` | 159 | 6.0 | Legacy Luma source-video modification versus current Seedance reference, edit, extend, and audio workflow. |
| `kling-2-5-turbo-vs-wan-2-6` | 155 | 12.3 | Legacy silent Kling value versus current Wan duration, audio, and reference-video control. |

All ten pages are published, have no existing localized override in any of the three locale maps, and are classified as `enrich` in the audit snapshot.

## Approaches Considered

### 1. Full CTR + migration enrichment — selected

Create 30 complete localized overrides. Treat legacy comparisons as migration decisions, while current-model comparisons focus on price, speed, resolution, controls, and production fit.

This approach addresses both the search snippet and the usefulness of the landing page. It also creates stronger internal paths toward current model pages and related current comparisons.

### 2. Current-model-only wave

Skip pages involving Wan 2.5, Kling 2.5 Turbo, and Luma Ray 2. This would prioritize current commercial inventory, but leave six of the highest-impression zero-click opportunities untreated.

### 3. Metadata-only wave

Change titles and descriptions without adding page-level verdicts, decision cards, internal links, or FAQs. This is faster but would not resolve the generic page experience that likely contributes to weak CTR and poor post-click usefulness.

## Locale Strategy

### American English

- Use concise US product language and dollar notation.
- Make the upgrade or stay decision explicit where a legacy model is involved.
- Do not call a legacy model discontinued or unavailable when the catalog still marks it available.

### French

- Adapt the decision logic naturally rather than mirroring English sentence order.
- Preserve official model names and recognizable AI-video terminology.
- Use clear commercial language around coût, rendu final, brouillon, références, audio, and migration.

### LATAM-neutral Spanish

- Follow `docs/seo/localization-notes.md`.
- Keep generic `es` routes and hreflang; use `es_419` only where the existing metadata builder already does so.
- Use `video` without an accent.
- Avoid `vídeo`, `móvil`, `ordenador`, `monedero`, and `vosotros`.
- Prefer broadly understood terms such as `borrador`, `toma`, `referencias`, `audio`, and `flujo`.

## Content Contract Per Locale and Page

Each of the 30 entries must contain:

- `meta.title`: unique, decision-oriented, normally 35–80 characters, with `titleBranding: 'none'`.
- `meta.description`: unique, approximately 120–180 characters, naming the principal trade-off.
- `heroIntro`: at least 140 characters, naming both official catalog marketing names and framing the decision.
- `quickVerdict`: a direct choose-A / choose-B recommendation of at least 120 characters.
- `topCards`: exactly four non-repetitive cards covering model A, model B, the key trade-off, and best workflows.
- `primaryLinks`: at least three canonical, locale-neutral links: both public model pages plus one published related comparison.
- `faq`: three to five pair-specific questions with unique questions and factual answers.

The localized navigation layer will continue to convert canonical English hrefs into localized routes. Override data must never contain `/fr/` or `/es/` prefixes.

## Pair-Level Editorial Decisions

### LTX 2.3 Fast vs OpenAI Sora 2 Pro

- LTX: up to 20 seconds, 1080p/1440p/4K, native audio, 16:9 and 9:16, from $0.04/s at 1080p.
- Sora Pro: up to 12 seconds, 720p/1080p/auto, native audio, text/image/reference workflows, $0.30/s at 720p and $0.50/s at 1080p.
- Verdict: LTX for economical high-resolution iteration and longer clips; Sora Pro for studio-grade Sora output and reference-led work.

### Google Veo 3.1 vs Wan 2.5

- Veo: current, up to 8 seconds, 720p/1080p/4K, audio, references, first-last frame, and extend.
- Wan 2.5: legacy, up to 10 seconds, 480p/720p/1080p, audio, text/image only, lower entry price.
- Verdict: Veo for polished final ads, 4K, and production controls; Wan for cheaper, longer legacy output when advanced controls are unnecessary.

### Kling 2.6 Pro vs Wan 2.5

- Both are legacy and reach 10 seconds with audio.
- Kling: fixed 1080p, cinematic dialogue positioning, $0.14/s with audio.
- Wan: 480p/720p/1080p, $0.05/s at 480p, broader low-resolution budget ladder.
- Verdict: Kling for 1080p dialogue and cinematic work; Wan for lower-cost drafts and resolution flexibility. Link toward current Kling and Wan routes without claiming either legacy route is unavailable.

### Google Veo 3.1 Fast vs Wan 2.5

- Veo Fast: current, 8 seconds, 720p/1080p/4K, audio, references, first-last frame, and extend; from $0.10/s at 720p with audio.
- Wan: legacy, 10 seconds, 480p/720p/1080p, audio, text/image only; from $0.05/s at 480p.
- Verdict: Veo Fast for current controls and higher-resolution production; Wan for inexpensive longer clips and simple generation.

### Luma Ray 2 vs Luma Ray 2 Flash

- Both are legacy, silent, reach 9 seconds and 1080p, and support text, image, video modification, and reframe.
- Catalog positioning distinguishes Ray 2 as the standard legacy Luma route and Flash as the faster draft route.
- Avoid invented price or quality percentages because neither is present in the catalog data used by the page.
- Verdict: Flash for faster drafts and iteration; Ray 2 for the standard legacy workflow when speed is not the priority.

### Kling 3 4K vs Kling 3 Standard

- Both are current, reach 15 seconds, support text/image and audio, and share 16:9, 9:16, and 1:1.
- Kling 3 4K: native-4K-only, $0.42/s provider base.
- Kling 3 Standard: 1080p, $0.126/s with audio or $0.084/s without audio.
- Verdict: Standard for cost-controlled drafts and approved 1080p work; 4K for final native-4K masters.

### Kling 2.5 Turbo vs Google Veo 3.1

- Kling: legacy, silent, up to 10 seconds, 720p/1080p, text/image plus image-to-image, $0.07/s base.
- Veo: current, audio, up to 8 seconds, 720p/1080p/4K, references, first-last frame, and extend.
- Verdict: Kling for inexpensive silent legacy drafts; Veo for polished current production, audio, references, and 4K.

### Seedance 2.0 vs Google Veo 3.1 Fast

- Seedance: up to 15 seconds, 480p through 4K, audio, references, video editing, extension, motion controls, and broad ratios; token-based price.
- Veo Fast: up to 8 seconds, 720p/1080p/4K, audio, references, first-last frame, and extend; resolution-based per-second price.
- Avoid claiming which is universally cheaper because Seedance uses dynamic token pricing.
- Verdict: Seedance for longer, reference-heavy editing workflows; Veo Fast for shorter fast iterations with a simpler price ladder.

### Luma Ray 2 vs Seedance 2.0 Fast

- Luma: legacy, silent, up to 9 seconds, 540p/720p/1080p, modify and reframe, broad ratios.
- Seedance Fast: current, audio, up to 15 seconds, 480p/720p, references, video editing, extension, motion controls, broad ratios.
- Verdict: Luma for a legacy 1080p modify/reframe workflow; Seedance Fast for current audio-ready reference, edit, and extend work when 720p is sufficient.

### Kling 2.5 Turbo vs Wan 2.6

- Kling: legacy, silent, up to 10 seconds, 720p/1080p, $0.07/s base.
- Wan: current, audio, up to 15 seconds, 720p/1080p, reference-video mode, $0.10/s at 720p.
- Verdict: Kling for inexpensive silent drafts; Wan for current general-purpose production requiring duration, audio, or video references.

## Fact-Sourcing and Claims

Claims must come from the current `frontend/config/engine-catalog.json`, visible comparison specs/pricing, existing model pages, and published related-comparison configuration.

Do not invent:

- generation-time percentages;
- quality scores not visibly rendered by the page;
- exact prices for Luma where the catalog does not expose them;
- a universal Seedance-versus-Veo price winner;
- discontinuation or removal claims for legacy models that remain available.

Legacy language may say `legacy`, `older route`, `current alternative`, or `upgrade path` because the catalog explicitly marks the relevant models as legacy.

## Internal-Link Strategy

Every page links to both compared model pages. The third link should support the next decision:

- a current successor comparison for legacy pairs;
- a same-family tier comparison for Kling and Luma;
- a related current competitor comparison for current-model pairs.

All comparison links must pass `isPublishedComparisonSlug`. All model links must resolve to catalog entries whose model page is indexable.

## Architecture

Use the established `ComparePageOverride` contract only. Modify:

- `compare-page-overrides-en.ts`
- `compare-page-overrides-fr.ts`
- `compare-page-overrides-es.ts`

Create one focused wave-2 contract test. Do not add rendering components, content builders, schema types, sitemap rules, or route logic.

## Test Design

The focused test must verify:

- all ten target slugs exist in all three override maps;
- every entry satisfies the complete content contract;
- titles and descriptions are unique within each locale;
- both official catalog marketing names appear in the combined page copy;
- French and Spanish are not copies of English;
- Spanish avoids the disallowed Spain-specific vocabulary;
- every model link targets an indexable catalog model page;
- every comparison link targets a published comparison;
- target pages remain published;
- no locale-prefixed href is embedded in override data.

Use TDD: the new contract must fail on missing overrides before any production content is added.

## Verification

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-ctr-migration-wave-2.test.ts
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/compare-page-architecture.test.ts
npm --prefix frontend run lint
npm run lint:exposure
pnpm test:validate
pnpm --prefix frontend run build
git diff --check
```

Smoke-check one target comparison in English, French, and Spanish. Confirm HTTP 200, localized title and verdict, canonical, hreflang, and JSON-LD.

## Non-Goals

- No sitemap, robots, canonical, hreflang, or publication-list changes.
- No noindex decisions.
- No new comparison videos or media.
- No pricing, scorecard, or engine-catalog changes.
- No generic template redesign.
- No new locale or `es-419` route.
- No modification of the historical GSC audit snapshot.
- No Studio or workspace changes.

## Rollout and Measurement

Publish the 30 localized overrides as one reviewable PR. After recrawl, compare clicks, CTR, impressions, and average position against the July 8 snapshot. Track the English target URLs separately from their French and Spanish counterparts, and evaluate whether legacy-to-current internal links improve downstream visits to current model pages.
