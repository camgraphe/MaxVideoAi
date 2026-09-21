import type Stripe from 'stripe';

type CheckoutUiMode = 'hosted' | 'elements';
type WalletTopUpCheckoutSessionParams = Omit<
  Stripe.Checkout.SessionCreateParams,
  'ui_mode' | 'success_url' | 'cancel_url' | 'return_url'
> & {
  ui_mode?: Stripe.Checkout.SessionCreateParams.UiMode | 'elements';
  success_url?: string;
  cancel_url?: string;
  return_url?: string;
};

const WALLET_TOPUP_CHECKOUT_SESSION_TTL_SECONDS = 31 * 60;
const WALLET_TOPUP_MIN_AMOUNT_CENTS = 1000;

type BuildWalletTopUpCheckoutSessionParamsArgs = {
  fxQuote?: { rate: number; source: string; marginBps?: number; rateTimestamp?: string };
  currency: string;
  settlementAmountCents: number;
  checkoutUiMode?: CheckoutUiMode;
  successUrl?: string;
  cancelUrl?: string;
  returnUrl?: string;
  locale?: Stripe.Checkout.SessionCreateParams.Locale;
  productName?: string;
  sessionMetadata: Record<string, string>;
  paymentIntentMetadata: Record<string, string>;
  productTaxCode: string;
  customer?: string | null;
  customerUpdate?: Stripe.Checkout.SessionCreateParams.CustomerUpdate | null;
};

function normalizeOptionalStripeId(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
}

export function normalizeWalletTopUpAmountCents(value: unknown): number | null {
  if (value == null || value === '') return WALLET_TOPUP_MIN_AMOUNT_CENTS;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(WALLET_TOPUP_MIN_AMOUNT_CENTS, Math.round(parsed));
}

export function buildWalletTopUpCheckoutSessionParams({
  fxQuote,
  currency,
  settlementAmountCents,
  checkoutUiMode = 'hosted',
  successUrl,
  cancelUrl,
  returnUrl,
  locale = 'auto',
  productName = 'Wallet top-up',
  sessionMetadata,
  paymentIntentMetadata,
  productTaxCode,
  customer,
  customerUpdate,
}: BuildWalletTopUpCheckoutSessionParamsArgs): WalletTopUpCheckoutSessionParams {
  const fxMetadata: Record<string, string> = fxQuote ? {
    fx_rate: String(fxQuote.rate), fx_source: fxQuote.source,
    ...(fxQuote.marginBps != null ? { fx_margin_bps: String(fxQuote.marginBps) } : {}),
    ...(fxQuote.rateTimestamp ? { rate_timestamp: fxQuote.rateTimestamp } : {}),
  } : {};
  const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
    metadata: { ...paymentIntentMetadata, ...fxMetadata },
  };

  const params: WalletTopUpCheckoutSessionParams = {
    mode: 'payment',
    locale,
    expires_at: Math.floor(Date.now() / 1000) + WALLET_TOPUP_CHECKOUT_SESSION_TTL_SECONDS,
    billing_address_collection: 'auto',
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    invoice_creation: { enabled: true, invoice_data: { metadata: {
      kind: 'topup',
      ...(sessionMetadata.user_id ? { user_id: sessionMetadata.user_id } : {}),
    } } },
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: productName, tax_code: productTaxCode },
          unit_amount: settlementAmountCents,
          tax_behavior: 'exclusive',
        },
        quantity: 1,
      },
    ],
    metadata: { ...sessionMetadata, ...fxMetadata },
    payment_intent_data: paymentIntentData,
  };

  const customerId = normalizeOptionalStripeId(customer);
  if (customerId) {
    params.customer = customerId;
    if (customerUpdate) {
      params.customer_update = customerUpdate;
    }
  }

  if (checkoutUiMode === 'elements') {
    if (!returnUrl) {
      throw new Error('returnUrl is required for Checkout Elements sessions');
    }
    params.ui_mode = 'elements';
    params.return_url = returnUrl;
    return params;
  }

  if (!successUrl || !cancelUrl) {
    throw new Error('successUrl and cancelUrl are required for hosted Checkout sessions');
  }
  params.success_url = successUrl;
  params.cancel_url = cancelUrl;
  return params;
}
