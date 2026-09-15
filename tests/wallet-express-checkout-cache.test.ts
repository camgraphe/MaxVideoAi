import assert from 'node:assert/strict';

import { buildWalletExpressCheckoutRequestKey, createWalletExpressSessionCache } from '../frontend/app/(core)/billing/_lib/express-checkout-session-cache';

assert.equal(
  buildWalletExpressCheckoutRequestKey({
    userId: 'user_123',
    amountCents: 1000,
    currency: 'eur',
    locale: 'fr',
    captchaToken: null,
    attributionKey: 'journey-a',
  }),
  buildWalletExpressCheckoutRequestKey({
    userId: 'user_123',
    amountCents: 1000,
    currency: 'EUR',
    locale: 'fr',
    captchaToken: null,
    attributionKey: 'journey-a',
  }),
  'the cache key must be stable across currency casing'
);

assert.equal(
  buildWalletExpressCheckoutRequestKey({
    userId: 'user_123',
    amountCents: 1000,
    currency: 'EUR',
    locale: 'fr',
    captchaToken: null,
    attributionKey: 'journey-a',
  }),
  buildWalletExpressCheckoutRequestKey({
    userId: 'user_123',
    amountCents: 1000,
    currency: 'EUR',
    locale: 'fr',
    captchaToken: 'turnstile-token',
    attributionKey: 'journey-a',
  }),
  'CAPTCHA is a creation credential, not the identity of an already created session'
);

assert.notEqual(
  buildWalletExpressCheckoutRequestKey({
    userId: 'user_123',
    amountCents: 1000,
    currency: 'EUR',
    locale: 'fr',
    captchaToken: null,
    attributionKey: 'journey-a',
  }),
  buildWalletExpressCheckoutRequestKey({
    userId: 'user_123',
    amountCents: 1000,
    currency: 'EUR',
    locale: 'fr',
    captchaToken: null,
    attributionKey: 'journey-b',
  }),
  'distinct attribution projections must use distinct cache keys'
);

let now = 1_000;
const sessions = createWalletExpressSessionCache(() => now);
const session = { checkoutAttemptId: 1, clientSecret: 'test-secret', sessionId: 'cs_test' };
sessions.set('user-a:1000:EUR', session, 2_000);
sessions.set('user-a:2500:EUR', { ...session, sessionId: 'cs_other' }, 3_000);
assert.equal(sessions.get('user-a:1000:EUR')?.sessionId, 'cs_test', 'returning to an amount reuses its unexpired session');
assert.equal(sessions.get('user-b:1000:EUR'), null, 'cache cannot cross account identities');
assert.equal(sessions.get('user-a:1000:USD'), null, 'cache cannot cross charge currencies');
now = 2_000;
assert.equal(sessions.get('user-a:1000:EUR'), null, 'expired sessions are retired');
assert.equal(sessions.get('user-a:2500:EUR')?.sessionId, 'cs_other');
