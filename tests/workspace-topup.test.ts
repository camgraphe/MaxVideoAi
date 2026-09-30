import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWorkspaceTopupAnalyticsPayload,
  formatWorkspaceTopupPaymentAmount,
  getSufficientTopUpAmountCents,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-topup';

test('Workspace top-up rounds shortfall up and enforces the ten-dollar minimum', () => {
  assert.equal(getSufficientTopUpAmountCents(undefined), 1000);
  assert.equal(getSufficientTopUpAmountCents(1), 1000);
  assert.equal(getSufficientTopUpAmountCents(744), 1000);
  assert.equal(getSufficientTopUpAmountCents(1234), 1300);
  assert.equal(getSufficientTopUpAmountCents(2500), 2500);
});

test('Workspace payment review formats the local quote and records its charge currency', () => {
  assert.equal(typeof formatWorkspaceTopupPaymentAmount, 'function');
  assert.equal(formatWorkspaceTopupPaymentAmount(920, 'EUR', 'fr').replace(/\s/g, ' '), '9,20 €');
  assert.equal(buildWorkspaceTopupAnalyticsPayload(1000, 'EUR').charge_currency, 'EUR');
});

test('Workspace top-up analytics contains conversion fields and no personal content', () => {
  assert.deepEqual(buildWorkspaceTopupAnalyticsPayload(1300), {
    source: 'workspace',
    route_family: 'workspace',
    payment_provider: 'stripe',
    payment_flow: 'checkout',
    charge_currency: 'USD',
    wallet_amount_usd: 13,
    wallet_amount_cents: 1300,
    credits_amount: 13,
    topup_amount_usd: 13,
    topup_amount_cents: 1300,
  });
});
