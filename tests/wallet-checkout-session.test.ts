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
  assert.deepEqual(params.invoice_creation, { enabled: true });
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
  assert.deepEqual(params.invoice_creation, { enabled: true });
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
  assert.deepEqual(params.invoice_creation, { enabled: true });
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
  assert.deepEqual(params.invoice_creation, { enabled: true });
});

test('first and returning top-ups share unrestricted card acceptance and dynamic methods in both UIs', () => {
  for (const checkoutUiMode of ['hosted', 'elements'] as const) {
    for (const firstTopUp of [true, false]) {
      const params = buildParams({
        checkoutUiMode,
        returnUrl: 'https://maxvideoai.com/billing?status=success',
        sessionMetadata: { kind: 'topup', first_wallet_topup: String(firstTopUp) },
      });
      assert.equal(params.payment_method_options, undefined);
      assert.equal(params.payment_method_types, undefined);
      assert.equal(params.metadata?.first_wallet_topup, String(firstTopUp));
    }
  }
});

test('wallet top-up accepts all card brands while retaining first-purchase fraud controls', () => {
  const routeSource = fs.readFileSync(path.join(process.cwd(), 'frontend/app/api/wallet/route.ts'), 'utf8');
  const checkoutSource = fs.readFileSync(path.join(process.cwd(), 'frontend/src/lib/stripe-checkout.ts'), 'utf8');

  assert.match(routeSource, /async function hasCompletedWalletTopUp\(userId: string\)/);
  assert.match(routeSource, /first_wallet_topup: String\(isFirstTopUp\)/);
  assert.match(routeSource, /STRIPE_HOSTED_CHECKOUT_API_VERSION = '2025-02-24.acacia'/);
  assert.match(routeSource, /await evaluateWalletCheckoutGuard\(/);
  assert.match(routeSource, /checkoutGuard.action === 'captcha_required'/);
  assert.match(routeSource, /checkoutGuard.action === 'rate_limited'/);
  assert.match(routeSource, /checkout_captcha_passed: String\(checkoutGuard.captchaPassed\)/);
  assert.doesNotMatch(routeSource + checkoutSource, /american_express|brands_blocked|blockAmexCards|amex_block/);
  assert.doesNotMatch(routeSource, /express_checkout_unavailable_for_first_topup/);
});

test('wallet route honors bearer auth tokens sent by billing clients', () => {
  const routeSource = fs.readFileSync(path.join(process.cwd(), 'frontend/app/api/wallet/route.ts'), 'utf8');

  assert.match(routeSource, /getRouteAuthContext/);
  assert.match(routeSource, /async function resolveAuthenticatedUser\(req: NextRequest\)/);
  assert.match(routeSource, /getRouteAuthContext\(req\)/);
  assert.match(routeSource, /const userId = await resolveAuthenticatedUser\(req\);/);
});

test('wallet route validates and propagates consented journey attribution', () => {
  const routeSource = fs.readFileSync(path.join(process.cwd(), 'frontend/app/api/wallet/route.ts'), 'utf8');

  assert.match(routeSource, /normalizeWalletAttribution\(body\.analyticsJourney, analyticsConsentGranted\)/);
  assert.match(routeSource, /buildWalletAttributionMetadata/);
  assert.match(routeSource, /buildCheckoutAttemptAttributionMetadata/);
  assert.match(routeSource, /attribution: walletAttribution/);
  assert.match(routeSource, /resolveWalletGa4CheckoutContext/);
  assert.match(routeSource, /Object\.assign\(sessionMetadata, walletGa4Context\.metadata\)/);
  assert.equal((routeSource.match(/hasAnalyticsConsent\(req\)/g) ?? []).length, 1);
});

test('wallet GET delegates aggregated receipt reads instead of returning the ledger', () => {
  const routeSource = fs.readFileSync(path.join(process.cwd(), 'frontend/app/api/wallet/route.ts'), 'utf8');
  const summarySource = fs.readFileSync(path.join(process.cwd(), 'frontend/src/server/wallet-summary.ts'), 'utf8');

  assert.match(routeSource, /getWalletSummary/);
  assert.match(summarySource, /SUM\(CASE WHEN type = 'topup'/);
  assert.match(summarySource, /SUM\(CASE WHEN type = 'charge'/);
  assert.match(summarySource, /SUM\(CASE WHEN type = 'refund'/);
  assert.match(summarySource, /STRING_AGG\(DISTINCT LOWER\(currency\)/);
  assert.doesNotMatch(summarySource, /SELECT type, amount_cents, currency FROM app_receipts WHERE user_id = \$1/);
});
