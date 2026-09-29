# Current Public Example Prices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a current, correctly qualified model price on every public example surface while preserving the amount historically paid for the render.

**Architecture:** A shared server projection turns a stored `GalleryVideo` into an exact current quote, a labeled current reference quote, or no price. It calls the DB-aware canonical public quote owner and never uses `finalPriceCents` as a public fallback. Each public route consumes that projection; the stored job and receipt remain unchanged. The projection continues to work when the all-model manual-tariff plan replaces the quote resolver.

**Tech Stack:** TypeScript, Next.js App Router, `@maxvideoai/pricing`, node:test/tsx, EN/FR/ES dictionaries.

**Spec:** `docs/superpowers/specs/2026-09-29-unified-model-tariffs-and-current-example-prices-design.md`

## Global Constraints

- Keep `final_price_cents`, `pricing_snapshot`, receipts, refunds and the archived launch-example prices unchanged.
- Resolve the original model identity; never silently substitute a successor or quote a model unpublished from the app.
- An exact label requires all tariff-relevant recorded settings. A reference label names its mode, duration and resolution. Missing current quotes produce no numeric price.
- Use `computeCanonicalPublicSnapshot` or its successor. Do not calculate customer prices in UI components, SEO copy or route handlers.
- Preserve public URLs, localized paths, canonical/hreflang, JSON-LD ownership and media playback behavior.

## Review Focus

- A historical Kling job whose paid amount differs from today's quote shows today's quote publicly and the historical amount only in internal history (Task 1, Task 2).
- A job with missing resolution, paid references or input-video duration does not claim its old settings yield an exact price (Task 1).
- A retired/unpublished original model has no numeric current price and is not priced as its successor (Task 1, Task 2).
- A pricing database outage cannot make an old paid amount reappear as a current price (Task 1, Task 2).
- A gallery of 120 videos does not issue 120 duplicate tariff/database reads for repeated scenarios (Task 1, Task 2).

---

### Task 1: Shared current-example price projection

**Files:**
- Create: `frontend/server/current-example-price.ts`
- Create: `tests/current-example-price.test.ts`
- Inspect: `frontend/server/watch-page-signals/snapshot.ts`, `frontend/server/videos-normalization.ts`, `frontend/src/config/falEngines.ts`

**Interfaces:**
- `type CurrentExamplePrice = { kind: 'exact' | 'reference'; amountCents: number; currency: string; modelId: string; scenarioLabel: string; revision?: string } | { kind: 'unavailable'; modelId: string | null }`
- `type CurrentExampleQuoteDependencies = { quote?: typeof computeCanonicalPublicSnapshot }`.
- `quoteCurrentExamplePrice(video: GalleryVideo, dependencies?: CurrentExampleQuoteDependencies): Promise<CurrentExamplePrice>`.
- `quoteCurrentExamplePrices(videos: readonly GalleryVideo[], dependencies?: CurrentExampleQuoteDependencies): Promise<Map<string, CurrentExamplePrice>>` deduplicates by normalized model and exact/reference scenario within one request.

- [ ] Write failing tests for exact complete settings, incomplete paid references, missing resolution, retired model, price-source outage and two identical scenarios; assert that `finalPriceCents` is never read for the public result and that one quote call serves duplicate scenarios.
- [ ] Run `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/current-example-price.test.ts`; expect failure for the missing module.
- [ ] Implement model identity through registry/Fal catalog, conservative saved-setting validation, one documented same-model reference preset, and the DB-aware canonical quote. Never pass private media URLs to public output. Return `unavailable` on unsupported or failed current quote.
- [ ] Re-run the focused test and `tests/launch-example-pricing.test.ts`; both must pass, with the historical normalization unchanged.
- [ ] Commit the projection and tests.

### Task 2: Homepage, gallery API and model-page cards

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/examples.ts`, `hero.ts`, `launch-promotions.ts`, `frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx`
- Modify: `frontend/app/api/examples/route.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media.ts`, `page.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-video-showcase.ts`
- Modify: card/hero types and labels only where needed to carry `kind` and `scenarioLabel`
- Test: `tests/homepage-real-examples-preview.test.ts`, `tests/home-route-architecture.test.ts`, `tests/examples-route-architecture.test.ts`, `tests/examples-commercial-copy.test.ts`, `tests/payg-page-content-contract.test.ts`

**Interfaces:**
- Routes/loaders pass `ReadonlyMap<string, CurrentExamplePrice>` into synchronous card builders; `loadHomepageExamples` and gallery fetchers obtain it through `quoteCurrentExamplePrices` after video selection.
- A shared formatter returns localized `Current price …` or `From … · mode/duration/resolution` and `null` for unavailable. Components receive presentation, never a historical cents field.

- [ ] Add behavior/contract assertions that homepage cards, programmed hero, `/api/examples`, model cards and PAYG showcase use the current projection; a differing historical amount must not appear in their price labels.
- [ ] Run the listed focused tests; expect only the new assertions to fail.
- [ ] Wire the projection at server loader boundaries. Remove historical price and authored monetary fallback paths on these public surfaces. Keep current quote batching after final video selection, and label reference quotes with their scenario.
- [ ] Run the focused tests, `pnpm pricing:public-baseline`, and representative EN/FR/ES page smoke checks; investigate any amount or route regression.
- [ ] Commit the public card integration.

### Task 3: Watch page and localized explanatory copy

**Files:**
- Modify: `frontend/server/watch-page-signals/content.ts`, `derive.ts`, `frontend/server/video-seo.ts`, `frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/examples/page.tsx`, `examples/[model]/page.tsx`, `examples/_lib/examples-page-copy.ts`, `frontend/messages/en.json`, `fr.json`, `es.json`
- Modify: `frontend/server/pricing-admin/revalidation.ts` if the tariff plan has not already added home/example/watch invalidation
- Test: `tests/watch-page-signals-architecture.test.ts`, `tests/examples-commercial-copy.test.ts`, `tests/home-seo-signals.test.ts`, `tests/launch-example-pricing.test.ts`

**Interfaces:**
- The watch-page data owner supplies `CurrentExamplePrice` to the page or derived signals; `buildDetailRows` remains presentation only. No public `cost` row is populated from `video.finalPriceCents`.

- [ ] Add failing tests for a changed current price on watch details, unavailable old model, EN/FR/ES copy and preservation of historical receipts.
- [ ] Run the focused tests; expect the new assertions to fail.
- [ ] Add the current quote to the watch read path, replace the historical cost chip/detail and revise visible/SEO copy to describe current pricing accurately. Update invalidation for affected example/watch paths without changing canonical/media behavior.
- [ ] Run focused tests, `pnpm --prefix frontend run i18n:check`, `pnpm --prefix frontend run seo:check`, `pnpm --prefix frontend exec tsc --noEmit --pretty false`, lint and `git diff --check`; smoke-test one old render and one complete current render in the browser.
- [ ] Commit the watch-page and copy integration.
