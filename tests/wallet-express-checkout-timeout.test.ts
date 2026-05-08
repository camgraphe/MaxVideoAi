import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  'frontend/app/(core)/billing/_components/WalletExpressCheckout.tsx',
  'utf8'
);

assert.match(
  source,
  /EXPRESS_CHECKOUT_READY_TIMEOUT_MS\s*=\s*10_000/,
  'Express Checkout should have a bounded loading timeout'
);

assert.match(
  source,
  /window\.setTimeout/,
  'Express Checkout should start a client-side timeout while Stripe options load'
);

assert.match(
  source,
  /setStatus\('unavailable'\)/,
  'Express Checkout should leave loading state when the timeout expires'
);

assert.match(
  source,
  /setMessage\((?:labels|labelsRef\.current)\.expressUnavailable\)/,
  'Express Checkout timeout should show the unavailable copy instead of a spinner'
);

assert.match(
  source,
  /clearExpressCheckoutReadyTimeout\(\)/,
  'Express Checkout should clear the loading timeout when Stripe resolves'
);
