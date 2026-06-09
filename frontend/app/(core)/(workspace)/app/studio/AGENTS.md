# MaxVideoAI Studio Editor Guide

This folder owns the MaxVideoAI Studio product surface:

- `projects/`: project creation and project list entry point.
- `workspace/`: the canvas generation editor, viewer, timeline, export dialog, and route-local editor UI.
- `frontend/app/api/studio/`: authenticated Studio API routes.
- `frontend/src/server/studio/`: server-only Studio persistence.

The Studio editor is intentionally separate from the main generation workspace. Do not import or recreate the existing app chrome here unless a feature is explicitly shared outside Studio.

Read `docs/engineering/studio-editor-architecture.md` before changing Studio entities, adding a block/model/template, or moving timeline/viewer responsibilities.

## Product Model

Keep these entities distinct:

- `Project`: user-owned Studio container. It holds settings, canvas state, timeline state, project media, and future sequences.
- `Sequence`: an edit timeline with ratio, resolution, fps, tracks, clips, in/out points, and export settings.
- `Canvas template`: graph-only starter state. Applying one must update nodes and edges only.
- `Canvas node`: a generation/source block in React Flow.
- `Timeline clip`: a montage item on video or audio tracks.
- `Asset`: user media, generated media, or imported media usable by canvas and/or timeline.
- `Model capability`: the source of truth for shot inputs, render options, and routing.

## Additive Rules

Prefer adding new behavior by extending contracts and pure helpers instead of growing `WorkspacePage.client.tsx`.

- Add a new block type by updating `workspace-types.ts`, `workspace-templates.ts`, node rendering in `_components/nodes/`, and compatibility tests.
- Add a new model by updating `workspace-capabilities.ts` and generation/pricing adapters. The shot block should derive connectors from capabilities.
- Add timeline behavior in `workspace-timeline-editing.ts`, `workspace-timeline-render.ts`, or `workspace-timeline-tracks.ts` before wiring UI.
- Add viewer behavior in `WorkspaceVideoViewer.tsx` and pure render helpers, not inside the timeline component.
- Add project persistence in `frontend/src/server/studio` plus `frontend/app/api/studio`; keep client fallback to local storage until backend availability is guaranteed.
- Add UI as route-local components under `workspace/_components` unless it is clearly reused by another route.

## Guardrails

- Canvas mode owns block templates, canvas templates, graph handles, and generation nodes.
- Viewer mode owns project media, sequences, imported assets, generated clips, and timeline editing.
- Applying a canvas template must never reset the timeline.
- Inserting from canvas to timeline must not automatically switch to Viewer.
- Final timeline state must not overlap clips on the same track unless a deliberate compositing/overlay feature is implemented with explicit tests.
- Timeline drags must be frame-aware and must revert if an operation cannot resolve cleanly.
- Video clips with linked audio should move together by default until explicitly unlinked.
- Project settings are sequence/project state, not scattered controls inside unrelated panels.
- Keep the editor CSS isolated in `maxvideoai-editor.module.css`.

## Contracts And Tests

Architecture tests are part of the product contract. Update them when changing responsibilities:

- `tests/maxvideoai-editor-workspace-architecture.test.ts`: Studio routes, canvas, node, model capability, timeline, persistence, and UX boundaries.
- `tests/e2e/editor/editor-smoke.spec.ts`: browser-level Studio smoke tests.
- `tests/e2e/editor/editor-timeline.spec.ts`: timeline behavior tests.

Before claiming a Studio change is done, run focused checks:

```bash
npm run test:editor
npm run qa:editor
```

For browser-facing timeline or canvas interactions, also run the relevant Playwright editor spec and inspect the app in the browser.

## What Not To Do

- Do not solve a new feature by adding another special case directly in the main orchestrator when a contract/helper exists.
- Do not mix canvas template application with project reset.
- Do not create model-specific shot UIs when capability data can describe the inputs.
- Do not add timeline buttons without defining the editing rule and a testable pure helper first.
- Do not remove local fallback persistence until the server path is fully deployed and reliable.
