import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { classifyCheckoutAbandonmentSignal } from '../frontend/server/checkout-report';

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

const stripeWebhookSource = readFileSync('frontend/app/api/stripe/webhook/route.ts', 'utf8');
assert.match(stripeWebhookSource, /charge\.failed/);
assert.match(stripeWebhookSource, /payment_intent\.payment_failed/);
assert.match(stripeWebhookSource, /handleChargeFailed/);
assert.match(stripeWebhookSource, /handlePaymentIntentFailed/);
assert.match(stripeWebhookSource, /expireCheckoutSessionForFailedCards/);

const billingClientSource = readFileSync('frontend/app/(core)/billing/_components/BillingClient.tsx', 'utf8');
assert.match(billingClientSource, /hosted_checkout_requested/);
assert.match(billingClientSource, /hosted_checkout_redirecting/);

const expressCheckoutSource = readFileSync('frontend/app/(core)/billing/_components/WalletExpressCheckout.tsx', 'utf8');
assert.match(expressCheckoutSource, /express_checkout_ready/);
assert.match(expressCheckoutSource, /express_checkout_cancelled/);
assert.match(expressCheckoutSource, /express_checkout_confirm_started/);
assert.match(expressCheckoutSource, /express_checkout_confirm_failed/);
