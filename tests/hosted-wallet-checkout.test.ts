import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHostedCheckoutSubmissionGuard,
  requestHostedWalletCheckout,
  type HostedWalletCheckoutInput,
} from '../frontend/lib/wallet/hosted-checkout';

const validInput: HostedWalletCheckoutInput = {
  amountCents: 2500,
  currency: 'EUR',
  locale: 'fr',
  accessToken: 'access-token',
  captchaToken: 'captcha-token',
};

test('hosted wallet request preserves amount, settlement currency, locale, auth, and captcha', async () => {
  let capturedInput: RequestInfo | URL | null = null;
  let capturedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    capturedInput = input;
    capturedInit = init;
    return new Response(JSON.stringify({
      id: 'cs_test_123',
      checkoutAttemptId: 42,
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const result = await requestHostedWalletCheckout(validInput, fetchImpl);

  assert.equal(capturedInput, '/api/wallet');
  assert.equal(capturedInit?.method, 'POST');
  assert.equal(capturedInit?.credentials, 'include');
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get('Content-Type'), 'application/json');
  assert.equal(headers.get('Authorization'), 'Bearer access-token');
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    amountCents: 2500,
    currency: 'eur',
    locale: 'fr',
    captchaToken: 'captcha-token',
  });
  assert.deepEqual(result, {
    kind: 'ready',
    url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    sessionId: 'cs_test_123',
    checkoutAttemptId: 42,
  });
});

test('hosted wallet response supports Stripe session fallback', async () => {
  const result = await requestHostedWalletCheckout(validInput, async () =>
    new Response(JSON.stringify({ id: 'cs_test_fallback', checkoutAttemptId: 7 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  assert.deepEqual(result, {
    kind: 'ready',
    url: null,
    sessionId: 'cs_test_fallback',
    checkoutAttemptId: 7,
  });
});

test('hosted wallet response classifies captcha and rate limiting', async () => {
  const captcha = await requestHostedWalletCheckout(validInput, async () =>
    new Response(JSON.stringify({ captchaRequired: true }), { status: 403 })
  );
  const rateLimited = await requestHostedWalletCheckout(validInput, async () =>
    new Response(JSON.stringify({ retryAfterSeconds: 125 }), { status: 429 })
  );
  assert.deepEqual(captcha, { kind: 'captcha_required' });
  assert.deepEqual(rateLimited, { kind: 'rate_limited', retryAfterSeconds: 125 });
});

test('hosted wallet response rejects malformed success and normalizes failures', async () => {
  const malformed = await requestHostedWalletCheckout(validInput, async () =>
    new Response(JSON.stringify({ ok: true }), { status: 200 })
  );
  const unauthorized = await requestHostedWalletCheckout(validInput, async () =>
    new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  );
  const network = await requestHostedWalletCheckout(validInput, async () => {
    throw new TypeError('offline');
  });
  assert.deepEqual(malformed, { kind: 'failed', reason: 'unknown', checkoutAttemptId: null });
  assert.deepEqual(unauthorized, { kind: 'failed', reason: 'authentication', checkoutAttemptId: null });
  assert.deepEqual(network, { kind: 'failed', reason: 'network', checkoutAttemptId: null });
});

test('hosted wallet request rejects invalid local amount and currency without fetching', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return new Response('{}', { status: 200 });
  };
  const invalidAmount = await requestHostedWalletCheckout({ ...validInput, amountCents: 999 }, fetchImpl);
  const invalidCurrency = await requestHostedWalletCheckout({ ...validInput, currency: 'EURO' }, fetchImpl);
  assert.deepEqual(invalidAmount, { kind: 'failed', reason: 'validation', checkoutAttemptId: null });
  assert.deepEqual(invalidCurrency, { kind: 'failed', reason: 'validation', checkoutAttemptId: null });
  assert.equal(calls, 0);
});

test('hosted wallet submission guard rejects a duplicate until the active attempt finishes', () => {
  const guard = createHostedCheckoutSubmissionGuard();
  assert.equal(guard.tryStart(), true);
  assert.equal(guard.tryStart(), false);
  guard.finish();
  assert.equal(guard.tryStart(), true);
});
