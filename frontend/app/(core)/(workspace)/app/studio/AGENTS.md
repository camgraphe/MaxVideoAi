# MaxVideoAI Studio Editor Guide

This folder owns the MaxVideoAI Studio product surface:

- `projects/`: project creation and project list entry point.
- `workspace/`: the canvas generation editor, viewer, timeline, export dialog, and route-local editor UI.
- `frontend/app/api/studio/`: authenticated Studio API routes.
- `frontend/src/server/studio/`: server-only Studio persistence.

The Studio editor is intentionally separate from the main generation workspace. Do not import or recreate the existing app chrome here unless a feature is explicitly shared outside Studio.

Read `docs/engineering/studio-editor-architecture.md` before changing Studio entities, adding a block/model/template, or moving timeline/viewer responsibilities.
Use its Ownership Map and Additive Change Checklist before deciding where code belongs.

## Product Model

Keep these entities distinct:

- `Project`: user-owned Studio container. It holds settings, canvas state, timeline state, project media, and future sequences.
- `Sequence`: an edit timeline with ratio, resolution, fps, tracks, clips, in/out points, and export settings.
- `Canvas template`: graph-only starter state. Applying one must update nodes and edges only.
- `Canvas node`: a generation/source block in React Flow.
- `Timeline clip`: a montage item on video or audio tracks.
- `Asset`: user media, generated media, or imported media usable by canvas and/or timeline.
- `Project media folder`: a Viewer-mode bin container for imported assets and generated clips. Keep sequences at the Project media root.
- `Model capability`: the source of truth for shot inputs, render options, and routing.

## Additive Rules

Prefer adding new behavior by extending contracts and pure helpers instead of growing `WorkspacePage.client.tsx`.

- Add a new block type by updating `workspace-types.ts`, `workspace-templates.ts`, node rendering in `_components/nodes/`, and compatibility tests.
- Add a new model by updating `workspace-capabilities.ts` and generation/pricing adapters. The shot block should derive connectors from capabilities.
- Add timeline behavior in `workspace-timeline-editing.ts`, `workspace-timeline-render.ts`, or `workspace-timeline-tracks.ts` before wiring UI.
- Add sequence list behavior in `workspace/_state/workspace-sequence-operations.ts` before wiring Project media or inspector UI.
- Add Project media behavior in `workspace/_controllers/useProjectMediaController.ts`, `workspace/_components/TimelineProjectSidebar.tsx`, and pure timeline insertion helpers. Sequence cards manage sequences; folder cards filter media; media cards drag/insert media.
- Add project media metadata hydration in `workspace/_hooks/useWorkspaceProjectMediaMetadataHydration.ts` and pure checks in `workspace/_lib/workspace-project-media-metadata.ts`. Upload and media-library paths should persist measured duration and dimensions instead of faking resolution.
- Add viewer behavior in `WorkspaceVideoViewer.tsx` and pure render helpers, not inside the timeline component.
- Add project persistence in `frontend/src/server/studio` plus `frontend/app/api/studio`; keep client fallback to local storage until backend availability is guaranteed.
- Responsive shell changes belong in `WorkspaceEditorLayout.tsx`, `WorkspaceMobilePanelControls.tsx`, and focused CSS modules. Do not hide Project media or inspector on mobile; expose them as accessible panels around the primary canvas/viewer surface.
- Add UI as route-local components under `workspace/_components` unless it is clearly reused by another route.
- Add MP4 export behavior as API + worker orchestration. The browser can create requests and poll jobs, but it must not pretend to render final server MP4s without a running worker.

## Guardrails

- Canvas mode owns block templates, canvas templates, graph handles, and generation nodes.
- Viewer mode owns project media, sequences, imported assets, generated clips, and timeline editing.
- Applying a canvas template must never reset the timeline.
- Inserting from canvas to timeline must not automatically switch to Viewer.
- Final timeline state must not overlap clips on the same track unless a deliberate compositing/overlay feature is implemented with explicit tests.
- Timeline drags must be frame-aware and must revert if an operation cannot resolve cleanly.
- Video clips with linked audio should move together by default until explicitly unlinked.
- Project settings are sequence/project state, not scattered controls inside unrelated panels.
- Export belongs to the timeline toolbar because it exports the active sequence. Keep the topbar for mode switching, Mock/Live, wallet/session, language, and theme controls.
- Mock/Live stays to the left of the wallet/session cluster so account controls remain grouped.
- Server MP4 export requires a job worker, storage, billing/idempotency, and completed artifact URL. Local manifest or EDL export is a different feature.
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
