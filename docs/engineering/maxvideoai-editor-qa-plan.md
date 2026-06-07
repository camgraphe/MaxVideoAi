# MaxVideoAI Editor QA Plan

This guide defines the long-running QA, debugging, and improvement loop for the MaxVideoAI Editor at:

```txt
frontend/app/(core)/(workspace)/app/studio/workspace
```

Use it when running multi-agent passes on timeline editing, canvas insertion, viewer playback, persistence, and final render handoff.

## Goals

- Make the editor behave like a small but reliable video editor.
- Protect core editing rules with focused unit/contract tests.
- Exercise real mouse workflows in the browser after every meaningful UI change.
- Keep canvas generation/import workflows connected to timeline editing.
- Record each pass as reproducible findings instead of one-off visual feedback.

## Sub-Agent Roles

Run these roles in parallel when doing a serious QA pass. The lead agent owns prioritization, code integration, and final verification.

### Timeline Editing Agent

Scope:

- `WorkspaceTimeline.tsx`
- `workspace-timeline-editing.ts`
- `workspace-timeline-tracks.ts`
- timeline sections of `tests/maxvideoai-editor-workspace-architecture.test.ts`

Checks:

- Cut, trim, ripple trim, roll trim, delete, undo, redo.
- Drag on one clip, linked video/audio pairs, and multi-selected clips.
- Marquee selection, Shift/Cmd selection, snapping, playhead dragging.
- V1/V2/V3 track ordering and moving clips between video tracks.

Required invariants:

- Timeline item ids are unique.
- Each linked video/audio segment has its own `linkedGroupId`.
- Moving a linked video segment keeps its linked audio aligned.
- Moving a multi-selection preserves relative offsets.
- Trim cannot extend a clip beyond source duration.
- Same-track overlap is intentional only when the editing mode allows it.

### Viewer And Playback Agent

Scope:

- `WorkspaceVideoViewer.tsx`
- `workspace-timeline-render.ts`
- `workspace-timecode.ts`
- `workspace-project-settings.ts`

Checks:

- Playback follows the timeline playhead.
- Empty timeline gaps render black.
- Clip-to-clip changes do not flash stale thumbnails.
- Project aspect ratio, resolution, and FPS drive viewer labels and timecode.
- Linked audio and music tracks stay consistent with selected timeline time.

Required invariants:

- Viewer time is derived from the shared playhead.
- A missing visual clip is black, not a fallback poster.
- Timecode is `HH:MM:SS:FF` and uses project FPS.
- Final render manifest includes project settings and rejects blocked media.

### Canvas To Timeline Agent

Scope:

- `WorkspacePage.client.tsx`
- `WorkspaceCanvas.client.tsx`
- `NodeSettingsPanel.tsx`
- `WorkspaceAssetLibraryModal.tsx`
- `WorkspaceAssetLibraryBrowser.tsx`
- `workspace-generation.ts`
- `workspace-library-assets.ts`
- `workspace-templates.ts`

Checks:

- Imported video, image, and audio blocks can be sent to the timeline.
- Generated outputs create placeholders while processing and playable clips when ready.
- Insert, overwrite, and replace modes behave predictably.
- Sending a canvas item to the timeline does not switch modes unless requested.

Required invariants:

- Video imports with sound create video plus linked audio.
- Audio imports land on an audio editing track.
- Images land as still visual clips.
- Processing or failed outputs cannot be placed as ready media.
- Canvas selection and timeline selection do not corrupt each other.

### Persistence And Export Agent

Scope:

- workspace localStorage hydration in `WorkspacePage.client.tsx`
- `workspace-timeline-render.ts`
- project settings helpers

Checks:

- Reload keeps timeline items, tracks, project settings, and focus mode.
- Stale persisted timelines are normalized.
- Undo/redo history does not persist unexpectedly after reload.
- Export stores a render manifest with real media references and blockers.

Required invariants:

- Hydration repairs duplicate ids and stale linked groups.
- Persisted media URLs are normalized for video, image, and audio.
- Render manifest reports blockers before export attempts.

### Browser QA Agent

Scope:

- In-app browser at `http://localhost:3000/app/studio/workspace`
- Desktop viewport first, then a smaller viewport for layout pressure.

Checks:

- Use actual mouse drags for clips, handles, playhead, and marquee selection.
- Capture before/after state from DOM attributes such as `data-timeline-item`, `data-linked-group`, and selected class names.
- Report exact reproduction steps and whether undo restores the initial state.

Required invariants:

- No duplicated DOM clip ids after interactions.
- Selected linked clips render as one logical group.
- Dragging a group moves all selected clips by the same delta.
- Browser tests restore state after destructive checks when possible.

## Standard QA Loop

1. Start or verify the dev server:

```bash
npm --prefix frontend run dev
```

2. Run static editor checks:

```bash
npm run qa:editor
```

3. Run browser workflows manually or through browser automation:

- Reset or load `Dev Blocks`.
- Cut one linked video clip into three pieces.
- Shift-click a second segment.
- Marquee-select two or more timeline clips.
- Drag the selected group.
- Undo and verify positions return.
- Trim start and end handles.
- Toggle snapping and repeat a drag.
- Add V2, drag a visual clip vertically, and verify linked audio stays on the linked audio track.
- Send imported video, image, and audio blocks from canvas to timeline.
- Generate in mock mode and verify processing placeholder then ready output.
- Export manifest and inspect readiness notice.

4. Record findings in this shape:

```txt
Area:
Severity:
Expected:
Actual:
Repro:
Likely files:
Suggested test:
```

5. Fix the highest-risk bug first, then rerun:

```bash
npm run test:editor
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
npm --prefix frontend run lint
git diff --check
```

6. Re-test the exact browser repro before moving to the next finding.

## User Workflow Matrix

Use this matrix for long sessions. Each pass should cover at least three workflows, and every third pass should cover all workflows.

| Workflow | Canvas | Timeline | Viewer | Export |
| --- | --- | --- | --- | --- |
| Generated ad | Create shot, mock generate | Insert output, cut, reorder | Play through | Manifest ready |
| Imported edit | Add video/image/audio blocks | Send to timeline, trim | Play import + gaps | Manifest ready |
| Audio mix | Add music and linked video audio | Move linked clips and music | Check audio-bearing clips | Manifest includes tracks |
| Multi-track edit | Add V2 | Move clip between V1/V2 | Viewer shows active upper track | Manifest includes V2 |
| Recovery | Load stale state | Normalize ids/groups | No stale poster flash | Blockers explicit |

## Test Coverage Targets

Add or update contract tests when these rules change:

- Timeline pure editing rules in `tests/maxvideoai-editor-workspace-architecture.test.ts`.
- Project settings and timecode helpers.
- Render manifest readiness and blocker logic.
- Canvas-to-timeline item construction for generated and imported media.

Browser QA is required when a change touches:

- Pointer handling.
- Drag, resize, marquee, playhead, or snapping.
- Viewer playback or selected clip rendering.
- Asset picker, library modal, or send-to-timeline actions.

## Current Commands

```bash
npm run test:editor
npm run test:editor:e2e
npm run qa:editor
npm run test:validate
npm --prefix frontend run lint
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

## Pass Summary Template

```txt
Pass:
Agents:
Workflows tested:
Findings fixed:
Findings deferred:
Tests run:
Browser checks:
Next pass focus:
```
