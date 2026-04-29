import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveStripeBillingDocument, resolveStripeReceiptDocument } from '../frontend/src/lib/stripe-receipts.ts';

test('resolveStripeBillingDocument returns a fresh invoice URL before receipt fallback', async () => {
  const stripe = {
    invoices: {
      retrieve: async (id: string) => ({
        id,
        hosted_invoice_url: 'https://invoice.stripe.com/i/acct/inv_123',
        invoice_pdf: 'https://invoice.stripe.com/i/acct/inv_123.pdf',
      }),
    },
    charges: {
      retrieve: async () => ({ receipt_url: 'https://pay.stripe.com/receipts/ch_123' }),
    },
    paymentIntents: {
      retrieve: async () => ({ latest_charge: null }),
    },
  };

  const document = await resolveStripeBillingDocument(stripe, {
    type: 'topup',
    stripeInvoiceId: 'in_123',
    stripeHostedInvoiceUrl: 'https://cached.example/invoice',
    stripeReceiptUrl: 'https://cached.example/receipt',
    stripeChargeId: 'ch_123',
    stripePaymentIntentId: 'pi_123',
  });

  assert.deepEqual(document, {
    type: 'invoice',
    label: 'Invoice',
    url: 'https://invoice.stripe.com/i/acct/inv_123',
  });
});

test('resolveStripeBillingDocument falls back to cached invoice URLs before receipts', async () => {
  const stripe = {
    invoices: {
      retrieve: async () => {
        throw new Error('temporary stripe failure');
      },
    },
    charges: {
      retrieve: async () => ({ receipt_url: 'https://pay.stripe.com/receipts/ch_123' }),
    },
    paymentIntents: {
      retrieve: async () => ({ latest_charge: null }),
    },
  };

  const document = await resolveStripeBillingDocument(stripe, {
    type: 'topup',
    stripeInvoiceId: 'in_123',
    stripeHostedInvoiceUrl: 'https://cached.example/invoice',
    stripeInvoicePdf: 'https://cached.example/invoice.pdf',
    stripeReceiptUrl: 'https://cached.example/receipt',
    stripeChargeId: 'ch_123',
    stripePaymentIntentId: 'pi_123',
  });

  assert.deepEqual(document, {
    type: 'invoice',
    label: 'Invoice',
    url: 'https://cached.example/invoice',
  });
});

test('resolveStripeReceiptDocument returns a receipt URL from a stored charge id', async () => {
  const stripe = {
    invoices: {
      retrieve: async () => {
        throw new Error('should not retrieve invoice without an invoice id');
      },
    },
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
    stripeReceiptUrl: 'https://cached.example/receipt',
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
    invoices: {
      retrieve: async () => {
        throw new Error('should not retrieve invoice without an invoice id');
      },
    },
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
    invoices: {
      retrieve: async () => {
        throw new Error('should ignore non-top-up row');
      },
    },
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
    invoices: {
      retrieve: async () => {
        throw new Error('should not retrieve invoice without an invoice id');
      },
    },
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

test('resolveStripeBillingDocument falls back to cached receipt URL after fresh receipt lookup fails', async () => {
  const stripe = {
    invoices: {
      retrieve: async () => {
        throw new Error('should not retrieve invoice without an invoice id');
      },
    },
    charges: {
      retrieve: async () => {
        throw new Error('temporary stripe failure');
      },
    },
    paymentIntents: {
      retrieve: async () => {
        throw new Error('temporary stripe failure');
      },
    },
  };

  const document = await resolveStripeBillingDocument(stripe, {
    type: 'topup',
    stripeReceiptUrl: 'https://cached.example/receipt',
    stripeChargeId: 'ch_123',
    stripePaymentIntentId: 'pi_123',
  });

  assert.deepEqual(document, {
    type: 'receipt',
    label: 'Receipt',
    url: 'https://cached.example/receipt',
  });
});
