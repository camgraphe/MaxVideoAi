# App workspace convergence implementation plan

**Goal:** Bring Creation, Media, Activity and Tools into the approved app concept while retaining useful production functionality.
**Architecture:** Existing route orchestrators and SWR feeds; shared presentational media action panel with callbacks; route-owned data and compatibility. App-scoped styles and existing icons/brand assets.
**Tech stack:** Next.js, React, TypeScript, SWR, CSS, existing test runner.
**Spec:** `docs/superpowers/specs/2026-09-07-app-workspace-convergence.md`
**Baseline:** `cd7d3e819`, isolated branch `codex/app-catalogue-validation`.

## Global Constraints

- Keep the complete real catalogue, family ownership, compatibility guards, account isolation, drafts, pagination, original download/reuse assets and existing useful actions.
- Follow `docs/design/global-app-concept/visual-rules.md` and `integration-contract.md`; enrich the concept for real functionality without restoring dense legacy chrome.
- Use app-scoped styles, local Geist, existing app/provider icons, accessible names, visible focus, reduced motion and minimum 44px touch targets. Essential actions remain discoverable on mobile.
- No paid generation, production writes, deployment, model policy, billing or Studio changes. Preview only through the existing guarded localhost:3026 disposable database setup; do not read or print secrets.
- No new state library or dependencies. Preserve media preview/original roles and lazy playback. Never invent metrics or supported destinations.
- Inspect nearest AGENTS and architecture contracts before moving ownership. Keep route files as orchestrators. Update contracts for intentional ownership changes and use behavioral tests for changed logic.

### Task 1: Creation controls and model browser

**Files:** `frontend/src/styles/app-experience.css`; `frontend/src/components/ui/engine-select/EngineSelectDropdown.tsx` and focused sibling copy/style helpers; `frontend/app/(core)/(workspace)/app/_components/WorkspaceCreationHeading.tsx`, `WorkspaceAppShell.tsx`; relevant engine-select/workspace shell contract tests.

1. Read the spec, visual rules and existing picker keyboard/registry contracts. Preserve the already uncommitted prompt-scrollbar improvement as part of this task.
2. Add one reusable app-local scroll surface treatment for the picker and later collection panels, with transparent track and discreet rounded thumb in both themes; preserve native scrolling and prompt resize.
3. Give the creation heading an optional action slot and move the mobile Recents opener into it. Keep its ref, accessible label, expanded/controls state, drawer focus return and 44px hit area. Desktop heading and image heading must remain valid.
4. Rework the model browser as a polished responsive surface: clear search, visible family navigation with brand icons, readable model names and selection state. Reduce repeated family/vendor/version text and tiny badges. Move explanatory score/capability metadata to a keyboard/touch-accessible detail surface without removing it. Retain catalogue totals/legacy visibility discoverably, live timing provenance, disabled reasons and all selection/search/keyboard behavior. Avoid simultaneous outer plus inner vertical scrollbars; use a bounded desktop split body and a mobile arrangement that fits the viewport.
5. Run focused engine-select coverage/family/architecture and shell contracts, lint/types. Record files, behavior and results in report, self-review and commit. Root performs live visual QA before task completion.

### Task 2: Media collection and contextual continuation

**Files:** `frontend/app/(core)/(workspace)/app/library/_components/LibraryPageClient.tsx`, related route-local library helpers; `frontend/components/library/AssetLibraryBrowser.tsx`, new focused shared media action component/helper if needed; `frontend/components/GalleryRail*.tsx`, grouped cards or their action owners; workspace recent role dialog and gallery action hooks where required; app-scoped CSS; focused library/gallery/reference contracts.

1. Inspect existing server pagination/search, saved-generated distinction, picker layout, reference role dialog and actual route hydration contracts before choosing handoff interfaces. Keep modal asset pickers intact when redesigning the page layout.
2. Make Médias a responsive visual collection: heading and import action, compact kind tabs/search/source controls, thumbnails first and restrained metadata. Keep source filters, pagination, saved/generated views, errors and job filters reachable. Do not invent names from absent data.
3. Provide a media action panel inspired by the concept's “Continuer avec ce média”, using a shared callback-driven presentation where genuinely reused. Offer preview/download and supported creation/tool/reference actions appropriate to kind. Retain save/deletion confirmation. Use actual original assets and existing validated handoff/role insertion; unavailable destinations are explained or omitted, never dead links.
4. Restore contextual reuse from gallery/recent media without breaking preview, grouped outputs, original recreation/settings actions or compatibility graying. Close and return focus correctly; support keyboard and touch without hover-only essential controls. Keep recent metadata validation and reference roles authoritative.
5. Add meaningful handoff/action eligibility tests and update ownership contracts if moved. Run focused library/gallery/reference tests and types/lint, self-review and commit. Root tests visual and actual handoff UI without generation.

### Task 3: Activity feed and loading

**Files:** `frontend/app/(core)/jobs/_hooks/useJobsPageController.ts`, `_components/JobsPageShell.tsx` and focused sibling presentation/helpers; `frontend/lib/api-jobs.ts` only if filter/account lifecycle requires it; Activity scoped CSS; `tests/jobs-page-architecture.test.ts` and focused feed behavior tests.

1. Inspect the seven existing surface feeds, useInfiniteJobs filter/account cache lifecycle and existing group viewer/actions. Record the baseline before changing data flow.
2. Use a single initial all-surface chronological paginated feed. Select media/tool source with compact accessible filters, including every real supported source. Do not fetch all category pages eagerly to calculate counts. Keep pagination, errors, empty states, pending job updates and account isolation; prevent previous filter results leaking into the next view.
3. Render a coherent app activity surface with bounded skeletons and visual outputs/status/actions, rather than stacked legacy horizontal rails. Preserve group viewer, save, manual refresh/retry and continuation/refinement/branch/compare actions.
4. Test feed source switching, all-source availability, account isolation and pagination/refresh behavior at existing meaningful seams. Update route contracts for the deliberate feed change. Run focused tests and types/lint, self-review and commit.
5. Root records comparable browser loading evidence and verifies no seven initial jobs requests, correct source selection and loaded/empty/error presentation. Do not infer Core Web Vitals gains from request count alone.

### Task 4: Tools catalogue and final visual convergence

**Files:** `frontend/src/components/tools/ToolsWorkspacePage.tsx`, focused tools hub copy/presentation helpers if warranted, app-scoped CSS, relevant tool navigation tests.

1. Inspect the five real tools, their labels and routes. Prototype tools are placeholders; apply the visual rules to actual tool functionality.
2. Replace nested heavy cards with a responsive visual catalogue: purposeful existing image covers or custom app pictograms, tool name, concise benefit, clear open action and useful grouping if justified. Keep all five destinations and locale behavior. Stable lazy image geometry, no autoplay/video load for decoration.
3. Match heading/filter/button treatment to Creation, Media and Activity. Check light/dark and mobile, preserving 44px actions and no clipping. Use the shared scroll treatment where relevant.
4. Run focused navigation/architecture checks, types/lint, self-review and commit. Root completes cross-screen screenshots, keyboard/mobile QA and exact data/behavior checks.
5. Stop only the owned dev preview, build using the secret-free validation launcher, then run full tests against the complete production manifest; restart guarded preview. Complete independent final increment review and retain isolated branch for user validation.
