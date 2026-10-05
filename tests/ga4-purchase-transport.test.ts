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

test('a fully attributed purchase stays within 25 parameters and preserves payment and acquisition fields', async (t) => {
  const savedFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = savedFetch; });
  process.env.GA4_MEASUREMENT_ID = 'G-AUDITTEST';
  process.env.GA4_API_SECRET = 'audit-dummy';
  const { buildTopupAttributionGa4Params } = await import('../frontend/server/wallet-attribution');
  const { sendGa4Event } = await import('../frontend/src/server/ga4');
  const attribution = buildTopupAttributionGa4Params({
    journey_id: '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9', acquisition_cohort: '2026-W41',
    first_touch_source: 'google', first_touch_medium: 'cpc', first_touch_campaign: 'ads_readiness', first_touch_content: 'studio_search',
    last_touch_source: 'google', last_touch_medium: 'cpc', last_touch_campaign: 'ads_readiness', last_touch_content: 'studio_search',
  });
  const redundant = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`diagnostic_${index}`, index]));
  let params: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    params = JSON.parse(String(init?.body)).events[0].params;
    return new Response(null, { status: 204 });
  };
  assert.equal(await sendGa4Event({
    name: 'purchase', clientId: '123456789.987654321', sessionId: '1788255901',
    params: {
      ...redundant, ...attribution, value: 23, currency: 'EUR', transaction_id: 'fixture-confirmed-payment',
      is_first_recorded_external_payment: true, is_first_wallet_topup: false, payment_provider: 'stripe', payment_flow: 'checkout',
      item_category: 'wallet_topup', topup_amount_cents: 2500, settlement_currency: 'EUR', topup_tier_id: 'usd_25',
    },
  }), true);
  assert.ok(Object.keys(params).length <= 25);
  for (const [key, expected] of Object.entries({
    session_id: '1788255901', engagement_time_msec: 1, transaction_id: 'fixture-confirmed-payment', value: 23, currency: 'EUR',
    is_first_recorded_external_payment: true, is_first_wallet_topup: false, payment_provider: 'stripe', payment_flow: 'checkout', item_category: 'wallet_topup',
    ...attribution,
  })) assert.equal(params[key], expected, key);
});
