# MaxVideoAI MCP Catalog Parity and Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every public MaxVideoAI model and every agent-supported model mode synchronized with the MCP automatically, close the remaining website/MCP capability gaps, and make future drift fail locally and in CI.

**Architecture:** The model registry and engine definitions remain authoritative. A pure parity projection compares the site’s public executable inventory with the MCP catalog, model details, pricing inputs, reference contracts, and generation schemas. New models using known modes flow through automatically. New semantic modes fail with a precise review requirement. Specialized website modes are promoted only after their source metadata, pricing, and provider projection are explicit enough for an exact quote.

**Tech Stack:** TypeScript, model registry projections, engine catalog, agent facade, canonical pricing, provider adapters, Node test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-26-maxvideoai-plugin-acquisition-and-continuity-design.md`

## Global Constraints

- Read `docs/engineering/model-registry.md` before any model or publication change.
- Read `frontend/app/(core)/(workspace)/app/AGENTS.md` before moving workspace generation responsibilities.
- Do not edit `frontend/config/model-runtime.json`, `engine-catalog.json`, `model-roster.json`, or docs rosters directly.
- Do not expose a mode until its quote, reference metadata, request projection, provider submission, polling, accounting, failure, and refund behavior are explicit.
- Do not expose provider interaction IDs or provider-only secrets to the client. Resolve owned MaxVideoAI job/asset IDs server-side.
- Do not make the shared skill a second model catalog.

---

## Task 1: Define a machine-readable site-to-MCP parity report

**Files:**
- Create: `frontend/src/server/agent-api/model-catalog-parity.ts`
- Create: `tests/mcp-catalog-parity.test.ts`
- Modify: `frontend/src/server/agent-api/public-engine-policy.ts`
- Modify: `tests/mcp-model-catalog.test.ts`
- Modify: `tests/mcp-model-details.test.ts`

- [ ] Write failing tests that load the real static engine registry and assert a stable report shape:

```ts
type McpCatalogParityReport = {
  publicModelCount: number;
  mcpModelCount: number;
  missingModels: string[];
  extraModels: string[];
  missingModes: Array<{ engineId: string; mode: string; reason: string }>;
  detailMismatches: Array<{
    engineId: string;
    mode: string;
    field: 'duration' | 'resolution' | 'aspectRatio' | 'fps' | 'audio' | 'references';
  }>;
  unsupportedSemanticModes: Array<{ engineId: string; mode: string }>;
};
```

- [ ] Compare canonical identity, public modes, per-mode settings, required/optional reference kinds and counts, audio policy, and generation-enabled state. Sort every issue deterministically.
- [ ] Make the expected side use the same registry and engine definitions as the site, but not the MCP DTO under test. Shared raw inputs are allowed; comparing a function to itself is not.
- [ ] Keep environment-gated models in discovery with `generationEnabled: false`. Missing credentials must not make a public model silently disappear.
- [ ] Assert the current 42 app-published model inventory from the real registry without hard-coding 42 in production code.
- [ ] Run focused tests and commit.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-catalog-parity.test.ts tests/mcp-model-catalog.test.ts tests/mcp-model-details.test.ts
git add frontend/src/server/agent-api/model-catalog-parity.ts frontend/src/server/agent-api/public-engine-policy.ts tests/mcp-catalog-parity.test.ts tests/mcp-model-catalog.test.ts tests/mcp-model-details.test.ts
git commit -m "test(mcp): define catalog parity report"
```

## Task 2: Add the one-command catalog maintenance gate

**Files:**
- Create: `scripts/validate-mcp-catalog-parity.ts`
- Modify: `package.json`
- Modify: `tests/mcp-catalog-parity.test.ts`

- [ ] Add a failing subprocess test that expects a non-zero exit code and a precise model/mode/field message when an injected parity fixture drifts.
- [ ] Implement a read-only script that runs the registry projection checks first, builds the parity report, prints a short success summary, and exits non-zero on any unresolved issue.
- [ ] Add this package script:

```json
"mcp:catalog:check": "pnpm model:registry:check && tsx --tsconfig frontend/tsconfig.json scripts/validate-mcp-catalog-parity.ts"
```

- [ ] The command must not require a production database or provider credential. Credential state may affect `generationEnabled`, but static model/mode inclusion and schema parity must remain testable in CI.
- [ ] Run the command twice and confirm deterministic output.

```bash
pnpm mcp:catalog:check
pnpm mcp:catalog:check
```

Expected success form:

```text
[mcp-catalog] parity current: <N> public models, <M> canonical model-mode pairs, 0 mismatches.
```

- [ ] Commit.

```bash
git add scripts/validate-mcp-catalog-parity.ts package.json tests/mcp-catalog-parity.test.ts
git commit -m "chore(mcp): add catalog parity command"
```

## Task 3: Carry verified source duration through reference resolution

**Files:**
- Modify: `frontend/src/server/agent-api/reference-types.ts`
- Modify: `frontend/src/server/agent-api/reference-assets.ts`
- Modify: `frontend/src/server/agent-api/resolve-generation-references.ts`
- Modify: `frontend/src/server/agent-api/generation-pricing.ts`
- Modify: `tests/mcp-reference-generation.test.ts`
- Modify: `tests/mcp-reference-ownership.test.ts`
- Modify: `tests/mcp-project-budget.test.ts`

- [ ] Add failing tests that require verified `durationSec` for owned video/audio assets, reject malformed metadata, and keep image duration null.
- [ ] Extend the resolved server-only reference:

```ts
export type ResolvedReference = {
  assetId: string;
  role: CanonicalGenerationReferenceRole;
  slot?: number;
  mediaKind: CanonicalReferenceMediaKind;
  storageUrl: string;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  mimeType: string;
};
```

- [ ] Read duration only from the existing verified asset metadata written by the upload pipeline. Never trust duration from MCP input.
- [ ] Make pricing helpers accept the resolved duration context while preserving current prices for existing modes.
- [ ] Run focused tests and commit.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-reference-generation.test.ts tests/mcp-reference-ownership.test.ts tests/mcp-project-budget.test.ts
git add frontend/src/server/agent-api/reference-types.ts frontend/src/server/agent-api/reference-assets.ts frontend/src/server/agent-api/resolve-generation-references.ts frontend/src/server/agent-api/generation-pricing.ts tests/mcp-reference-generation.test.ts tests/mcp-reference-ownership.test.ts tests/mcp-project-budget.test.ts
git commit -m "feat(mcp): carry verified source duration"
```

## Task 4: Promote audio-to-video and reframe into canonical agent modes

**Files:**
- Modify: `frontend/src/server/agent-api/generation-types.ts`
- Modify: `frontend/src/server/agent-api/public-engine-policy.ts`
- Modify: `frontend/src/server/agent-api/generation-capability-validation.ts`
- Modify: `frontend/src/server/agent-api/generation-normalization.ts`
- Modify: `frontend/src/server/agent-api/generation-pricing.ts`
- Modify: `frontend/src/server/agent-api/paid-generation-execution.ts`
- Modify: `frontend/src/server/mcp/instructions.ts`
- Modify: `frontend/src/server/mcp/tool-input-schemas.ts`
- Modify: `plugins/maxvideoai/skills/maxvideoai/SKILL.md`
- Modify: `plugins/maxvideoai/skills/maxvideoai/references/budget-planning.md`
- Modify: `tests/mcp-special-video-modes.test.ts`
- Modify: `tests/mcp-generation-normalization.test.ts`
- Modify: `tests/mcp-generation-capabilities.test.ts`
- Modify: `tests/mcp-project-budget.test.ts`

- [ ] Add `a2v` and `reframe` to `CANONICAL_GENERATION_MODES` in a failing test.
- [ ] Define explicit reference rules:
  - `a2v`: one required owned/HTTPS audio source; output duration comes from verified source duration;
  - `reframe`: one required source video; price and output duration use verified source duration; only engine-declared crop/grid/aspect controls are accepted.
- [ ] Reject any client-supplied duration that conflicts with the verified source metadata.
- [ ] Project the canonical request through the existing provider adapter path without copying workspace-local defaults into the agent facade.
- [ ] Add LTX 2.3 `a2v` and Luma Ray 2, Ray 2 Flash, and Ray 3.2 `reframe` to real parity tests.
- [ ] Update host guidance with factual mode semantics only; continue deriving exact settings from `get_model_details`.
- [ ] Run focused tests and commit.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-special-video-modes.test.ts tests/mcp-generation-normalization.test.ts tests/mcp-generation-capabilities.test.ts tests/mcp-project-budget.test.ts
git add frontend/src/server/agent-api frontend/src/server/mcp plugins/maxvideoai/skills/maxvideoai tests/mcp-special-video-modes.test.ts tests/mcp-generation-normalization.test.ts tests/mcp-generation-capabilities.test.ts tests/mcp-project-budget.test.ts
git commit -m "feat(mcp): support audio video and reframe modes"
```

## Task 5: Make project budgets cover every canonical video mode

**Files:**
- Modify: `frontend/src/server/agent-api/project-budget.ts`
- Modify: `frontend/src/server/mcp/tools/calculate-project-budget.ts`
- Modify: `frontend/src/server/mcp/tool-input-schemas.ts`
- Modify: `plugins/maxvideoai/skills/maxvideoai/references/budget-planning.md`
- Modify: `tests/mcp-project-budget.test.ts`
- Modify: `tests/mcp-budget-options.test.ts`
- Modify: `tests/mcp-special-video-modes.test.ts`

- [ ] Add failing budget fixtures for `fl2v`, `r2v`, `a2v`, `reframe`, and `retake`, while preserving coverage for `t2v`, `i2v`, `ref2v`, `v2v`, and `extend`.
- [ ] Expand the canonical `ProjectVideoMode` union and its typed shot inputs instead of routing unsupported modes through a generic escape hatch.
- [ ] Require the correct source for each mode: first/last frames for `fl2v`, reference assets for `r2v`, audio for `a2v`, video for `reframe`, and owned generation context for `retake`.
- [ ] For modes priced from source duration, accept `sourceDurationSec` only as a clearly labelled planning assumption. Never present a hypothetical budget line as an exact generation quote.
- [ ] Make `prepare_generation` resolve the real media metadata and reprice the request before confirmation whenever the planning assumption differs.
- [ ] Keep base production cost and optional retry/creative-attempt allowances separate so the user can decide their risk budget.
- [ ] Run the project-budget and specialized-mode tests and commit.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-project-budget.test.ts tests/mcp-budget-options.test.ts tests/mcp-special-video-modes.test.ts
git add frontend/src/server/agent-api/project-budget.ts frontend/src/server/mcp/tools/calculate-project-budget.ts frontend/src/server/mcp/tool-input-schemas.ts plugins/maxvideoai/skills/maxvideoai/references/budget-planning.md tests/mcp-project-budget.test.ts tests/mcp-budget-options.test.ts tests/mcp-special-video-modes.test.ts
git commit -m "feat(mcp): budget every canonical video mode"
```

## Task 6: Normalize Kling 2.5 Standard as a tier, not an image mode

**Files:**
- Modify: `frontend/src/config/fal-engines/kling-2-5.ts`
- Modify: `frontend/src/server/agent-api/model-details.ts`
- Modify: `frontend/src/server/agent-api/generation-capability-validation.ts`
- Modify: `frontend/src/server/agent-api/generation-pricing.ts`
- Modify: `frontend/src/server/agent-api/paid-generation-execution.ts`
- Modify: `tests/mcp-special-video-modes.test.ts`
- Modify: `tests/mcp-model-details.test.ts`
- Modify: `tests/mcp-project-budget.test.ts`
- Modify: `tests/kling-resolution.test.ts`
- Modify: `tests/generation-image-dimensions.test.ts`
- Modify: `tests/fal-engine-catalog-architecture.test.ts`

- [ ] Write failing tests proving the legacy internal `i2i` code produces video and must not be exposed as canonical image-to-image.
- [ ] Represent Pro/Standard as an engine-declared `tier` or equivalent setting on canonical `i2v`; preserve existing public route behavior and prices.
- [ ] Keep backward compatibility for stored jobs/old workspace submissions at the normalization boundary, but stop publishing the ambiguous legacy code to new agent requests.
- [ ] Verify quote, provider endpoint, and result surface for both tiers.
- [ ] Run all Kling 2.5 and MCP specialized-mode tests, regenerate projections only if the engine definition changes generated output, and commit.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-special-video-modes.test.ts tests/mcp-model-details.test.ts tests/mcp-project-budget.test.ts
pnpm model:registry:check
git add frontend/src/config/fal-engines/kling-2-5.ts frontend/src/server/agent-api tests
git commit -m "fix(models): normalize kling standard video tier"
```

## Task 7: Add transport-neutral retake context

**Files:**
- Modify: `frontend/src/server/agent-api/generation-types.ts`
- Modify: `frontend/src/server/agent-api/generation-normalization.ts`
- Modify: `frontend/src/server/agent-api/generation-capability-validation.ts`
- Modify: `frontend/src/server/agent-api/generation-pricing.ts`
- Modify: `frontend/src/server/agent-api/paid-generation-execution.ts`
- Create: `frontend/src/server/agent-api/source-generation-context.ts`
- Modify: `frontend/src/server/mcp/tool-input-schemas.ts`
- Modify: `frontend/src/server/mcp/instructions.ts`
- Modify: `plugins/maxvideoai/skills/maxvideoai/SKILL.md`
- Modify: `tests/mcp-special-video-modes.test.ts`
- Create: `tests/mcp-retake-context.test.ts`

- [ ] Add `retake` as a canonical mode and use a MaxVideoAI-owned context, never a raw provider interaction ID:

```ts
type CanonicalGenerationContext =
  | { kind: 'source_generation'; jobId: string }
  | null;
```

- [ ] Resolve `jobId` with the current OAuth principal, verify ownership and compatible engine family, and map provider state server-side.
- [ ] Support LTX 2.3 retake with required source clip/time/replacement controls and exact pricing.
- [ ] Support Gemini Omni Flash retake only when the owned source job contains a usable stored interaction mapping. Return a stable incompatibility error when that mapping is unavailable; never return the provider identifier.
- [ ] Hash the resolved context into the quote identity so changing the source invalidates confirmation.
- [ ] Run tests and commit.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-retake-context.test.ts tests/mcp-special-video-modes.test.ts tests/mcp-generation-normalization.test.ts tests/mcp-confirm-generation.test.ts
git add frontend/src/server/agent-api frontend/src/server/mcp plugins/maxvideoai/skills/maxvideoai tests/mcp-retake-context.test.ts tests/mcp-special-video-modes.test.ts tests/mcp-generation-normalization.test.ts tests/mcp-confirm-generation.test.ts
git commit -m "feat(mcp): add owned retake context"
```

## Task 8: Complete Seedance 2.5 video-to-video routing

**Files:**
- Modify: `frontend/src/server/agent-runtime/model-executability.ts`
- Modify: `frontend/app/api/generate/_lib/byteplus-submission.ts`
- Modify: `frontend/server/byteplus-accounting.ts`
- Modify: `frontend/src/server/video-providers/byteplus-modelark.ts`
- Modify: `frontend/src/server/video-providers/byteplus-modelark-profiles.ts`
- Modify: `frontend/src/server/video-providers/byteplus-modelark-constants.ts`
- Modify: `frontend/src/lib/env.ts`
- Modify: `tests/generate-byteplus-submission.test.ts`
- Modify: `tests/generate-route-context.test.ts`
- Modify: `tests/seedance-2-5-readiness.test.ts`
- Modify: `tests/mcp-seedance-2-5-request-body.test.ts`
- Modify: `tests/mcp-model-executability.test.ts`
- Modify: `tests/byteplus-provider-architecture.test.ts`
- Modify: `docs/operations/mcp-staging-deployment.md`
- Modify: `docs/engineering/mcp-mode-coverage.md`

- [ ] Keep ModelArk routing for `t2v`, `i2v`, `ref2v`, and `extend`.
- [ ] Add failing tests for LAS-only `v2v`: exact source-video/reference projection, quote, debit, provider response, poll, durable storage, terminal failure, and automatic refund/recredit state.
- [ ] Require `BYTEPLUS_LAS_API_KEY`, `SEEDANCE_2_5_LAS_ENABLED=true`, and `v2v` in the explicit enabled-mode set before `generationEnabled` is true for that mode.
- [ ] Do not reuse or print the ModelArk key. If a dedicated LAS credential cannot be provisioned, record `CREDENTIAL_BLOCKED`; keep only `v2v` gated and do not weaken the other four modes.
- [ ] After a no-spend request-body/poll fixture passes, request approval for one minimum-cost staging V2V canary. Confirm result persistence and failure refund behavior.
- [ ] Update the coverage document from the observed result, not the intended configuration.
- [ ] Run BytePlus/MCP tests and commit.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-seedance-2-5-request-body.test.ts tests/mcp-model-executability.test.ts tests/byteplus-provider-architecture.test.ts
git add frontend/src/server tests docs/operations/mcp-staging-deployment.md docs/engineering/mcp-mode-coverage.md
git commit -m "feat(mcp): complete seedance video edit routing"
```

## Task 9: Remove the temporary closed-mode ledger

**Files:**
- Modify: `tests/mcp-special-video-modes.test.ts`
- Modify: `docs/engineering/mcp-mode-coverage.md`
- Modify: `frontend/src/server/agent-api/model-catalog-parity.ts`

- [ ] Change the current test from “seven known closed pairs are allowed” to “zero unexplained public model-mode gaps”.
- [ ] Allow only typed non-generation website surfaces that are truly outside model execution. Each exception must contain an owner, machine-readable reason code, and contract test; a free-form allowlist is not acceptable.
- [ ] Confirm the parity command reports zero missing models and zero unresolved executable modes.

```bash
pnpm mcp:catalog:check
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-special-video-modes.test.ts tests/mcp-catalog-parity.test.ts
```

- [ ] Commit.

```bash
git add tests/mcp-special-video-modes.test.ts docs/engineering/mcp-mode-coverage.md frontend/src/server/agent-api/model-catalog-parity.ts
git commit -m "test(mcp): require full executable mode parity"
```

## Task 10: Put parity in CI and the model workflow

**Files:**
- Modify: `.github/workflows/quality.yml`
- Modify: `docs/engineering/model-registry.md`
- Create: `docs/engineering/mcp-maintenance.md`
- Modify: `AGENTS.md`
- Test: `tests/mcp-maintenance-docs.test.ts`

- [ ] Add a failing documentation/CI contract test requiring `pnpm mcp:catalog:check` in Quality CI and in the model guide.
- [ ] Run the parity command after generated model projections and before the broad test suite:

```yaml
- name: Check MCP catalog parity
  run: pnpm run mcp:catalog:check
```

- [ ] Document exact procedures for adding/retiring a model, changing a price/capability, adding a mode/reference kind, updating the skill, validating locally, deploying staging, recording evidence, publishing marketing, and rolling back MCP independently.
- [ ] Add `docs/engineering/mcp-maintenance.md` to the root guide map.
- [ ] Explicitly state that normal known-mode model additions require no MCP list edit; failures name the missing semantic contract.
- [ ] Run focused tests, the command, and commit.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-maintenance-docs.test.ts
pnpm mcp:catalog:check
git diff --check
git add .github/workflows/quality.yml docs/engineering/model-registry.md docs/engineering/mcp-maintenance.md AGENTS.md tests/mcp-maintenance-docs.test.ts
git commit -m "docs(mcp): enforce catalog maintenance workflow"
```

## Task 11: Final catalog verification

- [ ] Run the registry, parity, focused MCP, type, lint, and exposure checks.

```bash
pnpm model:registry:check
pnpm mcp:catalog:check
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-model-catalog.test.ts tests/mcp-model-details.test.ts tests/mcp-model-executability.test.ts tests/mcp-special-video-modes.test.ts tests/mcp-generation-capabilities.test.ts tests/mcp-project-budget.test.ts
pnpm --dir frontend exec tsc --noEmit
pnpm --prefix frontend run lint
pnpm run lint:exposure
git diff --check
```

- [ ] Inspect one video and one image model from each public family in `list_models`/details output; use scripts or fixtures, not manual hard-coded updates.
- [ ] Confirm no generated projection was edited without its registry/engine source.
- [ ] If verification changes no file, record the successful commands in the branch handoff instead of creating an empty commit.
