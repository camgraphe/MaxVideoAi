# Studio Editor Architecture Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MaxVideoAI Studio easier to extend, faster under timeline/canvas interaction, and safer for AI-assisted changes.

**Architecture:** Keep Studio as an isolated authenticated app under `frontend/app/(core)/(workspace)/app/studio`, but split the current large workspace into explicit domains: project state, canvas graph, project media, timeline editing, program viewer, export, and styling. Preserve existing product contracts while moving logic out of `WorkspacePage.client.tsx` into focused hooks, pure helpers, and small components.

**Tech Stack:** Next.js App Router, React client components, React Flow, TypeScript, CSS modules, Neon/Postgres, Remotion server rendering, Playwright, Node test runner.

---

## Audit Snapshot

- Studio workspace source currently contains about `22,205` lines.
- Largest Studio files:
  - `frontend/app/(core)/(workspace)/app/studio/workspace/maxvideoai-editor.module.css`: `4,794` lines.
  - `frontend/app/(core)/(workspace)/app/studio/workspace/WorkspacePage.client.tsx`: `3,545` lines.
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceTimeline.tsx`: `1,916` lines.
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing.ts`: `1,314` lines.
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceCanvas.client.tsx`: `998` lines.
  - `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates.ts`: `957` lines.
- `WorkspacePage.client.tsx` currently has `13` state hooks, `12` effects, `16` memos, and `78` callbacks. It is acting as a controller for too many domains.
- Existing contracts are strong and should be preserved:
  - `tests/maxvideoai-editor-workspace-architecture.test.ts`
  - `tests/e2e/editor/editor-smoke.spec.ts`
  - `tests/e2e/editor/editor-timeline.spec.ts`
  - `tests/e2e/editor/editor-library.spec.ts`
- Export has a real backend direction:
  - API routes under `frontend/app/api/studio/timeline-exports`.
  - Server modules under `frontend/src/server/timeline-exports`.
  - Worker script: `frontend/scripts/run-timeline-export-worker.ts`.
  - Remotion renderer: `frontend/src/server/timeline-exports/renderer.ts`.

## Target Architecture

The long-term target is this route-local structure:

```txt
frontend/app/(core)/(workspace)/app/studio/workspace/
  WorkspacePage.client.tsx              # thin composition shell
  _state/
    workspace-state.ts                  # state shape, reducer, actions
    workspace-selectors.ts              # derived state selectors
  _controllers/
    useWorkspacePersistence.ts
    useCanvasController.ts
    useTimelineController.ts
    useProjectMediaController.ts
    useExportController.ts
    useWorkspaceKeyboardShortcuts.ts
  _components/
    canvas/
    timeline/
    viewer/
    inspector/
    media/
    nodes/
    edges/
  _lib/
    timeline/
    templates/
    models/
    media/
  _styles/
    shell.module.css
    canvas.module.css
    timeline.module.css
    viewer.module.css
    inspector.module.css
    media.module.css
```

`WorkspacePage.client.tsx` should become a composition file under `800` lines in the first wave, then under `400` lines after the domain split is complete.

## Non-Negotiable Product Invariants

- Canvas templates update nodes and edges only; they never reset timelines.
- Viewer mode owns project media, sequences, timeline clips, and editing.
- Canvas mode owns block templates, canvas templates, graph handles, and generation blocks.
- Timeline edit state must not overlap clips on the same track unless a future explicit overlay/compositing feature adds tests for it.
- Timeline operations should use integer frame coordinates internally and convert seconds only at UI/API boundaries.
- Video clips with linked audio move together until explicitly unlinked.
- Failed or ambiguous drags revert to the previous committed state.
- Export is a queued server-render job; the UI creates and observes jobs, but does not pretend a render completed without a worker.

## Task 1: Lock Studio Extension Contracts

**Files:**
- Create: `docs/engineering/studio-editor-architecture.md`
- Modify: `frontend/app/(core)/(workspace)/app/studio/AGENTS.md`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] Document the Studio entities: `Project`, `Sequence`, `Canvas template`, `Canvas node`, `Timeline clip`, `Asset`, `Model capability`, `Export job`.
- [ ] Add recipes for adding a block, adding a model, adding a canvas template, adding a timeline operation, and adding a viewer control.
- [ ] Add contract assertions that `AGENTS.md` references the new architecture guide and that new templates/models/timeline operations are routed through registries or pure helpers.
- [ ] Run `npm run test:editor`.
- [ ] Commit with `docs: document studio editor architecture`.

## Task 2: Extract Workspace State And Selectors

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-state.ts`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-selectors.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/WorkspacePage.client.tsx`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] Move the persisted workspace state types and normalization helpers out of `WorkspacePage.client.tsx`.
- [ ] Move derived selectors for active sequence, selected timeline item, export range, timeline duration, and project media summaries into `workspace-selectors.ts`.
- [ ] Keep behavior unchanged: import selectors into `WorkspacePage.client.tsx` and remove duplicated local helper logic.
- [ ] Add architecture assertions that `WorkspacePage.client.tsx` imports `_state/workspace-selectors`.
- [ ] Run `npm run test:editor` and `frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json`.
- [ ] Commit with `refactor: extract studio workspace state selectors`.

## Task 3: Split Persistence And Autosave Controller

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useWorkspacePersistence.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/WorkspacePage.client.tsx`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] Move local storage keys, local project read/write, API hydration, API autosave, and canvas-template persistence functions into `useWorkspacePersistence`.
- [ ] Keep local fallback available when API or auth is unavailable.
- [ ] Debounce API writes and persist only the latest snapshot for a project.
- [ ] Keep storage scoped by `projectId`.
- [ ] Add contract assertions that persistence is not implemented inline in `WorkspacePage.client.tsx`.
- [ ] Run `npm run test:editor`.
- [ ] Commit with `refactor: extract studio workspace persistence`.

## Task 4: Extract Timeline Domain Helpers

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-frames.ts`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-collisions.ts`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-insert.ts`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-trim.ts`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-linked-audio.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing.ts`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] Move frame conversion into `timeline-frames.ts`: seconds-to-frame, frame-to-seconds, frame snapping, timecode boundaries.
- [ ] Move overlap detection and no-overlap assertions into `timeline-collisions.ts`.
- [ ] Move insert/move package behavior into `timeline-insert.ts`.
- [ ] Move trim/cut behavior into `timeline-trim.ts`.
- [ ] Move linked audio sync, link, and unlink helpers into `timeline-linked-audio.ts`.
- [ ] Keep `workspace-timeline-editing.ts` as the public facade so existing imports do not break.
- [ ] Add no-overlap tests for insert, drag revert, linked audio movement, trim caps, and multi-selection packages.
- [ ] Run `npm run test:editor`.
- [ ] Commit with `refactor: split studio timeline editing helpers`.

## Task 5: Split Timeline UI Into Focused Components

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/TimelineToolbar.tsx`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/TimelineRuler.tsx`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/TimelineTrackList.tsx`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/TimelineTrackRow.tsx`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/TimelineClip.tsx`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/TimelineContextMenus.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceTimeline.tsx`
- Test: `tests/e2e/editor/editor-timeline.spec.ts`

- [ ] Move clip rendering and clip pointer handlers into `TimelineClip.tsx`.
- [ ] Move toolbar buttons, timecode, snap/insert toggles, and zoom into `TimelineToolbar.tsx`.
- [ ] Move ruler rendering and playhead pointer drag into `TimelineRuler.tsx`.
- [ ] Move track labels and add-track controls into `TimelineTrackRow.tsx`.
- [ ] Move context menus into `TimelineContextMenus.tsx`.
- [ ] Keep timeline geometry helpers pure and tested.
- [ ] Run `npm run test:editor:e2e -- tests/e2e/editor/editor-timeline.spec.ts`.
- [ ] Commit with `refactor: split studio timeline ui`.

## Task 6: Make Timeline Interaction More Performant

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/timeline/*`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useTimelineController.ts`
- Test: `tests/e2e/editor/editor-timeline.spec.ts`

- [ ] Store drag previews in local refs/state inside timeline components and commit workspace state only on pointer up.
- [ ] Drive playhead drag with `requestAnimationFrame`.
- [ ] Render only clips whose time range intersects the visible timeline window plus a small buffer.
- [ ] Memoize track definitions, selected key sets, and rendered clip layouts.
- [ ] Add a development-only performance mark around drag start, drag frame, and drag commit.
- [ ] Run timeline E2E tests and manually test drag, cut, linked audio, multi-select, undo/redo.
- [ ] Commit with `perf: reduce studio timeline render churn`.

## Task 7: Split Canvas Surface And Import Logic

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasMap.tsx`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasPaletteDragPreview.tsx`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasHandleDropPreview.tsx`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useCanvasController.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceCanvas.client.tsx`
- Test: `tests/e2e/editor/editor-smoke.spec.ts`

- [ ] Move minimap layout, viewport drag, and zoom controls into `CanvasMap.tsx`.
- [ ] Move palette drag ghost cleanup into `CanvasPaletteDragPreview.tsx`.
- [ ] Move handle ghost/link preview into `CanvasHandleDropPreview.tsx`.
- [ ] Move file drop, file paste, text paste, and media-node fill decisions into `useCanvasController`.
- [ ] Keep React Flow wiring in `WorkspaceCanvas.client.tsx`.
- [ ] Run the canvas E2E tests for drag/drop, paste, file drop, minimap, and ghost cleanup.
- [ ] Commit with `refactor: split studio canvas interactions`.

## Task 8: Split Template Registry

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/registry.ts`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/product-ad.ts`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/dev-blocks.ts`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/character-dialogue.ts`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/storyboard-to-video.ts`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/ugc-ad.ts`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/templates/cinematic-scene.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates.ts`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] Move each template builder into one file.
- [ ] Keep `workspace-templates.ts` as a small compatibility facade that exports the registry API.
- [ ] Add a test that every template summary has a thumbnail, description, AI workflow path, nodes, and edges.
- [ ] Add a test that applying a template does not mutate the active sequence.
- [ ] Run `npm run test:editor`.
- [ ] Commit with `refactor: split studio canvas template registry`.

## Task 9: Split Model Capability Registry

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-capability-registry.ts`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-input-connectors.ts`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-pricing-adapter.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities.ts`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] Move static capability data and provider mappings into `model-capability-registry.ts`.
- [ ] Move connector derivation and compatibility rules into `model-input-connectors.ts`.
- [ ] Move pricing parameter mapping into `model-pricing-adapter.ts`.
- [ ] Keep shot blocks deriving input handles from capabilities.
- [ ] Add tests for each active engine: required connectors, optional connectors, disabled connectors, pricing-relevant parameters, and audio support.
- [ ] Run `npm run test:editor`.
- [ ] Commit with `refactor: split studio model capability registry`.

## Task 10: Split Viewer Playback And Program Monitor

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/viewer/ProgramMonitor.tsx`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/viewer/ProgramPlaybackLayers.tsx`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/viewer/ProgramControls.tsx`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/viewer/useProgramPlaybackSync.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceVideoViewer.tsx`
- Test: `tests/e2e/editor/editor-timeline.spec.ts`

- [ ] Move video/audio layer mounting and synchronization into `ProgramPlaybackLayers.tsx` and `useProgramPlaybackSync.ts`.
- [ ] Move project-ratio frame sizing and zoom into `ProgramMonitor.tsx`.
- [ ] Move play, prev/next cut, IN/OUT, clear, and snapshot buttons into `ProgramControls.tsx`.
- [ ] Keep black-frame gaps and no poster flashes.
- [ ] Run E2E tests for hard cuts, trim preview, one-frame stepping, audio playback, and snapshot-to-canvas.
- [ ] Commit with `refactor: split studio program viewer`.

## Task 11: Harden Project Media And Multi-Sequence Domain

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useProjectMediaController.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineProjectSidebar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineClipInspector.tsx`
- Test: `tests/e2e/editor/editor-smoke.spec.ts`

- [ ] Move import, delete, generated clip delete, drag payload creation, and context menu actions into `useProjectMediaController`.
- [ ] Keep sidebar cards draggable into compatible timeline tracks with a duration ghost.
- [ ] Keep sequence cards selectable and route sequence settings to the inspector.
- [ ] Add sequence rename/delete/duplicate only after active-sequence switching is stable.
- [ ] Run E2E tests for new sequence, switch sequence, import media, drag media to timeline, and sequence inspector settings.
- [ ] Commit with `refactor: extract studio project media controller`.

## Task 12: Modularize Studio CSS Without Losing Isolation

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/shell.module.css`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas.module.css`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/timeline.module.css`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/viewer.module.css`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/inspector.module.css`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/media.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/maxvideoai-editor.module.css`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] Extract root tokens and shell layout first.
- [ ] Extract viewer styles.
- [ ] Extract timeline styles.
- [ ] Extract canvas/sidebar styles.
- [ ] Extract inspector/media styles.
- [ ] Keep `maxvideoai-editor.module.css` as a compatibility module only if existing components still import it during migration.
- [ ] Add contract thresholds to prevent any single Studio CSS module from exceeding `1,200` lines.
- [ ] Run `npm run qa:editor`.
- [ ] Commit with `refactor: modularize studio editor css`.

## Task 13: Stabilize Export Product Flow

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceExportDialog.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useExportController.ts`
- Modify: `frontend/src/server/timeline-exports/*`
- Test: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] Make export dialog explicitly show server render state: estimate, free quota, paid cost, queued, rendering, completed, failed.
- [ ] Poll `GET /api/studio/timeline-exports/[exportId]` while queued/rendering.
- [ ] Surface missing worker/storage configuration as a clear blocked state.
- [ ] Keep EDL export local and separate from MP4 server render.
- [ ] Add tests for free quota, paid estimate, insufficient balance, job reuse by idempotency key, and completed output.
- [ ] Run `npm run test:editor`.
- [ ] Commit with `feat: harden studio server export flow`.

## Task 14: Add Performance Guardrails

**Files:**
- Create: `tests/e2e/editor/editor-performance.spec.ts`
- Modify: `playwright.editor.config.ts`
- Modify: `package.json`

- [ ] Add a stress fixture with at least `150` timeline clips and `80` canvas nodes.
- [ ] Add a browser smoke test that opens the stress fixture, scrubs, drags one clip, zooms the timeline, and pans the canvas.
- [ ] Record pass/fail thresholds for interaction completion, not fragile exact FPS.
- [ ] Add `npm run test:editor:perf` to run the performance smoke separately.
- [ ] Keep `qa:editor` focused; run perf smoke before large releases, not every tiny patch.
- [ ] Commit with `test: add studio editor performance smoke`.

## Verification Matrix

Run focused checks after each task:

```bash
npm run test:editor
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

Run full Studio checks before merging a wave:

```bash
npm run test:editor
npm run test:editor:e2e
npm run qa:editor
```

For export-worker changes:

```bash
npm run timeline-exports:worker:once
```

For large-file cleanup target selection:

```bash
npm run architecture:audit -- --min-lines 500
```

## Recommended Wave Order

1. Tasks 1-3: documentation, state selectors, persistence extraction.
2. Tasks 4-6: timeline pure domain and UI/performance split.
3. Tasks 7-9: canvas, templates, and model registry split.
4. Tasks 10-11: viewer and project media split.
5. Tasks 12-14: CSS modularization, export hardening, performance smoke.

This order reduces risk because it first creates boundaries, then moves the most regression-prone editor behavior behind tests, then improves performance and polish.
