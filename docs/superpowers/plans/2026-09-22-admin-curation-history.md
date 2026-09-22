# Admin curation and full transaction history implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the approved placement workflow and remove the loaded-sample limit from transaction search.
**Architecture:** Opt-in per-playlist curation state, one server eligibility/resolution owner reused by preview and public readers, optimistic revision guards. Preserve legacy feeds until an operator previews and saves a mode. A paginated transaction read owner applies filters before limiting; the existing refund command remains unchanged.
**Tech Stack:** Next.js, React, PostgreSQL, existing admin components and native drag controls.
**Spec:** docs/plans/2026-09-22-admin-redesign-brief.md

## Global Constraints
- English compact light admin; preserve manual drag ordering and keyboard alternative.
- No merge, production deployment, live data writes or pricing-owner changes.
- Public eligibility checked when resolving and saving; exclusions are local and precede all sources/limits.
- No blind conversion of existing playlists. Homepage/starter stay in existing manual workflows.
- Preview before explicit Save, Cancel restores saved state, stale revisions reject without changes.
- Ordered Neon migration, no request-time DDL. Missing new table preserves legacy public behavior and reports admin setup unavailable.
- No reliable media publication timestamp exists: automatic order is creation time descending then job ID.

## Review Focus
- Private/non-indexable/deleted/unplayable or wrong-model media never appear through automatic or featured paths.
- Exclusions survive inherited sources and pagination; empty configured results never revive legacy fallbacks.
- A stale admin cannot overwrite another save, including a legacy playlist change during initial adoption.
- Filter changes reset pagination and stale network responses cannot replace current results; receipt deep links resolve outside the first page.
- Refund metadata, eligibility and confirmation remain intact when querying old receipts.

### Task 1: Placement resolution and guarded persistence
Files: new server/playlists/curation-* owners, shared lib/admin/playlist-curation types/helpers, migration52, videos reader integration, public model fallback guard, relevant contracts/tests.
- [ ] Write failing disposable PostgreSQL tests for eligibility, manual/featured order, exclusions, ties, missing schema, stale revision, empty selection and atomic saves.
- [ ] Implement opt-in state, strict input validation and a single preview/public resolver. Guard legacy selection mutations after adoption. Integrate family/hub/model readers without changing legacy defaults.
- [ ] Run tests and relevant public-read architecture contracts; document migration and default-preservation behavior.
Expected: unchanged legacy output until explicit opt-in; safe deterministic configured output, all focused tests pass. Commit.

### Task 2: Placement editor
Files: new playlist PlacementEditor and hook/components, API curation preview/save routes, existing playlist manager integration.
- [ ] Add behavior tests for staged changes, pending lock, failed preview/save, stale save, destination navigation, Cancel and manual keyboard/native drag.
- [ ] Implement mode chooser, featured/manual ordered rows, automatic preview, exclusion/restoration, exact page link and preview-confirm-save sequence. Unsupported destinations keep existing manual editor.
- [ ] Test desktop and mobile through CUA on disposable fixtures; verify reload persistence and private-media removal.
Expected: automatic work visible and manageable without losing manual ordering; no site publication implied by selection. Commit.

### Task 3: Searchable transaction history
Files: server/admin-transactions history read module and filters, transactions API, client hook/table controls, admin route, focused PostgreSQL/UI tests.
- [ ] Add failing tests for matches older than100, stable tied timestamps, pagination, literal search wildcards, review flags, Madrid day boundaries and receipt deep links.
- [ ] Implement parameterized server filters (receipt/user/job/description/model/email via existing profile data), keyset pagination, Today/24h/all periods and explicit scope. Preserve identity enrichment and refund services.
- [ ] Add client pending/error/stale-response protection and shared URL filter state; inspect mobile table and browser search/pagination.
Expected: old receipts discoverable, filters apply before limit, refund invariants unchanged. Commit.

### Task 4: Qualification and handoff
- [ ] Focused admin/public/privacy/transaction tests, lint/type/exposure,130 pricing hashes/baselines, full build and Quality CI.
- [ ] One fresh independent whole-branch reviewer as required by executing-plans; fix important findings with regression coverage.
- [ ] Update PR332 and operating guide, retain draft/previews. No production changes.
Expected: clean branch, review and CI green, migration requirement and activation process explicit.
