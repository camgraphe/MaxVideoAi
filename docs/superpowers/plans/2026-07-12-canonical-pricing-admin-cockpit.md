# Canonical Pricing Admin Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mixed raw pricing editor with three domain-owned admin surfaces that require canonical server preview, explicit confirmation, immutable history, and previewed rollback without changing any current commercial value.

**Architecture:** A browser-safe shared contract describes proposals, previews, history, and errors. Server-only domain services reuse the canonical pricing audit scenarios and quote kernel, bind previews to current state with a deterministic fingerprint, and persist each confirmed mutation plus its immutable event in one database transaction. `/admin/pricing`, `/admin/membership`, and `/admin/billing-products` each get a route-local controller/view while sharing only generic preview and history presentation components.

**Tech Stack:** TypeScript, Next.js App Router, React, SWR, PostgreSQL/Neon, `@maxvideoai/pricing`, Node `node:test`, `tsx`, pnpm.

## Global Constraints

- Work on the current local `main` worktree and do not push.
- Preserve every current price, margin, surcharge, discount, currency, compatibility profile, membership value, fixed-product value, billing result, and public projection.
- Keep `quoteCanonicalPricing()` as the only commercial calculation kernel.
- Do not add scheduled changes; confirmed changes apply immediately.
- Do not accept totals, provenance, actor IDs, affected scenarios, or vendor routing fields as authoritative client input.
- Preserve existing `vendor_account_id` values on rule updates; new canonical pricing rules receive no routing override.
- Require preview, explicit confirmation, server recomputation, and a matching fingerprint before every mutation.
- Persist the mutation and immutable event in the same database transaction.
- Invalidate domain caches only after transaction commit.
- Use TDD for every production behavior change: run RED, implement the minimum, then run GREEN.
- Use `apply_patch` for authored edits and commit each completed task separately.
- Delete obsolete mixed-page components and direct mutation routes after their final consumer migrates.

---

## File Structure

### New shared files

- `frontend/lib/admin/pricing-change-contract.ts` — browser-safe proposal, preview, history, and error DTOs used by all three admin domains.
- `frontend/server/pricing-admin/errors.ts` — typed server errors and API status mapping.
- `frontend/server/pricing-admin/fingerprint.ts` — deterministic stable serialization and SHA-256 preview fingerprint.
- `frontend/server/pricing-admin/event-store.ts` — transactional insert-only event persistence and history reads.
- `frontend/server/pricing-admin/canonical-scenarios.ts` — affected-scenario selection and current/proposed canonical quote comparison over the existing audit scenario inventory.
- `frontend/server/pricing-admin/revalidation.ts` — targeted post-commit revalidation for affected pricing and model paths.
- `frontend/server/pricing-admin/policy-service.ts` — policy inventory, preview, confirmation, delete, history, and rollback orchestration.
- `frontend/server/pricing-admin/membership-service.ts` — tier inventory, preview, confirmation, history, and rollback orchestration.
- `frontend/server/pricing-admin/billing-product-service.ts` — live product inventory, preview, confirmation, history, and rollback orchestration.
- `frontend/components/admin-system/pricing/AdminPricingChangePreviewDialog.tsx` — generic explicit-confirmation dialog.
- `frontend/components/admin-system/pricing/AdminPricingHistory.tsx` — generic immutable history and rollback action surface.
- `neon/migrations/27_pricing_admin_cockpit.sql` — canonical rule columns, immutable change-event table, and indexes.

### New policy cockpit files

- `frontend/app/(core)/admin/pricing/_components/AdminPricingCockpit.tsx`
- `frontend/app/(core)/admin/pricing/_components/PricingPolicyTable.tsx`
- `frontend/app/(core)/admin/pricing/_components/PricingPolicyInspector.tsx`
- `frontend/app/(core)/admin/pricing/_hooks/useAdminPricingCockpitController.ts`
- `frontend/app/(core)/admin/pricing/_lib/pricing-cockpit-view-model.ts`
- `frontend/app/api/admin/pricing/inventory/route.ts`
- `frontend/app/api/admin/pricing/preview/route.ts`
- `frontend/app/api/admin/pricing/confirm/route.ts`
- `frontend/app/api/admin/pricing/history/route.ts`

### New membership files

- `frontend/app/(core)/admin/membership/page.tsx`
- `frontend/app/(core)/admin/membership/_components/AdminMembershipView.tsx`
- `frontend/app/(core)/admin/membership/_hooks/useAdminMembershipController.ts`
- `frontend/app/(core)/admin/membership/_lib/membership-admin-view-model.ts`
- `frontend/app/api/admin/membership/route.ts`
- `frontend/app/api/admin/membership/preview/route.ts`
- `frontend/app/api/admin/membership/confirm/route.ts`
- `frontend/app/api/admin/membership/history/route.ts`

### New billing-product files

- `frontend/app/(core)/admin/billing-products/page.tsx`
- `frontend/app/(core)/admin/billing-products/_components/AdminBillingProductsView.tsx`
- `frontend/app/(core)/admin/billing-products/_hooks/useAdminBillingProductsController.ts`
- `frontend/app/(core)/admin/billing-products/_lib/billing-products-admin-view-model.ts`
- `frontend/app/api/admin/billing-products/preview/route.ts`
- `frontend/app/api/admin/billing-products/confirm/route.ts`
- `frontend/app/api/admin/billing-products/history/route.ts`

### Existing files changed or removed

- `frontend/src/lib/schema/billing-core-schema.ts` — runtime-safe schema alignment matching the Neon migration.
- `frontend/src/lib/pricing-rule-store.ts` — full canonical selector/profile fields, actor metadata, executor-aware mutations, and routing-value preservation.
- `packages/pricing/src/policy.ts` and `packages/pricing/src/index.ts` — validate database override sets with the same canonical field/reference rules without requiring a DB-global rule.
- `frontend/src/lib/pricing-audit/canonical-collectors.ts` — delegate canonical scenario quoting to a reusable pure projector rather than owning a second admin comparison.
- `frontend/src/lib/membership.ts` — executor-aware transactional persistence and cache invalidation boundary.
- `frontend/src/lib/billing-products.ts` — executor-aware persistence, explicit cache invalidation, and reusable pure fixed-product projection.
- `frontend/lib/admin/navigation.ts` — expose Pricing policy, Membership, and Billing products.
- `frontend/app/(core)/admin/pricing/page.tsx` — small authenticated route orchestrator.
- `frontend/app/api/admin/billing-products/route.ts` — inventory-only GET after direct PUT removal.
- Remove `frontend/app/api/admin/membership-tiers/route.ts`.
- Remove `frontend/app/api/admin/pricing/rules/route.ts`.
- Remove `frontend/app/api/admin/pricing/rules/[ruleId]/route.ts`.
- Remove `frontend/app/(core)/admin/pricing/_components/BillingProductCard.tsx`.
- Remove `frontend/app/(core)/admin/pricing/_components/NewPricingRuleCard.tsx`.
- Remove `frontend/app/(core)/admin/pricing/_components/PricingRuleCard.tsx`.
- Remove or relocate `frontend/app/(core)/admin/pricing/_components/PricingAdminField.tsx` only if an active shared consumer remains.
- Replace `frontend/app/(core)/admin/pricing/_lib/pricing-admin-helpers.ts` and `pricing-admin-types.ts` with the focused cockpit modules above.
- `tests/admin-pricing-architecture.test.ts` — replace the obsolete mixed-page contract.
- Add `tests/admin-pricing-change-contract.test.ts`.
- Add `tests/admin-pricing-event-store.test.ts`.
- Add `tests/admin-pricing-preview.test.ts`.
- Add `tests/admin-pricing-policy-service.test.ts`.
- Add `tests/admin-membership-pricing.test.ts`.
- Add `tests/admin-billing-products-pricing.test.ts`.
- Add `tests/admin-commercial-routes-architecture.test.ts`.
- Update `tests/e2e/admin-critical-flows.spec.ts` and `tests/e2e/admin-smoke.spec.ts`.
- Update `docs/engineering/pricing-engine.md`, `docs/engineering/admin-routes.md`, and the canonical pricing design status.

---

### Task 1: Align canonical rule persistence and add immutable event storage

**Files:**

- Create: `neon/migrations/27_pricing_admin_cockpit.sql`
- Modify: `frontend/src/lib/schema/billing-core-schema.ts`
- Modify: `frontend/src/lib/pricing-rule-store.ts`
- Create: `frontend/lib/admin/pricing-change-contract.ts`
- Create: `frontend/server/pricing-admin/event-store.ts`
- Create: `tests/admin-pricing-change-contract.test.ts`
- Create: `tests/admin-pricing-event-store.test.ts`
- Modify: `tests/pricing-policy.test.ts`

**Interfaces:**

- `PricingChangeDomain = 'policy_rule' | 'membership' | 'billing_product'`
- `PricingChangeOperation = 'create' | 'update' | 'delete' | 'rollback'`
- `insertPricingChangeEvent(executor, input): Promise<PricingChangeEvent>`
- `listPricingChangeEvents(input, executor?): Promise<PricingChangeEvent[]>`
- `upsertPricingRuleWithExecutor(executor, input, actorId): Promise<PricingRule>`
- `deletePricingRuleWithExecutor(executor, id): Promise<PricingRule>`

- [ ] **Step 1: Write failing persistence and event-contract tests**

Add tests that require rule round-trip for `mode`, `surchargeAudioPercent`, `surchargeUpscalePercent`, `compatibilityProfile`, `updatedAt`, and `updatedBy`; require update SQL to leave `vendor_account_id` untouched; require event rows to carry domain, operation, target, actor, previous/next state, preview summary, affected scenario IDs, and timestamp.

```ts
assert.deepEqual(mapPricingRuleRow(raw), {
  id: 'rule-kling-t2v-1080p',
  engineId: 'kling-3-pro',
  mode: 't2v',
  resolution: '1080p',
  marginPercent: 0.3,
  marginFlatCents: 0,
  surchargeAudioPercent: 0.2,
  surchargeUpscalePercent: 0.5,
  currency: 'USD',
  compatibilityProfile: 'standard',
  vendorAccountId: 'acct_existing',
  updatedAt: '2026-07-12T10:00:00.000Z',
  updatedBy: '00000000-0000-0000-0000-000000000001',
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/admin-pricing-change-contract.test.ts \
  tests/admin-pricing-event-store.test.ts \
  tests/pricing-policy.test.ts
```

Expected: FAIL because the canonical columns, event store, shared contracts, and executor-aware mutations do not exist.

- [ ] **Step 3: Add the schema migration and runtime schema**

The migration and runtime schema must add nullable rule columns without changing existing values:

```sql
ALTER TABLE app_pricing_rules
  ADD COLUMN IF NOT EXISTS mode TEXT,
  ADD COLUMN IF NOT EXISTS compatibility_profile TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by UUID;

CREATE TABLE IF NOT EXISTS app_pricing_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL CHECK (domain IN ('policy_rule', 'membership', 'billing_product')),
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'rollback')),
  target_id TEXT NOT NULL,
  actor_id UUID NOT NULL,
  previous_state JSONB,
  next_state JSONB,
  preview_summary JSONB NOT NULL,
  affected_scenario_ids JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Add indexes on `(domain, target_id, created_at DESC)` and `(actor_id, created_at DESC)`.

- [ ] **Step 4: Implement full rule mapping and executor-aware persistence**

Export `mapPricingRuleRow`. Read and write the complete canonical fields. For updates, omit `vendor_account_id` from the `DO UPDATE SET` list. For creates, pass `NULL` for routing. Return the previous row from delete so the event can preserve it. Do not invalidate cache inside executor-aware functions; confirmation services own post-commit invalidation.

- [ ] **Step 5: Implement the browser-safe contract and event store**

The shared contract must contain serializable DTOs only. The event store accepts `QueryExecutor`, inserts exactly one event, maps JSON fields defensively, and supports domain/target/limit history filters with a maximum limit of 200.

- [ ] **Step 6: Run GREEN and existing policy/store tests**

Run the Step 2 command plus:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/pricing-architecture.test.ts \
  tests/pricing-foundation-architecture.test.ts
git diff --check
```

Expected: PASS; committed pricing policy values and precedence remain unchanged.

- [ ] **Step 7: Commit**

```bash
git add neon/migrations/27_pricing_admin_cockpit.sql frontend/src/lib/schema/billing-core-schema.ts frontend/src/lib/pricing-rule-store.ts frontend/lib/admin/pricing-change-contract.ts frontend/server/pricing-admin/event-store.ts tests/admin-pricing-change-contract.test.ts tests/admin-pricing-event-store.test.ts tests/pricing-policy.test.ts
git commit -m "feat: add transactional pricing change history"
```

---

### Task 2: Build the shared canonical preview and stale-fingerprint engine

**Files:**

- Create: `frontend/server/pricing-admin/errors.ts`
- Create: `frontend/server/pricing-admin/fingerprint.ts`
- Create: `frontend/server/pricing-admin/canonical-scenarios.ts`
- Modify: `frontend/src/lib/pricing-audit/canonical-collectors.ts`
- Create: `tests/admin-pricing-preview.test.ts`
- Modify: `tests/pricing-shadow.test.ts`

**Interfaces:**

- `buildPricingPreviewFingerprint(input): string`
- `selectAffectedPricingScenarios(selector): PricingAuditScenario[]`
- `quoteCanonicalAdminScenarios(input): AdminCanonicalScenarioQuote[]`
- `compareCanonicalAdminScenarios(current, proposed): PricingChangePreviewRow[]`
- `PricingAdminError` with stable code and HTTP status.

- [ ] **Step 1: Write failing pure preview tests**

Cover stable fingerprints independent of object-key order, fingerprint changes when current state/version/scenarios/proposal change, affected-scenario selection for global/engine/mode/resolution/precise selectors, canonical current/proposed deltas, provenance, compatibility profiles, and zero-current delta percent.

```ts
const current = quoteCanonicalAdminScenarios({ databaseRules: [globalRule], scenarios: [kling720, kling1080, veo1080] });
const proposed = quoteCanonicalAdminScenarios({
  databaseRules: [globalRule, kling1080Rule],
  scenarios: [kling720, kling1080, veo1080],
});
const preview = compareCanonicalAdminScenarios(current, proposed);
assert.deepEqual(preview.map((row) => row.scenarioId), [kling1080.id]);
assert.equal(preview[0]?.currentTotalCents, 130);
assert.equal(preview[0]?.proposedTotalCents, 140);
assert.equal(preview[0]?.deltaCents, 10);
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-pricing-preview.test.ts
```

Expected: FAIL because no shared preview engine exists.

- [ ] **Step 3: Extract a reusable canonical scenario projector**

Move the pure scenario-to-quote loop out of `canonical-collectors.ts`. It must accept explicit database rules and membership discount maps, reuse `buildPricingAuditScenarios()` and `buildCanonicalPricingFacts()`, and return quote/provenance data without loading the database or legacy fixture.

The audit collector continues calling the projector with no DB rules and its frozen-output formatting. This prevents an admin-only calculation path.

- [ ] **Step 4: Implement selector filtering, comparison, and fingerprinting**

Use the canonical selector semantics. Fingerprinting uses `node:crypto` SHA-256 over stable JSON containing domain, operation, target, normalized current state, normalized proposed state, versioned policy version, and sorted affected scenario IDs. Do not use a client-provided fingerprint payload.

- [ ] **Step 5: Implement typed errors**

Map domain codes to statuses: validation `400`, missing target `404`, stale preview `409`, database unavailable `503`, persistence failure `500`. Route handlers later serialize `{ ok: false, error: { code, message } }`.

- [ ] **Step 6: Run GREEN and audit parity**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/admin-pricing-preview.test.ts \
  tests/pricing-shadow.test.ts \
  tests/pricing-canonical-kernel.test.ts
pnpm pricing:audit
```

Expected: PASS; audit remains 178/178 with 0 mismatches.

- [ ] **Step 7: Commit**

```bash
git add frontend/server/pricing-admin/errors.ts frontend/server/pricing-admin/fingerprint.ts frontend/server/pricing-admin/canonical-scenarios.ts frontend/src/lib/pricing-audit/canonical-collectors.ts tests/admin-pricing-preview.test.ts tests/pricing-shadow.test.ts
git commit -m "feat: add canonical pricing impact previews"
```

---

### Task 3: Add policy inventory, preview, confirmation, history, and rollback APIs

**Files:**

- Create: `frontend/server/pricing-admin/policy-service.ts`
- Create: `frontend/app/api/admin/pricing/inventory/route.ts`
- Create: `frontend/app/api/admin/pricing/preview/route.ts`
- Create: `frontend/app/api/admin/pricing/confirm/route.ts`
- Create: `frontend/app/api/admin/pricing/history/route.ts`
- Create: `frontend/server/pricing-admin/revalidation.ts`
- Modify: `packages/pricing/src/policy.ts`
- Modify: `packages/pricing/src/index.ts`
- Create: `tests/admin-pricing-policy-service.test.ts`
- Modify: `tests/admin-pricing-architecture.test.ts`
- Modify: `tests/pricing-policy.test.ts`

**Interfaces:**

- `loadPricingPolicyInventory(): Promise<PricingPolicyInventoryResponse>`
- `previewPricingPolicyChange(proposal, dependencies?): Promise<PricingChangePreview>`
- `confirmPricingPolicyChange(proposal, fingerprint, actorId, dependencies?): Promise<PricingChangeConfirmation>`
- `loadPricingPolicyHistory(filter): Promise<PricingChangeEvent[]>`
- `validatePricingPolicyOverrides(input, policyDocument, references): PricingPolicyRule[]`
- `revalidatePricingChangeSurfaces(preview): void`

- [ ] **Step 1: Write failing service tests with injected real-behavior dependencies**

Test create/update/delete/rollback previews, complete schema validation, unknown catalog references, ambiguity within the database override set, valid DB selectors that intentionally overlap versioned selectors, default deletion rejection, server recomputation, stale fingerprint rejection, database-unavailable failure, transaction atomicity, actor ownership, routing preservation, one event per success, and cache/path invalidation after commit only.

```ts
await assert.rejects(
  confirmPricingPolicyChange(proposal, staleFingerprint, actorId, deps),
  (error: unknown) => error instanceof PricingAdminError && error.code === 'preview_stale'
);
assert.equal(deps.persistCalls.length, 0);
assert.equal(deps.invalidateCalls.length, 0);
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-pricing-policy-service.test.ts tests/admin-pricing-architecture.test.ts
```

Expected: FAIL because the service and preview-required routes do not exist.

- [ ] **Step 3: Implement policy proposal normalization and inventory**

Normalize all canonical fields once on the server. Add `validatePricingPolicyOverrides()` to the canonical package so DB rules use the same number, currency, reference, compatibility-profile, identity, and selector validation as versioned rules without requiring a DB-global rule. Reject ambiguity inside the proposed DB set while allowing a DB selector to override the same versioned selector. Expose versioned rule, DB override, effective provenance, representative quotes, stored routing context, and last event metadata.

- [ ] **Step 4: Implement preview and confirmation**

Preview loads fresh rules, applies the proposal in memory, quotes affected scenarios through Task 2, and returns a fingerprint. Confirmation calls the same preview builder again, compares fingerprints, then uses `withDbTransaction()` to mutate the rule and insert the immutable event. Invalidate `invalidatePricingRulesCache()` and call the targeted revalidation helper only after the transaction resolves.

`revalidatePricingChangeSurfaces()` maps affected pricing-hub surfaces to `/pricing`, `/fr/tarifs`, and `/es/precios`, and maps affected model scenarios to the exact English/French/Spanish model paths derived from their catalog slug. It does not invalidate unrelated admin, blog, workspace, or site routes.

- [ ] **Step 5: Implement history and rollback**

History reads Task 1 events. A rollback proposal references `eventId`; the server loads the event and derives the proposed state from `previousState`. Client-supplied rollback state is ignored. Rollback confirmation uses the same recomputation and transaction path with operation `rollback`.

- [ ] **Step 6: Implement thin authorized route handlers**

Every handler calls `requireAdmin(req)`. Inventory/history return reads; preview parses only domain proposal fields; confirm accepts `{ proposal, previewFingerprint }`. No handler contains commercial normalization, SQL, or quote math.

- [ ] **Step 7: Run GREEN and authorization/architecture tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/admin-pricing-policy-service.test.ts \
  tests/admin-pricing-architecture.test.ts \
  tests/pricing-billing-authority.test.ts \
  tests/pricing-public-authority.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/pricing/src/policy.ts packages/pricing/src/index.ts frontend/server/pricing-admin/policy-service.ts frontend/server/pricing-admin/revalidation.ts frontend/app/api/admin/pricing/inventory/route.ts frontend/app/api/admin/pricing/preview/route.ts frontend/app/api/admin/pricing/confirm/route.ts frontend/app/api/admin/pricing/history/route.ts tests/admin-pricing-policy-service.test.ts tests/admin-pricing-architecture.test.ts tests/pricing-policy.test.ts
git commit -m "feat: add previewed pricing policy mutations"
```

---

### Task 4: Replace the raw pricing-rule cards with the canonical cockpit UI

**Files:**

- Rewrite: `frontend/app/(core)/admin/pricing/page.tsx`
- Create: `frontend/app/(core)/admin/pricing/_components/AdminPricingCockpit.tsx`
- Create: `frontend/app/(core)/admin/pricing/_components/PricingPolicyTable.tsx`
- Create: `frontend/app/(core)/admin/pricing/_components/PricingPolicyInspector.tsx`
- Create: `frontend/app/(core)/admin/pricing/_hooks/useAdminPricingCockpitController.ts`
- Create: `frontend/app/(core)/admin/pricing/_lib/pricing-cockpit-view-model.ts`
- Create: `frontend/components/admin-system/pricing/AdminPricingChangePreviewDialog.tsx`
- Modify: `tests/admin-pricing-architecture.test.ts`
- Modify: `tests/e2e/admin-critical-flows.spec.ts`

**Interfaces:**

- Controller exposes inventory, filters, selected row, proposal draft, preview, confirmation, history refresh, loading, and typed error state.
- Preview dialog accepts a `PricingChangePreview`, explicit confirm callback, cancel callback, and busy state.

- [ ] **Step 1: Write failing UI architecture and interaction contracts**

Require the route file under 60 lines, authenticated server orchestration, route-local controller/view, table and inspector, generic preview dialog, all canonical fields, no membership/product fetches, no direct `/rules` mutations, and no pricing kernel/server imports in client modules.

- [ ] **Step 2: Run RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-pricing-architecture.test.ts
```

Expected: FAIL against the mixed page and raw cards.

- [ ] **Step 3: Implement the route orchestrator and controller**

`page.tsx` calls `requireAdmin()` and renders `AdminPricingCockpit`. The controller uses SWR for inventory/history, keeps filters and selection local, posts proposals to preview, opens the dialog only on success, confirms with the returned fingerprint, and refreshes only after a successful confirmation.

- [ ] **Step 4: Implement table, inspector, and preview dialog**

Use `AdminDataTable`, `AdminFilterBar`, `AdminInspectorPanel`, `AdminMetricGrid`, `AdminNotice`, and `AdminEmptyState`. The inspector edits engine, mode, resolution, margin %, flat cents, audio surcharge %, upscale surcharge %, currency, and compatibility profile. Vendor account is read-only context.

The dialog shows current/proposed totals, deltas, surfaces, provenance, warnings, and an explicit `Confirm and apply now` action. It never allows editing preview results.

- [ ] **Step 5: Run GREEN, lint, and focused browser flow**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-pricing-architecture.test.ts tests/admin-pricing-policy-service.test.ts
pnpm --prefix frontend run lint
```

Use local admin auth against the configured database to verify inventory, filtering, selection, preview, and cancel without persisting a change. Exercise stale confirmation against injected service dependencies or an isolated disposable test database, never against an operational database.

- [ ] **Step 6: Commit**

```bash
git add 'frontend/app/(core)/admin/pricing/page.tsx' 'frontend/app/(core)/admin/pricing/_components/AdminPricingCockpit.tsx' 'frontend/app/(core)/admin/pricing/_components/PricingPolicyTable.tsx' 'frontend/app/(core)/admin/pricing/_components/PricingPolicyInspector.tsx' 'frontend/app/(core)/admin/pricing/_hooks/useAdminPricingCockpitController.ts' 'frontend/app/(core)/admin/pricing/_lib/pricing-cockpit-view-model.ts' frontend/components/admin-system/pricing/AdminPricingChangePreviewDialog.tsx tests/admin-pricing-architecture.test.ts tests/e2e/admin-critical-flows.spec.ts
git commit -m "feat: build canonical pricing policy cockpit"
```

---

### Task 5: Move membership to its own previewed transactional domain

**Files:**

- Modify: `frontend/src/lib/membership.ts`
- Create: `frontend/server/pricing-admin/membership-service.ts`
- Create: `frontend/app/api/admin/membership/route.ts`
- Create: `frontend/app/api/admin/membership/preview/route.ts`
- Create: `frontend/app/api/admin/membership/confirm/route.ts`
- Create: `frontend/app/api/admin/membership/history/route.ts`
- Create: `frontend/app/(core)/admin/membership/page.tsx`
- Create: `frontend/app/(core)/admin/membership/_components/AdminMembershipView.tsx`
- Create: `frontend/app/(core)/admin/membership/_hooks/useAdminMembershipController.ts`
- Create: `frontend/app/(core)/admin/membership/_lib/membership-admin-view-model.ts`
- Create: `tests/admin-membership-pricing.test.ts`
- Create: `tests/admin-commercial-routes-architecture.test.ts`

**Interfaces:**

- `previewMembershipChange({ tiers }): Promise<PricingChangePreview>`
- `confirmMembershipChange({ tiers }, fingerprint, actorId): Promise<PricingChangeConfirmation>`
- `upsertMembershipTiersWithExecutor(executor, tiers, actorId): Promise<MembershipTierConfig[]>`

- [ ] **Step 1: Write failing membership service and route tests**

Require exactly `member`, `plus`, and `pro`; validate non-negative ordered thresholds and discounts in `[0, 1]`; show current/proposed canonical totals for affected tiers; reject stale confirmation and database-unavailable mutation; save all tiers plus one event transactionally; and invalidate membership cache/relevant pricing paths only after commit.

- [ ] **Step 2: Run RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-membership-pricing.test.ts tests/admin-commercial-routes-architecture.test.ts
```

- [ ] **Step 3: Implement executor-aware membership persistence and service**

Replace the per-tier independent `query()` loop in the confirmation path with executor-bound upserts. Preview uses Task 2 scenario quotes twice with current and proposed discount maps. Threshold-only changes still produce a preview row summarizing eligibility state even when quote totals are unchanged.

- [ ] **Step 4: Implement authorized APIs and route-local UI**

The page edits all three tiers, previews once, confirms all tiers atomically, and exposes history/rollback. It uses the shared preview dialog. No membership state remains in `/admin/pricing`.

- [ ] **Step 5: Run GREEN and regression tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/admin-membership-pricing.test.ts \
  tests/admin-commercial-routes-architecture.test.ts \
  tests/pricing-billing-projection.test.ts \
  tests/pricing-public-projection.test.ts
pnpm --prefix frontend run lint
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/membership.ts frontend/server/pricing-admin/membership-service.ts frontend/app/api/admin/membership 'frontend/app/(core)/admin/membership' tests/admin-membership-pricing.test.ts tests/admin-commercial-routes-architecture.test.ts
git commit -m "feat: add previewed membership pricing controls"
```

---

### Task 6: Move live fixed products to their own previewed transactional domain

**Files:**

- Modify: `frontend/src/lib/billing-products.ts`
- Create: `frontend/server/pricing-admin/billing-product-service.ts`
- Modify: `frontend/app/api/admin/billing-products/route.ts`
- Create: `frontend/app/api/admin/billing-products/preview/route.ts`
- Create: `frontend/app/api/admin/billing-products/confirm/route.ts`
- Create: `frontend/app/api/admin/billing-products/history/route.ts`
- Create: `frontend/app/(core)/admin/billing-products/page.tsx`
- Create: `frontend/app/(core)/admin/billing-products/_components/AdminBillingProductsView.tsx`
- Create: `frontend/app/(core)/admin/billing-products/_hooks/useAdminBillingProductsController.ts`
- Create: `frontend/app/(core)/admin/billing-products/_lib/billing-products-admin-view-model.ts`
- Create: `tests/admin-billing-products-pricing.test.ts`
- Modify: `tests/admin-commercial-routes-architecture.test.ts`

**Interfaces:**

- `listReferencedBillingProductKeys(): ReadonlySet<string>`
- `buildCanonicalFixedProductSnapshot(input): PricingSnapshot`
- `previewBillingProductChange(proposal): Promise<PricingChangePreview>`
- `confirmBillingProductChange(proposal, fingerprint, actorId): Promise<PricingChangeConfirmation>`
- `updateBillingProductWithExecutor(executor, proposal): Promise<BillingProductRecord>`

- [ ] **Step 1: Write failing live-inventory and transactional tests**

Require the inventory to include every product key produced by Character Builder quality modes, Angle engine/output variants, `UPSCALE_TOOL_ENGINES`, and `BACKGROUND_REMOVAL_TOOL_ENGINES`; exclude unreferenced legacy controls; preserve historical DB rows; preview active/price/label/currency changes through the canonical fixed-product projector; reject stale and database-unavailable mutations; commit one product plus one event; and invalidate only after commit.

- [ ] **Step 2: Run RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-billing-products-pricing.test.ts tests/admin-commercial-routes-architecture.test.ts
```

- [ ] **Step 3: Expose a pure fixed-product projector and executor mutation**

Rename/export the existing private fixed-product builder as a pure canonical helper used by production billing and admin preview. Do not duplicate margin or discount math. Add an executor-aware update function that does not invalidate cache internally.

- [ ] **Step 4: Implement service, APIs, and UI**

`listReferencedBillingProductKeys()` derives live keys by enumerating the exported Character Builder key helper for both quality modes, the Angle key helper for every supported engine and single/multi output, `frontend/src/config/tools-upscale-engines.ts`, and `frontend/src/config/tools-background-removal-engines.ts`. It does not create another authored product-key list and does not use `metadata.legacy` as the owner. Preview reports product surface and canonical current/proposed totals. The page uses a filterable table, inspector, shared preview dialog, history, and rollback.

- [ ] **Step 5: Run GREEN and product billing regressions**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/admin-billing-products-pricing.test.ts \
  tests/admin-commercial-routes-architecture.test.ts \
  tests/background-removal-pricing.test.ts \
  tests/upscale-pricing-preview.test.ts \
  tests/pricing-billing-migration.test.ts
pnpm pricing:public-baseline
pnpm --prefix frontend run lint
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/billing-products.ts frontend/server/pricing-admin/billing-product-service.ts frontend/app/api/admin/billing-products 'frontend/app/(core)/admin/billing-products' tests/admin-billing-products-pricing.test.ts tests/admin-commercial-routes-architecture.test.ts
git commit -m "feat: add previewed billing product controls"
```

---

### Task 7: Add shared history UI, complete rollback, and delete obsolete admin flows

**Files:**

- Create: `frontend/components/admin-system/pricing/AdminPricingHistory.tsx`
- Modify: all three admin controllers/views to consume shared history/rollback.
- Modify: `frontend/lib/admin/navigation.ts`
- Remove: `frontend/app/api/admin/membership-tiers/route.ts`
- Remove: `frontend/app/api/admin/pricing/rules/route.ts`
- Remove: `frontend/app/api/admin/pricing/rules/[ruleId]/route.ts`
- Remove: `frontend/app/(core)/admin/pricing/_components/BillingProductCard.tsx`
- Remove: `frontend/app/(core)/admin/pricing/_components/NewPricingRuleCard.tsx`
- Remove: `frontend/app/(core)/admin/pricing/_components/PricingRuleCard.tsx`
- Remove: superseded pricing admin helpers/types/field when no active consumer remains.
- Rewrite: `tests/admin-pricing-architecture.test.ts`
- Modify: `tests/admin-commercial-routes-architecture.test.ts`
- Modify: `tests/e2e/admin-smoke.spec.ts`

- [ ] **Step 1: Write failing deletion, navigation, history, and rollback contracts**

Require three nav entries, absence of old files/endpoints, no direct `PUT`/`DELETE` commercial route, history rendering of actor/time/operation/delta, rollback initiating a fresh preview, and no client-provided historical state.

- [ ] **Step 2: Run RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/admin-pricing-architecture.test.ts \
  tests/admin-commercial-routes-architecture.test.ts
```

- [ ] **Step 3: Implement shared history and rollback presentation**

`AdminPricingHistory` renders immutable events and exposes `Preview rollback` only when the event has a restorable previous state. Controllers send `{ operation: 'rollback', targetId, eventId }`; services derive state server-side and open the normal preview dialog.

- [ ] **Step 4: Update navigation and delete superseded code**

Add `Pricing policy`, `Membership`, and `Billing products` operation links. Remove old direct endpoints, mixed cards, duplicated conversion helpers, membership/product sections from pricing, and unused types. Confirm with `rg` that no consumer references removed paths.

- [ ] **Step 5: Run GREEN, exposure, TypeScript, and admin E2E**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/admin-pricing-architecture.test.ts \
  tests/admin-commercial-routes-architecture.test.ts \
  tests/admin-pricing-policy-service.test.ts \
  tests/admin-membership-pricing.test.ts \
  tests/admin-billing-products-pricing.test.ts
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
```

Run the admin Playwright smoke suite with local admin auth. Against the configured operational database, verify all three pages, inventory, preview, cancel, history reads, and rollback preview without confirmation. Run confirmation, stale rejection, history creation, rollback confirmation, and state restoration only against an isolated disposable test database.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/admin-system/pricing/AdminPricingHistory.tsx frontend/lib/admin/navigation.ts 'frontend/app/(core)/admin/pricing' 'frontend/app/(core)/admin/membership' 'frontend/app/(core)/admin/billing-products' frontend/app/api/admin/pricing frontend/app/api/admin/membership frontend/app/api/admin/billing-products tests/admin-pricing-architecture.test.ts tests/admin-commercial-routes-architecture.test.ts tests/e2e/admin-smoke.spec.ts
git add -u frontend/app/api/admin/membership-tiers frontend/app/api/admin/pricing/rules
git commit -m "refactor: remove obsolete pricing admin flows"
```

---

### Task 8: Document and verify the operational pricing workflow

**Files:**

- Modify: `docs/engineering/pricing-engine.md`
- Modify: `docs/engineering/admin-routes.md`
- Modify: `docs/superpowers/specs/2026-07-12-canonical-pricing-engine-design.md`
- Modify: `docs/superpowers/specs/2026-07-12-canonical-pricing-admin-cockpit-design.md`
- Modify: `tests/pricing-foundation-architecture.test.ts`
- Modify: `tests/pricing-billing-authority.test.ts`
- Modify: `tests/admin-pricing-architecture.test.ts`

- [ ] **Step 1: Update documentation contracts**

Document the three owners, preview-confirm workflow, stale protection, immutable events, rollback-as-new-event, immediate application, routing-field exclusion, database-unavailable behavior, and exact commands for safe price changes. Mark canonical pricing subproject 4 complete only after all verification below passes.

- [ ] **Step 2: Run pricing invariants**

```bash
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
pnpm --silent pricing:audit -- --json
```

Expected: 178 baseline rows current; 492 public rows current; 178 matches; 0 mismatches; 4 compatibility profiles in use.

- [ ] **Step 3: Run all focused admin and pricing suites**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/admin-pricing-change-contract.test.ts \
  tests/admin-pricing-event-store.test.ts \
  tests/admin-pricing-preview.test.ts \
  tests/admin-pricing-policy-service.test.ts \
  tests/admin-membership-pricing.test.ts \
  tests/admin-billing-products-pricing.test.ts \
  tests/admin-pricing-architecture.test.ts \
  tests/admin-commercial-routes-architecture.test.ts \
  tests/pricing-policy.test.ts \
  tests/pricing-billing-authority.test.ts \
  tests/pricing-public-authority.test.ts \
  tests/pricing-public-projection.test.ts
```

- [ ] **Step 4: Run complete repository verification**

```bash
pnpm test:validate
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm run architecture:audit -- --min-lines 500
pnpm --prefix frontend run build
git diff --check
```

- [ ] **Step 5: Run authenticated production-server smoke tests**

Verify `/admin/pricing`, `/admin/membership`, and `/admin/billing-products`; configured-database inventory/preview/cancel/history; isolated-test-database confirm/history/rollback and explicit stale-preview conflict; database-unavailable mutation failure; unchanged public `/pricing`, representative model JSON-LD, workspace preflight, and fixed-product estimate. Drop the isolated test data after the run and verify the final 178/492 baselines again.

- [ ] **Step 6: Inspect final scope and obsolete references**

```bash
rg -n "/api/admin/membership-tiers|/api/admin/pricing/rules|BillingProductCard|NewPricingRuleCard|PricingRuleCard" frontend tests
git diff -- frontend/config/pricing-policy.json tests/fixtures/pricing-parity.v1.json tests/fixtures/pricing-public-projections.v1.json
git status --short --branch
```

Expected: no obsolete references, no policy/fixture value diff, branch `main`, only intentional documentation changes before the final commit.

- [ ] **Step 7: Commit documentation**

```bash
git add docs/engineering/pricing-engine.md docs/engineering/admin-routes.md docs/superpowers/specs/2026-07-12-canonical-pricing-engine-design.md docs/superpowers/specs/2026-07-12-canonical-pricing-admin-cockpit-design.md tests/pricing-foundation-architecture.test.ts tests/pricing-billing-authority.test.ts tests/admin-pricing-architecture.test.ts
git commit -m "docs: record operational pricing admin workflow"
```
