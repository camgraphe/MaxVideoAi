import Stripe from 'stripe';

export type TopupDocumentFields = {
  stripeCustomerId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeInvoiceId?: string | null;
  stripeHostedInvoiceUrl?: string | null;
  stripeInvoicePdf?: string | null;
  stripeReceiptUrl?: string | null;
};

export function normalizeStripeId(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'object' && value && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
  }
  return null;
}

export function normalizeStripeUrl(value: unknown): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
}

export function invoiceDocumentFields(invoice: string | Stripe.Invoice | null | undefined): TopupDocumentFields {
  if (!invoice) return {};
  if (typeof invoice === 'string') {
    return { stripeInvoiceId: normalizeStripeId(invoice) };
  }
  return {
    stripeInvoiceId: normalizeStripeId(invoice.id),
    stripeHostedInvoiceUrl: normalizeStripeUrl(invoice.hosted_invoice_url),
    stripeInvoicePdf: normalizeStripeUrl(invoice.invoice_pdf),
  };
}

export function chargeReceiptUrl(charge: string | Stripe.Charge | null | undefined): string | null {
  if (!charge || typeof charge === 'string') return null;
  return normalizeStripeUrl(charge.receipt_url);
}

export async function retrieveChargeReceiptUrl(stripe: Stripe, chargeId: string | null): Promise<string | null> {
  if (!chargeId) return null;
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    return normalizeStripeUrl(charge.receipt_url);
  } catch (error) {
    console.warn('[stripe-webhook] failed to retrieve charge receipt URL', {
      chargeId,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}
