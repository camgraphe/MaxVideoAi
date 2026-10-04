# Gallery Curation Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text-heavy playlist admin with a compact, visual gallery curation workbench while retaining the current server-owned eligibility and safe preview/save flow.

**Architecture:** Keep `PlaylistsManager` as the route UI orchestrator and `usePlacementEditor` as the draft controller. Compose small destination, opening, card, explorer, inspector, and action components around the existing curation APIs. Add only one lazy, read-only Video SEO status endpoint for the inspector.

**Tech Stack:** Next.js App Router, React client components, TypeScript, existing Tailwind/admin tokens, `useAccessibleModal`, Node test runner with `tsx`, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-29-admin-gallery-curation-workbench-design.md`

## Global Constraints

- Work only on `codex/video-discovery`; do not write to a production database or deploy.
- Keep the current admin language in product copy; the French mockup labels illustrate layout.
- Keep model identity in `frontend/config/model-registry.json`; do not create a second model catalogue.
- Keep public routes, 24-item hub/family pagination, watch SEO, sitemap, pricing, and gallery media contracts unchanged.
- Candidate search is server-filtered and cursor-paged at 48; the complete selected-ID order remains in memory while media hydrates in windows of at most 48.
- Save needs a current preview token and revision; a failed or stale save retains the draft and invalidates Save.
- Four opening sources remain unique and follow 16:9 / 9:16 / 16:9 / 16:9 when opening storage is supported.
- No initial mass video playback or eager original-video preload. Missing collections require explicit maintenance decisions.

## Review Focus

1. **A destination disappears or becomes missing during a dirty draft:** keep the current draft and disable the missing target; Task 1 tests this.
2. **An old candidate response arrives after a filter, slot, or destination change:** ignore it, reset the cursor, and do not add an ineligible ID; Task 4 tests this.
3. **A portrait poster lacks measured dimensions:** show an unknown-format state and do not offer it for a required 9:16 slot; Tasks 2 and 3 test this.
4. **A public gallery video has no approved Video SEO entry:** show `Not selected for Video SEO`, not `Approved` or `In sitemap`; Task 5 tests this.
5. **A save conflicts after a large removal:** retain the draft, show the effective removal warning, and require a fresh preview; Task 6 tests this.

---

### Task 1: Compact destination picker and diagnostic access

**Files:**
- Create: `frontend/components/admin/playlists/DestinationPicker.tsx`
- Modify: `frontend/components/admin/PlaylistsManager.tsx`, `frontend/components/admin/playlists/PlaylistsManagerSelectionPanel.tsx`, `frontend/components/admin/playlists/PlaylistsManagerToolbar.tsx`, `frontend/components/admin/playlists/PlaylistsSidebar.tsx`
- Test: `tests/admin-playlist-destination-ui.test.ts`, `tests/admin-playlists-architecture.test.ts`

**Interfaces:** Produce `DestinationPicker({ destinations, selectedId, disabled, onSelect }: { destinations: PlaylistDestination[]; selectedId: string | null; disabled: boolean; onSelect: (id: string) => void })`. Preserve `chooseInitialDestination` and the existing guarded `handleSelectDestination` owner.

- [ ] Write/adjust tests: one `data-destination-picker` precedes `data-destination-editor`; no separate current-destination header; search matches label, slug, family/model, and path; missing/historical entries show status and maintenance but cannot select; dirty switching remains guarded, including when a target becomes missing.
- [ ] Run `tsx --tsconfig frontend/tsconfig.json --test tests/admin-playlist-destination-ui.test.ts tests/admin-playlists-architecture.test.ts`; expect the new layout assertions to fail.
- [ ] Implement the picker with grouped searchable results, compact current label/count, live-page link, focus return, and concise diagnostic disclosure. Render it before the editor at every width. Retain `PlaylistsSidebar` only for the no-destination legacy path, and move source-chain details into a disclosure for connected curation while preserving legacy collection details.
- [ ] Run the same focused tests; expect pass, including zero mutation requests from selection/diagnostic browsing.
- [ ] Commit the destination UI and contracts.

### Task 2: Visual four-slot opening board

**Files:**
- Modify: `frontend/components/admin/playlists/PlacementOpeningEditor.tsx`, `frontend/components/admin/playlists/PlacementEditor.tsx`
- Test: `tests/admin-curation-editor.test.ts`

**Interfaces:** Keep `PlacementOpeningEditor`'s current props and `onChooseSlot(index: number)` callback. The parent opens the shared explorer with required format `index === 1 ? '9:16' : '16:9'`.

- [ ] Add tests that the four numbered cards appear before the continuation, use 16:9 / 9:16 / 16:9 / 16:9 source requirements, do not duplicate an opening ID in the tail, reject an unknown-format portrait source, and preserve unsupported-opening fallback.
- [ ] Run `tsx --tsconfig frontend/tsconfig.json --test tests/admin-curation-editor.test.ts`; expect the new board assertions to fail.
- [ ] Replace the text-first slot controls with a responsive visual board using existing selected posters and measured `curationItemFormat`. Clicking a slot calls `onChooseSlot`; preserve keyboard controls, mobile preview, remove/reset, and SEO handoff.
- [ ] Run the focused test; expect pass.
- [ ] Commit the opening board.

### Task 3: Selected media cards and global reorder

**Files:**
- Create: `frontend/components/admin/playlists/PlacementMediaCard.tsx`
- Modify: `frontend/components/admin/playlists/PlacementMediaList.tsx`, `frontend/components/admin/playlists/PlacementEditor.tsx`, `frontend/lib/admin/playlist-curation.ts`
- Test: `tests/admin-curation-editor.test.ts`, `tests/admin-playlist-order.test.ts`

**Interfaces:** Export `moveCurationIdToPosition(ids: string[], id: string, position: number): string[]` with one-based global position. `PlacementMediaList` keeps its existing props and adds `onInspect?: (id: string) => void`; the existing `onOrder(ids)` receives the complete order.

- [ ] Add tests for 145 selected IDs: moving item 1 to position 100 preserves every unhydrated ID, window navigation still displays 48 cards, keyboard up/down and drag use the same order, and Remove differs from Exclude. Assert portrait media is contained in the card frame and unknown format is labeled honestly.
- [ ] Run `tsx --tsconfig frontend/tsconfig.json --test tests/admin-curation-editor.test.ts tests/admin-playlist-order.test.ts`; expect the new assertions to fail.
- [ ] Implement the pure move helper and a responsive card grid with larger lazy posters, global position, concise metadata, one inspect action, and secondary menu actions. Keep selected-window hydration and adjacent-page drop behavior.
- [ ] Run the focused tests; expect pass.
- [ ] Commit the selected-grid change.

### Task 4: Contextual candidate explorer

**Files:**
- Create: `frontend/components/admin/playlists/PlacementExplorerDialog.tsx`
- Modify: `frontend/components/admin/playlists/PlacementCandidatePicker.tsx`, `frontend/components/admin/playlists/PlacementEditor.tsx`, `frontend/components/admin/playlists/usePlacementEditor.ts`
- Test: `tests/admin-curation-editor.test.ts`, `tests/admin-curation-candidates-postgres.test.ts`

**Interfaces:** `PlacementExplorerDialog` receives `{ open, slot, onClose, children }`; it uses `useAccessibleModal` and restores focus. `PlacementCandidatePicker` retains its current fetch/filter callbacks and mounts only while the explorer is open.

- [ ] Add tests for no candidate-page request before opening, a slot-2 request fixed to `9:16`, page-three cursor paging, filter/slot cursor reset, duplicate/excluded add refusal, and ignoring a stale response after closing or changing destination.
- [ ] Run `tsx --tsconfig frontend/tsconfig.json --test tests/admin-curation-editor.test.ts tests/admin-curation-candidates-postgres.test.ts`; expect the new client assertions to fail.
- [ ] Defer the initial general candidate fetch in `usePlacementEditor`; still hydrate selected and opening IDs by bounded exact-ID reads. Mount the picker inside a focus-managed drawer at current width, a full-width sheet on mobile, and a docked panel when the content area can hold both grids. Use candidate cards from Task 3, and keep server-side filters and 48-item cursors.
- [ ] Run the focused tests; expect pass.
- [ ] Commit the explorer.

### Task 5: Selected video inspector and lazy SEO state

**Files:**
- Create: `frontend/components/admin/playlists/PlacementMediaInspector.tsx`, `frontend/app/api/admin/video-seo/[videoId]/status/route.ts`, `tests/admin-video-seo-status.test.ts`
- Modify: `frontend/components/admin/playlists/PlacementEditor.tsx`
- Test: `tests/admin-video-seo-architecture.test.ts`, `tests/admin-curation-editor.test.ts`

**Interfaces:** Authenticated GET returns `{ ok: true, status: VideoSeoStatus | 'not_selected', inVideoSitemap: boolean }`, derived from `getSeoWatchVideoRowById`, with no prompt, media URL, or editorial document in the response. Inspector receives a `CurationItem`, `onClose`, `onRemove`, and `onExclude`.

- [ ] Add tests for unauthorized GET, selected approved/sitemap and selected draft/out-of-sitemap, no SEO entry, read failure, and exact `/admin/video-seo?video=<encoded id>` link. Assert opening/closing the inspector alone performs no SEO write or video load.
- [ ] Run `tsx --tsconfig frontend/tsconfig.json --test tests/admin-video-seo-status.test.ts tests/admin-video-seo-architecture.test.ts tests/admin-curation-editor.test.ts`; expect the new assertions to fail.
- [ ] Implement the read-only route with `requireAdmin` and the existing watch row owner; fetch only when the inspector opens. Show poster, prompt, engine, measured dimensions, gallery membership, distinct gallery eligibility and SEO state; mount the player only on explicit Play with `preload="none"`, and keep Remove/Exclude distinct. Use `useAccessibleModal` for Escape and focus return.
- [ ] Run the focused tests; expect pass.
- [ ] Commit the inspector and SEO status reader.

### Task 6: Persistent draft actions and effective preview

**Files:**
- Create: `frontend/components/admin/playlists/PlacementDraftActions.tsx`, `frontend/components/admin/playlists/PlacementPreviewDialog.tsx`
- Modify: `frontend/components/admin/playlists/PlacementEditor.tsx`
- Test: `tests/admin-curation-editor.test.ts`, `tests/admin-playlist-curation-postgres.test.ts`

**Interfaces:** `PlacementDraftActions` receives `{ dirty: boolean; busy: boolean; preview: CurationPreview | null; openingError: string | null; mode: CurationDraft['mode']; onModeChange: (mode: CurationDraft['mode']) => void; onCancel: () => void; onPreview: () => void; onSave: () => void }`. `PlacementPreviewDialog` receives `{ preview: CurationPreview; onClose: () => void }`; no component persists data directly.

- [ ] Add tests for `Saved`/dirty/preview-ready state, preview before Save, effective first-24 IDs and removal/suppressed-source warnings, unchanged draft after 409, disabled Save until a new preview, and successful snapshot confirmation before refresh.
- [ ] Run `tsx --tsconfig frontend/tsconfig.json --test tests/admin-curation-editor.test.ts tests/admin-playlist-curation-postgres.test.ts`; expect the new UI assertions to fail.
- [ ] Move controls from above the gallery into a compact sticky action bar. Show effective preview in a focus-managed dialog without changing `POST`/`PUT` ownership or token semantics. Keep legacy fallback and maintenance disabled while dirty.
- [ ] Run the focused tests; expect pass.
- [ ] Commit the action bar and preview.

### Task 7: Responsive browser proof and operating guide

**Files:**
- Modify: `tests/e2e/admin-critical-flows.spec.ts`, `docs/engineering/admin-routes.md`, `frontend/components/admin/playlists/DestinationPicker.tsx`, `frontend/components/admin/playlists/PlacementOpeningEditor.tsx`, `frontend/components/admin/playlists/PlacementMediaList.tsx`, `frontend/components/admin/playlists/PlacementExplorerDialog.tsx`, `frontend/components/admin/playlists/PlacementMediaInspector.tsx`, `frontend/components/admin/playlists/PlacementDraftActions.tsx`
- Test: `tests/admin-playlist-destination-ui.test.ts`, `tests/admin-curation-editor.test.ts`

**Interfaces:** No new production interface; this task records the final responsive and operational contract.

- [ ] Extend the existing admin Playwright fixture to assert the selector and opening board above the candidate inventory, no horizontal overflow at 688 × 900 and approximately 960 pixels, usable explorer/inspector at mobile and 1440 × 1000, Escape/focus return, and preview/save behavior without a real write.
- [ ] Run the focused Playwright test via `frontend/node_modules/.bin/playwright test -c playwright.admin.config.ts tests/e2e/admin-critical-flows.spec.ts`; expect the new assertions to fail before final CSS adjustments.
- [ ] Adjust responsive styles and update `admin-routes.md` with the workbench owners, paging, SEO read, missing-collection behavior, and safe preview/save flow.
- [ ] Run focused tests, `frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json`, `npm --prefix frontend run lint`, `npm run lint:exposure`, and `git diff --check`; expect all to pass. Compare initial admin media requests and first explicit Play before/after; record measurements without claiming a public Core Web Vitals gain.
- [ ] Commit the browser proof and guide update.
