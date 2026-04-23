import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WALLET_TOPUP_SHIPPING_ADDRESS_COUNTRIES,
  buildWalletTopUpCheckoutSessionParams,
} from '../frontend/src/lib/stripe-checkout.ts';

function buildParams(overrides: Partial<Parameters<typeof buildWalletTopUpCheckoutSessionParams>[0]> = {}) {
  return buildWalletTopUpCheckoutSessionParams({
    currency: 'eur',
    settlementAmountCents: 1200,
    successUrl: 'https://maxvideoai.com/billing?status=success',
    cancelUrl: 'https://maxvideoai.com/billing?status=cancelled',
    sessionMetadata: { kind: 'topup', wallet_amount_cents: '1000' },
    paymentIntentMetadata: { kind: 'topup', wallet_amount_cents: '1000' },
    productTaxCode: 'txcd_10103001',
    ...overrides,
  });
}

test('wallet top-up Checkout uses Stripe dynamic payment methods for wallets', () => {
  const params = buildParams();

  assert.equal(params.mode, 'payment');
  assert.equal(params.payment_method_types, undefined);
  assert.equal(params.success_url, 'https://maxvideoai.com/billing?status=success');
  assert.equal(params.cancel_url, 'https://maxvideoai.com/billing?status=cancelled');
  assert.equal(params.ui_mode, undefined);
  assert.equal(params.return_url, undefined);
  assert.equal(params.billing_address_collection, 'auto');
  assert.deepEqual(params.shipping_address_collection, {
    allowed_countries: WALLET_TOPUP_SHIPPING_ADDRESS_COUNTRIES,
  });
  assert.deepEqual(params.automatic_tax, { enabled: true });
});

test('wallet top-up Checkout keeps metadata and Connect transfer data on the PaymentIntent', () => {
  const params = buildParams({
    paymentIntentMetadata: { kind: 'topup', wallet_amount_cents: '2500', settlement_currency: 'EUR' },
    connectTransfer: {
      destinationAccountId: 'acct_test_destination',
      applicationFeeAmount: 300,
    },
  });

  assert.deepEqual(params.payment_intent_data?.metadata, {
    kind: 'topup',
    wallet_amount_cents: '2500',
    settlement_currency: 'EUR',
  });
  assert.equal(params.payment_intent_data?.application_fee_amount, 300);
  assert.deepEqual(params.payment_intent_data?.transfer_data, { destination: 'acct_test_destination' });
});

test('wallet top-up Checkout can create Elements sessions for Express Checkout', () => {
  const params = buildParams({
    checkoutUiMode: 'elements',
    successUrl: undefined,
    cancelUrl: undefined,
    returnUrl: 'https://maxvideoai.com/billing?status=success',
  });

  assert.equal(params.ui_mode, 'elements');
  assert.equal(params.return_url, 'https://maxvideoai.com/billing?status=success');
  assert.equal(params.success_url, undefined);
  assert.equal(params.cancel_url, undefined);
  assert.equal(params.payment_method_types, undefined);
  assert.deepEqual(params.automatic_tax, { enabled: true });
});
