# Canonical Pricing Admin Cockpit Design

Date: 2026-07-12

Status: implemented and repository-verified; configured-database acceptance pending

## Context

The pricing foundation, billing migration, and public projection migration are complete. Billing and public totals now use the canonical `@maxvideoai/pricing` kernel, the deterministic audit remains at 178 matches with 0 mismatches, and the exhaustive public contract remains unchanged across 492 rows.

The current `/admin/pricing` page predates that architecture. It mixes three independent commercial domains in one client page:

- engine pricing-policy overrides;
- membership thresholds and discounts;
- fixed billing products.

The current rule editor is also incomplete relative to `PricingPolicyRule`. It cannot express `mode`, audio surcharge, upscale surcharge, or compatibility profile. It exposes `vendorAccountId`, which is settlement routing rather than commercial policy. Its create, update, and delete operations persist immediately without a canonical impact preview, stale-preview protection, immutable pricing history, or rollback workflow.

Implementation note (2026-07-13): the three-domain split, transactional preview/confirmation services, shared immutable history, previewed rollback, canonical navigation, and obsolete-flow deletion described below are implemented. The paragraphs above document the pre-implementation state that motivated the design.

Verification note (2026-07-13): repository checks pass with 2,084 tests, including 153 focused admin/pricing tests; the billing baseline remains 178 rows, the public baseline remains 492 rows, and the audit reports 178 matches, 0 mismatches, and 4 compatibility profiles. Lint, public-exposure checks, TypeScript, architecture audit, production build, the public pricing route, workspace preflight, and image estimate also pass. This worktree has no `DATABASE_URL`, Supabase runtime credentials, local admin, or isolated test database, so authenticated inventory/preview/cancel and isolated confirm/history/stale/rollback smoke steps were not run. No operational database was mutated. Operational closure requires those remaining smoke steps in an explicitly isolated configured environment.

## Goals

1. Make `/admin/pricing` the operational cockpit for canonical engine pricing policy only.
2. Give membership and fixed billing products separate, active admin owners.
3. Require a server-computed preview and explicit confirmation before every commercial mutation.
4. Recompute previews server-side at confirmation time and reject stale proposals.
5. Record every successful commercial mutation as an immutable, actor-attributed event.
6. Support rollback by creating a new previewed change rather than rewriting history.
7. Cover the complete canonical rule schema without parallel client/server normalization.
8. Preserve every current price, rule, membership value, product value, billing result, and public projection during the migration.
9. Delete obsolete mixed-page components and unused admin flows rather than retaining compatibility pages.

## Non-goals

- Do not change any price, margin, surcharge, discount, currency, seeded product value, or compatibility profile.
- Do not add scheduled or future-effective changes. Confirmed changes apply immediately.
- Do not redesign provider settlement, Stripe Connect routing, wallet accounting, or refund behavior.
- Do not move vendor factual costs into commercial policy.
- Do not delete a database field or routing path that is still consumed by billing.
- Do not combine this batch with the final repository-wide legacy-pricing deletion.
- Do not create a second pricing calculation or audit engine for admin.

## Selected information architecture

The admin pricing surface is split into three real domains:

```text
/admin/pricing          canonical engine policy cockpit
/admin/membership       membership thresholds and discounts
/admin/billing-products fixed billing-product controls
```

The admin navigation exposes all three routes. `/admin/pricing` no longer fetches or renders membership tiers or fixed products. Existing mixed-page components are either moved to their correct domain and rebuilt around the preview workflow, or deleted when their behavior is superseded.

No obsolete duplicate page is retained. No permanent redirect is added for a page that never existed publicly. Existing APIs may be replaced in place or removed after all consumers move to the new mutation services.

## Ownership boundaries

### Canonical policy and calculation

`packages/pricing` remains the only commercial calculation and policy-validation kernel. Admin code consumes its existing types, validation, resolver, quote, and projection contracts. Admin modules may assemble scenarios and presentation DTOs, but they may not calculate customer totals, margins, surcharges, or discounts.

### Server orchestration

A server-only admin pricing service owns:

- normalization of proposals into canonical domain types;
- catalog-reference validation;
- current-state reads;
- affected-scenario selection;
- current and proposed canonical quote generation;
- preview fingerprints;
- transactional persistence;
- immutable event writes;
- rollback proposal construction;
- targeted cache invalidation after commit.

Route handlers own authorization, request parsing, status mapping, and response serialization only. Client components never import the pricing-rule store, database helpers, environment configuration, or canonical calculation kernel directly.

### Route-local UI

Each admin route uses route-local `_components`, `_hooks`, and `_lib` modules. Client controllers own SWR data, selection, preview-dialog state, confirmation state, and refresh behavior. Views own presentation only.

## Canonical engine policy cockpit

`/admin/pricing` displays a filterable inventory by engine, mode, resolution, source, and status. It uses a compact table plus an inspector rather than one large editable card per database row.

For a selected scenario or override, the inspector displays:

- engine, mode, and resolution selector;
- vendor factual subtotal for representative scenarios;
- matched versioned rule;
- matched database override, if any;
- effective source, match specificity, and rule ID;
- margin percent and flat cents;
- audio and upscale surcharge percentages;
- currency;
- compatibility profile;
- effective billing and public totals;
- last mutation actor and timestamp, when available.

The editable canonical rule shape is:

```ts
type AdminPricingPolicyRule = {
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
```

`vendorAccountId` is removed from the pricing form because it is routing metadata. Existing stored values and billing fallback behavior remain intact until provider-routing ownership is migrated separately. The cockpit may show the resolved vendor account as read-only operational context, but a pricing mutation cannot change it.

The default global rule cannot be deleted. Creating a selector that duplicates another rule at the same precedence is rejected before preview.

## Membership admin

`/admin/membership` owns the `member`, `plus`, and `pro` threshold and discount values. It preserves the current tier identities and current values.

Before confirmation, the server previews representative canonical quotes for each affected tier. The response shows the current and proposed total, savings delta, and scenarios affected. All tiers are saved in one transaction so partial tier updates cannot occur.

Unknown tiers, negative thresholds, non-finite discounts, discounts above 100%, and a proposal that breaks the required tier set are rejected.

## Billing-product admin

`/admin/billing-products` owns fixed products that are still referenced by production consumers. The inventory is derived from current product keys and active application references rather than the old page's hard-coded Character/Angle filter or `metadata.legacy` exclusion.

The page displays product key, surface, label, unit, currency, active state, current unit price, and current canonical billing projection. Preview shows the proposed price or active-state change and every affected application surface.

Unreferenced legacy products are not editable in this page. The migration does not delete historical billing rows required for receipts or reporting; it only removes obsolete controls and code paths.

## Preview contract

Every domain uses the same two-stage mutation protocol:

```text
proposal → server preview → explicit confirmation → server recomputation → transaction
```

A preview returns:

```ts
type PricingChangePreview = {
  previewFingerprint: string;
  domain: 'policy_rule' | 'membership' | 'billing_product';
  operation: 'create' | 'update' | 'delete' | 'rollback';
  targetId: string;
  currentState: unknown;
  proposedState: unknown;
  affectedScenarioIds: string[];
  affectedSurfaces: string[];
  rows: Array<{
    scenarioId: string;
    engineId?: string;
    currentTotalCents: number;
    proposedTotalCents: number;
    deltaCents: number;
    deltaPercent: number | null;
    currentProvenance: unknown;
    proposedProvenance: unknown;
    compatibilityProfile?: string;
  }>;
  warnings: string[];
};
```

The fingerprint binds the normalized proposal, relevant current database state, versioned policy version, selected scenarios, and current values. Confirmation sends the normalized proposal plus the fingerprint. The server rebuilds the preview from current state. A mismatch returns a typed `preview_stale` conflict and persists nothing.

The client cannot submit a total, delta, provenance record, actor, or affected-scenario list as authoritative data.

## Transaction and immutable events

Successful mutations and their audit event are committed in the same database transaction. A new table records all three domains:

```sql
CREATE TABLE app_pricing_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  operation TEXT NOT NULL,
  target_id TEXT NOT NULL,
  actor_id UUID NOT NULL,
  previous_state JSONB,
  next_state JSONB,
  preview_summary JSONB NOT NULL,
  affected_scenario_ids JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Rows are insert-only from application code. No update or delete endpoint is provided. Existing general `admin_audit` logging may receive a compact secondary event for cross-admin visibility, but it is not the source of truth for pricing rollback.

Rollback selects a historical event, derives the state that should be restored, and runs the normal preview protocol. Confirmation writes a new domain mutation plus a new `rollback` event that references the historical event in its preview summary. History is never rewritten.

## Database rule schema alignment

`app_pricing_rules` is aligned with the canonical rule contract by adding persisted `mode`, `compatibility_profile`, `updated_at`, and `updated_by` fields. Existing margin, flat amount, surcharge, currency, selector, effective timestamp, and routing columns are preserved.

The canonical override loader reads the complete selector and compatibility profile. Admin mutation code validates the complete normalized rule against the versioned policy's currencies, compatibility profiles, and engine catalog references before persistence.

Updating a pricing policy rule preserves its existing `vendor_account_id` value without accepting that field from the pricing proposal. A newly created policy rule receives no routing override. Removing or moving stored routing values belongs to the later provider-routing migration.

Migration defaults preserve every existing row exactly. Newly added fields are nullable and do not alter selector precedence for existing rows.

## Immediate application and cache invalidation

There is no scheduling UI or delayed-effective state. A confirmed change becomes effective when its transaction commits.

After commit, the server:

1. invalidates the in-process pricing-rule cache for policy mutations;
2. invalidates membership or product caches for their domains;
3. revalidates only affected pricing/model tags or paths where the application currently caches those projections;
4. returns the persisted state and event ID.

Failed validation, stale preview, failed transaction, or failed authorization does not invalidate caches. Public and billing quote fallback behavior remains unchanged when the database is unavailable.

## API shape

The route families are domain-specific:

```text
GET  /api/admin/pricing/inventory
POST /api/admin/pricing/preview
POST /api/admin/pricing/confirm
GET  /api/admin/pricing/history

GET  /api/admin/membership
POST /api/admin/membership/preview
POST /api/admin/membership/confirm
GET  /api/admin/membership/history

GET  /api/admin/billing-products
POST /api/admin/billing-products/preview
POST /api/admin/billing-products/confirm
GET  /api/admin/billing-products/history
```

Rollback uses each domain's preview and confirm endpoints with `operation: 'rollback'`. Old direct mutation routes are removed after their clients move. All endpoints require `requireAdmin()` and use the returned admin ID as the actor.

## Error handling

Typed server errors include:

- `invalid_payload`;
- `unknown_engine`;
- `unknown_mode`;
- `unknown_resolution`;
- `unsupported_currency`;
- `unknown_compatibility_profile`;
- `ambiguous_selector`;
- `invalid_number`;
- `missing_target`;
- `default_rule_delete_forbidden`;
- `preview_stale`;
- `database_unavailable`;
- `persistence_failed`.

Inventory reads may show versioned policy and a clear database-unavailable notice. Mutations fail explicitly when the database is unavailable and never return a successful state based only on fallback values.

Unsupported scenarios render as unavailable; the admin never invents a price or displays `NaN`. A preview with no affected scenario is rejected rather than permitting an unobservable change.

## Removal of obsolete logic

The implementation removes or replaces:

- the mixed `/admin/pricing` membership and tool sections;
- `BillingProductCard` under the pricing route;
- raw `PricingRuleCard` and `NewPricingRuleCard` direct-save flows;
- duplicated `toNumber`, form-to-payload, and client commercial normalization;
- old direct rule mutation endpoints;
- UI fields dropped by API normalization;
- the hard-coded Character/Angle product filter;
- the legacy-product UI heuristic as an inventory owner.

Shared low-level form controls may be retained only if at least two active admin domains use them and their ownership is moved to an appropriate shared admin component location.

## Testing strategy

### Pure preview tests

- full canonical rule normalization;
- scenario selection for global, engine, mode, resolution, and precise selectors;
- current/proposed quote deltas;
- compatibility profile and provenance projection;
- membership and fixed-product preview rows;
- stable fingerprint generation;
- unknown and ambiguous reference rejection.

### Transaction tests

- preview is required before confirm;
- server recomputation rejects stale previews;
- mutation and event commit together;
- transaction rollback leaves state and caches unchanged;
- default rule deletion is rejected;
- rollback creates a new event and preserves history;
- actor comes from `requireAdmin()` rather than request payload;
- cache invalidation runs only after commit.

### Route and architecture tests

- each page owns one domain only;
- route files stay orchestrators and delegate to views/controllers;
- client modules do not import server, database, policy-store, or kernel modules;
- route handlers do not duplicate canonical normalization;
- old direct mutation routes and obsolete mixed components are absent;
- all canonical rule fields round-trip through preview and confirm;
- authorization and database-unavailable responses are explicit.

### Regression and smoke tests

- `pnpm pricing:baseline` remains at 178 rows;
- `pnpm pricing:public-baseline` remains at 492 rows;
- `pnpm pricing:audit` remains 178 matches and 0 mismatches;
- billing/public authority tests remain green;
- all three admin routes load under local admin auth;
- preview, stale rejection, confirmation, history, and rollback are exercised without changing committed fixture prices.

## Delivery sequence

1. Add failing contracts for the three-domain split and preview-required mutations.
2. Add the database migration and transactional event store.
3. Build the shared server preview/fingerprint/confirmation service.
4. Migrate the canonical policy cockpit and remove its direct-save flow.
5. Move membership to its own previewed domain.
6. Move billing products to its own previewed domain using the live product inventory.
7. Add history and rollback views for all three domains.
8. Remove obsolete components, endpoints, helpers, and navigation assumptions.
9. Run parity, architecture, full validation, production build, and authenticated smoke tests.

Each step is committed separately. No push is performed unless explicitly requested.

## Acceptance criteria

1. `/admin/pricing`, `/admin/membership`, and `/admin/billing-products` each have one clear active responsibility.
2. No commercial mutation can persist without a fresh server preview and explicit confirmation.
3. The server recomputes the preview and rejects stale state.
4. Rule, membership, or product persistence and immutable event recording are transactional.
5. Rollback is previewed and creates a new event.
6. The complete canonical rule schema round-trips through admin, including mode and surcharges.
7. Routing-only `vendorAccountId` is not editable as pricing policy.
8. No obsolete mixed page, direct-save component, or direct mutation endpoint remains.
9. Existing price values and both frozen baselines remain unchanged.
10. The admin uses the same canonical policy, quote, provenance, and scenario builders as production consumers.
11. Authorization, validation, database-unavailable, stale-preview, and persistence failures are explicit and safe.
12. Documentation describes one operational process for inspecting, changing, and rolling back pricing.
