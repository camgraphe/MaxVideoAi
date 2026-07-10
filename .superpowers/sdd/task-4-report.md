# Task 4 Report: V1 Request Payload Parity

## Status

Implemented payload parity coverage for the Studio V1 generation routes.

## Changes

- Added `tests/maxvideoai-editor-v1-request-payloads.test.ts` covering video, image, audio, angle, character builder, storyboard, image/video upscale, and chat payload contracts.
- Extracted `buildWorkspaceStoryboardGenerationRequest` from the storyboard route so its template, prompt, output configuration, and metadata are directly testable.
- Preserved the existing storyboard runtime defaults for origin and generated job IDs.

## Test Evidence

- Red: the new storyboard payload test failed because no public storyboard request builder existed.
- Green: the required focused command passed with 62 tests and zero failures:

```sh
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-v1-request-payloads.test.ts tests/maxvideoai-editor-generation-blocks.test.ts
```

- `git diff --check` passed.

## Concerns

None.
