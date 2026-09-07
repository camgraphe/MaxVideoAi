# Connected App Integration Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Execute tasks in order, with independent task review and a final review. Keep the existing isolated worktree.

**Goal:** Connect the approved global app direction to the real navigation, creation inputs and owned recent-media workflows without losing existing capabilities.

**Architecture:** Keep route orchestrators and all existing pricing, auth, generation, draft and media owners. Introduce focused app presentation components; shared components retain their non-workspace defaults. Reference insertion uses existing upload/library handlers and budgets, not the prototype's fixtures.

**Tech Stack:** Next.js 15, React 18, TypeScript, existing SWR, scoped CSS/Tailwind, local Geist, existing accessible modal primitive. No new dependencies.

**Spec:** `docs/design/global-app-concept/integration-contract.md`, `experience-map.md`, prototype and user feedback of 7 September (prompt boundary, reference roles, model families, visible Options, official logo, empty/pending reader and observed generation time).

## Global Constraints

- Work only in `codex/app-experience-first-lot`; no merge, push, deployment, paid generation or production data mutation for QA.
- Preserve every current model, mode, advanced field, input role, quantity, canonical price, draft, auth and billing contract. The prototype is a direction, not a reduced feature inventory.
- Use the official `/assets/branding/logo-mark.svg`; custom SVG pictograms use the prototype's geometric family. No generic placeholder monogram.
- Image, video and audio remain discoverable; Studio remains a separate branch and must not acquire a dead or fictitious live route here.
- Controls have visible names, >=44px touch targets, keyboard focus, Escape/restore for dialogs and reduced-motion support. No horizontal-only path to essential controls.
- Prompt has a visible label, input background/border and unclipped focus. References have a media pictogram and grow progressively. Options stays visually distinct in both themes.
- Marketing routes, their SEO and primitive styles outside `AppExperienceRoot` remain unchanged. App links to public pages preserve locale and open separately.
- Keep exact originals for input/actions and existing thumbnails for display. No eager media readers in recents. No private URL optimization or new server formula.
- No auth bypass, fixture data or test route may enter production. Record local fixture versus real-session evidence explicitly.

## Task 1: Real application shell, wallet and navigation

**Files:**
- Create `frontend/components/app/AppGlyph.tsx`, `AppSiteMenu.client.tsx`, `AppNavigation.client.tsx`, `app-navigation.ts`, `frontend/src/styles/app-shell.css`.
- Modify `frontend/components/HeaderBar.tsx`, `frontend/components/header/HeaderWalletStatus.tsx`, `WorkspaceMobileNav.tsx`, `frontend/components/AppSidebar.tsx`, `frontend/app/(core)/layout.tsx`, `frontend/src/styles/app-experience.css` only as needed for shell integration.
- Test `tests/app-navigation.test.ts`, `tests/app-experience-path.test.ts` and affected header/navigation contracts.

**Interfaces:**
```tsx
export type AppGlyphName = 'create' | 'image' | 'video' | 'audio' | 'library' | 'tools' | 'settings' | 'wallet' | 'reference' | 'prompt' | 'connect' | 'menu' | 'external';
export function AppGlyph(props: { name: AppGlyphName; className?: string }): JSX.Element;
// SVG is decorative; the owning button/link supplies its visible label.
```
Keep the `HeaderWalletStatus` public props and existing `useHeaderAccountState` authority. Navigation exports data/pure active-state selection separately from rendering, preserving `NAV_ITEMS` for its existing consumers.

- [x] Inspect the header's account/auth/service-notice, locale resolver, navigation feature flags and focus owner; record all destinations before replacing the app shell.
- [x] Add a behavior test for creation-route grouping, non-app exclusions and access to all existing destinations. Use fixtures including `/app`, `/app/image`, `/app/audio`, `/app/library`, `/jobs`, `/dashboard`, `/settings`, `/account/connections`, `/billing`; tools obey the existing flag.
- [x] Implement named primary navigation (Create, Media, Tools when available, Activity, Account) with activity tabs for Video/Image/Audio near the creator. A compact desktop rail and bottom mobile navigation share active selection. Account/dashboard/billing/history/connections and all existing tools retain a named complete-menu path. Do not invent a Studio destination.
- [x] Separate app site menu from marketing header. In app routes show the official logo/site trigger, Assistants link and real wallet/appropriate account-auth access. Site menu exposes localized public destinations in separate tabs, real account destinations, theme/language and close/focus behavior. Preserve marketing HeaderBar output outside app routes.
- [x] Promote ChatGPT and Claude with existing official local logos in the app header and visible connection guide links; retain Codex and all-assistant access. Keep localized new-tab guide navigation and no invented connection status.
- [x] Use existing wallet data with a persistent Wallet label and formatted balance; distinguish pending/unavailable from zero. Preserve billing navigation, auth return target, top-up and balance-refresh owner; do not add a second account fetch.
- [x] Replace old purple app presentation with approved cream/charcoal/saffron tokens under `.app-experience`, scoped shell CSS and geometric pictograms. Keep native account/auth state and brand colors in external provider marks.
- [x] Run focused tests, lint touched files, TypeScript and diff check. Commit only owned task files and write a task report. Root verifies actual browser geometry and visual consistency independently.

## Task 2: Creation input and model/action surfaces

**Files:**
- Shared `frontend/components/Composer.tsx`, `composer/composer-types.ts`, `AssetDropzone.tsx`, `asset-dropzone/AssetDropzoneSlot.tsx`; new focused components/helpers under `components/composer/` as justified by responsibility.
- Route-local `WorkspaceCreationHeading.tsx`, `WorkspaceComposerSurface.tsx`, `WorkspaceAppShell.tsx`, `WorkspaceChrome.tsx`, `WorkspacePreviewDock.tsx`; image counterparts after reading their nested AGENTS.md.
- Scoped `frontend/src/styles/app-experience.css`; tests `workspace-first-viewport-contract.test.ts`, `workspace-composer-surface-contract.test.ts`, relevant asset/composer contracts.

**Interfaces:** Preserve existing composer props and upload/library callbacks. Any additional presentation prop is optional and workspace-specific; default shared behavior remains unchanged. `AppGlyph` from Task 1 supplies input pictograms.

- [x] Read current schema/field/reference budgets and composer contract assertions before changing markup. Inventory visible mode toggles, advanced settings, quantity, error/loading/locked states and price output.
- [x] Add focused tests for progressive reference presentation (empty, one, multiple, capacity, required source), preserving each field's callback/role. Update exact layout assertions only where the approved visual behavior changes, retaining ownership guards.
- [x] Implement a real labelled Prompt/Script input with stable border/background/inset focus and no clipped resize/scroll edges. Reduce placeholder bulk while preserving upload locks, accepted-kind hints and errors. Use named Add/Manage actions with a reference glyph; never reserve a large empty card per theoretical reference.
- [x] Separate compact start/end image targets from image/video/audio collections according to the selected model schema. Keep optional end frame visible in a keyframe workflow; collection capacity grows progressively. Role names, replace/remove and touch alternatives stay explicit. Preserve the existing family/variant picker and its complete catalogue.
- [x] Preserve the current engine picker and live price owners. Make the chosen model and core settings immediately recognizable, Options visibly bordered/accented in both themes, quantity and canonical quote adjacent to Generate. No prototype catalogue or estimate is copied into production.
- [x] Arrange preview, inputs and actions as an app workbench. Keep the important price/action area accessible on narrow or short screens, preserve natural audio-reader dimensions, and keep advanced controls reachable by scrolling. Show a compact illustrated empty preview location without mounting a media element. Result caption describes the actual output; no permanent demo title. Pending occupies the preview location; Task 4 owns honest status/progress/ETA data.
- [x] Run affected composer/assets/image ownership tests, lint and TypeScript. Root exercises model/mode/settings/ref actions and all remaining fields before accepting the task.

## Task 3: Recent media to references

**Files:**
- Existing video `_hooks/useWorkspaceAssetLibrary.ts`, `_hooks/useWorkspaceReferenceAssets.ts`, `_components/WorkspaceAppShell.tsx`, `_components/WorkspaceComposerSurface.tsx`, route-local `_lib` asset-selection helpers.
- Add focused shared recent-media presentation under `frontend/components/library/` and route-local wiring where needed. Preserve AppClient as orchestrator.
- Relevant `tests/workspace-assets-*-contract.test.ts`, `tests/workspace-gallery-rail-contract.test.ts`, new focused insertion/normalization behavior test.

**Interfaces:** Presentation consumes existing owned media identities and an explicit insertion callback. Production selections must go through existing library-selection handlers; the prototype's `recentIds`, MIME type and illustrative roles are not a production API.

- [x] Trace current account-scoped media and recent-output listing, original/thumbnail roles and insertion handlers. Keep the generation activity rail available and distinguish recent reusable media from jobs still rendering.
- [x] Add a bounded recent list with image/video/audio filters, lazy thumbnails, empty/loading/error/retry and a named mobile opener. Use shared existing SWR keys/feed rather than parallel polling of the same account.
- [x] Add explicit reference insertion and an internal desktop drop shortcut only where the destination role/metadata can be validated by the existing owner. Multiple roles require a chooser; incompatible/full states explain the issue. Replacing an existing reference must preserve it until valid selection is confirmed.
- [x] Test incompatible types, shared/per-role limits, signed/original URL preservation, stale account/filter results and role selection using pure helpers/owned fixtures. Keep file uploads in their existing owner and never claim a local fixture proves live auth.
- [x] Preserve a destination-neutral card interface for future Studio project/canvas insertion. Document the Studio command boundary without adding a pretend success button or timeline mutation.
- [x] Run focused tests, lint and TypeScript; commit with a report. UI and MCP continue to share existing backend contracts.

## Task 4: Observed generation time and honest pending progress

**Files:** Existing `frontend/lib/render-eta.ts`, `api-engines.ts`, job/status types and adapters; route-local generation/render polling and preview owners; `frontend/server/generate-metrics.ts`, engine averages route and job status projection only where needed. Read provider and polling contracts before editing.

**Interfaces:** Prefer the measured average already projected as `EngineCaps.avgDurationMs`; retain an explicit fallback when unavailable. A provider-reported percentage is distinct from synthetic internal progress and from an ETA. Extend optional metadata only through existing owners; no duplicate polling or new pricing/submission authority.

- [x] Trace the admin measurement pipeline, averages API/cache, selected engine data and client ETA. Verify completed-duration units, aliases, sample availability and degraded behavior with existing tests or disposable fixtures. No production database write or schema setup for QA.
- [x] Connect observed duration to the creator's ETA and retain a clearly approximate fallback. Do not multiply an engine-wide average by invented mode/quality factors. Keep estimates non-blocking; distinguish total estimated duration from elapsed time and overdue state.
- [x] Display queued/processing/finalizing state and elapsed time in the pending reader. Display a percentage only when explicitly reported by the provider with known provenance. Preserve zero, reject non-finite values, bound percentages and prevent terminal-state regression. A successful status check may update a last-checked indication; network failure must not pretend generation is still freshly confirmed.
- [x] Preserve existing polling cadence/backoff, one outstanding request per job, chronological rail ordering, completion/media persistence, auth and billing. Do not hold an actually completed result behind an artificial ETA.
- [x] Add meaningful tests for measured/fallback ETA, zero/invalid/provider-vs-synthetic progress, stale/terminal transitions and degraded checks. Verify representative pending/overdue/error/completed UI with controlled local fixtures without paid generation.
- [x] Document measurement ownership and limits, run affected provider/generation/polling contracts, lint and TypeScript, commit and obtain independent review.

## Task 5: Browser qualification and integration review

User follow-up: complete the direct Départ / Fin / Ajouter presentation in the real reference owner, following prototype f067d5349 without copying its mode logic. Fix the confirmed intermediate-width image gallery placement that compresses the form. Preserve existing import/library callbacks and perform dialog focus handoff explicitly. These targeted fixes receive an independent review before final integration review.

**Files:** `docs/engineering/app-experience.md`, task ledger, ignored screenshots/measurement artifacts; only targeted fixes in implementation files.

- [x] Run local app and inspect before/candidate layouts with the same viewport and route; distinguish guest, controlled fixture and actual authenticated evidence.
- [x] Verify 1440×960, 900×700, 390×844, 320×740 and 844×390: visible wallet/navigation, complete prompt focus, reference additions and errors, core options, price/action, scroll reachability and no horizontal overflow. Inspect light/dark, empty/loading/results and native audio controls.
- [x] Verify menu keyboard loop, Escape/focus return, localized links, account/auth destinations, draft persistence and dynamic panels. Preserve all functions inventoried before replacement.
- [x] Run frontend lint, exposure lint, TypeScript and affected architecture/behavior suites; full `test:validate` if generation/polling/persistence responsibilities changed. Compare loading evidence where production-like builds are runnable; do not claim a performance gain from CSS or syntax checks.
- [x] Obtain independent spec/quality review of each task and a final integration review. Fix material findings and record unresolved real-session/device/performance qualification honestly.
- [x] Leave a reviewable isolated branch and local preview; no deployment, merge or payment.

## Progress

- Baseline `ebead7f23`: clean isolated worktree; 21 affected route/presentation tests pass with `tsx --tsconfig frontend/tsconfig.json`. The initial raw Node invocation lacked the tsconfig alias and was corrected before implementation.
- User input affordance/logo feedback is applied to the prototype first; its visual rules are binding for the integration above.
- Tasks 1–5 are implemented and independently approved. Whole-branch review of `1fe1d1aa2..4fdfe87fa` found two Important and two Minor integration gaps. The single final fix wave `287a434d6` addressed all four; scoped re-review found no new breakage or open findings.
- Final source validation: 4,429 tests passed with no failures or skips, production build passed with 861 static pages, and lint, TypeScript, exposure and localization checks passed. Temporary browser fixture routes were removed before the final build. Qualification limits and ownership are recorded in `docs/engineering/app-experience.md`.
- The isolated branch and local previews are retained for user validation. No push, merge, deployment, paid generation or production data mutation was performed. Saved Studio timeline/canvas integration remains a separate bounded lot.
