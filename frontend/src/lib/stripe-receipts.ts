type StripeChargeLike = {
  id?: string;
  receipt_url?: string | null;
};

type StripeInvoiceLike = {
  id?: string;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
};

type StripePaymentIntentLike = {
  id?: string;
  latest_charge?: string | StripeChargeLike | null;
};

type StripeReceiptLookupClient = {
  invoices?: {
    retrieve: (id: string) => Promise<StripeInvoiceLike>;
  };
  charges: {
    retrieve: (id: string) => Promise<StripeChargeLike>;
  };
  paymentIntents: {
    retrieve: (
      id: string,
      params?: { expand?: string[] }
    ) => Promise<StripePaymentIntentLike>;
  };
};

export type StripeReceiptSource = {
  type: string | null;
  stripeInvoiceId?: string | null;
  stripeHostedInvoiceUrl?: string | null;
  stripeInvoicePdf?: string | null;
  stripeReceiptUrl?: string | null;
  stripeChargeId?: string | null;
  stripePaymentIntentId?: string | null;
};

export type StripeBillingDocument =
  | {
      type: 'invoice';
      label: 'Invoice';
      url: string;
    }
  | {
      type: 'receipt';
      label: 'Receipt';
      url: string;
    };

export type StripeReceiptDocument = Extract<StripeBillingDocument, { type: 'receipt' }>;

function normalizeStripeId(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
}

function normalizeUrl(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
}

function documentFromCharge(charge: StripeChargeLike | null | undefined): StripeReceiptDocument | null {
  const url = normalizeUrl(charge?.receipt_url);
  if (!url) return null;
  return { type: 'receipt', label: 'Receipt', url };
}

function documentFromInvoice(invoice: StripeInvoiceLike | null | undefined): StripeBillingDocument | null {
  const url = normalizeUrl(invoice?.hosted_invoice_url) ?? normalizeUrl(invoice?.invoice_pdf);
  if (!url) return null;
  return { type: 'invoice', label: 'Invoice', url };
}

function documentFromCachedInvoice(source: StripeReceiptSource): StripeBillingDocument | null {
  const url = normalizeUrl(source.stripeHostedInvoiceUrl) ?? normalizeUrl(source.stripeInvoicePdf);
  if (!url) return null;
  return { type: 'invoice', label: 'Invoice', url };
}

function documentFromCachedReceipt(source: StripeReceiptSource): StripeReceiptDocument | null {
  const url = normalizeUrl(source.stripeReceiptUrl);
  if (!url) return null;
  return { type: 'receipt', label: 'Receipt', url };
}

// Deduplicate document reads within each Stripe client (and therefore account/key).
// Missing historical objects are retried after an hour; temporary failures are not cached.
const documentLookups = new WeakMap<StripeReceiptLookupClient, Map<string, {
  pending?: Promise<unknown>;
  missingUntil?: number;
}>>();

async function lookupDocumentObject<T>(
  stripe: StripeReceiptLookupClient,
  key: string,
  retrieve: () => Promise<T>,
): Promise<T | null> {
  let cache = documentLookups.get(stripe);
  if (!cache) { cache = new Map(); documentLookups.set(stripe, cache); }
  const previous = cache.get(key);
  if (previous?.pending) return previous.pending as Promise<T | null>;
  if (previous?.missingUntil && previous.missingUntil > Date.now()) return null;
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  const entry: { pending?: Promise<unknown>; missingUntil?: number } = {};
  const pending = Promise.resolve().then(retrieve).catch((error: unknown) => {
    const failure = error as { code?: string; statusCode?: number } | null;
    if (failure?.code === 'resource_missing' && failure.statusCode === 404) {
      entry.missingUntil = Date.now() + 60 * 60 * 1000;
    }
    return null;
  }).finally(() => {
    entry.pending = undefined;
    if (!entry.missingUntil && cache.get(key) === entry) cache.delete(key);
  });
  entry.pending = pending;
  cache.set(key, entry);
  return pending;
}

async function retrieveInvoiceDocument(
  stripe: StripeReceiptLookupClient | null,
  invoiceId: string | null
): Promise<StripeBillingDocument | null> {
  if (!stripe?.invoices || !invoiceId) return null;
  try {
    const invoice = await lookupDocumentObject(stripe, `invoice:${invoiceId}`, () => stripe.invoices!.retrieve(invoiceId));
    return documentFromInvoice(invoice);
  } catch {
    return null;
  }
}

async function retrieveChargeDocument(
  stripe: StripeReceiptLookupClient | null,
  chargeId: string | null
): Promise<StripeReceiptDocument | null> {
  if (!stripe || !chargeId) return null;
  try {
    const charge = await lookupDocumentObject(stripe, `charge:${chargeId}`, () => stripe.charges.retrieve(chargeId));
    return documentFromCharge(charge);
  } catch {
    return null;
  }
}

async function resolveFreshReceiptDocument(
  stripe: StripeReceiptLookupClient | null,
  source: StripeReceiptSource
): Promise<StripeReceiptDocument | null> {
  const chargeId = normalizeStripeId(source.stripeChargeId);
  const directChargeDocument = await retrieveChargeDocument(stripe, chargeId);
  if (directChargeDocument) return directChargeDocument;

  const paymentIntentId = normalizeStripeId(source.stripePaymentIntentId);
  if (!stripe || !paymentIntentId) return null;

  try {
    const intent = await lookupDocumentObject(stripe, `intent:${paymentIntentId}`, () => stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    }));
    const latestCharge = intent?.latest_charge;
    if (typeof latestCharge === 'string') {
      return retrieveChargeDocument(stripe, latestCharge);
    }
    return documentFromCharge(latestCharge);
  } catch {
    return null;
  }
}

export async function resolveStripeBillingDocument(
  stripe: StripeReceiptLookupClient | null,
  source: StripeReceiptSource
): Promise<StripeBillingDocument | null> {
  if (source.type !== 'topup') return null;

  const invoiceId = normalizeStripeId(source.stripeInvoiceId);
  const freshInvoiceDocument = await retrieveInvoiceDocument(stripe, invoiceId);
  if (freshInvoiceDocument) return freshInvoiceDocument;

  const cachedInvoiceDocument = documentFromCachedInvoice(source);
  if (cachedInvoiceDocument) return cachedInvoiceDocument;

  const freshReceiptDocument = await resolveFreshReceiptDocument(stripe, source);
  if (freshReceiptDocument) return freshReceiptDocument;

  return documentFromCachedReceipt(source);
}

export async function resolveStripeReceiptDocument(
  stripe: StripeReceiptLookupClient | null,
  source: StripeReceiptSource
): Promise<StripeReceiptDocument | null> {
  if (source.type !== 'topup') return null;
  return (await resolveFreshReceiptDocument(stripe, source)) ?? documentFromCachedReceipt(source);
}
