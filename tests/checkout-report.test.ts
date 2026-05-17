import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { canExpireCheckoutSessionFromReport, classifyCheckoutReportStatus } from '../frontend/server/checkout-report';

assert.equal(
  classifyCheckoutReportStatus({
    outcome: 'session_created',
    hasReceipt: true,
    createdAtMs: Date.parse('2026-05-06T10:00:00.000Z'),
    nowMs: Date.parse('2026-05-06T10:05:00.000Z'),
  }),
  'passed',
  'a Checkout session linked to a wallet receipt counts as passed'
);

assert.equal(
  classifyCheckoutReportStatus({
    outcome: 'session_created',
    hasReceipt: false,
    createdAtMs: Date.parse('2026-05-06T10:00:00.000Z'),
    nowMs: Date.parse('2026-05-06T10:31:00.000Z'),
  }),
  'abandoned',
  'a Checkout session without a receipt after 30 minutes counts as abandoned'
);

assert.equal(
  classifyCheckoutReportStatus({
    outcome: 'rate_limited',
    hasReceipt: false,
    createdAtMs: Date.parse('2026-05-06T10:00:00.000Z'),
    nowMs: Date.parse('2026-05-06T10:01:00.000Z'),
  }),
  'blocked',
  'rate limited attempts count as blocked'
);

assert.equal(
  classifyCheckoutReportStatus({
    outcome: 'captcha_required',
    hasReceipt: false,
    createdAtMs: Date.parse('2026-05-06T10:00:00.000Z'),
    nowMs: Date.parse('2026-05-06T10:01:00.000Z'),
  }),
  'challenged',
  'CAPTCHA required attempts count as challenged'
);

assert.equal(
  canExpireCheckoutSessionFromReport({
    hasReceipt: false,
    status: 'open',
    stripeCheckoutSessionId: 'cs_live_open',
  }),
  true,
  'open unpaid report rows with a Stripe session can expose the admin expire action'
);

assert.equal(
  canExpireCheckoutSessionFromReport({
    hasReceipt: false,
    status: 'abandoned',
    stripeCheckoutSessionId: 'cs_live_abandoned',
  }),
  true,
  'abandoned report rows without a receipt can expose the admin expire action'
);

assert.equal(
  canExpireCheckoutSessionFromReport({
    hasReceipt: true,
    status: 'open',
    stripeCheckoutSessionId: 'cs_live_paid',
  }),
  false,
  'receipted Checkout sessions must not expose the admin expire action'
);

const checkoutReportSource = readFileSync('frontend/server/checkout-report.ts', 'utf8');
assert.match(checkoutReportSource, /failedCardAttempts/);
assert.match(checkoutReportSource, /failedCardLimitedSessions/);
assert.match(checkoutReportSource, /stripe_charge_failed/);
assert.match(checkoutReportSource, /canExpireCheckoutSessionFromReport/);

const checkoutReportPageSource = readFileSync('frontend/app/(core)/admin/checkout-report/page.tsx', 'utf8');
assert.match(checkoutReportPageSource, /Card failures/);
assert.match(checkoutReportPageSource, /failedCardAttempts/);
assert.match(checkoutReportPageSource, /CHECKOUT_REPORT_TIME_ZONE = 'Europe\/Paris'/);
assert.match(checkoutReportPageSource, /Time \(Paris\)/);
assert.match(checkoutReportPageSource, /CheckoutSessionExpireButton/);

const expireRouteSource = readFileSync('frontend/app/api/admin/checkout-sessions/expire/route.ts', 'utf8');
assert.match(expireRouteSource, /requireAdmin\(req\)/);
assert.match(expireRouteSource, /expireAdminCheckoutSession/);

const expireHelperSource = readFileSync('frontend/server/admin-checkout-sessions.ts', 'utf8');
assert.match(expireHelperSource, /checkout\.sessions\.expire/);
assert.match(expireHelperSource, /Checkout session already has a wallet top-up receipt/);
assert.match(expireHelperSource, /admin_checkout_session_expired/);
assert.match(expireHelperSource, /already_expired/);
assert.match(expireHelperSource, /logAdminAction/);
