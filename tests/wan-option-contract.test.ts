import assert from 'node:assert/strict';
import test from 'node:test';
import type { GeneratePayload } from '../frontend/src/lib/fal-types';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import { resolveWanMediaInputs } from '../frontend/src/lib/video-routing/wan-media';
import { encodeWanFlatRequest, wanFlatExclusion, wanRequestFacts } from '../frontend/src/lib/video-routing/wan-request';
import { buildAlibabaVideoPayload } from '../frontend/src/server/video-providers/alibaba-model-studio/payload';
import { buildApimartWanRequest } from '../frontend/src/server/video-providers/apimart/wan-prime';
import { quoteComparisonRequest } from '../frontend/app/(core)/admin/routing/_lib/comparison-offers';
import { routingScenarios } from '../frontend/app/(core)/admin/routing/_lib/routing-scenarios';

const base: GeneratePayload = {
  engineId: 'wan-3-prime', mode: 't2v', prompt: 'A train crosses the bridge', durationSec: 5,
  resolution: '720p', aspectRatio: '16:9', audio: false, extraInputValues: {enable_prompt_expansion: false}, seed: 0,
};
const first = 'https://example.test/first.jpg';
const last = 'https://example.test/last.jpg';

const fixtures: [string, GeneratePayload][] = [
  ['text', base],
  ['first frame', {...base, mode: 'i2v', imageUrl: first, aspectRatio: 'auto'}],
  ['paired frames', {...base, mode: 'i2v', imageUrl: first, endImageUrl: last, aspectRatio: 'adaptive'}],
  ['ordered references', {...base, mode: 'ref2v', referenceImages: [last, first]}],
];
for (const [label, p] of fixtures) {
  test('the Wan adapters preserve controls and media roles for ' + label, () => {
    const media = resolveWanMediaInputs({ imageUrl: p.imageUrl, falPayload: p });
    const facts = wanRequestFacts(p, media);
    const flat = buildFalGenerationRequest({...p, reviewedWanPilot: true, jobId: 'one-job'}, 'test-model').requestBody;
    const wave = encodeWanFlatRequest('wavespeed', p);
    const direct = buildAlibabaVideoPayload({
      engineId: p.engineId, mode: facts.mode, prompt: p.prompt, durationSec: facts.durationSec, resolution: facts.resolution,
      aspectRatio: facts.aspectRatio, audioEnabled: p.audio, promptExtend: false, seed: p.seed,
      startImageUrl: media.startImageUrl, endImageUrl: media.endImageUrl, referenceImageUrls: media.referenceImages,
    });
    const mart = buildApimartWanRequest(direct);
    assert.deepEqual([direct.parameters.audio, mart.audio, flat.audio, wave.generate_audio], Array(4).fill(false));
    assert.deepEqual([direct.parameters.prompt_extend, mart.prompt_extend, flat.enable_prompt_expansion, wave.enable_prompt_expansion], Array(4).fill(false));
    assert.deepEqual([direct.parameters.seed, mart.seed, flat.seed, wave.seed], [0, 0, 0, 0]);
    assert.deepEqual(flat.metadata, {app_job_id: 'one-job'});
    assert.equal(flat.start_image_url, p.imageUrl);
    assert.equal(wave.image, p.imageUrl);
    assert.equal(flat.end_image_url, p.endImageUrl);
    assert.equal(wave.last_image, p.endImageUrl);
    assert.deepEqual(wave.reference_images, p.referenceImages);
    assert.deepEqual(flat.reference_image_urls, p.referenceImages);
    assert.deepEqual(mart.image_urls, p.referenceImages ?? (p.endImageUrl ? [first,last] : p.imageUrl ? [first] : undefined));
    assert.equal(wave.aspect_ratio, p.mode === 'i2v' ? undefined : '16:9');
    assert.equal(flat.aspect_ratio, p.mode === 'i2v' ? 'adaptive' : '16:9');
    assert.equal(wanFlatExclusion('wavespeed', facts), null);
  });
}

test('quoting and encoding reject the same incompatible profiles', () => {
  for (const overrides of [
    {audio: undefined}, {prompt: 'x'.repeat(20001)},
    {mode: 'ref2v', inputs: [{name:'image',size:1,type:'image/jpeg',kind:'image',url:first}]},
    {mode: 'ref2v', imageUrl: first, referenceImages: [last]}, { endImageUrl: last }, {audioUrl: 'https://example.test/a.wav'},
    {extraInputValues: {new_unknown_control: false}}, {safetyChecker: false}, {durationOption: 'auto'}, {seed: -1}, {durationSec: 31},
    {mode: 'i2v', imageUrl: first, prompt: ''}, { mode: 'i2v', imageUrl: first, inputs: [
      {name:'other',size:1,type:'image/jpeg',kind:'image',slotId:'start_image_url',url:last},
    ] },
  ] satisfies Partial<GeneratePayload>[]) {
    const payload = {...base, ...overrides};
    const facts = wanRequestFacts(payload, resolveWanMediaInputs({ imageUrl: payload.imageUrl, falPayload: payload }));
    const reason = wanFlatExclusion('wavespeed', facts);
    assert.ok(reason);
    const offer = quoteComparisonRequest(facts)?.candidates.find(row => row.provider === 'wavespeed');
    assert.equal(offer?.excluded, reason);
    assert.equal(offer?.costMicros, null);
    assert.throws(() => encodeWanFlatRequest('wavespeed', payload), { message: reason });
  }
});

test('no implicit supplier default changes expansion and unknown historical prompts cannot qualify WaveSpeed', () => {
  for (const provider of ['fal','wavespeed'] as const) {
    const body = encodeWanFlatRequest(provider, {...base, extraInputValues: {}, audio: true});
    assert.equal(body.enable_prompt_expansion, true);
  }
  assert.throws(() => encodeWanFlatRequest('wavespeed', { ...base, futureOption: false } as GeneratePayload), /no reviewed mapping/);
  const facts = wanRequestFacts(base, resolveWanMediaInputs({imageUrl: null, falPayload: base}));
  assert.match(wanFlatExclusion('wavespeed', {...facts, promptCharacters: undefined}) ?? '', /prompt/);
  const scenario = routingScenarios().find(r => r.id === 'frame-pair');
  const examples = scenario?.inputExamples;
  assert.deepEqual(examples?.map(e => e.provider), ['fal','wavespeed']);
  assert.equal(examples?.[1].input.last_image, 'https://example.invalid/last.jpg');
});
