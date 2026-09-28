# Gallery Admin Destinations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every gallery and starter destination easy to find, safely curate, order, and preview without a 100-candidate or 2,000-video ceiling.

**Architecture:** A server projection maps current reader slugs to logical destinations and marks historical rows. The admin renders that projection with a compact selector and a paged curation editor. Preview uses the public reader's source precedence and deduplication in a read-only simulation; the existing revision/token transaction remains the only save path.

**Tech Stack:** Next.js App Router, React/TypeScript, PostgreSQL, Node test runner/tsx, JSDOM, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-28-gallery-admin-destinations-design.md`

## Global Constraints

- Work only on `codex/video-discovery` in its managed worktree; no production writes or deployment during implementation.
- Preserve `/examples`, `/examples/{family}`, `/models/{modelSlug}`, localized aliases, watch URLs, canonical/hreflang, JSON-LD, sitemap rules, media URLs, and existing reader output until an explicit curation save.
- Reuse `getExamplesHubPlaylistSlug`, `getStarterPlaylistSlug`, family/model slug helpers, model registry, and starter media constants; do not author a second client-side route map.
- Keep PostgreSQL playlists and curations; no migration or automatic row creation, rename, deletion, or republishing.
- Keep `manual`/`hybrid` persisted semantics and the authenticated `GET → POST preview → PUT token/revision save` boundary.
- Treat `examples`, `marketing-examples`, `welcome`, and `starter` as reserved historical/current slugs; configuration mismatch is read-only until deliberately reconciled.
- Four new family opening slots require unique eligible media in `16:9, 9:16, 16:9, 16:9` order; measured output dimensions win over declared aspect ratio.
- The public gallery remains paged at 24 cards and opening IDs appear once. Read nonsecret production settings only for the final compatibility audit.

## Review Focus

1. `EXAMPLES_PLAYLIST_SLUG` differs from an existing `examples` row: Task 1 tests missing active and historical existing entries, and rejects writes through both admin routes.
2. A search match sits beyond the old first 100 results or has duplicate timestamps: Task 3 tests stable cursor pagination and exact-ID lookup without a full-candidate response.
3. A family has over 2,000 inherited videos: Task 3 tests complete ID adoption while hydrating only the selected editor window.
4. A video changes visibility or measured format after preview: Task 5 tests token rejection and draft retention without changing public feed or Video SEO state.
5. A family/model/hub source overlaps or is curated while its parent is curated: Task 5 tests effective first 24, total, suppressed sources, and unique IDs against the actual reader.

---

### Task 1: Destination inventory and server protection

**Files:** Create `frontend/server/playlists/destinations.ts`, `frontend/server/playlists/destination-protection.ts`; modify `frontend/server/playlists/types.ts`, `runtime-meta.ts`, `mutations.ts`, `curation-store.ts`, `curation-service.ts`; test `tests/admin-playlist-destinations.test.ts`, `tests/admin-playlist-order-postgres.test.ts`, `tests/admin-playlist-curation-postgres.test.ts`.

**Interfaces:** `buildPlaylistDestinations(playlists: readonly PlaylistRecord[], effectiveCounts: ReadonlyMap<string,number>): PlaylistDestination[]`; `loadPlaylistDestinations(playlists: readonly PlaylistRecord[]): Promise<PlaylistDestination[]>` obtains effective hub/family totals through bounded one-card catalog reads and batches direct model counts. `isHistoricalCoreSlug(slug:string):boolean` and `assertDestinationWritable(db:QueryExecutor, playlistId:string):Promise<void>` live in `destination-protection.ts` so write guards do not import the catalog. `PlaylistDestination` has `id`, `kind`, `slug`, `playlistId`, `label`, `path`, `familyId`, `modelSlug`, `itemCount`, `publicCount`, `sourceSlugs`, `status: 'connected'|'missing'|'historical'|'unconnected'`, `editable`, `warning`. The server derives expected entries from current slug helpers and registry order; historical aliases are diagnostic rows, never active aliases.

- [ ] **Step 1: Write failing tests** named `projects_missing_and_historical_core_destinations` and `rejects_historical_core_writes`: assert `byId.get('examples')?.status === 'missing'`, `bySlug.get('examples')?.status === 'historical'` under a `marketing-examples` setting, `welcome` cannot be deleted or reordered, matching settings yield one connected entry per slug, and an empty family playlist reports inherited effective count greater than zero. Include whitespace/case variants.
- [ ] **Step 2: Run** `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-playlist-destinations.test.ts tests/admin-playlist-order-postgres.test.ts tests/admin-playlist-curation-postgres.test.ts`; expect new assertions to fail.
- [ ] **Step 3: Implement** the typed projection, reserved-slug predicate, and shared server write guard. Call the guard inside existing mutation transactions and curation preview/save; keep missing destinations read-only and preserve legacy writes for unrelated playlists.
- [ ] **Step 4: Run the same tests**; expect pass. Run `git diff --check`.
- [ ] **Step 5: Commit** `feat: project and protect playlist destinations`.

### Task 2: Compact destination navigation

**Files:** Modify `frontend/app/(core)/admin/playlists/page.tsx`, `frontend/app/api/admin/playlists/route.ts`, `frontend/components/admin/PlaylistsManager.tsx`, `frontend/components/admin/playlists/playlist-types.ts`, `PlaylistsSidebar.tsx`, `PlaylistsManagerSelectionPanel.tsx`, `PlaylistsManagerToolbar.tsx`; create `frontend/components/admin/playlists/DestinationSwitcher.tsx`; test `tests/admin-playlist-destination-ui.test.ts`, `tests/admin-playlists-architecture.test.ts`.

**Interfaces:** Route/page pass `PlaylistDestination[]` from Task 1 as `initialDestinations`; refresh API returns `destinations` with `playlists`. `DestinationSwitcher` takes `{destinations, selectedId, onSelect, disabled}` and renders five top groups: Examples, Starter video, Families, Models, Image / audio. `selectedId` is a logical destination ID; playlist ID is resolved only for a connected entry.

- [ ] **Step 1: Write failing JSDOM/architecture tests** named `opens_connected_hub_before_inventory` and `groups_models_by_family`: assert the connected hub is selected, `editor.compareDocumentPosition(longInventory)` is following at 688px, a missing hub shows a warning and selects a connected family, model buttons follow their family in registry order, slug/path search finds them, and a dirty draft blocks selection without confirmation.
- [ ] **Step 2: Run** `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-playlist-destination-ui.test.ts tests/admin-playlists-architecture.test.ts`; expect fail.
- [ ] **Step 3: Implement** the compact switcher and destination header with path, source chain, status/count, and live-page link. Move create/seed/raw details to a maintenance disclosure; render missing/historical diagnostics without edit controls. Keep `PlaylistsManager.tsx` under its 500-line architecture contract by placing selector state/UI in focused components.
- [ ] **Step 4: Run the same tests**; expect pass. Check a 688px admin screenshot and keyboard tab order in the local authenticated browser.
- [ ] **Step 5: Commit** `feat: guide playlist admin by destination`.

### Task 3: Paged candidates and unlimited ID adoption

**Files:** Create `frontend/server/playlists/curation-candidates-page.ts`, `frontend/app/api/admin/playlists/[playlistId]/curation/candidates/route.ts`; modify `frontend/app/api/admin/playlists/[playlistId]/curation/route.ts`, `frontend/server/videos-catalog-page.ts`, `frontend/server/videos-playlists.ts`, `frontend/lib/admin/playlist-curation.ts`; test `tests/admin-curation-candidates-postgres.test.ts`, `tests/admin-playlist-curation-postgres.test.ts`, `tests/examples-catalog-pagination-postgres.test.ts`.

**Interfaces:** `searchCurationCandidatesPage({slug,q,modelSlug,format,cursor,limit,exactId}, db?): Promise<{items:CurationItem[];nextCursor:string|null;total:number}>` with stable `(created_at DESC, job_id ASC)` cursor, limit clamped to 48, measured format filtering, and exact-ID lookup. `listCatalogMembershipIds({familyId?,offset,limit}, db?): Promise<{ids:string[];total:number}>` shares public source selection/order without media hydration; `listPlaylistVideoIds(slug,{offset,limit},db?)` does the same for direct playlists. Curation `GET` returns `snapshot`, complete `initialIds`, `selectedItems` for the first 48 IDs, `selectedTotal`, `removedCount`; no `candidates` array. The candidate endpoint accepts `ids` for a bounded selected window as well as search parameters.

- [ ] **Step 1: Write failing disposable-Postgres and route tests** named `pages_eligible_candidates_without_skips` and `adopts_2001_family_ids`: assert 101 distinct IDs are reachable, equal timestamps still order by `job_id`, `nextCursor` ends at null, exact-ID lookup finds its record, private/wrong-format rows are absent, a 2,001-item family returns `initialIds.length === 2001`, and curation `GET` hydrates no more than 48 rows. Assert non-admin receives 403.
- [ ] **Step 2: Run** `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-curation-candidates-postgres.test.ts tests/admin-playlist-curation-postgres.test.ts tests/examples-catalog-pagination-postgres.test.ts`; expect fail.
- [ ] **Step 3: Implement** paged SQL, ID-only family/playlist reads in 500-ID batches, selected-window lookup, and removal of `2000`/`2001` count guards from draft parsing and `GET`. Keep existing all-candidate server read for validated preview/save; do not send it to the browser.
- [ ] **Step 4: Run the same tests**; expect pass. Verify `GET` and candidate pages are read-only and bounded in returned media rows.
- [ ] **Step 5: Commit** `feat: page curation candidates and large selections`.

### Task 4: Guided four-slot and ordered-list editor

**Files:** Modify `frontend/components/admin/playlists/usePlacementEditor.ts`, `PlacementEditor.tsx`, `PlacementOpeningEditor.tsx`, `PlacementMediaList.tsx`; create `frontend/components/admin/playlists/PlacementCandidatePicker.tsx`; test `tests/admin-curation-editor.test.ts`, `tests/curation-opening.test.ts`.

**Interfaces:** The hook consumes Task 3's curation `GET` and candidates endpoint; it stores full ordered IDs but fetches metadata in 48-item windows. `PlacementCandidatePicker` exposes `{playlistId,draft,onAdd,onExclude,onChooseSlot}`. `PlacementMediaList` uses absolute positions so drag/keyboard moves work across selected windows without dropping IDs outside the visible window.

- [ ] **Step 1: Write failing JSDOM tests** named `edits_four_slots_and_paged_tail` and `retains_draft_after_rejection`: assert slots demand `16:9,9:16,16:9,16:9` without duplicate IDs, candidate page 3 exposes result 101, selected window 2 can move its first ID upward, saved hybrid mode reads “eligible new videos appended automatically”, Video SEO remains linked, and a 409 save leaves ordered IDs intact while disabling Save until a new preview.
- [ ] **Step 2: Run** `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-curation-editor.test.ts tests/curation-opening.test.ts`; expect fail.
- [ ] **Step 3: Implement** the guided slots, compact ordered rows, paged picker and windowed selected list. Preserve current poster-first rendering, measured-format validation, explicit exclusion semantics, and preview-before-save controls; never silently change `manual` to `hybrid`.
- [ ] **Step 4: Run the same tests**; expect pass. Inspect desktop and 688px local admin, including a 9:16 slot and pointer/keyboard ordering.
- [ ] **Step 5: Commit** `feat: guide gallery opening and ordering`.

### Task 5: Effective-page preview and stale-save safety

**Files:** Modify `frontend/server/videos-catalog-page.ts`, `frontend/server/playlists/curation-service.ts`, `frontend/lib/admin/playlist-curation.ts`, `frontend/components/admin/playlists/PlacementEditor.tsx`; create `frontend/server/playlists/curation-effective-preview.ts`; test `tests/admin-curation-effective-preview-postgres.test.ts`, `tests/admin-playlist-curation-postgres.test.ts`, `tests/examples-catalog-pagination-postgres.test.ts`.

**Interfaces:** `readEffectiveCurationPreview({playlistId,slug,draft}, db:QueryExecutor): Promise<{total:number;firstPageIds:string[];currentTotal:number;addedCount:number;removedCount:number;suppressedSourceSlugs:string[];openingFormats:Array<'16:9'|'9:16'|null>;warnings:string[]}>`. Extend `CurationPreview` with `effective` while retaining `items`, `revision`, `token`; build the token from draft, revision, eligible media, and effective summary. The catalog SQL accepts an optional in-memory curation override for hub/family using the same query/transaction; the model projection follows the direct playlist reader used by `/models/{slug}` and labels its current 200-example render cap. Default public reads remain unchanged.

- [ ] **Step 1: Write failing Postgres tests** named `preview_matches_published_catalog` and `stale_media_rejects_save`: assert preview `firstPageIds` equals the actual first 24 after save for hub/family, model preview matches its direct reader, totals and suppressed sources agree, duplicate job IDs occur once, zero or large removals show warnings, a new family curation without four valid opening IDs fails, and a changed visibility/format/source returns 409 without altering curation or Video SEO rows.
- [ ] **Step 2: Run** `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-curation-effective-preview-postgres.test.ts tests/admin-playlist-curation-postgres.test.ts tests/examples-catalog-pagination-postgres.test.ts`; expect fail.
- [ ] **Step 3: Implement** read-only effective projection inside preview and save transaction, actionable summary UI, and 409 stale-preview response. Keep the current public catalog call signature's default behavior and 24-item media hydration.
- [ ] **Step 4: Run the same tests**; expect pass. Confirm a rejected save leaves the draft and persisted feed intact.
- [ ] **Step 5: Commit** `feat: preview effective gallery before curation save`.

### Task 6: Integration, route isolation, and release audit

**Files:** Modify `docs/engineering/admin-routes.md`; test `tests/examples-route-architecture.test.ts`, `tests/examples-lcp-performance.test.ts`, `tests/server-playlists-architecture.test.ts`.

**Interfaces:** No new runtime API. Document destination statuses, active/historical slug reconciliation, safe preview/save, maintenance controls, and the read-only deployment checklist.

- [ ] **Step 1: Write failing integration assertions** named `admin_is_read_only_until_save` and `public_routes_keep_seo_and_media_owners`: assert admin GET issues no DDL/DML and public route files retain their canonical/JSON-LD/watch loaders. Record a manual browser checklist for 688px/desktop admin, hub/family/model pages, pagination, and first Play in the admin guide.
- [ ] **Step 2: Run focused route/architecture checks** `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/examples-route-architecture.test.ts tests/examples-lcp-performance.test.ts tests/server-playlists-architecture.test.ts`; expect any newly added assertion to fail before its final fix.
- [ ] **Step 3: Complete docs and any integration repair** required by the tests. Compare nonsecret production `EXAMPLES_PLAYLIST_SLUG`, `INDEXABLE_PLAYLIST_SLUGS`, `STARTER_PLAYLIST_SLUG` against live rows/readers **read-only**; document mismatches and leave environment/database unchanged. If access is unavailable, record the release gate as unresolved rather than guessing.
- [ ] **Step 4: Run** focused tests from Tasks 1–5, `pnpm --prefix frontend exec tsc --noEmit -p frontend/tsconfig.json`, `npm --prefix frontend run lint`, `npm run lint:exposure`, `git diff --check`, and local browser smoke checks. Compare before/after Core Web Vitals only if initial public loading changed. Expect all gates to pass or document a precise release blocker.
- [ ] **Step 5: Commit** `docs: record gallery admin destination contract` and request review of the branch/PR; do not merge or deploy.
