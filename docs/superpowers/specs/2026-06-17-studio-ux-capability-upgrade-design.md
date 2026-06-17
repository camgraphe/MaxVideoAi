# Studio UX Capability Upgrade Design

## Goal

Make Studio easier to understand and safer to use by turning every canvas block, media item, timeline operation, and menu into a predictable product contract:

- a user can tell what a block does before generating;
- a block exposes the right model-specific settings without becoming noisy;
- unavailable settings are disabled or hidden with a short reason;
- price and readiness are shown when inputs are sufficient;
- media metadata is real, not inferred;
- timeline actions preserve linked audio/video and no-overlap guarantees;
- menus, popovers, dialogs, and mobile panels are accessible.

## Current Findings

Five read-only audits were run on branch `codex/maxvideoai-editor`.

### Canvas Blocks And Engines

The largest weakness is the source of truth for block behavior. Studio has block presets, model capabilities, pricing adapters, connector helpers, and tool-specific inspector sections, but the policy is not complete enough to answer all product questions from one place.

Observed gaps:

- `WorkspaceModelCapability` does not yet describe all per-mode input rules, mutual exclusions, output counts, output kinds, accepted formats, source limits, or price-relevant settings.
- `resolveWorkspaceBlockPolicy` already exists but is not fully consumed by node UI, inspector UI, pricing, and request builders.
- `ShotInputDock` can show handles that later reject connections, without always exposing the reason.
- Image generation/editing and Luma modify/reframe settings are thinner than the real tools.
- Character, angle, upscale, audio, and chat blocks still mix generic controls with tool-specific UI.
- Chat exposes media connectors, but the API currently sends messages only, so connected media is misleading unless implemented.

### Timeline And Viewer

Timeline rules are better structured than the canvas block layer, but several edge cases remain risky:

- gap selection receives a track from the UI but current gap detection/deletion is sequence-global;
- multi-delete/ripple is sequential and can double-shift or drift linked groups;
- linked audio/video movement differs between automatic and manual links;
- audio inspector controls can edit a video clip while audible audio lives in its linked audio clip;
- linked audio drop previews and locked-track validation need stricter coverage;
- fit-height and source metadata behavior depend on measured dimensions.

### Project Media And Library

Project Media is a P0 dependency for the whole editor because render safety, fit behavior, timeline duration, and inspector trust depend on it.

Observed gaps:

- audio uploads do not persist measured duration;
- `save-output` omits `durationSec` in the response;
- hydration checks videos missing dimensions but not images or duration-only videos;
- timeline clips do not always receive `sourceDurationSec` after metadata repair;
- some labels invent metadata, such as `48kHz`;
- library search is client-side over loaded pages only;
- Project Media has inert filter/grid controls;
- imports cap project assets at 120;
- generated cards do not yet have a complete inspector.

### UI, Menus, A11y, Mobile

Studio has many custom menus, popovers, and dialogs. Their semantics are inconsistent and focus behavior is incomplete.

Observed gaps:

- menu-like popovers sometimes use `role="dialog"`;
- filters sometimes use tab roles without real tab panels;
- focus trap, initial focus, roving focus, Escape, and focus return are inconsistent;
- drag-heavy interactions need keyboard alternatives;
- hidden scrollbars and very small typography reduce discoverability;
- mobile panels exist but need drawer-grade behavior and tests.

### Architecture And Tests

The current `npm run test:editor` passed but is too narrow for the present Studio surface. It does not cover many adjacent Studio contracts.

Hot files from the live large-file audit:

- `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineProjectSidebar.tsx`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useProjectMediaController.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceCanvas.client.tsx`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar.tsx`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceTimeline.tsx`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineClipInspector.tsx`
- `frontend/app/(core)/(workspace)/app/studio/projects/StudioProjectsPage.client.tsx`

## Product Decisions

### 1. Capability Policy Is The Source Of Truth

Every generation-like block must resolve through a policy contract that can answer:

- block purpose;
- compatible models;
- required inputs by mode;
- optional inputs by mode;
- min/max input counts;
- mutually exclusive inputs;
- visible controls;
- disabled controls with reasons;
- hidden controls;
- output media kind;
- output count behavior;
- pricing readiness;
- request-builder fields.

`resolveWorkspaceBlockPolicy` should become the central decision layer. Node UI, inspector UI, pricing, generation requests, and compatibility tests should consume the same normalized data.

### 2. Blocks Are Specialized Mini Tools

The canvas must not feel like copied generic cards. Each block has a purpose and should expose the minimum useful controls inline, with advanced settings in inspector or compact menus.

Core block families:

- **Generate Video**: prompt-first video generation, with model-specific image/video/audio references when supported.
- **Modify Video**: source-video-first workflow, with edit/reframe/upscale options that do not compete with generation.
- **Generate Image**: prompt/reference image generation, with count/format/watermark/ratio where supported.
- **Modify Image**: reference-image-first editing, with edit strength/count/format where supported.
- **Character Builder**: the real character tool, with identity/reference/style/output controls.
- **Angle Generation**: image reference plus 3D angle picker, output image(s), not video.
- **Upscale Image/Video**: source-first enhancement, with factor/format/target resolution/source limits.
- **Music**: prompt/mood/duration/instrumental or vocal options where available.
- **Voice-over**: script/voice/language/speed/emotion options.
- **SFX**: prompt plus optional video/motion context, with duration/intensity.
- **Sound Design**: video-aware audio bed/SFX workflow.
- **LLM Chat**: a real portable chat node; connected context must be included or the handles must be removed.
- **Source/Output**: source blocks are output-first; output blocks represent generated artifacts and timeline insertion state.

### 3. Node Layout Standard

Use one stable node grammar:

1. Header: icon, title, optional short description, settings affordance.
2. Primary controls: model, mode, key parameters.
3. Optional media/prompt area only when needed.
4. Generate row: action + price + loading state.
5. Status row: ready, needs attention, missing input, unsupported combination.
6. Inputs/outputs: compact handles aligned with rows; no oversized connector squares.

Do not use large empty "Click to generate" blocks when the inline settings can explain the node. Use media preview areas only for source/preview-driven blocks.

### 4. UI Control Taxonomy

- Use segmented controls for mutually exclusive modes and filters.
- Use switches or pressed buttons for binary states.
- Use selects for model choices and long option sets.
- Use chips for compact optional states and connected/unconnected summaries.
- Use sliders only for continuous numeric values where visual feedback matters.
- Use steppers/number inputs for exact numeric values.
- Use menus for short action lists.
- Use popovers for non-blocking pickers.
- Use dialogs for destructive or blocking flows.

### 5. Metadata Must Be Truthful

Studio must not invent duration, resolution, sample rate, or aspect ratio. Unknown metadata should remain unknown until measured, and the UI should explain `measuring`, `unknown`, or `failed`.

Exports can warn on missing dimensions, but fit/upscale/render decisions should be explicit.

### 6. Timeline Invariants

- Same-track final overlaps remain invalid.
- Linked video/audio moves together by default.
- Linked audio must be validated against its target track even when the user drags the video.
- Gap selection can be track-local, but delete-and-close-gap must document whether it ripples one track or all tracks. Recommended: default gap click selects the clicked track gap; command should offer "Delete gap on this track" and later a separate "Delete gap across sequence" command.
- Batch delete/ripple must be atomic, not a loop of individual deletes.

### 7. Mobile Is Supported As A Review/Edit Surface

Desktop stays primary. Mobile must still allow:

- open media panel;
- open inspector;
- use Viewer playback;
- select timeline clips;
- make basic timeline edits;
- open canvas templates/saved canvases;
- place blocks with click-to-place;
- export/review state.

Advanced graph editing can be less ergonomic on phone, but it must not be broken or inaccessible.

## User Simulations

Run these simulations before closing the implementation branch:

1. New creator: create blank project, import video, trim, add audio, export.
2. AI canvas creator: create prompt/image reference, generate video, inspect price/readiness, send output to timeline.
3. Character creator: build a character using reference/style options, verify no video models appear unless relevant.
4. Video editor: modify a source video, then upscale it, preserving source and output clarity.
5. Audio-first creator: create music, voice-over, and SFX, then place them on separate audio tracks.
6. Prompt engineer: use LLM chat node across multiple turns and connect text output to generation.
7. Heavy library user: load/search/filter/import many image/video/audio assets without false empty results.
8. Keyboard-only user: navigate menus/dialogs, place a block, inspect it, undo/redo, and operate context menus.
9. Mobile reviewer: open project on phone viewport, inspect media and timeline, switch panels, export.
10. Render-safe user: use media with missing dimensions and see explicit warnings, not fake 1080p assumptions.

## External Inspiration

Use these for principles, not for copying UI:

- React Flow accessibility and custom handles for graph behavior.
- WAI-ARIA Authoring Practices for menu/dialog/popover keyboard behavior.
- ComfyUI for capability-rich node workflows.
- n8n for low-code node clarity, credentials/settings separation, and error affordances.
- Blender node editor for socket/handle mental model.
- Remotion for video render/export separation.

## Acceptance Criteria

- Each canvas block has a tested capability contract.
- Each block's visible controls derive from the same policy used for pricing and generation.
- Unsupported options are disabled or hidden with a clear reason.
- Price appears only when enough information exists to estimate it truthfully.
- Output media kinds match actual generated artifacts.
- Project media metadata is measured, persisted, and repaired consistently.
- Timeline linked media cannot commit an overlap through an indirect drag.
- Menus/dialogs have keyboard behavior and focus management tests.
- Mobile drawers expose Project Media and Inspector without hiding those surfaces.
- `npm run qa:editor` passes, plus the expanded Studio contract bundle defined in the implementation plan.
