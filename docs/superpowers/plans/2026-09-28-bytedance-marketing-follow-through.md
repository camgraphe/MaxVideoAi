# ByteDance Marketing Follow-Through Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Seedance 1.5 safely, position Seedance 2.0 Mini and Fast accurately, and align public/acquisition surfaces with verified BytePlus capabilities, Draft workflow and approved customer prices.

**Architecture:** Audit first, then make localized, evidence-backed changes through the model registry and existing route/content owners. Use the `deep_legacy` archive contract for 1.5 unless search-intent evidence justifies the registry's single-target retirement redirect. Canonical quotes remain the source of displayed prices; media and SEO follow their existing contracts. Publish only features that are live and tested.

**Tech Stack:** Next.js App Router, TypeScript, localized JSON/MDX content, `@maxvideoai/pricing`, Node tests with `tsx`, browser smoke.

**Spec:** `docs/superpowers/specs/2026-09-28-bytedance-direct-pricing-and-marketing-design.md` (2026-09-29 withdrawal decision)

## Global Constraints

- The 1.5 closure/archive can ship separately after its generation and historical-reader checks, before 2.5 Draft or the manual pricing-grid cutover. Promote Draft and new price claims only after their respective release checks and reviewed customer prices.
- Keep canonical model identity/publication in `frontend/config/model-registry.json`; regenerate projections, never hand-edit them.
- Treat Mini as a candidate lowest-price **customer offer**, not 1.5's technical successor. Compare exact canonical live quotes for equivalent duration, resolution, audio and input scenarios before any "cheapest" claim. Fast is a separate speed/cost option; compare it as a possible redirect destination only against observed search intent. Keep 2.5 for supported 1080p/Draft needs.
- Do not promise Draft, Flash, authorized portraits, 4K Pro images, Seedance 1.5 availability beyond its published 2026-11-11 shutdown, or a price that the live product cannot deliver. Do not claim that Mini or Fast supports 1080p or Draft.
- Preserve public URLs, locale paths, canonical/hreflang, historical examples and original media links. A `deep_legacy` archive uses WebPage metadata without a current Product offer or generation CTA; any later 301 uses the authored registry contract and a relevant one-hop destination.
- Read `docs/engineering/model-registry.md`, `page-architecture.md`, `media-delivery.md`, `pricing-engine.md`, and the relevant SEO/marketing architecture tests before editing.
- Do not contact BytePlus support without the user's permission.

## Review Focus

- A 1.5 archive still offers generation or price, or saved jobs silently switch models: closure and historical-reader tests (Task 2).
- A universal 1.5 redirect points to Fast without proving relevance for price or 1080p/Draft queries: search-intent decision record (Tasks 1 and 2).
- Draft copy confused with the separate Fast/Mini models: explain the two-step Seedance 2.5 path accurately (Task 3 test).
- One locale has a capability or price missing from the others: EN/FR/ES parity check (Tasks 2 and 3).
- Pro image page advertises 4K although provider maximum is 2K: reject the claim (Task 3 test).
- JSON-LD or price cards show a stale amount after an approved policy change: exact canonical quote check (Task 3 test).
- Example video or poster does not load/first-play after promotion: browser and media check (Task 4 test).

---

### Task 1: Inventory and decision brief

**Files:**
- Create: `docs/marketing/bytedance-family-release-review.md` for a dated matrix of surface, current claim, verified capability, price source, action, locale, and publication gate.
- Test: read-only `pnpm model:registry:check`, `pnpm pricing:public-baseline`, and targeted page tests.

**Interfaces:** The review matrix references the exact canonical model IDs and records whether a claim is `live`, `tested-but-unpublished`, `historical`, or `unsupported`; each proposed copy or offer change links to a verified provider/API or canonical price source. A separate URL decision matrix records intent and destination per locale.

- [ ] Inspect home, catalogue, model pages, pricing, comparisons, examples, workflow pages, Studio onboarding, MCP/plugin guidance, SEO metadata and social previews in EN/FR/ES.
- [ ] Record the current and proposed claim for each surface; include 1.5 closure, Mini's budget candidacy, Fast's speed/cost positioning, 2.5 Draft/final, Seedream Lite/Pro resolution, Flash candidacy, and Seedream-to-Seedance continuity.
- [ ] Export read-only Search Console query/landing-page evidence for 1.5 pages, comparison pages and locale paths; record impressions, clicks, relevant backlinks and whether each page serves historical-model, low-price, speed or high-resolution intent. Inventory internal links and current canonical/hreflang/sitemap/robots signals. If Search Console access is unavailable, record the gap and retain the archive default rather than guessing a 301 target.
- [ ] Compare canonical customer quotes for genuinely comparable Mini, Fast, 1.5 and other live entry offers. Record supplier list, verified effective and observed cost separately; temporary provider promotions do not prove a lasting retail claim. No published superlative or customer-tariff change follows from this inventory alone.
- [ ] Run the read-only registry and pricing checks and get a release review of the matrix before editing published claims.
- [ ] Commit only the review brief.

### Task 2: Close Seedance 1.5 and publish a useful historical route

**Files:**
- Modify: `frontend/config/model-registry.json` and `content/models/{en,fr,es}/seedance-1-5-pro.json`; regenerate registry projections using `docs/engineering/model-registry.md`.
- Modify only affected CTA, discovery and localized comparison copy owners identified in Task 1; preserve historical example and media identities.
- Test: create focused Seedance sunset/discovery tests using the existing `tests/sora-sunset.test.ts`, `tests/sora-discovery.test.ts`, and `tests/sora-discovery-postgres.test.ts` contracts as precedent; run `tests/preflight-media-pricing.test.ts`, `tests/model-registry-parity.test.ts`, `tests/model-registry-redirects.test.ts` if a 301 is chosen, and affected workspace/Studio/MCP historical-reader contracts.

**Interfaces:** Default to `deep_legacy`: app/pricing/current-example publication off, model route and appropriate historical examples/comparisons retained, explicit EN/FR/ES archive content with Mini (budget subject to verified quote), Fast (speed/cost), and 2.5 (live 1080p; Draft only after its separate release) alternatives. Keep `successorId: null` unless a real successor is established. Existing saved jobs retain the recorded model/provider and ordinary status, playback, receipts and refunds. A `retired` replacement/301 is a separate decision requiring evidence that one destination satisfies the old URL's main intent.

- [ ] Write failing closure tests: new 1.5 preflight and generation reject before charge; app, pricing, examples discovery, Studio and MCP exclude 1.5; saved Fal/BytePlus job readers, refunds and historical example/watch routes still work.
- [ ] Write failing EN/FR/ES archive tests for factual closure text, distinct Mini/Fast/2.5 choices, no current Offer/Product or generation CTA, and valid canonical/hreflang/sitemap behavior. Keep comparison pages meaningful and historical media playable.
- [ ] Implement the `deep_legacy` transition and localized archive through the authored registry/content. Remove live 1.5 promotion across approved surfaces; do not silently select Mini or Fast for users. Regenerate projections and run `pnpm model:registry:check`.
- [ ] Decide from Task 1 evidence whether the archive remains the right permanent route. If a 301 later wins, document why Fast, Mini or 2.5 satisfies the page's dominant intent; use the registry `replacement` contract, test one-hop localized 301s, query preservation and no irrelevant destination, and update internal links, canonical/hreflang and sitemap.
- [ ] Run focused tests, pricing/public baselines, lint, `pnpm lint:exposure`, `git diff --check`, and browser smoke for EN/FR/ES archive, comparison, example, workspace and library paths before release. Record the rollout and the pre-2026-11-11 shutdown verification date.

### Task 3: Factual localized content and quote projections

**Files:**
- Modify only the approved entries under `content/models/{en,fr,es}/`, `frontend/lib/examples/modelLandingData.{en,fr,es}.ts`, and the relevant colocated marketing components/content.
- Modify `frontend/config/model-registry.json` only for an approved publication or lifecycle change; regenerate its projections per the guide.
- Test: `tests/seedance-2-5-marketing-page.test.ts`, `tests/seedance-seedream-workflow-copy.test.ts`, `tests/pricing-public-projection.test.ts`, `tests/model-registry-parity.test.ts`, plus affected page architecture tests.

**Interfaces:** Copy identifies 2.5 Draft as a separately billed 480p preview followed by an optional 1080p new render; it does not call it an upscale or guarantee frame identity. Price displays use exact canonical scenarios and omit unsupported scenarios. Mini may be called the least expensive only for explicitly compared and verified live customer quote scenarios; Fast remains a separate choice.

- [ ] Add failing assertions for approved EN/FR/ES claims and existing inaccurate Pro 4K copy; assert 2.5 Draft versus Fast/Mini distinction, Mini's exact quoted price scope, Fast's supported capability, and quote provenance.
- [ ] Run the focused tests; require failures on the new assertions.
- [ ] Edit only reviewed claims and offer surfaces; regenerate model projections if the authored registry changes, and avoid replacing historical example labels.
- [ ] Run focused tests, registry check, public-pricing baseline, lint and `git diff --check`; commit only Task 3 files.

### Task 4: Browser, media, SEO and AI-search acceptance

**Files:**
- Test: affected public route, SEO, hreflang, sitemap, examples and media contract tests; add focused tests only for a newly created behavior boundary.
- Update: `docs/marketing/bytedance-family-release-review.md` with actual verification and remaining exclusions.

**Interfaces:** Published pages match live capability and approved quotes in all locales; example links, original downloads, first Play, canonical/hreflang and structured data remain valid. Crawlable factual pages support ordinary web search and AI search without unsupported markup or ranking promises.

- [ ] Smoke-test representative EN/FR/ES archive, Mini, Fast, 2.5, pricing, comparison, example and workflow routes in a browser; capture visible quote and Draft copy against current product behavior.
- [ ] Check final HTML and HTTP behavior for 1.5, Mini, Fast and 2.5: status/redirect, canonical, hreflang, sitemap, robots, internal links, social preview, visible structured data, watch-page video and first Play. Verify Googlebot and OAI-SearchBot can access intended public pages under the actual robots/WAF policy; do not change training-crawler policy by implication.
- [ ] Run affected SEO/hreflang/sitemap/structured-data and media contract tests, `pnpm model:registry:check`, `pnpm pricing:public-baseline`, and the media guide's checks for any changed assets.
- [ ] Record pre/post release Search Console indexing, impressions, clicks and query mix for historical and alternative pages; review AI-search referral/citation evidence when available without promising inclusion. Exclude any unlaunched Flash/portrait/Draft claim.
- [ ] Commit the acceptance record and any focused fixes; this is the final gate for marketing promotion.

**Search guidance:** <https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes>, <https://developers.google.com/search/docs/fundamentals/ai-optimization-guide>, <https://developers.google.com/search/docs/specialty/international/localized-versions>, <https://developers.google.com/search/docs/appearance/video>, <https://developers.openai.com/api/docs/bots>.
