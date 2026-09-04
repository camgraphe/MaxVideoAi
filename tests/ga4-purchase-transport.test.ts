import assert from 'node:assert/strict';
import test from 'node:test';

test('purchase transport preserves the exact consented checkout client and session IDs', async (t) => {
  const savedMeasurementId = process.env.GA4_MEASUREMENT_ID;
  const savedSecret = process.env.GA4_API_SECRET;
  const savedFetch = globalThis.fetch;
  t.after(() => {
    if (savedMeasurementId === undefined) delete process.env.GA4_MEASUREMENT_ID;
    else process.env.GA4_MEASUREMENT_ID = savedMeasurementId;
    if (savedSecret === undefined) delete process.env.GA4_API_SECRET;
    else process.env.GA4_API_SECRET = savedSecret;
    globalThis.fetch = savedFetch;
  });
  process.env.GA4_MEASUREMENT_ID = 'G-AUDITTEST';
  process.env.GA4_API_SECRET = 'audit-dummy';
  const { readGa4CheckoutContext } = await import('../frontend/lib/analytics/ga-session-browser');
  const { resolveWalletGa4CheckoutContext } = await import('../frontend/server/wallet-ga4-session');
  const { sendGa4Event } = await import('../frontend/src/server/ga4');
  const browser = await readGa4CheckoutContext({
    measurementId: 'G-AUDITTEST',
    gtag: (_command, _target, field, callback) => callback(field === 'client_id' ? '123456789.987654321' : '1788255901'),
  });
  const checkout = resolveWalletGa4CheckoutContext({
    analyticsConsentGranted: true,
    gaClientCookie: null,
    gaClientId: browser.clientId,
    gaSessionId: browser.sessionId,
  });
  let requestCount = 0;
  globalThis.fetch = async (input, init) => {
    requestCount += 1;
    assert.equal(new URL(String(input)).searchParams.get('measurement_id'), 'G-AUDITTEST');
    assert.equal(init?.method, 'POST');
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.client_id, '123456789.987654321');
    assert.equal(payload.user_id, 'test-user');
    assert.deepEqual(payload.events, [{
      name: 'purchase',
      params: { value: 25, currency: 'EUR', transaction_id: 'fixture-purchase', session_id: '1788255901', engagement_time_msec: 1 },
    }]);
    return new Response(null, { status: 204 });
  };
  assert.equal(await sendGa4Event({
    name: 'purchase',
    clientId: checkout.metadata.ga_client_id,
    sessionId: checkout.metadata.ga_session_id,
    userId: 'test-user',
    params: { value: 25, currency: 'EUR', transaction_id: 'fixture-purchase' },
  }), true);
  assert.equal(requestCount, 1);
});
