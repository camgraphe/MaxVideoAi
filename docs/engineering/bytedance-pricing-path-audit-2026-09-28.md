# ByteDance pricing path audit — 2026-09-28

This is a code and published-supplier-rate audit, not a production price change. The effective production `app_pricing_rules` rows, the BytePlus account's active contract and actual invoice lines still need to be read before any cutover.

## Present path and the misleading cost label

```text
BytePlus published token/image cost (sometimes copied into config)
  → Seedance 2.x token rate multiplied by 2.5 / 1.3 in launch-config.ts
  → pricing-public-facts.ts and pricing-billing-facts.ts call that result vendorCostUsd
  → @maxvideoai/pricing applies the resolved rule (versioned global default: +30%)
  → public/preflight/billing/admin quote
```

The authored global rule in `frontend/config/pricing-policy.json` is `marginPercent: 0.3`; `frontend/src/lib/pricing-rule-store.ts` has another 30% fallback. A DB rule may override either in production. `frontend/src/config/fal-engines/launch-config.ts` explicitly scales Seedance 2.x rates by `2.5 / 1.3` to target a public 2.5× quote. `frontend/src/lib/seedance-2-pricing.ts` calls the scaled result `vendorCostUsd`. Both factual adapters pass it as `vendorSubtotalExactCents`. `frontend/server/pricing-admin/canonical-scenarios.ts` then carries that value into the canonical quote, and `PricingPolicyInspector.tsx` labels it “Supplier subtotal”. **For those Seedance 2.x rows, that is a commercial basis, not a verified BytePlus supplier cost.** The historical 2.5× behavior is asserted in `tests/seedance-2-pricing.test.ts`; changing the fact input alone will change customer prices.

By contrast, `frontend/server/byteplus-accounting.ts` and `frontend/server/byteplus-poll.ts` estimate provider costs from the provider's token count and a distinct rate table. The job metadata currently writes the same estimate as both `provider_cost_usd_list` and `provider_cost_usd_effective`; it does not prove that a negotiated discount was applied. Reconcile this against the active account contract and invoice rather than labeling the estimate as actual billed cost.

## Published supplier facts to verify against account billing

The [BytePlus ModelArk pricing page](https://docs.byteplus.com/en/docs/ModelArk/1544106) currently lists USD per million tokens (divide by 1,000 for USD per 1,000 tokens):

| Model | Published list-price dimensions | Code discrepancy / review |
| --- | --- | --- |
| Seedance 2.5 | 480p/720p: 10.70 without video, 6.40 with video; 1080p: 11.70 / 7.00 | `byteplus-accounting.ts` and `launch-config.ts` use the 480p/720p rates at 1080p. Verify the account's rate/date, then correct cost facts without silently repricing customers. |
| Seedance 2.0 | 480p/720p: 7.00 / 4.30; 1080p: 7.70 / 4.70; 4K: 4.00 / 2.40 | Accounting and customer-fact tables do not represent every input-video/resolution combination consistently; enumerate actual supported modes before declaring parity. |
| Seedance 2.0 Fast | 5.60 / 3.30, with a currently advertised time-limited discount | Do not hardcode a temporary promotion as an enduring effective cost. |
| Seedance 2.0 Mini | 3.50 / 2.10, with a time-limited discount ending 2026-10-07 in the published page | Track effective dates separately from list rates and commercial prices. |
| Seedance 1.5 Pro | 2.40 with audio / 1.20 silent; Draft has provider-specific conversion factors | Current `seedance-1-5.ts` has legacy per-second values and Fal model IDs, without a source-linked BytePlus token tariff. Verify direct availability and end-of-life before porting. |

The same [published pricing page](https://docs.byteplus.com/en/docs/ModelArk/1544106) lists Seedream 5.0 Lite at $0.035 per successful image, Seedream 5.0 Pro at $0.045 or $0.09 by pixel tier plus $0.003 per input image after the first, and Seedream 5.0 Flash at $0.018. `frontend/src/config/fal-engines/seedream.ts` has multiple different `pricingDetails`, `pricing`, and customer hint values (Lite 4¢ in one details field versus 3.5¢ in another; Pro 12¢/24¢ in details versus supplier 4.5¢/9¢). Trace which consumers use each before relabeling or deleting them. Pro's product capability also advertises 4K outside the 2K input-schema options; reconcile that separately with the [provider image API](https://docs.byteplus.com/en/docs/modelark/image-generation-api).

The [BytePlus deprecation notice](https://docs.byteplus.com/en/docs/ModelArk/1350667) schedules `seedance-1-5-pro-251215` to stop after 17:00 UTC+8 on 2026-11-11, without automatic migration, and recommends Seedance 2.0 Mini. The agreed scope still includes connecting 1.5 directly if it is available in this account. Treat that route as a short-lived bridge: add a dated deactivation guard and replacement path before launch, avoid promoting it as a durable new offer, and keep historical Fal 1.5 jobs and receipts readable.

## Candidates for cleanup, with required proof

| Candidate | Evidence today | Proposed disposition and gate |
| --- | --- | --- |
| `SEEDANCE_2_NORMALIZED_UNIT_PRICE_USD_PER_1K_TOKENS` and `approved_2_5x` price source | Explicit 2.5/1.3 compensation in `launch-config.ts`; public and billing use it as a supplier fact | Replace with distinct provider tariff and manually authored customer tariff **in one parity-checked cutover**. Remove compensation only when all affected surfaces have the same approved quote or an approved deliberate delta. |
| Global 30% applied to ByteDance | Versioned default and rule-store fallback; no authored ByteDance commercial exemption found | Keep for other families. For the ByteDance pilot, use a complete explicit customer price grid and fail closed on missing cells, with no implicit 30% fallback after activation. Check production DB overrides first. |
| Seedance 2.x client quote's `vendorCostUsd` label | It is computed from the normalized commercial unit rate | Rename or split the value into factual supplier cost versus retail pricing basis; do not backfill historical receipts with guessed actual cost. |
| Duplicated Seedream `pricingDetails` / `pricing` / `pricingHint` | Conflicting numeric values in the authored config; generic definition, public, billing and SEO paths exist | Inventory each active consumer and preserve historical/SEO projections where required. Remove only demonstrably unused fields after contract tests. |
| ByteDance `falModelId`, hidden Fast BytePlus duplicate, fallback flags | `falModelId` is also used by aliases, engine capabilities and historical Fal-job sync; hidden Fast is covered by tests | Retire new-job Fal routing after canaries, but keep aliases/tombstones and old-job lookup. Remove the hidden duplicate only through the model-registry workflow after verifying its references. |
| List/effective/actual provider cost metadata | Poller currently duplicates list as effective and estimates from tokens | Require contract status, promotion dates and bill reconciliation; use `unknown` when an effective or actual value has not been verified. |

## Rebuild sequence

1. Export current production policy provenance and a read-only quote baseline per ByteDance scenario, including web preflight, billing, Studio, MCP, pricing hub, model page and JSON-LD. Compare actual production overrides; do not infer them from the versioned JSON.
2. Build a dated, source-linked BytePlus tariff table per model, resolution, input type, audio/Draft step or image pixel tier/reference count. Keep list, active contract and observed invoice costs distinct.
3. Introduce a ByteDance customer-price grid independent of supplier cost and the global 30% rule. The canonical pricing package must own its quote math. Seed every active cell from the current customer quote where preservation is required; record rounding and scale rules explicitly. Missing active cells block publication/charging rather than falling through to 30%.
4. Show both tariffs side by side in `/admin/pricing`, with source/date/status, exact scenario, gross difference, current/proposed customer amount and all affected surfaces. Changes still use server preview, explicit confirmation, immutable history and rollback.
5. Cut over one complete family only after deterministic public/billing parity tests and live canaries. Treat any deliberate price change, loss leader or promotion as a separate explicit decision. Repeat this method for other families.

No price, routing, contract or DB row was changed by this audit.
