import assert from 'node:assert/strict';

import { buildWalletExpressCheckoutRequestKey } from '../frontend/app/(core)/billing/_lib/express-checkout-session-cache';

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
    captchaToken: 'turnstile-token',
    attributionKey: 'journey-a',
  }),
  'a solved captcha must use a distinct cache key from the pre-captcha request'
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
