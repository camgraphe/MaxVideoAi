# Pricing Admin Policy Service Refactor Design

## Objective

Replace the 735-line `frontend/server/pricing-admin/policy-service.ts` mixed-responsibility module with a thin stable facade and focused policy-domain modules.

The refactor must preserve every current pricing result, public export, admin route contract, database operation, transaction boundary, error code, event record, cache invalidation, and revalidation behavior.

This is an architecture-only batch. It does not authorize a commercial change.

## Context

The canonical pricing engine and the three commercial admin domains are already operational:

- `/admin/pricing` owns engine pricing policy;
- `/admin/membership` owns membership thresholds and discounts;
- `/admin/billing-products` owns fixed billing products.

The canonical pricing migration is complete and currently proves:

- 178 billing scenarios, 178 matches, 0 mismatches;
- 492 unchanged public projection rows;
- one commercial formula owner in `@maxvideoai/pricing`;
- a server-owned `preview → explicit confirmation → transactional apply` mutation protocol.

The live architecture audit on 2026-07-14 reports `frontend/server/pricing-admin/policy-service.ts` at 735 lines. The file currently owns public contracts, dependency wiring, rule normalization and validation, proposal interpretation, preview projection, confirmation persistence, cache and path side effects, history reads, and inventory assembly.

Those responsibilities change for different reasons and can be separated without creating a generic service framework.

## Non-Goals

This batch must not:

- change any price, margin, surcharge, discount, currency, compatibility profile, rounding rule, provider cost, customer total, wallet debit, public display, or structured-data offer;
- modify `frontend/config/pricing-policy.json`;
- regenerate either frozen pricing fixture;
- add, remove, or rename an admin route or API route;
- change request or response payloads;
- change the admin UI;
- add a database migration;
- change event history semantics;
- introduce a second pricing formula or policy resolver;
- add a class, repository framework, command bus, dependency container, or generic service abstraction;
- create compatibility shims for deleted pricing routes;
- refactor membership or billing-product services in the same batch.

## Chosen Approach

Keep `frontend/server/pricing-admin/policy-service.ts` as the only supported public import surface. Convert it into a re-export-only facade and move existing behavior into six focused sibling modules.

This is preferred over a two-file read/write split because the write side would still mix proposal validation, canonical preview projection, transaction persistence, and post-commit operations. It is preferred over extracting only pure helpers because that would leave the original file as the owner of nearly every workflow.

Routes and external consumers keep one public import hop:

```text
admin pricing routes and tests
  → policy-service.ts
      → policy-contract.ts
      → policy-dependencies.ts
      → policy-rules.ts
      → policy-preview.ts
      → policy-confirmation.ts
      → policy-read-model.ts
```

Focused modules may depend directly on the contract, dependency, or rule helper they need, but no focused module may import the facade and no module may proxy another without owning behavior. No new nested policy-service directory is needed because the existing `frontend/server/pricing-admin/` folder is already the domain boundary.

## Public Contract

`frontend/server/pricing-admin/policy-service.ts` remains the stable public module and continues to export:

- `previewPricingPolicyChange`;
- `confirmPricingPolicyChange`;
- `loadPricingPolicyHistory`;
- `loadPricingPolicyInventory`;
- `deriveRequestedPricingSurcharges`;
- `PricingPolicyChangeProposal`;
- `PricingChangePreview`;
- `PricingChangeConfirmation`;
- `PricingPolicyInventoryRow`;
- `PricingPolicyInventoryResponse`;
- `PricingPolicyServiceDependencies`.

Existing consumers continue to import only from `@/server/pricing-admin/policy-service`:

- `frontend/app/api/admin/pricing/preview/route.ts`;
- `frontend/app/api/admin/pricing/confirm/route.ts`;
- `frontend/app/api/admin/pricing/inventory/route.ts`;
- `frontend/app/api/admin/pricing/history/route.ts`.

The focused implementation files are internal server modules. Routes must not bypass the facade.

## File Responsibilities

### `policy-service.ts`

Owns only the stable public facade. It contains re-exports and no validation, database access, pricing projection, transaction logic, cache invalidation, or inventory assembly.

Target: at most 30 physical lines.

### `policy-contract.ts`

Owns policy-domain TypeScript contracts:

- change proposal;
- preview;
- confirmation;
- inventory row and response;
- dependency interface;
- internal preview context when it is shared by more than one focused module.

It contains no runtime imports or executable logic.

### `policy-dependencies.ts`

Owns the concrete production dependency adapter:

- database override loading;
- locked override loading through a provided `QueryExecutor`;
- event reads and writes;
- database transaction entry;
- rule upsert and deletion;
- cache invalidation;
- public path revalidation.

It exports the single default dependency object used by preview, confirmation, inventory, and history. Test dependency injection remains available through the existing public function parameters.

This module does not implement policy decisions.

### `policy-rules.ts`

Owns pure or deterministic policy helpers:

- input object and required-text validation;
- canonical rule projection;
- JSON rule projection;
- selector creation and selector keys;
- pricing-policy reference construction;
- validation-error mapping;
- override validation;
- rule sorting and JSON-safe projection.

It may read the engine catalog and audit scenario inventory to build validation references. It cannot access the database, write events, invalidate caches, or call Next.js revalidation.

### `policy-preview.ts`

Owns the complete preview workflow:

1. load current database rules through injected dependencies;
2. interpret create, update, delete, or rollback proposals;
3. enforce default-rule and routing protections;
4. validate the complete proposed override set;
5. select affected canonical scenarios;
6. derive requested audio or upscale surcharge projections;
7. quote current and proposed canonical outcomes;
8. compare observable rows;
9. build the deterministic preview fingerprint;
10. return the existing preview shape or the existing typed error.

It exports `previewPricingPolicyChange` and `deriveRequestedPricingSurcharges`.

It does not persist changes or trigger post-commit side effects.

### `policy-confirmation.ts`

Owns the mutation workflow:

1. validate the server actor identifier;
2. recompute the preview before entering the transaction;
3. reject a missing or stale fingerprint;
4. open the existing database transaction;
5. rebind override and rollback-event reads to the transaction executor;
6. recompute the full preview under the locked transaction;
7. reject a fingerprint that became stale;
8. upsert or delete the target rule;
9. insert the immutable pricing change event in the same transaction;
10. commit;
11. invalidate the in-process pricing cache;
12. request affected-path revalidation;
13. return existing non-fatal operational warnings if either post-commit side effect fails.

It exports `confirmPricingPolicyChange`.

Persistence failures continue to map to `PricingAdminError('persistence_failed', ...)`. Post-commit side-effect failures never roll back a committed pricing change.

### `policy-read-model.ts`

Owns read-only administration:

- history reads limited to the `policy_rule` domain;
- inventory assembly from versioned rules, database overrides, audit scenarios, effective provenance, routing context, representative canonical quotes, and latest immutable events;
- the existing database-unavailable inventory fallback and warning.

It exports `loadPricingPolicyHistory` and `loadPricingPolicyInventory`.

It cannot mutate pricing policy or write events.

## Data and Transaction Invariants

The current preview fingerprint remains the concurrency contract. Its input values, ordering, and deterministic serialization must remain identical:

- domain;
- operation;
- target identifier;
- current and proposed policy state;
- versioned policy version;
- affected scenario identifiers;
- unsupported scenario identifiers;
- sorted current database rules;
- sorted routing rules;
- current and proposed outcomes;
- comparison rows;
- rollback event identifier when applicable.

Confirmation continues to recompute the preview twice: once before the transaction and once inside the transaction after acquiring locked policy state. The rule mutation and immutable event insertion remain in the same transaction and use the same `QueryExecutor`.

Routing remains outside the commercial proposal:

- an update preserves stored `vendorAccountId`;
- a create cannot set routing;
- a routed rule cannot be deleted;
- rollback cannot recreate historical routing from pricing state.

The default policy rule remains undeletable.

## Error Behavior

The refactor preserves every existing `PricingAdminError` code and its route-level HTTP mapping, including:

- `invalid_payload`;
- `invalid_number`;
- `unsupported_currency`;
- `unknown_engine`;
- `unknown_mode`;
- `unknown_resolution`;
- `unknown_compatibility_profile`;
- `ambiguous_selector`;
- `database_unavailable`;
- `missing_target`;
- `default_rule_delete_forbidden`;
- `routing_conflict`;
- `preview_stale`;
- `persistence_failed`.

No route catches a new internal error type. Validation errors from `@maxvideoai/pricing` continue to map through `PricingAdminError`.

## Test Design

### Architecture contract

Extend `tests/admin-pricing-architecture.test.ts` to assert:

- every focused module exists;
- `policy-service.ts` is a re-export-only facade of at most 30 lines;
- all current route consumers still import from the facade;
- no route imports a focused implementation file;
- no focused implementation file imports the facade;
- no focused module exceeds 350 physical lines;
- preview owns canonical projection and fingerprint construction;
- confirmation owns the transaction-scoped second preview, persistence, immutable event insertion, cache invalidation, and revalidation;
- read-model owns inventory and history;
- policy-rules contains no database or revalidation imports.

### Policy service behavior

Keep `tests/admin-pricing-policy-service.test.ts` importing through the public facade. Preserve coverage for:

- create, update, delete, and rollback preview;
- default-rule deletion rejection;
- routed-rule deletion rejection;
- rollback target validation;
- forged or unsupported proposal fields;
- surcharge scenario derivation;
- deterministic preview fingerprints;
- stale preview rejection before persistence;
- stale preview rejection inside the transaction;
- transactional rule and event writes;
- persistence failure mapping;
- cache invalidation and path revalidation warnings;
- inventory provenance, routing context, representative quotes, and latest event;
- database-unavailable read fallback and mutation rejection.

Add focused pure-helper tests only where moving a helper would otherwise weaken a behavioral assertion. Do not duplicate the full service suite per internal file.

### Pricing invariants

Run the immutable pricing guards without regenerating fixtures:

```bash
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
pnpm --silent pricing:audit -- --json
```

Expected:

- 178 billing scenarios;
- 178 matches;
- 0 mismatches;
- 492 unchanged public projection rows.

The diff must show no modification to:

- `frontend/config/pricing-policy.json`;
- `tests/fixtures/pricing-parity.v1.json`;
- `tests/fixtures/pricing-public-projections.v1.json`;
- database migrations;
- admin pricing route payloads or UI components.

### Repository verification

Run:

```bash
pnpm exec tsx --test tests/admin-pricing-architecture.test.ts tests/admin-pricing-policy-service.test.ts
pnpm test:validate
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm run architecture:audit -- --min-lines 500
pnpm --prefix frontend run build
git diff --check
```

Use the existing read-only admin smoke coverage. Automated verification must not confirm a real pricing proposal against production data.

## Documentation

Update `docs/engineering/refactor-roadmap.md` after implementation:

- record the admin-transactions split as completed;
- remove its stale candidate entry;
- record the policy-service facade and focused owners;
- refresh the current audit snapshot;
- keep large localized content files classified as a separate content-organization project.

Update `docs/engineering/pricing-engine.md` only if a future worker would otherwise misunderstand the new internal file ownership. Do not change the commercial operating procedure.

## Delivery Sequence

1. Add failing architecture contracts for the target module boundaries.
2. Extract public contracts and production dependency wiring.
3. Extract pure rule validation and normalization.
4. Extract preview construction while preserving facade imports.
5. Extract read-model inventory and history.
6. Extract transactional confirmation and post-commit side effects.
7. Reduce `policy-service.ts` to the stable facade.
8. Refresh the architecture roadmap.
9. Run focused, pricing-parity, repository, build, and smoke verification.
10. Review the final diff specifically for accidental commercial changes.

Each extraction is independently reviewed and committed. A failed parity check stops the batch; frozen fixtures are not updated to make a refactor pass.

## Definition of Done

The batch is complete only when:

- every current public policy-service export remains available from the same path;
- current admin pricing route consumers require no changes;
- `policy-service.ts` is a re-export-only facade of at most 30 lines;
- no focused policy module exceeds 350 lines;
- there is one production dependency adapter and no generic service framework;
- the preview-confirm transaction and immutable event guarantees are unchanged;
- all existing error codes and route contracts are unchanged;
- 178 billing scenarios match with 0 mismatches;
- all 492 public projection rows remain unchanged;
- no price, policy value, fixture, migration, route payload, or UI changed;
- focused tests, the full validation suite, lint, exposure checks, TypeScript, build, smoke coverage, and `git diff --check` pass;
- the live architecture audit and roadmap reflect the new state.
