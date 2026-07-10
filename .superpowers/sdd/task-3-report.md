# Task 3 Report: Capability-Driven Node Controls

## Delivered

- Added `WorkspaceControlField`, a compact renderer for policy fields and resolved controls.
- Updated shot nodes to render `resolveWorkspaceBlockPolicy(...).controlFields` while preserving model selection and generation actions.
- Updated the shot inspector and specialized tool sections to derive visible controls from the same policy field list.
- Kept Character Builder, Angle, Upscale, Storyboard, and Audio controls available when their corresponding policy fields are supported.
- Added regression coverage that prevents the shot node from returning to hardcoded generic field conditions.

## Verification

- Required `tsx` generation-block suite: passed, 50 tests.
- Targeted ESLint for changed Studio components/helpers: passed.
- `git diff --check`: passed.
- Full TypeScript check was attempted and is blocked by pre-existing errors outside this task:
  - `workspace-shot-input-dock.tsx:59` accepts `undefined` where `string | null` is required.
  - `workspace-v1-block-matrix.ts:191` infers `never` for `includes`.

## Commit

- Pending final verification and commit.

## Fix after task review

### Changed files

- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ChatNodeInspector.tsx`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ShotNodeToolSections.tsx`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/WorkspaceControlField.tsx`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-shot-inspector-helpers.ts`
- `tests/maxvideoai-editor-generation-blocks.test.ts`

### Verification

- `PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-generation-blocks.test.ts`: passed, 52 tests, 0 failures.
- Focused ESLint for the four changed Studio files: passed, exit 0.
- `git diff --check`: passed, exit 0.
