# Stripe Webhook Architecture

The Stripe webhook route is the raw-signature security boundary. Keep
`frontend/app/api/stripe/webhook/route.ts` responsible for configuration guards, reading the
`stripe-signature` header, reading the request with `request.arrayBuffer()`, verifying that exact
raw body with `stripe.webhooks.constructEvent`, and mapping processor results or failures to HTTP
responses. Do not parse or transform the body before signature verification, and do not move
signature verification into a downstream helper.

## Verified event flow

After verification, the route passes the `Stripe.Event` to
`stripe-webhook-event-processor.ts`. The processor filters supported event types before creating an
idempotency record. Unsupported events are acknowledged without a database write.

For a supported event, `runStripeEvent` owns a transaction on a separate bounded
connection pool. A transaction-level advisory lock serializes its event ID. If the
lock is occupied, the processor throws and the route returns HTTP 500 so Stripe can
retry; an active event is never acknowledged as a completed duplicate. The claim
insert, completion marker and commit share this lifecycle transaction. Only a
committed `processed_at` returns `duplicate`, followed by the existing measurement-only
MCP replay; measurement unavailability remains fail-open on that duplicate path.

Schema, connection, handler, completion-write and commit failures propagate to the
route. Rollback or process disconnection releases the lock and removes a new
uncommitted claim without a separate DELETE. Business handlers retain their own
transactions and canonical idempotency keys: a receipt can commit before the event
marker. Retrying that event must reuse the receipt, not credit again. A lost lifecycle
connection cannot cancel external or business I/O already in progress. The runner
waits for its callback and never acknowledges before the lifecycle COMMIT; safety
of late business effects still depends on the handler's own deduplication.

Legacy committed rows with `processed_at=NULL` can resume only for the three
successful top-up event types and `invoice.paid`, which reconcile canonical receipt
identities. Legacy unfinished failed-card and refund events throw for reconciliation
and remain intact: older failed-card records lacked event IDs, and older refund
analytics sent directly without an outbox key. Automatically replaying those historical
effects is unsafe. New events of all seven handled types use the transaction lifecycle.
This change performs no historical database sweep or manual Stripe resend.

The lifecycle pool has at most two connections per process, a five-second connection
timeout and ten-second idle pool timeout. SQL lock waits are limited to two seconds,
statements to five seconds, and idle lifecycle transactions to sixty seconds. Those
limits produce retryable failures, never a success fallback. Transaction-level locks
work with transaction pooling; session-level advisory locks must not replace them.
The separate JavaScript pool avoids exhausting the application's own pool while
handlers wait for business connections. It does not establish capacity of a shared
PgBouncer/backend pool: deployment must reserve backend capacity for both lifecycle
transactions and business work across all instances. Qualify this on the target proxy
and drain old webhook workers before relying on serialized legacy recovery in a mixed
rollout. No database/schema migration or SDK/API-version upgrade is required.

Each event type has one handler owner:

| Stripe event | Handler owner |
| --- | --- |
| `checkout.session.completed` | `stripe-webhook-topup-events.ts` |
| `checkout.session.async_payment_succeeded` | `stripe-webhook-topup-events.ts` |
| `payment_intent.succeeded` | `stripe-webhook-topup-events.ts` |
| `invoice.paid` | `stripe-webhook-invoice-events.ts` |
| `payment_intent.payment_failed` | `stripe-webhook-failed-payments.ts` |
| `charge.refunded` | `stripe-webhook-refunds.ts` |
| `charge.failed` | `stripe-webhook-failed-payments.ts` |

The processor owns dispatch and idempotency orchestration; event handlers own event-specific
behavior. The route must not import individual handlers or database-backed event state.

## Top-ups, receipts, and failed cards

Both successful top-up translators call the canonical `recordStripeTopup` function in
`stripe-webhook-topup-persistence.ts`. That persistence owner keeps wallet credit, receipt and
invoice fields, checkout attribution, and analytics updates in one transaction-oriented flow.
Document normalization and Stripe receipt lookup stay in `stripe-webhook-documents.ts`.

With a configured database, schema or top-up handling errors propagate to the
event processor for rollback and a retryable HTTP failure. The mock wallet is
used only when no database is configured. An error after the receipt commits
also propagates; canonical receipt identities keep its retry from crediting twice.
`tests/stripe-topup-retry-postgres.test.ts` covers SQL/schema failures, event
rollback, concurrent payment redelivery, a post-commit failure, and mock mode.
`tests/stripe-event-recovery-postgres.test.ts` additionally kills real child processes
before and after a durable credit, injects marker-update/COMMIT failures, terminates
the lifecycle connection, and verifies busy delivery, independent progress, legacy
quarantine and one-credit recovery on disposable PostgreSQL 17.

GA4 delivery is owned by the [durable payment outbox](ga4-payment-outbox.md).
The receipt transaction queues both wallet events under a savepoint; a versioned
receipt marker allows recent-only repair without changing credit. The webhook
never waits for Google. Refund notifications enqueue the existing `topup_refunded`
delta by charge/cumulative amount; an enqueue failure propagates so the processor
rolls back its lifecycle transaction for Stripe retry. Admin and consent eligibility are
rechecked by the worker, not inferred from HTTP receipt.

Wallet top-up Checkout Sessions enable Stripe's post-purchase invoice creation. The completed
Session or PaymentIntent supplies the invoice or charge identity; the canonical top-up receipt
stores those identifiers and cached URLs when available. `GET /api/receipts` resolves a hosted
invoice or PDF first and falls back to the Stripe charge receipt. The authenticated Billing page
exposes those documents under `#billing-history-title`; older payments remain limited to the
document Stripe produced for that original Checkout.

`checkout.session.completed` credits the wallet only when `payment_status` is `paid`. Delayed
payment methods are credited by `checkout.session.async_payment_succeeded`. `invoice.paid` enriches
the existing canonical top-up receipt with the final hosted invoice and PDF without crediting the
wallet again. New top-up invoices carry `metadata.kind=topup`. If `invoice.paid`
arrives before its canonical receipt exists, the handler throws and the event processor
rolls back its lifecycle transaction so Stripe can retry document synchronization. Unrelated
invoices remain acknowledged. This adds no credit and does not repair old cached links.
The live webhook endpoint must subscribe to every handled event in the table above.

Failed top-up cards are translated by `stripe-webhook-failed-payments.ts`; their failure history,
card identity, cooldown anchor and account-wide counter belong to `stripe-webhook-failed-card-history.ts`.
Three distinct card fingerprints refused within ten minutes across a user's sessions start a
30-minute cooldown and expire that user's recent open, unpaid Checkout Sessions. Both first and
returning customers are covered. Retrying a known card with a new PaymentMethod ID does not count
as another card. The existing five deduplicated failures on one checkout remain an additional
safeguard, including repeated probing of one known card. That legacy limit starts a cooldown only
after its own session is confirmed open/unpaid and successfully expired; an expired or previously
handled session cannot rearm an old cooldown.

The history uses the signed Stripe event's timestamp, so delayed old failures cannot form a new
burst. PaymentIntent authentication errors use `last_payment_error.payment_method`: `latest_charge`
can still refer to an older card. Charge and PaymentIntent notifications for an actual charge are
deduplicated under the user's `wallet-checkout-user` advisory transaction lock and the owning
`checkout_attempts` row lock. This user lock is shared with checkout preparation so different
sessions cannot race the counter or create a session before the cooldown commits.

The distinct-card cooldown starts in a separate `stripe_failed_card_cooldown_started` event before
Stripe network calls. Both new session creation and express reuse honor it even if session expiration fails.
Replayed notifications and later session expiry do not restart an active cooldown. Session expiration uses a stable Stripe
idempotency key and atomically records its outcome and marker only once. The receipt for the current
Session/PaymentIntent and Stripe's current paid/complete state prevent expiry. PaymentIntent failures
retain their signed snapshot but fetch current paid state separately, so delayed failures cannot
penalize a payment already completed before receipt synchronization. Successful older top-ups do
not exempt a later checkout, and this policy never refunds payments, reverses credit or bans users.
The existing CAPTCHA policy and Stripe CVV/Radar configuration are unchanged.
`tests/stripe-failed-cards-postgres.test.ts` covers cross-session and concurrent failures, duplicate
notifications, delayed events, stale charge identities, account isolation and paid-session/ledger
protection on disposable PostgreSQL. `tests/checkout-guard-reuse-postgres.test.ts` covers the persistent
cooldown without CAPTCHA availability.

## Manual dispute containment

`charge.dispute.*` is not handled by this processor. Stripe dispute notifications still require
an operator to review the exact charge, account, principal, fees, deadline and reason. A fraud claim
does not by itself prove who used a card; service delivery is not proof of cardholder authorization.
Preserve the charge, identity linkage, receipts, jobs and failed-card history before containment.
Use `user_account_restrictions` and its audit for reversible spending restrictions, and Supabase Auth
for a reversible login suspension when the evidence warrants it. Preserve the wallet ledger and
record any credit reversal explicitly; never treat an internal credit refund as a bank refund.
Check the live Stripe state before any response. Accepting a chargeback is irreversible and requires
an explicit merchant decision; never issue a separate refund for a principal already charged back.
Automatic dispute restrictions and ledger adjustments require their own reviewed lifecycle policy.

## Verification

Run the focused webhook checks first:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/stripe-event-recovery-postgres.test.ts tests/stripe-topup-retry-postgres.test.ts tests/stripe-webhook-event-processor.test.ts tests/stripe-webhook-topup-events.test.ts tests/stripe-webhook-architecture.test.ts tests/stripe-webhook-documents.test.ts tests/stripe-topup-analytics-contract.test.ts tests/stripe-receipt-documents.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm run architecture:audit -- --min-lines 500
git diff --check
```

For local iterations, use focused checks as required by the root AGENTS. Before
merging, run the required Quality CI lanes and delivery checks on the latest
candidate. The complete local qualification commands remain:

```bash
pnpm test:validate
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm --prefix frontend run lint
pnpm lint:exposure
git diff --check
npm run architecture:audit -- --min-lines 500
pnpm --prefix frontend run build
```

## Stripe upgrades

The repository-wide Stripe SDK and API-version upgrade is separate work. This webhook refactor
preserves Stripe SDK `14.25.0` and API version `2023-10-16`. An upgrade must review all Stripe
integration surfaces together using the installed `stripe-best-practices` and `upgrade-stripe`
skills; do not upgrade one route in isolation.

The retry/acknowledgement contract follows [Stripe webhook guidance](https://docs.stripe.com/webhooks).
Lock release follows [PostgreSQL 17 transaction-level advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS).
These references explain protocol behavior; local tests do not certify live Stripe
delivery, production connection capacity or historical records missing every receipt identity.
