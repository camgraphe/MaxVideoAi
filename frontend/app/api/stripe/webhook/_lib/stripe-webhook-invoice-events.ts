import type Stripe from 'stripe';

import { invoiceDocumentFields, normalizeStripeId } from './stripe-webhook-documents';
import { syncStripeTopupInvoiceDocument } from './stripe-webhook-topup-persistence';

export function buildInvoiceDocumentSyncFields(invoice: Stripe.Invoice) {
  return {
    stripePaymentIntentId: normalizeStripeId(invoice.payment_intent),
    stripeCustomerId: normalizeStripeId(invoice.customer),
    ...invoiceDocumentFields(invoice),
  };
}

export function createInvoicePaidHandler(
  syncDocument: typeof syncStripeTopupInvoiceDocument = syncStripeTopupInvoiceDocument,
) {
  return async function invoicePaid(invoice: Stripe.Invoice): Promise<void> {
    await syncDocument(buildInvoiceDocumentSyncFields(invoice));
  };
}

export const handleInvoicePaid = createInvoicePaidHandler();
