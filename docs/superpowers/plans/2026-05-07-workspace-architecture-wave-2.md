# Workspace Architecture Wave 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three focused architecture PRs that keep large workspace files moving toward route orchestration instead of owning copy, UI primitives, browser helpers, and data orchestration inline.

**Architecture:** Continue the existing feature-local split style: route/client files remain orchestrators, while colocated `_components`, `_hooks`, and `_lib` modules own reusable UI, browser helpers, and local contracts. Each PR adds or extends a contract test so the extracted responsibility does not drift back into the workspace file.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Node `node:test` contract checks, existing npm/pnpm verification commands.

---

### Task 1: Audio Workspace Helper And Component Split

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/audio/AudioWorkspace.tsx`
- Create: `frontend/app/(core)/(workspace)/app/audio/_components/audio-workspace-controls.tsx`
- Create: `frontend/app/(core)/(workspace)/app/audio/_lib/audio-workspace-helpers.ts`
- Create: `frontend/app/(core)/(workspace)/app/audio/_lib/audio-workspace-types.ts`
- Create: `tests/audio-workspace-architecture.test.ts`

- [ ] **Step 1: Add a contract test**

Create `tests/audio-workspace-architecture.test.ts` asserting that the workspace imports the new `_components` and `_lib` modules, that top-level helper/component ownership no longer lives inline, and that key exports exist.

- [ ] **Step 2: Move local audio contracts**

Move `SourceVideoState`, `GeneratedSourceVideo`, `AudioJobSettingsSnapshot`, `AudioJobDetail`, `ActiveAudioJobState`, and `AudioResultState` into `audio-workspace-types.ts`.

- [ ] **Step 3: Move audio defaults and browser/API helpers**

Move default pack constants, voice gender values, provider metadata, formatting helpers, duration probing, upload, and job-detail fetch into `audio-workspace-helpers.ts`.

- [ ] **Step 4: Move audio control components**

Move `AudioModePicker`, `AudioModeCard`, `AudioInlineSelectLabel`, `AudioSelectControl`, and `ToggleRow` into `audio-workspace-controls.tsx`.

- [ ] **Step 5: Verify and commit**

Run:
`pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/audio-workspace-architecture.test.ts`
`pnpm --prefix frontend exec tsc --noEmit --pretty false`
`npm --prefix frontend run lint`
`npm run lint:exposure`
`git diff --check`
`pnpm --prefix frontend run build`

Commit: `Split audio workspace helpers`

### Task 2: Image Workspace Route Orchestration Split

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/image/ImageWorkspace.tsx`
- Create: `frontend/app/(core)/(workspace)/app/image/_hooks/useImageWorkspacePricing.ts`
- Create: `frontend/app/(core)/(workspace)/app/image/_hooks/useImageWorkspaceHistory.ts`
- Modify: `tests/image-workspace-split-contract.test.ts`

- [ ] **Step 1: Extend the image split contract**

Assert that image pricing/history orchestration lives in route-local hooks and that `ImageWorkspace.tsx` imports those hooks.

- [ ] **Step 2: Extract pricing SWR orchestration**

Move the `/api/images/estimate` SWR key/request logic into `useImageWorkspacePricing`.

- [ ] **Step 3: Extract history and gallery group orchestration**

Move image job filtering, remote history mapping, pending group resolution, and polling into `useImageWorkspaceHistory`.

- [ ] **Step 4: Verify and commit**

Run:
`pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/image-workspace-split-contract.test.ts`
`pnpm --prefix frontend exec tsc --noEmit --pretty false`
`npm --prefix frontend run lint`
`npm run lint:exposure`
`git diff --check`
`pnpm --prefix frontend run build`

Commit: `Split image workspace orchestration hooks`

### Task 3: Character Builder UI Component Split

**Files:**
- Modify: `frontend/src/components/tools/CharacterBuilderWorkspace.tsx`
- Create: `frontend/src/components/tools/character-builder/_components/character-builder-workspace-components.tsx`
- Modify: `tests/character-builder-workspace-architecture.test.ts`

- [ ] **Step 1: Extend the character builder contract**

Assert that visual cards, sticky dock, editors, controls, reference modal, and result rail components live in the colocated component module.

- [ ] **Step 2: Move visual/control components**

Move pre-page UI components and presentation constants out of `CharacterBuilderWorkspace.tsx`, preserving their props and behavior.

- [ ] **Step 3: Keep page-level state and side effects in the workspace**

Keep `CharacterBuilderWorkspace.tsx` responsible for route state, auth, persistence, job orchestration, and rendering composition only.

- [ ] **Step 4: Verify and commit**

Run:
`pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/character-builder-workspace-architecture.test.ts`
`pnpm --prefix frontend exec tsc --noEmit --pretty false`
`npm --prefix frontend run lint`
`npm run lint:exposure`
`git diff --check`
`pnpm --prefix frontend run build`

Commit: `Split character builder workspace components`
