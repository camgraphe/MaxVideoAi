# Separate marketing media implementation plan

> **For agentic workers:** Use superpowers:executing-plans. Implement in this session; one independent whole-branch review follows verification.

**Goal:** Give admins one separate marketing-video library with autonomous copies, complete reusable generation settings and unchanged public page identities.

**Architecture:** Store one independently owned marketing publication per existing video ID, including an immutable recreation snapshot and a manifest of copied originals, previews, posters and references. Public read owners overlay ready publications over legacy jobs without changing route paths, IDs, editorial records or playlist membership. Existing source jobs and customer libraries remain untouched. Promotion is explicit and atomic after complete media preparation; deletion is refused while a publication has placements.

**Tech stack:** Next.js, TypeScript, PostgreSQL 17, existing S3 storage/HTTPS transport, React and the existing admin components.

**Spec:** User-approved discussion and `codex/v2v-phone-import:docs/superpowers/specs/2026-10-22-media-library-lifecycle-feasibility.md`, “Bibliothèque client et médias marketing séparés”, plus the explicit requirement not to change routes or break GSC.

## Global constraints

- Preserve public page routes, video IDs, canonical/hreflang paths, playlist ordering, editorial approval and sitemap eligibility. No redirects or route renames.
- A complete copy retains the original prompt, engine/mode, core/advanced settings, required references with roles/indices/segments, and private provenance. Never expose billing/provider secrets or original private references.
- Normal customer media deletion does not acquire marketing badges or restrictions. Marketing objects use a separate site-owned namespace.
- Reuse only loads settings; no generation or historical-price billing. Existing comparison links retain their text-only semantics.
- No physical source deletion, bulk migration, production schema change or production deployment during implementation.
- Schema is an explicit Neon migration. Enable the new read projection only after migration, using `MARKETING_MEDIA_ENABLED`; disabled operation preserves exact legacy reads.
- Existing static authored media placements are inventoried and retained; this change must not rewrite their config or purge their sources. Their migration remains explicit and verified.

## Review focus

1. A personal source is deleted or changes after promotion: public reads/reuse still use the complete saved publication (Tasks 2–3).
2. A reference is private, expired, missing or not copyable: no partial publication, no private-URL leak (Tasks 1–2).
3. Concurrent duplicate copy, source deletion, curation save or marketing deletion: no duplicate publication or dangling placement (Tasks 2–4).
4. Existing watch/example/model pages and text-only comparisons: same identities and eligibility before/after activation (Tasks 3, 6).
5. Copied settings with uncommon reference slots, sparse inputs or model-specific values: preserve values and hydration behavior (Tasks 1, 3).

## Task 1: Complete snapshot and media manifest

**Files:** `frontend/server/marketing-media/snapshot.ts`, `frontend/lib/marketing-media.ts`, `tests/marketing-media-snapshot.test.ts`.
**Interfaces:** `prepareMarketingSnapshot(source): MarketingCopyPlan`; `completeMarketingSnapshot(plan, copies): MarketingPublication`. The plan contains a bounded deduplicated media list and exact safe recreation settings. Completed publication rewrites only media references to verified copies.

- [ ] Write tests for prompt/core/advanced parity, references/roles/sparse slots, duplicate URLs, missing snapshots, nonportable provider state and rejection of unprepared files.
- [ ] Run focused test; observe missing implementation failure.
- [ ] Implement pure capture and completion; keep source snapshot/provenance separate from the public recreation payload.
- [ ] Run tests and commit.

## Task 2: Durable storage and transactional promotion

**Files:** `neon/migrations/78_marketing_media.sql`, `frontend/server/marketing-media/{store,copy,storage}.ts`, `tests/marketing-media-{copy,postgres}.test.ts`.
**Interfaces:** `promoteMarketingVideo({videoId, actorId, permissionConfirmed}, dependencies?)`; admin list/detail and guarded deletion services; dependencies use the existing query/transaction/storage boundaries.

- [ ] Write disposable PostgreSQL and storage-boundary tests: idempotency, incomplete copy, changed/deleted source, reference preservation, permission and active-placement deletion denial.
- [ ] Observe failures, implement site-owned bounded exact-byte copies and guarded atomic ready transition, then pass the suite.
- [ ] Capture original metadata and source fingerprint; keep prepared failures recoverable, never alter customer jobs/assets or billing.
- [ ] Commit with validation evidence.

## Task 3: Public compatibility and complete reuse

**Files:** `frontend/server/marketing-media/public-read.ts`, existing `videos*`, public playlist/starter read owners, `frontend/lib/video-preview-group.ts`, `WorkspaceSharedVideoSnapshot` helper and shared-video hydration hook; related tests.
**Interfaces:** `marketingVideoReader(db)` overlays ready publications under the original `app_jobs` read identity without extra read round-trips. `recreationSnapshot` is an explicit sanitized DTO property, independent of private job reads.

- [ ] Write enabled/disabled projection tests, delete source rows/assets and verify watch/catalog/playlist/SEO identity and settings remain intact.
- [ ] Implement overlay only at explicit public/admin-public read boundaries; preserve ordinary account/job reads.
- [ ] Hydrate complete published snapshots on normal reuse, while retaining `remix=1` comparison behavior and current quote calculation.
- [ ] Run focused DB, workspace and SEO tests; commit.

## Task 4: Existing admin write compatibility and placements

**Files:** marketing placement inventory/service, existing admin video visibility/moderation/thumbnail boundaries and curation save guard; tests.
**Interfaces:** Existing actions keep their URLs and target a marketing publication when present. Inventory reports public playlists, homepage, watch/editorial and authored static usages; active placements protect marketing deletion.

- [ ] Write tests for visibility/moderation routing, multiple placements, stale curation saves and source-independent share/read behavior.
- [ ] Add bounded guards and snapshot updates without changing SEO approval semantics or original source records.
- [ ] Run compatibility tests and commit.

## Task 5: Simple admin library

**Files:** new `/admin/marketing-media` page and route-local client, `/api/admin/marketing-media` collection/item endpoints, `frontend/lib/admin/navigation.ts`, contextual admin entry action; DOM/browser tests.
**Interfaces:** Single “Ajouter aux médias marketing” operation by video ID/link, explicit permission acknowledgement for externally sourced/customer media, list with preview/prompt/reuse and discreet placement icon. No customer UI changes.

- [ ] Test admin authorization, loading/error/retry, duplicate submission, copy/reuse and placement-protected deletion.
- [ ] Implement existing admin shell and controls; never fetch original videos until Play.
- [ ] Smoke-test real components on desktop/mobile and existing admin navigation; commit.

## Task 6: Verification, documentation and delivery preparation

- [ ] Document storage ownership, activation/migration/rollback and exact route/SEO compatibility gates in `docs/engineering/marketing-media.md`.
- [ ] Run focused tests, PostgreSQL integrations, TypeScript, frontend lint, exposure guard, production build and relevant existing public/browser suites. Broaden only for unresolved concerns.
- [ ] Independently review the complete branch, fix substantive findings with failing-then-passing tests, and record limitations.
- [ ] Commit, push a dedicated PR and attach it. Leave production unchanged until normal reviewed delivery.

## Baseline

Branch starts at `123128d9c` (`origin/main`). Focused existing workspace settings and model curation tests: 12 passed. SEO/share suites are part of final verification. Previous Luma/Modify work remains on its separate branch/PR498.
