# Kling 4.0 pricing preparation

Current 25 October integration: [INTEGRATION-2026-10-25.md](INTEGRATION-2026-10-25.md) supersedes static markup proposals as runtime pricing. Supplier LIST facts and exact admin selectors are implemented; no customer cell is selected or activated.

Status: **offline preparation; no active tariff, customer quote, provider generation, database write or pricing-admin publication**. Source date is 2026-10-21 UTC; preparation continued on 2026-10-22 in Europe/Madrid. The latest user decision selects fal for initial qualification, with normal fal price plus 30% markup as the customer-authoring basis. Direct recovery/qualification is a later independent route. This document preserves that intent without changing current policy or installing tariff cells.

[Provider evidence](provider-evidence-2026-10-21.md) owns the exact schema/access qualifications. [Prepared matrix](pricing-matrix-2026-10-21.json) contains 1,624 integer input/output rows and 10 fractional-source examples, calculated through `packages/pricing/src/canonical.ts#quoteCanonicalPricing`. Its explicit flags keep execution, activation and current customer pricing false. No runtime candidate estimator was added: account-level paid behavior and billing precision remain unqualified, and the existing canonical package already supplies the required offline commercial calculation.

## Supplier reference matrix

[Official direct pricing](https://kling.ai/document-api/pricing/base/video.md) and [fal T2V](https://fal.ai/models/kling/v4/text-to-video), [I2V](https://fal.ai/models/kling/v4/image-to-video), [R2V](https://fal.ai/models/kling/v4/reference-to-video), [Edit](https://fal.ai/models/kling/v4/video-to-video/edit) agree on these normal published USD rates:

| Reference class |720p USD / billed second|1080p USD / billed second|Billable duration|
|---|---:|---:|---|
|Text/image/reference without input video|0.157|0.235|Output seconds|
|Reference with video references or video elements|0.094|0.141|max(input total + output, 2 × output)|
|Edit|0.094|0.141|max(source + output, 2 × output)|

Output domain is integer 3–30s for the observed fal schema, and 720p/1080p only. For multi-shot generation, output is the sum of shot durations. Video-source totals include reference videos and character-video elements. The provider's 30.05s media-validator tolerance must not expand the advertised 30s mixed-reference budget.

Direct's unit table is 1.0/1.5 units without video and 0.6/0.9 units with video. Use its published USD values directly; the General package unit conversion and discounts explicitly exclude V4/Flash. No V4 discount, effective account rate or actual invoice was verified. Cash deductions and prepaid units remain distinct accounting quantities. A future direct callback's actual amount/currency/list_price is evidence of a real deduction, while a unit quantity is not cash revenue or USD expense without its applicable cost basis.

Fal's generic embedded `endpointBilling.price=0.157` appears even for Edit. It does not express the actual scenario matrix and must not enter a universal per-second cost.

## Canonical commercial rounding

The [pricing-engine guide](../../engineering/pricing-engine.md) separates provider facts, reviewed commercial policy and the canonical calculator. Production uses reviewed literal tariffs; a prepared FAL+30% calculation cannot supply a missing active cell or public quote.

The existing `standard` profile in `frontend/config/pricing-policy.json` preserves fractional provider cents for commercial math, rounds the 30% margin upward, then rounds the final total to nearest cent. The kernel uses its `1e-9` cent epsilon for upward rounding. It also projects the vendor display component separately. Do not independently implement `round(cost × 1.3)` or round each source clip before summing.

For preparation, the global authored 30%/zero-flat rule is explicitly selected, with no optional surcharge, no membership discount and USD currency. Native audio is fixed/announced V4 behavior, so no additional optional-audio 20% surcharge is selected. This is a markup on normal fal reference cost, not a 30% gross-margin target. A direct account discount later affects realized supplier margin without silently changing an already-authored customer tariff.

| Example |Supplier reference USD|Prepared customer USD|Qualification|
|---|---:|---:|---|
|5s output, 720p, no video input|0.785|1.03|Canonical standard candidate|
|5s output, 1080p, no video input|1.175|1.54|Canonical standard candidate|
|5s output, 3s video input, 720p|0.94|1.23|10 billed seconds|
|5s output, 10s video input, 720p|1.41|1.84|15 billed seconds|
|30s output, 30s video input, 1080p|8.46|11.00|60 billed seconds|

The JSON is an authoring/review artifact, never an export of current customer prices. It stores exact normal cost estimates separately from prepared integer customer cents and canonical margin cents. It binds the policy-file SHA-256 and identifies the canonical owner used.

## Source timing and provider differences

Source seconds must be measured from exact owned server-resolved media. Client declarations, thumbnail timing and requested output duration are insufficient. Do not treat a missing input duration as zero; no numeric source-sensitive candidate should be exposed until all applicable videos are measured. Preserve per-source identities and total duration so a retry/fallback can be audited.

The formula is documented; the supplier's fractional-second quantization, duplicate-source charging and invoice rounding are not. The matrix exhausts the integer source domain from 3 through 30, and includes samples around equal-input/output boundaries plus fractional media. It does **not** certify every continuous-source transition or an effective charged amount. The schema's nullable Edit duration defaults to measured source length, but its explicit parameter is integer; the effective output/fractional-source mapping still needs a provider contract and qualification.

New direct API design is distinguished by versioned paths and a generic new callback shape. Direct V4 submit/poll routes and exact options were absent from the public index consulted. A free account query separately returned HTTP200/code0 and no packages in the queried window; it proves neither entitlement nor a discounted rate. The 21 October prelaunch copy said API coming soon; that access assumption is superseded by the successful bounded T2V test on 25 October. Same published rates do not make the two transports interchangeable: direct voice/element IDs, additional edit videos and keyframe control cannot be sent to fal by analogy.

## Required work before any tariff activation

1. Verify fal execution eligibility and its accepted request/result/billing behavior first. The authenticated playground Run control is enabled, but no paid call has been made. Keep application execution disabled until qualification passes. Direct endpoint/input/output/poll/cancel documentation and account recovery are separate prerequisites for adding a later direct route.
2. Revalidate rates and define supplier source-duration rounding with actual provider evidence. If it remains unknown, retain explicit estimate status and a conservative qualification gate, not a fabricated exact quote.
3. Use the existing canonical tariff-authoring flow to prepare every supported output/mode/resolution selector. Continuous input needs reviewed literal unit components or bands and full-domain validation; a sample matrix cannot certify it.
4. Retain provider facts, normal fal customer basis, prepared customer cents, effective supplier costs and observed invoice amounts as separate records. Bind future quotes to trusted input facts and selected provider provenance.
5. Review the exact commercial matrix through the existing preview/confirmation process. Add immutable tariff versions and activation evidence only under separate authorization. No fallback to catalog price or this JSON when live tariff coverage is absent.
6. After budget authorization, compare bounded real fal jobs against their exact recorded quote, output metadata and ledger. Qualify any later direct route separately. Test ambiguous submission, failures, refunds and fallback eligibility without ever double-submitting an accepted task.

## Offline validation performed

The local generator `.local/kling-v4/research/prepare-pricing-matrix.mjs` calls the real canonical function with a deliberately selected preparation policy. It generated 56 no-video rows and 1,568 video-input rows, plus 10 fractional examples. Assertions checked canonical rounding examples, minimum twice-output billing, input-plus-output billing, the 30s/30s/1080p cost boundary, row count and prepared customer totals above the reference cost ceiling. All assertions passed. The first local invocation failed only because the script's relative import had one extra parent directory; that path was corrected before generation.

No provider requests, runtime estimator, database/admin mutations, production activation or live tariff verification occurred in this pricing subtask. Future release checks must use current committed code, current supplier evidence and the existing pricing owner.
