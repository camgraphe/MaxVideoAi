import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';

import {
  buildCheckoutSessionTopupInput,
  buildPaymentIntentTopupInput,
} from '../frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-events.ts';

test('Checkout Session maps canonical amount, currency, FX, destination, and documents', () => {
  const session = {
    id: 'cs_checkout',
    amount_total: 2300,
    currency: 'eur',
    customer: 'cus_checkout',
    invoice: {
      id: 'in_checkout',
      hosted_invoice_url: 'https://invoice.example/checkout',
      invoice_pdf: 'https://invoice.example/checkout.pdf',
    },
    payment_intent: {
      id: 'pi_checkout',
      latest_charge: {
        id: 'ch_checkout',
        receipt_url: 'https://receipt.example/expanded-checkout',
      },
    },
    metadata: {
      kind: 'topup',
      user_id: 'user_checkout',
      wallet_amount_cents: '2500',
      wallet_currency: 'EUR',
      platform_fee_cents_usd: '321',
      platform_fee_cents: '999',
      destination_account_id: 'acct_checkout',
      fx_rate: '0.91',
      fx_margin_bps: '175',
      rate_timestamp: '2026-07-13T10:00:00.000Z',
      fx_source: 'ecb',
      topup_tier_id: 'tier_checkout',
      topup_tier_label: 'Checkout tier',
      analytics_consent: 'granted',
      ga_client_id: 'ga.checkout',
      first_wallet_topup: 'true',
    },
  } as unknown as Stripe.Checkout.Session;

  const input = buildCheckoutSessionTopupInput(session, {
    receiptsPriceOnly: false,
    resolvedReceiptUrl: 'https://receipt.example/resolved-checkout',
  });

  assert.deepEqual(input, {
    userId: 'user_checkout',
    walletAmountCents: 2500,
    walletCurrency: 'EUR',
    settlementAmountCents: 2300,
    settlementCurrency: 'eur',
    paymentIntentId: 'pi_checkout',
    chargeId: 'ch_checkout',
    platformRevenueCents: 321,
    destinationAcct: 'acct_checkout',
    metadata: {
      sessionId: 'cs_checkout',
      source: 'checkout.session.completed',
      fx_rate: '0.91',
      fx_source: 'ecb',
      topup_tier_id: 'tier_checkout',
      topup_tier_label: 'Checkout tier',
      analytics_consent: 'granted',
      ga_client_id: 'ga.checkout',
      first_wallet_topup: 'true',
    },
    originalAmountCents: 2300,
    originalCurrency: 'eur',
    fxRate: 0.91,
    fxMarginBps: 175,
    fxRateTimestamp: '2026-07-13T10:00:00.000Z',
    stripeCustomerId: 'cus_checkout',
    stripeCheckoutSessionId: 'cs_checkout',
    stripeReceiptUrl: 'https://receipt.example/resolved-checkout',
    stripeInvoiceId: 'in_checkout',
    stripeHostedInvoiceUrl: 'https://invoice.example/checkout',
    stripeInvoicePdf: 'https://invoice.example/checkout.pdf',
  });
});

test('PaymentIntent maps canonical amount, currency, FX, destination, and documents', () => {
  const intent = {
    id: 'pi_intent',
    amount_received: 3700,
    amount: 3600,
    currency: 'gbp',
    application_fee_amount: 999,
    customer: { id: 'cus_intent' },
    invoice: 'in_intent',
    latest_charge: {
      id: 'ch_intent',
      receipt_url: 'https://receipt.example/expanded-intent',
    },
    metadata: {
      kind: 'topup',
      user_id: 'user_intent',
      wallet_amount_cents: '4000',
      wallet_currency: 'USD',
      platform_fee_cents_usd: '555',
      vendor_account_id: 'acct_vendor',
      fx_rate: '1.08',
      fx_margin_bps: '225',
      rate_timestamp: '2026-07-13T11:00:00.000Z',
      target_currency: 'cad',
      fx_source: 'stripe',
      topup_tier_id: 'tier_intent',
      topup_tier_label: 'Intent tier',
      analytics_consent: 'granted',
      ga_client_id: 'ga.intent',
      first_wallet_topup: 'false',
    },
  } as unknown as Stripe.PaymentIntent;

  const input = buildPaymentIntentTopupInput(intent, {
    receiptsPriceOnly: false,
    resolvedReceiptUrl: 'https://receipt.example/resolved-intent',
  });

  assert.deepEqual(input, {
    userId: 'user_intent',
    walletAmountCents: 4000,
    walletCurrency: 'USD',
    settlementAmountCents: 3700,
    settlementCurrency: 'gbp',
    paymentIntentId: 'pi_intent',
    chargeId: 'ch_intent',
    platformRevenueCents: 555,
    destinationAcct: 'acct_vendor',
    metadata: {
      source: 'payment_intent.succeeded',
      fx_rate: '1.08',
      fx_source: 'stripe',
      topup_tier_id: 'tier_intent',
      topup_tier_label: 'Intent tier',
      analytics_consent: 'granted',
      ga_client_id: 'ga.intent',
      first_wallet_topup: 'false',
    },
    originalAmountCents: 3700,
    originalCurrency: 'cad',
    fxRate: 1.08,
    fxMarginBps: 225,
    fxRateTimestamp: '2026-07-13T11:00:00.000Z',
    stripeCustomerId: 'cus_intent',
    stripeReceiptUrl: 'https://receipt.example/resolved-intent',
    stripeInvoiceId: 'in_intent',
  });
});
