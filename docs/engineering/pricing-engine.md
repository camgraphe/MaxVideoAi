# Pricing Engine

## Current status

The pricing parity foundation, billing migration, and public projection migration are complete. The three-domain admin cockpit implementation and repository verification are complete; authenticated confirmation/history/rollback smoke testing against a configured isolated database remains an environment acceptance step. The deterministic audit reports **178 scenarios, 178 matches, 0 mismatches, and 4 compatibility profiles in use**. The exhaustive public contract reports **492 unchanged rows**. Wallet/direct generation, image, audio, tool charges, public pricing pages, model pages, estimators, chips, JSON-LD, workspace preflight, and image estimates are canonical-authoritative.

The commercial values and pricing results remain unchanged: no price, margin, surcharge, membership discount, currency, rounding outcome, wallet debit, direct-payment comparison, public display, structured-data offer, or seeded product value changed. The admin mutation workflow changed from direct mutation to a server-owned `preview → explicit confirmation → transactional apply` protocol. The public batch added one named rounding-only compatibility profile after the frozen fixture demonstrated the historical behavior it preserves.

## Ownership model

The target flow is:

```text
provider facts → resolved commercial policy → @maxvideoai/pricing → presentation
```

Provider facts include vendor rates, units, duration, resolution, provider tiers, and factual addons. Commercial policy includes MaxVideoAI margins, flat fees, surcharges, membership effects, currency, and compatibility profiles. Consumers may format a canonical quote but may not recalculate it.

## Current consumer inventory

| Owner | Current responsibility | Foundation status | Intended destination |
| --- | --- | --- | --- |
| `packages/pricing` | Canonical policy, quote, provenance, scaling, and snapshot projection | Canonical-authoritative | Sole pure commercial kernel |
| `frontend/server/pricing/quote-billing.ts` | Server billing orchestration for video, image, and audio | Canonical-authoritative | Stable billing owner |
| `frontend/src/lib/pricing-billing-facts.ts` | Billing provider facts and descriptive snapshot metadata | Canonical billing input | Stable factual adapter layer |
| `frontend/src/lib/pricing-public-facts.ts` | Browser-safe provider and fixed-product facts | Canonical public input | Stable factual adapter layer |
| `frontend/src/lib/pricing-public-quote.ts` | Browser-safe policy selection, canonical quote, and projection | Canonical-authoritative for deterministic public projections | Stable public quote owner |
| `frontend/server/pricing/quote-public.ts` | DB-aware public and live-preview orchestration | Canonical-authoritative | Stable server public quote owner |
| `frontend/src/lib/pricing.ts` | Shared legacy pricing facade | Compatibility only outside migrated public/billing paths | Remove in the legacy-deletion batch |
| `frontend/src/lib/pricing-rule-store.ts` | DB rule persistence, fallback, routing metadata, and cache | Canonical override input | One resolver and admin-service input |
| `frontend/src/lib/pricing-specialized-snapshots.ts` | Specialized legacy helpers | No longer public-authoritative | Remove after remaining legacy consumers migrate |
| `frontend/src/lib/audio-generation.ts` | Audio vendor facts plus deterministic legacy projection helper | Facts used by canonical production audio | Keep factual builder; retire duplicate public math later |
| `frontend/src/lib/billing-products.ts` | Fixed-product loading and tool quote projection | Canonical-authoritative for tools | Stable fixed-product billing owner |
| `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts` | Scenario selection, notes, sorting, links, and formatting | Canonical public consumer | Presentation only |
| `frontend/components/marketing/PriceEstimator.tsx` | Interactive browser quote presentation | Canonical public consumer | Presentation only |
| `frontend/components/marketing/PriceChip.tsx` | Compact browser quote presentation | Canonical public consumer | Presentation only |
| `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing.ts` | Server model-page scenarios and labels | Canonical public consumer | Presentation only |
| `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts` | Model decision-card scenario selection | Canonical public consumer | Presentation only |
| `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts` | Product Offer mapping | Canonical public consumer | JSON-LD projection only |
| `frontend/src/server/tools/angle.ts` | Angle tool billing | Canonical fixed-product quote | Stable consumer |
| `frontend/src/server/tools/background-removal.ts` | Background-removal billing | Canonical fixed-product and dynamic quote | Stable consumer |
| `frontend/src/server/tools/upscale.ts` | Upscale billing | Canonical fixed-product and dynamic quote | Stable consumer |
| `frontend/app/(core)/admin/pricing` | Canonical engine-policy inventory, preview, confirmation, history, and rollback | Implemented/repository-verified; configured-DB acceptance pending | Stable policy-domain owner |
| `frontend/app/(core)/admin/membership` | Membership threshold and discount preview, confirmation, history, and rollback | Implemented/repository-verified; configured-DB acceptance pending | Stable membership-domain owner |
| `frontend/app/(core)/admin/billing-products` | Referenced fixed-product preview, confirmation, history, and rollback | Implemented/repository-verified; configured-DB acceptance pending | Stable billing-product-domain owner |
| `frontend/app/api/admin/pricing`, `membership`, `billing-products` | Authorized inventory/history reads and preview-fingerprint-confirm mutations | Implemented/repository-verified; configured-DB acceptance pending | Stable thin route adapters |

## Policy precedence

Canonical server quotes use this deterministic precedence:

```text
precise DB override
→ engine-level DB override
→ global DB override
→ precise versioned rule
→ engine-level versioned rule
→ global versioned rule
```

The canonical result always carries the source, match specificity, source rule ID, and compatibility profile. Database unavailability falls back to validated versioned policy and emits a structured operational warning.

## Audit workflow

The committed billing and public baselines remain frozen pre-migration references and contain no database or timestamp data. The audits compare canonical outputs against those references; neither fixture nor collector is a production pricing owner.

```bash
pnpm pricing:baseline
pnpm pricing:baseline:generate
pnpm pricing:public-baseline
pnpm pricing:public-baseline:generate
pnpm pricing:audit
pnpm --silent pricing:audit -- --json
```

The two `*:generate` commands are intentional fixture write operations. The other commands do not mutate pricing policy or application state.

Every current cross-surface difference is preserved and identified by a compatibility profile. Updating `frontend/config/pricing-policy.json` is a commercial change after this foundation batch and requires an intentional matrix review; it must never be bundled into an unrelated refactor.

## Foundation compatibility profiles

- `standard`: preserves fractional provider cents for commercial math and rounds the margin upward.
- `provider-reference-current`: preserves the existing Luma and Seedance behavior that rounds the provider share and the commercial subtotal upward before deriving the margin component.
- `audio-current`: preserves the existing 150% audio margin and integer vendor components.
- `schema-current`: preserves structured-data offers that currently use an already-authored offer amount without adding another margin.
- `public-rounded-vendor-current`: preserves public surfaces that historically rounded vendor cents before applying the standard commercial rule.
- `fixed-product-current`: preserves seeded billing-product totals without a second margin or surcharge and retains the historical zero platform/vendor allocation fields.

These profiles document existing behavior only. They cannot be added implicitly by the audit command and they do not authorize new cross-surface differences.

## Billing authority

New charges enter through `frontend/server/pricing/quote-billing.ts` or the canonical fixed-product functions in `frontend/src/lib/billing-products.ts`. API routes and tool runners do not call the pure kernel directly. Wallet and receipt persistence consume the projected snapshot without recalculating it, and refunds use stored charged amounts.

## Public authority

Deterministic browser and marketing projections enter through `frontend/src/lib/pricing-public-quote.ts`. DB-aware model projections and live estimates enter through `frontend/server/pricing/quote-public.ts`. Provider adapters provide facts only; consumers choose scenarios and format canonical results. Browser modules may receive validated serialized overrides but cannot import the database resolver, server modules, environment secrets, or admin owners.

The pricing hub, model decision cards, estimator, chip, model price rows, Product Offer JSON-LD, workspace preflight, and image estimate routes are protected by `tests/pricing-public-authority.test.ts`. The exhaustive 492-row fixture protects the cent-level output of every migrated public surface.

## Remaining migrations

The remaining work is intentionally separate:

1. Migrate any non-public compatibility consumers, then delete `frontend/src/lib/pricing.ts` and superseded specialized commercial helpers.
2. Tighten the semantic one-owner guard once those compatibility paths are gone.

## Admin commercial mutation workflow

The admin navigation exposes exactly three commercial owners: `Pricing policy`, `Membership`, and `Billing products`. Each domain loads its own inventory and immutable history. A mutation must follow `preview → explicit confirmation → immediate transactional apply`; confirmation recomputes the preview and rejects a stale fingerprint.

Routing fields are excluded from commercial proposals: `vendorAccountId` is read-only context, an update preserves the stored routing value, and a new policy rule cannot create a routing override. Rollback creates a new immutable event and is a new mutation, never a history rewrite. Clients send only the target and immutable event identifiers. The server reads the event, derives the historical state, computes a fresh canonical preview, and requires the normal explicit confirmation. Event history renders actor, timestamp, operation, target, and the server-recorded scenario delta range. The former direct membership-tier and raw pricing-rule mutation routes have been removed.

Read-only public quote resolution may fall back to validated versioned policy when the database is unavailable. Admin inventory surfaces must show the outage, while every database-unavailable admin mutation fails explicitly and leaves policy, history, and caches unchanged.

## Safe price-change runbook

Use only the owner for the value being changed:

1. `/admin/pricing` for engine policy selectors, margins, surcharges, currency, and compatibility profiles.
2. `/admin/membership` for the canonical `member`, `plus`, and `pro` thresholds and discounts.
3. `/admin/billing-products` for active fixed products referenced by production billing consumers.

On the selected page, inspect the current source and provenance, edit the proposed value, request the canonical server preview, review every affected row and warning, then either cancel or explicitly confirm. Confirmation applies immediately. If the server reports `preview_stale`, discard the preview, refresh current state, and preview again. To undo a committed change, select its immutable history event and run the same preview-confirm flow; rollback never edits or deletes history.

Before confirming a real change, work in a configured environment with an authenticated admin and a database containing the current migrations. Record the intended policy diff, then run the read-only guards:

```bash
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
pnpm --silent pricing:audit -- --json
```

Do not run `pricing:baseline:generate` or `pricing:public-baseline:generate` during an ordinary price change: those commands rewrite the frozen references. After the previewed change is confirmed, verify the affected billing/public scenarios and run:

```bash
pnpm test:validate
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm --prefix frontend run build
git diff --check
```

Keep the admin event ID with the operational change record. If any parity difference is intended, review it as a separate commercial decision and update frozen fixtures only with explicit approval.
