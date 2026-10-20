# GA4 payment outbox

Implemented 2026-10-20; deployment evidence belongs in OUTREACH. Scope: newly recorded
live, consented wallet funding and existing `topup_refunded` notifications. Direct
card-funded generations and standard GA4 `refund` ecommerce events remain outside
this contract. A refund notification is not a wallet credit reversal.

## Ownership and durability

- `stripe-webhook-topup-persistence.ts` writes `ga4_outbox_version=1` only on new
  receipts and queues both events inside the same transaction. Optional measurement
  SQL is protected by a savepoint. Fulfillment does not depend on Google or the outbox.
- `ga4-wallet-events.ts` projects immutable receipt amount/currency/first-payment
  state and bounded attribution. Repair scans at most 20 recent, explicitly versioned
  receipts missing either key. It cannot queue pre-release receipts or revive a
  terminal event. It never changes the financial ledger.
- `stripe-webhook-refunds.ts` queues one signed delta per charge/cumulative refunded
  amount. A failed insert throws to the existing Stripe processor retry path.
  Different notifications for the same cumulative snapshot share a key. The
  signed previous_attributes delta remains the source; this is not a bank ledger.
- `ga4-payment-outbox.ts` owns uniqueness, SKIP LOCKED claims, a fresh lease token,
  two-minute lease recovery, attempt count, backoff and terminal payload erasure.
- `ga4-payment-worker.ts` rechecks current/legacy admin tables and stored cookie
  consent before each HTTP attempt. Role/query uncertainty retries without emission.

The checkout captures a server-side consent observation time in Stripe metadata;
older signed objects use their creation time, and unknown times use epoch (any
persisted later choice suppresses that old event). A recorded denial or any later
consent decision, including a regrant, suppresses the old snapshot permanently.
Anonymous grants are not stored against an account, so no stored row falls back to
the original granted cookie snapshot. A browser-only withdrawal whose request never
reaches the server cannot be observed here. This is not a universal consent history.

## Sender and limits

`/api/cron/ga4-payments` runs every five minutes on Vercel production only. It requires
exact `Authorization: Bearer <CRON_SECRET>`; cron headers alone grant no access.
Preview/local requests cannot send. `GA4_PAYMENTS_DISABLED=1` disables the route;
GA4_MEASUREMENT_ID and GA4_API_SECRET must both be configured. No secret is persisted
in the queue. Keep those values out of logs and reports.

Each run repairs at most 20 receipts and claims at most 20 events, four concurrent
senders. Each HTTP request has a five-second timeout and rejects redirects. The
route budget is 60 seconds. Network uncertainty, missing configuration and unavailable
eligibility use exponential backoff: 5, 10, 20, 40, 80, 160, 320 minutes, capped at six
hours. Eight claims maximum; crashes also consume a claim. Expire at 71 hours, before
GA4's 72-hour backdating limit. Preserve original timestamp_micros on every attempt.
The existing user-derived client-ID fallback is retained when browser identity is
missing; it does not establish source/session attribution.

Google advises correcting non-2xx HTTP responses rather than replaying them unchanged:
these become `dead` with HTTP status, without body/error text. Any 2xx becomes `accepted`
and is never retried automatically; it proves transport receipt only. A network timeout
or a crash between acceptance and SQL acknowledgment may send a duplicate. Purchase
transaction_id stays stable, but no exactly-once guarantee is made for any event.

Terminal states retain dedupe keys and aggregate outcomes; payload and user linkage
are removed. Do not delete tombstones or manually reset statuses to replay events.
Review the original cause and the GA window before authorizing any targeted recovery.

## Release and rollback

Apply only `neon/migrations/76_ga4_payment_outbox.sql` in a transaction to the verified
Neon target before this runtime. It is additive and replayable; it does not rewrite
receipts or change balances. Validate its schema/index and the existing role/consent
tables. Follow `docs/deployment/github-vercel.md` for GitHub CI and production delivery.
Verify CRON_SECRET exists in production, then check authenticated aggregate results and
the scheduler. Never manufacture a live payment for acceptance.

To pause delivery, set GA4_PAYMENTS_DISABLED=1 through the normal production environment
change flow; retain the table and tombstones. Pending events expire within 71 hours.
Rolling back to the previous runtime restores its best-effort behavior and stops new
versioned intents; do not run an old collector and the new worker together manually.

## Monitoring and tests

The cron returns/logs only aggregate repair/claim/outcome counts and queue states.
Use a read-only grouped query on status, event_name, outcome, HTTP status and attempts;
include pending/leased age and terminal failure counts, without event keys or payloads.
Compare accepted events with GA4 after processing delay; compare payments with the
canonical ledger/Stripe separately, excluding admin and separating currencies.
A repair count is receipts inspected, not newly ingested purchases.

Focused tests: ga4-payment-{outbox,worker,producers}-postgres, ga4-payment-transport,
ga4-payment-cron, ga4-purchase-transport and Stripe architecture/translation checks.
They use disposable PostgreSQL and fake transport, covering concurrency, rollback,
queue outage with successful receipt, lease fencing, retry exhaustion, partial success,
expiry, consent/admin exclusions and refunds. Full Quality CI remains required.

References checked 2026-10-20: [Google transport reference](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference)
and [timestamps/limits](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events).
