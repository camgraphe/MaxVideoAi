import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WALLET_TOPUP_SHIPPING_ADDRESS_COUNTRIES,
  buildWalletTopUpCheckoutSessionParams,
  isStripeCheckoutCardRestrictionError,
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

test('wallet top-up Checkout keeps PaymentIntent metadata', () => {
  const params = buildParams({
    paymentIntentMetadata: { kind: 'topup', wallet_amount_cents: '2500', settlement_currency: 'EUR' },
  });

  assert.deepEqual(params.payment_intent_data?.metadata, {
    kind: 'topup',
    wallet_amount_cents: '2500',
    settlement_currency: 'EUR',
  });
});

test('wallet top-up Checkout can attach a Stripe Customer and update supported billing fields', () => {
  const params = buildParams({
    customer: 'cus_123',
    customerUpdate: {
      address: 'auto',
      name: 'auto',
      shipping: 'auto',
    },
  });

  assert.equal(params.customer, 'cus_123');
  assert.deepEqual(params.customer_update, {
    address: 'auto',
    name: 'auto',
    shipping: 'auto',
  });
  assert.equal('invoice_creation' in params, false);
});

test('wallet top-up Checkout omits customer update without a Stripe Customer', () => {
  const params = buildParams({
    customerUpdate: {
      address: 'auto',
      name: 'auto',
      shipping: 'auto',
    },
  });

  assert.equal(params.customer, undefined);
  assert.equal(params.customer_update, undefined);
  assert.equal('invoice_creation' in params, false);
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

test('wallet top-up Checkout can temporarily block American Express cards', () => {
  const params = buildParams({ blockAmexCards: true });

  assert.deepEqual((params.payment_method_options as any)?.card?.restrictions?.brands_blocked, ['american_express']);
});

test('wallet top-up Checkout does not block card brands by default', () => {
  const params = buildParams();

  assert.equal(params.payment_method_options, undefined);
});

test('detects Stripe Checkout card restriction parameter failures', () => {
  assert.equal(
    isStripeCheckoutCardRestrictionError({
      type: 'StripeInvalidRequestError',
      param: 'payment_method_options.card.restrictions',
      message: 'Received unknown parameter: payment_method_options.card.restrictions',
    }),
    true
  );
});

test('does not treat unrelated Stripe failures as card restriction failures', () => {
  assert.equal(
    isStripeCheckoutCardRestrictionError({
      type: 'StripeInvalidRequestError',
      param: 'line_items',
      message: 'Missing required param: line_items',
    }),
    false
  );
});
