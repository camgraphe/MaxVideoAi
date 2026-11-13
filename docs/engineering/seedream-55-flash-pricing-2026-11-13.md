# Seedream 5.5 and Flash pricing launch — 2026-11-13

Seedream 5.5 (`seedream-5-5`, direct model `dola-seedream-5-5-261028`)
and Seedream 5.0 Flash (`seedream-5-0-flash`, direct model
`dola-seedream-5-0-flash-260915`) have separate new-offer identities.
Existing Lite/Pro customer cells, source counts, paid receipts and provider
cost/contract projections are unchanged.

## Supplier facts

The [official ModelArk pricing table](https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing.md)
was read on **2026-11-13**. Its image section specifies:

| Model | Output LIST USD | Input LIST USD |
| --- | --- | --- |
| Seedream 5.5 | $0.020 at 921,600–2,601,123.84 pixels; $0.035 above that through 4,624,220.16 pixels | $0.008 per input, including the first |
| Seedream 5.0 Flash | $0.018 per successful output | Free |

The 5.5 threshold is exactly `1536² × 1.05²`. Do not reuse Pro's
different 2.61-million-pixel boundary. The new API domain is one output,
1K/1.5K/2K, and up to ten image references; there is no 3K/4K or provider batch
on these direct integrations. Native layer decomposition is outside this launch.

`frontend/lib/image/seedream-pricing.ts` owns the new dated LIST facts and
validated usage. Billing/public facts, supplier accounting and admin comparisons
consume this same owner. Provider estimates have not been reconciled to a new
invoice. Neither model inherits the signed Lite/Pro account discount.

## Customer prices

The existing repository standard policy (30% markup, no flat amount, no
membership discount, standard canonical rounding) was applied through
`resolvePricingPolicy` and `quoteCanonicalPricing` to the published LIST facts.
Its resulting literal customer cents are authored as 39 **new** versioned cells
in `frontend/config/customer-tariffs.json`. Existing cells were not regenerated.

| Total input images | 5.5 1K / 1.5K cents | 5.5 2K cents | Flash cents, all tiers |
| --- | ---: | ---: | ---: |
| 0 (text-to-image) | 3 | 6 | 3 |
| 1 | 4 | 6 | 3 |
| 2 | 6 | 7 | 3 |
| 3 | 6 | 8 | 3 |
| 4 | 7 | 10 | 3 |
| 5 | 8 | 11 | 3 |
| 6 | 10 | 11 | 3 |
| 7 | 11 | 12 | 3 |
| 8 | 11 | 13 | 3 |
| 9 | 12 | 15 | 3 |
| 10 | 13 | 16 | 3 |

5.5 edit selectors carry the **total** input count. Public scenario parameters
retain the existing convention of additional references beyond one edit source;
the adapter constructs and prices that exact total. Flash's free references stay
validated request facts without distinct priced selectors. Aspect ratio,
watermark, file format and 5.5 background do not change these prices.

App billing, MCP settlement, Studio estimates and current marketing readers all
use `computeCanonicalBillingSnapshot`. These new IDs require an active customer
tariff state and a matching cell: unavailable state, missing cells or an inactive
grid fail closed. Versioned launch cells do not bypass database readiness. No
database migration or production tariff writer is introduced by this addition.

Estimator option hints read the same versioned text-to-image cells; the effective
API quote remains authoritative. The old synchronous Pricing helper returns no
fallback quote for these new models. A separate 18-row offline launch fixture
records canonical versioned-cell samples explicitly; it is not live pricing or
an account activation certificate, and earlier public fixtures remain frozen.

## Verification boundaries

`tests/seedream-new-model-pricing.test.ts` covers the exact pixel boundary,
first/all input charges, free Flash references, unsupported requests, fixed-cell
coverage, public scenario source identity, estimator rates and fail-closed reads.
`tests/seedream-new-model-pricing-postgres.test.ts` exercises the real canonical
readers against disposable PostgreSQL. These tests do not launch paid provider
generations or establish model access on the production account.
