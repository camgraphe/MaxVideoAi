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

## Add Timeline Behavior

1. Implement the editing rule in pure helpers before wiring UI.
2. Use frame-aware math for edit points. Prefer integer frame coordinates internally and convert to seconds at UI/API boundaries.
3. Preserve the no-overlap invariant for clips on the same track unless a future explicit compositing feature defines another rule.
4. Move linked video/audio together by default.
5. Revert ambiguous drags to their previous committed state.
6. Add pure tests for the edit operation.
7. Add Playwright tests only after the pure rule is locked.

Timeline UI should call named operations. It should not encode new editing rules directly in pointer handlers.

## Add Viewer Behavior

1. Keep program monitor display settings separate from sequence settings.
2. Keep black gaps black; do not fall back to thumbnails or selected clips.
3. Keep playback driven by the shared timeline playhead.
4. Keep viewer controls focused on playback, in/out, snapshot, and monitor zoom.
5. Add E2E coverage for frame stepping, cuts, trim preview, and audio sync when behavior changes.

## Add Project Media Behavior

1. Treat imported media, generated media, and sequences as project media cards.
2. Media cards should be draggable to compatible timeline tracks.
3. Context menus may expose insert/delete/rename actions.
4. Sidebar buttons should not duplicate timeline tools.
5. Sequence cards should select the active sequence and expose sequence settings in the inspector.

## Add Export Behavior

1. Keep local EDL export separate from MP4 server render.
2. MP4 render must create a server job and show a clear queued/rendering/completed/failed state.
3. The API creates and tracks jobs; the worker claims jobs and renders artifacts.
4. The UI must not imply an MP4 is ready unless a completed job has an output URL.
5. Pricing, free quota, paid reservation, refund/release on failure, and idempotency belong in server modules.

## Performance Rules

- Store transient drag/scrub previews close to the surface that renders them.
- Commit global workspace state on pointer up, not on every pointer move.
- Use `requestAnimationFrame` for playhead drag and scrub updates.
- Memoize derived maps for timeline items, selected keys, nodes, edges, and template summaries.
- Render only visible timeline ranges once projects contain many clips.
- Lazy-load heavyweight modals and server data when a picker/dialog opens.
- Keep media cards thumbnail-based; do not mount full video/audio elements in large grids unless selected.
- Split CSS by surface once a route-local stylesheet becomes difficult to navigate.

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
