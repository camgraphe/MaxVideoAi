# Pricing Admin Policy Service Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the 735-line pricing policy service to a stable facade backed by focused contract, dependency, rule, preview, confirmation, and read-model owners without changing any commercial result or admin behavior.

**Architecture:** Keep `frontend/server/pricing-admin/policy-service.ts` as the only route-facing import surface. Extract existing behavior into six sibling modules inside `frontend/server/pricing-admin/`; dependencies flow directly to the contract or helper they need, focused modules never import the facade, and no generic service framework is introduced.

**Tech Stack:** TypeScript, Next.js App Router route handlers, Node test runner through `tsx --test`, PostgreSQL transaction helpers, `@maxvideoai/pricing`, Playwright admin smoke tests.

## Global Constraints

- Implement from the approved design: `docs/superpowers/specs/2026-07-14-pricing-admin-policy-service-refactor-design.md`.
- Do not change any price, margin, surcharge, discount, currency, compatibility profile, rounding rule, provider cost, customer total, wallet debit, public display, or structured-data offer.
- Do not modify `frontend/config/pricing-policy.json` or either frozen pricing fixture.
- Do not add a database migration or change an admin route, API payload, UI component, or public export.
- Keep `frontend/server/pricing-admin/policy-service.ts` as the only supported consumer import surface.
- Keep the preview fingerprint inputs, ordering, and serialization identical.
- Recompute the preview before the transaction and again inside the locked transaction.
- Keep the rule mutation and immutable event insertion on the same `QueryExecutor`.
- Do not add classes, repositories, command buses, dependency containers, compatibility shims, or generic service abstractions.
- No focused policy module may exceed 350 physical lines; the final facade may not exceed 30 physical lines.
- Do not refactor membership or billing-product services in this batch.

## Target File Map

- `frontend/server/pricing-admin/policy-service.ts` — stable re-export-only facade.
- `frontend/server/pricing-admin/policy-contract.ts` — public DTOs, dependency contract, and shared preview context type.
- `frontend/server/pricing-admin/policy-dependencies.ts` — single production adapter for DB, events, transactions, cache, and revalidation.
- `frontend/server/pricing-admin/policy-rules.ts` — deterministic parsing, normalization, selector, reference, and validation helpers.
- `frontend/server/pricing-admin/policy-preview.ts` — proposal interpretation, canonical scenario comparison, surcharge requests, and fingerprint.
- `frontend/server/pricing-admin/policy-confirmation.ts` — locked confirmation, persistence, immutable event, and post-commit operations.
- `frontend/server/pricing-admin/policy-read-model.ts` — inventory and history reads.
- `tests/admin-pricing-architecture.test.ts` — ownership, facade, import, and line-cap contracts.
- `tests/admin-pricing-policy-service.test.ts` — unchanged public behavioral contract.
- `docs/engineering/refactor-roadmap.md` — live audit state and completed ownership.

---

### Task 1: Extract public contracts and production dependency wiring

**Files:**
- Create: `frontend/server/pricing-admin/policy-contract.ts`
- Create: `frontend/server/pricing-admin/policy-dependencies.ts`
- Modify: `frontend/server/pricing-admin/policy-service.ts`
- Modify: `tests/admin-pricing-architecture.test.ts`
- Test: `tests/admin-pricing-architecture.test.ts`
- Test: `tests/admin-pricing-policy-service.test.ts`

**Interfaces:**
- Consumes: existing pricing change event types, `QueryExecutor`, pricing rule store types, and canonical scenario DTOs.
- Produces: `PricingPolicyChangeProposal`, `PricingChangePreview`, `PricingChangeConfirmation`, `PricingPolicyInventoryRow`, `PricingPolicyInventoryResponse`, `PricingPolicyServiceDependencies`, `PreviewContext`, and `DEFAULT_POLICY_SERVICE_DEPENDENCIES`.

- [ ] **Step 1: Add the failing contract and dependency ownership test**

Add these path constants after `pricingPolicyServicePath` in `tests/admin-pricing-architecture.test.ts`:

```ts
const pricingPolicyContractPath = join(root, 'frontend/server/pricing-admin/policy-contract.ts');
const pricingPolicyDependenciesPath = join(root, 'frontend/server/pricing-admin/policy-dependencies.ts');
```

Add this test before the route-adapter test:

```ts
test('pricing policy contracts and production dependencies have focused owners', () => {
  assert.ok(existsSync(pricingPolicyContractPath), 'pricing policy contract module should exist');
  assert.ok(existsSync(pricingPolicyDependenciesPath), 'pricing policy dependency module should exist');

  const contractSource = readOrEmpty(pricingPolicyContractPath);
  const dependenciesSource = readOrEmpty(pricingPolicyDependenciesPath);

  assert.match(contractSource, /export type PricingPolicyChangeProposal/);
  assert.match(contractSource, /export type PricingPolicyServiceDependencies/);
  assert.doesNotMatch(contractSource, /^import (?!type)/m, 'contract module must have type-only imports');

  assert.match(dependenciesSource, /export const DEFAULT_POLICY_SERVICE_DEPENDENCIES/);
  assert.match(dependenciesSource, /withDbTransaction/);
  assert.match(dependenciesSource, /loadPricingPolicyOverridesWithExecutor\(executor, \{ lock: true \}\)/);
  assert.match(dependenciesSource, /insertPricingChangeEvent/);
  assert.match(dependenciesSource, /invalidatePricingRulesCache/);
  assert.match(dependenciesSource, /revalidatePricingChangeSurfaces/);
  assert.doesNotMatch(
    dependenciesSource,
    /resolvePricingPolicy|quoteCanonicalAdminScenarios|compareCanonicalAdminScenarios/,
    'dependency adapter must not own commercial policy decisions'
  );
});
```

- [ ] **Step 2: Run the focused architecture test and verify it fails**

Run:

```bash
pnpm exec tsx --test tests/admin-pricing-architecture.test.ts
```

Expected: FAIL because `policy-contract.ts` and `policy-dependencies.ts` do not exist.

- [ ] **Step 3: Create the policy contract module**

Create `frontend/server/pricing-admin/policy-contract.ts` with:

```ts
import type { PricingPolicyRule } from '@maxvideoai/pricing';

import type {
  InsertPricingChangeEventInput,
  ListPricingChangeEventsInput,
  PricingChangeDomain,
  PricingChangeEvent,
  PricingChangeJsonValue,
  PricingChangeOperation,
} from '@/lib/admin/pricing-change-contract';
import type { QueryExecutor } from '@/lib/db';
import type {
  PricingPolicyOverrideLoadResult,
  PricingRule,
} from '@/lib/pricing-rule-store';

import type {
  AdminCanonicalScenarioQuote,
  PricingChangePreviewRow,
  PricingScenarioSelector,
} from './canonical-scenarios';

export type PricingPolicyChangeProposal =
  | { operation: 'create'; rule: unknown }
  | { operation: 'update'; targetId: string; rule: unknown }
  | { operation: 'delete'; targetId: string }
  | { operation: 'rollback'; targetId: string; eventId: string };

export type PricingChangePreview = {
  previewFingerprint: string;
  domain: 'policy_rule';
  operation: PricingChangeOperation;
  targetId: string;
  currentState: PricingChangeJsonValue | null;
  proposedState: PricingChangeJsonValue | null;
  affectedScenarioIds: string[];
  affectedSurfaces: string[];
  rows: PricingChangePreviewRow[];
  warnings: string[];
  rollbackEventId?: string;
};

export type PricingChangeConfirmation = {
  committed: true;
  preview: PricingChangePreview;
  persistedState: PricingChangeJsonValue | null;
  event: PricingChangeEvent;
  operationalWarnings: Array<{
    code: 'cache_invalidation_failed' | 'path_revalidation_failed';
    message: string;
  }>;
};

export type PricingPolicyInventoryRow = {
  selector: PricingScenarioSelector;
  versionedRule: PricingPolicyRule | null;
  databaseOverride: PricingPolicyRule | null;
  effectiveProvenance: AdminCanonicalScenarioQuote['policyProvenance'] | null;
  representativeQuotes: AdminCanonicalScenarioQuote[];
  routingContext: Pick<
    PricingRule,
    'vendorAccountId' | 'effectiveFrom' | 'updatedAt' | 'updatedBy'
  > | null;
  lastEvent: PricingChangeEvent | null;
};

export type PricingPolicyInventoryResponse = {
  versionedPolicyVersion: number;
  databaseStatus: PricingPolicyOverrideLoadResult['status'];
  warnings: string[];
  rows: PricingPolicyInventoryRow[];
};

export type PricingPolicyServiceDependencies = {
  loadOverrides(executor?: QueryExecutor): Promise<PricingPolicyOverrideLoadResult>;
  getEvent(
    id: string,
    domain: PricingChangeDomain,
    executor?: QueryExecutor
  ): Promise<PricingChangeEvent | null>;
  listLatestEventsByTargets(
    domain: PricingChangeDomain,
    targetIds: string[]
  ): Promise<PricingChangeEvent[]>;
  listEvents(input?: ListPricingChangeEventsInput): Promise<PricingChangeEvent[]>;
  withTransaction<TResult>(
    callback: (executor: QueryExecutor) => Promise<TResult>
  ): Promise<TResult>;
  upsertRule(
    executor: QueryExecutor,
    rule: PricingPolicyRule,
    actorId: string
  ): Promise<PricingRule>;
  deleteRule(executor: QueryExecutor, id: string): Promise<PricingRule>;
  insertEvent(
    executor: QueryExecutor,
    input: InsertPricingChangeEventInput
  ): Promise<PricingChangeEvent>;
  invalidateCache(): void;
  revalidate(preview: PricingChangePreview): void;
};

export type PreviewContext = {
  operation: PricingChangeOperation;
  targetId: string;
  currentRule: PricingPolicyRule | null;
  proposedRule: PricingPolicyRule | null;
  currentRules: PricingPolicyRule[];
  proposedRules: PricingPolicyRule[];
  currentRoutingRules: PricingRule[];
  rollbackEventId?: string;
};
```

- [ ] **Step 4: Create the production dependency adapter**

Create `frontend/server/pricing-admin/policy-dependencies.ts` with:

```ts
import { withDbTransaction } from '@/lib/db';
import {
  deletePricingRuleWithExecutor,
  invalidatePricingRulesCache,
  loadPricingPolicyOverrides,
  loadPricingPolicyOverridesWithExecutor,
  upsertPricingRuleWithExecutor,
} from '@/lib/pricing-rule-store';

import {
  getPricingChangeEventById,
  insertPricingChangeEvent,
  listLatestPricingChangeEventsByTargets,
  listPricingChangeEvents,
} from './event-store';
import type { PricingPolicyServiceDependencies } from './policy-contract';
import { revalidatePricingChangeSurfaces } from './revalidation';

export const DEFAULT_POLICY_SERVICE_DEPENDENCIES: PricingPolicyServiceDependencies = {
  loadOverrides: (executor) =>
    executor
      ? loadPricingPolicyOverridesWithExecutor(executor, { lock: true })
      : loadPricingPolicyOverrides(),
  getEvent: (id, domain, executor) =>
    getPricingChangeEventById(id, domain, executor),
  listLatestEventsByTargets: listLatestPricingChangeEventsByTargets,
  listEvents: listPricingChangeEvents,
  withTransaction: (callback) =>
    withDbTransaction((executor) => callback(executor)),
  upsertRule: (executor, rule, actorId) =>
    upsertPricingRuleWithExecutor(executor, rule, actorId),
  deleteRule: deletePricingRuleWithExecutor,
  insertEvent: insertPricingChangeEvent,
  invalidateCache: invalidatePricingRulesCache,
  revalidate: revalidatePricingChangeSurfaces,
};
```

- [ ] **Step 5: Rewire the existing service to the extracted contracts and dependency adapter**

In `policy-service.ts`, delete the local declarations from `export type PricingPolicyChangeProposal` through `type PreviewContext` and delete the local `DEFAULT_DEPENDENCIES` object. Remove their now-unused DB, event-store, rule-store mutation, and revalidation imports.

Add:

```ts
import type {
  PreviewContext,
  PricingChangeConfirmation,
  PricingChangePreview,
  PricingPolicyChangeProposal,
  PricingPolicyInventoryResponse,
  PricingPolicyInventoryRow,
  PricingPolicyServiceDependencies,
} from './policy-contract';
import { DEFAULT_POLICY_SERVICE_DEPENDENCIES } from './policy-dependencies';

export type {
  PricingChangeConfirmation,
  PricingChangePreview,
  PricingPolicyChangeProposal,
  PricingPolicyInventoryResponse,
  PricingPolicyInventoryRow,
  PricingPolicyServiceDependencies,
} from './policy-contract';
```

Replace each of the four default parameter references:

```ts
dependencies: PricingPolicyServiceDependencies = DEFAULT_POLICY_SERVICE_DEPENDENCIES
```

The four affected exports are `previewPricingPolicyChange`, `confirmPricingPolicyChange`, `loadPricingPolicyHistory`, and `loadPricingPolicyInventory`. Do not change their parameter order or return types.

- [ ] **Step 6: Run focused behavior and architecture tests**

Run:

```bash
pnpm exec tsx --test \
  tests/admin-pricing-architecture.test.ts \
  tests/admin-pricing-policy-service.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
```

Expected: PASS with the existing policy behavior suite unchanged.

- [ ] **Step 7: Commit the contract and dependency boundary**

```bash
git add \
  frontend/server/pricing-admin/policy-contract.ts \
  frontend/server/pricing-admin/policy-dependencies.ts \
  frontend/server/pricing-admin/policy-service.ts \
  tests/admin-pricing-architecture.test.ts
git commit -m "refactor: extract pricing policy contracts"
```

---

### Task 2: Extract deterministic policy rule helpers

**Files:**
- Create: `frontend/server/pricing-admin/policy-rules.ts`
- Modify: `frontend/server/pricing-admin/policy-service.ts`
- Modify: `tests/admin-pricing-architecture.test.ts`
- Test: `tests/admin-pricing-architecture.test.ts`
- Test: `tests/admin-pricing-policy-service.test.ts`

**Interfaces:**
- Consumes: engine catalog, pricing audit scenarios, `PricingPolicyDocument`, and `PricingPolicyRule`.
- Produces: `asRecord`, `requiredText`, `canonicalRule`, `jsonRule`, `selectorOf`, `selectorKey`, `scenarioSelectorKey`, `validateOverrides`, `projectionJson`, and `sortRules`.

- [ ] **Step 1: Add the failing deterministic-helper ownership test**

Add:

```ts
const pricingPolicyRulesPath = join(root, 'frontend/server/pricing-admin/policy-rules.ts');

test('pricing policy rule helpers are deterministic and side-effect free', () => {
  assert.ok(existsSync(pricingPolicyRulesPath), 'pricing policy rule helper module should exist');
  const source = readOrEmpty(pricingPolicyRulesPath);

  for (const helper of [
    'asRecord',
    'requiredText',
    'canonicalRule',
    'jsonRule',
    'selectorOf',
    'selectorKey',
    'scenarioSelectorKey',
    'validateOverrides',
    'projectionJson',
    'sortRules',
  ]) {
    assert.match(source, new RegExp(`export function ${helper}`), `${helper} should be exported`);
  }

  assert.doesNotMatch(
    source,
    /@\/lib\/db|event-store|revalidation|withDbTransaction|insertPricingChangeEvent/,
    'rule helper module must not own persistence or side effects'
  );
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm exec tsx --test tests/admin-pricing-architecture.test.ts
```

Expected: FAIL because `policy-rules.ts` does not exist.

- [ ] **Step 3: Create the complete deterministic rule helper module**

Create `frontend/server/pricing-admin/policy-rules.ts` with:

```ts
import {
  PricingPolicyValidationError,
  validatePricingPolicyOverrides,
  type PricingPolicyDocument,
  type PricingPolicyReferences,
  type PricingPolicyRule,
} from '@maxvideoai/pricing';

import { listFalEngines } from '@/config/falEngines';
import type { PricingChangeJsonValue } from '@/lib/admin/pricing-change-contract';
import { buildPricingAuditScenarios } from '@/lib/pricing-audit/scenarios';

import type { PricingScenarioSelector } from './canonical-scenarios';
import { PricingAdminError } from './errors';

export function asRecord(
  value: unknown,
  label: string
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PricingAdminError('invalid_payload', `${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PricingAdminError('invalid_payload', `${label} is required`);
  }
  return value.trim();
}

export function canonicalRule(rule: PricingPolicyRule): PricingPolicyRule {
  return {
    id: rule.id,
    ...(rule.engineId ? { engineId: rule.engineId } : {}),
    ...(rule.mode ? { mode: rule.mode } : {}),
    ...(rule.resolution ? { resolution: rule.resolution } : {}),
    marginPercent: rule.marginPercent,
    marginFlatCents: rule.marginFlatCents,
    surchargeAudioPercent: rule.surchargeAudioPercent,
    surchargeUpscalePercent: rule.surchargeUpscalePercent,
    currency: rule.currency,
    ...(rule.compatibilityProfile
      ? { compatibilityProfile: rule.compatibilityProfile }
      : {}),
  };
}

export function jsonRule(
  rule: PricingPolicyRule | null
): PricingChangeJsonValue | null {
  return rule
    ? (canonicalRule(rule) as unknown as PricingChangeJsonValue)
    : null;
}

export function selectorOf(
  rule: PricingPolicyRule
): PricingScenarioSelector {
  return {
    ...(rule.engineId ? { engineId: rule.engineId } : {}),
    ...(rule.mode ? { mode: rule.mode } : {}),
    ...(rule.resolution ? { resolution: rule.resolution } : {}),
  };
}

export function selectorKey(rule: PricingPolicyRule): string {
  return `${rule.engineId ?? '*'}|${rule.mode ?? '*'}|${rule.resolution ?? '*'}`;
}

export function scenarioSelectorKey(
  selector: PricingScenarioSelector
): string {
  return `${selector.engineId ?? '*'}|${selector.mode ?? '*'}|${selector.resolution ?? '*'}`;
}

function buildReferences(
  policy: PricingPolicyDocument
): PricingPolicyReferences {
  const engineIds = new Set<string>();
  const modesByEngineId = new Map<string, Set<string>>();
  const resolutionsByEngineId = new Map<string, Set<string>>();
  const add = (engineId: string, mode?: string, resolution?: string) => {
    engineIds.add(engineId);
    if (mode) {
      const modes = modesByEngineId.get(engineId) ?? new Set<string>();
      modes.add(mode);
      modesByEngineId.set(engineId, modes);
    }
    if (resolution) {
      const resolutions =
        resolutionsByEngineId.get(engineId) ?? new Set<string>();
      resolutions.add(resolution);
      resolutionsByEngineId.set(engineId, resolutions);
    }
  };

  listFalEngines().forEach((entry) => {
    const ids = new Set([entry.id, entry.engine.id]);
    ids.forEach((id) => {
      add(id);
      entry.modes.forEach((mode) => add(id, mode.mode));
      entry.engine.resolutions?.forEach((resolution) =>
        add(id, undefined, resolution)
      );
    });
  });
  buildPricingAuditScenarios().forEach((scenario) =>
    add(scenario.engineId, scenario.mode, scenario.resolution)
  );
  policy.rules.forEach((rule) =>
    rule.engineId && add(rule.engineId, rule.mode, rule.resolution)
  );
  return { engineIds, modesByEngineId, resolutionsByEngineId };
}

function mapValidationError(error: unknown): never {
  if (!(error instanceof PricingPolicyValidationError)) throw error;
  const mapped = {
    invalid_number: 'invalid_number',
    unsupported_currency: 'unsupported_currency',
    unknown_engine: 'unknown_engine',
    unknown_mode: 'unknown_mode',
    unknown_resolution: 'unknown_resolution',
    unknown_compatibility_profile: 'unknown_compatibility_profile',
    ambiguous_selector: 'ambiguous_selector',
  } as const;
  const code =
    mapped[error.code as keyof typeof mapped] ?? 'invalid_payload';
  throw new PricingAdminError(code, error.message);
}

export function validateOverrides(
  rules: unknown[],
  policy: PricingPolicyDocument
): PricingPolicyRule[] {
  try {
    return validatePricingPolicyOverrides(
      rules,
      policy,
      buildReferences(policy)
    );
  } catch (error) {
    return mapValidationError(error);
  }
}

export function projectionJson(value: unknown): PricingChangeJsonValue {
  return JSON.parse(JSON.stringify(value)) as PricingChangeJsonValue;
}

export function sortRules<T extends PricingPolicyRule>(rules: T[]): T[] {
  return [...rules].sort((left, right) =>
    `${selectorKey(left)}|${left.id}`.localeCompare(
      `${selectorKey(right)}|${right.id}`
    )
  );
}
```

- [ ] **Step 4: Replace the duplicated helper implementations in the service**

Delete the existing implementations of `asRecord`, `requiredText`, `canonicalRule`, `jsonRule`, `selectorOf`, `selectorKey`, `scenarioSelectorKey`, `buildReferences`, `mapValidationError`, `validateOverrides`, `projectionJson`, and `sortRules` from `policy-service.ts`.

Remove `PricingPolicyValidationError`, `validatePricingPolicyOverrides`, and `PricingPolicyReferences` from its `@maxvideoai/pricing` import. Add:

```ts
import {
  asRecord,
  canonicalRule,
  jsonRule,
  projectionJson,
  requiredText,
  scenarioSelectorKey,
  selectorKey,
  selectorOf,
  sortRules,
  validateOverrides,
} from './policy-rules';
```

Do not change any call site.

- [ ] **Step 5: Run the focused tests**

Run:

```bash
pnpm exec tsx --test \
  tests/admin-pricing-architecture.test.ts \
  tests/admin-pricing-policy-service.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
```

Expected: PASS with no pricing behavior changes.

- [ ] **Step 6: Commit the deterministic helper extraction**

```bash
git add \
  frontend/server/pricing-admin/policy-rules.ts \
  frontend/server/pricing-admin/policy-service.ts \
  tests/admin-pricing-architecture.test.ts
git commit -m "refactor: extract pricing policy rules"
```

---

### Task 3: Extract the canonical pricing preview workflow

**Files:**
- Create: `frontend/server/pricing-admin/policy-preview.ts`
- Modify: `frontend/server/pricing-admin/policy-service.ts`
- Modify: `tests/admin-pricing-architecture.test.ts`
- Test: `tests/admin-pricing-architecture.test.ts`
- Test: `tests/admin-pricing-policy-service.test.ts`

**Interfaces:**
- Consumes: `PricingPolicyChangeProposal`, `PricingPolicyServiceDependencies`, deterministic rule helpers, canonical scenario functions, and the existing fingerprint builder.
- Produces: `deriveRequestedPricingSurcharges(input)` and `previewPricingPolicyChange(proposal, dependencies?)`.

- [ ] **Step 1: Add the failing preview ownership test**

Add:

```ts
const pricingPolicyPreviewPath = join(root, 'frontend/server/pricing-admin/policy-preview.ts');

test('pricing policy preview owns canonical projection and fingerprinting without persistence', () => {
  assert.ok(existsSync(pricingPolicyPreviewPath), 'pricing policy preview module should exist');
  const source = readOrEmpty(pricingPolicyPreviewPath);

  assert.match(source, /export function deriveRequestedPricingSurcharges/);
  assert.match(source, /export async function previewPricingPolicyChange/);
  assert.match(source, /selectAffectedPricingScenarios/);
  assert.match(source, /quoteCanonicalAdminScenarios/);
  assert.match(source, /compareCanonicalAdminScenarios/);
  assert.match(source, /buildPricingPreviewFingerprint/);
  assert.doesNotMatch(
    source,
    /withDbTransaction|upsertPricingRuleWithExecutor|deletePricingRuleWithExecutor|insertPricingChangeEvent/,
    'preview must not own persistence'
  );
});
```

- [ ] **Step 2: Run the architecture test and verify it fails**

Run:

```bash
pnpm exec tsx --test tests/admin-pricing-architecture.test.ts
```

Expected: FAIL because `policy-preview.ts` does not exist.

- [ ] **Step 3: Create the complete preview module**

Create `frontend/server/pricing-admin/policy-preview.ts` with:

```ts
import type {
  PricingPolicyDocument,
  PricingPolicyRule,
} from '@maxvideoai/pricing';

import { listFalEngines } from '@/config/falEngines';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import type { PricingRule } from '@/lib/pricing-rule-store';

import {
  compareCanonicalAdminScenarios,
  quoteCanonicalAdminScenarios,
  resolveCanonicalAdminScenarioPolicy,
  selectAffectedPricingScenarios,
  type AdminCanonicalScenarioQuote,
  type PricingScenarioSelector,
  type RequestedPricingSurcharge,
} from './canonical-scenarios';
import { PricingAdminError } from './errors';
import { buildPricingPreviewFingerprint } from './fingerprint';
import type {
  PreviewContext,
  PricingChangePreview,
  PricingPolicyChangeProposal,
  PricingPolicyServiceDependencies,
} from './policy-contract';
import { DEFAULT_POLICY_SERVICE_DEPENDENCIES } from './policy-dependencies';
import {
  asRecord,
  canonicalRule,
  jsonRule,
  projectionJson,
  requiredText,
  selectorOf,
  sortRules,
  validateOverrides,
} from './policy-rules';

async function loadDatabaseRules(
  dependencies: PricingPolicyServiceDependencies
): Promise<{
  rules: PricingPolicyRule[];
  routingRules: PricingRule[];
}> {
  const loaded = await dependencies.loadOverrides();
  if (loaded.status === 'unavailable') {
    throw new PricingAdminError(
      'database_unavailable',
      'Pricing policy database is unavailable'
    );
  }
  return {
    rules: loaded.rules.map(canonicalRule),
    routingRules: (loaded.routingRules ?? []).map((rule) => ({ ...rule })),
  };
}

async function buildPreviewContext(
  proposalInput: PricingPolicyChangeProposal,
  dependencies: PricingPolicyServiceDependencies,
  policy: PricingPolicyDocument
): Promise<PreviewContext> {
  const proposal = asRecord(proposalInput, 'pricing policy proposal');
  const operationValue = proposal.operation;
  if (
    operationValue !== 'create' &&
    operationValue !== 'update' &&
    operationValue !== 'delete' &&
    operationValue !== 'rollback'
  ) {
    throw new PricingAdminError('invalid_payload', 'Unsupported pricing policy operation');
  }
  const operation = operationValue;
  const { rules: currentRules, routingRules: currentRoutingRules } =
    await loadDatabaseRules(dependencies);

  if (operation === 'rollback') {
    const requestedTargetId = requiredText(proposal.targetId, 'targetId');
    const eventId = requiredText(proposal.eventId, 'eventId');
    const event = await dependencies.getEvent(eventId, 'policy_rule');
    if (!event) throw new PricingAdminError('missing_target', 'Pricing change event not found');
    if (event.targetId !== requestedTargetId) {
      throw new PricingAdminError(
        'missing_target',
        'Pricing change event does not match the requested target'
      );
    }
    const targetId = event.targetId;
    const currentRule = currentRules.find((rule) => rule.id === targetId) ?? null;
    const currentRouting = currentRoutingRules.find((rule) => rule.id === targetId);
    if (event.previousState === null) {
      if (targetId === 'default') {
        throw new PricingAdminError(
          'default_rule_delete_forbidden',
          'The default pricing rule cannot be deleted'
        );
      }
      if (!currentRule) throw new PricingAdminError('missing_target', 'Pricing rule not found');
      if (currentRouting?.vendorAccountId) {
        throw new PricingAdminError(
          'routing_conflict',
          'Cannot delete a pricing rule that owns vendor routing'
        );
      }
      const proposedRules = validateOverrides(
        currentRules.filter((rule) => rule.id !== targetId),
        policy
      );
      return {
        operation,
        targetId,
        currentRule,
        proposedRule: null,
        currentRules,
        proposedRules,
        currentRoutingRules,
        rollbackEventId: eventId,
      };
    }
    const previousState = asRecord(event.previousState, 'rollback previousState');
    if (
      !currentRule &&
      typeof previousState.vendorAccountId === 'string' &&
      previousState.vendorAccountId.trim()
    ) {
      throw new PricingAdminError(
        'routing_conflict',
        'Cannot recreate historical vendor routing from pricing policy state'
      );
    }
    const previous = { ...previousState, id: targetId };
    const proposedRules = validateOverrides(
      [...currentRules.filter((rule) => rule.id !== targetId), previous],
      policy
    );
    const proposedRule = proposedRules.find((rule) => rule.id === targetId)!;
    return {
      operation,
      targetId,
      currentRule,
      proposedRule,
      currentRules,
      proposedRules,
      currentRoutingRules,
      rollbackEventId: eventId,
    };
  }

  if (operation === 'delete') {
    const targetId = requiredText(proposal.targetId, 'targetId');
    if (targetId === 'default') {
      throw new PricingAdminError(
        'default_rule_delete_forbidden',
        'The default pricing rule cannot be deleted'
      );
    }
    const currentRule = currentRules.find((rule) => rule.id === targetId) ?? null;
    if (!currentRule) throw new PricingAdminError('missing_target', 'Pricing rule not found');
    if (currentRoutingRules.find((rule) => rule.id === targetId)?.vendorAccountId) {
      throw new PricingAdminError(
        'routing_conflict',
        'Cannot delete a pricing rule that owns vendor routing'
      );
    }
    const proposedRules = validateOverrides(
      currentRules.filter((rule) => rule.id !== targetId),
      policy
    );
    return {
      operation,
      targetId,
      currentRule,
      proposedRule: null,
      currentRules,
      proposedRules,
      currentRoutingRules,
    };
  }

  const rawRule = asRecord(proposal.rule, 'rule');
  const targetId = operation === 'update'
    ? requiredText(proposal.targetId, 'targetId')
    : requiredText(rawRule.id, 'rule.id');
  const currentRule = currentRules.find((rule) => rule.id === targetId) ?? null;
  if (operation === 'update' && !currentRule)
    throw new PricingAdminError('missing_target', 'Pricing rule not found');
  if (operation === 'create' && currentRule) {
    throw new PricingAdminError('invalid_payload', `Pricing rule ${targetId} already exists`);
  }
  const proposedRules = validateOverrides(
    [...currentRules.filter((rule) => rule.id !== targetId), { ...rawRule, id: targetId }],
    policy
  );
  const proposedRule = proposedRules.find((rule) => rule.id === targetId)!;
  return {
    operation,
    targetId,
    currentRule,
    proposedRule,
    currentRules,
    proposedRules,
    currentRoutingRules,
  };
}

export function deriveRequestedPricingSurcharges(input: {
  selector: PricingScenarioSelector;
  currentRules: PricingPolicyRule[];
  proposedRules: PricingPolicyRule[];
}): RequestedPricingSurcharge[] {
  const scenarios = selectAffectedPricingScenarios(input.selector);
  if (!scenarios.length) return [];
  const changed = (field: 'surchargeAudioPercent' | 'surchargeUpscalePercent') =>
    scenarios.some((scenario) => {
      const current = resolveCanonicalAdminScenarioPolicy(
        { databaseRules: input.currentRules, scenario }
      ).rule[field];
      const proposed = resolveCanonicalAdminScenarioPolicy(
        { databaseRules: input.proposedRules, scenario }
      ).rule[field];
      return current !== proposed;
    });
  const changedKinds = [
    ...(changed('surchargeAudioPercent') ? ['audio' as const] : []),
    ...(changed('surchargeUpscalePercent') ? ['upscale' as const] : []),
  ];
  if (input.selector.engineId) {
    return changedKinds.map((kind) => ({ kind, selector: input.selector }));
  }

  const entries = listFalEngines();
  const supports = (engineId: string, kind: RequestedPricingSurcharge['kind']) => {
    const entry = entries.find(
      (candidate) => candidate.id === engineId || candidate.engine.id === engineId
    );
    return kind === 'audio' ? entry?.engine.audio === true : entry?.engine.upscale4k === true;
  };
  const affectedEngineIds = [...new Set(scenarios.map((scenario) => scenario.engineId))].sort();
  return changedKinds.flatMap((kind) =>
    affectedEngineIds
      .filter((engineId) => supports(engineId, kind))
      .map((engineId) => ({ kind, selector: { engineId } }))
  );
}

export async function previewPricingPolicyChange(
  proposal: PricingPolicyChangeProposal,
  dependencies: PricingPolicyServiceDependencies =
    DEFAULT_POLICY_SERVICE_DEPENDENCIES
): Promise<PricingChangePreview> {
  const policy = getVersionedPricingPolicy();
  const context = await buildPreviewContext(proposal, dependencies, policy);
  const selectorRule = context.proposedRule ?? context.currentRule;
  if (!selectorRule) {
    throw new PricingAdminError('missing_target', 'Pricing rule selector is unavailable');
  }
  const selector = selectorOf(selectorRule);
  const scenarios = selectAffectedPricingScenarios(selector);
  if (!scenarios.length) {
    throw new PricingAdminError('invalid_payload', 'No canonical pricing scenario matches this selector');
  }
  const surchargeRequests = deriveRequestedPricingSurcharges({
    selector,
    currentRules: context.currentRules,
    proposedRules: context.proposedRules,
  });
  const currentOutcomes = quoteCanonicalAdminScenarios({
    databaseRules: context.currentRules,
    scenarios,
    requestedSurcharges: surchargeRequests,
  });
  const proposedOutcomes = quoteCanonicalAdminScenarios({
    databaseRules: context.proposedRules,
    scenarios,
    requestedSurcharges: surchargeRequests,
  });
  const unsupportedOutcomes = [...currentOutcomes, ...proposedOutcomes]
    .filter((outcome) => outcome.status === 'unsupported');
  const unsupportedScenarioIds = [
    ...new Set(
      unsupportedOutcomes
        .filter((outcome) => outcome.scenarioId.startsWith('admin-surcharge:'))
        .map((outcome) => outcome.scenarioId)
    ),
  ];
  const warnings = [
    ...new Set(
      unsupportedOutcomes
        .filter((outcome) => !outcome.scenarioId.startsWith('admin-surcharge:'))
        .map((outcome) => outcome.warning)
    ),
  ];
  const affectedScenarioIds = [...new Set(
    currentOutcomes.map((outcome) => outcome.scenarioId)
  )].sort();
  const currentState = jsonRule(context.currentRule);
  const proposedState = jsonRule(context.proposedRule);
  const comparableCurrent = currentOutcomes.filter(
    (outcome): outcome is AdminCanonicalScenarioQuote =>
      outcome.status === 'quoted'
  );
  const comparableProposed = proposedOutcomes.filter(
    (outcome): outcome is AdminCanonicalScenarioQuote =>
      outcome.status === 'quoted'
  );
  const rows = unsupportedScenarioIds.length
    ? []
    : compareCanonicalAdminScenarios(comparableCurrent, comparableProposed);
  const previewFingerprint = buildPricingPreviewFingerprint({
    domain: 'policy_rule',
    operation: context.operation,
    targetId: context.targetId,
    currentState,
    proposedState,
    versionedPolicyVersion: policy.version,
    affectedScenarioIds,
    unsupportedScenarioIds,
    projectionState: projectionJson({
      currentDatabaseRules: sortRules(context.currentRules),
      currentRoutingRules: [...context.currentRoutingRules]
        .sort((left, right) => left.id.localeCompare(right.id)),
      currentOutcomes,
      proposedOutcomes,
      rows,
      ...(context.rollbackEventId ? { rollbackEventId: context.rollbackEventId } : {}),
    }),
  });
  if (!rows.length) {
    throw new PricingAdminError('invalid_payload', 'Pricing proposal has no observable canonical impact');
  }
  return {
    previewFingerprint,
    domain: 'policy_rule',
    operation: context.operation,
    targetId: context.targetId,
    currentState,
    proposedState,
    affectedScenarioIds,
    affectedSurfaces: [...new Set(rows.map((row) => row.surface))].sort(),
    rows,
    warnings,
    ...(context.rollbackEventId ? { rollbackEventId: context.rollbackEventId } : {}),
  };
}
```

- [ ] **Step 4: Route preview calls through the new owner**

In `policy-service.ts`, delete `loadDatabaseRules`, `buildPreviewContext`, `deriveRequestedPricingSurcharges`, and `previewPricingPolicyChange`. Remove imports that are now used only by those functions, including `PricingPolicyDocument`, `PreviewContext`, `listFalEngines`, and `buildPricingPreviewFingerprint`.

Add:

```ts
import { previewPricingPolicyChange } from './policy-preview';

export {
  deriveRequestedPricingSurcharges,
  previewPricingPolicyChange,
} from './policy-preview';
```

The local import remains required by `confirmPricingPolicyChange` until Task 5.

- [ ] **Step 5: Run focused tests and the immutable pricing audits**

Run:

```bash
pnpm exec tsx --test \
  tests/admin-pricing-architecture.test.ts \
  tests/admin-pricing-policy-service.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
```

Expected: tests PASS; billing audit reports 178 matches and 0 mismatches; public baseline reports all 492 rows unchanged.

- [ ] **Step 6: Commit the preview extraction**

```bash
git add \
  frontend/server/pricing-admin/policy-preview.ts \
  frontend/server/pricing-admin/policy-service.ts \
  tests/admin-pricing-architecture.test.ts
git commit -m "refactor: extract pricing policy previews"
```

---

### Task 4: Extract policy inventory and history reads

**Files:**
- Create: `frontend/server/pricing-admin/policy-read-model.ts`
- Modify: `frontend/server/pricing-admin/policy-service.ts`
- Modify: `tests/admin-pricing-architecture.test.ts`
- Test: `tests/admin-pricing-architecture.test.ts`
- Test: `tests/admin-pricing-policy-service.test.ts`

**Interfaces:**
- Consumes: versioned pricing policy, database overrides, audit scenarios, canonical quote projections, and immutable pricing change events.
- Produces: `loadPricingPolicyHistory(filter?, dependencies?)` and `loadPricingPolicyInventory(dependencies?)`.

- [ ] **Step 1: Add the failing read-model ownership test**

Add:

```ts
const pricingPolicyReadModelPath = join(root, 'frontend/server/pricing-admin/policy-read-model.ts');

test('pricing policy read model owns inventory and history without mutation commands', () => {
  assert.ok(existsSync(pricingPolicyReadModelPath), 'pricing policy read model should exist');
  const source = readOrEmpty(pricingPolicyReadModelPath);

  assert.match(source, /export async function loadPricingPolicyHistory/);
  assert.match(source, /export async function loadPricingPolicyInventory/);
  assert.match(source, /listLatestEventsByTargets\('policy_rule'/);
  assert.match(source, /representativeQuotes/);
  assert.match(source, /databaseStatus/);
  assert.doesNotMatch(
    source,
    /withTransaction|upsertRule|deleteRule|insertEvent/,
    'read model must not own mutations'
  );
});
```

- [ ] **Step 2: Run the architecture test and verify it fails**

Run:

```bash
pnpm exec tsx --test tests/admin-pricing-architecture.test.ts
```

Expected: FAIL because `policy-read-model.ts` does not exist.

- [ ] **Step 3: Create the complete read model**

Create `frontend/server/pricing-admin/policy-read-model.ts` with:

```ts
import {
  resolvePricingPolicy,
  type PricingPolicyRule,
  type PricingPolicyScenario,
} from '@maxvideoai/pricing';

import type {
  ListPricingChangeEventsInput,
  PricingChangeEvent,
} from '@/lib/admin/pricing-change-contract';
import { buildPricingAuditScenarios } from '@/lib/pricing-audit/scenarios';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';

import {
  quoteCanonicalAdminScenarios,
  resolveCanonicalAdminScenarioPolicy,
  selectAffectedPricingScenarios,
  type AdminCanonicalScenarioQuote,
  type PricingScenarioSelector,
} from './canonical-scenarios';
import type {
  PricingPolicyInventoryResponse,
  PricingPolicyInventoryRow,
  PricingPolicyServiceDependencies,
} from './policy-contract';
import { DEFAULT_POLICY_SERVICE_DEPENDENCIES } from './policy-dependencies';
import {
  canonicalRule,
  scenarioSelectorKey,
  selectorKey,
  selectorOf,
} from './policy-rules';

export async function loadPricingPolicyHistory(
  filter: Omit<ListPricingChangeEventsInput, 'domain'> = {},
  dependencies: PricingPolicyServiceDependencies =
    DEFAULT_POLICY_SERVICE_DEPENDENCIES
): Promise<PricingChangeEvent[]> {
  return dependencies.listEvents({ ...filter, domain: 'policy_rule' });
}

export async function loadPricingPolicyInventory(
  dependencies: PricingPolicyServiceDependencies =
    DEFAULT_POLICY_SERVICE_DEPENDENCIES
): Promise<PricingPolicyInventoryResponse> {
  const policy = getVersionedPricingPolicy();
  const loaded = await dependencies.loadOverrides();
  const databaseRules =
    loaded.status === 'loaded' ? loaded.rules.map(canonicalRule) : [];
  const routingRules =
    loaded.status === 'loaded' ? loaded.routingRules ?? [] : [];
  const bySelector = new Map<
    string,
    {
      selector: PricingScenarioSelector;
      versionedRule: PricingPolicyRule | null;
      databaseOverride: PricingPolicyRule | null;
    }
  >();

  policy.rules.forEach((rule) =>
    bySelector.set(selectorKey(rule), {
      selector: selectorOf(rule),
      versionedRule: canonicalRule(rule),
      databaseOverride: null,
    })
  );
  databaseRules.forEach((rule) => {
    const key = selectorKey(rule);
    const existing = bySelector.get(key) ?? {
      selector: selectorOf(rule),
      versionedRule: null,
      databaseOverride: null,
    };
    bySelector.set(key, {
      ...existing,
      databaseOverride: canonicalRule(rule),
    });
  });
  buildPricingAuditScenarios().forEach((scenario) => {
    const selector: PricingScenarioSelector = {
      engineId: scenario.engineId,
      ...(scenario.mode ? { mode: scenario.mode } : {}),
      ...(scenario.resolution
        ? { resolution: scenario.resolution }
        : {}),
    };
    const policyScenario: PricingPolicyScenario = {
      ...selector,
      engineId: scenario.engineId,
    };
    const key = scenarioSelectorKey(selector);
    if (bySelector.has(key)) return;
    const versionedRule = resolvePricingPolicy({
      scenario: policyScenario,
      databaseRules: [],
      versionedRules: policy.rules,
    }).rule;
    const effective = resolvePricingPolicy({
      scenario: policyScenario,
      databaseRules,
      versionedRules: policy.rules,
    });
    bySelector.set(key, {
      selector,
      versionedRule: canonicalRule(versionedRule),
      databaseOverride:
        effective.source === 'database'
          ? databaseRules.find(
              (rule) => rule.id === effective.sourceRuleId
            ) ?? null
          : null,
    });
  });

  bySelector.forEach((entry, key) => {
    if (!entry.selector.engineId) return;
    const effective = resolvePricingPolicy({
      scenario: {
        ...entry.selector,
        engineId: entry.selector.engineId,
      },
      databaseRules,
      versionedRules: policy.rules,
    });
    if (effective.source !== 'database') return;
    bySelector.set(key, {
      ...entry,
      databaseOverride:
        databaseRules.find(
          (rule) => rule.id === effective.sourceRuleId
        ) ?? null,
    });
  });

  const eventTargetIds = [
    ...new Set(
      [...bySelector.values()].flatMap((entry) => [
        ...(entry.databaseOverride
          ? [entry.databaseOverride.id]
          : []),
        ...(entry.versionedRule ? [entry.versionedRule.id] : []),
      ])
    ),
  ];
  const latestEvents =
    loaded.status === 'loaded'
      ? await dependencies.listLatestEventsByTargets(
          'policy_rule',
          eventTargetIds
        )
      : [];
  const latestEventByTarget = new Map(
    latestEvents.map((event) => [event.targetId, event])
  );

  const rows = [...bySelector.values()].map(
    ({
      selector,
      versionedRule,
      databaseOverride,
    }): PricingPolicyInventoryRow => {
      const scenarios = selectAffectedPricingScenarios(selector);
      const representativeSurfaces = [
        'billing',
        'pricing-hub',
        'estimator',
        'price-chip',
        'model-page',
        'json-ld',
        'audio',
        'tool',
      ] as const;
      const representativeScenarios = representativeSurfaces
        .flatMap((surface) => {
          const scenario = scenarios.find(
            (candidate) => candidate.surface === surface
          );
          return scenario ? [scenario] : [];
        })
        .slice(0, 6);
      const outcomes = quoteCanonicalAdminScenarios({
        databaseRules,
        scenarios: representativeScenarios,
      });
      const representativeQuotes = outcomes
        .filter(
          (outcome): outcome is AdminCanonicalScenarioQuote =>
            outcome.status === 'quoted'
        )
        .slice(0, 4);
      const representativeScenario = scenarios[0];
      const matchedVersionedRule =
        versionedRule ??
        (representativeScenario
          ? resolvePricingPolicy({
              scenario: {
                engineId: representativeScenario.engineId,
                ...(representativeScenario.mode
                  ? { mode: representativeScenario.mode }
                  : {}),
                ...(representativeScenario.resolution
                  ? { resolution: representativeScenario.resolution }
                  : {}),
              },
              databaseRules: [],
              versionedRules: policy.rules,
            }).rule
          : null);
      const effectiveProvenance = representativeScenario
        ? (() => {
            const resolved = resolveCanonicalAdminScenarioPolicy({
              databaseRules,
              scenario: representativeScenario,
            });
            const compatibilityProfile =
              representativeQuotes[0]?.policyProvenance
                .compatibilityProfile ??
              resolved.rule.compatibilityProfile ??
              'standard';
            return {
              source: resolved.source,
              matchedBy: resolved.matchedBy,
              sourceRuleId: resolved.sourceRuleId,
              compatibilityProfile,
            };
          })()
        : null;
      const routing = databaseOverride
        ? routingRules.find(
            (rule) => rule.id === databaseOverride.id
          )
        : undefined;
      const targetId =
        databaseOverride?.id ?? matchedVersionedRule?.id;
      return {
        selector,
        versionedRule: matchedVersionedRule
          ? canonicalRule(matchedVersionedRule)
          : null,
        databaseOverride,
        effectiveProvenance,
        representativeQuotes,
        routingContext: routing
          ? {
              ...(routing.vendorAccountId
                ? { vendorAccountId: routing.vendorAccountId }
                : {}),
              ...(routing.effectiveFrom
                ? { effectiveFrom: routing.effectiveFrom }
                : {}),
              ...(routing.updatedAt
                ? { updatedAt: routing.updatedAt }
                : {}),
              ...(routing.updatedBy
                ? { updatedBy: routing.updatedBy }
                : {}),
            }
          : null,
        lastEvent: targetId
          ? latestEventByTarget.get(targetId) ?? null
          : null,
      };
    }
  );

  return {
    versionedPolicyVersion: policy.version,
    databaseStatus: loaded.status,
    warnings:
      loaded.status === 'unavailable'
        ? [
            'Pricing policy database is unavailable; showing versioned policy only.',
          ]
        : [],
    rows: rows.sort((left, right) =>
      scenarioSelectorKey(left.selector).localeCompare(
        scenarioSelectorKey(right.selector)
      )
    ),
  };
}
```

- [ ] **Step 4: Route read calls through the read model**

Delete `loadPricingPolicyHistory` and `loadPricingPolicyInventory` from `policy-service.ts`. Remove imports now used only by inventory/history, including `resolvePricingPolicy`, `PricingPolicyScenario`, `buildPricingAuditScenarios`, `getVersionedPricingPolicy`, `PricingPolicyInventoryResponse`, and `PricingPolicyInventoryRow`. Keep their public type re-exports from `policy-contract.ts`.

Add:

```ts
export {
  loadPricingPolicyHistory,
  loadPricingPolicyInventory,
} from './policy-read-model';
```

- [ ] **Step 5: Run the focused tests**

Run:

```bash
pnpm exec tsx --test \
  tests/admin-pricing-architecture.test.ts \
  tests/admin-pricing-policy-service.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
```

Expected: PASS, including inventory provenance, routing context, latest-event, and database-unavailable cases.

- [ ] **Step 6: Commit the read-model extraction**

```bash
git add \
  frontend/server/pricing-admin/policy-read-model.ts \
  frontend/server/pricing-admin/policy-service.ts \
  tests/admin-pricing-architecture.test.ts
git commit -m "refactor: extract pricing policy reads"
```

---

### Task 5: Extract transactional confirmation and reduce the public facade

**Files:**
- Create: `frontend/server/pricing-admin/policy-confirmation.ts`
- Replace: `frontend/server/pricing-admin/policy-service.ts`
- Modify: `tests/admin-pricing-architecture.test.ts`
- Test: `tests/admin-pricing-architecture.test.ts`
- Test: `tests/admin-pricing-policy-service.test.ts`

**Interfaces:**
- Consumes: `previewPricingPolicyChange`, `PricingPolicyServiceDependencies`, deterministic rule helpers, and the default dependency adapter.
- Produces: `confirmPricingPolicyChange(proposal, fingerprint, actorId, dependencies?)` and the final stable facade.

- [ ] **Step 1: Add failing confirmation and facade contracts**

Add:

```ts
const pricingPolicyConfirmationPath = join(
  root,
  'frontend/server/pricing-admin/policy-confirmation.ts'
);
const pricingPolicyFocusedPaths = [
  pricingPolicyContractPath,
  pricingPolicyDependenciesPath,
  pricingPolicyRulesPath,
  pricingPolicyPreviewPath,
  pricingPolicyReadModelPath,
  pricingPolicyConfirmationPath,
];

test('pricing policy confirmation owns the locked mutation and post-commit side effects', () => {
  assert.ok(existsSync(pricingPolicyConfirmationPath), 'pricing policy confirmation module should exist');
  const source = readOrEmpty(pricingPolicyConfirmationPath);

  assert.match(source, /export async function confirmPricingPolicyChange/);
  assert.match(source, /transactionPreview\s*=\s*await previewPricingPolicyChange/);
  assert.match(source, /loadOverrides:\s*\(\)\s*=>\s*dependencies\.loadOverrides\(executor\)/);
  assert.match(source, /dependencies\.insertEvent\(executor/);
  assert.match(source, /dependencies\.invalidateCache\(\)/);
  assert.match(source, /dependencies\.revalidate\(preview\)/);
});

test('pricing policy service is a thin stable facade over focused modules', () => {
  const facadeSource = readOrEmpty(pricingPolicyServicePath);
  assert.ok(facadeSource.split('\n').length <= 30, 'policy facade should stay at or below 30 lines');
  assert.doesNotMatch(
    facadeSource,
    /function |withTransaction|resolvePricingPolicy|quoteCanonicalAdminScenarios|buildPricingPreviewFingerprint/,
    'policy facade must contain re-exports only'
  );

  pricingPolicyFocusedPaths.forEach((path) => {
    assert.ok(existsSync(path), `${path} should exist`);
    const source = readOrEmpty(path);
    assert.ok(source.split('\n').length <= 350, `${path} should stay at or below 350 lines`);
    assert.doesNotMatch(
      source,
      /from ['"]\.\/policy-service['"]/,
      'focused modules must not import the facade'
    );
  });

  for (const routePath of pricingPolicyRoutePaths) {
    const source = readOrEmpty(routePath);
    assert.match(source, /@\/server\/pricing-admin\/policy-service/);
    assert.doesNotMatch(
      source,
      /@\/server\/pricing-admin\/policy-(contract|dependencies|rules|preview|read-model|confirmation)/,
      'routes must not bypass the stable facade'
    );
  }
});
```

Replace the existing `pricing confirmation performs a transaction-local locked preview check` test with:

```ts
test('pricing confirmation performs a transaction-local locked preview check', () => {
  const confirmationSource = readOrEmpty(pricingPolicyConfirmationPath);
  const dependenciesSource = readOrEmpty(pricingPolicyDependenciesPath);
  const storeSource = readFileSync(
    join(root, 'frontend/src/lib/pricing-rule-store.ts'),
    'utf8'
  );

  assert.match(
    confirmationSource,
    /loadOverrides:\s*\(\)\s*=>\s*dependencies\.loadOverrides\(executor\)/
  );
  assert.match(
    confirmationSource,
    /transactionPreview\s*=\s*await previewPricingPolicyChange/
  );
  assert.match(
    dependenciesSource,
    /loadPricingPolicyOverridesWithExecutor\(executor, \{ lock: true \}\)/
  );
  assert.match(
    storeSource,
    /LOCK TABLE app_pricing_rules IN SHARE ROW EXCLUSIVE MODE/
  );
  assert.match(storeSource, /options\.lock \? 'FOR UPDATE'/);
});
```

- [ ] **Step 2: Run the architecture test and verify it fails**

Run:

```bash
pnpm exec tsx --test tests/admin-pricing-architecture.test.ts
```

Expected: FAIL because `policy-confirmation.ts` does not exist and `policy-service.ts` is not yet a thin facade.

- [ ] **Step 3: Create the complete confirmation module**

Create `frontend/server/pricing-admin/policy-confirmation.ts` with:

```ts
import type { PricingPolicyRule } from '@maxvideoai/pricing';

import type {
  PricingChangeEvent,
  PricingChangeJsonObject,
  PricingChangeJsonValue,
} from '@/lib/admin/pricing-change-contract';

import { PricingAdminError } from './errors';
import type {
  PricingChangeConfirmation,
  PricingChangePreview,
  PricingPolicyChangeProposal,
  PricingPolicyServiceDependencies,
} from './policy-contract';
import { DEFAULT_POLICY_SERVICE_DEPENDENCIES } from './policy-dependencies';
import { previewPricingPolicyChange } from './policy-preview';
import { jsonRule, requiredText } from './policy-rules';

function previewSummary(
  preview: PricingChangePreview
): PricingChangeJsonObject {
  const deltas = preview.rows.map((row) => row.deltaCents);
  return {
    previewFingerprint: preview.previewFingerprint,
    affectedSurfaces: preview.affectedSurfaces,
    rowCount: preview.rows.length,
    deltaCents: preview.rows.reduce(
      (sum, row) => sum + row.deltaCents,
      0
    ),
    minimumDeltaCents: deltas.length ? Math.min(...deltas) : 0,
    maximumDeltaCents: deltas.length ? Math.max(...deltas) : 0,
    ...(preview.rollbackEventId
      ? { rollbackEventId: preview.rollbackEventId }
      : {}),
  };
}

export async function confirmPricingPolicyChange(
  proposal: PricingPolicyChangeProposal,
  fingerprint: string,
  actorId: string,
  dependencies: PricingPolicyServiceDependencies =
    DEFAULT_POLICY_SERVICE_DEPENDENCIES
): Promise<PricingChangeConfirmation> {
  const serverActorId = requiredText(actorId, 'actorId');
  const preview = await previewPricingPolicyChange(
    proposal,
    dependencies
  );
  if (!fingerprint || preview.previewFingerprint !== fingerprint) {
    throw new PricingAdminError(
      'preview_stale',
      'Pricing preview is stale; review the current impact again'
    );
  }

  let result: {
    persistedState: PricingChangeJsonValue | null;
    event: PricingChangeEvent;
  };
  try {
    result = await dependencies.withTransaction(async (executor) => {
      const transactionDependencies: PricingPolicyServiceDependencies = {
        ...dependencies,
        loadOverrides: () => dependencies.loadOverrides(executor),
        getEvent: (id, domain) =>
          dependencies.getEvent(id, domain, executor),
      };
      const transactionPreview = await previewPricingPolicyChange(
        proposal,
        transactionDependencies
      );
      if (transactionPreview.previewFingerprint !== fingerprint) {
        throw new PricingAdminError(
          'preview_stale',
          'Pricing preview became stale before persistence'
        );
      }
      let persistedState: PricingChangeJsonValue | null;
      if (transactionPreview.proposedState === null) {
        await dependencies.deleteRule(
          executor,
          transactionPreview.targetId
        );
        persistedState = null;
      } else {
        const persisted = await dependencies.upsertRule(
          executor,
          transactionPreview.proposedState as unknown as PricingPolicyRule,
          serverActorId
        );
        persistedState = jsonRule(persisted);
      }
      const event = await dependencies.insertEvent(executor, {
        domain: 'policy_rule',
        operation: transactionPreview.operation,
        targetId: transactionPreview.targetId,
        actorId: serverActorId,
        previousState: transactionPreview.currentState,
        nextState: transactionPreview.proposedState,
        previewSummary: previewSummary(transactionPreview),
        affectedScenarioIds: transactionPreview.affectedScenarioIds,
      });
      return { persistedState, event };
    });
  } catch (error) {
    if (error instanceof PricingAdminError) throw error;
    throw new PricingAdminError(
      'persistence_failed',
      'Failed to persist pricing policy change'
    );
  }

  const operationalWarnings:
    PricingChangeConfirmation['operationalWarnings'] = [];
  try {
    dependencies.invalidateCache();
  } catch {
    operationalWarnings.push({
      code: 'cache_invalidation_failed',
      message:
        'Pricing change committed; in-process cache invalidation failed.',
    });
  }
  try {
    dependencies.revalidate(preview);
  } catch {
    operationalWarnings.push({
      code: 'path_revalidation_failed',
      message:
        'Pricing change committed; public path revalidation failed.',
    });
  }
  return {
    committed: true,
    preview,
    ...result,
    operationalWarnings,
  };
}
```

- [ ] **Step 4: Replace the service with the exact stable facade**

Replace all content in `frontend/server/pricing-admin/policy-service.ts` with:

```ts
export { confirmPricingPolicyChange } from './policy-confirmation';
export {
  deriveRequestedPricingSurcharges,
  previewPricingPolicyChange,
} from './policy-preview';
export {
  loadPricingPolicyHistory,
  loadPricingPolicyInventory,
} from './policy-read-model';
export type {
  PricingChangeConfirmation,
  PricingChangePreview,
  PricingPolicyChangeProposal,
  PricingPolicyInventoryResponse,
  PricingPolicyInventoryRow,
  PricingPolicyServiceDependencies,
} from './policy-contract';
```

- [ ] **Step 5: Run focused tests, TypeScript, and the live architecture audit**

Run:

```bash
pnpm exec tsx --test \
  tests/admin-pricing-architecture.test.ts \
  tests/admin-pricing-policy-service.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm run architecture:audit -- --min-lines 500
```

Expected: tests and TypeScript PASS; `frontend/server/pricing-admin/policy-service.ts` no longer appears in the 500-line audit; every focused policy module satisfies the 350-line contract.

- [ ] **Step 6: Audit all public consumers**

Run:

```bash
rg -n "pricing-admin/policy-" frontend/app tests \
  --glob '!tests/admin-pricing-architecture.test.ts'
```

Expected: route consumers import only `pricing-admin/policy-service`; behavioral tests also import through the facade; no route imports a focused implementation module.

- [ ] **Step 7: Commit the transactional confirmation and final facade**

```bash
git add \
  frontend/server/pricing-admin/policy-confirmation.ts \
  frontend/server/pricing-admin/policy-service.ts \
  tests/admin-pricing-architecture.test.ts
git commit -m "refactor: extract pricing policy confirmation"
```

---

### Task 6: Refresh the roadmap and perform full commercial regression verification

**Files:**
- Modify: `docs/engineering/refactor-roadmap.md`
- Verify unchanged: `frontend/config/pricing-policy.json`
- Verify unchanged: `tests/fixtures/pricing-parity.v1.json`
- Verify unchanged: `tests/fixtures/pricing-public-projections.v1.json`
- Test: full repository validation and read-only admin smoke suite.

**Interfaces:**
- Consumes: final focused policy module layout and live architecture audit output.
- Produces: an accurate cleanup roadmap and a verified, review-ready batch with no commercial data changes.

- [ ] **Step 1: Prove the roadmap is stale before editing it**

Run:

```bash
rg -n "admin-transactions\.ts|policy-service\.ts" docs/engineering/refactor-roadmap.md
```

Expected: matches the stale candidate table and next-cleanup sequence.

- [ ] **Step 2: Record the completed admin transaction and pricing policy boundaries**

Add these bullets to `Recently Completed`:

```md
- Admin transactions: the public server module is a thin facade over focused read-model, top-up, refund, normalization, and type owners; manual refund writes remain transactionally serialized by job.
- Pricing policy administration: the public policy service is a thin facade over focused contract, dependency, deterministic rule, preview, confirmation, and read-model owners; preview fingerprints and transactional apply semantics remain unchanged.
```

Replace the `Current High-Signal Candidates` table with this refreshed post-refactor snapshot:

```md
| File | Lines | Risk and responsibility |
| --- | ---: | --- |
| `model-page-template-copy-additional.ts` | 6278 | content organization |
| `ModelDecisionPromptingSection.tsx` | 3114 | large marketing component |
| `compare-page-overrides-en.ts` | 2840 | localized content organization |
| `compare-page-overrides-es.ts` | 2757 | localized content organization |
| `compare-page-overrides-fr.ts` | 2757 | localized content organization |
| `model-page-template-copy.ts` | 1887 | content organization |
| `ModelExamplesSection.tsx` | 1589 | large marketing component |
| `pricingHubData.ts` | 1226 | pricing-sensitive presentation data |
| `pricingHubCopy.ts` | 737 | localized pricing content |
| `PayAsYouGoPageView.tsx` | 708 | marketing page composition |
| `WorkspaceComposerSurface.tsx` | 692 | workspace composer UI |
| `frontend/app/api/generate/route.ts` | 690 | high-blast-radius generation orchestration |
```

Replace `Next Cleanup Sequence` with:

```md
## Next Cleanup Sequence

Prefer this order unless product work changes the risk profile:

1. Treat the pricing policy and admin transaction server boundaries as complete; do not add another layer without a concrete behavior or ownership problem.
2. Treat large locale, comparison, and model copy files as a separate content-organization project with locale parity contracts.
3. Approach pricing hub presentation data as price-sensitive and require the immutable pricing acceptance guards for any structural change.
4. Refactor generation routes, webhooks, polling, storage, or wallet APIs only through dedicated regression plans because they have higher runtime blast radius.
```

Keep the sentence stating that the live audit, not the dated table, is authoritative.

- [ ] **Step 3: Confirm no commercial source, fixture, migration, route payload, or UI file changed**

Run:

```bash
git diff --name-only 97784764..HEAD
git diff --exit-code 97784764..HEAD -- \
  frontend/config/pricing-policy.json \
  tests/fixtures/pricing-parity.v1.json \
  tests/fixtures/pricing-public-projections.v1.json \
  neon/migrations \
  frontend/app/api/admin/pricing \
  'frontend/app/(core)/admin/pricing'
```

Expected: the name list contains only focused pricing-admin server modules, architecture tests, and the roadmap; the restricted diff exits 0 with no output.

- [ ] **Step 4: Run the immutable pricing acceptance guards**

Run:

```bash
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
pnpm --silent pricing:audit -- --json
```

Expected:

- billing baseline: 178 scenarios;
- canonical audit: 178 matches and 0 mismatches;
- public baseline: all 492 rows unchanged;
- no fixture file is modified.

- [ ] **Step 5: Run the complete repository verification**

Run:

```bash
pnpm test:validate
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm run architecture:audit -- --min-lines 500
pnpm --prefix frontend run build
git diff --check
```

Expected: every command exits 0; the validation suite has 0 failures; `policy-service.ts` is absent from the 500-line audit.

- [ ] **Step 6: Run the read-only admin smoke suite**

Run:

```bash
pnpm test:admin-smoke
```

Expected: PASS. Do not confirm, roll back, delete, or create a pricing rule against production data.

- [ ] **Step 7: Commit the roadmap**

```bash
git add docs/engineering/refactor-roadmap.md
git commit -m "docs: record pricing policy service split"
```

- [ ] **Step 8: Perform the final review gate**

Run:

```bash
git status --short --branch
git log --oneline 97784764..HEAD
git diff --stat 97784764..HEAD
git diff --check 97784764..HEAD
```

Expected: clean worktree; only the planned commits are present; no whitespace errors. Review the final diff specifically for public export drift, fingerprint input drift, transaction-boundary drift, and accidental commercial changes before any push.

## Final Acceptance Checklist

- [ ] `policy-service.ts` is a re-export-only facade at or below 30 lines.
- [ ] All six focused modules exist, have one responsibility, and stay at or below 350 lines.
- [ ] Routes import only the stable facade.
- [ ] Focused modules never import the facade.
- [ ] Public functions, parameters, return types, and error codes are unchanged.
- [ ] Preview fingerprint values, ordering, and serialization are unchanged.
- [ ] Confirmation still performs the second preview under the locked transaction.
- [ ] Rule persistence and immutable event insertion share the same `QueryExecutor`.
- [ ] Routing protections and default-rule deletion protection are unchanged.
- [ ] Post-commit cache and revalidation failures remain warnings.
- [ ] Billing audit reports 178 matches and 0 mismatches.
- [ ] All 492 public projection rows remain unchanged.
- [ ] No pricing policy, fixture, migration, admin route payload, or UI file changed.
- [ ] Full tests, lint, exposure, TypeScript, build, architecture audit, admin smoke, and `git diff --check` pass.
