# Task 5 Report: Unify Pricing And Generate Button State

## Status

Complete. Studio pricing now constructs `ready`, `blocked`, and `error` estimates through the shared pricing module; the existing hook continues to use the shared `loading` and request-error constructors.

## Changes

- Centralized normalized pricing estimate constructors in `workspace-pricing.ts`.
- Routed local tool pricing through the shared constructors while preserving validation and capability-policy behavior.
- Kept capability policy as the authority for blocked pricing and generation eligibility.
- Made the in-button price slot explicitly constrained and exposed its full value through `title` and `aria-label`.
- Added V1 pricing regression coverage and expanded the generate-button contract test.

## Verification

- `tsx --test tests/maxvideoai-editor-v1-pricing.test.ts tests/maxvideoai-editor-generation-blocks.test.ts`: 56 passed.
- Focused Studio ESLint: passed.
- The brief's root-level ESLint command could not find `app`; lint was rerun from `frontend/` against the changed Studio source files.
- `git diff --check`: passed.

## Concerns

None.

## Fix pass

### Changed files

- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-chat-node.tsx`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceRenderNodes.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceShotPricing.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-chat-node.module.css`
- `tests/maxvideoai-editor-v1-pricing.test.ts`

### Verification

- `PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-v1-pricing.test.ts tests/maxvideoai-editor-generation-blocks.test.ts`: 57 passed, 0 failed.
- `git diff --check`: passed.

### Commit

- `a6e0baf9 fix: wire Studio chat and upscale pricing`

### Concerns

- None.

## Fix pass 2

### Changed files

- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing.ts`
- `tests/maxvideoai-editor-v1-pricing.test.ts`

### Verification

- `PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-v1-pricing.test.ts tests/maxvideoai-editor-generation-blocks.test.ts`: passed, 58 tests passed, 0 failed.
- `git diff --check`: passed.

### Commit

- `b5f76a44a1268ec60619c03304170a3994a45c04 fix: make Studio upscale pricing server-derived`

### Concerns

- None.

## Fix pass 3

### Changed files

- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-shot-node-controls.tsx`
- `tests/maxvideoai-editor-generation-blocks.test.ts`

### Verification

- `PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-v1-pricing.test.ts tests/maxvideoai-editor-generation-blocks.test.ts`: passed, 59 tests passed, 0 failed.
- `git diff --check`: passed.

### Commit

- `046c76c92e1329b6db769f726a60e42145caf7c7 fix: expose Studio pricing errors`

### Concerns

- None.

## Fix pass 4

### Changed files

- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-chat-node.tsx`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-chat-node.module.css`
- `tests/maxvideoai-editor-v1-pricing.test.ts`

### Verification

- `PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-v1-pricing.test.ts tests/maxvideoai-editor-generation-blocks.test.ts`: passed, 60 tests passed, 0 failed.
- `git diff --check`: passed.

### Commit

- `70f2b8d0a375a35ebb57aa8e5dfa8b4364491042 fix: align Studio Angle pricing policy`

### Concerns

- None.
