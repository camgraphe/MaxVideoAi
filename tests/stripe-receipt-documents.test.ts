import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveStripeReceiptDocument } from '../frontend/src/lib/stripe-receipts.ts';

test('resolveStripeReceiptDocument returns a receipt URL from a stored charge id', async () => {
  const stripe = {
    charges: {
      retrieve: async (id: string) => ({ id, receipt_url: 'https://pay.stripe.com/receipts/ch_123' }),
    },
    paymentIntents: {
      retrieve: async () => {
        throw new Error('should not retrieve payment intent when charge has receipt');
      },
    },
  };

  const document = await resolveStripeReceiptDocument(stripe, {
    type: 'topup',
    stripeChargeId: 'ch_123',
    stripePaymentIntentId: 'pi_123',
  });

  assert.deepEqual(document, {
    type: 'receipt',
    label: 'Receipt',
    url: 'https://pay.stripe.com/receipts/ch_123',
  });
});

test('resolveStripeReceiptDocument falls back to payment intent latest charge', async () => {
  const stripe = {
    charges: {
      retrieve: async () => {
        throw new Error('missing charge');
      },
    },
    paymentIntents: {
      retrieve: async (id: string) => ({
        id,
        latest_charge: {
          id: 'ch_from_pi',
          receipt_url: 'https://pay.stripe.com/receipts/ch_from_pi',
        },
      }),
    },
  };

  const document = await resolveStripeReceiptDocument(stripe, {
    type: 'topup',
    stripeChargeId: 'ch_missing',
    stripePaymentIntentId: 'pi_123',
  });

  assert.deepEqual(document, {
    type: 'receipt',
    label: 'Receipt',
    url: 'https://pay.stripe.com/receipts/ch_from_pi',
  });
});

test('resolveStripeReceiptDocument ignores non-top-up ledger rows', async () => {
  const stripe = {
    charges: {
      retrieve: async () => ({ receipt_url: 'https://pay.stripe.com/receipts/ch_123' }),
    },
    paymentIntents: {
      retrieve: async () => ({ latest_charge: null }),
    },
  };

  const document = await resolveStripeReceiptDocument(stripe, {
    type: 'charge',
    stripeChargeId: 'ch_123',
    stripePaymentIntentId: null,
  });

  assert.equal(document, null);
});

test('resolveStripeReceiptDocument returns null when Stripe has no receipt URL', async () => {
  const stripe = {
    charges: {
      retrieve: async () => ({ id: 'ch_123', receipt_url: null }),
    },
    paymentIntents: {
      retrieve: async () => ({ id: 'pi_123', latest_charge: null }),
    },
  };

  const document = await resolveStripeReceiptDocument(stripe, {
    type: 'topup',
    stripeChargeId: 'ch_123',
    stripePaymentIntentId: 'pi_123',
  });

  assert.equal(document, null);
});
