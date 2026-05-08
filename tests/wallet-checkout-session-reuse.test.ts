import assert from 'node:assert/strict';

import { isReusableStripeCheckoutSession } from '../frontend/server/checkout-session-reuse';

const now = 1_800_000;

assert.equal(
  isReusableStripeCheckoutSession({
    clientSecret: 'cs_secret_123',
    created: 1_799_000,
    expiresAt: 1_801_000,
    now,
    paymentStatus: 'unpaid',
    status: 'open',
  }),
  true,
  'an open unpaid session with a client secret can be reused'
);

assert.equal(
  isReusableStripeCheckoutSession({
    clientSecret: 'cs_secret_123',
    created: 1_799_000,
    expiresAt: 1_801_000,
    now,
    paymentStatus: 'paid',
    status: 'complete',
  }),
  false,
  'a completed session must not be reused'
);

assert.equal(
  isReusableStripeCheckoutSession({
    clientSecret: null,
    created: 1_799_000,
    expiresAt: 1_801_000,
    now,
    paymentStatus: 'unpaid',
    status: 'open',
  }),
  false,
  'a custom Checkout session without a client secret cannot be reused by Express Checkout'
);

assert.equal(
  isReusableStripeCheckoutSession({
    clientSecret: 'cs_secret_123',
    created: 1_799_000,
    expiresAt: 1_799_999,
    now,
    paymentStatus: 'unpaid',
    status: 'open',
  }),
  false,
  'an expired session must not be reused'
);
