# SEO Comparison High-Impression CTR Wave 3 Design

**Date:** 2026-07-11
**Status:** Approved for written-spec review
**Branch:** `codex/seo-comparison-high-impression-ctr-wave-3`
**Base:** `main` at `e3d44407da9c6448358bd2e98eea3c8da816adf3`

## Objective

Improve organic click-through rate and decision usefulness for the ten highest-impression English comparison pages that still rely on generic comparison copy and recorded a CTR at or below 1% in the July 8 Google Search Console snapshot.

The selected pages combine 51,745 impressions, 148 clicks, a 0.29% aggregate CTR, and a weighted average position of 9.6. This is approximately 37 times the impression volume of the next ten zero-click enrichment candidates, so this wave prioritizes recovery on pages Google already surfaces frequently.

The wave adds complete localized overrides in American English, natural French, and LATAM-neutral Spanish. It does not change which comparisons are published or indexed.

## Target Pages

| Comparison slug | Clicks | Impressions | CTR | Position |
| --- | ---: | ---: | ---: | ---: |
| `ltx-2-3-fast-vs-ltx-2-fast` | 30 | 12,049 | 0.2% | 9.9 |
| `ltx-2-vs-ltx-2-3-fast` | 19 | 6,588 | 0.3% | 10.5 |
| `ltx-2-vs-wan-2-6` | 9 | 5,846 | 0.2% | 10.7 |
| `ltx-2-3-fast-vs-seedance-2-0` | 47 | 5,218 | 0.9% | 5.9 |
| `ltx-2-3-pro-vs-ltx-2-fast` | 7 | 5,044 | 0.1% | 11.3 |
| `seedance-2-0-vs-wan-2-5` | 15 | 4,140 | 0.4% | 8.4 |
| `minimax-hailuo-02-text-vs-seedance-2-0` | 4 | 3,713 | 0.1% | 7.9 |
| `ltx-2-vs-ltx-2-3-pro` | 5 | 3,319 | 0.2% | 10.7 |
| `veo-3-1-vs-veo-3-1-lite` | 6 | 3,014 | 0.2% | 9.7 |
| `ltx-2-3-fast-vs-wan-2-5` | 6 | 2,814 | 0.2% | 10.6 |

All ten pages are classified as `keep` in `docs/seo/comparison-indexation-matrix-2026-07-08.json`, have no override in the current English, French, or Spanish override maps, and represent public comparison URLs already receiving impressions.

## Approaches Considered

### 1. Full high-impression CTR recovery — selected

Create 30 complete localized overrides for the ten pages above. Improve both the search snippet and the landing-page decision experience, with explicit stay-or-upgrade guidance where an earlier model remains available.

This approach covers 51,745 impressions and preserves the proven architecture of the first two localized comparison waves.

### 2. Five-page pilot

Enrich only the first five pages, covering 34,745 impressions. This reduces initial content volume but leaves more than 17,000 impressions on generic comparison copy and delays the same review and release process for a second batch.

### 3. Continue the zero-click queue

Enrich the next ten zero-click candidates, covering 1,382 impressions. This is consistent with the first waves but has roughly 37 times less reach than the selected recovery batch.

## Locale Strategy

### American English

- Use concise US product language and dollar notation.
- Lead with the searcher's actual decision: price, duration, resolution, aspect ratios, production controls, audio, or migration fit.
- Describe earlier models as available older workflows, never as discontinued or unavailable.

### French

- Adapt the decision logic naturally instead of mirroring English sentence order.
- Preserve official model names and familiar AI-video terminology.
- Use explicit, idiomatic language for `rester`, `évoluer`, `rendu final`, `brouillon`, `références`, and `workflow`.

### LATAM-neutral Spanish

- Follow `docs/seo/localization-notes.md`.
- Keep the route locale and hreflang as generic `es`; do not add a new locale route.
- Keep every occurrence of `video` unaccented.
- Avoid `vídeo`, `móvil`, `ordenador`, `monedero`, and `vosotros`.
- Use `quedarse`, `migrar`, `actualizar`, `borrador`, `toma`, `referencias`, and `flujo` naturally.

## Availability and Migration Language

Every compared model in this wave is marked `available` in the current engine catalog, including LTX Video 2.0 Pro, LTX Video 2.0 Fast, and Wan 2.5.

Seven comparisons contain an earlier model version:

- `ltx-2-3-fast-vs-ltx-2-fast`
- `ltx-2-vs-ltx-2-3-fast`
- `ltx-2-vs-wan-2-6`
- `ltx-2-3-pro-vs-ltx-2-fast`
- `seedance-2-0-vs-wan-2-5`
- `ltx-2-vs-ltx-2-3-pro`
- `ltx-2-3-fast-vs-wan-2-5`

Each localized page in that group must state:

1. that the earlier model remains available on MaxVideoAI;
2. who can reasonably stay on it;
3. who should move to the newer model or workflow;
4. the exact current comparison that helps with the next decision.

The copy must not say or imply that an available model is unavailable, removed, abandoned, discontinued, or inaccessible.

## Content Contract Per Locale and Page

Each of the 30 entries must contain:

- `meta.title`: unique, decision-oriented, 30–65 characters, with `titleBranding: 'none'` where needed;
- `meta.description`: unique, 120–170 characters, naming the principal trade-off;
- `heroIntro`: at least 140 characters, naming both official catalog marketing names;
- `quickVerdict`: at least 120 characters with a direct choose-A / choose-B or stay / upgrade recommendation;
- `topCards`: exactly four unique cards covering model A, model B, the key trade-off, and best workflows;
- `primaryLinks`: at least three canonical locale-neutral links, including both exact model pages and the required related comparison;
- `faq`: three to five pair-specific questions with unique questions and factual answers.

Titles, descriptions, hero introductions, verdicts, normalized card content, and normalized FAQ content must be unique within each locale. French and Spanish versions of every editorial block must differ from the English source after normalization.

## Pair-Level Editorial Decisions

### LTX 2.3 Fast vs LTX Video 2.0 Fast

- Both are available, include audio, reach 1080p/1440p/4K, and list the same per-resolution price tiers.
- LTX 2.3 Fast adds 9:16, start/end-frame control, and 24/48 fps options alongside 25/50 fps.
- Both models require 1080p at 25 fps for durations above ten seconds; this is a shared constraint, not a differentiator.
- Decision: choose 2.3 Fast for vertical delivery and newer framing controls; stay on 2.0 Fast when an established 16:9 workflow already fits the job.
- Related comparison: `/ai-video-engines/ltx-2-3-fast-vs-ltx-2-3-pro`.

### LTX Video 2.0 Pro vs LTX 2.3 Fast

- LTX 2.0 Pro is available, reaches ten seconds, supports 1080p/1440p/4K and 25/50 fps, and is limited to 16:9.
- LTX 2.3 Fast reaches twenty seconds subject to its duration/resolution/FPS constraint, adds 9:16, and has lower listed per-second tiers at each shared resolution.
- Do not claim that `Pro` proves objectively higher output quality.
- Decision: stay on 2.0 Pro for a familiar 16:9 production route; choose 2.3 Fast for lower listed cost, vertical delivery, and longer constrained clips.
- Related comparison: `/ai-video-engines/ltx-2-vs-ltx-2-3-pro`.

### LTX Video 2.0 Pro vs Wan 2.6

- LTX 2.0 Pro offers 1080p/1440p/4K, 25/50 fps, audio, ten-second clips, and 16:9.
- Wan 2.6 text-to-video offers 720p/1080p, optional audio, five to fifteen seconds, and exactly five ratios: 16:9, 9:16, 1:1, 4:3, and 3:4.
- Wan image-to-video offers 720p/1080p, optional audio, and five to fifteen seconds, but its aspect ratio follows the source image instead of exposing the text-mode ratio selector.
- Wan reference-video mode remains separate: it explicitly supports 16:9, 9:16, 1:1, 4:3, and 3:4, runs for five or ten seconds, and generates no audio.
- Decision: stay on LTX 2.0 Pro for high-resolution landscape output; choose Wan 2.6 for broader ratios, longer text/image clips, or video-reference workflows.
- Related comparison: `/ai-video-engines/ltx-2-3-fast-vs-wan-2-6`.

### LTX 2.3 Fast vs Seedance 2.0

- LTX 2.3 Fast supports 1080p/1440p/4K, audio, 16:9/9:16, and up to twenty seconds with the cataloged long-duration restriction.
- Seedance 2.0 supports 480p through 4K, up to fifteen seconds, audio, broad ratios, references, video editing, extension, and motion controls.
- Seedance uses token-based dynamic pricing; do not claim a universal price winner.
- Decision: choose LTX for direct, price-transparent high-resolution generation; choose Seedance for reference-heavy, edit, extension, or multi-ratio production.
- Related comparison: `/ai-video-engines/ltx-2-3-pro-vs-seedance-2-0`.

### LTX 2.3 Pro vs LTX Video 2.0 Fast

- LTX 2.3 Pro text-to-video and image-to-video offer only six, eight, or ten seconds. Its twenty-second ceiling belongs to audio-to-video, extension, or retake, not standard text/image generation.
- LTX 2.3 Pro also adds 9:16 and start/end-frame control.
- LTX 2.0 Fast remains available, supports 16:9 text/image generation, audio, up to twenty seconds, and lower listed price tiers than 2.3 Pro.
- Do not claim an unsupported quality percentage or speed multiplier.
- Decision: stay on 2.0 Fast for economical 16:9 generation; choose 2.3 Pro for advanced production modes and vertical delivery.
- Related comparison: `/ai-video-engines/ltx-2-3-fast-vs-ltx-2-3-pro`.

### Seedance 2.0 vs Wan 2.5

- Seedance 2.0 reaches fifteen seconds, 4K, broad ratios, audio, references, editing, extension, and motion controls with dynamic token pricing.
- Wan 2.5 remains available, reaches ten seconds, supports 480p/720p/1080p, audio, 16:9/9:16/1:1, and text/image generation with fixed resolution pricing.
- Decision: stay on Wan 2.5 for simple, price-transparent text/image clips; move to Seedance for references, editing, extension, motion control, longer clips, or 4K.
- Related comparison: `/ai-video-engines/seedance-2-0-vs-wan-2-6`.

### MiniMax Hailuo 02 Standard vs Seedance 2.0

- MiniMax Hailuo 02 Standard remains available, is silent, reaches ten seconds, supports 512P/768P, and has a simple listed per-second price.
- Seedance 2.0 adds audio, up to fifteen seconds, 480p through 4K, references, editing, extension, motion controls, and broader ratios.
- Avoid unsupported universal quality claims.
- Decision: choose MiniMax for inexpensive, simple stylized motion; choose Seedance for production requiring audio, higher resolution, references, editing, or longer clips.
- Related comparison: `/ai-video-engines/minimax-hailuo-02-text-vs-wan-2-6`.

### LTX Video 2.0 Pro vs LTX 2.3 Pro

- Both are available, include audio, and list the same 1080p/1440p/4K per-second tiers.
- LTX 2.0 Pro is a ten-second 16:9 text/image route.
- LTX 2.3 Pro text/image generation offers six, eight, or ten seconds; twenty seconds applies only to audio-to-video, extension, or retake. It also adds 9:16 and newer start/end-frame controls.
- Decision: stay on 2.0 Pro when its familiar 16:9 text/image workflow is sufficient; move to 2.3 Pro for vertical output, audio-led work, extension, retake, or start/end-frame control.
- Related comparison: `/ai-video-engines/ltx-2-3-fast-vs-ltx-2-3-pro`.

### Google Veo 3.1 vs Google Veo 3.1 Lite

- Both are available, include audio, reach eight seconds, support text/image, first-last-frame, and extension workflows.
- Veo 3.1 adds reference-image mode and 4K; its listed price is higher.
- Veo 3.1 Lite reaches 720p/1080p and has a substantially lower listed price ladder.
- Decision: choose Lite for budget drafts and approved 1080p delivery; choose standard Veo 3.1 for 4K or reference-image production.
- Related comparison: `/ai-video-engines/veo-3-1-fast-vs-veo-3-1-lite`.

### LTX 2.3 Fast vs Wan 2.5

- LTX 2.3 Fast supports audio, 1080p/1440p/4K, 16:9/9:16, and up to twenty seconds with the long-duration restriction.
- Wan 2.5 remains available, supports audio, 480p/720p/1080p, 16:9/9:16/1:1, and up to ten seconds.
- LTX has lower listed per-second pricing at the shared 1080p tier; Wan retains 1:1 and a lower-resolution entry ladder.
- Decision: stay on Wan 2.5 for existing simple workflows or 1:1/lower-resolution output; choose LTX 2.3 Fast for higher resolution, longer constrained clips, or lower listed 1080p cost.
- Related comparison: `/ai-video-engines/ltx-2-3-fast-vs-wan-2-6`.

## Internal-Link Requirements

Every page must link to both exact model pages:

- `/models/{left-model-slug}`
- `/models/{right-model-slug}`

It must also include the exact related comparison specified above. Before implementation, every comparison href must pass the current canonical publication helper, and every model href must resolve to an indexable catalog model page.

Override hrefs remain canonical and locale-neutral. The localized navigation layer continues to translate them into French and Spanish routes.

## Architecture

Use the established `ComparePageOverride` contract only. Modify:

- `compare-page-overrides-en.ts`
- `compare-page-overrides-fr.ts`
- `compare-page-overrides-es.ts`

Create one focused wave-3 contract test. Do not add rendering components, content generators, schema types, route logic, sitemap rules, or publication data.

## Test Design

Use TDD. The new contract must fail because all wave-3 overrides are absent before any production content is added.

The focused contract must verify:

- all ten target slugs exist in all three locale maps;
- every entry satisfies the complete content contract and exact length ranges;
- titles, descriptions, hero introductions, verdicts, cards, and FAQs are unique within each locale;
- every page includes both exact model links and its exact required related comparison;
- every model link targets an indexable catalog model page;
- every comparison link is canonical and published;
- all target comparison pages remain published;
- both official catalog marketing names appear in the combined copy;
- every French and Spanish block differs from its English counterpart;
- Spanish avoids the disallowed Spain-specific vocabulary and accented `vídeo`;
- the seven earlier-model comparisons state availability, staying, and migration in every locale;
- every earlier-model requirement binds the comparison slug to the exact earlier `modelSlug` and assigned related comparison, verifies the catalog entry is `available`, and requires each availability/stay/migration block to name that earlier model's catalog `marketingName`;
- all three locales state the LTX 2.3 Pro mode-specific durations, Wan 2.6 ratios per mode, and the shared long-duration constraint of both LTX Fast models;
- French wave-3 copy uses `images de début et de fin` or `contrôle début/fin`, never `images clés`;
- unavailable, removed, abandoned, or discontinued language is rejected for those available models;
- no locale-prefixed href appears in override data.

Existing comparison architecture tests must remain unchanged and pass.

## Verification

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-high-impression-ctr-wave-3.test.ts tests/compare-page-architecture.test.ts
npm --prefix frontend run lint
npm run lint:exposure
git diff --check origin/main...HEAD
pnpm --prefix frontend run build
```

The focused run must report 7/7 wave-3 and 17/17 architecture tests, or 24/24 total. The already-recorded 1705/1705 complete-suite run does not need to be repeated for this correction pass.

Smoke-check `ltx-2-3-fast-vs-ltx-2-fast`, `ltx-2-vs-wan-2-6`, and `ltx-2-3-pro-vs-ltx-2-fast` in English, French, and Spanish. Confirm numeric HTTP 200, localized content, self-canonical, four hreflang links, and JSON-LD output for all nine pages.

## Non-Goals

- No sitemap, robots, canonical, hreflang, or publication-list changes.
- No new `noindex` or redirect decisions.
- No new comparison media.
- No pricing, scorecard, or engine-catalog changes.
- No generic comparison-template redesign.
- No new locale or `es-419` route.
- No edits to the historical GSC or comparison-indexation snapshots.
- No Studio or workspace changes.

## Rollout and Measurement

Publish the 30 localized overrides as one reviewable batch. Preserve the July 8 snapshot as the baseline:

- 51,745 impressions;
- 148 clicks;
- 0.29% aggregate CTR;
- 9.6 weighted average position.

Measure at approximately 28 and 56 days after recrawl. Report clicks, impressions, CTR, and average position by target URL and locale. Track visits from earlier-model comparisons to their current related model and comparison pages without treating migration as evidence that the earlier models are unavailable.
