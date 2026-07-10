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
