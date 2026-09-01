# P0 Video Model Family Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch Wan 3, Wan 3 Prime, LTX 2.5 Fast, LTX 2.5 Pro, Grok Imagine Video 1.5, FLUX 3 Video, and FLUX 3 Video Draft as complete runtime, pricing, marketing, examples, comparison, SEO, and MCP products while preserving the existing LTX and Wan search equity.

**Architecture:** Keep `frontend/config/model-registry.json` as the single authored identity, lifecycle, publication, and relationship owner. Keep provider endpoint facts in raw Fal engine modules, pricing facts in the canonical pricing pipeline, marketing prose in localized content, and derive every runtime/catalog/roster projection through the existing generators. New pages stay unpublished until runtime, exact pricing, three-locale content, two accepted videos, complete scores, links, and MCP parity are all green; publication is one final registry-controlled change.

**Tech Stack:** Next.js App Router, TypeScript, React Server Components, Vitest, JSON content registries, `@maxvideoai/pricing`, Fal provider endpoints, MaxVideoAI MCP/agent API, localized SEO routes and sitemaps.

**Spec:** `docs/superpowers/specs/2026-09-01-p0-video-model-family-refresh-design.md`

## Global Constraints

- Do not edit generated `frontend/config/model-runtime.json`, `frontend/config/engine-catalog.json`, `frontend/config/model-roster.json`, `docs/model-roster.json`, or `docs/model-roster.csv` directly.
- Re-read the live Fal endpoint schema, availability, and price immediately before implementation and before paid example generation. Record the checked values in Task 1; if the live contract differs from the approved spec, amend the spec and this plan before coding the changed behavior.
- Keep all seven new registry records unpublished until Task 14. Intermediate commits may add executable code and content, but public model, example, compare, pricing, app, and sitemap flags remain false.
- Preserve `/examples/ltx`, `/examples/wan`, all existing LTX 2.3 URLs, all historical video labels, and existing indexed comparisons. Do not add a launch-day LTX or Wan redirect.
- Treat `legacy` as exact-lookup/executable but not recommended by default, and `deep_legacy` as historical-only: absent from current navigation, app discovery, default MCP results, recommendations, and current pricing.
- Never author customer totals in localized content. Billing, public quotes, model-page estimates, pricing, pay-as-you-go, wallet preflight, MCP quotes, and receipts must consume the same canonical calculation.
- P0 comparisons are scoreboard-only. Do not add showdown playlists, face-to-face video modules, or empty media placeholders.
- Use the `maxvideoai:plan` skill for Task 12. A project estimate is not approval. Obtain a fresh exact quote and explicit approval before every paid attempt; never retry automatically.
- Preserve the user's unrelated untracked `output/reddit-*` directories.
- Use focused tests first, commit after each task, and keep publication as a separate atomic commit.

---

## Task 1: Freeze Live Source Contracts and Restore a Green SEO Baseline

**Files:**

- Create: `docs/model-launch/p0-video-model-family-refresh.md`
- Modify: `scripts/internal-link-guard.mjs`
- Modify: `tests/analytics-consent.test.ts`
- Modify: `tests/company-content-rights.test.ts`

- [ ] **Step 1: Add failing tests for the current `/company` false positive**

Add one assertion showing that the analytics journey classifier may recognize `/company` without creating a public link, and retain the existing restrictions on actual company/trust links.

```ts
it('treats the journey classifier as analytics data, not an authored public link', () => {
  expect(ALLOWED_NON_LINK_ROUTE_CLASSIFIERS).toContain(
    'frontend/lib/analytics/journey.ts'
  );
});
```

- [ ] **Step 2: Run the tests and SEO guard to prove the baseline failure**

Run:

```bash
pnpm exec vitest run tests/analytics-consent.test.ts tests/company-content-rights.test.ts
pnpm --prefix frontend run seo:check
```

Expected: the focused test or internal-link guard fails on `frontend/lib/analytics/journey.ts:83`; canonical, `llms.txt`, public-media-origin, and locale checks remain green.

- [ ] **Step 3: Narrowly classify the analytics file as a non-link owner**

Add an explicit file-level exception in `scripts/internal-link-guard.mjs`; do not globally allow `/company` and do not weaken JSX/Markdown/metadata link scanning.

```js
const ALLOWED_NON_LINK_ROUTE_CLASSIFIERS = new Set([
  'frontend/lib/analytics/journey.ts',
]);
```

- [ ] **Step 4: Record the live P0 contract**

In `docs/model-launch/p0-video-model-family-refresh.md`, create one table row per model and mode with:

- provider owner and Fal distribution endpoint;
- checked-at UTC timestamp and source URL;
- provider availability/status;
- exact input names, required references, accepted media kinds, and reference limits;
- duration options/default, resolutions, aspect ratios, FPS, audio behavior, upload limits;
- provider billing unit and exact live price;
- MaxVideoAI canonical mode and any explicitly excluded provider mode.

Record the seven canonical identities and the endpoint map from the design spec. Treat `keyframes-to-video`, `draft-enhance`, and unmapped provider modes as explicit exclusions.

- [ ] **Step 5: Re-run the baseline suite**

Run:

```bash
pnpm exec vitest run tests/analytics-consent.test.ts tests/company-content-rights.test.ts
pnpm --prefix frontend run seo:check
node scripts/public-media-origin-guard.mjs
pnpm --prefix frontend run i18n:check
git diff --check
```

Expected: all commands pass. Record the command results and current Node engine warning, if any, in the launch document.

- [ ] **Step 6: Commit the isolated baseline/source-contract change**

```bash
git add docs/model-launch/p0-video-model-family-refresh.md scripts/internal-link-guard.mjs tests/analytics-consent.test.ts tests/company-content-rights.test.ts
git commit -m "docs: freeze p0 video source contracts"
```

---

## Task 2: Add Canonical Lifecycle and Successor Semantics

**Files:**

- Modify: `frontend/config/model-registry-validation.ts`
- Modify: `frontend/config/model-registry.ts`
- Modify: `frontend/config/model-runtime.ts`
- Modify: `frontend/config/model-registry.json`
- Modify: `frontend/src/config/fal-engines/types.ts`
- Modify: `frontend/src/config/falEngines.ts`
- Modify: `scripts/lib/model-runtime-projection.mjs`
- Modify: `scripts/model-setup.mjs`
- Modify: `tests/model-registry-validation.test.ts`
- Modify: `tests/model-registry-parity.test.ts`
- Modify: `tests/model-registry-baseline.test.ts`
- Modify: `tests/model-registry-architecture.test.ts`
- Modify: `tests/fixtures/model-registry-baseline.json`

- [ ] **Step 1: Write lifecycle validation tests first**

Cover valid `current`, `legacy`, `deep_legacy`, and `retired` records plus failures for an unknown lifecycle, self-successor, successor chain, missing successor target, a `current` model with a successor, and a `deep_legacy` model published in app/current examples/current pricing.

```ts
export type ModelLifecycle =
  | 'current'
  | 'legacy'
  | 'deep_legacy'
  | 'retired';

export type ModelRegistryEntry = {
  // existing fields
  lifecycle: ModelLifecycle;
  successorId: string | null;
};
```

- [ ] **Step 2: Run the registry tests and confirm they fail**

Run:

```bash
pnpm exec vitest run tests/model-registry-validation.test.ts tests/model-registry-parity.test.ts tests/model-registry-baseline.test.ts tests/model-registry-architecture.test.ts
```

Expected: failures show that lifecycle/successor fields are not yet parsed or projected.

- [ ] **Step 3: Implement schema version 2 and invariants**

Change the authored and generated registry schema to version 2. Enforce:

- every record has one lifecycle and a nullable `successorId`;
- `current` and `retired` records cannot have a lifecycle successor; retired keeps the existing `replacement` contract;
- `legacy` and `deep_legacy` may point directly to a `current` target;
- successors are canonical IDs, non-self, non-chained, and category-compatible;
- `deep_legacy` has `app.published=false`, `pricing.published=false`, and `examples.current=false`;
- presentation-only and retired invariants continue to hold.

- [ ] **Step 4: Project lifecycle into runtime and engine entries**

Add lifecycle and successor identity to the generated runtime row and expose helpers from `frontend/config/model-runtime.ts`:

```ts
export function getRuntimeModelSuccessor(
  modelOrId: RuntimeModelEntry | string
): RuntimeModelEntry | null;

export function isRuntimeModelRecommendedByDefault(
  modelOrId: RuntimeModelEntry | string
): boolean;
```

Derive `successorSlug` from the canonical successor row; never author it separately. Extend `FalEngineEntry` with registry-owned lifecycle/successor data and exclude those fields from `RawFalEngineEntry`.

- [ ] **Step 5: Migrate existing models without changing their existing publication intent**

Map existing executable records using `isLegacy` to `legacy`, all other active records to `current`, and existing replacement records to `retired`. Set `successorId` to null in this migration; Task 6 adds the P0 successor graph after its targets exist. Keep existing URLs and flags unchanged except for the approved existing-family state:

- `ltx-2-3`, `ltx-2-3-fast`, and `wan-2-6`: `legacy`;
- `ltx-2`, `ltx-2-fast`, and `wan-2-5`: `deep_legacy`, removed from app/current pricing/current examples;
- no redirect or replacement change.

- [ ] **Step 6: Regenerate and verify the canonical projections**

Run:

```bash
pnpm model:registry:generate
pnpm model:registry:check
pnpm exec vitest run tests/model-registry-validation.test.ts tests/model-registry-parity.test.ts tests/model-registry-baseline.test.ts tests/model-registry-architecture.test.ts
git diff --check
```

Expected: generated runtime/catalog/roster/docs all carry the intended lifecycle consistently and no generated file has a hand-authored diff.

- [ ] **Step 7: Commit**

```bash
git add frontend/config frontend/src/config/fal-engines/types.ts frontend/src/config/falEngines.ts scripts/lib/model-runtime-projection.mjs scripts/model-setup.mjs tests/model-registry-validation.test.ts tests/model-registry-parity.test.ts tests/model-registry-baseline.test.ts tests/model-registry-architecture.test.ts tests/fixtures/model-registry-baseline.json docs/model-roster.json docs/model-roster.csv
git commit -m "feat: add canonical model lifecycle policy"
```

---

## Task 3: Define the Seven Raw Fal Engine Contracts

**Files:**

- Create: `frontend/src/config/fal-engines/wan-3-shared.ts`
- Create: `frontend/src/config/fal-engines/wan-3.ts`
- Create: `frontend/src/config/fal-engines/wan-3-prime.ts`
- Create: `frontend/src/config/fal-engines/ltx-2-5-shared.ts`
- Create: `frontend/src/config/fal-engines/ltx-2-5-fast.ts`
- Create: `frontend/src/config/fal-engines/ltx-2-5-pro.ts`
- Create: `frontend/src/config/fal-engines/grok-imagine-video-1-5.ts`
- Create: `frontend/src/config/fal-engines/flux-3-shared.ts`
- Create: `frontend/src/config/fal-engines/flux-3.ts`
- Create: `frontend/src/config/fal-engines/flux-3-draft.ts`
- Create: `tests/p0-video-engine-contracts.test.ts`
- Modify: `tests/fal-engine-catalog-architecture.test.ts`

- [ ] **Step 1: Add contract tests for every model/mode/endpoint**

Assert the complete canonical mode set:

```ts
const expectedModes = {
  'wan-3': ['t2v', 'i2v', 'ref2v'],
  'wan-3-prime': ['t2v', 'i2v', 'ref2v'],
  'ltx-2-5-fast': ['t2v', 'i2v', 'a2v'],
  'ltx-2-5-pro': ['t2v', 'i2v', 'a2v'],
  'grok-imagine-video-1-5': ['t2v', 'i2v', 'ref2v'],
  'flux-3': ['t2v', 'i2v', 'fl2v', 'extend'],
  'flux-3-draft': ['t2v', 'i2v', 'fl2v', 'extend'],
} as const;
```

Also assert exact Fal IDs from Task 1 and the absence of `keyframes-to-video`, `draft-enhance`, and generic invented modes.

- [ ] **Step 2: Run the tests and confirm missing-module failures**

Run:

```bash
pnpm exec vitest run tests/p0-video-engine-contracts.test.ts tests/fal-engine-catalog-architecture.test.ts
```

- [ ] **Step 3: Implement raw engine modules**

Use shared helpers only for facts proven identical in the live contract. Each raw entry owns provider, brand, availability, UI caps, modes, endpoint IDs, prompt hints, billing notes, and exact provider-facing constraints. Keep registry-owned slug/family/category/surfaces/lifecycle/successor fields out of the raw modules.

Do **not** import the new modules into `frontend/src/config/fal-engines/registry.ts` yet; canonical IDs do not exist until Task 6.

- [ ] **Step 4: Verify module and architecture contracts**

Run:

```bash
pnpm exec vitest run tests/p0-video-engine-contracts.test.ts tests/fal-engine-catalog-architecture.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
git diff --check
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/config/fal-engines tests/p0-video-engine-contracts.test.ts tests/fal-engine-catalog-architecture.test.ts
git commit -m "feat: define p0 video engine contracts"
```

---

## Task 4: Implement Exact Provider Request, Validation, and Workspace Projection

**Files:**

- Create: `frontend/src/lib/p0-video-provider-fields.ts`
- Modify: `frontend/src/lib/fal-request-body.ts`
- Modify: `frontend/src/server/agent-api/paid-video-request-body.ts`
- Modify: `frontend/app/api/generate/_lib/attachment-references.ts`
- Modify: `frontend/app/api/generate/_lib/validation-payload.ts`
- Modify: `frontend/app/api/generate/_lib/validate-media-inputs.ts`
- Modify: `frontend/app/api/generate/_lib/validate-provider-constraints.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts`
- Create: `tests/p0-video-request-bodies.test.ts`
- Create: `tests/p0-video-validation.test.ts`
- Create: `tests/p0-video-workspace.test.ts`

- [ ] **Step 1: Add full-object request tests before implementation**

For every supported mode, compare the whole provider request, not selected fields. Include negative assertions:

```ts
expect(grokRefBody).toMatchObject({ reference_image_urls: [controlledUrl] });
expect(grokRefBody).not.toHaveProperty('image_urls');

expect(fluxFrameBody).toMatchObject({
  start_image_url: controlledStart,
  end_image_url: controlledEnd,
});
expect(fluxFrameBody).not.toHaveProperty('first_frame_url');
```

Test that LTX `a2v` requires a private source-audio asset and is not accepted as a text-mode audio toggle. Test Wan's exact reference array name and live count limit.

- [ ] **Step 2: Run new tests and relevant regressions**

Run:

```bash
pnpm exec vitest run tests/p0-video-request-bodies.test.ts tests/p0-video-validation.test.ts tests/p0-video-workspace.test.ts tests/mcp-model-executability.test.ts
```

Expected: new tests fail on missing engine-aware mappings.

- [ ] **Step 3: Add one provider-field resolver**

Use a small pure adapter shared by app and MCP request builders:

```ts
export type P0ReferenceProjection = {
  referenceImages?: 'reference_image_urls' | 'image_urls';
  firstFrame?: 'start_image_url' | 'first_frame_url';
  lastFrame?: 'end_image_url' | 'last_frame_url';
};

export function resolveP0ReferenceProjection(
  engineId: string,
  mode: Mode
): P0ReferenceProjection;
```

The resolver maps only provider field names. Mode schemas remain the authority for limits, accepted media, and required/optional status.

- [ ] **Step 4: Wire validation and workspace mode availability**

Project live duration/resolution/aspect/reference constraints into pre-billing validation. Keep mode selection logic in `useWorkspaceEngineModeState.ts`, schema/input building in route-local `_lib`, and do not expand `AppClient.tsx`. Reject missing LTX audio, missing FLUX end frame, wrong media kind, and excess reference images before quoting.

- [ ] **Step 5: Verify provider, API, and workspace behavior**

Run:

```bash
pnpm exec vitest run tests/p0-video-request-bodies.test.ts tests/p0-video-validation.test.ts tests/p0-video-workspace.test.ts tests/mcp-model-executability.test.ts tests/workspace-pricing-gate-hook-contract.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib frontend/src/server/agent-api/paid-video-request-body.ts frontend/app/api/generate/_lib 'frontend/app/(core)/(workspace)/app/_lib' 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts' tests/p0-video-request-bodies.test.ts tests/p0-video-validation.test.ts tests/p0-video-workspace.test.ts
git commit -m "feat: project p0 video provider requests"
```

---

## Task 5: Extend Canonical Pricing for Mode and Reference-Count Facts

**Files:**

- Modify: `frontend/types/engines.ts`
- Modify: `frontend/src/lib/pricing-billing-facts.ts`
- Modify: `frontend/src/lib/pricing-public-facts.ts`
- Modify: `frontend/src/lib/pricing-context.ts`
- Modify: `packages/pricing/src/definitions.ts`
- Create: `tests/p0-video-pricing-parity.test.ts`
- Modify: `tests/pricing-definition.test.ts`
- Modify: `tests/pricing-billing-projection.test.ts`
- Modify: `tests/pricing-public-projection.test.ts`
- Modify: `tests/fixtures/pricing-parity.v1.json`
- Modify: `tests/fixtures/pricing-public-projections.v1.json`

- [ ] **Step 1: Add failing pricing fact and parity cases**

Cover every P0 model at a canonical 720p scenario, all documented resolution tiers, Grok `referenceImageCount`, and separate FLUX `extend` rates/context. For the same normalized scenario, assert equality across billing facts, public facts, wallet quote, MCP prepared quote, receipt basis, pricing card, and model-page estimate.

```ts
expect(publicQuote.vendorSubtotalCents).toBe(billingQuote.vendorSubtotalCents);
expect(publicQuote.totalCents).toBe(billingQuote.totalCents);
expect(mcpQuote.totalCents).toBe(walletQuote.totalCents);
```

- [ ] **Step 2: Run the pricing tests and prove the missing dimensions**

Run:

```bash
pnpm exec vitest run tests/p0-video-pricing-parity.test.ts tests/pricing-definition.test.ts tests/pricing-billing-projection.test.ts tests/pricing-public-projection.test.ts
```

- [ ] **Step 3: Extend the factual pricing shape, not page copy**

Add only the dimensions required by the audited provider facts:

```ts
type ModePricingOverride = {
  perSecondCents?: {
    default?: number;
    byResolution?: Record<string, number>;
  };
};

type ReferenceImagePricing = {
  unitCents: number;
  includedCount?: number;
  modes: Mode[];
};
```

Project `mode`, `durationSeconds`, `resolution`, and `referenceImageCount` through both billing and public adapters. Do not create a P0-only price calculator and do not embed finished totals in engine SEO hints or locale files.

- [ ] **Step 4: Enter the exact Task 1 live rates and review fixtures**

Use the source-contract values, including Grok's per-reference increment and FLUX extend price. Regenerate fixture rows only through the existing pricing scripts, review every changed number, and leave unrelated fixture rows unchanged.

- [ ] **Step 5: Run pricing authority and audit gates**

Run:

```bash
pnpm exec vitest run tests/p0-video-pricing-parity.test.ts tests/pricing-definition.test.ts tests/pricing-billing-authority.test.ts tests/pricing-public-authority.test.ts tests/pricing-billing-projection.test.ts tests/pricing-public-projection.test.ts tests/pricing-canonical-kernel.test.ts
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add frontend/types/engines.ts frontend/src/lib/pricing-billing-facts.ts frontend/src/lib/pricing-public-facts.ts frontend/src/lib/pricing-context.ts packages/pricing/src/definitions.ts tests/p0-video-pricing-parity.test.ts tests/pricing-definition.test.ts tests/pricing-billing-projection.test.ts tests/pricing-public-projection.test.ts tests/fixtures/pricing-parity.v1.json tests/fixtures/pricing-public-projections.v1.json
git commit -m "feat: price p0 video modes canonically"
```

---

## Task 6: Register Models, Families, Successors, and Brands Behind Publication Flags

**Files and state:**

- Modify: `frontend/config/model-registry.json`
- Modify: `frontend/src/config/fal-engines/registry.ts`
- Modify: `frontend/config/model-families.ts`
- Modify: `frontend/src/lib/brand-partners.ts`
- Modify: `frontend/src/config/engineCatalog.overrides.ts`
- Modify: `tests/model-registry-validation.test.ts`
- Modify: `tests/model-registry-parity.test.ts`
- Modify: `tests/brand-partners.test.ts`
- Create: `tests/p0-model-family-contract.test.ts`

- [ ] **Step 1: Add failing identity, family, successor, and brand tests**

Assert the seven canonical IDs/slugs/families, hidden publication state, family defaults, and exact one-hop successor graph:

```ts
const successors = {
  'ltx-2-3': 'ltx-2-5-pro',
  'ltx-2-3-fast': 'ltx-2-5-fast',
  'ltx-2': 'ltx-2-5-pro',
  'ltx-2-fast': 'ltx-2-5-fast',
  'wan-2-6': 'wan-3',
  'wan-2-5': 'wan-3',
} as const;
```

Assert family defaults `ltx-2-5-pro`, `wan-3-prime`, `grok-imagine-video-1-5`, and `flux-3`.

- [ ] **Step 2: Run the tests and confirm missing registry identities**

Run:

```bash
pnpm exec vitest run tests/p0-model-family-contract.test.ts tests/model-registry-validation.test.ts tests/model-registry-parity.test.ts tests/brand-partners.test.ts
```

- [ ] **Step 3: Add the seven current registry entries as hidden**

Set `lifecycle: "current"`, `successorId: null`, correct aliases/family/category, and every public surface false. Import all seven raw modules into the Fal registry only after these identities exist. Apply the successor graph above to the existing lifecycle rows; do not set `replacement` and do not create redirects.

- [ ] **Step 4: Add family and brand ownership**

Add first-class `grok` and `flux` family definitions. Update Wan and Lightricks memberships. Add xAI and Black Forest Labs as text-only partner brands unless Task 1 records licensed durable logo assets; never fetch or hotlink an unlicensed logo. Marketing attribution must say the model owner and separately identify Fal as the execution distributor.

- [ ] **Step 5: Generate and verify all projections**

Run:

```bash
pnpm model:registry:generate
pnpm model:registry:check
pnpm exec vitest run tests/p0-model-family-contract.test.ts tests/model-registry-validation.test.ts tests/model-registry-parity.test.ts tests/brand-partners.test.ts tests/fal-engine-catalog-architecture.test.ts
git diff --check
```

Expected: all seven rows exist in generated artifacts but remain absent from public surfaces because publication flags are false.

- [ ] **Step 6: Commit**

```bash
git add frontend/config frontend/src/config/fal-engines/registry.ts frontend/src/lib/brand-partners.ts frontend/src/config/engineCatalog.overrides.ts tests/p0-model-family-contract.test.ts tests/model-registry-validation.test.ts tests/model-registry-parity.test.ts tests/brand-partners.test.ts docs/model-roster.json docs/model-roster.csv
git commit -m "feat: register hidden p0 video families"
```

---

## Task 7: Bring MCP Catalog, Details, Recommendations, Budgets, and Execution to Parity

**Files:**

- Modify: `frontend/src/server/agent-api/types.ts`
- Modify: `frontend/src/server/agent-api/model-catalog.ts`
- Modify: `frontend/src/server/agent-api/model-details.ts`
- Modify: `frontend/src/server/agent-api/model-recommendations.ts`
- Modify: `frontend/src/server/agent-api/model-guidance.ts`
- Modify: `frontend/config/agent-model-guidance.json`
- Modify: `frontend/config/agent-model-prompting-sources.json`
- Modify: `tests/mcp-model-catalog.test.ts`
- Modify: `tests/mcp-model-details.test.ts`
- Modify: `tests/mcp-model-recommendations.test.ts`
- Modify: `tests/mcp-model-guidance.test.ts`
- Modify: `tests/mcp-model-prompting-sources.test.ts`
- Modify: `tests/mcp-model-executability.test.ts`
- Create: `tests/mcp-p0-video-parity.test.ts`

- [ ] **Step 1: Add failing lifecycle-aware MCP tests**

Extend model DTO assertions:

```ts
type AgentModelLifecycleFields = {
  lifecycle: ModelLifecycle;
  successor: { id: string; slug: string } | null;
  recommendedByDefault: boolean;
};
```

Test that default listing/recommendations include current published models only; exact lookup can describe and execute `legacy`; exact deep-legacy lookup returns `generationEnabled: false` plus its successor; pricing and request construction match the app for each P0 mode.

- [ ] **Step 2: Run MCP tests and confirm missing behavior**

Run:

```bash
pnpm exec vitest run tests/mcp-model-catalog.test.ts tests/mcp-model-details.test.ts tests/mcp-model-recommendations.test.ts tests/mcp-model-guidance.test.ts tests/mcp-model-prompting-sources.test.ts tests/mcp-model-executability.test.ts tests/mcp-p0-video-parity.test.ts
```

- [ ] **Step 3: Project lifecycle and exact capabilities from canonical sources**

Use model-runtime publication/lifecycle helpers rather than a second allowlist. Model details expose exact duration/resolution/ratio/reference/media limits. Guidance describes LTX `a2v`, Grok reference images, FLUX first/last frame and extend, and Wan reference mode only when supported by the live contract.

- [ ] **Step 4: Keep budgeting and confirmation on the canonical path**

Verify `project-budget`, `prepare-generation`, `confirm-generation`, and `paid-video-request-body` consume the same normalized scenario, pricing quote, and provider projection as the app. Do not introduce an MCP-only model alias or price table.

- [ ] **Step 5: Run MCP and pricing parity gates**

Run:

```bash
pnpm exec vitest run tests/mcp-model-catalog.test.ts tests/mcp-model-details.test.ts tests/mcp-model-recommendations.test.ts tests/mcp-model-guidance.test.ts tests/mcp-model-prompting-sources.test.ts tests/mcp-model-executability.test.ts tests/mcp-p0-video-parity.test.ts tests/p0-video-pricing-parity.test.ts tests/p0-video-request-bodies.test.ts
pnpm model:registry:check
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/server/agent-api frontend/config/agent-model-guidance.json frontend/config/agent-model-prompting-sources.json tests/mcp-model-catalog.test.ts tests/mcp-model-details.test.ts tests/mcp-model-recommendations.test.ts tests/mcp-model-guidance.test.ts tests/mcp-model-prompting-sources.test.ts tests/mcp-model-executability.test.ts tests/mcp-p0-video-parity.test.ts
git commit -m "feat: add p0 video mcp parity"
```

---

## Task 8: Build Seven Localized Model Pages and Lifecycle Transition Copy

**Files:**

- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/wan-3.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/wan-3-prime.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/ltx-2-5-fast.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/ltx-2-5-pro.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/grok-imagine-video-1-5.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/flux-3.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/flux-3-draft.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`
- Create: `content/models/{en,fr,es}/{wan-3,wan-3-prime,ltx-2-5-fast,ltx-2-5-pro,grok-imagine-video-1-5,flux-3,flux-3-draft}.json`
- Modify: `content/models/{en,fr,es}/{ltx-2,ltx-2-fast,ltx-2-3-pro,ltx-2-3-fast,wan-2-5,wan-2-6}.json`
- Modify: `tests/model-page-template-registry.test.ts`
- Modify: `tests/model-page-template-content.test.ts`
- Modify: `tests/model-page-publication.test.ts`
- Modify: `tests/model-page-copy-architecture.test.ts`
- Create: `tests/p0-model-page-seo-content.test.ts`

- [ ] **Step 1: Add failing template/content/SEO contract tests**

For all 21 new locale files, require exact `modelSlug`, complete decision/prompting/examples contracts, unique localized metadata, valid localized links, at least 400 useful words, and page-specific copy. Require 2–4 unique contextual editorial links plus family examples, pricing, generation, successor/sibling, and primary comparison destinations.

- [ ] **Step 2: Run the focused model-page tests**

Run:

```bash
pnpm exec vitest run tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts tests/model-page-publication.test.ts tests/model-page-copy-architecture.test.ts tests/p0-model-page-seo-content.test.ts
```

- [ ] **Step 3: Implement page templates from runtime/pricing facts**

Each template declares key specs, supported modes, canonical pricing presets, quick links, prompting source IDs, and primary comparisons. It must not duplicate provider facts or finished prices in prose. Leave example playlists empty/hidden until Task 12 and keep registry publication false.

- [ ] **Step 4: Author and review EN/FR/ES content**

Write genuinely localized copy for best fit, non-fit, workflows, constraints, prompting, family position, provider attribution, and safety. Add lifecycle blocks to LTX 2.3 and Wan 2.6, plus deep-legacy transition blocks to LTX 2.0 and Wan 2.5. Preserve each older page's own version-specific intent and self-canonical identity.

- [ ] **Step 5: Verify content, locale, and link contracts**

Run:

```bash
pnpm exec vitest run tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts tests/model-page-publication.test.ts tests/model-page-copy-architecture.test.ts tests/p0-model-page-seo-content.test.ts tests/premerge-seo-routes.test.ts
pnpm --prefix frontend run i18n:check
pnpm --prefix frontend run seo:check
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts' content/models tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts tests/model-page-publication.test.ts tests/model-page-copy-architecture.test.ts tests/p0-model-page-seo-content.test.ts
git commit -m "feat: author p0 video model pages"
```

---

## Task 9: Propagate Current Models into Pricing and Pay-As-You-Go

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/types.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/en.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/fr.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/es.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-jsonld.ts`
- Modify: `tests/pricing-page-architecture.test.ts`
- Modify: `tests/pricing-model-links.test.ts`
- Modify: `tests/payg-page-content-contract.test.ts`
- Modify: `tests/payg-page-data.test.ts`
- Modify: `tests/payg-page-rendering.test.ts`
- Create: `tests/p0-pricing-discovery.test.ts`

- [ ] **Step 1: Add failing discovery and quote-source tests**

Assert that current P0 variants precede legacy variants, LTX 2.3 and Wan 2.6 are labeled previous generation, LTX 2.0 and Wan 2.5 are absent, and all links resolve to localized canonical model pages. Assert rendered totals come from public quote data, not locale strings.

- [ ] **Step 2: Run pricing/pay-as-you-go tests**

Run:

```bash
pnpm exec vitest run tests/pricing-page-architecture.test.ts tests/pricing-model-links.test.ts tests/payg-page-content-contract.test.ts tests/payg-page-data.test.ts tests/payg-page-rendering.test.ts tests/p0-pricing-discovery.test.ts
```

- [ ] **Step 3: Update pricing hub ownership**

Add all executable current P0 rows and exact canonical scenarios. Order current variants before legacy within LTX and Wan. Keep deep legacy out of current pricing. Update family ordering, highlight eligibility, anchors, cheapest-state selection, and Product/Offer JSON-LD without authoring duplicate prices.

- [ ] **Step 4: Update the pay-as-you-go acquisition surface**

Add one clear current representative row per P0 family plus useful current sibling variants in the supported-model list. Refresh preferred rows, model lookups, example-cost scenarios, comparison allowlist, and EN/FR/ES decision copy. Keep calculations in `_lib/payg-page-data.ts`; locale modules contain labels and prose only.

- [ ] **Step 5: Verify pricing parity and localized routes**

Run:

```bash
pnpm exec vitest run tests/pricing-page-architecture.test.ts tests/pricing-model-links.test.ts tests/payg-page-content-contract.test.ts tests/payg-page-data.test.ts tests/payg-page-rendering.test.ts tests/p0-pricing-discovery.test.ts tests/p0-video-pricing-parity.test.ts
pnpm pricing:audit
pnpm --prefix frontend run i18n:check
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts' 'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator' tests/pricing-page-architecture.test.ts tests/pricing-model-links.test.ts tests/payg-page-content-contract.test.ts tests/payg-page-data.test.ts tests/payg-page-rendering.test.ts tests/p0-pricing-discovery.test.ts
git commit -m "feat: refresh p0 pricing discovery"
```

---

## Task 10: Refresh Models, Homepage, Examples, Families, and Curated Navigation

**Files:**

- Modify: `frontend/config/navigation.ts`
- Modify: `frontend/config/model-families.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/constants.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/best-for.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-cards.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-data.ts`
- Modify: `frontend/lib/examples/modelLandingData.ts`
- Modify: `frontend/lib/examples/modelLandingData.en.ts`
- Modify: `frontend/lib/examples/modelLandingData.fr.ts`
- Modify: `frontend/lib/examples/modelLandingData.es.ts`
- Modify: `tests/marketing-navigation.test.ts`
- Modify: `tests/model-examples-content-contract.test.ts`
- Modify: `tests/model-examples-view-model.test.ts`
- Create: `tests/p0-marketing-discovery.test.ts`

- [ ] **Step 1: Add failing curated-discovery tests**

Require exactly these P0 representatives in the main model menu:

```ts
[
  'ltx-2-5-pro',
  'wan-3-prime',
  'grok-imagine-video-1-5',
  'flux-3',
]
```

Require all seven models on `/models`, current-before-legacy family ordering, deep-legacy exclusion from current discovery, stable `/examples/ltx` and `/examples/wan`, and complete new `/examples/grok` and `/examples/flux` family definitions. Keep menu limits intact rather than appending every variant.

- [ ] **Step 2: Run discovery tests**

Run:

```bash
pnpm exec vitest run tests/marketing-navigation.test.ts tests/model-examples-content-contract.test.ts tests/model-examples-view-model.test.ts tests/p0-marketing-discovery.test.ts
```

- [ ] **Step 3: Update models and family discovery data**

Add family mappings, top-pick eligibility, use-case cards, family summaries, and comparison links. LTX family order is 2.5 Pro, 2.5 Fast, 2.3 history, then optional 2.0 note. Wan family order is Prime/3, then 2.6 history, then optional 2.5 note. Grok and FLUX get complete EN/FR/ES family copy.

- [ ] **Step 4: Gate homepage and example navigation on accepted assets**

Prepare the current-model mappings now, but only add a P0 model to homepage example priority or the examples menu when Task 12 supplies an accepted durable playlist item. The launch must test this as a deliberate decision; empty families never appear as promoted galleries.

- [ ] **Step 5: Verify discovery, locale, and no-orphan assumptions**

Run:

```bash
pnpm exec vitest run tests/marketing-navigation.test.ts tests/model-examples-content-contract.test.ts tests/model-examples-view-model.test.ts tests/p0-marketing-discovery.test.ts tests/premerge-seo-routes.test.ts
pnpm --prefix frontend run i18n:check
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add frontend/config/navigation.ts frontend/config/model-families.ts 'frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data' 'frontend/app/(localized)/[locale]/(marketing)/models/_lib' 'frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-data.ts' frontend/lib/examples tests/marketing-navigation.test.ts tests/model-examples-content-contract.test.ts tests/model-examples-view-model.test.ts tests/p0-marketing-discovery.test.ts
git commit -m "feat: refresh p0 marketing discovery"
```

---

## Task 11: Strengthen the SEO Graph, Best-For Decisions, GSC, LLMS, and Sitemap Policy

**Files:**

- Modify: `frontend/config/compare-hub.json`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-config.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-content.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-ranking.ts`
- Modify: `frontend/lib/seo/llms-text.ts`
- Modify: `frontend/lib/seo/gsc-analysis.ts`
- Modify: `frontend/config/sitemap-timestamps.ts`
- Modify: `tests/gsc-analysis.test.ts`
- Modify: `tests/premerge-seo-routes.test.ts`
- Modify: `tests/schema-sitemap-architecture.test.ts`
- Modify: `tests/video-pages-sitemap.test.ts`
- Create: `tests/p0-seo-link-graph.test.ts`

- [ ] **Step 1: Add failing SEO graph and classification tests**

For each new indexable model, require crawlable inbound ownership from `/models`, its family page, its pricing row, and one primary comparison or evidence-backed best-for route. Require self-canonical plus reciprocal EN/FR/ES hreflang, unique metadata, and no deep-legacy current recommendation. Classify Grok and FLUX queries separately in GSC analysis.

- [ ] **Step 2: Run SEO tests**

Run:

```bash
pnpm exec vitest run tests/gsc-analysis.test.ts tests/premerge-seo-routes.test.ts tests/schema-sitemap-architecture.test.ts tests/video-pages-sitemap.test.ts tests/p0-seo-link-graph.test.ts
```

- [ ] **Step 3: Update contextual linking and best-for ownership**

Add P0 models only to use-case guides supported by live Task 1 capabilities and later Task 12 evidence. Do not mass-insert all seven models into all guides. Keep every page to 2–4 contextual editorial links, avoid all-to-all grids, and preserve old LTX/Wan URLs as historical context.

- [ ] **Step 4: Update machine discovery and monitoring**

Add current P0 model/family routes and primary comparisons to `llms.txt`, labeling LTX 2.3/Wan 2.6 as previous generation and omitting deep legacy from current recommendations. Add Grok/FLUX family query patterns and model/examples/compare/pricing intent buckets to GSC analysis. Update manual timestamps only for materially changed acquisition routes.

- [ ] **Step 5: Verify canonical, hreflang, sitemap, and LLMS behavior**

Run:

```bash
pnpm exec vitest run tests/gsc-analysis.test.ts tests/premerge-seo-routes.test.ts tests/schema-sitemap-architecture.test.ts tests/video-pages-sitemap.test.ts tests/p0-seo-link-graph.test.ts
pnpm --prefix frontend run seo:check
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add frontend/config/compare-hub.json 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib' frontend/lib/seo/llms-text.ts frontend/lib/seo/gsc-analysis.ts frontend/config/sitemap-timestamps.ts tests/gsc-analysis.test.ts tests/premerge-seo-routes.test.ts tests/schema-sitemap-architecture.test.ts tests/video-pages-sitemap.test.ts tests/p0-seo-link-graph.test.ts
git commit -m "feat: strengthen p0 seo discovery graph"
```

---

## Task 12: Budget, Generate, Review, and Attach Fourteen Real Videos

**Required skill:** `maxvideoai:plan`, followed by `maxvideoai:generate` only after explicit approval.

**Files:**

- Create: `docs/model-launch/p0-video-example-pack.json`
- Create: `docs/model-launch/p0-video-example-review.md`
- Modify: `frontend/config/video-seo-editorial.ts`
- Modify: `frontend/config/sitemap-timestamps.ts`
- Mutate through existing server APIs: `videos`, `playlists`, and `playlist_items` rows for `family-{wan,ltx,grok,flux}` and `examples-{each-p0-model-slug}`
- Modify: `tests/model-examples-content-contract.test.ts`
- Modify: `tests/video-seo-editorial-contract.test.ts`
- Modify: `tests/video-sitemap-lastmod.test.ts`
- Create: `tests/p0-video-example-pack.test.ts`

- [ ] **Step 1: Re-read live MCP model details and create the comparable brief**

Use `maxvideoai:plan` to resolve the live seven-model capabilities. Define two shared 16:9, 720p, minimum-practical-duration briefs per model: one `t2v` motion/coherence brief and one `i2v` source-fidelity brief where supported. If a live contract prevents that pair, use the most representative alternate mode and record the deviation.

- [ ] **Step 2: Add a failing manifest contract**

Require exactly two accepted durable assets per model, truthful engine/mode IDs, prompt/source metadata, dimensions/duration, library asset ID, family playlist ID, model playlist ID, review status, and at least one watch-page candidate per model.

```ts
expect(acceptedByModel.get(modelId)).toHaveLength(2);
expect(watchCandidatesByModel.get(modelId)?.length).toBeGreaterThanOrEqual(1);
```

- [ ] **Step 3: Calculate and present the complete project budget**

Build one 14-line project estimate from live exact-capability scenarios, one initial attempt per line. Present base cost and a separate optional retry allowance. Stop here and obtain explicit user approval; a project estimate is not a paid-generation confirmation.

- [ ] **Step 4: Generate one attempt at a time under exact confirmation**

For each line:

1. request a fresh exact quote;
2. show the amount and scenario;
3. obtain explicit confirmation;
4. generate and wait for the final library asset;
5. review against opening readability, identity, motion, anatomy/geometry, unwanted text/watermark, and final beat;
6. accept or mark rejected.

Any failed/rejected retry gets a new quote and separate approval. Never consume the retry allowance automatically.

- [ ] **Step 5: Attach accepted assets and curate watch candidates**

Attach both accepted assets to the correct model and family playlists through the existing playlist mutations. Record the resulting durable video IDs and playlist slugs in `p0-video-example-pack.json` so database state is auditable. Only editorially approved candidates receive entries in `frontend/config/video-seo-editorial.ts` with unique watch-page title/H1/description, durable thumbnail/video URL, canonical ownership, internal links, and video-sitemap eligibility. Weak candidates remain gallery-only. Never relabel an older LTX/Wan asset as P0.

- [ ] **Step 6: Run gallery and video-search contracts**

Run:

```bash
pnpm exec vitest run tests/p0-video-example-pack.test.ts tests/model-examples-content-contract.test.ts tests/model-examples-view-model.test.ts tests/video-seo-editorial-contract.test.ts tests/video-seo-editorial-validation.test.ts tests/video-sitemap-lastmod.test.ts tests/video-pages-sitemap.test.ts
node scripts/public-media-origin-guard.mjs
git diff --check
```

- [ ] **Step 7: Commit durable manifests and approved editorial data**

```bash
git add docs/model-launch/p0-video-example-pack.json docs/model-launch/p0-video-example-review.md frontend/config/video-seo-editorial.ts frontend/config/sitemap-timestamps.ts tests/p0-video-example-pack.test.ts tests/model-examples-content-contract.test.ts tests/video-seo-editorial-contract.test.ts tests/video-sitemap-lastmod.test.ts
git commit -m "feat: add p0 video example pack"
```

Do not commit credentials, private source attachments, temporary signed URLs, or rejected output files.

---

## Task 13: Score Real Outputs and Publish Eight Scoreboard-Only Comparisons

**Files:**

- Modify: `data/benchmarks/engine-scores.v1.json`
- Modify: `data/benchmarks/engine-key-specs.v1.json`
- Create: `content/comparisons/ltx-2-3-pro-vs-ltx-2-5-pro.json`
- Create: `content/comparisons/ltx-2-3-fast-vs-ltx-2-5-fast.json`
- Create: `content/comparisons/ltx-2-5-fast-vs-ltx-2-5-pro.json`
- Create: `content/comparisons/wan-2-6-vs-wan-3.json`
- Create: `content/comparisons/wan-3-vs-wan-3-prime.json`
- Create: `content/comparisons/flux-3-vs-flux-3-draft.json`
- Create: `content/comparisons/grok-imagine-video-1-5-vs-sora-2.json`
- Create: `content/comparisons/flux-3-vs-grok-imagine-video-1-5.json`
- Modify: `frontend/config/compare-config.json`
- Modify: `frontend/config/compare-hub.json`
- Modify: `frontend/config/model-registry.json`
- Modify: `tests/comparison-content-contract.test.ts`
- Modify: `tests/video-seo-canonical-slugs.test.ts`
- Create: `tests/p0-scoreboard-comparisons.test.ts`

- [ ] **Step 1: Add failing score completeness and presentation tests**

Require eleven numeric editorial criteria per P0 model and verify:

```ts
overall === roundToOneDecimal(mean([fidelity, motion, consistency]));
```

Require the eight approved pairs, canonicalized by the existing comparison-slug helper, complete EN/FR/ES decision copy, registry relationships, and membership in `scoreboardOnlyComparisons`. Assert there is no showdown playlist or side-by-side media block.

- [ ] **Step 2: Run score/comparison tests**

Run:

```bash
pnpm exec vitest run tests/p0-scoreboard-comparisons.test.ts tests/comparison-content-contract.test.ts tests/video-seo-canonical-slugs.test.ts
```

- [ ] **Step 3: Review the fourteen accepted outputs with the repository rubric**

Score fidelity, motion, consistency, anatomy, text rendering, lip-sync quality, sequencing, controllability, speed/stability, visual quality, and pricing. Use the design priors only as calibration prompts; never publish a prior as an unreviewed value. Record concise evidence in `docs/model-launch/p0-video-example-review.md`.

- [ ] **Step 4: Author exact specs and eight comparison documents**

Publish only these intents:

- LTX 2.5 Pro vs LTX 2.3 Pro;
- LTX 2.5 Fast vs LTX 2.3 Fast;
- LTX 2.5 Pro vs LTX 2.5 Fast;
- Wan 3 vs Wan 2.6;
- Wan 3 Prime vs Wan 3;
- FLUX 3 vs FLUX 3 Draft;
- Grok Imagine Video 1.5 vs Sora 2;
- Grok Imagine Video 1.5 vs FLUX 3.

Use and test the canonical helper even though the eight canonical filenames are fixed above. Add suggested opponents and published pair IDs only for these routes; do not create a combinatorial matrix.

- [ ] **Step 5: Verify scores, locale content, indexation, and no-showdown policy**

Run:

```bash
pnpm exec vitest run tests/p0-scoreboard-comparisons.test.ts tests/comparison-content-contract.test.ts tests/video-seo-canonical-slugs.test.ts tests/premerge-seo-routes.test.ts tests/video-pages-sitemap.test.ts
pnpm model:registry:generate
pnpm model:registry:check
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add data/benchmarks content/comparisons frontend/config/model-registry.json frontend/config/compare-hub.json frontend/config/compare-config.json tests/p0-scoreboard-comparisons.test.ts tests/comparison-content-contract.test.ts tests/video-seo-canonical-slugs.test.ts docs/model-launch/p0-video-example-review.md frontend/config/model-runtime.json frontend/config/engine-catalog.json frontend/config/model-roster.json docs/model-roster.json docs/model-roster.csv
git commit -m "feat: score p0 video comparisons"
```

---

## Task 14: Atomically Publish the Complete P0 Graph

**Files:**

- Modify: `frontend/config/model-registry.json`
- Modify: `frontend/config/model-families.ts`
- Modify: `frontend/config/navigation.ts`
- Modify: `frontend/config/sitemap-timestamps.ts`
- Modify: `frontend/lib/seo/llms-text.ts`
- Modify: any homepage/example promotion maps intentionally delayed until accepted assets
- Modify: `tests/model-page-publication.test.ts`
- Modify: `tests/model-registry-parity.test.ts`
- Modify: `tests/marketing-navigation.test.ts`
- Modify: `tests/premerge-seo-routes.test.ts`
- Create: `tests/p0-launch-readiness.test.ts`

- [ ] **Step 1: Add one failing atomic readiness test**

For every P0 registry ID, require before public flags may be true:

- executable engine and exact mode details;
- canonical billing/public pricing parity;
- EN/FR/ES model content;
- two accepted durable videos and family/model playlist attachment;
- one approved watch candidate or an explicit gallery-only editorial decision;
- complete score cells;
- all declared comparison documents;
- model/family/pricing/compare inbound links;
- MCP catalog/detail/recommendation parity;
- canonical/hreflang/sitemap eligibility.

- [ ] **Step 2: Run readiness test and fix only missing prerequisites**

Run:

```bash
pnpm exec vitest run tests/p0-launch-readiness.test.ts
```

Expected: it identifies any incomplete prerequisite before flags change. Do not waive the gate by weakening assertions.

- [ ] **Step 3: Flip registry and family publication atomically**

Publish all seven current models to model/examples/compare/app/pricing/sitemap as appropriate. Enable Grok/FLUX indexed family pages and evidence-backed homepage/example promotion. Keep LTX 2.3 and Wan 2.6 published/indexable/executable but legacy and not recommended by default. Keep LTX 2.0 and Wan 2.5 self-canonical/indexable transition pages but deep legacy and absent from current app/pricing/navigation. Add no redirect.

- [ ] **Step 4: Regenerate projections and verify the complete public graph**

Run:

```bash
pnpm model:registry:generate
pnpm model:registry:check
pnpm exec vitest run tests/p0-launch-readiness.test.ts tests/model-page-publication.test.ts tests/model-registry-parity.test.ts tests/marketing-navigation.test.ts tests/premerge-seo-routes.test.ts tests/mcp-p0-video-parity.test.ts tests/p0-seo-link-graph.test.ts
pnpm --prefix frontend run seo:check
git diff --check
```

- [ ] **Step 5: Commit the atomic publication**

```bash
git add frontend/config frontend/lib/seo/llms-text.ts 'frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/constants.ts' 'frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-data.ts' frontend/lib/examples tests/p0-launch-readiness.test.ts tests/model-page-publication.test.ts tests/model-registry-parity.test.ts tests/marketing-navigation.test.ts tests/premerge-seo-routes.test.ts docs/model-roster.json docs/model-roster.csv
git commit -m "feat: publish p0 video model refresh"
```

---

## Task 15: Full Verification, Smoke Test, and Search Console Monitoring Handoff

**Files:**

- Modify: `docs/model-launch/p0-video-model-family-refresh.md`
- Create: `docs/model-launch/p0-video-post-launch-monitoring.md`

- [ ] **Step 1: Run focused architecture and contract suites**

Run:

```bash
pnpm exec vitest run tests/p0-video-engine-contracts.test.ts tests/p0-video-request-bodies.test.ts tests/p0-video-validation.test.ts tests/p0-video-workspace.test.ts tests/p0-video-pricing-parity.test.ts tests/p0-model-family-contract.test.ts tests/mcp-p0-video-parity.test.ts tests/p0-model-page-seo-content.test.ts tests/p0-pricing-discovery.test.ts tests/p0-marketing-discovery.test.ts tests/p0-seo-link-graph.test.ts tests/p0-video-example-pack.test.ts tests/p0-scoreboard-comparisons.test.ts tests/p0-launch-readiness.test.ts
```

- [ ] **Step 2: Run repository-wide release gates**

Run:

```bash
pnpm model:registry:check
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
pnpm test:validate
pnpm --prefix frontend run i18n:check
pnpm --prefix frontend run seo:check
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm --prefix frontend run lint
pnpm --prefix frontend run build
git diff --check
```

Expected: all gates pass. If the repository requires Node 22, rerun final gates under the declared Node version rather than accepting a version-warning result.

- [ ] **Step 3: Smoke-test public and authenticated surfaces locally**

Verify at minimum:

- all seven model pages in EN plus representative FR/ES pages;
- `/examples/ltx`, `/examples/wan`, `/examples/grok`, `/examples/flux`;
- all eight canonical comparison routes;
- `/models`, `/pricing`, `/pay-as-you-go-ai-video-generator`, homepage, header, and footer;
- workspace mode switching and one dry-run/preflight scenario for each special mode;
- MCP `list_models`, exact legacy/deep-legacy lookup, details, recommendation, project budget, prepare, and non-paid validation flows.

Inspect page source or response data for self-canonical, reciprocal hreflang, JSON-LD, sitemap membership, lifecycle labels, pricing source, and internal links. Confirm no P0 comparison renders a showdown block.

- [ ] **Step 4: Capture launch monitoring baselines**

In `docs/model-launch/p0-video-post-launch-monitoring.md`, create Day 0, 7, 14, and 28 sections for LTX, Wan, Grok, and FLUX, split by model, examples, comparison, pricing, and generic query intent. Record indexed state, clicks, impressions, CTR, average position, canonical selection, and coverage errors. Do not schedule or implement a redirect now.

- [ ] **Step 5: Define the 28-day redirect review gate**

Document that LTX 2.0 or Wan redirects may be proposed only after the destination is indexed, self-canonical, internally linked, in the sitemap, operationally stable, and observed for one complete 28-day window. Any future redirect must be same-locale, one-hop, chain-free, server-side, and retained for at least one year.

- [ ] **Step 6: Commit verification evidence**

```bash
git add docs/model-launch/p0-video-model-family-refresh.md docs/model-launch/p0-video-post-launch-monitoring.md
git commit -m "docs: record p0 video launch verification"
```

---

## Completion Criteria

The plan is complete only when all fifteen tasks are checked, the final build and SEO suite pass, all seven model identities are consistent across runtime/app/marketing/pricing/MCP, all fourteen accepted videos are durable and attached, all eight scoreboards contain reviewed numeric scores without showdown media, and no existing LTX/Wan SEO URL has been unnecessarily removed or redirected.
