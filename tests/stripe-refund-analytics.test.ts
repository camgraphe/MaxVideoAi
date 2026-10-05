import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';

test('test-mode refunds never reach the commercial GA4 collector even when consent metadata is granted', async (t) => {
  const saved = { measurement: process.env.GA4_MEASUREMENT_ID, secret: process.env.GA4_API_SECRET, fetch: globalThis.fetch };
  t.after(() => {
    if (saved.measurement === undefined) delete process.env.GA4_MEASUREMENT_ID;
    else process.env.GA4_MEASUREMENT_ID = saved.measurement;
    if (saved.secret === undefined) delete process.env.GA4_API_SECRET;
    else process.env.GA4_API_SECRET = saved.secret;
    globalThis.fetch = saved.fetch;
  });
  process.env.GA4_MEASUREMENT_ID = 'G-LOCALTEST';
  process.env.GA4_API_SECRET = 'local-dummy';
  const { handleChargeRefunded } = await import('../frontend/app/api/stripe/webhook/_lib/stripe-webhook-refunds');
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; return new Response(null, { status: 204 }); };
  const event = { data: { object: {
    id: 'ch_test_fixture', livemode: false, amount_refunded: 1000, currency: 'usd',
    metadata: { kind: 'topup', user_id: 'customer', analytics_consent: 'granted', ga_client_id: '111.222' },
  } } } as unknown as Stripe.Event;
  await handleChargeRefunded(event, {} as Stripe);
  assert.equal(requests, 0);
});
