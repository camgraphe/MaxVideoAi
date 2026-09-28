# Video discovery implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship the selected four-format video gallery, complete pagination, a useful watch/reuse experience and coherent admin curation.

**Architecture:** Public pagination is a read-only SQL catalog projection, with count, order and page membership evaluated together before hydrating media. Typed opening slots extend opt-in curation. The existing standalone watch URL remains the SEO authority; a gallery dialog adds fast exploration using shared public data, media controls and canonical quote owners.

**Tech Stack:** Next.js App Router, React, TypeScript, PostgreSQL, existing public playback and pricing owners.

**Spec:** docs/superpowers/specs/2026-09-28-video-discovery-phase-zero.md

## Global Constraints

- Isolated worktree based on main; no changes to the shared Desktop checkout or production data.
- Fixed opening: 16:9 hero, 9:16 portrait, two landscape 2:1 preview frames. Original watch/download/schema sources remain intact.
- 24 results per logical page; four opening videos count within that page. No implicit 120/400 catalog cap.
- Public eligibility and exclusions apply before count/order/page. Configured empty collections remain empty. Missing curation schema preserves legacy readers.
- Preserve canonical watch URLs, redirects, localized family routes, hreflang, schema, sitemap semantics and full prompts.
- No catalog total in the top chrome; all current discoverable families accessible, full-width desktop links and horizontal mobile navigation.
- No prices on gallery cards. Prices appear only after opening the video. Recorded example cost is historical. Alternative prices use canonical quote owners with explicit scenario differences and compatible current app engines; no invented prices or copied private references.
- Automatic short previews: at most three desktop, one mobile, intent priority, global pause, visibility/reduced-motion/data-saver guards. No autoplay originals.
- No commercial policy changes, no manual generated-manifest edits, no claims of field CWV gains from lab measurements.

## Review Focus

- Deep pages and filters after thousands of entries: no cap, duplicate, skipped entry or partial total.
- A destination becomes private or a selected output is deleted between reads: never expose an ineligible item.
- Mixed portrait/landscape and long prompts on a narrow phone: readable, no overflow, actions reachable.
- A historical example uses an unavailable model or reference input: compatible alternatives only; do not imply equivalent output or silently copy references.
- Network/autoplay rejection, keyboard navigation and Back: stable poster, accessible focus, pause honored, predictable pagination.

### Task 1: Authoritative paginated catalog

**Files:** Create frontend/server/videos-catalog-page.ts; modify frontend/server/videos.ts; test tests/examples-catalog-pagination-postgres.test.ts.
**Interfaces:** `listCatalogPage({familyId?,engineAliases?,sort,limit,offset}): Promise<ListExamplesPageResult>` uses existing gallery mapping and curation aliases. Public route/API callers keep their existing listExamplesPage/listExampleFamilyPage signatures. Scoped homepage readers keep their existing request-scope contract.

- [x] Write a disposable-Postgres regression with 513 eligible rows, hidden/deleted rows, manual/hybrid/legacy feeds, exclusions and overlapping family sources. Assert total513 at limit24, last page9, no duplicates over22 pages, out-of-range empty still total513; filtering/sorting before page; only page-sized media hydration.
- [x] Run `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/examples-catalog-pagination-postgres.test.ts`. Expected: failure reproducing partial total before the implementation.
- [x] Implement SQL membership CTEs with curation/legacy source precedence, ID deduplication, stable sort with job ID tiebreak, count and offset/limit in the same statement. Retry missing curation relation only using legacy SQL; propagate other errors. Join BASE_SELECT media only for chosen IDs.
- [x] Re-run regression and existing home-examples read test. Expected: pass, no request-time writes.
- [x] Commit catalog implementation and test.

### Task 2: Four typed editorial slots and admin workflow

**Files:** lib/admin/playlist-curation.ts; server/playlists/curation-{service,store}.ts; additive Neon migration; admin/playlists placement components; admin/video-seo inventory; related tests and engineering guide.
**Interfaces:** Extend CurationDraft with optional `openingIds: [string,string,string,string] | null`; CurationItem with actual width/height and declared aspect. Preserve old snapshots without opening. Preview/save own format validation and same revision fingerprint. Catalog consumes selected opening order only for playlist sort.

- [x] Add failing tests for duplicate/excluded slot, wrong/unknown aspect, missing portrait, actual dimensions overriding declarations, old configuration compatibility and stale preview rejection.
- [x] Implement additive optional storage and typed four-slot selector, format filtering and desktop/mobile preview. Keep manual/hybrid and exclusions; selector can find a video once and link its publication/SEO detail.
- [x] Replace misleading indexed label with sitemap eligibility; preserve SEO approval/publication distinctions and canonical locks.
- [x] Run curation parser, admin curation Postgres, admin editor and video-SEO architecture tests. Expected: pass. Commit.

### Task 3: Production gallery and preview policy

**Files:** components/examples; examples route-local components/data and copy; examples architecture/playback/pagination tests.
**Interfaces:** SSR 24-card page, optional typed four-card opening. Existing URL page/sort/family builders remain owners; shared bounded preview controller requests useExampleCardPlayback.

- [x] Test SSR unique watch hrefs and source ratios, page2 without repeated hero, full current navigation, preview intent displacing an idle card, global pause and viewport guards.
- [x] Implement four-slot CSS geometry and ratio-preserving rows without client reflow of the critical opening. Preserve one prioritized poster and responsive sizes. Replace local load-more state with explicit crawlable page navigation and no top catalog count.
- [x] Integrate localized compact copy; preserve useful contextual SEO content after the video grid.
- [x] Run focused examples tests, typecheck and lint; smoke desktop1440/mobile390. Expected: pass and no overflow. Commit.

### Task 4: Watch dialog, compatible comparisons and app handoff

**Files:** shared public watch detail/alternatives projection; gallery dialog client; existing watch sections; workspace reuse owner only if needed; quote and acquisition tests.
**Interfaces:** Direct watch href always exists. Dialog loads public detail and canonical estimated quotes on demand; three alternatives maximum, same mode/aspect/audio and supported scenario preferred. Adaptations explicit. `buildExampleRecreationHref` serializes the explicit prompt-only comparison (from/engine/remix/mode/duration/resolution/aspect/audio). The captured request must preserve chosen settings through login and source hydration; original-job hydration is skipped for this explicit comparison. Ordinary from links keep the existing original recreation flow.

- [x] Test public/private detail boundary, approved public source images only, three distinct executable compatible alternatives, unsupported duration adaptations, no guessed price when unavailable, engine override after example hydration.
- [x] Implement dialog with original-format player, recorded cost/settings, visible copy prompt, model/watch links and primary app CTA; three comparison cards under the player. Use existing media controls and canonical DB-aware pricing orchestration.
- [x] Keep standalone watch page video-primary, server metadata and JSON-LD; share comparison presentation when relevant, not modal-only SEO.
- [x] Run pricing/read/acquisition/watch tests and desktop/mobile first-play, copy, Back and auth-link checks. Expected: pass, originals and private references preserved. Commit.

### Task 5: Acceptance, SEO and Core Web evidence

**Files:** engineering guide, evidence reports, only focused fixes if validation finds issues.
**Interfaces:** Candidate branch checked against current main; Core Web chat independently reviews relevant performance evidence.

- [ ] Run focused architecture/contracts, frontend lint/typecheck, exposure, offline public rendition check and git diff --check; then required CI suite/build.
- [ ] Compare prepared before/after identical pages and data, alternating cold/warm desktop/mobile runs; report LCP, CLS, media bytes and first Play separately. Block repeatable regressions; field INP remains a separate measurement.
- [ ] Verify canonical/hreflang/schema/localized links, page2 URL, watch redirects, empty/out-of-range and sitemap assumptions.
- [ ] Fresh whole-branch review under executing-plans. Fix meaningful findings with regression coverage.
- [ ] Create reviewable PR and attach it; production release follows deployment guide and authorized coordination only.
