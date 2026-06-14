# Studio Canvas Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move canvas templates out of the active creation toolbar and add project-scoped saved canvas navigation.

**Architecture:** Built-in templates remain graph-only starter bases. Project saved canvases are stored inside the project `workspaceState`, alongside the current graph, so no new backend tables are needed in this pass. The floating toolbar owns direct canvas actions only; a separate bottom-left navigator owns saved canvases and template startup flows.

**Tech Stack:** Next.js App Router, React client components, React Flow graph state, local/API Studio workspace persistence, Node test contracts.

---

### Task 1: Project-Scoped Canvas State

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-state.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-api-persistence.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceSequenceSnapshots.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspacePersistenceEffects.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/WorkspacePage.client.tsx`

- [ ] Add `savedCanvases` and `activeCanvasId` to `PersistedWorkspaceState`.
- [ ] Normalize saved canvases from project workspace state.
- [ ] Include saved canvases in autosave state.
- [ ] Hydrate saved canvases from the project instead of global canvas-template storage.

### Task 2: Canvas Actions

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasTemplateActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasController.ts`

- [ ] Add actions for save current, save as new, rename, create from starter template, replace with starter template, duplicate, delete, and switch saved canvas.
- [ ] Keep all actions graph-only and avoid timeline or sequence mutations.

### Task 3: Toolbar and Navigator UI

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar.tsx`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasNavigatorPanel.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceCanvas.client.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-toolbar.module.css`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-navigator.module.css`

- [ ] Remove templates from the toolbar tool menus.
- [ ] Add a Save toolbar menu with save current, save as new, and rename current.
- [ ] Add a bottom-left Canvas button that opens a navigator panel with My canvases and Templates.
- [ ] Make template primary click create a new project canvas and switch to it.
- [ ] Make template replacement a secondary confirmed action.

### Task 4: Copy and Contracts

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
- Modify: `tests/maxvideoai-editor-workspace-architecture.test.ts`
- Modify: `tests/studio-localization-contract.test.ts`

- [ ] Add fallback copy for canvas navigator and save menu.
- [ ] Update architecture contracts to assert templates are not an active toolbar tool.
- [ ] Update localization contracts for new fallback copy.

### Task 5: Verification

**Files:**
- No source changes expected.

- [ ] Run `npm run test:editor`.
- [ ] Run `frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json`.
- [ ] Run `npm --prefix frontend run lint`.
- [ ] Run `git diff --check`.
