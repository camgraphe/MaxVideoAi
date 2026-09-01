import assert from 'node:assert/strict';
import test from 'node:test';

import { readGa4SessionId } from '../frontend/lib/analytics/ga-session-browser';
import { normalizeGa4SessionId } from '../frontend/lib/analytics/ga-session-id';
import { resolveWalletGa4CheckoutContext } from '../frontend/server/wallet-ga4-session';

test('GA4 session IDs are bounded positive integer strings', () => {
  assert.equal(normalizeGa4SessionId(' 1788255901 '), '1788255901');
  assert.equal(normalizeGa4SessionId(1788255901), '1788255901');
  assert.equal(normalizeGa4SessionId('0001788255901'), '1788255901');
  assert.equal(normalizeGa4SessionId('0'), null);
  assert.equal(normalizeGa4SessionId('-1'), null);
  assert.equal(normalizeGa4SessionId('1788255901.2'), null);
  assert.equal(normalizeGa4SessionId('1'.repeat(21)), null);
});

test('browser GA4 session lookup uses the configured measurement target', async () => {
  const calls: unknown[][] = [];
  const sessionId = await readGa4SessionId({
    measurementId: 'G-TEST123',
    timeoutMs: 50,
    gtag: (...args) => {
      calls.push(args);
      args[3]('1788255901');
    },
  });

  assert.equal(sessionId, '1788255901');
  assert.deepEqual(calls[0]?.slice(0, 3), ['get', 'G-TEST123', 'session_id']);
});

test('browser GA4 session lookup fails open when the tag is unavailable', async () => {
  assert.equal(await readGa4SessionId({ measurementId: 'G-TEST123', gtag: null }), null);
});

test('wallet checkout keeps GA4 identifiers only with server-confirmed consent', () => {
  assert.deepEqual(
    resolveWalletGa4CheckoutContext({
      analyticsConsentGranted: true,
      gaClientCookie: 'GA1.1.123456789.987654321',
      gaSessionId: '1788255901',
    }),
    {
      metadata: {
        ga_client_id: '123456789.987654321',
        ga_session_id: '1788255901',
      },
      sessionId: '1788255901',
    },
  );
  assert.deepEqual(
    resolveWalletGa4CheckoutContext({
      analyticsConsentGranted: false,
      gaClientCookie: 'GA1.1.123456789.987654321',
      gaSessionId: '1788255901',
    }),
    { metadata: {}, sessionId: null },
  );
});
