# App experience — first functional upgrade

> Execution: use executing-plans, with a bounded data implementation delegated under subagent-driven-development and independent visual work in the current session.

> Superseded for visual implementation and final qualification by [2026-09-07-app-visual-refonte.md](2026-09-07-app-visual-refonte.md). This document records the first functional scope.

## Approved scope

Implement navigation → video creation → result → library on the current app. Preserve models, modes, references, exact prices, drafts, generation, auth and billing. Studio integration, autonomous editing and a new chat are separate future lots. Authoritative product framing: the private audit's `phase1-3f9b/LIRE-DABORD.md`, version 0.5.

## Global constraints

- Work only in this isolated worktree, on `codex/app-experience-first-lot`; preserve the other checkouts.
- Keep AppClient and page files as orchestrators and respect existing architecture contracts.
- Keep existing API fields compatible with Studio and library pickers. Preserve ownership and original media URLs.
- Use existing React, SWR, design tokens and components. No new dependency or broad persistence rewrite.
- Essential mobile actions have visible labels and fit the viewport. Advanced controls remain discoverable.
- Do not submit paid generations or mutate production data to validate this lot. Record fixture versus live evidence explicitly.

## Task 1: Library collection correctness

Own only `frontend/server/media-library*`, the two listing API routes, route-local library data/helper/mutation hooks and focused tests/docs. Do not edit LibraryPageClient, AssetLibraryBrowser or message dictionaries; coordinate their interface with the parent.

1. Read the current asset and output listing, cursor, records, schema and architecture contracts. Expose existing cursor pages additively from `/api/media-library/assets` and `/api/media-library/recent-outputs`, retaining `assets`/`outputs` arrays and existing callers.
2. Add bounded server search (`q`, maximum 200 characters) before pagination over actual existing label/prompt/filename/job-id fields where supported. Use parameterized SQL and retain user ownership and source/kind filters for current and legacy records. State supported fields accurately; no new DB schema or broad metadata dump in the API.
3. Make the library data hook use SWR infinite pages of 60 with cursor termination, deduplication, account-isolated cache keys, reset on kind/source/search/view changes and bounded inactive-view fetching. Expose `searchQuery`, `setSearchQuery`, `hasMore`, `loadMore`, `isLoadingMore`, existing mutation entry points and current assets. Retain current view error/loading indicators; prevent stale filter results from being actionable while new data loads.
4. Resolve `view=review&job=…` with an exact owned job filter independent of the first page; expose a clear way for the UI to clear the job filter. Parameter name to hook: `jobId`. Do not change generation or persistence.
5. Adapt mutation revalidation to the infinite query shape, preserving successful import/delete/save behavior. Parent will wire the UI props and controlled search.
6. Add meaningful regression coverage for >100 results, cursor termination/equal timestamps, search beyond page one, cross-user/filter isolation, wildcard escaping and exact old-job lookup. Prefer executable SQL/fixture tests where available; do not claim SQL correctness from regex contracts alone. Run related library contracts and type-check; record exact commands and limits.

## Task 2: Navigation, creation and results UI

1. Make authenticated mobile workspace destinations explicit through a compact labelled navigation and a complete workspace menu; avoid marketing menu replacing app navigation. Preserve public navigation.
2. Inspect the actual generator and result layout. Clarify creation hierarchy, model/mode identity, prompt/references and essential settings; retain the generation price/action and all advanced functions.
3. Wire library cursor/search interface. Consolidate mobile actions, retain import/refresh/create access, simplify card metadata, show named actions and search/filter states without sideways scrolling. Keep exact downloads and lazy grid readers.
4. Fix result lightbox focus entry, containment, Escape and focus restoration using an existing primitive or native modal. Keep visible Close and primary result actions on narrow screens.
5. Translate new UI copy in EN/FR/ES, with existing fallback conventions. Respect reduced motion and keyboard operation.

## Task 3: Qualification and review

1. Run affected architecture/behavior tests, lint, exposure lint, TypeScript and diff checks. Run full validation if changing generation/polling/persistence.
2. Use local app/controlled fixtures to inspect desktop and mobile (390 and narrow widths): navigation, model/menu open, references, results, library >100, search, loading/error/empty states and keyboard focus. Preserve evidence in ignored output. Do not imply fixture tests prove live auth, paid generation, Safari or field performance.
3. Collect comparable baseline/candidate loading evidence for initial-layout changes where runnable; treat unresolved performance evidence as a rollout qualification, never as a proven gain.
4. Review the complete diff, fix material issues, document implemented behavior and remaining rollout checks. Keep the branch reviewable without deployment or merging.

## Progress

- Baseline: 17 relevant existing contracts pass; isolated worktree clean at `1fe1d1aa` before edits.
- Dependency setup reuses installed local dependencies through ignored symlinks; no lockfile changes.
- Task 1: complete; cursor/search and PostgreSQL validation integrated.
- Task 2: complete; extended by the visual refonte plan.
- Task 3: final qualification tracked in the visual refonte plan.
