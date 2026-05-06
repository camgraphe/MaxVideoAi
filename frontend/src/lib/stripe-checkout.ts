import type Stripe from 'stripe';

type CheckoutAllowedCountry =
  Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry;
type CheckoutUiMode = 'hosted' | 'elements';
type BlockedCardBrand = 'american_express';
type CheckoutPaymentMethodOptions = Omit<
  Stripe.Checkout.SessionCreateParams.PaymentMethodOptions,
  'card'
> & {
  card?: Stripe.Checkout.SessionCreateParams.PaymentMethodOptions.Card & {
    restrictions?: {
      brands_blocked: BlockedCardBrand[];
    };
  };
};
type WalletTopUpCheckoutSessionParams = Omit<
  Stripe.Checkout.SessionCreateParams,
  'ui_mode' | 'success_url' | 'cancel_url' | 'return_url' | 'payment_method_options'
> & {
  ui_mode?: Stripe.Checkout.SessionCreateParams.UiMode | 'elements';
  success_url?: string;
  cancel_url?: string;
  return_url?: string;
  payment_method_options?: CheckoutPaymentMethodOptions;
};

export const WALLET_TOPUP_SHIPPING_ADDRESS_COUNTRIES = [
  'AC',
  'AD',
  'AE',
  'AF',
  'AG',
  'AI',
  'AL',
  'AM',
  'AO',
  'AQ',
  'AR',
  'AT',
  'AU',
  'AW',
  'AX',
  'AZ',
  'BA',
  'BB',
  'BD',
  'BE',
  'BF',
  'BG',
  'BH',
  'BI',
  'BJ',
  'BL',
  'BM',
  'BN',
  'BO',
  'BQ',
  'BR',
  'BS',
  'BT',
  'BV',
  'BW',
  'BY',
  'BZ',
  'CA',
  'CD',
  'CF',
  'CG',
  'CH',
  'CI',
  'CK',
  'CL',
  'CM',
  'CN',
  'CO',
  'CR',
  'CV',
  'CW',
  'CY',
  'CZ',
  'DE',
  'DJ',
  'DK',
  'DM',
  'DO',
  'DZ',
  'EC',
  'EE',
  'EG',
  'EH',
  'ER',
  'ES',
  'ET',
  'FI',
  'FJ',
  'FK',
  'FO',
  'FR',
  'GA',
  'GB',
  'GD',
  'GE',
  'GF',
  'GG',
  'GH',
  'GI',
  'GL',
  'GM',
  'GN',
  'GP',
  'GQ',
  'GR',
  'GS',
  'GT',
  'GU',
  'GW',
  'GY',
  'HK',
  'HN',
  'HR',
  'HT',
  'HU',
  'ID',
  'IE',
  'IL',
  'IM',
  'IN',
  'IO',
  'IQ',
  'IS',
  'IT',
  'JE',
  'JM',
  'JO',
  'JP',
  'KE',
  'KG',
  'KH',
  'KI',
  'KM',
  'KN',
  'KR',
  'KW',
  'KY',
  'KZ',
  'LA',
  'LB',
  'LC',
  'LI',
  'LK',
  'LR',
  'LS',
  'LT',
  'LU',
  'LV',
  'LY',
  'MA',
  'MC',
  'MD',
  'ME',
  'MF',
  'MG',
  'MK',
  'ML',
  'MM',
  'MN',
  'MO',
  'MQ',
  'MR',
  'MS',
  'MT',
  'MU',
  'MV',
  'MW',
  'MX',
  'MY',
  'MZ',
  'NA',
  'NC',
  'NE',
  'NG',
  'NI',
  'NL',
  'NO',
  'NP',
  'NR',
  'NU',
  'NZ',
  'OM',
  'PA',
  'PE',
  'PF',
  'PG',
  'PH',
  'PK',
  'PL',
  'PM',
  'PN',
  'PR',
  'PS',
  'PT',
  'PY',
  'QA',
  'RE',
  'RO',
  'RS',
  'RU',
  'RW',
  'SA',
  'SB',
  'SC',
  'SE',
  'SG',
  'SH',
  'SI',
  'SJ',
  'SK',
  'SL',
  'SM',
  'SN',
  'SO',
  'SR',
  'SS',
  'ST',
  'SV',
  'SX',
  'SZ',
  'TA',
  'TC',
  'TD',
  'TF',
  'TG',
  'TH',
  'TJ',
  'TK',
  'TL',
  'TM',
  'TN',
  'TO',
  'TR',
  'TT',
  'TV',
  'TW',
  'TZ',
  'UA',
  'UG',
  'US',
  'UY',
  'UZ',
  'VA',
  'VC',
  'VE',
  'VG',
  'VN',
  'VU',
  'WF',
  'WS',
  'XK',
  'YE',
  'YT',
  'ZA',
  'ZM',
  'ZW',
  'ZZ',
] satisfies CheckoutAllowedCountry[];

type BuildWalletTopUpCheckoutSessionParamsArgs = {
  currency: string;
  settlementAmountCents: number;
  checkoutUiMode?: CheckoutUiMode;
  successUrl?: string;
  cancelUrl?: string;
  returnUrl?: string;
  locale?: Stripe.Checkout.SessionCreateParams.Locale;
  productName?: string;
  taxLocationMessage?: string;
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

export function buildWalletTopUpCheckoutSessionParams({
  currency,
  settlementAmountCents,
  checkoutUiMode = 'hosted',
  successUrl,
  cancelUrl,
  returnUrl,
  locale = 'auto',
  productName = 'Wallet top-up',
  taxLocationMessage = 'Used only to confirm tax location for this digital wallet top-up.',
  sessionMetadata,
  paymentIntentMetadata,
  productTaxCode,
  customer,
  customerUpdate,
  blockAmexCards = false,
}: BuildWalletTopUpCheckoutSessionParamsArgs): WalletTopUpCheckoutSessionParams {
  const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
    metadata: paymentIntentMetadata,
  };

  const params: WalletTopUpCheckoutSessionParams = {
    mode: 'payment',
    locale,
    billing_address_collection: 'auto',
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    shipping_address_collection: {
      allowed_countries: WALLET_TOPUP_SHIPPING_ADDRESS_COUNTRIES,
    },
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
    // Temporary fraud mitigation for card-testing waves targeting Amex.
    params.payment_method_options = {
      card: {
        restrictions: {
          brands_blocked: ['american_express'],
        },
      },
    };
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
  params.custom_text = {
    shipping_address: {
      message: taxLocationMessage,
    },
  };
  params.success_url = successUrl;
  params.cancel_url = cancelUrl;
  return params;
}
