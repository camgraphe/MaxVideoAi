import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { getBaseEngines } from '../frontend/src/lib/engines';
import type { GalleryVideo } from '../frontend/server/videos-normalization';
import { deriveWatchPageSignals } from '../frontend/server/watch-page-signals';

const video: GalleryVideo = {
  id: 'prepared-watch', userId: 'private-owner', engineId: 'wan-3-prime', engineLabel: 'Wan 3 Prime',
  prompt: 'An original watch-page prompt.', promptExcerpt: 'An original watch-page prompt.',
  durationSec: 22, aspectRatio: '16:9', outputWidth: 1280, outputHeight: 720, hasAudio: true,
  createdAt: '', visibility: 'public', indexable: true, canUpscale: false,
  videoUrl: 'https://media.maxvideoai.com/prepared-watch.mp4', thumbUrl: null,
  finalPriceCents: 401, currency: 'USD',
};

test('watch quote preparation overlaps catalog and policy reads and reuses their exact configured values', async () => {
  // Node's React 18 client export omits Next's request-local cache function.
  // The loader's unrelated video-SEO import defines cached readers at module load.
  const react = createRequire(import.meta.url)('react');
  const cache = react.cache;
  if (!cache) react.cache = (fn: unknown) => fn;
  let loader: typeof import('../frontend/server/example-watch-detail-loader');
  try { loader = await import('../frontend/server/example-watch-detail-loader'); }
  finally { if (!cache) delete react.cache; }
  const prepare = loader.prepareExampleWatchDetailContext;
  assert.equal(typeof prepare, 'function', 'the watch route needs a reusable quote context before its video lookup completes');
  const events: string[] = [];
  const engines = getBaseEngines().filter(engine => engine.id === 'wan-3-prime');
  let finishEngines!: (value: typeof engines) => void;
  let finishPolicy!: (value: { status: 'loaded'; rules: []; routingRules: [] }) => void;
  const engineRead = new Promise<typeof engines>(resolve => { finishEngines = resolve; });
  const policyRead = new Promise<{ status: 'loaded'; rules: []; routingRules: [] }>(resolve => { finishPolicy = resolve; });
  const preparation = prepare({
    loadEngines: () => { events.push('engines'); return engineRead; },
    loadOverrides: () => { events.push('policy'); return policyRead; },
  });
  assert.deepEqual(events, ['engines', 'policy'], 'both reads start before either finishes');
  finishPolicy({ status: 'loaded', rules: [], routingRules: [] });
  finishEngines(engines);
  const context = await preparation;
  assert.equal(context.engines, engines);
  const detail = await loader.buildExampleWatchDetail(video, deriveWatchPageSignals({ video }), context);
  assert.ok(detail);
  assert.equal(detail.quotes.length, 1, 'do not replace a configured catalog with authored defaults');
  assert.equal(detail.quotes[0].engineId, 'wan-3-prime');
  assert.equal(detail.quotes[0].amountCents, 401, 'the canonical price formula remains authoritative');
  assert.equal(detail.quotes[0].settings.durationSec, 22);
  assert.equal(detail.recreateHref, '/app?from=prepared-watch');
  assert.deepEqual(events, ['engines', 'policy'], 'building the detail does not read the context again');

  const unavailableContext = await prepare({
    loadEngines: async () => engines,
    loadOverrides: async () => ({ status: 'unavailable', rules: [], errorCode: 'pricing_rules_query_failed' }),
  });
  await assert.rejects(() => unavailableContext.quote({ engine: engines[0], mode: 't2v', durationSec: 22,
    resolution: '720p', aspectRatio: '16:9', addons: { audio: true } }), /CURRENT_PRICING_POLICY_UNAVAILABLE/);
  const unavailableDetail = await loader.buildExampleWatchDetail(video, deriveWatchPageSignals({ video }), unavailableContext);
  assert.deepEqual(unavailableDetail?.quotes, [], 'a current policy outage cannot produce a fallback price');
  const disabledContext = await prepare({
    loadEngines: async () => [],
    loadOverrides: async () => ({ status: 'loaded', rules: [], routingRules: [] }),
  });
  const disabled = await loader.buildExampleWatchDetail(video, deriveWatchPageSignals({ video }), disabledContext);
  assert.equal(disabled?.recreateHref, null);
  assert.deepEqual(disabled?.quotes, []);
});
