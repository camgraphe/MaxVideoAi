# Pricing Engine

## Current status

The pricing parity foundation, billing migration, and public projection migration are complete. The deterministic audit reports **178 scenarios, 178 matches, 0 mismatches, and 4 compatibility profiles in use**. The exhaustive public contract reports **492 unchanged rows**. Wallet/direct generation, image, audio, tool charges, public pricing pages, model pages, estimators, chips, JSON-LD, workspace preflight, and image estimates are canonical-authoritative.

These migrations did not change any price, margin, surcharge, membership discount, currency, rounding outcome, wallet debit, direct-payment comparison, public display, structured-data offer, seeded product, or admin mutation. The public batch added one named rounding-only compatibility profile after the frozen fixture demonstrated the historical behavior it preserves.

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
| `frontend/src/lib/pricing-rule-store.ts` | DB rule persistence, fallback, routing metadata, and cache | Canonical override input; legacy admin API retained | One resolver input |
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
| `frontend/app/(core)/admin/pricing` | Raw pricing-rule UI | Unchanged in foundation | Operational preview/confirm/history cockpit |
| `frontend/app/api/admin/pricing` | Raw pricing-rule mutations | Unchanged in foundation | Validated preview and mutation API |

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

1. Replace the raw admin rule editor with a preview/provenance/history/rollback cockpit without changing current prices.
2. Migrate any non-public compatibility consumers, then delete `frontend/src/lib/pricing.ts` and superseded specialized commercial helpers.
3. Tighten the semantic one-owner guard once those compatibility paths are gone.
