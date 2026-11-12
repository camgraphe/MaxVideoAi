import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { parseOpenAIRequestAttribution } from '../frontend/server/openai-conversions-context';
import {
  parseOpenAIAttribution,
  buildOpenAIOrderEvent,
  buildOpenAIRegistrationEvent,
} from '../frontend/lib/analytics/openai-contract';
import { sendOpenAIConversion } from '../frontend/server/openai-conversions-transport';

test('the NextRequest cookie round trip preserves every opaque percent character exactly once', () => {
  const timestamp = Date.now() - 1000;
  const consent = { version: 'policy', timestamp, categories: { analytics: true, ads: true }, source: 'banner' };
  for (const oppref of ['opaque%2Fclick', 'opaque%click', 'opaque%2520click']) {
    const attribution = { oppref, capturedAt: timestamp, consentAt: timestamp, policyVersion: 'policy' };
    const req = new NextRequest('https://maxvideoai.com/api/analytics/openai-registration', {
      headers: {
        Cookie: `mv-consent=${encodeURIComponent(JSON.stringify(consent))}; mvai-openai-click=${encodeURIComponent(JSON.stringify(attribution))}`,
      },
    });
    assert.deepEqual(parseOpenAIRequestAttribution(req, 'policy'), attribution);
    assert.equal(parseOpenAIRequestAttribution(req, 'different-policy'), null);
  }
});

const now = Date.now();
const click = {
  oppref: 'opaque-click_123',
  capturedAt: now - 60_000,
  consentAt: now - 120_000,
  policyVersion: 'fixture-policy',
};

test('click attribution requires both consent categories, a current policy and an unexpired opaque click', () => {
  const raw = JSON.stringify(click);
  assert.deepEqual(parseOpenAIAttribution(raw, { analytics: true, ads: true, version: 'fixture-policy' }, now), click);
  for (const consent of [
    { analytics: true, ads: false, version: 'fixture-policy' },
    { analytics: false, ads: true, version: 'fixture-policy' },
    { analytics: true, ads: true, version: 'old' },
  ]) {
    assert.equal(parseOpenAIAttribution(raw, consent, now), null);
  }
  for (const extra of [
    { capturedAt: now - 31 * 86400_000 },
    { capturedAt: now + 60_000 },
    { oppref: 'email@example.com' },
    { oppref: 'x'.repeat(501) },
  ]) {
    assert.equal(
      parseOpenAIAttribution(
        JSON.stringify({ ...click, ...extra }),
        { analytics: true, ads: true, version: 'fixture-policy' },
        now
      ),
      null
    );
  }
});

test('paid orders use confirmed settlement minor units and reject test mode or missing consent', () => {
  const input = {
    id: 'opaque-event',
    occurredAt: now,
    liveMode: true,
    amountMinor: 2300,
    currency: 'eur',
    attribution: click,
  };
  assert.deepEqual(buildOpenAIOrderEvent(input), {
    id: 'opaque-event',
    type: 'order_created',
    timestamp_ms: now,
    source_url: 'https://maxvideoai.com',
    action_source: 'web',
    oppref: 'opaque-click_123',
    opt_out: true,
    data: { type: 'contents', amount: 2300, currency: 'EUR' },
  });
  for (const extra of [
    { liveMode: false },
    { amountMinor: 0 },
    { amountMinor: 23.5 },
    { currency: 'wallet' },
    { attribution: null },
  ])
    assert.equal(buildOpenAIOrderEvent({ ...input, ...extra }), null);
});

test('registrations require a verified new account created after the ad click; logins cannot convert', () => {
  const input = { id: 'opaque-signup', createdAt: now - 30_000, now, attribution: click };
  assert.equal(buildOpenAIRegistrationEvent(input)?.type, 'registration_completed');
  assert.equal(buildOpenAIRegistrationEvent({ ...input, createdAt: now - 86400_000 }), null);
  assert.equal(buildOpenAIRegistrationEvent({ ...input, createdAt: now + 1 }), null);
  assert.equal(buildOpenAIRegistrationEvent({ ...input, now: now + 7 * 86400_000 }), null);
});

test('CAPI validation cannot save events, secrets stay in headers, redirects are refused and failures are bounded', async () => {
  const event = buildOpenAIOrderEvent({
    id: 'fixture',
    occurredAt: now,
    liveMode: true,
    amountMinor: 2300,
    currency: 'EUR',
    attribution: click,
  })!;
  let sent = 0;
  const fetcher: typeof fetch = async (url, init) => {
    sent++;
    assert.equal(String(url), 'https://bzr.openai.com/v1/events?pid=pixel_fixture');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-secret');
    assert.equal(init?.redirect, 'error');
    assert.deepEqual(JSON.parse(String(init?.body)), { validate_only: true, events: [event] });
    return Response.json({ success: true, received: 1, validated: 1 });
  };
  assert.equal(
    (
      await sendOpenAIConversion(event, {
        pixelId: 'pixel_fixture',
        apiKey: 'test-secret',
        production: true,
        validateOnly: true,
        fetcher,
      })
    ).status,
    'validated'
  );
  await sendOpenAIConversion(event, { pixelId: 'pixel_fixture', apiKey: 'test-secret', production: false, fetcher });
  assert.equal(sent, 1, 'preview/local sends are blocked');
});
