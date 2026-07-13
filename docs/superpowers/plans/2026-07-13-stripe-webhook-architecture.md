# Stripe Webhook Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1,160-line Stripe webhook route with a security-focused HTTP owner and route-local payment modules while preserving every current financial and operational behavior.

**Architecture:** Keep raw-body signature verification in `route.ts`, then pass only verified `Stripe.Event` objects to an event processor. Split event idempotency, failed payments, refunds, Stripe documents, successful-event normalization, and canonical top-up persistence by responsibility; do not replace the route with one catch-all handler.

**Tech Stack:** TypeScript, Next.js 15 App Router, Stripe Node SDK 14.25.0 with API version `2023-10-16`, Neon/Postgres, Node test runner through `tsx`, GA4 Measurement Protocol.

## Global Constraints

- Preserve prices, wallet credit amounts, supported event types, database schema, receipts, analytics payloads, checkout protections, logs, and HTTP responses.
- Keep raw request-body reading and `stripe.webhooks.constructEvent` in `route.ts`.
- Do not parse JSON before signature verification.
- Do not upgrade Stripe SDK 14.25.0 or API version `2023-10-16` in this plan.
- Do not add a migration, environment variable, feature flag, package, webhook endpoint, or Stripe Dashboard change.
- Keep exactly one canonical successful top-up persistence function shared by Checkout Session and PaymentIntent events.
- Keep every new production module below 500 lines and the final `route.ts` below 140 lines.
- Implement with strict red-green-refactor and commit only green batches.

---

## File Map

- `frontend/app/api/stripe/webhook/route.ts`: Stripe configuration, raw-body signature verification, HTTP response mapping.
- `frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-processor.ts`: supported event types, verified dispatch, duplicate result, processed/rollback transitions.
- `frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-state.ts`: `stripe_webhook_events` persistence only.
- `frontend/app/api/stripe/webhook/_lib/stripe-webhook-failed-payments.ts`: failed Charge/PaymentIntent metadata, attempt ledger, five-attempt expiry policy.
- `frontend/app/api/stripe/webhook/_lib/stripe-webhook-refunds.ts`: consent-gated incremental refund analytics.
- `frontend/app/api/stripe/webhook/_lib/stripe-webhook-documents.ts`: Stripe id/URL normalization and invoice/receipt extraction.
- `frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-events.ts`: successful Checkout Session/PaymentIntent normalization.
- `frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-persistence.ts`: receipt transaction, duplicate reconciliation, currency sync, completion analytics.
- `tests/stripe-webhook-architecture.test.ts`: responsibility and size contract.
- `tests/stripe-webhook-documents.test.ts`: pure document normalization contract.
- `tests/stripe-topup-analytics-contract.test.ts`: existing analytics contract redirected to the canonical owner.
- `docs/engineering/stripe-webhook.md`: durable maintainer guide.

---

### Task 1: Isolate webhook event idempotency

**Files:**
- Create: `frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-state.ts`
- Create: `tests/stripe-webhook-architecture.test.ts`
- Modify: `frontend/app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: verified `Stripe.Event`, event id string, existing `query` and `ensureBillingSchema` helpers.
- Produces:

```ts
export async function beginStripeEvent(event: Stripe.Event): Promise<boolean>;
export async function markStripeEventProcessed(eventId: string): Promise<void>;
export async function rollbackStripeEvent(eventId: string): Promise<void>;
```

- [ ] **Step 1: Write the failing architecture test**

Create `tests/stripe-webhook-architecture.test.ts` with this first contract:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const routePath = 'frontend/app/api/stripe/webhook/route.ts';
const eventStatePath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-state.ts';

test('Stripe webhook event idempotency has one route-local owner', () => {
  assert.equal(existsSync(eventStatePath), true);
  const route = readFileSync(routePath, 'utf8');
  const eventState = readFileSync(eventStatePath, 'utf8');

  assert.match(route, /from ['"]\.\/_lib\/stripe-webhook-event-state['"]/);
  assert.doesNotMatch(route, /stripe_webhook_events/);
  assert.match(eventState, /export async function beginStripeEvent/);
  assert.match(eventState, /export async function markStripeEventProcessed/);
  assert.match(eventState, /export async function rollbackStripeEvent/);
  assert.match(eventState, /ON CONFLICT \(event_id\) DO NOTHING/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/stripe-webhook-architecture.test.ts
```

Expected: FAIL because `_lib/stripe-webhook-event-state.ts` does not exist.

- [ ] **Step 3: Move the event-state implementation**

Create the event-state module with the existing three function bodies and unchanged fallbacks. The complete public structure is:

```ts
import type Stripe from 'stripe';

import { query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';

export async function beginStripeEvent(event: Stripe.Event): Promise<boolean> {
  if (!process.env.DATABASE_URL) return true;
  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[stripe-webhook] ensureBillingSchema failed for event idempotency', error);
    return true;
  }
  try {
    const rows = await query<{ event_id: string }>(
      `INSERT INTO stripe_webhook_events (event_id, event_type)
       VALUES ($1, $2)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [event.id, event.type]
    );
    return rows.length > 0;
  } catch (error) {
    console.warn('[stripe-webhook] Failed to record event id', { eventId: event.id, error });
    return true;
  }
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await query(`UPDATE stripe_webhook_events SET processed_at = NOW() WHERE event_id = $1`, [eventId]);
  } catch (error) {
    console.warn('[stripe-webhook] Failed to mark event processed', { eventId, error });
  }
}

export async function rollbackStripeEvent(eventId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await query(`DELETE FROM stripe_webhook_events WHERE event_id = $1`, [eventId]);
  } catch (error) {
    console.warn('[stripe-webhook] Failed to rollback event record', { eventId, error });
  }
}
```

Delete only those three local definitions from `route.ts`, import the exports, and keep their existing call sites unchanged.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/stripe-webhook-architecture.test.ts tests/stripe-topup-analytics-contract.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
```

Expected: both test files pass and TypeScript exits 0.

- [ ] **Step 5: Commit the green batch**

```bash
git add frontend/app/api/stripe/webhook/route.ts frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-state.ts tests/stripe-webhook-architecture.test.ts
git commit -m "refactor: isolate stripe webhook event state"
```

---

### Task 2: Isolate failed-payment protection and refund analytics

**Files:**
- Create: `frontend/app/api/stripe/webhook/_lib/stripe-webhook-failed-payments.ts`
- Create: `frontend/app/api/stripe/webhook/_lib/stripe-webhook-refunds.ts`
- Modify: `frontend/app/api/stripe/webhook/route.ts`
- Modify: `tests/stripe-webhook-architecture.test.ts`

**Interfaces:**
- Consumes: a verified failure/refund `Stripe.Event`, initialized `Stripe` client, existing Postgres query and GA4 helpers.
- Produces:

```ts
export async function handleChargeFailed(event: Stripe.Event, stripe: Stripe): Promise<void>;
export async function handlePaymentIntentFailed(event: Stripe.Event, stripe: Stripe): Promise<void>;
export async function handleChargeRefunded(event: Stripe.Event, stripe: Stripe): Promise<void>;
```

- [ ] **Step 1: Extend the architecture test and verify RED**

Add these paths and assertions:

```ts
const failedPaymentsPath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-failed-payments.ts';
const refundsPath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-refunds.ts';

test('failed-payment protection and refund analytics have separate owners', () => {
  assert.equal(existsSync(failedPaymentsPath), true);
  assert.equal(existsSync(refundsPath), true);
  const route = readFileSync(routePath, 'utf8');
  const failedPayments = readFileSync(failedPaymentsPath, 'utf8');
  const refunds = readFileSync(refundsPath, 'utf8');

  assert.match(route, /stripe-webhook-failed-payments/);
  assert.match(route, /stripe-webhook-refunds/);
  assert.doesNotMatch(route, /FAILED_CARD_ATTEMPT_LIMIT|topup_refunded/);
  assert.match(failedPayments, /const FAILED_CARD_ATTEMPT_LIMIT = 5/);
  assert.match(failedPayments, /stripe_checkout_session_expired_for_failed_cards/);
  assert.match(refunds, /name: 'topup_refunded'/);
});
```

Run the focused architecture test. Expected: FAIL because both modules are missing.

- [ ] **Step 2: Move failed-payment ownership without changing policy**

Move these exact symbols from `route.ts` into `stripe-webhook-failed-payments.ts`:

```ts
type FailedTopupPaymentMetadata = {
  kind: string | null;
  userId: string | null;
  checkoutAttemptId: number | null;
  firstWalletTopup: boolean;
  checkoutUiMode: string | null;
};
const FAILED_CARD_ATTEMPT_LIMIT = 5;
const FAILED_CARD_ATTEMPT_LIMIT_REASON = 'failed_card_attempt_limit';
readMetadataString;
readMetadataBoolean;
readMetadataPositiveInteger;
parseFailedTopupPaymentMetadata;
resolveFailedTopupMetadataFromCharge;
retrieveFailedCharge;
recordCheckoutFailedCardAttempt;
countCheckoutFailedCardAttempts;
expireCheckoutSessionForFailedCards;
export handleChargeFailed;
export handlePaymentIntentFailed;
```

Replace hidden singleton access with the explicit `stripe: Stripe` argument on the exported handlers and pass it through private Stripe-network helpers. Preserve every SQL statement, early return, threshold, metadata key, status check, warning, and event name.

Keep the current `normalizeStripeId` body private in this module during this green batch. Task 3 moves that exact helper to the document owner and redirects the import after first proving the document contract red.

- [ ] **Step 3: Move refund ownership without changing analytics**

Move `TopupTrackingMetadata`, `parseTopupTrackingMetadata`, `resolveTopupTrackingMetadataFromCharge`, and `handleChargeRefunded` into `stripe-webhook-refunds.ts`. Give the refund module its own private `minorToMajorAmount` with the exact `amountMinor / 100` body; leave the existing route helper in place until Task 3 moves that copy with successful top-up analytics. Export only `handleChargeRefunded(event, stripe)`. Keep the current refund-delta calculation and analytics-consent guard exact.

Keep a private `readMetadataString` in each owner rather than introducing a shared generic metadata layer for two small call sites.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/stripe-webhook-architecture.test.ts tests/stripe-topup-analytics-contract.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
```

Expected: tests and TypeScript pass.

- [ ] **Step 5: Commit the green batch**

```bash
git add frontend/app/api/stripe/webhook/route.ts frontend/app/api/stripe/webhook/_lib/stripe-webhook-failed-payments.ts frontend/app/api/stripe/webhook/_lib/stripe-webhook-refunds.ts tests/stripe-webhook-architecture.test.ts
git commit -m "refactor: split stripe failure and refund handlers"
```

---

### Task 3: Create the canonical successful top-up boundary

**Files:**
- Create: `frontend/app/api/stripe/webhook/_lib/stripe-webhook-documents.ts`
- Create: `frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-events.ts`
- Create: `frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-persistence.ts`
- Create: `tests/stripe-webhook-documents.test.ts`
- Modify: `frontend/app/api/stripe/webhook/route.ts`
- Modify: `tests/stripe-webhook-architecture.test.ts`
- Modify: `tests/stripe-topup-analytics-contract.test.ts`

**Interfaces:**
- Consumes: verified successful Stripe objects, initialized Stripe client, receipts-price-only flag, existing wallet/database/currency/GA4 helpers.
- Produces:

```ts
export type CanonicalStripeTopupInput = {
  userId: string;
  walletAmountCents: number;
  walletCurrency: string;
  settlementAmountCents: number | null;
  settlementCurrency: string | null;
  paymentIntentId?: string | null;
  chargeId?: string | null;
  platformRevenueCents?: number | null;
  destinationAcct?: string | null;
  metadata?: Record<string, unknown>;
  originalAmountCents?: number | null;
  originalCurrency?: string | null;
  fxRate?: number | null;
  fxMarginBps?: number | null;
  fxRateTimestamp?: string | Date | null;
  stripeCustomerId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeInvoiceId?: string | null;
  stripeHostedInvoiceUrl?: string | null;
  stripeInvoicePdf?: string | null;
  stripeReceiptUrl?: string | null;
};

export async function recordStripeTopup(
  input: CanonicalStripeTopupInput,
  options: { receiptsPriceOnly: boolean }
): Promise<void>;

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  options: { stripe: Stripe; receiptsPriceOnly: boolean }
): Promise<void>;

export async function handlePaymentIntentSucceeded(
  intent: Stripe.PaymentIntent,
  options: { stripe: Stripe; receiptsPriceOnly: boolean }
): Promise<void>;
```

- [ ] **Step 1: Write document tests and verify RED**

Create `tests/stripe-webhook-documents.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chargeReceiptUrl,
  invoiceDocumentFields,
  normalizeStripeId,
  normalizeStripeUrl,
} from '../frontend/app/api/stripe/webhook/_lib/stripe-webhook-documents.ts';

test('Stripe document helpers normalize expanded and scalar objects', () => {
  assert.equal(normalizeStripeId('  pi_123  '), 'pi_123');
  assert.equal(normalizeStripeId({ id: ' ch_123 ' }), 'ch_123');
  assert.equal(normalizeStripeId({ id: '' }), null);
  assert.equal(normalizeStripeUrl(' https://pay.stripe.com/r/123 '), 'https://pay.stripe.com/r/123');
  assert.deepEqual(invoiceDocumentFields('in_123'), { stripeInvoiceId: 'in_123' });
  assert.deepEqual(
    invoiceDocumentFields({ id: 'in_456', hosted_invoice_url: 'https://invoice', invoice_pdf: 'https://pdf' } as never),
    { stripeInvoiceId: 'in_456', stripeHostedInvoiceUrl: 'https://invoice', stripeInvoicePdf: 'https://pdf' }
  );
  assert.equal(chargeReceiptUrl({ receipt_url: 'https://receipt' } as never), 'https://receipt');
});
```

Run it and expect an import failure because the document module does not exist.

- [ ] **Step 2: Extract Stripe document helpers**

Move `TopupDocumentFields`, `normalizeStripeId`, `normalizeStripeUrl`, `invoiceDocumentFields`, `chargeReceiptUrl`, and `retrieveChargeReceiptUrl` from `route.ts` into `stripe-webhook-documents.ts`. Export the four pure helpers used by the test plus `retrieveChargeReceiptUrl(stripe, chargeId)`. Pass the Stripe client explicitly and preserve warning behavior. Delete the interim private `normalizeStripeId` from `stripe-webhook-failed-payments.ts` and import the canonical document helper there.

- [ ] **Step 3: Add the canonical-owner architecture assertions and verify RED**

Add the following exact path constants and assertions:

```ts
const documentsPath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-documents.ts';
const topupEventsPath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-events.ts';
const topupPersistencePath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-persistence.ts';

test('successful Stripe events share one canonical top-up persistence owner', () => {
  for (const path of [documentsPath, topupEventsPath, topupPersistencePath]) {
    assert.equal(existsSync(path), true);
  }
  const route = readFileSync(routePath, 'utf8');
  const topupEvents = readFileSync(topupEventsPath, 'utf8');
  const persistence = readFileSync(topupPersistencePath, 'utf8');

  assert.equal((topupEvents.match(/recordStripeTopup\(/g) ?? []).length, 2);
  assert.match(persistence, /withDbTransaction/);
  assert.match(persistence, /lockAndResolveFirstWalletTopup/);
  assert.match(persistence, /name: 'topup_completed'/);
  assert.match(persistence, /name: 'purchase'/);
  assert.doesNotMatch(route, /recordStripeTopup|withDbTransaction|topup_completed/);
});
```

Update `tests/stripe-topup-analytics-contract.test.ts` to read `stripe-webhook-topup-persistence.ts` for the completion analytics assertions while keeping the wallet metadata test on `frontend/app/api/wallet/route.ts`.

Run both contracts and expect failure while top-up logic still lives in `route.ts`.

- [ ] **Step 4: Move successful event normalization**

Move `handleCheckoutSession` to `handleCheckoutSessionCompleted` and `handlePaymentIntent` to `handlePaymentIntentSucceeded` in `stripe-webhook-topup-events.ts`. Keep every field mapping and early return unchanged. Replace local receipt helpers with imports from `stripe-webhook-documents.ts`. Both successful handlers must end by calling the exact shared interface `await recordStripeTopup(input, { receiptsPriceOnly });`.

- [ ] **Step 5: Move canonical top-up persistence**

Move `updateTopupDocumentFields`, `recordTopup`, and the successful-flow copy of `minorToMajorAmount` to `stripe-webhook-topup-persistence.ts`. Rename only `recordTopup` to `recordStripeTopup`; retain its body, transaction order, duplicate queries, fallback behavior, document backfill, preferred-currency update, consent parsing, analytics payloads, `Promise.allSettled`, and logging.

Make `receiptsPriceOnly` an explicit option instead of a module-level environment constant. Import document normalization from `stripe-webhook-documents.ts`.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/stripe-webhook-documents.test.ts tests/stripe-webhook-architecture.test.ts tests/stripe-topup-analytics-contract.test.ts tests/stripe-receipt-documents.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
```

Expected: all focused tests and TypeScript pass.

- [ ] **Step 7: Commit the green batch**

```bash
git add frontend/app/api/stripe/webhook/route.ts frontend/app/api/stripe/webhook/_lib tests/stripe-webhook-documents.test.ts tests/stripe-webhook-architecture.test.ts tests/stripe-topup-analytics-contract.test.ts
git commit -m "refactor: canonicalize stripe topup handling"
```

---

### Task 4: Make the route a verified-event orchestrator

**Files:**
- Create: `frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-processor.ts`
- Modify: `frontend/app/api/stripe/webhook/route.ts`
- Modify: `tests/stripe-webhook-architecture.test.ts`
- Create: `docs/engineering/stripe-webhook.md`

**Interfaces:**
- Consumes: verified `Stripe.Event`, initialized Stripe client, receipts-price-only flag, handlers from Tasks 1-3.
- Produces:

```ts
export type StripeWebhookEventResult = 'handled' | 'unhandled' | 'duplicate';

export async function processStripeWebhookEvent(
  event: Stripe.Event,
  options: { stripe: Stripe; receiptsPriceOnly: boolean }
): Promise<StripeWebhookEventResult>;
```

- [ ] **Step 1: Add final route-boundary assertions and verify RED**

Extend the architecture test:

```ts
const processorPath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-processor.ts';

test('Stripe webhook route owns only verification and HTTP mapping', () => {
  assert.equal(existsSync(processorPath), true);
  const route = readFileSync(routePath, 'utf8');
  const lineCount = route.split('\n').length;

  assert.ok(lineCount < 140, `route.ts must stay below 140 lines, got ${lineCount}`);
  assert.match(route, /request\.arrayBuffer\(\)/);
  assert.match(route, /request\.headers\.get\('stripe-signature'\)/);
  assert.match(route, /stripe\.webhooks\.constructEvent/);
  assert.match(route, /processStripeWebhookEvent/);
  assert.doesNotMatch(route, /\b(?:SELECT|INSERT|UPDATE|DELETE)\b/);
  assert.doesNotMatch(route, /sendGa4Event|recordMockWalletTopUp|withDbTransaction/);
});

test('Stripe webhook modules stay focused instead of creating a new catch-all', () => {
  for (const path of [
    eventStatePath,
    failedPaymentsPath,
    refundsPath,
    documentsPath,
    topupEventsPath,
    topupPersistencePath,
    processorPath,
  ]) {
    const lineCount = readFileSync(path, 'utf8').split('\n').length;
    assert.ok(lineCount < 500, `${path} must stay below 500 lines, got ${lineCount}`);
  }
});
```

Replace Task 1's temporary assertion that `route.ts` imports `stripe-webhook-event-state` with a final assertion that `stripe-webhook-event-processor.ts` imports it. The route must import only the processor from the verified-event layer.

Run the architecture test. Expected: FAIL because the processor is missing and the route is still over the cap.

- [ ] **Step 2: Create the verified-event processor**

Implement the supported-event set and switch in `stripe-webhook-event-processor.ts`. Keep this order:

```ts
if (!HANDLED_EVENT_TYPES.has(event.type)) return 'unhandled';
if (!(await beginStripeEvent(event))) return 'duplicate';
try {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, options);
      break;
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, options);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event, options.stripe);
      break;
    case 'charge.refunded':
      await handleChargeRefunded(event, options.stripe);
      break;
    case 'charge.failed':
      await handleChargeFailed(event, options.stripe);
      break;
  }
  await markStripeEventProcessed(event.id);
  return 'handled';
} catch (error) {
  await rollbackStripeEvent(event.id);
  throw error;
}
```

Dispatch `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, and `charge.failed` to the exact owners created in Tasks 2-3. Preserve the current casts and logs for unhandled and duplicate events.

- [ ] **Step 3: Reduce `route.ts` to the security boundary**

Keep Stripe initialization, runtime export, configuration guards, signature header guard, raw `arrayBuffer`, `constructEvent`, and existing error responses. Replace all post-verification logic with:

```ts
try {
  const result = await processStripeWebhookEvent(event, { stripe, receiptsPriceOnly });
  if (result === 'duplicate') {
    return NextResponse.json({ received: true, duplicate: true });
  }
  return NextResponse.json({ received: true });
} catch (error) {
  console.error('[stripe-webhook] Handler error', error);
  return NextResponse.json({ error: 'Webhook handler failure' }, { status: 500 });
}
```

Do not move signature verification into the processor.

- [ ] **Step 4: Write the engineering guide**

Create `docs/engineering/stripe-webhook.md` documenting:

- raw-body verification boundary;
- verified event flow and idempotency retry behavior;
- one owner per event type;
- canonical successful top-up persistence;
- failed-card five-attempt policy;
- focused and full verification commands; and
- the separately identified repository-wide Stripe SDK/API upgrade, which must use `stripe-best-practices` and `upgrade-stripe` rather than changing one route.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/stripe-webhook-architecture.test.ts tests/stripe-webhook-documents.test.ts tests/stripe-topup-analytics-contract.test.ts tests/stripe-receipt-documents.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm run architecture:audit -- --min-lines 500
git diff --check
```

Expected: focused tests, TypeScript, architecture audit, and diff check pass; the webhook route no longer appears in the 500-line audit.

- [ ] **Step 6: Commit the green batch**

```bash
git add frontend/app/api/stripe/webhook docs/engineering/stripe-webhook.md tests/stripe-webhook-architecture.test.ts
git commit -m "refactor: thin stripe webhook route"
```

---

### Task 5: Full verification and delivery on main

**Files:**
- Verify only; modify production code only if a failing check exposes a behavior-preservation defect, and add a failing focused test before that correction.

- [ ] **Step 1: Run the complete test suite**

```bash
pnpm test:validate
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run static and exposure checks**

```bash
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 3: Run architecture and production-build checks**

```bash
npm run architecture:audit -- --min-lines 500
pnpm --prefix frontend run build
```

Expected: the audit succeeds without the Stripe webhook route in the 500-line list, and the production build exits 0.

- [ ] **Step 4: Inspect the final ownership and repository state**

```bash
wc -l frontend/app/api/stripe/webhook/route.ts frontend/app/api/stripe/webhook/_lib/*.ts
git status --short --branch
git log --oneline --max-count=8
```

Require `route.ts < 140`, every new module `< 500`, a clean worktree, and only the intended commits ahead of `origin/main`.

- [ ] **Step 5: Stop before external publication**

Do not push unless the user explicitly asks after reviewing the completed verification evidence.
