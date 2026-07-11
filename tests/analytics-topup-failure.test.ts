import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { classifyTopupFailure } from '../frontend/lib/analytics/topup-failure';

test('top-up failures collapse free-form reasons into a stable allowlist', () => {
  assert.equal(classifyTopupFailure('authentication'), 'authentication');
  assert.equal(classifyTopupFailure('401 Unauthorized for customer@example.com'), 'authentication');
  assert.equal(classifyTopupFailure('Invalid amount: 4'), 'validation');
  assert.equal(classifyTopupFailure('Failed to fetch while offline'), 'network');
  assert.equal(classifyTopupFailure('Stripe card declined for customer@example.com'), 'stripe');
  assert.equal(classifyTopupFailure('customer@example.com said something unexpected'), 'unknown');
  assert.equal(classifyTopupFailure(undefined), 'unknown');
});

test('billing and workspace top-up failures emit only the bounded category', () => {
  const sources = [
    readFileSync('frontend/app/(core)/billing/_hooks/useBillingTopupAnalytics.ts', 'utf8'),
    readFileSync('frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate.ts', 'utf8'),
  ];

  for (const source of sources) {
    assert.match(source, /failure_category:\s*classifyTopupFailure\(reason\)/);
    assert.doesNotMatch(source, /error_message/);
  }
});
