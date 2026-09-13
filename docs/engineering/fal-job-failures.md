# Fal job failure diagnostics

Fal webhooks place model output or validation details in `payload`. Keep legacy
`result`, `response` and `data` compatibility, but do not discard the native
envelope. An outer `Unexpected status code: 422` is transport context, not the
failure cause. SDK result reads expose the equivalent details in `Error.body`.

`frontend/server/fal-webhook-errors.ts` owns diagnostic extraction. It follows
diagnostic containers only and must not echo rejected inputs, media URLs, request
IDs or metrics as error messages. A typed `content_policy_violation` is a content
refusal; a bare 422 does not establish moderation.

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
delivers output is an improper wallet refund; a content refusal with no output
is not proof of an improper refund. Pricing snapshots are estimates, not billing
events. Do not add wallet refunds to provider costs and call the sum a loss.

Focused regression checks:

```sh
frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/fal-webhook-errors.test.ts tests/fal-webhook-content-persistence.test.ts tests/fal-long-running-poll.test.ts tests/user-facing-failure-messages.test.ts
```
