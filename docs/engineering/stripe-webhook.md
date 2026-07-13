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
which the route acknowledges with `{ received: true, duplicate: true }`. A successful handler is
followed by `markStripeEventProcessed`. If a handler throws, `rollbackStripeEvent` removes the event
record before the error reaches the route, allowing Stripe's later delivery retry to process the
event again.

Each event type has one handler owner:

| Stripe event | Handler owner |
| --- | --- |
| `checkout.session.completed` | `stripe-webhook-topup-events.ts` |
| `payment_intent.succeeded` | `stripe-webhook-topup-events.ts` |
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

Failed top-up cards are owned by `stripe-webhook-failed-payments.ts`. It records deduplicated failed
card attempts for first-wallet-top-up checkout attempts. At five failed attempts, it expires an open,
unpaid Checkout Session and records the rate-limited outcome, subject to the existing receipt and
session-state guards.

## Verification

Run the focused webhook checks first:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/stripe-webhook-architecture.test.ts tests/stripe-webhook-documents.test.ts tests/stripe-topup-analytics-contract.test.ts tests/stripe-receipt-documents.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm run architecture:audit -- --min-lines 500
git diff --check
```

Then run the repository validation suite once before committing:

```bash
pnpm test:validate
```

## Stripe upgrades

The repository-wide Stripe SDK and API-version upgrade is separate work. This webhook refactor
preserves Stripe SDK `14.25.0` and API version `2023-10-16`. An upgrade must review all Stripe
integration surfaces together using the installed `stripe-best-practices` and `upgrade-stripe`
skills; do not upgrade one route in isolation.
