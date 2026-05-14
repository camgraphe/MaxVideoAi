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
  blockAmexCards?: boolean;
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
  blockAmexCards = false,
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
  const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
    metadata: paymentIntentMetadata,
  };

  const params: WalletTopUpCheckoutSessionParams = {
    mode: 'payment',
    locale,
    expires_at: Math.floor(Date.now() / 1000) + WALLET_TOPUP_CHECKOUT_SESSION_TTL_SECONDS,
    billing_address_collection: 'auto',
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
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
    metadata: sessionMetadata,
    payment_intent_data: paymentIntentData,
  };

  if (blockAmexCards) {
    params.payment_method_options = {
      card: {
        restrictions: {
          brands_blocked: ['american_express'],
        },
      },
    } as NonNullable<WalletTopUpCheckoutSessionParams['payment_method_options']>;
  }

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
