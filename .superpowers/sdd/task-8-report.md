# Task 8 Report: Studio Timeline And Viewer V1

## Changed Files

- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-gap-editing.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-linked-audio.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-clip-composition.ts`
- `tests/maxvideoai-editor-timeline-interaction.test.ts`
- `tests/maxvideoai-editor-timeline-export.test.ts`
- `tests/e2e/editor/editor-timeline.spec.ts`

## Implementation Notes

- Added fail-closed linked selection movement that validates every linked member against timeline track occupancy before accepting a move.
- Changed selected-gap deletion to preserve clicked-track gap selection while rippling all tracks after the selected time range, reverting when that would create an overlap.
- Added a composition builder that keeps native source dimensions independent from sequence dimensions and exposes fit/fill/current scale plus the export transform. The existing inspector Fit height control and viewer composition path consume the shared composition helpers.
- Added the smallest Playwright regression using the existing `dragTimelineClip` helper. The fixture does not provide a video-free/audio-occupied target range, so the browser case also has a video collision; the pure helper test isolates the required audio-only collision.

## Verification

- PASS: `PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-timeline-interaction.test.ts tests/maxvideoai-editor-timeline-selection.test.ts tests/maxvideoai-editor-timeline-export.test.ts` (26 passed, 0 failed).
- PASS: `git diff --check`.
- PASS: `PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-timeline.spec.ts --list` (37 tests discovered, including the new regression).
- BLOCKED, pre-existing: `frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json` reports unrelated existing errors in `workspace-shot-input-dock.tsx`, `useWorkspaceShotPricing.ts`, and `workspace-v1-block-matrix.ts`.

## Commit

`d51af7d0` (`fix: harden Studio timeline viewer editing`)

## Concerns

- The E2E fixture cannot model an audio-only collision without new fixture setup, which Task 8 explicitly avoids. The isolated pure test covers that invariant.

## Fix Pass: Important Review Findings

### Commit

`cd447869` (`fix: validate linked drops and media provenance`)

### Changed Files

- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-builders.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-linked-audio.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing.ts`
- `tests/maxvideoai-editor-timeline-interaction.test.ts`
- `tests/maxvideoai-editor-project-media-timeline.test.ts`
- `tests/e2e/editor/editor-timeline.spec.ts`

### Findings Fixed

1. Wired linked-member occupancy validation into `moveWorkspaceTimelineSelectionWithMode`. A collision on a linked peer now returns the last committed item array before insert behavior can run. Insert results are also rejected whenever they contain any same-track overlap.
2. Replaced the invalid overlapping audio fixture with an overlap-free timeline. The regression proves the video target is free, only the linked audio member collides, and both the pure helper and production move API revert.
3. Separated temporary edit duration from imported source provenance. Unknown video/audio may still receive `6s`/`12s` edit lengths, but `sourceDurationSec` is omitted until measured metadata exists; measured duration remains preserved exactly.
4. Added Playwright coverage asserting one gap ghost exists and is nested only under the clicked video track, with no matching ghost on the audio track.

### TDD Evidence

- RED: the production linked move regression committed a shifted pair at `1s` instead of returning the original overlap-free timeline.
- RED: unknown imported video/audio builders persisted temporary `6s`/`12s` durations as `sourceDurationSec`.
- GREEN: both regressions pass after the production changes.

### Verification

- PASS: `PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-timeline-interaction.test.ts tests/maxvideoai-editor-timeline-selection.test.ts tests/maxvideoai-editor-timeline-export.test.ts tests/maxvideoai-editor-project-media-timeline.test.ts` (43 passed, 0 failed).
- PASS: focused architecture contract `MaxVideoAI editor timeline editing supports drag ordering and cut splits` (1 passed, 0 failed).
- PASS: `git diff --check`.
- BLOCKED by authentication environment: the focused gap-ghost Playwright run redirected to `Create your workspace account` before the editor mounted, so the new lane assertion did not execute.
- PRE-EXISTING: full Studio architecture suite remains at 28 passed / 2 failed in unrelated shot-control and pricing-preflight contracts.
- PRE-EXISTING: frontend TypeScript check still reports the unrelated errors in `workspace-shot-input-dock.tsx`, `useWorkspaceShotPricing.ts`, and `workspace-v1-block-matrix.ts`.

### Concerns

- Browser execution of the new gap-ghost assertion still requires an authenticated editor E2E environment. The test compiles and reaches the shared workspace opener, but this local run was redirected before fixture setup completed.

## Fix Pass 2: Linked Project Media And Duration Provenance

### Commit

`737404d2` (`fix: reject linked inserts and preserve provenance`)

### Changed Files

- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-insert.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-timeline.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-normalizers.ts`
- `tests/maxvideoai-editor-project-media-timeline.test.ts`
- `tests/maxvideoai-editor-sequence-api-persistence.test.ts`

### Findings Fixed

1. Added a fail-closed overlap gate to every `insertWorkspaceTimelineItems` result mode. Insert, overwrite, and replace candidates now revert to the original timeline if any prepared linked member would produce a same-track overlap. `resolveProjectAssetTimelineInsert` also treats a reverted or overlapping candidate as an API-level insertion failure and exposes no candidate items to commit.
2. Removed edit-duration fallback assignment from `retimeNewItems` and `normalizeTimelineMediaUrls`. Unknown imported duration remains absent through project-media insertion, media normalization, JSON persistence/reload, and unmeasured hydration. Once metadata measures `9.25s`, hydration writes that exact value to linked video and audio provenance.

### TDD Evidence

- RED: linked project-media insertion returned `ok: true` when video space was free but its automatic audio member overlapped an existing audio clip.
- RED: insertion converted unknown source duration into `6s` for both linked members.
- RED: persisted workspace reload converted an unknown `6s` edit duration into known source provenance.
- GREEN: all three regressions pass after the insertion gate and provenance fallback removals.

### Verification

- PASS: `PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-timeline-interaction.test.ts tests/maxvideoai-editor-timeline-selection.test.ts tests/maxvideoai-editor-timeline-export.test.ts tests/maxvideoai-editor-project-media-timeline.test.ts tests/maxvideoai-editor-sequence-api-persistence.test.ts` (50 passed, 0 failed).
- PASS: focused architecture contract `MaxVideoAI editor timeline editing supports drag ordering and cut splits` (1 passed, 0 failed).
- PASS: `git diff --check`.
- PRE-EXISTING: frontend TypeScript check still reports only the unrelated errors in `workspace-shot-input-dock.tsx`, `useWorkspaceShotPricing.ts`, and `workspace-v1-block-matrix.ts`.

### Concerns

- The repository-wide TypeScript check remains blocked by the three unrelated Studio errors listed above; this fix pass introduced no additional TypeScript diagnostics.

## Fix Pass 3: Reorder Safety And Render Provenance

### Commit

`97dc46f5` (`fix: guard timeline reorders and render provenance`)

### Changed Files

- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render.ts`
- `tests/maxvideoai-editor-timeline-interaction.test.ts`
- `tests/maxvideoai-editor-timeline-export.test.ts`

### Findings Fixed

1. Consolidated timeline candidate commits behind `commitTimelineEditWithoutOverlap`. Insert, directional move, explicit reorder, ripple delete, positioned drag, and insert-mode drag paths now return the original items whenever the candidate has any same-track overlap. Directional and reorder regressions start overlap-free and prove normalized linked audio cannot collide with independent audio.
2. Changed `WorkspaceTimelineRenderClip.sourceDurationSec` to `number | null`. Unknown source duration now serializes as `null`, while `durationSec` and `sourceEndSec` continue to carry the usable edit window for Remotion. Measured source duration remains exact. Server renderer and Remotion share the updated manifest type and require no provenance fallback because playback uses edit duration/source window fields.

### TDD Evidence

- RED: directional move normalized linked audio from `8s` to `4s` on top of independent audio and returned the overlapping candidate.
- RED: explicit reorder produced the same linked-audio collision and committed it.
- RED: render manifest converted an unknown `6s` edit duration into known `sourceDurationSec: 6`.
- GREEN: both move paths now return the original array, and manifest build plus JSON serialization preserve `sourceDurationSec: null` while retaining `durationSec: 6`.

### Verification

- PASS: full Task 8 and server-render suite: `tests/maxvideoai-editor-timeline-interaction.test.ts`, `tests/maxvideoai-editor-timeline-selection.test.ts`, `tests/maxvideoai-editor-timeline-export.test.ts`, `tests/maxvideoai-editor-project-media-timeline.test.ts`, `tests/maxvideoai-editor-sequence-api-persistence.test.ts`, and `tests/timeline-export-server-contract.test.ts` (66 passed, 0 failed).
- PASS: focused architecture contract `MaxVideoAI editor timeline editing supports drag ordering and cut splits` (1 passed, 0 failed).
- PASS: `git diff --check`.
- PRE-EXISTING: frontend TypeScript check still reports only the unrelated errors in `workspace-shot-input-dock.tsx`, `useWorkspaceShotPricing.ts`, and `workspace-v1-block-matrix.ts`.

### Concerns

- The repository-wide TypeScript check remains blocked by the three unrelated Studio errors listed above; the nullable manifest contract introduced no additional diagnostics in server or Remotion consumers.
