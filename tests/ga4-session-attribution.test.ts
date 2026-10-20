import assert from 'node:assert/strict';
import test from 'node:test';

import { readGa4CheckoutContext, readGa4ClientId, readGa4SessionId } from '../frontend/lib/analytics/ga-session-browser';
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

test('browser GA4 client lookup returns the exact Measurement Protocol client ID', async () => {
  const calls: unknown[][] = [];
  const clientId = await readGa4ClientId({
    measurementId: 'G-TEST123',
    timeoutMs: 50,
    gtag: (...args) => {
      calls.push(args);
      args[3]('123456789.987654321');
    },
  });

  assert.equal(clientId, '123456789.987654321');
  assert.deepEqual(calls[0]?.slice(0, 3), ['get', 'G-TEST123', 'client_id']);
});

test('browser checkout context reads client and session IDs from the same tag target', async () => {
  const context = await readGa4CheckoutContext({
    measurementId: 'G-TEST123',
    timeoutMs: 50,
    gtag: (...args) => {
      args[3](args[2] === 'client_id' ? '123456789.987654321' : '1788255901');
    },
  });

  assert.deepEqual(context, {
    clientId: '123456789.987654321',
    sessionId: '1788255901',
  });
});

test('browser GA4 session lookup fails open when the tag is unavailable', async () => {
  assert.equal(await readGa4SessionId({ measurementId: 'G-TEST123', gtag: null }), null);
});

test('checkout waits within its existing budget for a late tag without losing session linkage', async () => {
  const started = Date.now();
  const context = await readGa4CheckoutContext({
    measurementId: 'G-TEST123',
    timeoutMs: 100,
    getGtag: () => Date.now() - started < 15 ? null : (_command, _id, field, callback) =>
      callback(field === 'client_id' ? '123456789.987654321' : '1788255901'),
  });
  assert.equal(context.clientId, '123456789.987654321');
  assert.equal(context.sessionId, '1788255901');
});

test('checkout tag reads stop when consent is absent or withdrawn', async () => {
  let granted = false;
  let calls = 0;
  const getGtag = () => (_command: unknown, _id: unknown, _field: unknown, callback: (value: unknown) => void) => {
    calls++;
    granted = false;
    callback('123456789.987654321');
  };
  assert.deepEqual(await readGa4CheckoutContext({ measurementId: 'G-TEST123', getGtag, canRead: () => granted }), { clientId: null, sessionId: null });
  assert.equal(calls, 0);
  granted = true;
  assert.deepEqual(await readGa4CheckoutContext({ measurementId: 'G-TEST123', getGtag, canRead: () => granted }), { clientId: null, sessionId: null });
});

test('a blocked checkout tag cannot hold the payment longer than the bounded lookup budget', async () => {
  const started = Date.now();
  const diagnostics: string[] = [];
  assert.deepEqual(await readGa4CheckoutContext({
    measurementId: 'G-TEST123', timeoutMs: 30, getGtag: () => null,
    onDiagnostic: status => diagnostics.push(status),
  }), { clientId: null, sessionId: null });
  assert.ok(Date.now() - started < 250);
  assert.deepEqual(diagnostics, ['tag_unavailable']);
});

test('wallet checkout keeps GA4 identifiers only with server-confirmed consent', () => {
  assert.deepEqual(
    resolveWalletGa4CheckoutContext({
      analyticsConsentGranted: true,
      gaClientCookie: 'GA1.1.123456789.987654321',
      gaClientId: null,
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
      gaClientId: '222222222.333333333',
      gaSessionId: '1788255901',
    }),
    { metadata: {}, sessionId: null },
  );
});

test('wallet checkout prefers the exact browser client ID over the cookie fallback', () => {
  assert.deepEqual(
    resolveWalletGa4CheckoutContext({
      analyticsConsentGranted: true,
      gaClientCookie: null,
      gaClientId: '222222222.333333333',
      gaSessionId: '1788255901',
    }),
    {
      metadata: {
        ga_client_id: '222222222.333333333',
        ga_session_id: '1788255901',
      },
      sessionId: '1788255901',
    },
  );
});
