# MaxVideoAI Studio Editor Architecture

This guide defines how to extend the Studio editor without turning it into a single hard-to-control workspace file.

Read this before adding blocks, models, timeline behavior, export behavior, or project media surfaces.

## Product Entities

Keep these entities separate in code and tests:

- `Project`: user-owned Studio container. It owns project name, settings, canvas state, sequences, project assets, and export history.
- `Sequence`: one edit timeline. It owns ratio, resolution, fps, tracks, clips, in/out marks, and export settings.
- `Guided project starter`: project-page bootstrap state with a compact generation graph and canonical per-canvas guide annotations.
- `Advanced Canvas template`: graph-only state exposed in the Canvas navigator. It never owns timeline, Project media, sequence, or export state.
- `Canvas node`: a React Flow generation or source block.
- `Timeline clip`: an edit item on a video or audio track.
- `Asset`: imported, generated, or library media that can be used by the canvas and/or timeline.
- `Project media folder`: a Viewer-mode bin container for imported assets and generated clips. Sequences stay at the Project media root.
- `Model capability`: the source of truth for generation inputs, supported render settings, and pricing-relevant options.
- `Export job`: a queued server-render request with estimate, reservation, worker progress, artifact, and billing state.

Project-picker canvas thumbnails are derived presentation data. The browser may cache a compressed capture of the real React Flow surface separately from canonical project/workspace state. Do not place base64 preview images in project JSONB or use a thumbnail as graph truth; fall back to a real starter capture when a personal capture is unavailable.

Project-page guided starters initialize a new project with a small, generation-ready graph and canonical guide state. The visible blocks must match the project card preview, and the project remains guided through normal persistence until the user changes its guide state. Existing projects are never rewritten or upgraded into guided starters during hydration.

In the advanced Canvas navigator, New and Replace apply graph-only templates and clear the active guide state; Add appends only remapped nodes and edges and preserves the active guide state unchanged. Opening a saved canvas restores that canvas's persisted guide state. None of these actions reset sequences, Project media, timeline, or export state.

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

## Public Studio Marketing Boundary

`/studio` is a public, localized, server-rendered, media-driven marketing route. It owns presentation copy, metadata, structured data, and committed product media only; it does not own editor state or execute Studio workflows.

`/app/studio/projects` and the authenticated Studio workspace routes remain the runtime owners for project state and execution. Public landing sections must not import workspace state, React Flow, timeline editing, persistence, generation, or billing modules.

Starter query mapping is the only public-to-runtime workflow contract. CTA links use the server-owned handoff at `/api/studio/marketing-entry`, which resolves the existing server session and preserves only an allowlisted starter before redirecting to login or `/app/studio/projects`. The projects entry route validates and consumes that query before creating a guided project; the marketing route does not import persistence clients or call runtime modules directly.

Real Studio capture generation belongs to `scripts/capture-studio-marketing-media.ts`. The committed optimized media under `frontend/public/assets/studio/marketing/` is presentation-only and is not canonical project or workspace state.

## Ownership Map

Use this map before adding new code. If a change does not fit one of these owners, create a small focused owner first rather than expanding the orchestrator.

- `WorkspacePage.client.tsx`: state composition and hook wiring only.
- `_components/WorkspaceEditorLayout.tsx`: surface composition and prop wiring only.
- `_components/canvas/CanvasFloatingToolbar.tsx`: Canvas-only block/template and canvas-template toolbar.
- `_components/TimelineProjectSidebar.tsx`: Viewer-only Project media cards, context menu wiring, and drag surfaces.
- `_components/WorkspaceCanvas.client.tsx`: React Flow canvas surface and canvas-level drop/paste wiring.
- `_components/WorkspaceTimeline.tsx`: timeline shell, toolbar, track list, and high-level edit callbacks.
- `_components/WorkspaceMobilePanelControls.tsx`: mobile-only controls that open Project media and inspector drawers.
- `_components/timeline/*`: timeline presentation and pointer interaction hooks.
- `_components/viewer/*`: program monitor, playback layers, viewer controls, and monitor-only display settings.
- `_components/nodes/*`: canvas node cards and node-local UI.
- `_controllers/*`: UI state controllers for a surface, such as canvas and Project media.
- `_hooks/useWorkspace*Actions.ts`: React callbacks that connect UI events to pure helpers and state setters.
- `_hooks/useWorkspaceProjectMediaMetadataHydration.ts`: browser-side repair for project media dimensions and duration that were missing when assets entered the workspace.
- `_state/*`: persisted state contracts, normalizers, sequence snapshots, sequence operations, and local/API persistence adapters.
- `_lib/timeline/*`: pure edit math and timeline invariants.
- `_lib/workspace-project-media-metadata.ts`: pure metadata checks and timeline item repair for imported Project media.
- `_lib/models/*`: model capability, connector, pricing, and render-option contracts.
- `_lib/models/workspace-model-certification.ts`: fail-closed Studio readiness for exact model, block, and workflow tuples. Registry publication is necessary but not sufficient for Studio visibility.
- `_lib/workspace-generation-facts.ts`: normalized mode, exact provider field assignments, media provenance, reference usage, and validation shared by pricing and submission.
- `_lib/templates/*`: advanced graph-only Canvas templates plus compact guided project starter builders. Only guided project starter builders own canonical guide annotations.

When a feature crosses surfaces, split it by owner. For example, a generated video output used in the timeline should have canvas output metadata in node code, Project media card behavior in the media controller/sidebar, and insertion rules in timeline helpers.

### Connected editor interaction contract

The Studio shell owns its matte surfaces, type hierarchy and saffron selection tokens locally; do not project its CSS into the global application. `CanvasSelectionActions` stays in screen space, with Settings and Connections direct and secondary operations in Actions. Selection never opens the inspector implicitly. `useWorkspaceMobilePanels.inspectCanvasNode` combines explicit inspection with immediate drawer opening at the shell's mobile breakpoint; closing preserves selection and returns focus.

`CanvasFloatingToolbar.onCreateBlock` creates exactly one block at the visible canvas center for click, tap or Enter. Palette dragging keeps its precise drop location; it does not reuse a second-click placement arm. `CanvasConnectionPicker` builds candidates through `workspaceConnectionCandidates` and the existing graph validator, then invokes the same connect/remove callbacks as handles. Disconnect uses normal graph history and does not delete its source. The guide menu retains hide/reset/delete and an explicit compact-marker option. The miniature map starts collapsed on small screens.

`workspaceGenerationActionReady` is shared by shot cards, their inspector and the generation action callback. Live needs current ready pricing; a recalculating request clears the old amount immediately. Explicit Mock can simulate without a Live quote but still passes operational/model/input validation. `submitWorkspaceShotGeneration` must propagate Live failures in every environment, never silently substitute mock outputs. Certification and common/advanced field ownership remain in existing block policies and the canonical inspector.

Canvas `VideoPreview`/`AudioPreview` and `NodeInspectorMediaPreview` mount native controls only after explicit playback intent, with `preload="none"`. Originals are unchanged. Images and unavailable media do not expose pretend Play controls. This is not a change to `ProgramPlaybackLayers` or program synchronization: those timeline readers remain separate owners and still require measured loading work. Compare network/interaction results before claiming performance improvements.

The named track-actions button and selected-clip toolbar action invoke the existing timeline context-menu callbacks. Keep their 44px targets, keyboard navigation, constrained popovers and original edit/link/undo semantics.

## Connected media boundaries

`workspace-library-assets.ts` adapts Assets, Recent (exact job/output tuple), uploads and qualified tool results to `ToolAssetRef`; project-local IDs are separate. `workspace-media-selection.ts` resolves refs at acceptance through authenticated `/api/studio/media/resolve`. Its read-only server owner is `src/server/studio/media-resolver.ts`: ready/account/kind/deleted/hidden checks include source-output-linked jobs, existing reference URL/MIME policy and storage-object ownership. It returns exact originals and an `originalAccess` classification, not a new signed URL. Future signing must use the owned key or retain an allowed external original exactly.

`useStudioMediaAccount`, `useStudioMediaIntent` and the account/kind/source/query-scoped library hook prevent stale responses and uploads from crossing modal/project/target/account lifetimes. Unauthorized/error states never populate the editor with demos. Browser metadata hydration reads originals only, has two concurrent workers and an eight-second timeout, and does not forge server probe facts.

`workspace-project-media-commands.ts` owns ref-aware merge and bounded local import/removal undo. Bin removal never deletes remote assets or existing timeline clips. Bin buttons and drops delegate to existing compatible timeline insertion; source replacement uses canvas history. Structural refs/facts survive bin, canvas, timeline and the current serializer. Legacy local assets remain usable without fabricated refs.

`lib/studio-media-handoff.ts` is a separate account/token/age-bound producer interface. Projects forwards its token to the explicitly chosen project; `StudioMediaHandoffReceiver` asks for confirmation to import into that project's root media bin. Canvas/timeline destinations are subsequent explicit bin commands, not advertised handoff intents. No producer UI or autonomous Audio/Toolbox owner is changed. This lot does not add revisioned montage persistence (Task 4).

## Guided Canvas Annotations

- Guided annotations are per-canvas presentation state, not graph nodes.
- Canonical annotations belong only to project-page guided starter templates.
- Pure placement belongs to `workspace-guide-layout.ts`.
- Rendering belongs to `CanvasGuideLayer` and `WorkspaceGuideSurfaceLayer`.
- Canvas history owns annotation movement, deletion, and reset; timeline history does not. Hiding or showing the guide is nonhistorical presentation state.
- Project-page guided starters initialize canonical guides for new projects and remain guided through persistence.
- Advanced template New and Replace actions clear the active guide state; Add preserves it unchanged and never injects annotations.
- Opening a saved canvas restores its saved guide state. Existing projects are never migrated or rewritten automatically.

Graph clipboard, Canvas map, pricing, generation, rendering, timeline, and export contracts must remain guide-free. Saved canvases persist their guide state independently, while localized guide copy resolves from persisted semantic keys at render time.

## Studio V1 Capability Rules

- Block presets define user intent.
- Engine capabilities define what each selected model supports.
- The V1 block matrix defines which workflows a block may expose.
- Node UI, inspector UI, pricing, and request payloads must derive from the same policy result.
- Adding an engine requires a test showing that it appears in the right block lists and is absent from incompatible block lists.
- Adding a block requires payload, pricing, output media, and connector tests.

Capability ownership is split across `workspace-block-presets.ts`, the model capability registry,
`workspace-v1-block-matrix.ts`, and `workspace-block-capability-policy.ts`. UI surfaces consume the
resolved policy; they do not maintain independent allowlists. Generation routing and pricing adapters
must consume the same selected capability and normalized block settings used by the node and inspector.

Studio model availability is deliberately fail-closed. A model may be published in the global registry
and still remain absent from Studio until `workspace-model-certification.ts` records a verified
model/block/workflow tuple. Certification is Studio readiness data only; it must not duplicate model
resolutions, durations, media constraints, or provider parameters from the generated engine catalog.

`workspace-generation-facts.ts` resolves the final execution contract once. Wallet preflight and final
submission consume those facts instead of independently inferring mode, audio, input counts, or provider
slots. Semantic React Flow edge kinds remain stable for saved projects, while resolved connectors retain
the exact engine field ID used in the API attachment. Known media provenance (asset ID, MIME, bytes,
dimensions, and duration) travels with that assignment so schema constraints can fail before billing.

Persisted shot settings are normalized against current certified capability values during hydration.
The exact input schema wins over broad catalog summary values. Unsupported stored values move to the
engine default, unrelated node state is preserved, and the editor emits one localized compatibility
notice. This is a compatibility migration, not permission to rewrite existing graphs or templates.

The active sequence owns timeline and export state. Canvas nodes own generation inputs and typed outputs.
Project media owns imported, generated, and completed-export assets. Moving media between those surfaces
must use the existing typed asset/output and timeline insertion contracts rather than duplicating state.

Each generation invocation owns a stable submission ID. Pending nodes derive identity from that submission;
completed nodes and generated Project media assets derive identity from the provider job/output identity.
Different provider jobs append, while replay of the same provider output updates the same node and asset.
Completion merging sorts output identities before assigning positions so concurrent jobs have the same
persisted graph and Project media order regardless of completion order.

### Internal project bootstrap

`minimal-start` is the graph used only when a project has no persisted workspace state. It is a Prompt -> Generate Video graph with no timeline media. It is accepted by project persistence but intentionally excluded from `WORKSPACE_TEMPLATE_SUMMARIES`, so it never appears as a Canvas template card.

Advanced Canvas navigator templates remain graph-only user actions. New and Replace replace the graph and clear the active guide state. Add appends remapped nodes and edges while preserving the active guide state unchanged. None of these modes reset sequences, Project media, timeline, or export state.

## Additive Change Checklist

Every Studio change should answer these questions before implementation:

1. Which product entity owns the state?
2. Which surface owns the UI?
3. Which pure helper owns the rule?
4. Which contract test prevents the rule from moving back into the orchestrator?
5. Which browser/E2E test is needed because a user gesture changed?

If a change cannot answer those questions, start with a small design note or helper boundary instead of adding another inline branch.

## Responsive Surface Rules

Studio is desktop-first, but the workspace must remain usable on narrow screens.

- Keep the central canvas/viewer surface primary. On mobile, it should collapse to a single editor column instead of compressing Project media and inspector into unusable side columns.
- Project media and the inspector stay available on mobile through `WorkspaceMobilePanelControls` and responsive panel slots in `WorkspaceEditorLayout.tsx`.
- Do not hide Project media or inspector permanently at mobile widths. If space is limited, use drawers/overlays with accessible toggle buttons, `aria-controls`, and `aria-expanded`.
- Keep responsive layout state in `WorkspaceEditorLayout.tsx`, toggle UI in `WorkspaceMobilePanelControls.tsx`, and visual behavior in focused CSS modules such as `shell.module.css`, `media.module.css`, `inspector.module.css`, and `timeline.module.css`.
- The timeline should keep a shared horizontal scroll surface. Mobile tweaks may compact labels and controls, but they should not change timeline edit rules.
- Any responsive change needs desktop and mobile browser verification, including Viewer mode, Canvas mode, Project media, inspector, and timeline scroll.

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

1. Decide whether the addition is a project-page guided starter or an advanced Canvas navigator template; do not expose one as the other.
2. Add the template builder to the template registry.
3. Add summary metadata: name, description, thumbnail, and AI workflow path.
4. For an advanced template, produce nodes and edges only. New and Replace clear guide state; Add preserves the current guide state without injecting annotations.
5. For a guided project starter, define canonical annotations with the compact new-project graph and keep existing-project hydration migration-free.
6. Ensure applying either kind never mutates `timelineItems`, sequences, Project media, or export state.
7. Add a contract asserting summary visibility, guide behavior, and canvas-only timeline behavior.

Templates and guided starters initialize generation graphs, not whole-project resets.

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

## Media Metadata Rules

Timeline sizing, export readiness, and inspector file details depend on real media metadata.

- Imported video dimensions and duration should be detected at upload completion and persisted with reusable media-library assets.
- Browser-side `media metadata hydration` is a repair path for project assets that entered the workspace before width, height, or duration was known. It should update project assets and any timeline clips derived from them.
- Project media labels must not invent a resolution or aspect ratio when the source dimensions are unknown. Missing dimensions should stay missing until measured.
- Persisted V1 output `durationSec`, `aspectRatio`, and `resolution` values are request history. Normalization migrates them into `requestedSettings`, creates unknown `sourceMetadata`, and removes the legacy fields; only explicit measured source metadata may populate Project media or export dimensions and duration.
- Timeline audio role is independent of container type. Prefer a dedicated owned audio URL when available; preserve a video URL only for explicitly embedded audio so server export can extract audio from an owned MP4 without treating arbitrary external video as audio.
- Export/render helpers should surface timeline-safe warnings such as `missing_dimensions` instead of silently treating unknown visual sources as 1080p.
- Viewer display may fit a clip visually inside the sequence frame, but the render manifest should still know the source dimensions so scale/upscale decisions remain explicit.
- File metadata shown in Project media inspectors should come from `WorkspaceAssetRecord` and shared metadata helpers, not duplicated card-specific guesses.

## Shell Action Placement

Keep shell actions close to the surface that owns the user intent.

- The topbar owns project navigation, mode switching, session/wallet, language, theme, and the Mock/Live toggle.
- Mock/Live stays to the left of the wallet/session cluster so account and balance controls remain grouped.
- Export belongs to the timeline toolbar because it exports the active sequence, not the whole workspace shell.
- Export dialog state still lives in the export controller and runtime modals. Moving the button must not move export job orchestration into the timeline component.

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
mutate the global `documentElement` theme. Light is the default Studio editor theme.
Explicit user theme choices are persisted in `maxvideoai.studio.theme.v1`, with a
separate user-override flag so older dark defaults do not leak back into fresh sessions.

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
