# Fal job failure diagnostics

## Recovery messages reviewed 19 October 2026

The shared public failure projector also recognizes historical MiniMax image
geometry rejections, unavailable editing modes, generic start/final failures,
Seedream prompt versus reference-image refusals, and the typed
IMAGE_HOST_NOT_ALLOWED submission failure. Only allowlisted submission codes
may become public failure codes. Unknown diagnostics use fixed localized copy.

Wallet recredit confirmation depends on persisted refunded_wallet for all
failure categories. It does not depend on whether the failure reason was
recognized, and must never imply a card refund, an included-trial refund, or
authorization for another paid attempt. Web confirmations can include the
confirmed amount/currency; refund receipt labels preserve image quantities.

Receipt GET selects only the provider/submission diagnostic fragments through
the same owner-scoped correlated lookup and paginated SELECT. Historical
messages are projected at read time; stored descriptions, amounts, currencies,
payment states and lifecycle logs stay unchanged.

MiniMax H3 start/end frames use the same stored image geometry checks as
reference images: each side at least 256 pixels, width/height ratio 0.4–2.5.
Both canonical quote validation and Web preflight enforce these constraints.
Client dimension claims do not replace stored original metadata.

Fal webhooks place model output or validation details in `payload`. Keep legacy
`result`, `response` and `data` compatibility, but do not discard the native
envelope. An outer `Unexpected status code: 422` is transport context, not the
failure cause. SDK result reads expose the equivalent details in `Error.body`.

`frontend/server/fal-webhook-errors.ts` owns diagnostic extraction. It follows
diagnostic containers only and must not echo rejected inputs, media URLs, request
IDs or metrics as error messages. A typed `content_policy_violation` is a content
refusal; a bare 422 does not establish moderation.

Public Web status/history, agent status and Billing refund descriptions project
known failures through `frontend/lib/generation-failure-messages.ts`. Generated
outputs must stay distinct from rejected inputs: Wan's historical `Green net
check rejected image (output)` becomes a generated-image safety refusal, while
Seedance's `OutputAudioSensitiveContentDetected` becomes an audio-output refusal.
For historical Seedance tasks, this precise stored provider code overrides the
older incorrect reference-media code in `video-failure-codes.ts`. Copyright
output refusals are resolved before generic safety or storage wording, including
agent responses; `copyright` must not match storage's `copy` branch.

Refund GETs use one paginated SELECT with an owner-scoped job lookup for existing
refund rows. Only diagnostic projection changes: stored receipts, amounts,
currency, payment state, provider diagnostics and lifecycle logs remain intact.
The Web Billing panel localizes the projected reasons in English, French and
Spanish. Only `refunded_wallet` permits a separate wallet-recredit confirmation;
neither a failure nor an agent retry instruction establishes that payment state.

The webhook passes that explanation through the shared user-facing sanitizer to
the job, refund helper and lifecycle log. Safety guidance covers prompts and
reference media, not only prompt wording. Admin audit prioritizes lifecycle logs
and refund metadata over the job message, so a historical description repair
must keep all three aligned and preserve the original values in an audit trail.

Queue `COMPLETED` means processing ended, not necessarily successful inference.
Polling can settle a structured 422 result as a terminal rejection. Authentication,
missing-result, rate-limit and server read errors must not authorize refunds.
Never resubmit a paid generation to diagnose its status.

Wallet credits and provider spending are distinct. A refunded job that later
delivers output needs a chronology audit: distinguish a premature refund from a
late provider recovery after a confirmed terminal failure. A content refusal with
no output is not proof of an improper refund. Pricing snapshots are estimates,
not billing events. Do not add wallet refunds to provider costs and call the sum
a loss.

Focused regression checks:

```sh
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/fal-webhook-errors.test.ts tests/fal-webhook-content-persistence.test.ts tests/fal-long-running-poll.test.ts tests/user-facing-failure-messages.test.ts tests/generation-output-failure-guidance.test.ts tests/generation-status-service.test.ts tests/recent-generations-service.test.ts tests/billing-read-routes-postgres.test.ts
```

## Terminal races and wallet settlement (29 October 2026)

Fal's eligible terminal failure and its wallet refund share one PostgreSQL
transaction in `fal-webhook-refunds.ts`. The scope acquires the per-job advisory
lock, then the job row, then the charge row. Admin refunds use the same order
for both job and receipt selectors. Call `withWalletFailureSettlement` before
writing the failure; do not nest its transaction inside a transaction already
holding these locks. No provider or media I/O belongs inside this scope.

The refund uses the single persisted wallet charge: its owner, amount, currency,
surface and pricing snapshot. An absent, ambiguous, card-funded or mismatched
charge fails reconciliation instead of crediting from a caller's estimate.
The refund receipt and `refunded_wallet` status must both persist. Storage errors
propagate, rolling the failure transition back so a later poll or webhook can
retry. Fal polling must not replace a failed refund transaction with a standalone
`status='failed'` fallback. The standalone refund helper can also reconcile an
existing receipt/status split when that job is explicitly replayed; this is not
a scan or repair of all historical failures.

If completion wins before settlement, no new automatic refund is permitted.
If a legitimate failure/refund commits first and output arrives later, recovery
may still complete the job, preserving its refunded payment state. This case
remains auditable; completion never authorizes a new wallet debit or erasing a
refund. Manual support refunds of completed jobs remain supported.

Final generation persistence returns whether the update applied and a durable
job snapshot. A stale acknowledgement must use the persisted response and skip
its local failure/refund effects. Even an applied response uses the returned media,
progress and payment state. `failed` alone must never project `refunded_wallet`. Read the losing snapshot with a separate SQL
statement: a CTE fallback SELECT shares the pre-wait snapshot and can return stale
state after an UPDATE loses a row-lock race. An uncertain final persistence error
after provider work is not permission to roll payment back or submit again.

This scope does not redesign the legacy Stripe rollback or all provider-specific
submission handlers. The transport-phase follow-up below distinguishes accepted
Fal requests from later read errors; a request ID alone is insufficient evidence.

Focused runtime checks include `fal-wallet-refund-postgres.test.ts`,
`fal-wallet-webhook-postgres.test.ts`, `fal-poll-terminal-race-postgres.test.ts`,
`admin-refund-lock-order-postgres.test.ts` and the generate final-persistence tests.
Use the repository's disposable PostgreSQL 17 runner; no live paid generation is
needed for these regressions.


## Fal acceptance and outcome provenance (29 October 2026 follow-up)

`fal.ts` records evidence at the transport boundary; `fal-error-provenance.ts`
owns error normalization and phase classification into `FalGenerationError`.
`fal-error-handling.ts` owns the decision to defer, and
`fal-submission.ts` retains the existing job identity for recovery. An error's
request ID, message, HTTP status or `onRequestId` persistence callback alone does
not prove provider acceptance or terminal inference failure.

- Pre-submission errors occur before any provider submission, including local
  configuration or request construction. They retain their existing refusal
  semantics and error codes.
- A single POST can establish a definite rejection through its explicit client
  error response. A timeout, server error, network failure or unusable success
  acknowledgement instead leaves submission uncertain, including Kling v4's
  forced queue path when `submissionMode` is absent.
- A successful queue response with a nonempty request ID, or the installed SDK's
  `onEnqueue` after successful submission, establishes acceptance. Set this fact
  before invoking local persistence hooks. Errors from those hooks must not
  authorize a refund, even when they carry a 422-like status or body.
- After acceptance, authentication/rate-limit/status-read errors remain
  recoverable. A terminal result rejection needs evidence from the result read
  after a matching completed queue state, plus a structured 422 failure. A bare
  422, safety wording during a status read, or an unrelated queue identity is
  insufficient. The webhook and normal polling retain their terminal outcome
  ownership.
- Before responding with a deferred state, read the durable job where possible.
  If a webhook has already completed it, return that completed state. A storage
  outage still does not authorize a new paid request or a payment rollback.

The installed `@fal-ai/client` 1.7.0 calls `queue.submit`, then `onEnqueue`, then
`queue.subscribeToStatus`, then `queue.result`. Its legacy submit path also retries
some POST failures. An error before its acknowledgement therefore remains
uncertain: the final error cannot establish that an earlier attempt was rejected.
The acceptance-provenance follow-up did not remove those SDK retries or prove a
provider charged multiple requests. The subsequent GEN-03 transport change below
routes the four direct-provider fallbacks through the existing single-POST helper.
The SDK subscription API itself is unchanged.

An uncertain submission without a verified provider ID is not automatically
pollable: the regular Fal poll requires that ID, and stale provisional settlement
selects only pending jobs without a request fingerprint, not these running jobs.
A correlated callback may recover the identity; otherwise this still needs
explicit reconciliation. Do not promise an automatic retry or refund, or describe
provider acceptance as confirmed. Bounded reconciliation of ambiguous submissions
belongs with the remaining GEN-03 work, not a blind refund scan.

Acceptance provenance is local control-flow evidence, not client-supplied data,
a new database schema or a replacement for the persisted job/provider identity.
Verify the SDK ordering again if its version or subscription implementation changes.

## Single-POST Fal fallback transport (30 October 2026)

The Alibaba Model Studio, Luma Agents, Google Vertex Veo and Kling direct
submission owners explicitly set `submissionMode: 'enqueue'` when delegating an
eligible fallback to `submitFalGenerateTask`. Kling applies it after its existing
payload sanitizer. These paths therefore use `submitFalQueueOnce`, like the main
Fal route, instead of the SDK subscription's retrying submission. Eligibility,
provider routing flags, request content, prices and the original job stay with
their existing owners.

A verified acknowledgement records the provider ID and returns queued; webhook
and poll recovery read that job's result. The submission no longer waits for a
rendered result through SDK polling. A server error, network exception or unusable
acknowledgement remains an uncertain submission: do not create another provider
attempt, refund it based only on that uncertainty, or present acceptance as
confirmed. A definite single-POST refusal retains the existing failure policy.
The acceptance-provenance and durable-terminal-response rules above still apply.

This is an application fallback correction, not a global change to Fal SDK retry
configuration. A local transport witness can prove multiple POSTs before the
change; it cannot prove two provider acceptances or a double charge in production.

Unknown submissions without a provider ID still need bounded reconciliation.
The single-POST helper adds the local job ID to a configured webhook URL, but the
current webhook route promotes that query ID only with its configured shared
token and for `job_` / `tool_upscale_` IDs. UUID jobs used by canonical
MCP/Studio/Toolbox submissions are outside this query-correlation fallback.
Do not describe enqueue mode as universal recovery of lost acknowledgements or
widen webhook correlation without its own authorization and ownership tests.

## Direct acknowledgements and fallback outcome projection (30 October 2026)

Kling direct, Google Vertex Veo, Luma Agents video and Alibaba Model Studio
separate the validated creation acknowledgement from local persistence.
After that acknowledgement, an attempt-save, job-save,
readback or diagnostic failure is not a provider rejection and must not enter the
pre-acknowledgement fallback or payment-rollback policy. The existing rules for
actual failures before an acknowledgement remain with each provider owner.

`direct-provider-acceptance.ts` owns their post-acknowledgement persistence and
response. Attempt and job writes are independent so a failed attempt update does
not prevent saving the identity on the job. The job write preserves terminal
states and an already-bound different provider identity. A separate durable read
forms the response when available, including a winning completion or failure and
its actual payment state. These direct accepted responses return before the
common final-generation persistence; they cannot rely on that later owner to
repair their state or response. Luma and Alibaba retain their transport-specific
diagnostic sanitizers before saving the acknowledgement snapshot. If that local
sanitization fails after acceptance, omit the snapshot and preserve the accepted
identity; never persist or log the unfiltered response as a fallback. Owned-media
transport, Luma source revalidation and direct-only routing remain before the
provider call with their existing owners.

If readback is also unavailable, retain the validated acknowledgement in the
deferred response without inventing a persisted payment outcome. This prevents a
new provider request or local refund, but does not guarantee automatic recovery:
the direct polls require the provider ID in `app_jobs`. An ID saved only in
`provider_attempts` or returned to the client is evidence for reconciliation, not
an automatic poll repair. No background identity discovery or historical repair
is introduced here. This covers these four video submission owners, not every
direct provider or synchronous image execution path.

`fal-fallback-outcome.ts` handles durable terminal responses before the four
fallback wrappers interpret their internal `ok: false` discriminant as a failure.
An HTTP 200 response with a completed job is not a failed submission. The response
must belong to the requested job; a different job's body cannot supply its output,
payment state or provider ID. Preserve the known local acknowledgement rather
than adopting an ID from a concurrent winner. Terminal attempt projection uses
the existing exact job/provider/request binding. Without that binding, preserve
the winning job response without claiming that the current attempt produced it.
The journal remains separate from job settlement: this projection never submits,
reserves or refunds payment, and a journal-write failure cannot replace the
durable job outcome with a fabricated provider failure.
