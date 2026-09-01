# Task 4 report — P0 video provider requests

Date: 2026-09-01

## Revision

- Base: `2ac95d9dfade7940630b04c10c26b29bf9a342b9`
- Pre-commit HEAD while authoring this report: `2ac95d9dfade7940630b04c10c26b29bf9a342b9`
- Final implementation commit: reported in the Task 4 handoff because a commit cannot contain its own hash.

## Outcome

The site Fal path and paid MCP continuation now select provider media fields from the active engine schema through one shared pure selector. No P0 engine-ID field map was introduced. The seven P0 engines remain Fal-only, and no direct adapter, environment, poller, billing route, or `AppClient.tsx` owner changed.

The complete 23-mode P0 inventory is exercised through both real builders with whole-object equality. These assertions cover both required fields and absence of generic or foreign fields.

## RED evidence

Before production edits:

- `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-request-bodies.test.ts`
  - Result: 0 pass, 6 fail.
  - Evidence: Wan emitted `image_url`, generic reference arrays and `generate_audio`; LTX a2v emitted output-only controls; Grok emitted an audio toggle/generic references; FLUX emitted `first_frame_url` and Draft emitted `resolution`.
- `pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-name-pattern='paid MCP provider slots' tests/p0-video-request-bodies.test.ts`
  - Result: 0 pass, 1 fail.
  - Evidence: paid Wan i2v returned `inputs: []` instead of the schema-selected `start_image_url` slot.
- `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-validation.test.ts`
  - Initial result: 2 pass, 3 fail.
  - Evidence: Wan audio-only/site validation failed, Wan canonical `auto` was not projected for schema validation, and FLUX `2:1` was rejected.
- `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-workspace.test.ts`
  - Result: 0 pass, 2 fail.
  - Evidence: FLUX start/end fields were absent from default composer projection and hook selection recognized only legacy frame names.

## GREEN evidence

- Required focused suite from the brief, including routing regressions:
  - `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-request-bodies.test.ts tests/p0-video-validation.test.ts tests/p0-video-workspace.test.ts tests/generate-fal-request.test.ts tests/validate-request.test.ts tests/mcp-special-video-modes.test.ts tests/mcp-model-executability.test.ts tests/workspace-generation-inputs.test.ts tests/workspace-composer-surface-contract.test.ts tests/p0-provider-routing.test.ts tests/kling-provider-routing.test.ts tests/luma-agents-provider-routing.test.ts`
  - Result: 203 pass, 0 fail.
- Additional P0 raw/registry/reference-budget contracts:
  - `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-engine-contracts.test.ts tests/p0-video-engine-raw-contracts.test.ts tests/p0-model-family-contract.test.ts tests/reference-budget.test.ts tests/engine-reference-budget-propagation.test.ts`
  - Result: 20 pass, 0 fail.
- TypeScript: `pnpm --prefix frontend exec tsc --noEmit --pretty false` — pass.
- Frontend lint: `npm --prefix frontend run lint` — pass, no warnings.
- Exposure lint: `npm run lint:exposure` — pass.
- Whitespace/boundary check: `git diff --check` and prohibited-owner diff check — pass.

A repository-wide `pnpm test:validate` run progressed through the broad application, API, and MCP suites without a reported failure, but was manually stopped after the runner remained open without further output. The required focused suite and directly affected regressions completed normally.

## Production owners changed

- `frontend/src/lib/video-input-schema.ts` — shared active-field selection and provider enum aliases.
- `frontend/src/lib/fal-request-body.ts` — schema-selected Fal controls and media slots.
- `frontend/app/api/generate/_lib/validation-payload.ts` — exact validation payload field projection.
- `frontend/app/api/generate/_lib/validate-media-inputs.ts` — schema-named i2v/fl2v fields and any-supported Wan references.
- `frontend/src/server/video-generation/execution-constraints.ts` — Wan file/web thinking and exclusivity behavior.
- `frontend/src/server/agent-api/paid-video-request-body.ts` — exact paid MCP provider slots.
- `frontend/src/server/agent-api/generation-capability-validation.ts` — canonical/provider aliases, schema frame names, conditional prompt, private duration and FLUX exclusive source-duration validation.
- `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts` — manual/automatic schema-named fl2v selection.
- `frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema.ts` — verified FLUX cross-mode frame rendering gap.

## Tests added

- `tests/p0-video-request-bodies.test.ts`
- `tests/p0-video-validation.test.ts`
- `tests/p0-video-workspace.test.ts`

## Deviations and risks

- No implementation deviation from the Task 4 brief.
- The shared selector uses provider schema identity rather than an engine-ID field table.
- Public HTTPS references with provider duration constraints remain accepted where the schema says `source: either`; trusted duration enforcement applies when a private asset is supplied. LTX a2v remains explicitly private on MCP.
- Site media-library size/format checks continue to use the existing media-constraint owner; Task 4 did not alter that pipeline.
