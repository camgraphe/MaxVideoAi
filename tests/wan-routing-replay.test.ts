import assert from 'node:assert/strict';
import test from 'node:test';
import { replayWanPrime, type ReplayGroup } from '../frontend/app/(core)/admin/routing/_lib/wan-replay';
import { routingScenarios } from '../frontend/app/(core)/admin/routing/_lib/routing-scenarios';
import { rankQuotedOffers } from '../frontend/src/lib/video-purchase-decision';
import { buildApimartWanRequest, ApimartSubmitError } from '../frontend/src/server/video-providers/apimart/wan-prime';
import type { AlibabaMedia } from '../frontend/src/server/video-providers/alibaba-model-studio/types';

const group: ReplayGroup = { jobs: 1, mode: 'ref2v', duration: 4, resolution: '720p', ratio: '16:9',
  images: 2, videos: 0, audioRefs: 0, startFrame: false, endFrame: false, document: false, unreviewed: false, cents: 56, currency: 'USD' };

test('historical replay partitions every purchase, respects customer ceilings and weighs grouped prices', () => {
  const result = replayWanPrime([
    { ...group, jobs: 4 }, { ...group, cents: 42 }, { ...group, cents: 41, jobs: 2 },
    { ...group, images: null }, { ...group, startFrame: null }, { ...group, currency: 'EUR' },
    { ...group, audioRefs: 1 }, { ...group, unreviewed: true }, { ...group, videos: 1 },
    { ...group, images: 0, mode: 'i2v', startFrame: true, endFrame: true },
  ]);
  assert.deepEqual(result, {
    firstChoices: { apimart: 6 }, total: 14, eligible: 6, threeRoutes: 5, outsideCoverage: 3, missingFacts: 3, overCeiling: 2,
    baselineMicros: 560000 * 6, purchaseMicros: 411440 * 6, modes: { t2v: 0, i2v: 1, ref2v: 5 },
  });
  assert.equal(replayWanPrime([]).total, 0);
});

test('Wan canary retains ordered frame roles and accepts up to ten reference images', () => {
  const make = (media: AlibabaMedia[]) => buildApimartWanRequest({ model: 'wan3.0-video-prime',
    input: { prompt: 'A camera movement', media }, parameters: { duration: 4, resolution: '720P', watermark: false, audio: false } });
  const first: AlibabaMedia = { type: 'first_frame', url: 'https://owned.example/first' };
  const last: AlibabaMedia = { type: 'last_frame', url: 'https://owned.example/last' };
  const refs: AlibabaMedia[] = Array.from({length: 10}, (_, i) => ({ type: 'reference_image', url: 'https://owned.example/r' + i }));
  assert.deepEqual(make([last, first]).image_urls, [first.url, last.url]);
  assert.equal(make([first]).generation_type, 'frame');
  assert.deepEqual(make(refs).image_urls, refs.map(r => r.url));
  assert.equal(make(refs).generation_type, 'reference');
  for (const invalid of [[last], [first, first], [first, last, last], [first, refs[0]], [...refs, refs[0]],
    [{ type: 'reference_audio', url: 'https://owned.example/audio' } as const]]) {
    assert.throws(() => make(invalid), ApimartSubmitError);
  }
});

test('observed H3 and Seedance examples retain a single provider and Wan Standard prices are tier-specific', () => {
  const scenarios = routingScenarios();
  for (const [id, first, micros, count] of [
    ['standard-reference', 'videorouter', 679575, 5], ['standard-image', 'apimart', 328750, 4],
    ['h3-references', 'fal', 500000, 1], ['h3-text', 'fal', 750000, 1],
    ['seedance-reference', 'byteplus_modelark', 5094270, 1], ['seedance-text', 'byteplus_modelark', 723876, 1],
    ['seedance-image', 'byteplus_modelark', 427219, 1],
  ] as const) {
    const scenario = scenarios.find(s => s.id === id)!;
    const decision = rankQuotedOffers(scenario.candidates, { ceilingMicros: scenario.ceiling, strategy: scenario.strategy });
    assert.equal(decision.order[0], first);
    assert.equal(decision.order.length, count);
    assert.equal(decision.candidates.find(c => c.provider === first)?.costMicros, micros);
  }
});
