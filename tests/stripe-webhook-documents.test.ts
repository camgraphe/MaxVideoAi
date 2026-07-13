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
