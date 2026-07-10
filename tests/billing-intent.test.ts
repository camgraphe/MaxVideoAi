import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_BILLING_INTENT,
  buildBillingIntentTarget,
  parseBillingIntent,
} from '../frontend/app/(core)/billing/_lib/billing-intent';

test('billing intent accepts a valid USD amount in integer cents', () => {
  const parsed = parseBillingIntent(new URLSearchParams('amount=2500&currency=usd'));
  assert.deepEqual(parsed, { amountCents: 2500, currency: 'USD', isExplicit: true });
});

test('billing intent falls back for missing or invalid values', () => {
  const invalidQueries = [
    '',
    'amount=999&currency=USD',
    'amount=10.5&currency=USD',
    'amount=-2500&currency=USD',
    `amount=${Number.MAX_SAFE_INTEGER + 1}&currency=USD`,
    'amount=2500&currency=EUR',
  ];

  for (const query of invalidQueries) {
    assert.deepEqual(parseBillingIntent(new URLSearchParams(query)), DEFAULT_BILLING_INTENT, query);
  }
});

test('billing target serialization is deterministic and allowlisted', () => {
  assert.equal(
    buildBillingIntentTarget({ amountCents: 2500, currency: 'USD' }),
    '/billing?amount=2500&currency=USD'
  );
  assert.equal(
    buildBillingIntentTarget({ amountCents: 2500, currency: 'EUR' }),
    '/billing?amount=1000&currency=USD'
  );
});
