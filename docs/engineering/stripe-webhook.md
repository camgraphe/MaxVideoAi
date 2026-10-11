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

For a supported event, `beginStripeEvent` inserts its event ID. An existing ID returns `duplicate`,
which the route acknowledges with `{ received: true, duplicate: true }`. Before that acknowledgement,
successful top-up event types get one measurement-only MCP attribution replay from their canonical
stored receipt; this path never dispatches a wallet handler or changes credit, and measurement
unavailability remains fail-open. A successful first-delivery handler is followed by
`markStripeEventProcessed`. If a product handler throws, `rollbackStripeEvent` removes the event
record before the error reaches the route, allowing Stripe's later delivery retry to process the
event again.

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
releases its idempotency marker so Stripe can retry document synchronization. Unrelated
invoices remain acknowledged. This adds no credit and does not repair old cached links.
The live webhook endpoint must subscribe to every handled event in the table above.

Failed top-up cards are owned by `stripe-webhook-failed-payments.ts`. It records deduplicated failed
card attempts for both first and returning wallet top-ups. At five failed attempts, it expires an open,
unpaid Checkout Session and records the rate-limited outcome. A receipt for the current Session or
PaymentIntent prevents expiry; a successful older payment does not exempt a later checkout.
The 30-minute cooldown applies to both new session creation and express-session reuse for all users.
These controls react to subsequent failed cards; a normal, authorized first payment remains eligible.
Failed-charge deduplication, insertion and counting run in one transaction under the owning
`checkout_attempts` row lock, so concurrent Charge and PaymentIntent notifications cannot
insert the same charge twice. Stripe network calls run after that transaction releases its lock.
The limit counts distinct charge IDs, preserving historical duplicate rows without allowing
them to trigger an early expiry. Notifications without a charge ID retain their event-row count.
`tests/stripe-failed-cards-postgres.test.ts` forces concurrent delivery with a database write
barrier and verifies the limit alongside current-payment protection on disposable PostgreSQL.

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
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/stripe-webhook-event-processor.test.ts tests/stripe-webhook-topup-events.test.ts tests/stripe-webhook-architecture.test.ts tests/stripe-webhook-documents.test.ts tests/stripe-topup-analytics-contract.test.ts tests/stripe-receipt-documents.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm run architecture:audit -- --min-lines 500
git diff --check
```

Then run every repository gate once before committing:

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
