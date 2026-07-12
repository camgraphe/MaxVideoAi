# Pricing Parity and Policy Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze every current pricing output, introduce one validated versioned policy contract and deterministic resolver, and prove a new canonical `@maxvideoai/pricing` quote path in shadow mode without changing any billed or displayed price.

**Architecture:** `@maxvideoai/pricing` owns pure policy validation, rule precedence, canonical commercial math, compatibility profiles, and quote comparison. Provider and surface adapters remain in the frontend and supply factual cost inputs. Database loading stays server-only. Existing billing, marketing, estimator, model-page, JSON-LD, audio, and tool consumers remain authoritative throughout this batch; the new path is exercised only by tests and the audit command.

**Tech Stack:** TypeScript, Next.js App Router, Node `node:test`, `tsx`, JSON versioned configuration, Neon/Postgres read access through the existing pricing rule store, pnpm.

## Global Constraints

- Preserve every current amount at integer-cent precision. Do not alter rates, margins, surcharges, discounts, currencies, duration normalization, rounding, or formatted-price inputs.
- Do not switch a production consumer to the canonical quote in this batch.
- Do not modify `/admin/pricing`, its route handlers, or mutation behavior in this batch.
- Do not add a database migration. The optional `mode` selector exists in the normalized contract, but database rows continue to resolve with their current `engine_id` and `resolution` fields until the admin-cockpit subproject.
- Do not delete or simplify legacy formulas yet. They are the reference implementation used to freeze the baseline.
- Do not make database availability a prerequisite for tests, builds, or public fallback policy.
- Use `apply_patch` for authored edits. Use the baseline generator only for the generated fixture.
- Run focused tests after each task. Run the complete verification gate only after all focused tests pass.
- If a current cross-surface discrepancy is found, preserve it with a named compatibility profile and an explicit fixture change. Do not reconcile it silently.

---

## File Structure

### New files

- `docs/engineering/pricing-engine.md` — current consumer inventory, ownership boundaries, baseline workflow, and the explicit “shadow only” status of this batch.
- `frontend/config/pricing-policy.json` — versioned commercial defaults and named compatibility profiles; no provider base costs.
- `packages/pricing/src/policy.ts` — shared policy types, validation, ambiguity checks, and deterministic DB/versioned precedence.
- `packages/pricing/src/canonical.ts` — normalized factual input, canonical quote output, typed domain errors, and pure commercial calculation.
- `packages/pricing/src/shadow.ts` — cent-level comparison and audit-row construction.
- `frontend/src/lib/pricing-policy-defaults.ts` — imports and validates the committed JSON policy once, with no database dependency.
- `frontend/server/pricing/resolve-pricing-policy.ts` — server-only combination of database overrides and versioned rules, including structured fallback warning.
- `frontend/src/lib/pricing-audit/types.ts` — scenario, frozen-output, and matrix contracts.
- `frontend/src/lib/pricing-audit/scenarios.ts` — deterministic scenario expansion from the live engine catalog plus explicit audio/tool/structured-data cases.
- `frontend/src/lib/pricing-audit/legacy-collectors.ts` — adapters that call the current authoritative paths.
- `frontend/src/lib/pricing-audit/canonical-facts.ts` — provider-fact adapters for standard, specialized, audio, tool, and public compatibility scenarios.
- `frontend/src/lib/pricing-audit/canonical-collectors.ts` — policy resolution plus canonical quote collection; never imported by production consumers.
- `frontend/src/lib/pricing-audit/matrix.ts` — joins frozen and canonical rows and enforces audit failure rules.
- `scripts/pricing-baseline.ts` — deterministic baseline check/write command.
- `scripts/pricing-audit.ts` — no-mutation human/JSON audit command.
- `tests/fixtures/pricing-parity.v1.json` — generated, committed current-output baseline.
- `tests/pricing-consumer-inventory.test.ts` — protects scenario coverage for all known pricing owners.
- `tests/pricing-policy.test.ts` — policy validation, ambiguity, precedence, provenance, and DB fallback contracts.
- `tests/pricing-canonical-kernel.test.ts` — standard math, rounding, surcharge, discount, and error contracts.
- `tests/pricing-shadow.test.ts` — baseline and compatibility-profile parity.
- `tests/pricing-foundation-architecture.test.ts` — protects server/browser boundaries and forbids production adoption in this batch.

### Existing files changed

- `packages/pricing/src/index.ts` — exports the new pure policy, canonical, and shadow contracts.
- `frontend/src/lib/pricing-rule-store.ts` — exposes a non-breaking normalized override loader while preserving `loadPricingRules()` and `selectPricingRuleForBilling()` exactly for current consumers.
- `frontend/src/lib/pricing-rules.ts`, `frontend/components/marketing/PriceEstimator.tsx`, and `frontend/components/marketing/PriceChip.tsx` — extract and reuse their existing rule-to-definition adjustment so the baseline collector calls the same pure function; rendered behavior and authority stay unchanged.
- `frontend/src/lib/audio-generation.ts` — exports the already-existing vendor-cost assembly as factual input while preserving `buildAudioPricingSnapshot()` output.
- Current model-schema and tool-pricing modules — export existing pure price builders only where the baseline collector needs access; bodies and production call sites stay unchanged.
- `package.json` — adds `pricing:baseline`, `pricing:baseline:generate`, and `pricing:audit` commands.
- `docs/engineering/llm-working-guide.md` — points future pricing work to the canonical guide and verification commands.

### Production authority and call sites that stay unchanged

These modules remain authoritative and keep their existing production call graph. A minimal pure-helper extraction or export is permitted only when the legacy collector needs to invoke the exact current behavior; no formula may be rewritten during that extraction.

- `frontend/src/lib/pricing.ts`
- `frontend/src/lib/pricing-specialized-snapshots.ts`
- `frontend/src/lib/audio-generation.ts`
- `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts`
- `frontend/components/marketing/PriceEstimator.tsx`
- `frontend/components/marketing/PriceChip.tsx`
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing.ts`
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts`
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts`
- `frontend/app/(core)/admin/pricing/**`
- `frontend/app/api/admin/pricing/**`

---

### Task 1: Freeze the pricing-owner inventory and scenario coverage

**Files:**

- Create: `docs/engineering/pricing-engine.md`
- Create: `frontend/src/lib/pricing-audit/types.ts`
- Create: `frontend/src/lib/pricing-audit/scenarios.ts`
- Create: `tests/pricing-consumer-inventory.test.ts`
- Modify: `docs/engineering/llm-working-guide.md`

- [ ] **Step 1: Write the failing inventory test**

Create `tests/pricing-consumer-inventory.test.ts` with a table of required owner paths and required scenario surfaces:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { buildPricingAuditScenarios } from '../frontend/src/lib/pricing-audit/scenarios.ts';

const requiredOwners = [
  'frontend/src/lib/pricing.ts',
  'frontend/src/lib/pricing-specialized-snapshots.ts',
  'frontend/src/lib/audio-generation.ts',
  'frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts',
  'frontend/components/marketing/PriceEstimator.tsx',
  'frontend/components/marketing/PriceChip.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing.ts',
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts',
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts',
] as const;

test('pricing audit inventory names every current pricing owner', () => {
  const guide = readFileSync('docs/engineering/pricing-engine.md', 'utf8');
  for (const path of requiredOwners) {
    assert.equal(existsSync(path), true, `${path} should exist`);
    assert.match(guide, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('pricing audit scenarios cover every required surface', () => {
  const surfaces = new Set(buildPricingAuditScenarios().map((row) => row.surface));
  for (const surface of ['billing', 'pricing-hub', 'estimator', 'price-chip', 'model-page', 'json-ld', 'audio', 'tool']) {
    assert.equal(surfaces.has(surface), true, `${surface} should have at least one scenario`);
  }
});
```

- [ ] **Step 2: Run the inventory test and confirm it fails**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-consumer-inventory.test.ts
```

Expected: FAIL because the guide and pricing-audit modules do not exist.

- [ ] **Step 3: Define the audit contracts**

Create `frontend/src/lib/pricing-audit/types.ts` with exact discriminated contracts:

```ts
export type PricingAuditSurface =
  | 'billing'
  | 'pricing-hub'
  | 'estimator'
  | 'price-chip'
  | 'model-page'
  | 'json-ld'
  | 'audio'
  | 'tool';

export type PricingAuditScenario = {
  id: string;
  surface: PricingAuditSurface;
  engineId: string;
  mode?: string;
  resolution?: string;
  durationSec?: number;
  membershipTier?: 'member' | 'plus' | 'pro';
  equivalenceKey?: string;
  compatibilityProfile?: string;
  input: Record<string, boolean | number | string | null>;
};

export type FrozenPricingOutput = {
  scenarioId: string;
  surface: PricingAuditSurface;
  currency: string;
  vendorSubtotalCents: number;
  marginCents: number;
  surchargeCents: number;
  customerTotalCents: number;
  unit: string;
  quantity: number;
  displayedAmount?: string;
  structuredDataAmount?: string;
  equivalenceKey?: string;
  compatibilityProfile?: string;
};
```

- [ ] **Step 4: Build a deterministic scenario registry**

Implement `buildPricingAuditScenarios()` in `scenarios.ts` so it:

1. expands all estimator-enabled video and image entries from `listFalEngines()` using their supported default/min/max duration and resolution cases;
2. adds `member`, `plus`, and `pro` cases for standard billing;
3. adds explicit specialized cases for Luma Agents, Luma Ray 3.2 generate/edit/reframe, Luma Ray 2 generate/edit/reframe, Seedance 2 token pricing, and GPT Image 2 size/quality;
4. expands every `VIDEO_PRICE_PRESETS` pricing-hub preset and representative image pricing-hub presets;
5. adds estimator and price-chip cases for default plus one addon-bearing engine;
6. adds model decision-price and JSON-LD cases for a standard engine and each specialized family;
7. adds every audio pack at boundary durations and each billed tool product;
8. sorts by `surface`, then `engineId`, then `id` and rejects duplicate IDs.

Use only catalog/config facts. Do not call the database and do not calculate totals in this module.

- [ ] **Step 5: Document the current owners and batch boundary**

Create `docs/engineering/pricing-engine.md` with:

- the complete owner table (path, current responsibility, current authority, intended destination);
- the rule `provider facts → resolved commercial policy → @maxvideoai/pricing → presentation`;
- current resolver precedence and target precedence;
- the exact baseline/audit commands;
- a prominent status note that production consumers remain legacy-authoritative in this batch;
- a rule that price-policy edits require an intentional baseline diff in a later price-change workflow.

Add the guide to `docs/engineering/llm-working-guide.md` under “Start Here”.

- [ ] **Step 6: Re-run the focused test**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-consumer-inventory.test.ts
```

Expected: PASS with no duplicate scenario IDs and all eight surfaces covered.

- [ ] **Step 7: Commit the inventory**

```bash
git add docs/engineering/pricing-engine.md docs/engineering/llm-working-guide.md frontend/src/lib/pricing-audit/types.ts frontend/src/lib/pricing-audit/scenarios.ts tests/pricing-consumer-inventory.test.ts
git commit -m "test: inventory pricing consumers"
```

---

### Task 2: Generate and lock the legacy pricing baseline

**Files:**

- Create: `frontend/src/lib/pricing-audit/legacy-collectors.ts`
- Create: `scripts/pricing-baseline.ts`
- Create: `tests/fixtures/pricing-parity.v1.json`
- Create: `tests/pricing-shadow.test.ts`
- Modify: `frontend/src/lib/pricing-rules.ts`
- Modify: `frontend/components/marketing/PriceEstimator.tsx`
- Modify: `frontend/components/marketing/PriceChip.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts`
- Modify: current tool-pricing modules only where an existing pure builder must be exported
- Modify: `package.json`

- [ ] **Step 1: Write the failing baseline determinism test**

Start `tests/pricing-shadow.test.ts` with:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { collectLegacyPricingOutputs } from '../frontend/src/lib/pricing-audit/legacy-collectors.ts';

test('committed pricing baseline exactly matches current authoritative outputs', async () => {
  const current = await collectLegacyPricingOutputs();
  const frozen = JSON.parse(readFileSync('tests/fixtures/pricing-parity.v1.json', 'utf8'));
  assert.deepEqual(current, frozen.rows);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-shadow.test.ts
```

Expected: FAIL because the collector and fixture do not exist.

- [ ] **Step 3: Implement isolated current-path collectors**

Implement one collector per `PricingAuditSurface` in `legacy-collectors.ts`. Each collector must call the current owner instead of copying its formula:

- billing: current kernel/specialized snapshot builders with an explicit in-memory current rule;
- pricing hub: `getPresetQuote()` and `getImagePresetQuote()`;
- estimator and price chip: extract `applyPricingRuleToDefinition()` into `frontend/src/lib/pricing-rules.ts`, make both components call it, and make the collector use that same function with the current `computePricingSnapshot()`;
- model page: current model-page decision-pricing and schema helpers;
- JSON-LD: extract the returned offer value from the current schema builder;
- audio: `buildAudioPricingSnapshot()`;
- tools: the current pure pricing builders used by angle, upscale, and background removal.

If a current helper is not exported, export the existing pure helper without changing its body. The only permitted call-site edit is replacing the estimator/chip inline rule merge with the extracted byte-equivalent `applyPricingRuleToDefinition()` helper. Add focused assertions that the helper returns the exact former object fields before generating the fixture.

Normalize each result to `FrozenPricingOutput`. Give economically equivalent cross-surface cases the same `equivalenceKey`. Export `findUnprofiledCrossSurfaceDifferences()` to group those rows, detect different totals, and reject a differing non-reference row without an explicit compatibility profile. Reject non-finite or negative cent fields immediately. Sort all rows by `scenarioId`.

- [ ] **Step 4: Add check/write commands**

Implement `scripts/pricing-baseline.ts` so the default mode compares generated output with the committed fixture and `--write` is required to update it. Add:

```json
{
  "pricing:baseline": "tsx --tsconfig frontend/tsconfig.json scripts/pricing-baseline.ts",
  "pricing:baseline:generate": "tsx --tsconfig frontend/tsconfig.json scripts/pricing-baseline.ts --write"
}
```

The fixture root must be:

```json
{
  "version": 1,
  "generatedFrom": "legacy-authoritative-pricing-paths",
  "rows": []
}
```

Do not include timestamps, environment paths, database values, localized dates, or nondeterministic ordering.

- [ ] **Step 5: Generate the initial baseline once**

Run:

```bash
pnpm pricing:baseline:generate
pnpm pricing:baseline
```

Expected: the first command writes the fixture; the second prints the exact row count and exits 0.

- [ ] **Step 6: Run the baseline regression test**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-shadow.test.ts
```

Expected: PASS.

- [ ] **Step 7: Review the frozen differences before proceeding**

Run:

```bash
git diff -- tests/fixtures/pricing-parity.v1.json
```

Verify that differing current outputs remain separate rows by surface. Record every intentional cross-surface difference in the guide; do not normalize them.

- [ ] **Step 8: Commit the frozen baseline**

```bash
git add package.json frontend/src/lib/pricing-audit/legacy-collectors.ts scripts/pricing-baseline.ts tests/fixtures/pricing-parity.v1.json tests/pricing-shadow.test.ts docs/engineering/pricing-engine.md
git commit -m "test: freeze pricing output baseline"
```

---

### Task 3: Add the shared policy contract and versioned defaults

**Files:**

- Create: `packages/pricing/src/policy.ts`
- Create: `frontend/config/pricing-policy.json`
- Create: `frontend/src/lib/pricing-policy-defaults.ts`
- Create: `tests/pricing-policy.test.ts`
- Modify: `packages/pricing/src/index.ts`

- [ ] **Step 1: Write failing policy-validation tests**

Cover these exact cases in `tests/pricing-policy.test.ts`:

```ts
test('committed pricing policy validates and keeps current global defaults', () => {
  const policy = getVersionedPricingPolicy();
  assert.equal(policy.version, 1);
  assert.deepEqual(policy.rules.find((rule) => rule.id === 'default'), {
    id: 'default',
    marginPercent: 0.3,
    marginFlatCents: 0,
    surchargeAudioPercent: 0.2,
    surchargeUpscalePercent: 0.5,
    currency: 'USD',
  });
});

test('policy validation rejects non-finite, negative, unknown, duplicate, and ambiguous rules', () => {
  // Assert PricingPolicyValidationError codes for each invalid document.
});
```

Also assert that an unknown engine/mode/resolution and unknown compatibility-profile reference fail validation when catalog references are supplied.

- [ ] **Step 2: Run the tests and confirm failure**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-policy.test.ts
```

Expected: FAIL because policy contracts do not exist.

- [ ] **Step 3: Implement the shared policy schema and validator**

Define these public types in `packages/pricing/src/policy.ts`:

```ts
export type PricingPolicyRule = {
  id: string;
  engineId?: string;
  mode?: string;
  resolution?: string;
  marginPercent: number;
  marginFlatCents: number;
  surchargeAudioPercent: number;
  surchargeUpscalePercent: number;
  currency: string;
  compatibilityProfile?: string;
};

export type PricingCompatibilityProfile = {
  id: string;
  vendorSubtotalRounding: 'nearest' | 'up' | 'down' | 'preserve';
  marginRounding: 'nearest' | 'up' | 'down';
  surchargeRounding: 'nearest' | 'up' | 'down';
  discountRounding: 'nearest' | 'up' | 'down';
  totalRounding: 'nearest' | 'up' | 'down';
};

export type PricingPolicyDocument = {
  version: 1;
  supportedCurrencies: string[];
  compatibilityProfiles: PricingCompatibilityProfile[];
  rules: PricingPolicyRule[];
};
```

Implement `validatePricingPolicyDocument(input, references)` and `PricingPolicyValidationError`. Validation must reject:

- missing or unsupported version;
- empty/duplicate IDs;
- non-finite or negative commercial numbers;
- non-integer or negative flat cents;
- unsupported currency;
- unknown catalog references;
- duplicate selectors at the same source/precedence;
- unknown compatibility profile.

Return a deeply cloned, normalized document; never mutate the input.

- [ ] **Step 4: Add the committed default policy**

Create `frontend/config/pricing-policy.json` with the current global defaults and only compatibility profiles proven necessary by Task 2. The base document starts with:

```json
{
  "version": 1,
  "supportedCurrencies": ["USD"],
  "compatibilityProfiles": [
    {
      "id": "standard",
      "vendorSubtotalRounding": "preserve",
      "marginRounding": "up",
      "surchargeRounding": "up",
      "discountRounding": "nearest",
      "totalRounding": "nearest"
    }
  ],
  "rules": [
    {
      "id": "default",
      "marginPercent": 0.3,
      "marginFlatCents": 0,
      "surchargeAudioPercent": 0.2,
      "surchargeUpscalePercent": 0.5,
      "currency": "USD"
    }
  ]
}
```

Add explicit rules only where the baseline proves a current policy difference, such as the existing audio margin. Every such rule must name a compatibility profile and be explained in the pricing guide.

- [ ] **Step 5: Add the validated frontend facade and exports**

`frontend/src/lib/pricing-policy-defaults.ts` imports the JSON and validates it against engine IDs, modes, and resolutions from the current catalog. Export only:

```ts
export function getVersionedPricingPolicy(): PricingPolicyDocument;
```

Return a defensive clone. Export policy contracts and validator from `packages/pricing/src/index.ts`.

- [ ] **Step 6: Re-run policy and baseline tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-policy.test.ts tests/pricing-shadow.test.ts
pnpm pricing:baseline
```

Expected: PASS, and the baseline fixture remains byte-for-byte unchanged.

- [ ] **Step 7: Commit policy validation**

```bash
git add packages/pricing/src/policy.ts packages/pricing/src/index.ts frontend/config/pricing-policy.json frontend/src/lib/pricing-policy-defaults.ts tests/pricing-policy.test.ts docs/engineering/pricing-engine.md
git commit -m "feat: add validated pricing policy defaults"
```

---

### Task 4: Normalize database overrides and implement one resolver

**Files:**

- Modify: `frontend/src/lib/pricing-rule-store.ts`
- Create: `frontend/server/pricing/resolve-pricing-policy.ts`
- Modify: `tests/pricing-policy.test.ts`
- Modify: `tests/pricing-architecture.test.ts`

- [ ] **Step 1: Add failing precedence and fallback tests**

Add tests for the binding order:

```text
precise DB → engine DB → global DB → precise versioned → engine versioned → global versioned
```

Use a scenario containing `engineId`, `mode`, and `resolution`. Assert all four provenance fields:

```ts
{
  source: 'database',
  matchedBy: 'precise',
  sourceRuleId: 'db-kling-1080p',
  rule: expectedRule
}
```

Also test:

- an empty DB override list uses versioned rules;
- a DB-load failure uses versioned rules and emits one structured `pricing_policy_db_fallback` warning;
- duplicate selectors at the same source fail rather than selecting by array order;
- current `selectPricingRuleForBilling()` still returns its exact historical result.

- [ ] **Step 2: Run focused tests and confirm failure**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-policy.test.ts tests/pricing-architecture.test.ts
```

Expected: FAIL on the new resolver contracts.

- [ ] **Step 3: Implement the pure precedence resolver in the shared package**

Add to `packages/pricing/src/policy.ts`:

```ts
export type PricingPolicyScenario = {
  engineId: string;
  mode?: string;
  resolution?: string;
};

export type ResolvedPricingPolicy = {
  rule: PricingPolicyRule;
  source: 'database' | 'versioned';
  matchedBy: 'precise' | 'engine' | 'global';
  sourceRuleId: string;
};

export function resolvePricingPolicy(input: {
  scenario: PricingPolicyScenario;
  databaseRules: PricingPolicyRule[];
  versionedRules: PricingPolicyRule[];
}): ResolvedPricingPolicy;
```

“Precise” means the most-specific selector containing `engineId` plus every supplied optional selector on the rule. Within a source, specificity is deterministic: engine+mode+resolution, engine+resolution, engine+mode, engine, global. Equal selectors are an ambiguity error.

- [ ] **Step 4: Add a non-breaking database override loader**

Keep `loadPricingRules()` and `selectPricingRuleForBilling()` behavior unchanged. Add:

```ts
export type PricingPolicyOverrideLoadResult =
  | { status: 'loaded'; rules: PricingPolicyRule[] }
  | { status: 'unavailable'; rules: []; errorCode: 'pricing_rules_query_failed' };

export async function loadPricingPolicyOverrides(): Promise<PricingPolicyOverrideLoadResult>;
```

Reuse the current row normalization. Map database rules into the shared policy contract. Do not insert the versioned fallback into the returned DB list, because that would misreport provenance.

- [ ] **Step 5: Add the server-only resolver facade**

`frontend/server/pricing/resolve-pricing-policy.ts` must:

1. load the validated versioned document;
2. call `loadPricingPolicyOverrides()`;
3. call the shared `resolvePricingPolicy()`;
4. emit one structured warning when the load result is `unavailable`;
5. return versioned provenance on fallback.

Inject the warning sink in tests so assertions do not depend on global console interception.

- [ ] **Step 6: Re-run focused tests and typecheck**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-policy.test.ts tests/pricing-architecture.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
```

Expected: PASS. Existing pricing consumers still import `loadPricingRules()` and `selectPricingRuleForBilling()`.

- [ ] **Step 7: Commit the resolver**

```bash
git add packages/pricing/src/policy.ts frontend/src/lib/pricing-rule-store.ts frontend/server/pricing/resolve-pricing-policy.ts tests/pricing-policy.test.ts tests/pricing-architecture.test.ts
git commit -m "feat: resolve pricing policy with provenance"
```

---

### Task 5: Extend `@maxvideoai/pricing` with the canonical pure quote

**Files:**

- Create: `packages/pricing/src/canonical.ts`
- Create: `tests/pricing-canonical-kernel.test.ts`
- Modify: `packages/pricing/src/index.ts`

- [ ] **Step 1: Write failing canonical-kernel tests**

Test at minimum:

- per-second factual subtotal with preserved fractional cents;
- per-image and flat quantity;
- percentage margin plus flat cents;
- audio and upscale surcharge selection;
- `member`, `plus`, and `pro` discount ordering;
- each compatibility rounding mode at a half-cent and just-below-cent boundary;
- negative/non-finite facts;
- currency mismatch;
- unsupported surcharge key;
- deterministic provenance copied into the quote.

Assert integers for every public cent field.

- [ ] **Step 2: Run the test and confirm failure**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-canonical-kernel.test.ts
```

Expected: FAIL because the canonical module is absent.

- [ ] **Step 3: Implement exact canonical contracts**

Define in `packages/pricing/src/canonical.ts`:

```ts
export type PricingFacts = {
  engineId: string;
  currency: string;
  vendorSubtotalExactCents: number;
  unit: string;
  quantity: number;
  metadata?: Record<string, unknown>;
};

export type PricingScenario = {
  id: string;
  engineId: string;
  mode?: string;
  resolution?: string;
  membershipTier: 'member' | 'plus' | 'pro';
  discountPercent: number;
  surcharge?: 'audio' | 'upscale';
};

export type CanonicalPricingQuote = {
  engineId: string;
  scenarioId: string;
  currency: string;
  vendorSubtotalCents: number;
  marginCents: number;
  surchargeCents: number;
  discountCents: number;
  customerTotalCents: number;
  platformFeeCents: number;
  vendorShareCents: number;
  unit: string;
  quantity: number;
  breakdown: {
    vendorSubtotalExactCents: number;
    marginPercent: number;
    marginFlatCents: number;
    surchargePercent: number;
    discountPercent: number;
  };
  policyProvenance: {
    source: 'database' | 'versioned';
    matchedBy: 'precise' | 'engine' | 'global';
    sourceRuleId: string;
    compatibilityProfile: string;
  };
};
```

Export:

```ts
export function quoteCanonicalPricing(input: {
  facts: PricingFacts;
  scenario: PricingScenario;
  policy: ResolvedPricingPolicy;
  compatibilityProfile: PricingCompatibilityProfile;
}): CanonicalPricingQuote;
```

All rounding occurs through one internal `roundCents()` helper selected by the compatibility profile. Throw typed `PricingDomainError` values with stable codes; never return `NaN`, infinity, a negative total, or an invented fallback price.

- [ ] **Step 4: Export the canonical API**

Export the new types, `PricingDomainError`, and `quoteCanonicalPricing()` from `packages/pricing/src/index.ts`. Do not change the existing `computePricingSnapshot()` export.

- [ ] **Step 5: Run kernel, policy, and legacy baseline tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-canonical-kernel.test.ts tests/pricing-policy.test.ts tests/pricing-shadow.test.ts
pnpm pricing:baseline
```

Expected: PASS; no fixture diff.

- [ ] **Step 6: Commit the canonical kernel**

```bash
git add packages/pricing/src/canonical.ts packages/pricing/src/index.ts tests/pricing-canonical-kernel.test.ts
git commit -m "feat: add canonical pricing quote kernel"
```

---

### Task 6: Map provider facts and run canonical quotes in shadow mode

**Files:**

- Create: `frontend/src/lib/pricing-audit/canonical-facts.ts`
- Create: `frontend/src/lib/pricing-audit/canonical-collectors.ts`
- Create: `packages/pricing/src/shadow.ts`
- Modify: `packages/pricing/src/index.ts`
- Modify: `tests/pricing-shadow.test.ts`

- [ ] **Step 1: Add failing full-matrix parity tests**

Extend `tests/pricing-shadow.test.ts`:

```ts
test('canonical shadow quotes match every frozen current output', async () => {
  const matrix = await buildPricingAuditMatrix();
  assert.equal(matrix.rows.length > 0, true);
  assert.deepEqual(
    matrix.rows.filter((row) => row.status !== 'match'),
    []
  );
});

test('every cross-surface compatibility difference is explicitly named', async () => {
  const current = await collectLegacyPricingOutputs();
  assert.deepEqual(findUnprofiledCrossSurfaceDifferences(current), []);
});
```

- [ ] **Step 2: Run the test and confirm failure**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-shadow.test.ts
```

Expected: FAIL because canonical collectors and comparison do not exist.

- [ ] **Step 3: Implement provider-fact adapters without commercial math**

In `canonical-facts.ts`, map each audit scenario to `PricingFacts` using factual sources only:

- standard video/image: `buildPricingDefinition()` plus base, resolution, duration, and factual addon rates;
- Luma Agents and Ray 3.2: existing `calculateLumaAgentsImageReferencePrice()`, `calculateLumaRay32ReferencePrice()`, and `calculateLumaRay32DirectPrice()` outputs;
- Luma Ray 2: existing `calculateLumaRay2Price()` and `calculateLumaRay2EditPrice()` outputs;
- Seedance 2: `computeSeedance2TokenQuote()` vendor subtotal;
- GPT Image 2: `resolveGptImage2PricingTier()` factual tier;
- audio: expose a pure `buildAudioVendorCostFacts()` from the existing audio module by moving only the already-present vendor-component assembly, leaving `buildAudioPricingSnapshot()` output unchanged;
- tools: existing billing product/vendor fact builders;
- public compatibility rows: the same provider facts with the surface’s named compatibility profile.

The adapters must not import `DISPLAY_PRICE_MARGIN_PERCENT`, `AUDIO_PRICING_MARGIN_PERCENT`, `computeRoundedUpMarginCents`, or any consumer-local margin helper. Commercial values come only from the resolved policy.

- [ ] **Step 4: Implement canonical collection**

For each audit scenario, `canonical-collectors.ts` must:

1. resolve the versioned policy with an empty DB rule list by default;
2. select the named compatibility profile;
3. build provider facts;
4. call `quoteCanonicalPricing()`;
5. project the quote to `FrozenPricingOutput` without recalculation.

Database-backed shadow cases are covered separately with injected DB rules; the deterministic fixture never reads a live database.

- [ ] **Step 5: Implement exact shadow comparison**

In `packages/pricing/src/shadow.ts`, export:

```ts
export type PricingShadowComparison = {
  scenarioId: string;
  status: 'match' | 'mismatch';
  deltaCents: number;
  fieldDeltas: Record<string, { current: string | number | undefined; canonical: string | number | undefined }>;
};

export type PricingComparableOutput = {
  currency: string;
  vendorSubtotalCents: number;
  marginCents: number;
  surchargeCents: number;
  customerTotalCents: number;
  unit: string;
  quantity: number;
  displayedAmount?: string;
  structuredDataAmount?: string;
};

export function comparePricingOutputs(
  current: PricingComparableOutput,
  canonical: PricingComparableOutput
): PricingShadowComparison;
```

Compare currency, vendor subtotal, margin, surcharge, customer total, unit, quantity, displayed input, and structured-data amount. Float tolerance is forbidden; cent fields use strict integer equality.

- [ ] **Step 6: Add only proven compatibility profiles**

For each mismatch:

1. confirm the legacy collector calls the real current owner;
2. confirm provider facts are correct;
3. encode the existing behavior as a narrowly named profile in `pricing-policy.json`;
4. attach the profile to explicit scenario/rule rows;
5. document the reason and affected surfaces.

Do not modify the frozen fixture to make the new quote pass. A fixture change is allowed only if Task 2’s collector was factually wrong, and that correction must be isolated in its own commit.

- [ ] **Step 7: Run all pricing foundation tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-consumer-inventory.test.ts tests/pricing-policy.test.ts tests/pricing-canonical-kernel.test.ts tests/pricing-shadow.test.ts tests/pricing-architecture.test.ts
pnpm pricing:baseline
```

Expected: every row is `match`; baseline remains unchanged.

- [ ] **Step 8: Commit shadow parity**

```bash
git add packages/pricing/src/shadow.ts packages/pricing/src/index.ts frontend/src/lib/pricing-audit/canonical-facts.ts frontend/src/lib/pricing-audit/canonical-collectors.ts frontend/src/lib/audio-generation.ts frontend/config/pricing-policy.json tests/pricing-shadow.test.ts docs/engineering/pricing-engine.md
git commit -m "test: prove canonical pricing shadow parity"
```

---

### Task 7: Add the deterministic pricing audit command

**Files:**

- Create: `frontend/src/lib/pricing-audit/matrix.ts`
- Create: `scripts/pricing-audit.ts`
- Modify: `package.json`
- Modify: `tests/pricing-shadow.test.ts`

- [ ] **Step 1: Write failing matrix failure-rule tests**

Test that the matrix builder fails for:

- a missing canonical scenario;
- a missing frozen scenario;
- non-finite or negative quote fields;
- unresolved policy;
- duplicate rule ambiguity;
- an unapproved compatibility profile;
- a changed frozen row;
- a non-zero delta.

Assert stable error codes, not message fragments.

- [ ] **Step 2: Run the focused test and confirm failure**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-shadow.test.ts
```

Expected: FAIL on missing matrix validation.

- [ ] **Step 3: Implement the deterministic matrix builder**

`buildPricingAuditMatrix()` in `matrix.ts` must return:

```ts
export type PricingAuditMatrix = {
  version: 1;
  summary: {
    scenarios: number;
    matches: number;
    mismatches: number;
    compatibilityProfiles: number;
  };
  rows: Array<{
    scenarioId: string;
    engineId: string;
    surface: PricingAuditSurface;
    currentTotalCents: number;
    canonicalTotalCents: number;
    deltaCents: number;
    policySource: 'database' | 'versioned';
    policyRuleId: string;
    compatibilityProfile?: string;
    migrationState: 'legacy-authoritative-shadow-match' | 'legacy-authoritative-shadow-mismatch';
    status: 'match' | 'mismatch';
  }>;
};
```

Sort rows by `scenarioId`. Keep the old path authoritative regardless of the result.

- [ ] **Step 4: Implement human and machine CLI output**

`scripts/pricing-audit.ts` must:

- read no live database by default;
- modify no config, fixture, or application state;
- print a concise human summary and mismatch table by default;
- emit only JSON when `--json` is supplied;
- exit 1 on any audit failure or mismatch;
- exit 0 only when all rows match.

Add:

```json
{
  "pricing:audit": "tsx --tsconfig frontend/tsconfig.json scripts/pricing-audit.ts"
}
```

- [ ] **Step 5: Verify both output modes**

```bash
pnpm pricing:audit
pnpm pricing:audit -- --json > /tmp/maxvideoai-pricing-audit.json
node -e "const r=require('/tmp/maxvideoai-pricing-audit.json'); if(r.summary.mismatches!==0) process.exit(1); console.log(r.summary)"
```

Expected: both commands exit 0, the human output reports zero mismatches, and JSON parses with the same row count as the frozen fixture.

- [ ] **Step 6: Commit the audit command**

```bash
git add frontend/src/lib/pricing-audit/matrix.ts scripts/pricing-audit.ts package.json tests/pricing-shadow.test.ts
git commit -m "feat: add deterministic pricing audit"
```

---

### Task 8: Lock the shadow-only boundary and complete verification

**Files:**

- Create: `tests/pricing-foundation-architecture.test.ts`
- Modify: `docs/engineering/pricing-engine.md`
- Modify: `docs/superpowers/specs/2026-07-12-canonical-pricing-engine-design.md`

- [ ] **Step 1: Write the architecture guard**

`tests/pricing-foundation-architecture.test.ts` must assert:

1. `packages/pricing/src/canonical.ts`, `policy.ts`, and `shadow.ts` contain no database, Next.js, React, translation, route, logging, filesystem, or environment imports;
2. `frontend/server/pricing/resolve-pricing-policy.ts` is the only new module allowed to import both the rule store and versioned policy facade;
3. `pricing-policy.json` contains no provider rate keys such as `baseUnitPriceCents`, `perSecondCents`, `tokenPricing`, `falModelId`, or vendor credentials;
4. all current production owner files listed above do **not** import `quoteCanonicalPricing`, `canonical-collectors`, or `pricing-audit`;
5. admin pricing files have no diff in this batch;
6. `pricing.ts` still exports the historical `computePricingSnapshot()` facade and still uses the historical rule selector;
7. generated baseline rows have unique IDs and integer cent fields.

- [ ] **Step 2: Run the architecture and pricing suite**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-foundation-architecture.test.ts tests/pricing-consumer-inventory.test.ts tests/pricing-policy.test.ts tests/pricing-canonical-kernel.test.ts tests/pricing-shadow.test.ts tests/pricing-architecture.test.ts tests/pricing-definition.test.ts tests/pricing-page-architecture.test.ts tests/price-estimator-architecture.test.ts tests/admin-pricing-architecture.test.ts tests/audio-generate-server-architecture.test.ts
pnpm pricing:baseline
pnpm pricing:audit
```

Expected: PASS with zero mismatches and no baseline drift.

- [ ] **Step 3: Update documentation status**

In `docs/engineering/pricing-engine.md`, record:

- exact baseline row count;
- every compatibility profile and the surfaces it preserves;
- exact audit output summary;
- production consumers still marked `legacy-authoritative`;
- next approved subproject: billing consumer migration, requiring a separate plan.

In the design spec, mark subproject 1 complete only after the full gate passes. Do not mark later subprojects complete.

- [ ] **Step 4: Run the full repository verification gate**

```bash
pnpm test:validate
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm pricing:baseline
pnpm pricing:audit
pnpm --prefix frontend run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Prove no price or consumer adoption changed**

Run:

```bash
baseline_commit=$(git log --format=%H --reverse -- tests/fixtures/pricing-parity.v1.json | head -n 1)
git diff "$baseline_commit"..HEAD -- tests/fixtures/pricing-parity.v1.json
git diff origin/main...HEAD -- 'frontend/app/(core)/admin/pricing' 'frontend/app/api/admin/pricing'
rg -n "quoteCanonicalPricing|canonical-collectors|pricing-audit" frontend --glob '*.ts' --glob '*.tsx'
```

Expected:

- the fixture only appears in its creation commit and is unchanged afterward;
- admin pricing paths have no diff;
- canonical quote imports appear only in policy/audit/shadow foundation modules, never in production consumers.

- [ ] **Step 6: Review final diff and commit the guards/documentation**

```bash
git status --short
git diff --check
git add tests/pricing-foundation-architecture.test.ts docs/engineering/pricing-engine.md docs/superpowers/specs/2026-07-12-canonical-pricing-engine-design.md
git commit -m "docs: lock pricing parity foundation"
```

- [ ] **Step 7: Stop before billing migration**

Report the baseline row count, compatibility profiles, audit summary, verification results, and commits. Do not start subproject 2 until its focused implementation plan is written and approved.

---

## Plan Acceptance Checklist

- [ ] The baseline is generated from current owners before canonical implementation.
- [ ] No production consumer becomes canonical-authoritative.
- [ ] No admin route or mutation behavior changes.
- [ ] Versioned defaults reproduce the current policy values.
- [ ] Database overrides and versioned rules share one validator and one resolver.
- [ ] Resolver provenance is present and the DB fallback is observable.
- [ ] Every required surface has deterministic scenarios.
- [ ] Every current row matches a canonical shadow row at exact cent precision.
- [ ] Existing cross-surface differences are named compatibility profiles.
- [ ] `pnpm pricing:baseline` and `pnpm pricing:audit` are CI-safe and database-independent.
- [ ] The complete repository verification gate passes.
- [ ] Billing migration remains a separate, unstarted subproject.
