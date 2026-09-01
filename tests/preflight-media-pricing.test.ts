import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { computeConfiguredPreflight } from '../frontend/src/server/engines.ts';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing.ts';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight.ts';
import type { EngineCaps, PreflightRequest } from '../frontend/types/engines.ts';

function engineFor(id: string): EngineCaps {
  const engine = listFalEngines().find((entry) => entry.id === id)?.engine;
  assert.ok(engine, `Missing engine ${id}`);
  return engine;
}

function requestFor(engine: EngineCaps, mode: PreflightRequest['mode']): PreflightRequest {
  return {
    engine: engine.id,
    mode,
    durationSec: 6,
    resolution: '720p',
    aspectRatio: '16:9',
    fps: 24,
    user: { memberTier: 'Member' },
  };
}

test('media-aware preflight resolves the normalized Grok reference count and matches final billing', async () => {
  const engine = engineFor('grok-imagine-video-1-5');
  const request: PreflightRequest = {
    ...requestFor(engine, 'ref2v'),
    inputs: [
      {
        assetId: 'ref-a', slotId: 'reference_image_urls', kind: 'image',
        name: 'a.png', type: 'image/png', size: 100,
        url: 'https://cdn.maxvideoai.com/private/a.png',
      },
      {
        assetId: 'ref-b', slotId: 'reference_image_urls', kind: 'image',
        name: 'b.png', type: 'image/png', size: 100,
        url: 'https://cdn.maxvideoai.com/private/b.png',
      },
    ],
  };
  const preflight = await resolveMediaAwarePreflight(
    { request, userId: 'pricing-user' },
    { getConfiguredEngineFn: async () => engine },
  );
  assert.equal(preflight.ok, true);
  assert.equal(preflight.pricing?.meta?.referenceImageCount, 2);
  assert.deepEqual(preflight.pricing?.addons, [{ type: 'reference_images', amountCents: 2 }]);

  const finalBilling = await computeCanonicalBillingSnapshot({
    engine,
    durationSec: 6,
    resolution: '720p',
    aspectRatio: '16:9',
    mode: 'ref2v',
    membershipTier: 'member',
    referenceImageCount: 2,
  }, {
    pricingPolicy: {
      loadOverrides: async () => ({ status: 'loaded', rules: [], routingRules: [] }),
      warn: () => undefined,
    },
    membershipDiscounts: { member: 0, plus: 0.05, pro: 0.1 },
  });
  assert.equal(preflight.total, finalBilling.totalCents);
  assert.deepEqual(preflight.pricing?.base, finalBilling.base);
  assert.deepEqual(preflight.pricing?.addons, finalBilling.addons);
});

test('media-aware preflight prices LTX A2V from trusted metadata, never client duration', async () => {
  const engine = engineFor('ltx-2-5-fast');
  const audioUrl = 'https://cdn.maxvideoai.com/private/source.wav';
  const request: PreflightRequest = {
    ...requestFor(engine, 'a2v'),
    resolution: '1080p',
    inputs: [{
      assetId: 'audio-asset', slotId: 'audio_url', kind: 'audio',
      name: 'source.wav', type: 'audio/wav', size: 2_048, url: audioUrl,
    }],
  };
  const preflight = await resolveMediaAwarePreflight(
    { request, userId: 'pricing-user' },
    {
      getConfiguredEngineFn: async () => engine,
      mediaConstraintDeps: {
        queryFn: async () => [{
          asset_id: 'audio-asset', url: audioUrl, origin_url: null,
          original_name: 'source.wav', mime_type: 'audio/wav', size_bytes: 2_048,
          duration_sec: 9.25, width: null, height: null,
        }] as never[],
      },
    },
  );
  assert.equal(preflight.ok, true);
  assert.equal(preflight.pricing?.base.seconds, 9.25);
  assert.equal(preflight.pricing?.meta?.inputAudioDurationSec, 9.25);
  const finalBilling = await computeCanonicalBillingSnapshot({
    engine,
    durationSec: 6,
    resolution: '1080p',
    aspectRatio: '16:9',
    mode: 'a2v',
    membershipTier: 'member',
    inputAudioDurationSec: 9.25,
  }, {
    pricingPolicy: {
      loadOverrides: async () => ({ status: 'loaded', rules: [], routingRules: [] }),
      warn: () => undefined,
    },
    membershipDiscounts: { member: 0, plus: 0.05, pro: 0.1 },
  });
  assert.equal(preflight.total, finalBilling.totalCents);
  assert.deepEqual(preflight.pricing?.base, finalBilling.base);
  assert.deepEqual(preflight.pricing?.addons, finalBilling.addons);

  const clientDuration = await resolveMediaAwarePreflight(
    {
      request: {
        ...request,
        extraInputValues: { inputAudioDurationSec: 99 },
      },
      userId: 'pricing-user',
    },
    { getConfiguredEngineFn: async () => engine },
  );
  assert.equal(clientDuration.ok, false);
  assert.equal(clientDuration.error?.code, 'PRICING_MEDIA_FACTS_UNTRUSTED');
});

test('media-aware preflight fails closed when required trusted facts cannot be established', async () => {
  const grok = engineFor('grok-imagine-video-1-5');
  const noAuth = await resolveMediaAwarePreflight(
    { request: requestFor(grok, 'ref2v'), userId: null },
    { getConfiguredEngineFn: async () => grok },
  );
  assert.equal(noAuth.ok, false);
  assert.equal(noAuth.error?.code, 'PRICING_MEDIA_FACTS_UNVERIFIED');

  const ltx = engineFor('ltx-2-5-pro');
  const noAudio = await resolveMediaAwarePreflight(
    { request: { ...requestFor(ltx, 'a2v'), resolution: '1080p' }, userId: 'pricing-user' },
    { getConfiguredEngineFn: async () => ltx },
  );
  assert.equal(noAudio.ok, false);
  assert.equal(noAudio.error?.code, 'PRICING_MEDIA_FACTS_UNVERIFIED');
});

test('configured preflight rejects client media scalars even when an engine is already resolved', async () => {
  const engine = engineFor('ltx-2-5-fast');
  const result = await computeConfiguredPreflight({
    ...requestFor(engine, 'a2v'),
    resolution: '1080p',
    extraInputValues: { inputAudioDurationSec: 99 },
  }, {
    resolvedEngine: engine,
    trustedMediaPricingFacts: { inputAudioDurationSec: 9.25 },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'PRICING_MEDIA_FACTS_UNTRUSTED');
});

test('ordinary public preflight stays anonymous and does not resolve an auth session', async () => {
  const engine = engineFor('flux-3');
  let authCalls = 0;
  const result = await resolveMediaAwarePreflight({
    request: requestFor(engine, 't2v'),
    resolveUserId: async () => {
      authCalls += 1;
      return null;
    },
  }, {
    getConfiguredEngineFn: async () => engine,
  });
  assert.equal(result.ok, true);
  assert.equal(authCalls, 0);
});
