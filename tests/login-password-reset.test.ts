import assert from 'node:assert/strict';
import test from 'node:test';
import { requestPasswordReset } from '../frontend/app/(core)/login/_lib/login-password-reset';

test('password recovery reports success only when the provider accepts the request', async () => {
  assert.equal(await requestPasswordReset(async () => ({ error: null })), 'sent');
});

test('SMTP failures serialized as empty JSON become an unavailable result', async () => {
  assert.equal(await requestPasswordReset(async () => ({
    error: { message: '{}', status: 500, name: 'AuthRetryableFetchError' },
  })), 'unavailable');
});

test('password recovery handles rejected network and client initialization promises', async () => {
  for (const error of [new TypeError('Failed to fetch'), new Error('Failed to load module'), {}]) {
    assert.equal(await requestPasswordReset(async () => { throw error; }), 'unavailable');
  }
});

test('password recovery distinguishes rate limits from delivery failures', async () => {
  assert.equal(await requestPasswordReset(async () => ({ error: { status: 429 } })), 'rateLimited');
  assert.equal(await requestPasswordReset(async () => ({ error: { code: 'over_email_send_rate_limit' } })), 'rateLimited');
});
