# Task 6 Report: Generated Media Lifecycle

## Changed Files

- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generated-media.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceGenerationActions.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasController.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/WorkspacePage.client.tsx`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-timeline.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-builders.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-normalizers.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-api-persistence.ts`
- `tests/maxvideoai-editor-generation-blocks.test.ts`
- `tests/maxvideoai-editor-project-media-timeline.test.ts`

## Design Notes

- Ready output nodes now convert through `workspaceAssetFromOutputNode` into stable, typed project assets (`asset-${node.id}`). The conversion carries media kind, URL, thumbnail, duration, output-declared display metadata, generated folder, and video audio metadata.
- `WorkspacePage.client.tsx` owns the callback that upserts generated assets, while the canvas controller and generation hook only relay the completed output. Regenerating a node replaces its stable asset id rather than creating duplicates.
- Typed project-media insertion uses asset kind: images become stills, audio is placed on audio tracks, and video uses a dedicated `audioUrl` for its linked audio item when present. Existing imported video behavior stays backward-compatible through `hasAudio ?? true`.
- Generated-clip delete and folder-move actions update the corresponding persisted project asset. Asset persistence now retains `audioUrl` and `hasAudio`.
- Output metadata accepts `text`; it gets a prompt source handle but cannot be placed on a media timeline.

## Verification

Passed:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-generation-blocks.test.ts \
  tests/maxvideoai-editor-project-media-timeline.test.ts
```

Result: 63 tests passed, 0 failed.

```bash
git diff --check
```

Result: passed with no whitespace errors.

Also run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

Result: failed only on pre-existing errors outside this task in `workspace-shot-input-dock.tsx`, `useWorkspaceShotPricing.ts`, and `workspace-v1-block-matrix.ts`. The callback-related errors introduced during implementation were corrected; none remain in the final type-check output.

## Commit

`fb750c33` (`feat: persist Studio generated outputs as project media`)

## Concerns

- Full TypeScript validation remains blocked by the three unrelated existing errors listed above.

## Fix pass

### Changed Files

- `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useProjectMediaController.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generated-media.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-drag.ts`
- `tests/maxvideoai-editor-generation-blocks.test.ts`
- `tests/maxvideoai-editor-project-media-timeline.test.ts`

### Verification

Passed:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-generation-blocks.test.ts \
  tests/maxvideoai-editor-project-media-timeline.test.ts
```

Result: 65 tests passed, 0 failed.

```bash
git diff --check
```

Result: passed with no whitespace errors.

### Commit

`bec9eddb` (`fix: dedupe persisted Studio generated media`)

### Concerns

- None for this focused fix pass.

## Fix pass 2

### Changed Files

- `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generated-media.ts`
- `tests/maxvideoai-editor-project-media-timeline.test.ts`
- `.superpowers/sdd/task-6-report.md`

### Verification

Passed:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-generation-blocks.test.ts \
  tests/maxvideoai-editor-project-media-timeline.test.ts
```

Result: 66 tests passed, 0 failed.

```bash
git diff --check
```

Result: passed with no whitespace errors.

### Commit

`5d4c8602` (`fix: sync generated media folder moves`)

### Concerns

- None for this focused fix pass.
