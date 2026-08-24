# MaxVideoAI Conversational Plugin Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the local, unpublished core of a conversational MaxVideoAI plugin for Codex and Claude, with live model detail, evidence-backed guidance, authoritative multi-model project budgets, improved recommendations, and a shared Agent Skill.

**Architecture:** Keep Codex or Claude responsible for the creative brief, prompts, references, and proposal composition. Add two read-only MCP tools behind the existing authenticated transport: one projects safe model detail and one validates and prices host-authored video project proposals through the canonical pricing boundary. Package the same skill and remote MCP connection with thin Codex and Claude manifests; do not add a custom UI or activate publication flags.

**Tech Stack:** TypeScript, Next.js server modules, MCP SDK 1.29, Zod v4 schemas, Node test runner through `tsx`, JSON configuration, Agent Skills Markdown, Codex/Claude plugin manifests.

**Spec:** `docs/superpowers/specs/2026-08-24-maxvideoai-conversational-plugin-design.md`

## Global Constraints

- Work only in `.worktrees/mcp-foundation` on `codex/mcp-foundation-clean`; do not modify `main`.
- Keep all eight keys in `frontend/config/mcp-publication.json` present and `false`.
- Do not push, deploy, enable a hosted endpoint, publish a marketplace entry, or make a public compatibility claim.
- No custom chat UI, MCP App UI, embedded budget selector, public REST API, API keys, or additional server-side language model.
- Codex or Claude owns creative reasoning; MaxVideoAI owns live catalog facts, evidence, canonical pricing, quote-confirmation, billing, execution, and recovery.
- Do not require or synthesize economy, balanced, or premium proposal labels.
- Every numeric project price must originate from `priceCanonicalGeneration` and the canonical pricing system; aggregation may only multiply validated integer quantities and add authoritative cent values.
- Project budgeting is video-only in this plan. Existing image discovery and generation contracts remain unchanged.
- Project estimates never persist a quote, reserve a price, inspect the wallet, or spend funds.
- `prepare_generation` remains the only exact expiring quote and `confirm_generation` remains the only generation action.
- Model identity/publication stays owned by `frontend/config/model-registry.json`; do not edit generated registry projections manually.
- Guidance never duplicates prices, duration, resolution, ratio, audio, reference limits, availability, or publication state.
- All feature and bug-fix code follows RED -> GREEN -> REFACTOR; observe and record the expected RED before production edits.
- Preserve strict, closed-world MCP schemas, owner-scoped OAuth authorization, sanitized errors, and no raw private prompts/references in telemetry.
- Marketing and SEO/GEO page changes are a separate follow-on plan after this core exists.

## File and responsibility map

### New product files

- `frontend/config/agent-model-guidance.json` — authored, price-free, evidence-backed agent guidance for reviewed public models.
- `frontend/src/server/agent-api/model-guidance.ts` — strict loader/validator and lookup for the authored guidance.
- `frontend/src/server/agent-api/model-details.ts` — safe projection of one public model's per-mode capabilities, input fields, guidance, and owned links.
- `frontend/src/server/mcp/tools/get-model-details.ts` — strict read-only MCP adapter for model detail.
- `frontend/src/server/agent-api/project-budget.ts` — input validation, canonical request projection, authoritative pricing calls, and integer project aggregation.
- `frontend/src/server/mcp/tools/calculate-project-budget.ts` — strict read-only MCP adapter for host-authored video proposals.
- `plugins/maxvideoai/.codex-plugin/plugin.json` — Codex package metadata.
- `plugins/maxvideoai/.claude-plugin/plugin.json` — Claude Code package metadata.
- `plugins/maxvideoai/.mcp.json` — shared remote HTTP MCP connection.
- `plugins/maxvideoai/skills/maxvideoai/SKILL.md` — shared conversational orchestration skill.
- `plugins/maxvideoai/skills/maxvideoai/references/budget-planning.md` — project-plan and creative-attempt guidance.
- `plugins/maxvideoai/skills/maxvideoai/references/generation-safety.md` — quote, confirmation, status, billing, and failure rules.
- `plugins/maxvideoai/README.md` — local validation and unpublished installation notes.
- `plugins/maxvideoai/LICENSE` — copy of the repository BUSL-1.1 license.

### New tests

- `tests/mcp-model-guidance.test.ts` — guidance schema, evidence ownership, no prices, and current-model checks.
- `tests/mcp-model-details.test.ts` — safe per-mode detail and unavailable-model behavior.
- `tests/mcp-project-budget.test.ts` — proposal validation, canonical pricing ownership, mixed models, attempts, totals, and fail-closed cases.
- `tests/mcp-plugin-contract.test.ts` — dual manifests, common skill, safe shared MCP config, and no stale catalog/prices/secrets.

### Existing owners to modify

- `frontend/src/server/agent-api/types.ts` — public model-detail and conversational recommendation DTOs only.
- `frontend/src/server/agent-api/model-catalog.ts` — reuse existing public engine policy; expose no new raw provider fields.
- `frontend/src/server/agent-api/model-recommendations.ts` — deterministic factual scoring without static cost tiers.
- `frontend/src/server/agent-api/generation-pricing.ts` — pass authoritative reference-image count through both video pricing paths.
- `frontend/src/server/agent-api/index.ts` — export only public agent DTOs/services; keep private guidance internals private.
- `frontend/src/server/mcp/server.ts` — register the two new read-only discovery tools and default services.
- `frontend/src/server/mcp/http-handler.ts` — allow safe aggregate audit events for the new tools.
- `frontend/src/server/mcp/instructions.ts` — concise conversation/budget/quote responsibility rules.
- `frontend/src/server/mcp/tools/recommend-models.ts` — strict conversational recommendation schema.
- `frontend/src/server/engines.ts` — forward normalized reference count into the canonical pricing context.
- `frontend/scripts/qa/mcp-tool-selection-contract.ts` — live tool names and project-budget intent categories.
- `frontend/scripts/qa/mcp-tool-selection-eval.ts` — metadata assertions and service stubs for five discovery tools.
- `tests/fixtures/mcp-tool-selection-prompts.json` — synthetic project-budget, direct-model-detail, preferred-model, and unrelated prompts.
- `tests/mcp-model-catalog.test.ts`, `tests/mcp-model-recommendations.test.ts`, `tests/mcp-tools-contract.test.ts`, `tests/mcp-instructions.test.ts`, `tests/mcp-tool-selection-eval.test.ts`, `tests/mcp-transport-contract.test.ts` — updated contracts.
- `docs/operations/mcp-host-compatibility-matrix.md`, `docs/marketing/mcp-directory-submissions.md`, `docs/marketing/mcp-public-claims-matrix.md` — honest local capability inventory only; no live claim.

---

### Task 1: Evidence-backed model guidance owner

**Files:**
- Create: `frontend/config/agent-model-guidance.json`
- Create: `frontend/src/server/agent-api/model-guidance.ts`
- Create: `tests/mcp-model-guidance.test.ts`

**Interfaces:**
- Produces: `AgentModelUseCase`, `AgentModelGuidance`, `getAgentModelGuidance(engineId)`, and `listAgentModelGuidance()`.
- Consumes: canonical IDs from `frontend/config/model-registry.json`; owned evidence URLs under `https://maxvideoai.com/`.

- [ ] **Step 1: Write the failing guidance contract**

Create `tests/mcp-model-guidance.test.ts` with tests that import the absent module and assert:

```ts
const reviewed = listAgentModelGuidance();
assert.deepEqual(reviewed.map((entry) => entry.engineId).sort(), [
  'gemini-omni-flash',
  'minimax-h3',
  'seedance-2-5',
]);
for (const entry of reviewed) {
  assert.match(entry.reviewedAt, /^2026-08-24$/);
  assert.ok(entry.strengths.length >= 1 && entry.strengths.length <= 4);
  assert.ok(entry.bestFor.length >= 1 && entry.bestFor.length <= 5);
  assert.ok(entry.considerations.length >= 1 && entry.considerations.length <= 4);
  entry.evidenceUrls.forEach((url) => assert.match(url, /^https:\/\/maxvideoai\.com\//));
  assert.doesNotMatch(JSON.stringify(entry), /\$|€|£|priceCents|costTier|provider|0\.13/);
}
assert.equal(getAgentModelGuidance('unknown-model'), null);
```

Add mutation cases that reject an unknown engine ID, unknown field, invalid use case, non-owned URL, duplicate URL, empty string, more than the maximum list length, or any numeric price field.

- [ ] **Step 2: Run the test and record the expected RED**

Run:

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-model-guidance.test.ts
```

Expected: FAIL because `model-guidance.ts` and its exports do not exist.

- [ ] **Step 3: Add the narrow authored guidance JSON**

Create exactly three entries. Use stable use-case tokens:

```ts
export type AgentModelUseCase =
  | 'cinematic_story'
  | 'multi_shot'
  | 'product_video'
  | 'character_scene'
  | 'reference_guided'
  | 'source_edit'
  | 'conversational_refine'
  | 'social_video'
  | 'native_audio'
  | 'high_resolution';
```

Use only claims already supported by these owned pages:

- `https://maxvideoai.com/models/seedance-2-5`
- `https://maxvideoai.com/examples/seedance`
- `https://maxvideoai.com/models/minimax-h3`
- `https://maxvideoai.com/examples/minimax-h3`
- `https://maxvideoai.com/models/gemini-omni-flash`
- `https://maxvideoai.com/ai-video-engines/gemini-omni-flash-vs-veo-3-1`

Do not copy prices or technical limits into this file.

- [ ] **Step 4: Implement the strict loader**

In `model-guidance.ts`, parse imported JSON with exact-field checks and return frozen copies:

```ts
export type AgentModelGuidance = Readonly<{
  engineId: string;
  strengths: readonly string[];
  bestFor: readonly AgentModelUseCase[];
  considerations: readonly string[];
  evidenceUrls: readonly string[];
  reviewedAt: string;
}>;

export function parseAgentModelGuidance(
  value: unknown,
  knownEngineIds: ReadonlySet<string>,
): readonly AgentModelGuidance[];

export function listAgentModelGuidance(): readonly AgentModelGuidance[];
export function getAgentModelGuidance(engineId: string): AgentModelGuidance | null;
```

Reject all unknown fields and validate NFC-trimmed text, list bounds, unique engine IDs, owned HTTPS evidence URLs, and `YYYY-MM-DD` review dates. The module must not import a pricing module or expose raw JSON.

- [ ] **Step 5: Run focused and registry tests**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-model-guidance.test.ts tests/mcp-model-catalog.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add frontend/config/agent-model-guidance.json frontend/src/server/agent-api/model-guidance.ts tests/mcp-model-guidance.test.ts
git commit -m "feat(mcp): add evidence-backed model guidance"
```

### Task 2: Safe model-detail service and MCP tool

**Files:**
- Create: `frontend/src/server/agent-api/model-details.ts`
- Create: `frontend/src/server/mcp/tools/get-model-details.ts`
- Create: `tests/mcp-model-details.test.ts`
- Modify: `frontend/src/server/agent-api/types.ts`
- Modify: `frontend/src/server/agent-api/index.ts`
- Modify: `frontend/src/server/mcp/server.ts`
- Modify: `frontend/src/server/mcp/http-handler.ts`
- Modify: `tests/mcp-tools-contract.test.ts`
- Modify: `tests/mcp-transport-contract.test.ts`

**Interfaces:**
- Consumes: `listPublicAgentGenerationEngines()`, `getAgentModelGuidance()`.
- Produces: `getAgentModelDetails(engineId) -> Promise<AgentModelDetails>` and MCP `get_model_details`.

- [ ] **Step 1: Write the failing service and tool tests**

Create service tests for an injected public H3-like candidate and assert this exact safe shape:

```ts
type AgentModelDetails = Readonly<{
  id: string;
  label: string;
  surface: 'video' | 'image';
  availability: string;
  modes: readonly AgentModelModeDetails[];
  guidance: AgentModelGuidance | null;
  links: Readonly<{
    model: string;
    pricing: string;
    examples: string | null;
  }>;
  catalogUpdatedAt: string;
}>;
```

`AgentModelModeDetails` exposes only mode, duration options/range, resolutions, aspect ratios, FPS, audio policy, and sanitized reference fields with type/required/min/max. Assert absence of `provider`, `providerMeta`, `vendorAccountId`, `pricing`, `pricingDetails`, `apiAvailability`, internal notes, upload source URLs, and unknown constraint keys.

Add an `ENGINE_UNAVAILABLE` assertion for unknown, hidden, non-executable, and retired IDs. Update `mcp-tools-contract.test.ts` so the default registry expects `get_model_details` between `list_models` and `recommend_models`, uses `id: 'minimax-h3'`, and asserts strict/read-only/non-destructive/closed-world metadata.

- [ ] **Step 2: Run the RED**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-model-details.test.ts tests/mcp-tools-contract.test.ts
```

Expected: FAIL for the missing service/tool and the still-fourth-absent registry entry.

- [ ] **Step 3: Add public model-detail DTOs and projection**

Add exact DTOs to `types.ts`. In `model-details.ts`, locate one candidate through the existing public engine policy, never by raw registry lookup. Project each executable mode from `candidate.modeCaps[mode]` and only applicable image/video/audio fields from `engine.inputSchema`.

Use this audio policy:

```ts
type AgentModelAudioPolicy = 'unavailable' | 'optional' | 'always_generated';
```

Resolve `always_generated` only when the engine advertises audio but the mode does not expose an audio toggle; use `optional` only when the mode exposes a boolean toggle. Build links from the public ID and known route patterns; examples is non-null only for an evidence URL containing `/examples/`.

- [ ] **Step 4: Register the strict read-only tool**

Use this adapter contract:

```ts
server.registerTool('get_model_details', {
  title: 'Get MaxVideoAI model details',
  description: 'Use this when the user needs exact current capabilities, constraints, evidence, or links for one known public MaxVideoAI model. Do not use it for pricing, generation, hidden models, or provider guarantees.',
  inputSchema: {
    id: z.string().trim().min(1).max(128).describe('Exact public MaxVideoAI model ID returned by list_models or recommend_models.'),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
}, async ({ id }) => runAgentTool(() => services.getModelDetails(id, principal)));
```

Add the service to `MaxVideoAiMcpServices`, default services, server registration, safe HTTP audit allowlist, and test fixtures. Export the public DTO/service from `agent-api/index.ts`; do not export the raw guidance parser there.

- [ ] **Step 5: Run focused tests**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-model-guidance.test.ts tests/mcp-model-details.test.ts tests/mcp-model-catalog.test.ts tests/mcp-tools-contract.test.ts tests/mcp-transport-contract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add frontend/src/server/agent-api/model-details.ts frontend/src/server/agent-api/types.ts frontend/src/server/agent-api/index.ts frontend/src/server/mcp/tools/get-model-details.ts frontend/src/server/mcp/server.ts frontend/src/server/mcp/http-handler.ts tests/mcp-model-details.test.ts tests/mcp-tools-contract.test.ts tests/mcp-transport-contract.test.ts
git commit -m "feat(mcp): expose safe model details"
```

### Task 3: Canonical reference pricing parity and project-budget service

**Files:**
- Create: `frontend/src/server/agent-api/project-budget.ts`
- Create: `tests/mcp-project-budget.test.ts`
- Modify: `frontend/src/server/agent-api/generation-pricing.ts`
- Modify: `frontend/src/server/engines.ts`
- Modify: `frontend/src/server/agent-api/index.ts`
- Modify: `tests/mcp-prepare-generation.test.ts`

**Interfaces:**
- Consumes: `listPublicAgentGenerationEngines()`, `validateCanonicalGenerationCapabilities()`, `priceCanonicalGeneration()`, `getUserMembershipStatus()`.
- Produces: `calculateAgentProjectBudget(input, principal, deps?) -> Promise<AgentProjectBudgetResult>`.

- [ ] **Step 1: Write the failing H3 reference-price parity test**

Add a focused generation-pricing test that supplies six `role: 'reference'` images for `minimax-h3` and captures both pricing paths. Extend the executor-path dependency object with an optional injectable `computeBillingSnapshot` function whose production default remains `computeCanonicalBillingSnapshot`; this makes the exact billing context observable without a database. Assert:

```ts
assert.equal(capturedPreflight.extraInputValues?.referenceImageCount, 6);
assert.equal(capturedBillingContext.referenceImageCount, 6);
```

The first assertion covers `priceCanonicalGeneration`; the second covers `priceCanonicalGenerationInExecutor`. Also assert zero for `t2v` and the exact canonical count for `ref2v`.

- [ ] **Step 2: Run and record the pricing RED**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-prepare-generation.test.ts
```

Expected: FAIL because the agent pricing adapters currently omit video reference count.

- [ ] **Step 3: Forward the reference count through canonical pricing**

In `generation-pricing.ts`, derive one integer from `request.references.length`, pass it as `extraInputValues.referenceImageCount` to `computeVideoPreflight`, and pass it as `referenceImageCount` to `computeCanonicalBillingSnapshot` in the executor path. In `server/engines.ts`, validate `rawExtraInputValues.referenceImageCount` as a non-negative safe integer and forward it to `computeCanonicalPublicSnapshot`; fail pricing instead of coercing malformed values.

Run the RED test again and require PASS before continuing.

- [ ] **Step 4: Write failing project-budget behavior tests**

Define the public input contract in the test:

```ts
type AgentProjectBudgetInput = Readonly<{
  proposals: readonly Readonly<{
    name: string;
    lines: readonly Readonly<{
      purpose: string;
      engineId: string;
      mode: 't2v' | 'i2v' | 'ref2v';
      settings: Readonly<{
        durationSec: number;
        resolution: string;
        aspectRatio: string;
        fps?: number;
        audio?: boolean;
        loop?: boolean;
      }>;
      referenceRoles?: readonly ('source' | 'first_frame' | 'last_frame' | 'reference')[];
      clipCount: number;
      attemptsPerClip: number;
    }>[];
  }>[];
}>;
```

Cover:

- one 60-second single-model plan whose 10-second line has `clipCount: 6`;
- a mixed Seedance/H3/Omni plan with distinct settings and prices;
- `attemptsPerClip: 3` split into base production and two creative passes;
- H3 six-reference surcharge reaches the injected canonical pricing call;
- totals use safe integer cents and one currency;
- proposal order and line order are preserved;
- unknown/hidden engine, unsupported mode/duration/resolution/ratio/audio/reference role fail with stable `ENGINE_UNAVAILABLE`, `MODE_UNSUPPORTED`, `REFERENCE_REQUIRED`, `REFERENCE_INVALID`, or `PARAMETER_INVALID` errors;
- empty or more than four proposals, empty or more than twelve lines, counts outside `1..100`, attempts outside `1..10`, more than sixteen references, more than 500 total priced attempts, unsafe integers, currency mismatch, price mismatch, and integer overflow fail closed;
- the service never calls wallet, quote persistence, provider, or reference-resolution dependencies.

- [ ] **Step 5: Run and record the project-budget RED**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-project-budget.test.ts
```

Expected: FAIL because `project-budget.ts` does not exist.

- [ ] **Step 6: Implement validation and canonical line projection**

Use constants:

```ts
export const MAX_PROJECT_PROPOSALS = 4;
export const MAX_PROJECT_LINES = 12;
export const MAX_PROJECT_CLIPS_PER_LINE = 100;
export const MAX_PROJECT_ATTEMPTS_PER_CLIP = 10;
export const MAX_PROJECT_TOTAL_ATTEMPTS = 500;
```

For each line, build an internal canonical video request with a fixed non-output prompt such as `Project pricing scenario`, `outputCount: 1`, normalized settings, and deterministic placeholder asset IDs for the supplied roles. Validate it with `validateCanonicalGenerationCapabilities`; never resolve or persist the placeholders. Call the injected/default `priceGeneration` exactly once per validated line.

Aggregate only with checked integer helpers:

```ts
function checkedMultiplyCents(left: number, right: number): number;
function checkedAddCents(left: number, right: number): number;
```

Return each unit price, base subtotal, creative-attempt subtotal, total, intended output duration, proposal totals, currency, membership tier, catalog revision, `quoteRequired: true`, and `nextAction: 'discuss_and_refine'`. Do not return the placeholder prompt or references.

- [ ] **Step 7: Run focused budget and canonical pricing regressions**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-project-budget.test.ts tests/mcp-prepare-generation.test.ts tests/minimax-h3-pricing.test.ts tests/pricing-billing-authority.test.ts tests/pricing-public-authority.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add frontend/src/server/agent-api/project-budget.ts frontend/src/server/agent-api/generation-pricing.ts frontend/src/server/engines.ts frontend/src/server/agent-api/index.ts tests/mcp-project-budget.test.ts tests/mcp-prepare-generation.test.ts
git commit -m "feat(mcp): calculate canonical project budgets"
```

### Task 4: Project-budget MCP tool and discovery registry

**Files:**
- Create: `frontend/src/server/mcp/tools/calculate-project-budget.ts`
- Modify: `frontend/src/server/mcp/server.ts`
- Modify: `frontend/src/server/mcp/http-handler.ts`
- Modify: `tests/mcp-tools-contract.test.ts`
- Modify: `tests/mcp-transport-contract.test.ts`

**Interfaces:**
- Consumes: `calculateAgentProjectBudget()` through `MaxVideoAiMcpServices.calculateProjectBudget`.
- Produces: MCP `calculate_project_budget`, always read-only and available with the authenticated discovery profile.

- [ ] **Step 1: Extend the tool-contract test before registration**

Expect the default ordered registry:

```ts
[
  'get_account_status',
  'list_models',
  'get_model_details',
  'recommend_models',
  'calculate_project_budget',
]
```

Call the missing tool with two named proposals and assert the service receives the exact validated structure. Assert the tool description contains both narrow clauses and the schema rejects unknown fields, a fifth proposal, a thirteenth line, excessive counts, image modes, and arbitrary setting keys.

- [ ] **Step 2: Run the RED**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-tools-contract.test.ts tests/mcp-transport-contract.test.ts
```

Expected: FAIL because the server still advertises four discovery tools and the tool is unregistered.

- [ ] **Step 3: Implement and register the strict adapter**

Use this metadata:

```ts
title: 'Calculate a MaxVideoAI project budget'
description: 'Use this when the user wants current pricing for one or more concrete video production proposals, including mixed models, clip counts, and explicit creative attempts. Do not use it to invent the creative plan, reserve a price, create a generation quote, inspect the wallet, or spend funds.'
annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
```

Every nested Zod object must be strict. Describe every field in prospect language. Register it outside `paidGeneration` and `referenceUploads`; those flags still control only their existing capabilities. Add only the tool name to the coarse HTTP audit allowlist.

- [ ] **Step 4: Run tool, transport, budget, and config tests**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-project-budget.test.ts tests/mcp-tools-contract.test.ts tests/mcp-transport-contract.test.ts tests/mcp-config.test.ts tests/mcp-publication.test.ts
```

Expected: PASS and all eight publication flags remain false.

- [ ] **Step 5: Commit Task 4**

```bash
git add frontend/src/server/mcp/tools/calculate-project-budget.ts frontend/src/server/mcp/server.ts frontend/src/server/mcp/http-handler.ts tests/mcp-tools-contract.test.ts tests/mcp-transport-contract.test.ts
git commit -m "feat(mcp): expose project budget tool"
```

### Task 5: Conversational recommendation contract

**Files:**
- Modify: `frontend/src/server/agent-api/types.ts`
- Modify: `frontend/src/server/agent-api/model-recommendations.ts`
- Modify: `frontend/src/server/mcp/tools/recommend-models.ts`
- Modify: `tests/mcp-model-recommendations.test.ts`
- Modify: `tests/mcp-tools-contract.test.ts`

**Interfaces:**
- Consumes: `AgentModelUseCase`, factual candidates, optional guidance.
- Produces: preference-aware recommendations without static cost-tier scoring.

- [ ] **Step 1: Replace old preference tests with failing conversational cases**

The new input adds:

```ts
type AgentModelPriority =
  | 'speed'
  | 'highest_resolution'
  | 'native_audio'
  | 'reference_control'
  | 'longer_clips'
  | 'lower_cost';

type AgentModelRecommendationInput = AgentModelFilter & {
  useCase?: AgentModelUseCase;
  priorities?: readonly AgentModelPriority[];
  preferredModelIds?: readonly string[];
  excludedModelIds?: readonly string[];
  budgetCeilingCents?: number;
};
```

Delete test inputs for `budgetPreference`, `speedPreference`, and `qualityPreference`. Add RED cases that prove:

- explicit capability filters remain hard constraints;
- a compatible preferred model moves ahead without reviving an incompatible one;
- excluded models never appear;
- speed, resolution, audio, reference, duration, and evidence-backed use case influence deterministic reasons/ranking;
- `lower_cost` or `budgetCeilingCents` sets `nextAction: 'calculate_project_budget'` and never ranks from `engine.pricing.base` or emits a numeric price;
- no input or output contains economy/balanced/premium tier labels;
- unknown preferred IDs do not revive hidden models;
- at most three models return with stable tie-breaking.

- [ ] **Step 2: Run and record the RED**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-model-recommendations.test.ts tests/mcp-tools-contract.test.ts
```

Expected: FAIL because the old tier enums and cost ranking still own the contract.

- [ ] **Step 3: Implement factual deterministic ranking**

Remove `indicativeCost` from `AgentModelCandidate` if no other agent consumer needs it. Score only declared factual priorities and matching reviewed use cases. Preserve hard capability filtering first. Preferred model order is a bounded tiebreak/bonus, not a compatibility override.

Extend next actions to:

```ts
'calculate_project_budget' | 'prepare_generation' | 'clarify_requirements'
```

When cost or a ceiling is present, explain that current comparable scenarios must be calculated; do not emit a static “cheap” claim.

- [ ] **Step 4: Update the strict MCP schema**

Give descriptions to `useCase`, `priorities`, `preferredModelIds`, `excludedModelIds`, and `budgetCeilingCents`. Cap both ID arrays at ten, deduplicate in the service, cap priorities at six, and reject unknown fields.

- [ ] **Step 5: Run recommendation and catalog tests**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-model-recommendations.test.ts tests/mcp-model-catalog.test.ts tests/mcp-model-guidance.test.ts tests/mcp-tools-contract.test.ts
```

Expected: PASS with no numeric recommendation price.

- [ ] **Step 6: Commit Task 5**

```bash
git add frontend/src/server/agent-api/types.ts frontend/src/server/agent-api/model-catalog.ts frontend/src/server/agent-api/model-recommendations.ts frontend/src/server/mcp/tools/recommend-models.ts tests/mcp-model-recommendations.test.ts tests/mcp-tools-contract.test.ts
git commit -m "refactor(mcp): make model advice conversational"
```

### Task 6: Server instructions and tool-selection evaluations

**Files:**
- Modify: `frontend/src/server/mcp/instructions.ts`
- Modify: `frontend/scripts/qa/mcp-tool-selection-contract.ts`
- Modify: `frontend/scripts/qa/mcp-tool-selection-eval.ts`
- Modify: `tests/fixtures/mcp-tool-selection-prompts.json`
- Modify: `tests/mcp-instructions.test.ts`
- Modify: `tests/mcp-tool-selection-eval.test.ts`

**Interfaces:**
- Consumes: five discovery tools plus existing gated media/generation tools.
- Produces: concise host guidance and deterministic evaluation coverage.

- [ ] **Step 1: Write failing instruction assertions**

Assert the server instructions say, in concise prose:

```text
The host owns creative discussion, scripts, prompts, shot plans, and reference ideas.
Use live MaxVideoAI tools for current model facts and prices instead of model memory.
Ask only for missing choices that materially change the result or budget.
For multi-shot work, the host may compose one or more named single- or mixed-model proposals and use calculate_project_budget.
Creative attempts are explicit billable scenarios; technical failures follow the returned job/refund state.
Project estimates do not reserve price. Use prepare_generation for the next exact quote and confirm_generation only after explicit approval.
```

Assert the text does not require economy/balanced/premium labels, a fixed questionnaire, automatic retries, automatic generation, or a custom UI.

- [ ] **Step 2: Add failing tool-selection fixtures**

Add at least these synthetic prompts:

- 60-second film requesting two current model plans -> `list_models`, `get_model_details`, `calculate_project_budget`;
- user names Seedance 2.5 but asks whether H3 is a better fit -> `get_model_details`, `recommend_models`;
- user supplies one complete generation request and asks exact price -> gated `prepare_generation`, without forced recommendation;
- prompt-writing-only request explicitly excluding MaxVideoAI -> no tool;
- “under $40, do not spend” -> recommendation plus budget calculator, never confirmation;
- reference-led product plan -> model detail then budget calculator, no upload unless an actual private file is needed;
- unrelated coding/research/local pixel edit -> no MaxVideoAI tool.

Update live tool constants to the five-tool order and add exact metadata negative-case assertions for both new tools.

- [ ] **Step 3: Run the RED**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-instructions.test.ts tests/mcp-tool-selection-eval.test.ts
```

Expected: FAIL until instructions, constants, service stubs, and corpus are updated.

- [ ] **Step 4: Implement the concise instructions and evaluation updates**

Keep the base instructions below 1,800 characters with no model IDs or prices. Preserve conditional text for reference uploads and paid generation. Update parsers' closed-world tool and claim sets rather than loosening unknown-value validation.

- [ ] **Step 5: Run the evaluator**

```bash
npm --prefix frontend run qa:mcp-tool-selection
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-instructions.test.ts tests/mcp-tool-selection-eval.test.ts tests/mcp-tools-contract.test.ts
```

Expected: deterministic fixture baseline PASS, five read-only live discovery tools, no gated generation tool in the live profile, and all publication flags false.

- [ ] **Step 6: Commit Task 6**

```bash
git add frontend/src/server/mcp/instructions.ts frontend/scripts/qa/mcp-tool-selection-contract.ts frontend/scripts/qa/mcp-tool-selection-eval.ts tests/fixtures/mcp-tool-selection-prompts.json tests/mcp-instructions.test.ts tests/mcp-tool-selection-eval.test.ts
git commit -m "test(mcp): cover conversational tool selection"
```

### Task 7: Shared Codex and Claude plugin package

**Files:**
- Create: `plugins/maxvideoai/.codex-plugin/plugin.json`
- Create: `plugins/maxvideoai/.claude-plugin/plugin.json`
- Create: `plugins/maxvideoai/.mcp.json`
- Create: `plugins/maxvideoai/skills/maxvideoai/SKILL.md`
- Create: `plugins/maxvideoai/skills/maxvideoai/references/budget-planning.md`
- Create: `plugins/maxvideoai/skills/maxvideoai/references/generation-safety.md`
- Create: `plugins/maxvideoai/README.md`
- Create: `plugins/maxvideoai/LICENSE`
- Create: `tests/mcp-plugin-contract.test.ts`

**Interfaces:**
- Consumes: the five discovery tools and existing gated media/generation tools.
- Produces: one shared skill, one shared remote MCP connection, and two valid host manifests.

- [ ] **Step 1: Write the failing package contract**

Assert:

- both manifest names and the outer folder equal `maxvideoai`;
- both versions equal `0.1.0`;
- Codex points `skills` to `./skills/` and `mcpServers` to `./.mcp.json`;
- `.mcp.json` contains only `mcpServers.maxvideoai` with `type: 'http'` and `url: 'https://api.maxvideoai.com/mcp'`;
- the skill has valid `name` and a trigger-rich `description` but no unsupported frontmatter;
- the skill references the two existing reference files and all tool names it uses exist in the current/gated registry;
- no plugin file contains a dollar/euro amount, model capability table, provider credential, bearer token, API key, client secret, private URL, or publication-live claim;
- the skill contains the quote-before-confirmation rule, conversational missing-question rule, host creative ownership, model-memory prohibition, budget tool rule, and no forced tier labels;
- the package does not contain `.app.json`, hooks, subagents, or UI code.

- [ ] **Step 2: Run and record the RED**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-plugin-contract.test.ts
```

Expected: FAIL because `plugins/maxvideoai` does not exist.

- [ ] **Step 3: Scaffold the Codex package without a marketplace entry**

Run from the plugin-creator skill directory:

```bash
python3 scripts/create_basic_plugin.py maxvideoai --path "/Users/adrienmillot/Desktop/MaxVideoAi V2/.worktrees/mcp-foundation/plugins" --with-skills --with-mcp
```

Do not pass `--with-marketplace`, `--with-apps`, or `--force`. Then use `apply_patch` for all authored manifest and skill content. Copy the repository `LICENSE` byte-for-byte to the plugin package.

- [ ] **Step 4: Author the shared skill with progressive disclosure**

Use only this minimal frontmatter:

```yaml
---
name: maxvideoai
description: Plan, compare, budget, and generate AI video or images through MaxVideoAI from Codex or Claude. Use when a user mentions MaxVideoAI, wants current AI model advice or pricing, needs prompts or references for a generation, or wants to create and follow a MaxVideoAI job.
---
```

The body must stay below 180 lines and teach judgment, not a rigid script. Put detailed project arithmetic/attempt language in `budget-planning.md`; put quoting, confirmation, polling, top-up, trial, and failure language in `generation-safety.md`. The skill must say that tools remain authoritative if its examples differ from live results.

- [ ] **Step 5: Author both manifests and common MCP config**

Codex metadata uses:

```json
{
  "name": "maxvideoai",
  "version": "0.1.0",
  "description": "Plan and generate AI video with current MaxVideoAI models and prices from Codex.",
  "author": { "name": "MaxVideoAI" },
  "homepage": "https://maxvideoai.com/mcp",
  "repository": "https://github.com/camgraphe/MaxVideoAi",
  "license": "BUSL-1.1",
  "skills": "./skills/",
  "mcpServers": "./.mcp.json"
}
```

Add the required Codex `interface` block with Creativity category, privacy/terms URLs, three conversation starter prompts, and no screenshots until real host proof exists. Claude's manifest stays minimal with the same name/version/description/author/homepage/license and relies on standard discovery of `skills/` and `.mcp.json`.

- [ ] **Step 6: Validate the package**

```bash
python3 /Users/adrienmillot/.codex/skills/.system/skill-creator/scripts/quick_validate.py plugins/maxvideoai/skills/maxvideoai
python3 /Users/adrienmillot/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/maxvideoai
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-plugin-contract.test.ts
```

Expected: all three commands PASS. The installed Claude Desktop app is not a CLI validator in this environment; actual Claude plugin loading remains part of the later real-host gate and is not claimed by this local package test.

- [ ] **Step 7: Commit Task 7**

```bash
git add plugins/maxvideoai tests/mcp-plugin-contract.test.ts
git commit -m "feat(plugin): package MaxVideoAI for Codex and Claude"
```

### Task 8: Core documentation alignment and final local gate

**Files:**
- Modify: `docs/operations/mcp-host-compatibility-matrix.md`
- Modify: `docs/marketing/mcp-directory-submissions.md`
- Modify: `docs/marketing/mcp-public-claims-matrix.md`
- Modify: relevant MCP tests only when their existing exact inventories intentionally cover the new five-tool local profile.

**Interfaces:**
- Consumes: completed core behavior and test evidence.
- Produces: honest local capability documentation and a clean branch checkpoint for independent review.

- [ ] **Step 1: Write failing documentation assertions**

Update `tests/mcp-docs-content.test.ts` and exact inventory assertions so they require the five discovery tools, describe `calculate_project_budget` as an estimate rather than a quote, state that the dual package is local/unpublished, and retain zero real Claude/Codex compatibility claims before host evidence.

- [ ] **Step 2: Run and record the RED**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-docs-content.test.ts tests/mcp-publication.test.ts tests/mcp-launch-readiness.test.ts
```

Expected: FAIL because operations and claims documents still list three discovery tools.

- [ ] **Step 3: Update only factual local documentation**

Document:

- five authenticated read-only discovery tools in the local branch;
- model detail and project estimates are locally tested but not publicly reachable;
- project estimates do not reserve price and actual generation still requires prepare/confirm;
- the plugin package is not submitted to OpenAI or Anthropic directories;
- actual Codex and Claude rendering, OAuth refresh, and hosted calls remain unchecked release gates.

Do not modify public marketing page copy in this task.

- [ ] **Step 4: Run the focused functional gate**

```bash
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-model-guidance.test.ts tests/mcp-model-details.test.ts tests/mcp-model-catalog.test.ts tests/mcp-model-recommendations.test.ts tests/mcp-project-budget.test.ts tests/mcp-tools-contract.test.ts tests/mcp-instructions.test.ts tests/mcp-tool-selection-eval.test.ts tests/mcp-transport-contract.test.ts tests/mcp-docs-content.test.ts tests/mcp-config.test.ts tests/mcp-publication.test.ts tests/mcp-prepare-generation.test.ts tests/minimax-h3-pricing.test.ts tests/pricing-billing-authority.test.ts tests/pricing-public-authority.test.ts tests/mcp-plugin-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run repository gates**

```bash
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
node -e "const flags=require('./frontend/config/mcp-publication.json'); if(Object.keys(flags).length!==8||Object.values(flags).some(Boolean)) process.exit(1)"
```

Expected: every command exits 0; exactly eight flags exist and all are false.

- [ ] **Step 6: Commit Task 8**

```bash
git add docs/operations/mcp-host-compatibility-matrix.md docs/marketing/mcp-directory-submissions.md docs/marketing/mcp-public-claims-matrix.md tests/mcp-docs-content.test.ts tests/mcp-publication.test.ts tests/mcp-launch-readiness.test.ts
git commit -m "docs(mcp): record conversational plugin core"
```

- [ ] **Step 7: Record the checkpoint without publishing**

Capture the commit hashes and exact test counts in the ignored `.superpowers/sdd/` ledger used by the branch. Confirm `git status --short` is empty. Stop before marketing implementation, hosted OAuth testing, public flags, deployment, marketplace submission, or merge.

## Plan self-review

- Spec coverage: plugin packaging, shared skill, model detail, evidence guidance, project budgeting, recommendation refinement, instructions, tool selection, billing distinction, and local verification are covered. Marketing/SEO/GEO implementation and hosted release are intentionally separated as the spec's next independent subsystem.
- Completeness scan: every production change has concrete interfaces, a named failing test, an exact command, a minimal implementation action, and a commit boundary.
- Type consistency: the tool names are exactly `get_model_details` and `calculate_project_budget`; project inputs, next actions, limits, guidance fields, and five-tool ordering are consistent across tasks.
- Safety review: no task activates flags, reaches a provider, persists a project estimate, purchases credits, submits a directory entry, deploys, pushes, or merges.
