# Storyboard Workspace Refactor Design

## Goal

Reduce `frontend/src/components/tools/StoryboardWorkspace.tsx` from 1,318 lines to no more than 500 lines while preserving every current Storyboard workflow, price, API payload, authentication rule, localized string, and visual interaction.

The same delivery updates `docs/engineering/refactor-roadmap.md` from the live architecture audit dated 2026-07-14 so future cleanup work is selected from current evidence rather than the obsolete 2026-05-08 snapshot.

## Scope

This is an architecture-only refactor. It covers:

- the Storyboard builder rendering boundary;
- Storyboard reference-image state, upload, library selection, and cleanup;
- Storyboard price-estimate effects and display formatting;
- static Storyboard reference configuration;
- Kling first-frame browser-storage helpers;
- architecture contracts for the new ownership boundaries;
- the current refactor-roadmap audit snapshot and priority sequence.

## Non-Goals

The refactor must not:

- change displayed or charged prices;
- add local pricing formulas or commercial fallbacks;
- change `/api/images/estimate` or generation request payloads;
- change generated prompts, template selection, image dimensions, quality, source identifiers, or metadata;
- change authentication, library, download, handoff, recent-output, or feature-flag behavior;
- redesign the Storyboard interface or alter localized copy;
- replace the current state model with a global store;
- move all logic into a single controller hook;
- refactor unrelated workspace or image-generation features.

## Current Ownership Problem

`StoryboardWorkspace.tsx` currently owns five distinct responsibilities:

1. controlled builder form state and derived shot-plan data;
2. reference-image slots, uploads, library selection, object-URL cleanup, and modal state;
3. tier and edit price-estimate effects;
4. generation, Kling first-frame creation, saving, and generator handoff;
5. the complete builder UI plus its local control primitives.

The file is 1,318 lines in the 2026-07-14 audit. Existing Storyboard modules already own prompt construction, templates, shot planning, recent outputs, the result panel, reference upload utilities, and target rules. The next refactor should extend those existing route-local boundaries rather than introduce another architecture style.

## Chosen Architecture

### `StoryboardWorkspace.tsx`

Remains the client orchestrator and the only default export consumed by the route. It owns:

- authentication and feature-flag route states;
- controlled prompt, target, style, duration, orientation, tier, and edit-instruction state;
- selected result/recent-output state;
- generation and edit submission orchestration;
- Kling first-frame generation orchestration;
- save-to-library orchestration;
- generator handoff and route navigation;
- global success and error feedback;
- composition of the builder, result panel, auth modal, and reference library modal.

It must be no more than 500 lines after the refactor. Generation, saving, and handoff stay here because they form one critical workflow and moving them would create a large hidden controller rather than simplify ownership.

### `storyboard/_components/StoryboardBuilderPanel.tsx`

Owns the complete controlled builder rendering surface and its private UI primitives:

- subject and optional prompt fields;
- reference-image dropzone;
- target and recognizable-people controls;
- style controls;
- orientation, duration, and tier controls;
- generate action and feedback rendering;
- `BuilderStep`, `BuilderGroup`, choice, tier, length, target-logo, and style-icon primitives;
- localized tier and preset label selection used only by the builder.

The component performs no API calls and owns no workflow state. Its props are grouped into typed `prompt`, `references`, `target`, `output`, and `submission` objects so the boundary is explicit without a flat prop list or an opaque all-purpose controller object.

### `storyboard/_hooks/useStoryboardReferences.ts`

Owns:

- the four reference-image slots;
- the current reference-library modal state;
- the latest reference array used by unmount cleanup;
- upload, removal, library-open, library-close, and library-selection handlers;
- the ready-reference and upload-in-progress projections;
- the localized `EngineInputField` and `AssetDropzone` asset projection.

It receives authentication state and callbacks for `onAuthRequired`, `onError`, and `onFeedbackReset`. Global user feedback remains owned by `StoryboardWorkspace`; the hook does not create a second competing message system.

### `storyboard/_hooks/useStoryboardPricing.ts`

Owns:

- server estimates for every Storyboard output tier at the selected orientation;
- the edit estimate for the selected image dimensions;
- cancellation guards for stale effects;
- display formatting for tier, active generation, Kling first-frame, and edit prices.

It continues to use `/api/images/estimate`, `STORYBOARD_SOURCE`, `STORYBOARD_EDIT_SOURCE`, `getStoryboardOutputConfig`, `getStoryboardEditOutputConfig`, and `resolveStoryboardVisiblePrice`. It never calculates a product price locally and returns `...` when the server estimate is unavailable, matching current behavior.

### `storyboard/_lib/storyboard-workspace-config.ts`

Owns static, route-local Storyboard configuration currently embedded in the workspace:

- style and target option arrays;
- target logo paths;
- reference slot count;
- reference field definition;
- reference engine capabilities.

The file contains no React state, browser access, or API calls.

### `storyboard/_lib/storyboard-kling-first-frame-storage.ts`

Owns Kling first-frame browser persistence and recent-output mapping:

- the local-storage key;
- defensive parsing of stored values;
- write-by-storyboard-job behavior;
- lookup validation by storyboard job and URL;
- conversion of a recent Storyboard output into the stored first-frame shape.

The exported state type becomes the shared contract used by the workspace. Invalid, absent, or mismatched storage data continues to return `null` or an empty map without surfacing an error to the user.

## Data Flow

1. `StoryboardWorkspace` resolves authentication, locale copy, controlled form values, the selected output, and global feedback.
2. `useStoryboardReferences` supplies controlled reference state and callbacks.
3. `useStoryboardPricing` derives display-only estimates from the selected orientation, tier, target, and output dimensions.
4. `StoryboardWorkspace` derives the current shot plan and passes grouped controlled props into `StoryboardBuilderPanel`.
5. `StoryboardBuilderPanel` emits callbacks only; it never mutates external state or calls APIs directly.
6. Generation continues to read the current form, reference, pricing-label, template, and selected-image data directly in `StoryboardWorkspace`.
7. Results flow into the existing `StoryboardResultPanel`, recent-output hook, library save, and generator handoff unchanged.

## Error and Lifecycle Behavior

- Missing authentication still opens the existing auth modal.
- A missing subject still uses `copy.missingSubject`.
- Reference upload failures still show the upload helper error or `copy.uploadFailed` and leave the failed slot visible.
- Generation and save failures still populate the single workspace error message.
- Price-estimate failures still resolve to unavailable display values without blocking generation.
- Reference object URLs are cleaned when a slot is replaced, removed, or the workspace unmounts.
- Kling storage parsing remains defensive and silent.
- Selecting a recent output, changing template options, and opening the library continue to clear feedback at the same points as today.

## Architecture Contracts and TDD

The implementation starts by updating `tests/storyboard-tool-contract.test.ts` so it fails against the current owner. The contract must require:

- all five new focused files to exist;
- `StoryboardWorkspace.tsx` to import and use the extracted component, hooks, configuration, and storage helpers;
- the workspace to stay at or below 500 lines;
- builder JSX primitives, reference upload implementation, price-estimate fetches, static engine configuration, and local-storage parsing not to return to the workspace;
- generation, save, and handoff orchestration to remain in the workspace;
- `StoryboardBuilderPanel` to remain API-free and state-controller-free;
- pricing estimates to remain server-authored.

Focused unit tests cover:

- defensive Kling storage parsing, matching, writing, and recent-output conversion;
- current pricing display selection and unavailable-state formatting where those functions become newly exported pure contracts;
- existing Storyboard prompt, template, target, reference-library, handoff, and generation source assertions.

Every extraction follows a red-green cycle: contract first, expected failure, minimal move, focused pass, then the next responsibility.

## Verification

Required verification after implementation:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/storyboard-tool-contract.test.ts
pnpm run test:validate
pnpm --dir frontend exec tsc --noEmit
pnpm --dir frontend run lint
pnpm run lint:exposure
git diff --check
npm run architecture:audit -- --min-lines 500
pnpm --dir frontend run build
```

A browser smoke check must cover `/app/tools/storyboard` loading, the disabled/auth states available in the local environment, controlled builder interactions, reference selection, and the unchanged result-panel composition. Where authenticated API execution depends on external credentials or database state, the GitHub Quality CI remains the authoritative smoke environment.

## Roadmap Refresh

`docs/engineering/refactor-roadmap.md` will replace its dated 2026-05-08 candidate table with the 2026-07-14 live audit. The updated sequence will:

1. identify Storyboard Workspace as the active balanced cleanup;
2. list `frontend/server/admin-transactions.ts` as the next medium-risk server split;
3. keep pricing/admin surfaces in a separate behavior-preserving plan with price acceptance tests;
4. classify very large model and comparison copy files as content-organization work rather than immediate runtime refactors;
5. defer routes near their caps until product work supplies a meaningful extraction target.

The roadmap remains advisory; the audit command is the source of current line counts.

## Acceptance Criteria

- `StoryboardWorkspace.tsx` is at most 500 lines.
- No current Storyboard behavior, copy, pricing, request payload, storage key, public route, or visual layout changes.
- The builder is a controlled API-free component with grouped typed props.
- References, pricing, configuration, and Kling storage each have one explicit owner.
- Generation, save, and handoff remain visible in the route-level orchestrator.
- Architecture and unit tests lock every new boundary.
- The engineering roadmap reflects the 2026-07-14 live audit.
- Focused checks, the complete validation suite, TypeScript, lint, exposure, build, and GitHub Quality CI pass.
