# Stripe Webhook Architecture Design

## Objective

Turn `frontend/app/api/stripe/webhook/route.ts` from a 1,160-line mixed-responsibility owner into a short, security-focused route backed by route-local server modules with explicit payment responsibilities.

This is a behavior-preserving architecture refactor. It must not change prices, wallet credit amounts, supported Stripe event types, database schema, receipt semantics, analytics payloads, checkout protections, or public API responses.

## Evidence

The live architecture audit on 2026-07-13 reports `frontend/app/api/stripe/webhook/route.ts` at 1,160 lines. The route currently owns all of the following:

- Stripe configuration and webhook signature verification;
- accepted-event filtering and event dispatch;
- webhook event idempotency persistence;
- failed-card metadata recovery and checkout-attempt accounting;
- repeated-failure Checkout Session expiry;
- refund analytics;
- Checkout Session and PaymentIntent top-up normalization;
- Stripe invoice and receipt document extraction;
- wallet receipt persistence and duplicate reconciliation;
- preferred-currency synchronization;
- first-wallet-top-up resolution; and
- GA4 completion and purchase events.

The file therefore combines HTTP security, orchestration, Stripe object translation, database transactions, checkout abuse protection, document synchronization, and analytics. These responsibilities change for different reasons and can be tested behind narrower interfaces.

Existing contract coverage includes `tests/stripe-topup-analytics-contract.test.ts`, `tests/stripe-receipt-documents.test.ts`, and checkout/admin coverage, but no architecture contract currently prevents these responsibilities from accumulating in the route again.

## Stripe Skill Review

The installed `stripe-best-practices` skill confirms that the current integration uses the recommended payment primitives for this product:

- Checkout Sessions for hosted or embedded on-session checkout;
- PaymentIntents for the custom or independently modelled payment flow; and
- verified webhook events for asynchronous fulfillment and payment-state handling.

The webhook reads Charge objects for failure details, receipt URLs, and refund events. It does not create payments through the deprecated Charges API, Sources API, Tokens API, or legacy Card Element.

The review also identified a version gap: the repository currently installs Stripe SDK `14.25.0`, and the webhook plus several other server routes pin API version `2023-10-16`, while the installed Stripe skill identifies `2026-02-25.clover` as the current API version.

That upgrade is intentionally not folded into this architecture refactor. Updating only the webhook would leave the wallet, receipt, health, generation rollback, reconciliation, fraud, and checkout-expiry Stripe clients on mixed contracts. A separate repository-wide Stripe version audit must use the installed `upgrade-stripe` skill, inventory every Stripe client and fixture, review breaking API/type changes, and validate Dashboard webhook compatibility before changing the version or SDK.

## Chosen Approach

Use a responsibility-based route-local split. Keep raw webhook verification in the route and move only already-verified event processing into `_lib` modules.

This is preferred over moving the entire file into one generic `handler.ts`, which would shorten the route without reducing the real owner. It is also preferred over extracting only small helpers, which would leave the main database, checkout, and analytics responsibilities coupled.

## Security Boundary

`route.ts` remains the only module that:

- reads `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` for the endpoint;
- reads the request body before parsing;
- reads the `stripe-signature` header;
- calls `stripe.webhooks.constructEvent`; and
- converts signature or processing failures into HTTP responses.

The body must remain raw until `constructEvent` succeeds. No JSON parsing, body middleware, reconstructed payload, or pre-verification event handling is allowed.

All downstream modules consume a `Stripe.Event` that has already passed signature verification. They do not receive the `NextRequest`, raw body, signature, or webhook secret.

The existing Stripe API version remains unchanged during this refactor. SDK or API-version upgrades require a separate compatibility task.

## File Boundaries

### `frontend/app/api/stripe/webhook/route.ts`

Owns endpoint configuration, raw-body signature verification, HTTP status mapping, and the call into the verified-event processor.

It must not contain SQL, wallet mutations, GA4 payload construction, failed-card policy, refund calculations, or Stripe document normalization. The target is fewer than 140 lines.

### `frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-processor.ts`

Owns the supported event-type set, duplicate-event outcome, verified-event dispatch, processed-state transition, and rollback-on-handler-failure behavior.

Its public interface is one function that accepts the verified `Stripe.Event`, an initialized Stripe client, and the receipts-price-only flag. It returns a small result describing whether the event was handled or skipped as a duplicate. It does not return HTTP responses.

### `frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-state.ts`

Owns `stripe_webhook_events` persistence:

- begin processing with `ON CONFLICT DO NOTHING`;
- mark an event processed; and
- remove the event record after a handler failure so Stripe retries can be processed.

The current database-unavailable fallbacks and warning behavior remain unchanged.

### `frontend/app/api/stripe/webhook/_lib/stripe-webhook-failed-payments.ts`

Owns `charge.failed` and `payment_intent.payment_failed` handling, including:

- failed-top-up metadata parsing;
- charge or PaymentIntent metadata recovery;
- duplicate failed-charge detection;
- checkout interaction event persistence;
- failed-card counting; and
- expiring an unpaid open Checkout Session after the existing five-attempt threshold.

The threshold, reason string, first-wallet-top-up guard, existing-receipt guard, database guard, Stripe status checks, SQL, and log messages remain semantically unchanged.

### `frontend/app/api/stripe/webhook/_lib/stripe-webhook-refunds.ts`

Owns `charge.refunded` analytics. It resolves top-up tracking metadata from the Charge or its PaymentIntent, computes only the new refund delta, honors analytics consent, and sends the existing `topup_refunded` GA4 payload.

It does not mutate wallet balances or receipt rows.

### `frontend/app/api/stripe/webhook/_lib/stripe-webhook-documents.ts`

Owns pure Stripe identifier and URL normalization, invoice document extraction, Charge receipt URL extraction, and receipt URL retrieval from Stripe.

The Stripe client is passed explicitly to networked helpers. Pure normalizers remain independently testable.

### `frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-events.ts`

Owns translation of `checkout.session.completed` and `payment_intent.succeeded` objects into the canonical top-up persistence input.

It preserves the current metadata precedence, amount and currency fallbacks, destination account handling, FX fields, receipt/invoice fields, attribution metadata, and early returns for non-top-up or invalid-amount events.

It does not contain receipt SQL or GA4 completion dispatch.

### `frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-persistence.ts`

Owns canonical top-up persistence after a Stripe event has been normalized:

- mock-ledger fallback when the database is unavailable;
- billing-schema readiness;
- first-wallet-top-up locking;
- duplicate lookup by PaymentIntent, Charge, or Checkout Session;
- missing Stripe document reconciliation on duplicates;
- transactional receipt insertion;
- preferred-currency synchronization; and
- consent-gated `topup_completed` and `purchase` GA4 events after a successful insert.

Its public input type is the single canonical contract shared by both successful Stripe event handlers. The transaction and all duplicate safeguards remain intact.

## Verified Event Flow

1. `route.ts` rejects missing configuration or a missing signature.
2. `route.ts` reads the raw request body and verifies it with `constructEvent`.
3. The processor ignores unsupported event types without creating an idempotency record.
4. The event-state module attempts to claim the event id.
5. A duplicate returns the existing `{ received: true, duplicate: true }` response path.
6. The processor dispatches the verified event to one responsibility owner.
7. Successful handling marks the event processed.
8. A handler failure removes the claimed event record and propagates the failure to the route.
9. The route logs the failure and returns the existing 500 response.

No handler may acknowledge an event before its existing persistence or analytics work completes.

## Behavior Preservation

The following remain exact:

- supported event types: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, and `charge.failed`;
- 501, 400, 500, normal success, and duplicate response semantics;
- raw-body signature verification;
- event idempotency and retry rollback;
- five failed-card attempts before session expiry;
- top-up amount, currency, FX, destination account, invoice, receipt, and metadata precedence;
- receipt duplicate detection and document backfill;
- first-wallet-top-up locking;
- consent checks and GA4 event names and parameters;
- mock-wallet fallback behavior; and
- current logs at the same operational severity.

No migration, environment-variable change, package upgrade, price change, or Stripe Dashboard change is part of this work.

## Testing Strategy

Add `tests/stripe-webhook-architecture.test.ts` before moving production code. The initial test must fail against the current 1,160-line route and then enforce that:

- `route.ts` stays below 140 lines;
- `route.ts` retains raw-body signature verification;
- `route.ts` imports the verified-event processor;
- `route.ts` contains no SQL or direct wallet, GA4, failed-card, refund, or receipt persistence logic;
- each verified Stripe event type has one explicit downstream owner;
- event-state SQL is isolated in the event-state module;
- failed-card policy is isolated in the failed-payments module;
- top-up transaction and GA4 completion logic are isolated in the persistence module; and
- the successful Checkout Session and PaymentIntent handlers both call the same canonical persistence function.

Update `tests/stripe-topup-analytics-contract.test.ts` so it follows the new owner instead of pinning analytics to `route.ts`. Preserve every existing analytics assertion.

Add focused pure tests for document normalization and top-up event normalization where extraction exposes callable pure functions. Do not introduce production-only test hooks or mock the behavior being asserted.

Run focused checks after every extraction, then the complete validation suite, lint, exposure lint, TypeScript, `git diff --check`, the architecture audit, and the frontend production build.

## Rollout And Failure Handling

This refactor lands as normal code with no feature flag because it does not introduce a parallel payment path. There must be exactly one handler per event type and exactly one canonical top-up persistence function.

If focused tests reveal an undocumented behavior discrepancy, preserve the current behavior and document the discrepancy rather than changing financial semantics inside the architecture batch.

If a behavior change is genuinely required, stop and create a separate change with explicit acceptance tests.

## Acceptance Criteria

- `route.ts` is below 140 lines and contains only configuration, signature verification, HTTP mapping, and verified-event orchestration.
- No replacement catch-all module exceeds 500 lines.
- Responsibilities are split according to the file boundaries above.
- There is one canonical successful top-up persistence contract shared by Checkout Session and PaymentIntent events.
- There is one event-idempotency owner.
- Current Stripe event behavior, prices, wallet amounts, receipts, analytics, and checkout protections remain unchanged.
- Architecture and existing Stripe contracts pass.
- Full validation, lint, TypeScript, build, exposure lint, diff check, and architecture audit pass.

## Out Of Scope

- Changing prices, margins, wallet conversion, or applied credits.
- Adding or removing Stripe event types.
- Changing Checkout, Express Checkout, or Payment Element UX.
- Changing subscription billing.
- Changing refund accounting or wallet clawbacks.
- Changing the five-attempt card-failure policy.
- Changing GA4 consent rules or event schemas.
- Changing database schema or running a migration.
- Upgrading Stripe, Next.js, or the Stripe API version.
- Performing the repository-wide Stripe SDK/API migration identified by the Stripe skill review.
- Replacing the current webhook endpoint or changing its Stripe Dashboard configuration.
