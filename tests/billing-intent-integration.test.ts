import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const clientSource = readFileSync('frontend/app/(core)/billing/_components/BillingClient.tsx', 'utf8');
const selectionSource = readFileSync(
  'frontend/app/(core)/billing/_hooks/useBillingTopupSelection.ts',
  'utf8'
);
const checkoutReturnSource = readFileSync(
  'frontend/app/(core)/billing/_hooks/useBillingCheckoutReturnToast.ts',
  'utf8'
);

test('billing hydrates selection from the validated URL intent', () => {
  assert.match(clientSource, /useSearchParams\(\)/);
  assert.match(clientSource, /parseBillingIntent\(searchParams\)/);
  assert.match(clientSource, /initialTopupCents:\s*billingIntent\.amountCents/);
  assert.match(selectionSource, /initialTopupCents\?: number/);
  assert.match(selectionSource, /setSelectedTopupCents\(initialSelection\.selectedTopupCents\)/);
});

test('billing auth gate carries the current amount in a canonical return target', () => {
  assert.match(clientSource, /buildBillingIntentTarget\(\{/);
  assert.match(clientSource, /amountCents:\s*selectedTopupCents/);
  assert.match(clientSource, /currency:\s*'USD'/);
  assert.doesNotMatch(clientSource, /const loginRedirectTarget = pathname \|\| '\/billing'/);
});

test('hosted checkout return restores the amount before cleaning the return query', () => {
  assert.match(checkoutReturnSource, /onAmountReturned:\s*\(amountCents: number \| null\) => void/);
  assert.match(checkoutReturnSource, /onAmountReturned\(parsedAmountCents\)/);
  assert.match(selectionSource, /createReturnedTopupSelection/);
  assert.match(selectionSource, /restoreTopupSelection/);
  assert.match(clientSource, /onAmountReturned:\s*restoreTopupSelection/);
});
