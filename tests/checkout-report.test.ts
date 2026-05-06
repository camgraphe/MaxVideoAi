import assert from 'node:assert/strict';

import { classifyCheckoutReportStatus } from '../frontend/server/checkout-report';

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
