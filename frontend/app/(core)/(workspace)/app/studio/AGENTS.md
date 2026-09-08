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
- `Guided project starter`: project-page bootstrap state with a compact generation graph and canonical per-canvas guide annotations.
- `Advanced Canvas template`: graph-only state exposed in the Canvas navigator. It never owns timeline, Project media, sequence, or export state.
- `Canvas node`: a generation/source block in React Flow.
- `Timeline clip`: a montage item on video or audio tracks.
- `Asset`: user media, generated media, or imported media usable by canvas and/or timeline.
- `Project media folder`: a Viewer-mode bin container for imported assets and generated clips. Keep sequences at the Project media root.
- `Model capability`: the source of truth for shot inputs, render options, and routing.

## Additive Rules

Prefer adding new behavior by extending contracts and pure helpers instead of growing `WorkspacePage.client.tsx`.

- Add a new block type by updating `workspace-types.ts`, `workspace-templates.ts`, node rendering in `_components/nodes/`, and compatibility tests.
- Add or publish a model only through `frontend/config/model-registry.json` and its documented generators. Studio visibility additionally requires an explicit block/workflow certification in `workspace-model-certification.ts`; uncertified models fail closed.
- Keep `workspace-capabilities.ts` as the public Studio capability aggregation boundary. Keep engine schema facts in `model-capability-registry.ts`, exact block intent in `workspace-v1-block-matrix.ts`, and normalized pricing/submission facts in `workspace-generation-facts.ts`. The shot block should derive controls and connectors from the resolved policy.
- Add timeline behavior in `workspace-timeline-editing.ts`, `workspace-timeline-render.ts`, or `workspace-timeline-tracks.ts` before wiring UI.
- Add sequence list behavior in `workspace/_state/workspace-sequence-operations.ts` before wiring Project media or inspector UI.
- Add Project media behavior in `workspace/_controllers/useProjectMediaController.ts`, `workspace/_components/TimelineProjectSidebar.tsx`, and pure timeline insertion helpers. Sequence cards manage sequences; folder cards filter media; media cards drag/insert media.
- Add project media metadata hydration in `workspace/_hooks/useWorkspaceProjectMediaMetadataHydration.ts` and pure checks in `workspace/_lib/workspace-project-media-metadata.ts`. Upload and media-library paths should persist measured duration and dimensions instead of faking resolution.
- Add viewer behavior in `WorkspaceVideoViewer.tsx` and pure render helpers, not inside the timeline component.
- Add project persistence in `frontend/src/server/studio` plus `frontend/app/api/studio`; keep client fallback to local storage until backend availability is guaranteed.
- Keep project-picker thumbnails as derived previews, not canonical project state. Capture the real React Flow surface, store the compressed preview separately from workspace JSON, and retain a real starter screenshot as fallback.
- Keep project-page guided starters compact and distinct from advanced Canvas navigator templates; the project card preview and opened graph must describe the same workflow.
- Project-page guided starters initialize a new project with their compact graph and canonical guide state. They remain guided through persistence; never migrate or rewrite an existing project into a guided starter during hydration.
- In the advanced Canvas navigator, New and Replace apply graph-only templates and clear the active guide state; Add appends only remapped nodes and edges and preserves the active guide state unchanged. Opening a saved canvas restores that canvas's persisted guide state.
- Responsive shell changes belong in `WorkspaceEditorLayout.tsx`, `WorkspaceMobilePanelControls.tsx`, and focused CSS modules. Do not hide Project media or inspector on mobile; expose them as accessible panels around the primary canvas/viewer surface.
- Add UI as route-local components under `workspace/_components` unless it is clearly reused by another route.
- Add MP4 export behavior as API + worker orchestration. The browser can create requests and poll jobs, but it must not pretend to render final server MP4s without a running worker.

## Guardrails

- Canvas mode owns block templates, canvas templates, graph handles, and generation nodes.
- Viewer mode owns project media, sequences, imported assets, generated clips, and timeline editing.
- Applying a canvas template must never reset the timeline. Advanced Canvas templates and guided project starters also must not reset sequences, Project media, or export state.
- Inserting from canvas to timeline must not automatically switch to Viewer.
- Final timeline state must not overlap clips on the same track unless a deliberate compositing/overlay feature is implemented with explicit tests.
- Timeline drags must be frame-aware and must revert if an operation cannot resolve cleanly.
- Video clips with linked audio should move together by default until explicitly unlinked.
- Project settings are sequence/project state, not scattered controls inside unrelated panels.
- Export belongs to the timeline toolbar because it exports the active sequence. Keep the topbar for Canvas/Viewer switching, the shared MaxVideoAI menu, wallet/session, and an explicit saved exit.
- Product Studio is Live by default and exposes no Mock/Live toggle. A local simulation may be selected only by the explicit non-production E2E query owned by `studio-generation-mode.ts`; production must always ignore it.
- Reuse `AppSiteMenuButton` for app destinations, language, and appearance. Every same-tab app navigation from Studio must pass through the workspace save/ACK boundary before leaving the editor.
- Server MP4 export requires a job worker, storage, billing/idempotency, and completed artifact URL. Local manifest or EDL export is a different feature.
- Keep the editor CSS isolated in `maxvideoai-editor.module.css`.

## Guided Canvas Annotations

- Guided annotations are per-canvas presentation state, not graph nodes.
- Canonical annotations belong only to project-page guided starter templates.
- Pure placement belongs to `workspace-guide-layout.ts`.
- Rendering belongs to `CanvasGuideLayer` and `WorkspaceGuideSurfaceLayer`.
- Canvas history owns annotation movement, deletion, and reset; timeline history does not. Hide/show is nonhistorical.
- Project-page guided starters initialize canonical guides for new projects and remain guided through persistence.
- Advanced template New and Replace actions clear the active guide state; Add preserves it unchanged and never injects annotations.
- Opening a saved canvas restores its saved guide state. Existing projects are never migrated or rewritten automatically.
- Keep guide data out of graph clipboard, Canvas map, pricing, generation, render, timeline, and export contracts.
- Persist guide state independently for each saved canvas and resolve localized copy from semantic keys.

## Studio V1 Capability Rules

- Block presets define user intent.
- Engine capabilities define what each selected model supports.
- The V1 block matrix defines which workflows a block may expose.
- The Studio certification registry defines which model/block/workflow tuples have passed payload, pricing, and UI verification. Publication alone never makes a model selectable in Studio.
- Node UI, inspector UI, pricing, and request payloads must derive from the same policy result.
- Adding an engine requires a test showing that it appears in the right block lists and is absent from incompatible block lists.
- Adding a block requires payload, pricing, output media, and connector tests.

Keep preset intent in `workspace-block-presets.ts`, engine facts in the model capability registry,
block/workflow compatibility in `workspace-v1-block-matrix.ts`, and the shared resolved decision in
`workspace-block-capability-policy.ts`. Do not add surface-local compatibility or pricing allowlists.
`workspace-generation-facts.ts` is the shared final owner for mode, exact field assignments, reference
counts, media presence, constraints, and validation used by both wallet preflight and submission.

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
