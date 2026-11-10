import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { normalizeCheckoutInteractionEventPayload } from '../frontend/server/checkout-events';
import { classifyCheckoutAbandonmentSignal, summarizeCheckoutWalletLoads, summarizeRecentWalletFollowups } from '../frontend/server/checkout-report';

const hostedCheckoutEventNames = [
  'hosted_checkout_requested',
  'hosted_checkout_captcha_required',
  'hosted_checkout_rate_limited',
  'hosted_checkout_failed',
  'hosted_checkout_redirecting',
] as const;

assert.deepEqual(
  hostedCheckoutEventNames.filter((eventName) => (
    normalizeCheckoutInteractionEventPayload({ eventName, mode: 'hosted' })?.eventName === eventName
  )),
  hostedCheckoutEventNames,
  'every hosted checkout hook event must pass the server event normalizer'
);

assert.equal(
  classifyCheckoutAbandonmentSignal([
    { eventName: 'express_checkout_revealed' },
    { eventName: 'express_checkout_ready' },
  ]),
  'passive_open',
  'revealing Express Checkout without a wallet interaction is a passive open'
);

assert.equal(
  classifyCheckoutAbandonmentSignal([
    { eventName: 'express_checkout_revealed' },
    { eventName: 'express_checkout_cancelled' },
  ]),
  'user_cancelled',
  'wallet sheet cancellation is an intentional user abandon signal'
);

assert.equal(
  classifyCheckoutAbandonmentSignal([
    { eventName: 'hosted_checkout_redirecting' },
    { eventName: 'hosted_checkout_cancelled_return' },
  ]),
  'user_cancelled',
  'hosted Checkout cancel returns are intentional user abandon signals'
);

assert.equal(
  classifyCheckoutAbandonmentSignal([
    { eventName: 'express_checkout_revealed' },
    { eventName: 'express_checkout_confirm_started' },
  ]),
  'payment_started_no_receipt',
  'a payment confirmation without a receipt is a high-priority failed completion signal'
);

assert.equal(
  classifyCheckoutAbandonmentSignal([
    { eventName: 'express_checkout_loaderror' },
  ]),
  'technical_error',
  'Stripe.js load failures must be grouped as technical errors'
);

const schemaSource = readFileSync('frontend/src/lib/schema/billing-user-admin-schema.ts', 'utf8');
assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS checkout_interaction_events/);
assert.match(schemaSource, /checkout_interaction_events_attempt_created_idx/);
assert.match(schemaSource, /checkout_interaction_events_session_created_idx/);

const routeSource = readFileSync('frontend/app/api/checkout-events/route.ts', 'utf8');
assert.match(routeSource, /recordCheckoutInteractionEvent/);
assert.match(routeSource, /getRouteAuthContext\(req\)/);

const stripeWebhookProcessorSource = readFileSync(
  'frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-processor.ts',
  'utf8'
);
const stripeFailedPaymentsSource = readFileSync(
  'frontend/app/api/stripe/webhook/_lib/stripe-webhook-failed-payments.ts',
  'utf8'
);
assert.match(stripeWebhookProcessorSource, /charge\.failed/);
assert.match(stripeWebhookProcessorSource, /payment_intent\.payment_failed/);
assert.match(stripeWebhookProcessorSource, /handleChargeFailed/);
assert.match(stripeWebhookProcessorSource, /handlePaymentIntentFailed/);
assert.match(stripeFailedPaymentsSource, /expireCheckoutSessionForFailedCards/);

const hostedCheckoutHookSource = readFileSync('frontend/hooks/useHostedWalletCheckout.ts', 'utf8');
assert.match(hostedCheckoutHookSource, /hosted_checkout_requested/);
assert.match(hostedCheckoutHookSource, /hosted_checkout_redirecting/);
assert.match(hostedCheckoutHookSource, /hosted_checkout_failed/);

const expressCheckoutSource = readFileSync('frontend/app/(core)/billing/_components/WalletExpressCheckout.tsx', 'utf8');
assert.match(expressCheckoutSource, /express_checkout_ready/);
assert.match(expressCheckoutSource, /express_checkout_cancelled/);
assert.match(expressCheckoutSource, /express_checkout_confirm_started/);
assert.match(expressCheckoutSource, /express_checkout_confirm_failed/);

assert.equal(
  classifyCheckoutAbandonmentSignal([{ eventName: 'express_checkout_confirm_failed' }, { eventName: 'hosted_checkout_redirecting' }], true),
  'none',
  'a paid receipt must override earlier failed attempts in abandonment reporting'
);
assert.equal(
  classifyCheckoutAbandonmentSignal([{ eventName: 'express_checkout_unavailable', metadata: { reason: 'no_available_methods' } }]),
  'passive_open',
  'a device without an eligible wallet is not a technical payment error'
);

assert.equal(
  classifyCheckoutAbandonmentSignal([
    { eventName: 'express_checkout_unavailable', metadata: { reason: 'ready_timeout' } },
    { eventName: 'express_checkout_ready', metadata: { recoveredAfterTimeout: true } },
    { eventName: 'express_checkout_cancelled' },
  ]),
  'user_cancelled',
  'a recovered load must not hide the subsequent wallet sheet cancellation'
);

const timeout = { eventName: 'express_checkout_unavailable', createdAt: '2026-11-10T10:52:33Z' };
const ready = { eventName: 'express_checkout_ready', createdAt: '2026-11-10T10:52:38Z' };
assert.deepEqual(
  summarizeCheckoutWalletLoads([
    { ...ready, metadata: { loadId: 'load-a', recoveredAfterTimeout: true, elementReadyMs: 14_000 } },
    { ...timeout, metadata: { loadId: 'load-a', reason: 'ready_timeout' } },
    { ...timeout, metadata: { loadId: 'load-b', reason: 'ready_timeout' } },
  ]).map(load => [load.id, load.status, load.elementReadyMs]),
  [['load-a', 'recovered', 14_000], ['load-b', 'no_ready', null]],
  'out-of-order beacons must not let a ready from one mount clear a different mount timeout'
);
assert.equal(
  summarizeCheckoutWalletLoads([
    { ...timeout, metadata: { reason: 'ready_timeout' } },
    { ...ready, metadata: { recoveredAfterTimeout: true } },
  ])[0]?.status,
  'recovered',
  'historical events with an explicit recovery flag must remain readable'
);
assert.equal(
  summarizeCheckoutWalletLoads([
    { ...timeout, metadata: { reason: 'ready_timeout' } },
    { ...ready, metadata: null },
  ])[0]?.status,
  'no_ready',
  'historical events without a recovery flag must not be paired across unknown mounts'
);

const delayedLoad = summarizeCheckoutWalletLoads([{ ...timeout, metadata: { reason: 'ready_timeout' } }]);
const nativeAttempt = (userId: string) => ({
  userId, mode: 'express_checkout' as const, hasReceipt: false, events: [], walletLoads: delayedLoad,
});
const hostedAttempt = (userId: string, createdAt: string, hasReceipt: boolean, eventName = 'hosted_checkout_redirecting') => ({
  userId, mode: 'hosted' as const, hasReceipt, walletLoads: [], events: [{ eventName, createdAt, metadata: null }],
});
assert.deepEqual(
  summarizeRecentWalletFollowups([
    nativeAttempt('first'), nativeAttempt('first'), nativeAttempt('second'), nativeAttempt('third'),
    hostedAttempt('first', '2026-11-10T10:53:14Z', false),
    hostedAttempt('first', '2026-11-10T10:55:14Z', true),
    hostedAttempt('second', '2026-11-10T10:54:14Z', false),
    hostedAttempt('second', '2026-11-10T10:54:14Z', true, 'hosted_checkout_requested'),
    hostedAttempt('third', '2026-11-10T11:13:14Z', true),
    hostedAttempt('unrelated', '2026-11-10T10:55:14Z', true),
  ]),
  { delayedAccounts: 3, hostedAfterDelay: 2, hostedPaidAfterDelay: 1 },
  'count distinct accounts and require an observed redirect followed by a receipt on the matched hosted attempt'
);
