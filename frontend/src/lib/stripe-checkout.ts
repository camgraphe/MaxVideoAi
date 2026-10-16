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

// Stripe Tax needs a shipping address to offer Google Pay in Checkout. Native
// wallets collect it in their sheet; hosted also exposes any saved tax address.
const WALLET_TAX_ADDRESS_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] = [
  'AC', 'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AT',
  'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI',
  'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY',
  'BZ', 'CA', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO',
  'CR', 'CV', 'CW', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC',
  'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FO', 'FR', 'GA',
  'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ',
  'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HN', 'HR', 'HT', 'HU', 'ID',
  'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP',
  'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB',
  'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD',
  'ME', 'MF', 'MG', 'MK', 'ML', 'MM', 'MN', 'MO', 'MQ', 'MR', 'MS', 'MT',
  'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NG', 'NI', 'NL',
  'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK',
  'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU',
  'RW', 'SA', 'SB', 'SC', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM',
  'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SZ', 'TA', 'TC', 'TD', 'TF',
  'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW',
  'TZ', 'UA', 'UG', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VN', 'VU',
  'WF', 'WS', 'XK', 'YE', 'YT', 'ZA', 'ZM', 'ZW', 'ZZ',
];

export const WALLET_EXPRESS_TAX_ADDRESS_POLICY = '1';

type BuildWalletTopUpCheckoutSessionParamsArgs = {
  blockAmexCards?: boolean;
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
  customerHasShippingAddress?: boolean;
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
  blockAmexCards = false,
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
  customerHasShippingAddress = false,
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

  // Hosted Checkout enforces this for entered, saved, Link and wallet cards.
  // Keep the separate native Elements flow available with its current methods.
  if (blockAmexCards && checkoutUiMode !== 'elements') {
    params.payment_method_options = {
      card: { restrictions: { brands_blocked: ['american_express'] } },
    } as NonNullable<WalletTopUpCheckoutSessionParams['payment_method_options']>;
  }

  const customerId = normalizeOptionalStripeId(customer);
  if (customerId) {
    params.customer = customerId;
    if (customerUpdate) {
      params.customer_update = customerUpdate;
    }
  }

  // Saved shipping takes precedence over billing for Stripe Tax. Let returning
  // wallet customers correct that address when switching to hosted card checkout.
  if (checkoutUiMode === 'elements' || (customerId && customerHasShippingAddress)) {
    params.shipping_address_collection = { allowed_countries: [...WALLET_TAX_ADDRESS_COUNTRIES] };
    if (customerId) {
      params.customer_update = { ...params.customer_update, shipping: 'auto' };
    }
  }

  if (checkoutUiMode === 'elements') {
    if (!returnUrl) {
      throw new Error('returnUrl is required for Checkout Elements sessions');
    }
    params.metadata = { ...params.metadata, wallet_express_tax_address: WALLET_EXPRESS_TAX_ADDRESS_POLICY };
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
