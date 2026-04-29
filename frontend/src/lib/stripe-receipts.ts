type StripeChargeLike = {
  id?: string;
  receipt_url?: string | null;
};

type StripePaymentIntentLike = {
  id?: string;
  latest_charge?: string | StripeChargeLike | null;
};

type StripeReceiptLookupClient = {
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
  stripeChargeId?: string | null;
  stripePaymentIntentId?: string | null;
};

export type StripeReceiptDocument = {
  type: 'receipt';
  label: 'Receipt';
  url: string;
};

function normalizeStripeId(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
}

function documentFromCharge(charge: StripeChargeLike | null | undefined): StripeReceiptDocument | null {
  const url = typeof charge?.receipt_url === 'string' ? charge.receipt_url.trim() : '';
  if (!url) return null;
  return { type: 'receipt', label: 'Receipt', url };
}

async function retrieveChargeDocument(
  stripe: StripeReceiptLookupClient,
  chargeId: string | null
): Promise<StripeReceiptDocument | null> {
  if (!chargeId) return null;
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    return documentFromCharge(charge);
  } catch {
    return null;
  }
}

export async function resolveStripeReceiptDocument(
  stripe: StripeReceiptLookupClient,
  source: StripeReceiptSource
): Promise<StripeReceiptDocument | null> {
  if (source.type !== 'topup') return null;

  const chargeId = normalizeStripeId(source.stripeChargeId);
  const directChargeDocument = await retrieveChargeDocument(stripe, chargeId);
  if (directChargeDocument) return directChargeDocument;

  const paymentIntentId = normalizeStripeId(source.stripePaymentIntentId);
  if (!paymentIntentId) return null;

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    });
    const latestCharge = intent.latest_charge;
    if (typeof latestCharge === 'string') {
      return retrieveChargeDocument(stripe, latestCharge);
    }
    return documentFromCharge(latestCharge);
  } catch {
    return null;
  }
}
