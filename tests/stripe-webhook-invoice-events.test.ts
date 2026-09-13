import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';

import {
  buildInvoiceDocumentSyncFields,
  createInvoicePaidHandler,
} from '../frontend/app/api/stripe/webhook/_lib/stripe-webhook-invoice-events.ts';

test('paid invoice maps the identity and final customer document fields', () => {
  const fields = buildInvoiceDocumentSyncFields({
    id: 'in_topup',
    customer: { id: 'cus_topup' },
    payment_intent: 'pi_topup',
    hosted_invoice_url: 'https://invoice.example/topup',
    invoice_pdf: 'https://invoice.example/topup.pdf',
  } as unknown as Stripe.Invoice);

  assert.deepEqual(fields, {
    stripePaymentIntentId: 'pi_topup',
    stripeCustomerId: 'cus_topup',
    stripeInvoiceId: 'in_topup',
    stripeHostedInvoiceUrl: 'https://invoice.example/topup',
    stripeInvoicePdf: 'https://invoice.example/topup.pdf',
  });
});

test('paid invoice handler only synchronizes document fields', async () => {
  const calls: unknown[] = [];
  const handler = createInvoicePaidHandler(async (fields) => {
    calls.push(fields);
    return true;
  });
  await handler({
    id: 'in_topup',
    customer: 'cus_topup',
    payment_intent: 'pi_topup',
    hosted_invoice_url: 'https://invoice.example/topup',
    invoice_pdf: 'https://invoice.example/topup.pdf',
  } as unknown as Stripe.Invoice);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], buildInvoiceDocumentSyncFields({
    id: 'in_topup',
    customer: 'cus_topup',
    payment_intent: 'pi_topup',
    hosted_invoice_url: 'https://invoice.example/topup',
    invoice_pdf: 'https://invoice.example/topup.pdf',
  } as unknown as Stripe.Invoice));
});
