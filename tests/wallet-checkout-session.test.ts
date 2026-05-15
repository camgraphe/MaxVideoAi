import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  buildWalletTopUpCheckoutSessionParams,
  normalizeWalletTopUpAmountCents,
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
  const before = Math.floor(Date.now() / 1000);
  const params = buildParams();
  const after = Math.floor(Date.now() / 1000);

  assert.equal(params.mode, 'payment');
  assert.equal(params.payment_method_types, undefined);
  assert.equal(typeof params.expires_at, 'number');
  assert.ok(params.expires_at >= before + 30 * 60);
  assert.ok(params.expires_at <= after + 31 * 60);
  assert.equal(params.success_url, 'https://maxvideoai.com/billing?status=success');
  assert.equal(params.cancel_url, 'https://maxvideoai.com/billing?status=cancelled');
  assert.equal(params.ui_mode, undefined);
  assert.equal(params.return_url, undefined);
  assert.equal(params.billing_address_collection, 'auto');
  assert.equal(params.shipping_address_collection, undefined);
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

test('wallet top-up amount normalization rejects malformed amounts before Stripe', () => {
  assert.equal(normalizeWalletTopUpAmountCents(undefined), 1000);
  assert.equal(normalizeWalletTopUpAmountCents(2500.4), 2500);
  assert.equal(normalizeWalletTopUpAmountCents(500), 1000);
  assert.equal(normalizeWalletTopUpAmountCents('not-a-number'), null);
  assert.equal(normalizeWalletTopUpAmountCents(Number.NaN), null);
});

test('wallet top-up Checkout can attach a Stripe Customer and update supported billing fields', () => {
  const params = buildParams({
    customer: 'cus_123',
    customerUpdate: {
      address: 'auto',
      name: 'auto',
    },
  });

  assert.equal(params.customer, 'cus_123');
  assert.deepEqual(params.customer_update, {
    address: 'auto',
    name: 'auto',
  });
  assert.equal('invoice_creation' in params, false);
});

test('wallet top-up Checkout omits customer update without a Stripe Customer', () => {
  const params = buildParams({
    customerUpdate: {
      address: 'auto',
      name: 'auto',
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

test('wallet top-up Checkout does not block card brands by default', () => {
  const params = buildParams();

  assert.equal(params.payment_method_options, undefined);
});

test('wallet top-up Checkout can block American Express for first top-ups', () => {
  const params = buildParams({ blockAmexCards: true });
  const paymentMethodOptions = params.payment_method_options as {
    card?: { restrictions?: { brands_blocked?: string[] } };
  };

  assert.deepEqual(paymentMethodOptions.card?.restrictions?.brands_blocked, ['american_express']);
});

test('wallet top-up Checkout does not send card brand restrictions for Elements sessions', () => {
  const params = buildParams({
    blockAmexCards: true,
    checkoutUiMode: 'elements',
    successUrl: undefined,
    cancelUrl: undefined,
    returnUrl: 'https://maxvideoai.com/billing?status=success',
  });

  assert.equal(params.ui_mode, 'elements');
  assert.equal(params.payment_method_options, undefined);
});

test('wallet top-up Checkout applies first top-up Amex blocking at the server boundary', () => {
  const routeSource = fs.readFileSync(path.join(process.cwd(), 'frontend/app/api/wallet/route.ts'), 'utf8');
  const checkoutSource = fs.readFileSync(path.join(process.cwd(), 'frontend/src/lib/stripe-checkout.ts'), 'utf8');
  const envSource = fs.readFileSync(path.join(process.cwd(), 'frontend/src/lib/env.ts'), 'utf8');

  assert.match(routeSource, /async function hasCompletedWalletTopUp\(userId: string\)/);
  assert.match(routeSource, /first_wallet_topup: String\(isFirstTopUp\)/);
  assert.match(routeSource, /STRIPE_CHECKOUT_BRAND_RESTRICTIONS_API_VERSION/);
  assert.match(routeSource, /shouldBlockAmexForCheckoutSession = isFirstTopUp && !isExpressCheckoutTopUp/);
  assert.match(routeSource, /blockAmexCards: shouldBlockAmexForCheckoutSession/);
  assert.match(routeSource, /amex_block_required/);
  assert.match(routeSource, /brands_blocked/);
  assert.match(routeSource, /amexBlocked: shouldBlockAmexForCheckoutSession/);
  assert.doesNotMatch(routeSource, /STRIPE_BLOCK_AMEX/);
  assert.match(checkoutSource, /american_express/);
  assert.match(checkoutSource, /brands_blocked/);
  assert.match(checkoutSource, /blockAmexCards/);
  assert.match(checkoutSource, /checkoutUiMode !== 'elements'/);
  assert.doesNotMatch(envSource, /STRIPE_BLOCK_AMEX/);
  assert.doesNotMatch(routeSource, /express_checkout_unavailable_for_first_topup/);
});

test('wallet route honors bearer auth tokens sent by billing clients', () => {
  const routeSource = fs.readFileSync(path.join(process.cwd(), 'frontend/app/api/wallet/route.ts'), 'utf8');

  assert.match(routeSource, /getRouteAuthContext/);
  assert.match(routeSource, /async function resolveAuthenticatedUser\(req: NextRequest\)/);
  assert.match(routeSource, /getRouteAuthContext\(req\)/);
  assert.match(routeSource, /const userId = await resolveAuthenticatedUser\(req\);/);
});
