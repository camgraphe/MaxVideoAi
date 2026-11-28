import assert from 'node:assert/strict';
import test from 'node:test';
import type { PurchaseRequest } from '../frontend/src/server/video-providers/purchase/types';
import { planWanPurchase } from '../frontend/src/server/video-providers/purchase-router';
import type { AlibabaVideoPayload } from '../frontend/src/server/video-providers/alibaba-model-studio/types';
import { createVideoRouterClient } from '../frontend/src/server/video-providers/videorouter/wan-prime';
import { configuredWanPurchaseCanary } from '../frontend/src/server/video-providers/router';

const text: PurchaseRequest = {
  engineId: 'wan-3-prime', mode: 't2v', resolution: '720p', aspectRatio: '16:9', durationSec: 30,
  images: 0, hasVideo: false, inputVideoSeconds: 0, hasAudioReference: false, hasDocument: false,
  hasEndFrame: false, audioEnabled: true, promptExpansionEnabled: true, hasSeed: false, promptCharacters: 15,
};
const image = { ...text, mode: 'ref2v', images: 1, ownedReferenceImages: true, durationSec: 4 };
const standard = { ...image, engineId: 'wan-3', aspectRatio: '9:16', resolution: '480p' };
const publicPlan = (r: PurchaseRequest) => planWanPurchase(r, {}, 'with-videorouter');

test('the reviewed Wan families share the purchase ceiling and preserve their original direct fallback order', () => {
  for (const [request, costMicros] of [[text, 2441550], [image, 325540], [standard, 90610]] as const) {
    const plan = publicPlan(request);
    assert.equal(plan.canaryEligible, true);
    assert.deepEqual(plan.order, ['videorouter', 'alibaba_model_studio', 'fal']);
    assert.equal(plan.candidates.find(c => c.provider === 'videorouter')?.costMicros, costMicros);
    assert.equal(planWanPurchase(request, { ceilingMicros: costMicros - 1 }, 'with-videorouter').order.length, 0);
  }
  for (const diff of [{ images: 2 }, { hasAudioReference: true }, { hasSeed: true }, { audioEnabled: false },
    { mode: 'i2v', hasStartFrame: true }, { promptExpansionEnabled: false }, { hasDocument: true },
    { hasUnpricedOptions: true }, { resolution: '1080p' }, { aspectRatio: 'auto' },
    { ownedReferenceImages: false }, { ownedReferenceImages: undefined }, { promptCharacters: 0 }]) {
    assert.equal(publicPlan({ ...image, ...diff }).canaryEligible, false, JSON.stringify(diff));
  }
  assert.equal(publicPlan({ ...standard, mode: 't2v', images: 0 }).canaryEligible, false);
  assert.equal(publicPlan({ ...text, resolution: '480p', durationSec: 22 }).canaryEligible, false);
});

test('Prime and Standard have independent audience switches', t => {
  const names = ['VIDEOROUTER_API_KEY','WAN_PRIME_VIDEOROUTER_CANARY','WAN_STANDARD_VIDEOROUTER_CANARY'];
  const previous = Object.fromEntries(names.map(n => [n, process.env[n]]));
  t.after(() => { for (const [k,v] of Object.entries(previous)) { if (v == null) delete process.env[k]; else process.env[k]=v; } });
  process.env.VIDEOROUTER_API_KEY = 'offline';
  process.env.WAN_PRIME_VIDEOROUTER_CANARY = 'public';
  process.env.WAN_STANDARD_VIDEOROUTER_CANARY = 'admin';
  assert.equal(configuredWanPurchaseCanary('wan-3-prime',false),'with-videorouter');
  assert.equal(configuredWanPurchaseCanary('wan-3',false),undefined);
  assert.equal(configuredWanPurchaseCanary('wan-3',true),'with-videorouter');
});

test('the encoded reference reaches the paid request only after a matching model, count and quote', async () => {
  const referenceUrl = 'https://example.test/prepared-image';
  const payload: AlibabaVideoPayload = { model: 'wan3.0-video', input: { prompt: 'Rotate the watch', media: [{type:'reference_image',url:referenceUrl}] },
    parameters: { duration:4, resolution:'480P', ratio:'9:16', audio:true, prompt_extend:true, watermark:false } };
  for (const refCount of [0,1]) {
    const bodies: Record<string,unknown>[] = [];
    const client = createVideoRouterClient('fixture', async (url, options) => {
      const body=JSON.parse(String(options?.body));
      bodies.push(body);
      assert.deepEqual(body.provider,{only:['botsmart'],allow_fallbacks:false});
      assert.equal(body.model,'alibaba/wan-3.0/botsmart');
      assert.deepEqual(body.input_references,[{type:'image_url',image_url:{url:referenceUrl}}]);
      if (String(url).endsWith('/pricing/estimate')) return Response.json({
        object:'pricing.estimate',type:'video',model:'botsmart/wan-3.0',currency:'USD',estimated_cost_usd:.089505,max_cost_usd:.089505,
        assumptions:{duration_secs:4,resolution:'480p',aspect_ratio:'9:16',reference_images:refCount},
      });
      return Response.json({id:'botsmart:verified'});
    });
    if (refCount === 1) {
      assert.equal((await client.createVideo(payload)).providerJobId,'botsmart:verified');
      assert.equal(bodies.length,2);
    } else {
      await assert.rejects(client.createVideo(payload), /VIDEOROUTER_QUOTE_UNAVAILABLE/);
      assert.equal(bodies.length,1);
    }
  }
});
