# BytePlus contract-rate verification

Prepared 2026-09-28. Run **after** the account's ModelArk contract is signed and active, and before enabling the ByteDance tariff cutover or publishing the associated marketing changes. A signed document alone does not establish the rate applied to a particular task.

## Evidence to collect

Record the account and contract identifiers, status, legal entity, applicable region, effective and expiry dates, currency, billing unit, eligible model/SKU list, volume tiers, temporary promotions, minimum commitments, credits, tax treatment, and any geographic or resale restriction. Retain the source document or console URL and the time checked. Compare the signed agreement with the account's **effective** ModelArk price display; if they disagree, leave the effective cost unknown and ask BytePlus to reconcile them.

For each sellable ByteDance scenario, capture the exact provider model/version, normal versus Draft or final task, output resolution, video-input class, audio option, and image output pixel tier/reference count. Use `frontend/server/byteplus-list-tariff.ts` as the published-list benchmark only. Do not copy the public Fast/Mini promotion into the account-effective field without account-specific confirmation. Keep an unsupported or unspecified contract cell as `unknown`, including Seedance 1.5 if direct access is unavailable.

## Invoice reconciliation

After an authorized, bounded canary, record the provider task ID, timestamp, model, dimensions, input class, reported billable tokens or image counts, list estimate, account-effective estimate, credits or promotional adjustments, and the settled billing/usage line. Draft and final need separate task IDs and lines. Compare like-for-like amounts **before tax and credits**; reconcile rounding and currency conversion explicitly. A free trial or credit-covered line proves consumption but not a zero supplier price.

Only mark a rate `confirmed` when the account-specific tariff is traceable to the signed contract or active console display. Only mark cost `observed` when a settled usage or invoice line supports that scenario. If a line is missing or differs materially from the expected effective rate, keep the observed field unknown, investigate the SKU mapping with BytePlus, and block price-grid activation for that cell.

## Release gate

1. Fill the admin comparison from verified list, effective, and observed sources with separate dates and links. Do not derive supplier cost from the historical Seedance `legacyRetailBasis`/`vendorSubtotalCents`.
2. Freeze effective production customer quotes, including database overrides. Verify the proposed manual ByteDance tariff reproduces every currently sellable amount to the cent; list any deliberate delta separately for Adrien's decision.
3. Review the full scenario coverage, including 1080p, video input, 1.5 audio/silent, Seedream output tiers and references, and the two charges of a 2.5 Draft-to-final workflow. Unknown or ambiguous cells block activation.
4. Re-run the focused supplier/admin tests, `pnpm pricing:baseline`, `pnpm pricing:public-baseline`, `pnpm pricing:audit`, TypeScript, lint, and the relevant route smoke tests. Check actual billing and public quote results before rollout.
5. Deploy only after the contract is active, the observed rates are reconciled, current customer prices are preserved or separately approved, and the user approves the release. Do not treat the planned signing date as an activation date.

The comparison implementation is `frontend/server/pricing-admin/provider-cost-comparison.ts`. It accepts verified contract and invoice evidence as distinct inputs; absent evidence is represented by `null` with a status. The current branch renders these rows at the authenticated `/admin/pricing` route, but production exposure and the manual tariff grid still require their release gates.
