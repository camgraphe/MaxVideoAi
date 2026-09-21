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
    const synced = await syncDocument(buildInvoiceDocumentSyncFields(invoice));
    // Stripe does not guarantee ordering between invoice and top-up events.
    // Retry this document-only event instead of acknowledging a lost update.
    if (!synced && invoice.metadata?.kind === 'topup') {
      throw new Error('Wallet top-up receipt is not yet available for invoice synchronization.');
    }
  };
}

export const handleInvoicePaid = createInvoicePaidHandler();
