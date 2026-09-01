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

## Fix round 1 — reviewer findings

### Revision

- Fix-round base: `b438bc2a7aedf272045392e767c393ff13775874`
- Fix-round implementation commit: reported in the handoff because a commit cannot contain its own hash.

### Outcome

- The real site execution owner now passes schema-validated extra input values into validation before billing, reservation, or provider submission. Wan `file_url` and `web_url` therefore satisfy the any-supported-reference rule only after `validateExtraInputValues`, retain the thinking/exclusivity checks, and continue into the exact Fal body.
- LTX 2.5 Fast consumes the authored high-FPS and high-resolution duration ceilings on both the site and paid MCP paths. The shared validator derives high values from the active schema fields, with no engine-ID table. The canonical `4k` alias is authored only by Fast and projects to provider `2160p`; Pro rejects `4k`.
- FLUX first/last workspace handling uses shared schema candidates through field projection, preparation, guards, and workspace request payloads. Manual and automatic `fl2v` preserve only `start_image_url` and `end_image_url`, without duplicate top-level image fields.
- All seven P0 engines remain Fal-only. Direct-provider adapters, environment configuration, polling, billing routes, and `AppClient.tsx` remain untouched.

### RED evidence

Before fix-round production edits:

- `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-validation.test.ts tests/p0-video-request-bodies.test.ts tests/p0-video-workspace.test.ts`
  - Result: 17 pass, 4 fail.
  - Evidence: the real validation payload rejected Wan file-only references; LTX Fast accepted 20s at 50 FPS; the FLUX default workspace schema exposed both `image_url` and `start_image_url`; and the first/last guard did not recognize `start_image_url`.

### GREEN evidence

- P0 fix slice:
  - `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-request-bodies.test.ts tests/p0-video-validation.test.ts tests/p0-video-workspace.test.ts`
  - Result: 22 pass, 0 fail.
- Required focused suite, including direct-provider routing regressions:
  - `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-request-bodies.test.ts tests/p0-video-validation.test.ts tests/p0-video-workspace.test.ts tests/generate-fal-request.test.ts tests/validate-request.test.ts tests/mcp-special-video-modes.test.ts tests/mcp-model-executability.test.ts tests/workspace-generation-inputs.test.ts tests/workspace-composer-surface-contract.test.ts tests/p0-provider-routing.test.ts tests/kling-provider-routing.test.ts tests/luma-agents-provider-routing.test.ts`
  - Final fresh result: 207 pass, 0 fail.
- P0 raw/registry/reference and execution-owner regressions:
  - `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-engine-contracts.test.ts tests/p0-video-engine-raw-contracts.test.ts tests/p0-model-family-contract.test.ts tests/reference-budget.test.ts tests/engine-reference-budget-propagation.test.ts tests/generate-validation-payload.test.ts tests/video-generation-service-parity.test.ts`
  - Result: 39 pass, 0 fail.
- Workspace behavioral regressions:
  - `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-workspace.test.ts tests/workspace-generation-inputs.test.ts tests/workspace-generation-request-helpers.test.ts tests/workspace-composer-surface-contract.test.ts`
  - Result: 39 pass, 0 fail.
- TypeScript, frontend lint, exposure lint, and `git diff --check`: pass.

### Fix-round owners changed

- `frontend/src/server/video-generation/execute-video-generation.ts`
- `frontend/app/api/generate/_lib/validation-payload.ts`
- `frontend/app/api/generate/_lib/validate.ts`
- `frontend/src/lib/video-input-schema.ts`
- `frontend/src/lib/fal-request-body.ts`
- `frontend/src/config/fal-engines/ltx-2-5-shared.ts`
- `frontend/src/server/agent-api/generation-capability-validation.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-generation-guards.ts`
- `tests/p0-video-request-bodies.test.ts`
- `tests/p0-video-validation.test.ts`
- `tests/p0-video-workspace.test.ts`

### Fix-round deviations and residual risks

- Paid MCP canonical video requests cannot represent document or web references: the canonical reference union contains image, video, and audio media only. No unsafe bypass was added; Wan MCP requests without a canonical media reference continue to fail closed.
- Wan's authored `minimumReferenceVideoFps: 16` cannot be enforced safely yet. Neither site `ReferenceAsset`/generation attachments nor MCP `ResolvedReference` carries trusted FPS metadata. This round does not guess FPS or silently invent it. A future contract change must add trusted media-probe FPS metadata and define fail-closed behavior when that fact is absent before enabling enforcement.
- An additional non-gate run of `tests/mcp-generation-capabilities.test.ts` has one existing H3 assertion failure for an unverified public HTTPS video duration; Task 4 does not touch that H3 reference-duration behavior. All required Task 4 and directly affected suites pass.

## Fix round 2 — automatic FLUX frame routing

### Revision

- Fix-round base: `0d99c99d71fc0ab49cd4857e594c154e479be5ee`
- Fix-round implementation commit: reported in the handoff because a commit cannot contain its own hash.

### Outcome

The automatic workspace transition is now exercised through the real `useWorkspaceEngineModeState` hook. A FLUX `start_image_url` asset recalculates the implicit active mode to `i2v`; the schema summary then keeps only `start_image_url` and `end_image_url`. Adding `end_image_url` changes the actual submission mode to `fl2v`, without exposing or requiring a third `image_url` field.

The mode owner distinguishes a schema-selected first-frame candidate from a normal i2v opening image. Consequently, a stored or selected FLUX `image_url` continues to expose the normal single-field i2v workflow. Veo's established `image_url` plus last-frame automatic workflow remains intact through the schema-selected `first_frame_url` compatibility rule. Kling, Luma, and other engines without this FLUX schema shape remain unchanged.

### RED evidence

- `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-workspace.test.ts`
  - Result: 1 pass, 1 fail.
  - The React server-rendered hook produced real `activeMode: i2v` from a sole `start_image_url`, after which the real schema summary incorrectly returned `image_url`, `start_image_url`, and `end_image_url`.

### GREEN evidence

- Targeted automatic/manual FLUX behavior:
  - `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-workspace.test.ts`
  - Result: 2 pass, 0 fail.
- Veo/Kling/Luma and workspace regressions:
  - `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-workspace.test.ts tests/workspace-generation-inputs.test.ts tests/workspace-generation-request-helpers.test.ts tests/workspace-composer-surface-contract.test.ts tests/workspace-input-schema-hook-contract.test.ts tests/workspace-omni-ui-contract.test.ts tests/google-vertex-omni-engine-catalog.test.ts`
  - Result: 51 pass, 0 fail.
- Required Task 4 focused suite:
  - `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/p0-video-request-bodies.test.ts tests/p0-video-validation.test.ts tests/p0-video-workspace.test.ts tests/generate-fal-request.test.ts tests/validate-request.test.ts tests/mcp-special-video-modes.test.ts tests/mcp-model-executability.test.ts tests/workspace-generation-inputs.test.ts tests/workspace-composer-surface-contract.test.ts tests/p0-provider-routing.test.ts tests/kling-provider-routing.test.ts tests/luma-agents-provider-routing.test.ts`
  - Result: 207 pass, 0 fail.
- TypeScript, frontend lint, exposure lint, and `git diff --check`: pass.

### Fix-round owners changed

- `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema.ts`
- `tests/p0-video-workspace.test.ts`

No direct-provider, billing, polling, environment, request-body, or `AppClient.tsx` owner changed in this round.
