import assert from 'node:assert/strict';

import { buildWalletExpressCheckoutRequestKey } from '../frontend/app/(core)/billing/_lib/express-checkout-session-cache';

assert.equal(
  buildWalletExpressCheckoutRequestKey({
    userId: 'user_123',
    amountCents: 1000,
    currency: 'eur',
    locale: 'fr',
    captchaToken: null,
  }),
  buildWalletExpressCheckoutRequestKey({
    userId: 'user_123',
    amountCents: 1000,
    currency: 'EUR',
    locale: 'fr',
    captchaToken: null,
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
  }),
  buildWalletExpressCheckoutRequestKey({
    userId: 'user_123',
    amountCents: 1000,
    currency: 'EUR',
    locale: 'fr',
    captchaToken: 'turnstile-token',
  }),
  'a solved captcha must use a distinct cache key from the pre-captcha request'
);
