# Seedance 2.5 Edit through ModelArk

Reviewed: 2026-10-13. Candidate qualification is in progress. Production Edit
remains unavailable until the genuine canary and normal Git release succeed.

## Current provider evidence

The [Seedance 2.5 ModelArk tutorial](https://docs.byteplus.com/en/docs/modelark/seedance-2-5)
and [video task API](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api),
updated on October 13, document video editing with the existing ModelArk bearer
credential at `https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks`.
The selected original is `reference_video`; the explicit task type is `edit`,
ratio is `adaptive`, and provider duration is `-1`. Output duration and framing
follow that source. The supported source duration is 4–30 seconds.

This path does not require LAS onboarding or its separate credential. The
existing account's recent ModelArk contract and Advanced Creation Rights do not
establish a LAS entitlement. The old support ticket predates those commercial
changes. No commercial request or vendor message was sent during this work.

## Closed activation and recorded execution

`SEEDANCE_2_5_EDIT_TRANSPORT` defaults to `las`, preserving the previously
guarded rollout. Explicit `modelark` selection additionally requires
`SEEDANCE_2_5_MODELARK_EDIT_ENABLED=true` and the existing `BYTEPLUS_ARK_API_KEY`.
The new gate defaults to false. LAS retains its independent key and execution
gate. Unsupported selections fail closed. T2V, I2V, Ref2V and Extend remain on
ModelArk with their existing options and prices.

The runtime catalogue projects source inheritance and per-mode availability.
The composer displays inherited timing and framing instead of independent
controls. Every source/image/audio reference must resolve to the owner's exact
stored original; caller metadata and origin aliases cannot supply execution
facts. Workspace, MCP and Studio use the same trusted source measurements.

An owned paid reservation commits the selected transport before one supplier
POST. Replay and concurrency cannot resubmit it. Acceptance persists the task
ID first; uncertain submission retains the original charge and never retries
or refunds automatically. Recorded transport governs polling and settlement
after current flags change. Definite rejection and terminal failure refund the
stored amount once. MCP quote state follows the same terminal outcome.

Durable video, accounting, output rows and required Library promotion precede
completion. A projection outage resumes from the copied original after the
supplier URL expires. Exact inherited duration remains separate from the
integer customer tariff class in output projections and keyframe preparation.

## Customer and supplier facts

ModelArk Edit reads the existing reviewed ModelArk input-token tariff curves.
It requires an active matching customer grid. It cannot consume LAS-shaped
curves. Conversely, LAS authoring and its 324-class correction refuse a current
ModelArk Edit selection. No production tariff mutation is part of this launch.
Transport selection is included in factual release bindings and quote supplier
provenance; historical paid snapshots remain unchanged.

The exact measured source duration remains continuous input usage. The output
tariff class rounds upward to the next existing integer selector; the provider
still preserves the original duration. For example, a 4.25s source retains a
4.25s output while the quote explicitly states its 5s output price bracket.
`seedanceEditSource` records both values, original dimensions and the reviewed
framing class. A changed source measurement makes a prepared paid quote stale,
even when its integer class and rounded customer cents remain equal.

The current customer grid covers six nominal source framing classes. Published
rasters slightly round these ratios, so source classification allows 1% raster
rounding. A custom format outside those reviewed classes refuses a current
quote; this is a customer-tariff coverage limit, not a newly asserted supplier
capability limit. No source duration within the published range is excluded
merely because it is fractional. The initial executable scope remains 480p and
720p while the four other modes retain their existing resolution support.

For 4s source, 4s output and 16:9:

| Resolution | ModelArk LIST estimate | Existing customer quote |
| --- | ---: | ---: |
| 480p | USD 0.491904 | USD 0.71 |
| 720p | USD 1.105920 | USD 1.59 |

Supplier estimates use ModelArk tokens and published minimums. The signed
Seedance 2.5 SKU has a 0% discount; Fast/Mini discounts cannot be inherited.
Reported terminal usage remains authoritative for token-based estimates and
the supplier invoice remains authoritative for actual cost. No LAS rate or
discount is applied to a recorded ModelArk task.

## Genuine canary and delivery

The owner authorized two generation POSTs maximum, USD 2 supplier cost and USD
4.94 temporary wallet exposure. The same ledger covers both the previous LAS
proposal and this alternative; switching transport never resets its counters.
Use the already imported, measured 4s synthetic original at 480p without audio.
Obtain a fresh canonical quote before each attempt. Stop after uncertainty or
any exhausted bound. Rejections count against the POST limit.

Use a real authenticated production-build candidate with normal wallet and
media services. Development deliberately cannot select production customer
tariff readers; do not bypass that isolation with sandbox/admin flags. Verify
one genuine happy path through acceptance, polling, durable download and Library
with one debit, then one genuine definite rejection/failure and exactly one
stored-amount refund. Fixtures separately prove uncertain-network recovery.

Only after qualification, select ModelArk and open its dedicated Edit gate in
the intended production environment. Follow `docs/deployment/github-vercel.md`:
isolated committed candidate, current main, PR, latest required Quality CI,
deployment check, merge, Git Vercel build and exact merged SHA on both domains.
Close only `SEEDANCE_2_5_MODELARK_EDIT_ENABLED` for rollback; keep the shared Ark
poll gate and credential available while accepted jobs reconcile.


Customer projections carry the immutable request separately from `sourceVideoOutput`.
Studio quotes, comparisons, read estimates, historical receipts and MCP comparisons expose
exact inherited duration and source framing; fractional sources disclose the literal billed
class. Library output timing preserves the canonical inherited duration in
`job_outputs.metadata.inheritedOutputDurationSec`, while its legacy integer column stays
compatible. A subsequent legacy synchronization cannot replace this field for the same
original URL; a changed URL clears it. Verified original probe facts remain authoritative
and are never synthesized from the source-preservation promise.
