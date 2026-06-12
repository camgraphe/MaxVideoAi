# MaxVideoAI Studio Editor Architecture

This guide defines how to extend the Studio editor without turning it into a single hard-to-control workspace file.

Read this before adding blocks, models, timeline behavior, export behavior, or project media surfaces.

## Product Entities

Keep these entities separate in code and tests:

- `Project`: user-owned Studio container. It owns project name, settings, canvas state, sequences, project assets, and export history.
- `Sequence`: one edit timeline. It owns ratio, resolution, fps, tracks, clips, in/out marks, and export settings.
- `Canvas template`: graph-only starter state. Applying a canvas template updates nodes and edges only.
- `Canvas node`: a React Flow generation or source block.
- `Timeline clip`: an edit item on a video or audio track.
- `Asset`: imported, generated, or library media that can be used by the canvas and/or timeline.
- `Project media folder`: a Viewer-mode bin container for imported assets and generated clips. Sequences stay at the Project media root.
- `Model capability`: the source of truth for generation inputs, supported render settings, and pricing-relevant options.
- `Export job`: a queued server-render request with estimate, reservation, worker progress, artifact, and billing state.

## Route Structure

Studio code should stay route-local unless another product surface truly reuses it.

```txt
frontend/app/(core)/(workspace)/app/studio/
  AGENTS.md
  projects/
  workspace/
```

The target workspace shape is:

```txt
workspace/
  WorkspacePage.client.tsx
  _state/
  _controllers/
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
```

`WorkspacePage.client.tsx` should be a composition shell: it wires controllers and components, but it should not own new domain logic.

## Ownership Map

Use this map before adding new code. If a change does not fit one of these owners, create a small focused owner first rather than expanding the orchestrator.

- `WorkspacePage.client.tsx`: state composition and hook wiring only.
- `_components/WorkspaceEditorLayout.tsx`: surface composition and prop wiring only.
- `_components/NodeLibrarySidebar.tsx`: Canvas-only block/template library.
- `_components/TimelineProjectSidebar.tsx`: Viewer-only Project media cards, context menu wiring, and drag surfaces.
- `_components/WorkspaceCanvas.client.tsx`: React Flow canvas surface and canvas-level drop/paste wiring.
- `_components/WorkspaceTimeline.tsx`: timeline shell, toolbar, track list, and high-level edit callbacks.
- `_components/timeline/*`: timeline presentation and pointer interaction hooks.
- `_components/viewer/*`: program monitor, playback layers, viewer controls, and monitor-only display settings.
- `_components/nodes/*`: canvas node cards and node-local UI.
- `_controllers/*`: UI state controllers for a surface, such as canvas and Project media.
- `_hooks/useWorkspace*Actions.ts`: React callbacks that connect UI events to pure helpers and state setters.
- `_state/*`: persisted state contracts, normalizers, sequence snapshots, sequence operations, and local/API persistence adapters.
- `_lib/timeline/*`: pure edit math and timeline invariants.
- `_lib/models/*`: model capability, connector, pricing, and render-option contracts.
- `_lib/templates/*`: graph-only canvas templates.

When a feature crosses surfaces, split it by owner. For example, a generated video output used in the timeline should have canvas output metadata in node code, Project media card behavior in the media controller/sidebar, and insertion rules in timeline helpers.

## Additive Change Checklist

Every Studio change should answer these questions before implementation:

1. Which product entity owns the state?
2. Which surface owns the UI?
3. Which pure helper owns the rule?
4. Which contract test prevents the rule from moving back into the orchestrator?
5. Which browser/E2E test is needed because a user gesture changed?

If a change cannot answer those questions, start with a small design note or helper boundary instead of adding another inline branch.

## Add A Canvas Block

1. Add the block kind to `workspace/_lib/workspace-types.ts`.
2. Add a node renderer under `workspace/_components/nodes/`.
3. Add block creation defaults through the canvas/template helpers, not inline in `WorkspacePage.client.tsx`.
4. Add compatibility rules if the block can connect to other blocks.
5. Add a contract in `tests/maxvideoai-editor-workspace-architecture.test.ts`.
6. Add or update a browser smoke test when the block has drag, drop, picker, or playback behavior.

Do not make source blocks accept inputs unless the product model explicitly needs it. Image, video, audio, logo, and text source blocks should stay output-first.

## Add A Generation Model

1. Add or update the model in the Studio model capability registry.
2. Describe supported workflows, connectors, render options, durations, ratios, resolutions, fps, audio behavior, and pricing-relevant parameters.
3. Keep shot block handles derived from capability data.
4. Keep the inspector derived from capability data.
5. Add tests for required inputs, optional inputs, unsupported inputs, pricing estimate, and audio/lip-sync behavior.

Do not build model-specific shot UIs unless the capability system cannot express the model.

## Add A Canvas Template

1. Add the template builder to the template registry.
2. Add summary metadata: name, description, thumbnail, and AI workflow path.
3. Ensure the template produces nodes and edges only.
4. Ensure applying the template never mutates `timelineItems`, sequences, project media, or export state.
5. Add a contract asserting the template summary and canvas-only behavior.

Templates are for generation graphs, not project resets.

## Add A Sequence Or Project Media Operation

Project media is the Viewer-mode bin. It contains root-level sequences, imported media, generated clips, and folders for organizing imported/generated media.

1. Keep visible card/search/context-menu behavior in `useProjectMediaController.ts` and `TimelineProjectSidebar.tsx`.
2. Keep sequence list decisions in `_state/workspace-sequence-operations.ts`.
3. Keep active sequence snapshots in `_state/workspace-sequence-snapshot.ts`.
4. Keep timeline insertion from imported/generated media in `_hooks/useWorkspaceProjectMediaActions.ts` plus `_lib/workspace-project-media-timeline.ts`.
5. A sequence card opens or manages a sequence. It should not insert itself into the timeline like a media clip.
6. A project media folder opens a filtered bin view. Folder actions live with Project media actions; folder navigation state lives in the Project media controller.
7. A media card drags to compatible tracks. It may also expose insert/delete/move through a context menu.
8. Never delete the last sequence. When deleting the active sequence, choose a deterministic fallback sequence and apply it immediately.
9. Add pure tests for sequence operations and architecture assertions for new controller responsibilities.

## Add Timeline Behavior

1. Implement the editing rule in pure helpers before wiring UI.
2. Use frame-aware math for edit points. Prefer integer frame coordinates internally and convert to seconds at UI/API boundaries.
3. Preserve the no-overlap invariant for clips on the same track unless a future explicit compositing feature defines another rule.
4. Move linked video/audio together by default.
5. Revert ambiguous drags to their previous committed state.
6. Add pure tests for the edit operation.
7. Add Playwright tests only after the pure rule is locked.

Timeline UI should call named operations. It should not encode new editing rules directly in pointer handlers.

### Timeline Invariants

- No final overlaps on the same track unless a future explicit overlay/compositing mode defines that behavior.
- Linked video/audio move together by default.
- Drag preview may show intent, but committed state only changes on a valid drop.
- Invalid or ambiguous drops revert to the previous committed item positions.
- Trim cannot extend beyond the source media duration.
- Viewer preview must follow the same active sequence and playhead as the timeline.

## Add Viewer Behavior

1. Keep program monitor display settings separate from sequence settings.
2. Keep black gaps black; do not fall back to thumbnails or selected clips.
3. Keep playback driven by the shared timeline playhead.
4. Keep viewer controls focused on playback, in/out, snapshot, and monitor zoom.
5. Add E2E coverage for frame stepping, cuts, trim preview, and audio sync when behavior changes.

## Add Project Media Behavior

1. Treat imported media, generated media, and sequences as project media cards.
2. Media cards should be draggable to compatible timeline tracks.
3. Folders may contain imported media and generated clips. Keep sequences at the root level so timeline selection and sequence settings stay obvious.
4. Context menus may expose insert/delete/rename/move actions.
5. Sidebar buttons should not duplicate timeline tools.
6. Sequence cards should select the active sequence and expose sequence settings in the inspector.

## Add Export Behavior

1. Keep local EDL export separate from MP4 server render.
2. MP4 render must create a server job and show a clear queued/rendering/completed/failed state.
3. The API creates and tracks jobs; the worker claims jobs and renders artifacts.
4. The UI must not imply an MP4 is ready unless a completed job has an output URL.
5. Pricing, free quota, paid reservation, refund/release on failure, and idempotency belong in server modules.

### Render Worker Boundary

The browser and Next.js route handlers should not render final MP4 files directly.

- The UI opens the export dialog, prepares a manifest, shows estimate/quota, and submits an export request.
- The API validates the manifest, records a job, reserves billing when needed, and returns a job id.
- A separate worker process claims queued jobs, downloads media from storage, renders with the approved engine, uploads the MP4, and updates progress.
- The UI polls job state and only exposes download/playback when the job is completed.
- Local development may use mock/completed jobs for UX work, but staging/production MP4 export requires the worker, database, and storage configuration to be running.

Do not add a button that appears to render server MP4 if it only creates a local manifest. Label local exports as manifests/EDL, and label server exports as render jobs.

## Performance Rules

- Store transient drag/scrub previews close to the surface that renders them.
- Commit global workspace state on pointer up, not on every pointer move.
- Use `requestAnimationFrame` for playhead drag and scrub updates.
- Memoize derived maps for timeline items, selected keys, nodes, edges, and template summaries.
- Render only visible timeline ranges once projects contain many clips.
- Lazy-load heavyweight modals and server data when a picker/dialog opens.
- Keep media cards thumbnail-based; do not mount full video/audio elements in large grids unless selected.
- Split CSS by surface once a route-local stylesheet becomes difficult to navigate.

## State And Performance Contracts

- Persist project-level state through Studio project APIs when available, with local storage fallback during development.
- Persist sequence state as records, not as loose timeline globals.
- Snapshot the active sequence before switching, duplicating, deleting, exporting, or leaving the workspace.
- Keep hot pointer state in refs or surface-local hooks. Promote it to React state only when another component must render it.
- Avoid large DOM grids with real media elements. Use thumbnails and lazy modals for expensive media browsing.
- Keep drag payloads small and typed by capability: asset id, generated node id, media kind, duration, title, preview URL.
- Prefer one derived summary list for sidebars over recomputing sequence/media metadata inside every card.

## Localization And Appearance

Studio uses the global Core `I18nProvider` and route-local typed copy under
`frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`.
Studio appearance is scoped with `data-studio-theme` on Studio shells and must not
mutate the global `documentElement` theme. Dark remains the default. Light mode is
persisted in `maxvideoai.studio.theme.v1`.

## Verification

Focused Studio checks:

```bash
npm run test:editor
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

Browser-facing behavior:

```bash
npm run test:editor:e2e
```

Full Studio QA:

```bash
npm run qa:editor
```

Large-file audit before architecture waves:

```bash
npm run architecture:audit -- --min-lines 500
```
