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
submission handlers. In particular, separating a confirmed Fal enqueue from a
later authentication/rate-limit result-read failure still needs an explicit
transport-phase signal; a request ID alone is insufficient evidence.

Focused runtime checks include `fal-wallet-refund-postgres.test.ts`,
`fal-wallet-webhook-postgres.test.ts`, `fal-poll-terminal-race-postgres.test.ts`,
`admin-refund-lock-order-postgres.test.ts` and the generate final-persistence tests.
Use the repository's disposable PostgreSQL 17 runner; no live paid generation is
needed for these regressions.
