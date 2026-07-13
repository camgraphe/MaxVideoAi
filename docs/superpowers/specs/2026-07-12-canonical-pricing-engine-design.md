# Canonical Pricing Engine Design

Date: 2026-07-12

Status: foundation, billing, public projection, and admin cockpit migrations complete

## Context

MaxVideoAI already has a billing-oriented pricing kernel and a database-backed pricing-rule store, but pricing behavior is still implemented through several parallel paths.

The current repository includes at least these pricing owners or partial owners:

- `packages/pricing`: shared pricing types, definitions, and kernel logic.
- `frontend/src/lib/pricing.ts`: server orchestration, rule resolution, and specialized billing snapshots.
- `frontend/src/lib/pricing-rule-store.ts`: database persistence, defaults, selection, and cache.
- `frontend/src/lib/pricing-specialized-snapshots.ts`: provider-specific billing quote builders.
- `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts`: a separate marketing quote path that parses engine pricing, applies display margins, handles specialized providers, builds scenarios, and formats output.
- `frontend/components/marketing/PriceEstimator.tsx`, `PriceChip.tsx`, and `price-estimator-options.ts`: browser-side pricing-rule selection and quote adjustments.
- model-page pricing helpers: a mix of billing snapshots, pricing-hub quotes, and provider formulas.
- model-page JSON-LD: direct provider-price calculations for selected engines.
- audio generation: its own rounded-margin helper and margin constant.
- `/admin/pricing`: a database-rule editor whose API and UI do not fully cover the rule model and which is not the normal operating path today.

This creates the exact failure mode the architecture cleanup is intended to eliminate: price formulas, margin application, rule precedence, formatting inputs, and specialized-provider handling can drift even when every individual file is internally correct.

Implementation note (2026-07-13): the admin cockpit phase is now implemented as three domain-owned surfaces with canonical preview, explicit confirmation, immutable history, and previewed rollback. The inventory above remains the original migration context.

## Goals

1. Preserve every currently billed and displayed amount exactly during the migration.
2. Make `@maxvideoai/pricing` the only pricing calculation kernel.
3. Keep provider facts, commercial policy, calculation, and presentation as separate responsibilities.
4. Provide versioned default commercial policy with database overrides.
5. Turn the existing admin pricing area into an operational cockpit for previewing and managing overrides.
6. Make every effective value and its origin observable.
7. Remove legacy pricing calculations after their consumers reach exact parity.
8. Prevent future parallel pricing engines through architecture and parity tests.

## Non-goals

- Do not change any price, margin, surcharge, discount, currency, or rounding outcome in this project.
- Do not reconcile historical differences between billed and displayed prices automatically.
- Do not redesign membership tiers, wallet debits, Stripe products, or vendor settlement.
- Do not move provider capabilities or provider base costs into the commercial-policy registry.
- Do not require the database for a public page to render a safe fallback price.
- Do not preserve unused admin components or legacy calculation helpers merely for compatibility.

## Delivery decomposition

This design is the target architecture for a multi-batch program. It must not be implemented as one repository-wide rewrite.

The program is decomposed into these separately reviewed subprojects:

1. **Pricing parity and policy foundation — complete 2026-07-12**: inventory current consumers, freeze outputs, add the deterministic audit matrix, add validated versioned defaults, normalize rule resolution, and run the canonical kernel in shadow mode. The completed audit covers 178 scenarios with 178 matches and 0 mismatches. No consumer became authoritative and no admin behavior changed.
2. **Billing consumer migration — complete 2026-07-12**: wallet/direct generation, charged image execution, production audio, and tool billing now use canonical quotes. Public projections remain legacy-authoritative. Verification completed with 1,946 passing tests, the unchanged 178-row baseline, 178 canonical matches, 0 mismatches, 4 compatibility profiles, lint, exposure, TypeScript, and a successful production build.
3. **Public projection migration — complete 2026-07-12**: pricing pages, model pages, estimator, chip, JSON-LD, workspace preflight, and image estimates now use canonical quotes. The 492-row frozen public contract is unchanged. Verification completed with 1,962 passing tests, 75 focused architecture/public tests, the unchanged 178-row audit at 178 matches and 0 mismatches, lint, exposure, TypeScript, two successful production builds, and production-server smoke tests across 12 localized pricing/model pages plus four live estimate scenarios.
4. **Admin pricing cockpit**: replace the current raw rule editor with preview, provenance, history, rollback, and cache invalidation.
5. **Legacy deletion and guardrails**: remove superseded formulas and rule selectors, then activate semantic one-owner guards.

Subprojects 1–3 are complete. Subproject 4 remains separately scoped because admin mutations and operational controls require their own preview, audit, and rollback contract. Subproject 5 follows only after the remaining compatibility consumers are inventoried and migrated.

## Binding safety contract

The migration is behavior-preserving at the cent level.

Before a consumer changes implementation, its current output is frozen for every supported engine and scenario. The new implementation must reproduce the same:

- vendor subtotal;
- margin amount;
- surcharge amount;
- customer total;
- currency;
- unit and quantity;
- displayed text inputs;
- structured-data amount.

An existing difference between two consumers is recorded as an explicit compatibility profile and reported. It is not silently corrected. Compatibility profiles are migration devices, not permission to create new discrepancies.

No old calculation path is deleted until:

1. its complete frozen matrix passes against the canonical engine;
2. the new consumer has focused regression coverage;
3. shadow comparison reports no unapproved drift;
4. the relevant architecture guard is active.

## Target architecture

### 1. Provider facts

Provider adapters and engine definitions continue to own factual inputs such as:

- vendor price units and base rates;
- supported modes;
- resolutions and durations;
- audio or upscale capabilities;
- provider-specific tier tables;
- vendor-account routing metadata.

Provider facts must not own MaxVideoAI margins, commercial surcharges, public-display adjustments, membership policy, or localized copy.

### 2. Versioned commercial policy

A validated versioned policy document becomes the fallback commercial-policy source. The intended authored path is:

```text
frontend/config/pricing-policy.json
```

It contains only commercial defaults and explicit compatibility profiles. It does not duplicate vendor base costs or engine capabilities.

The policy schema supports:

```ts
type PricingPolicyRule = {
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

The committed defaults must reproduce current behavior. A change to this document is treated as a price change and requires an explicit pricing-matrix diff.

### 3. Database overrides

`app_pricing_rules` remains the operational override store. Its normalized contract must match the versioned policy rule closely enough that both sources pass through the same validator and resolver.

Database rules are overlays, not a second pricing language.

Rule precedence is binding:

```text
precise DB override
→ engine-level DB override
→ global DB override
→ precise versioned rule
→ engine-level versioned rule
→ global versioned rule
```

The resolver returns both the effective rule and provenance:

```ts
type ResolvedPricingPolicy = {
  rule: PricingPolicyRule;
  source: 'database' | 'versioned';
  matchedBy: 'precise' | 'engine' | 'global';
  sourceRuleId: string;
};
```

Database failure falls back to validated versioned policy and emits a structured operational warning. It must not produce a zero-margin fallback accidentally.

### 4. Canonical quote kernel

The existing `packages/pricing` package is evolved into the sole pure calculation kernel. A second package or application-local pricing kernel must not be introduced.

The kernel accepts only normalized facts, a normalized scenario, and a resolved policy:

```ts
type PricingQuoteInput = {
  facts: PricingFacts;
  scenario: PricingScenario;
  policy: ResolvedPricingPolicy;
  compatibilityProfile?: PricingCompatibilityProfile;
};

type CanonicalPricingQuote = {
  engineId: string;
  scenarioId: string;
  currency: string;
  vendorSubtotalCents: number;
  marginCents: number;
  surchargeCents: number;
  customerTotalCents: number;
  unit: string;
  quantity: number;
  breakdown: PricingBreakdown;
  policyProvenance: PricingPolicyProvenance;
};
```

The kernel is deterministic and side-effect-free. It performs no database access, translation, JSX rendering, route construction, logging, or cache invalidation.

Provider-specific algorithms are canonical adapters feeding the kernel. Luma, Seedance, GPT Image, audio, and future specialized engines must not maintain separate marketing and billing formulas.

### 5. Consumer projections

Every consumer receives `CanonicalPricingQuote` and owns presentation only.

- Billing converts the quote into wallet and transaction fields.
- Public pricing builds localized rows and links.
- Model pages choose scenarios and format quote summaries.
- Price estimator and chips format browser-safe projections.
- JSON-LD maps the canonical customer amount to schema fields.
- Admin preview renders before-and-after quotes and provenance.

Consumer projections may format currencies, units, labels, links, and explanatory copy. They may not recalculate vendor cost, margins, surcharges, or totals.

## Browser and server boundaries

Database access and override resolution remain server-only.

Browser consumers receive a validated, browser-safe pricing projection. It may include:

- normalized provider facts required for interactive scenarios;
- versioned effective defaults;
- supported scenario identifiers;
- quote inputs that contain no secrets or vendor credentials.

The browser must use the same `@maxvideoai/pricing` kernel and the same normalized policy contract. It must not reproduce policy selection or margin formulas in React components.

Admin mutations and billing always revalidate and recompute on the server. Browser preview is informative; the server quote is authoritative.

## Admin pricing cockpit

The existing `/admin/pricing` route is refactored around operational decisions rather than raw database records.

For every engine and representative scenario, it displays:

- vendor cost;
- matched versioned rule;
- matched DB override;
- effective billed total;
- effective public/display total by surface;
- delta in cents and percent;
- policy source and rule ID;
- last change timestamp and actor when available.

### Preview before save

Creating, updating, or deleting an override first calls a server preview endpoint. The preview returns:

- normalized proposed rule;
- affected engines and scenarios;
- current and proposed quotes;
- affected surfaces;
- validation warnings;
- whether a compatibility profile is involved.

Save requires explicit confirmation of the preview result. The save endpoint recomputes the preview server-side before persistence to prevent stale or forged totals.

### Audit and rollback

Every mutation records an immutable pricing-policy event containing:

- actor;
- timestamp;
- operation;
- previous normalized rule;
- next normalized rule;
- preview summary;
- affected scenario IDs.

Rollback creates a new event that restores a previous normalized rule. History is not rewritten.

### Cache invalidation

After a successful mutation, the server invalidates only pricing-related caches and revalidates affected public pricing/model paths or tags. A failed mutation does not invalidate caches.

Public pages always retain versioned fallback behavior if override loading fails.

### Removal of obsolete admin logic

The migration must audit and remove:

- fields shown by the UI but dropped by the API;
- duplicated client/server normalization;
- legacy billing-product controls unrelated to pricing policy;
- unused create/edit flows;
- rule forms that cannot express the canonical schema;
- routes that bypass canonical validation or preview.

Old admin code is not retained behind compatibility shims unless a current production consumer is proven.

## Observability and audit matrix

A deterministic pricing audit command produces a machine-readable and human-readable matrix without modifying prices.

Each row includes:

- engine and scenario;
- consumer surface;
- current frozen amount;
- canonical amount;
- difference in cents;
- effective rule and provenance;
- compatibility profile, if any;
- migration state.

The command fails when:

- an approved frozen row changes unexpectedly;
- a consumer has no canonical scenario mapping;
- a quote is non-finite or negative;
- a rule cannot be resolved;
- two rules are ambiguous at the same precedence;
- a new compatibility profile appears without an explicit fixture change.

The admin uses the same audit builder. There is no separate admin-only comparison algorithm.

## Error handling

### Invalid policy

Invalid versioned policy fails validation and build preflight. Invalid DB policy is rejected by preview and save.

Validation covers at minimum:

- finite numeric values;
- non-negative margins and flat amounts unless a future explicitly approved discount schema is introduced;
- supported currency;
- known engine, mode, and resolution references;
- unique rule identity;
- unambiguous precedence;
- valid compatibility-profile reference.

### Unsupported scenario

The kernel returns a typed unsupported result or throws a typed domain error at a server boundary. UI projections render an unavailable state. They never invent a price or display `NaN`.

### Database unavailable

Rule resolution uses versioned defaults, records structured fallback telemetry, and preserves public rendering. Admin mutation endpoints return an explicit unavailable response and never pretend that a change succeeded.

### Quote mismatch during migration

Shadow comparison records the mismatch and keeps the old consumer authoritative. It does not switch automatically.

## Migration sequence

### Phase 1: freeze the current contract

- Inventory every pricing consumer and formula.
- Generate exact cent-level fixtures for billed, displayed, estimator, model-page, audio, and JSON-LD outputs.
- Record existing cross-surface differences.
- Add a no-write audit command.

### Phase 2: normalize policy and facts

- Add the validated versioned policy document using current values.
- Normalize DB rules through the same contract.
- Implement the binding precedence resolver and provenance.
- Map provider facts and specialized formulas without changing outputs.

### Phase 3: canonical kernel in shadow mode

- Extend `@maxvideoai/pricing` rather than creating another kernel.
- Run old and canonical quote paths side-by-side in tests and controlled server paths.
- Reach full fixture parity before making a consumer authoritative.

### Phase 4: migrate billing

- Move wallet, generation, image, audio, and tool billing consumers to canonical quotes.
- Preserve wallet debits and transaction breakdowns exactly.
- Remove superseded billing formulas only after acceptance tests pass.

### Phase 5: migrate public consumers

- Pricing hub.
- Model pages and their decision pricing.
- Price estimator and price chips.
- JSON-LD offers.
- Marketing helper APIs.

Each consumer is migrated independently and keeps exact frozen output.

### Phase 6: operational admin

- Replace raw rule forms with inventory, preview, confirmation, history, and rollback.
- Complete all canonical fields, including surcharges currently omitted by some API paths.
- Add targeted cache invalidation.

### Phase 7: delete parallel logic

- Remove old formulas, margin helpers, and consumer-local rule selection.
- Reduce `pricingHubData.ts` to scenario selection and presentation projection or split it by those responsibilities.
- Add semantic architecture guards preventing pricing math outside approved kernel/adapter modules.
- Update engineering and agent documentation.

## Testing strategy

### Golden parity

Fixtures freeze all current outputs at integer-cent precision. Float comparison is not an acceptance criterion.

### Kernel tests

- standard per-second, per-image, per-duration, and flat pricing;
- rounding boundaries;
- margins and flat fees;
- audio and upscale surcharges;
- membership effects where currently applicable;
- specialized provider adapters;
- unsupported and invalid scenarios.

### Policy tests

- exact precedence order;
- DB fallback to versioned defaults;
- ambiguity rejection;
- provenance accuracy;
- compatibility-profile control.

### Consumer tests

- billing debit and transaction parity;
- pricing page row parity;
- model-page quote parity;
- estimator and chip parity;
- JSON-LD price parity;
- localized formatting without recalculation.

### Admin tests

- preview is required before save;
- server recomputes previews;
- full schema round-trip, including surcharges;
- audit history and rollback;
- cache invalidation only after success;
- authorization and validation failures;
- DB-unavailable behavior.

### Architecture guards

The repository must reject:

- new consumer-local margin constants;
- new pricing total calculations outside the canonical kernel and approved provider adapters;
- direct DB pricing-rule selection from UI components;
- direct provider-price formulas in JSON-LD or marketing components;
- parallel admin normalization schemas;
- generated pricing projections edited by hand.

## Verification gates

Every migration batch runs focused pricing tests first. Before final integration, run:

```bash
pnpm test:validate
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm pricing:audit
pnpm --prefix frontend run build
git diff --check
```

Production smoke must verify representative video, image, audio, and tool scenarios; public pricing; model pages; JSON-LD; admin preview; and an actual billing preflight.

## Success criteria

The project is complete when:

1. every frozen price matches exactly;
2. all billed and displayed totals come from `@maxvideoai/pricing`;
3. one validated policy resolver handles versioned defaults and DB overrides;
4. admin preview and save use the same canonical quote path as billing;
5. every quote exposes provenance;
6. the audit matrix reports all surfaces and existing differences;
7. no legacy pricing math remains in consumers;
8. public pages retain safe fallback behavior;
9. architecture tests prevent parallel pricing logic from returning;
10. documentation describes one operational workflow for viewing and changing pricing.
