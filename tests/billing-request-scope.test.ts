import assert from 'node:assert/strict';
import test from 'node:test';
import { createBillingRequestScope } from '../frontend/app/(core)/billing/_lib/billing-request-scope';

test('a newer billing request invalidates an older request for the same account', () => {
  const scope = createBillingRequestScope();
  const first = scope.begin('account-a');
  const second = scope.begin('account-a');

  assert.equal(scope.isCurrent(first), false);
  assert.equal(scope.isCurrent(second), true);
});

test('starting a request for another account rejects the previous account response', () => {
  const scope = createBillingRequestScope();
  const accountA = scope.begin('account-a');
  const accountB = scope.begin('account-b');

  assert.equal(scope.isCurrent(accountA), false);
  assert.equal(scope.isCurrent(accountB), true);
});

test('invalidating a billing request scope rejects every issued token', () => {
  const scope = createBillingRequestScope();
  const active = scope.begin('account-a');

  scope.invalidate();

  assert.equal(scope.isCurrent(active), false);
});
