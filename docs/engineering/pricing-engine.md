# Pricing Engine

## Current status

Pricing is in a parity-foundation migration. Existing production consumers remain authoritative. The canonical quote path introduced by this batch is restricted to tests and the audit command until a separately approved billing-migration plan is complete.

No price, margin, surcharge, membership discount, currency, rounding rule, wallet debit, public display, structured-data offer, or admin mutation may change during this foundation batch.

## Ownership model

The target flow is:

```text
provider facts → resolved commercial policy → @maxvideoai/pricing → presentation
```

Provider facts include vendor rates, units, duration, resolution, provider tiers, and factual addons. Commercial policy includes MaxVideoAI margins, flat fees, surcharges, membership effects, currency, and compatibility profiles. Consumers may format a canonical quote but may not recalculate it.

## Current consumer inventory

| Owner | Current responsibility | Foundation status | Intended destination |
| --- | --- | --- | --- |
| `packages/pricing` | Shared kernel, definitions, and snapshot types | Existing kernel remains active | Sole pure commercial kernel |
| `frontend/src/lib/pricing.ts` | Server billing orchestration and rule selection | Legacy-authoritative | Billing projection over canonical quotes |
| `frontend/src/lib/pricing-rule-store.ts` | DB rule persistence, fallback, selection, and cache | Legacy selection preserved | DB override loader feeding one resolver |
| `frontend/src/lib/pricing-specialized-snapshots.ts` | Luma, Seedance, GPT Image, and specialized billing math | Legacy-authoritative | Provider-fact adapters plus canonical kernel |
| `frontend/src/lib/audio-generation.ts` | Audio vendor components and a dedicated margin calculation | Legacy-authoritative | Audio facts plus canonical policy |
| `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts` | Video/image display calculations and formatting inputs | Legacy-authoritative | Scenario selection and presentation only |
| `frontend/components/marketing/PriceEstimator.tsx` | Interactive browser quote | Legacy-authoritative | Browser projection over canonical kernel |
| `frontend/components/marketing/PriceChip.tsx` | Compact browser quote | Legacy-authoritative | Browser projection over canonical kernel |
| `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing.ts` | Server model-page price | Legacy-authoritative | Canonical model scenario projection |
| `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts` | Model decision-card price | Legacy-authoritative | Canonical public projection |
| `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts` | Product Offer amount | Legacy-authoritative | JSON-LD projection from canonical quote |
| `frontend/src/server/tools/angle.ts` | Angle tool billing | Legacy-authoritative | Canonical tool quote |
| `frontend/src/server/tools/background-removal.ts` | Background-removal billing | Legacy-authoritative | Canonical tool quote |
| `frontend/src/server/tools/upscale.ts` | Upscale billing | Legacy-authoritative | Canonical tool quote |
| `frontend/app/(core)/admin/pricing` | Raw pricing-rule UI | Unchanged in foundation | Operational preview/confirm/history cockpit |
| `frontend/app/api/admin/pricing` | Raw pricing-rule mutations | Unchanged in foundation | Validated preview and mutation API |

## Policy precedence

Current billing selection remains exact engine and resolution, then engine, then global, then the historical in-code default.

The canonical resolver uses this deterministic precedence:

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

The committed baseline is generated only from current authoritative paths and contains no database or timestamp data.

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
- `fixed-product-current`: preserves seeded billing-product totals for tools without applying a second commercial margin or surcharge.

These profiles document existing behavior only. They cannot be added implicitly by the audit command and they do not authorize new cross-surface differences.
