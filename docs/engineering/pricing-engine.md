# Pricing Engine

## Current status

The pricing parity foundation and billing consumer migration are complete. The deterministic audit reports **178 scenarios, 178 matches, 0 mismatches, and 4 explicit compatibility profiles**. New wallet/direct generation, image, audio, and tool charges are canonical-authoritative. Public pricing pages, model pages, estimators, chips, and JSON-LD remain on their frozen legacy projection until a separately reviewed public projection migration.

The billing migration did not change any price, margin, surcharge, membership discount, currency, rounding rule, wallet debit, direct-payment comparison, public display, structured-data offer, or admin mutation.

## Ownership model

The target flow is:

```text
provider facts → resolved commercial policy → @maxvideoai/pricing → presentation
```

Provider facts include vendor rates, units, duration, resolution, provider tiers, and factual addons. Commercial policy includes MaxVideoAI margins, flat fees, surcharges, membership effects, currency, and compatibility profiles. Consumers may format a canonical quote but may not recalculate it.

## Current consumer inventory

| Owner | Current responsibility | Foundation status | Intended destination |
| --- | --- | --- | --- |
| `packages/pricing` | Canonical policy, quote, provenance, and snapshot projection | Canonical-authoritative for billing | Sole pure commercial kernel |
| `frontend/server/pricing/quote-billing.ts` | Server billing orchestration for video, image, and audio | Canonical-authoritative | Stable billing owner |
| `frontend/src/lib/pricing-billing-facts.ts` | Billing provider facts and descriptive snapshot metadata | Canonical billing input | Stable factual adapter layer |
| `frontend/src/lib/pricing.ts` | Shared legacy pricing facade | Legacy-authoritative for public projections only | Public migration compatibility facade |
| `frontend/src/lib/pricing-rule-store.ts` | DB rule persistence, fallback, routing metadata, and cache | Canonical override input; legacy admin API retained | One resolver input |
| `frontend/src/lib/pricing-specialized-snapshots.ts` | Specialized legacy public projection helpers | Legacy public reference | Removed after public migration |
| `frontend/src/lib/audio-generation.ts` | Audio vendor facts plus deterministic legacy projection helper | Facts used by canonical production audio | Keep factual builder; retire duplicate public math later |
| `frontend/src/lib/billing-products.ts` | Fixed-product loading and tool quote projection | Canonical-authoritative for tools | Stable fixed-product billing owner |
| `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts` | Video/image display calculations and formatting inputs | Legacy-authoritative | Scenario selection and presentation only |
| `frontend/components/marketing/PriceEstimator.tsx` | Interactive browser quote | Legacy-authoritative | Browser projection over canonical kernel |
| `frontend/components/marketing/PriceChip.tsx` | Compact browser quote | Legacy-authoritative | Browser projection over canonical kernel |
| `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing.ts` | Server model-page price | Legacy-authoritative | Canonical model scenario projection |
| `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts` | Model decision-card price | Legacy-authoritative | Canonical public projection |
| `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts` | Product Offer amount | Legacy-authoritative | JSON-LD projection from canonical quote |
| `frontend/src/server/tools/angle.ts` | Angle tool billing | Canonical fixed-product quote | Stable consumer |
| `frontend/src/server/tools/background-removal.ts` | Background-removal billing | Canonical fixed-product and dynamic quote | Stable consumer |
| `frontend/src/server/tools/upscale.ts` | Upscale billing | Canonical fixed-product and dynamic quote | Stable consumer |
| `frontend/app/(core)/admin/pricing` | Raw pricing-rule UI | Unchanged in foundation | Operational preview/confirm/history cockpit |
| `frontend/app/api/admin/pricing` | Raw pricing-rule mutations | Unchanged in foundation | Validated preview and mutation API |

## Policy precedence

Canonical billing uses this deterministic precedence:

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

The committed baseline remains the frozen pre-migration reference and contains no database or timestamp data. The audit compares canonical outputs against that reference; it is not a second production pricing owner.

```bash
pnpm pricing:baseline
pnpm pricing:baseline:generate
pnpm pricing:audit
pnpm --silent pricing:audit -- --json
```

`pricing:baseline:generate` is an intentional write operation. The other commands do not mutate pricing policy or application state.

Every current cross-surface difference is preserved and identified by a compatibility profile. Updating `frontend/config/pricing-policy.json` is a commercial change after this foundation batch and requires an intentional matrix review; it must never be bundled into an unrelated refactor.

## Foundation compatibility profiles

- `standard`: preserves fractional provider cents for commercial math and rounds the margin upward.
- `provider-reference-current`: preserves the existing Luma and Seedance behavior that rounds the provider share and the commercial subtotal upward before deriving the margin component.
- `audio-current`: preserves the existing 150% audio margin and integer vendor components.
- `schema-current`: preserves structured-data offers that currently use an already-authored offer amount without adding another margin.
- `fixed-product-current`: preserves seeded billing-product totals without a second margin or surcharge and retains the historical zero platform/vendor allocation fields.

These profiles document existing behavior only. They cannot be added implicitly by the audit command and they do not authorize new cross-surface differences.

## Billing authority

New charges enter through `frontend/server/pricing/quote-billing.ts` or the canonical fixed-product functions in `frontend/src/lib/billing-products.ts`. API routes and tool runners do not call the pure kernel directly. Wallet and receipt persistence consume the projected snapshot without recalculating it, and refunds use stored charged amounts.

## Next migration

The next architecture target is the public projection migration. It must separately migrate pricing pages, model pages, estimators, chips, and JSON-LD while preserving the same 178-row reference. Admin pricing behavior remains outside that batch.
