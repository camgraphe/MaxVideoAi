import assert from 'node:assert/strict';
import test from 'node:test';
import type { EngineInputField, Mode } from '../frontend/types/engines';
import { WAN_3_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/wan-3';
import { WAN_3_PRIME_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/wan-3-prime';
import { LTX_2_5_FAST_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/ltx-2-5-fast';
import { LTX_2_5_PRO_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/ltx-2-5-pro';
import { GROK_IMAGINE_VIDEO_1_5_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/grok-imagine-video-1-5';
import { FLUX_3_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/flux-3';
import { FLUX_3_DRAFT_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/flux-3-draft';

const registries = [
  ...WAN_3_FAL_ENGINE_REGISTRY,
  ...WAN_3_PRIME_FAL_ENGINE_REGISTRY,
  ...LTX_2_5_FAST_FAL_ENGINE_REGISTRY,
  ...LTX_2_5_PRO_FAL_ENGINE_REGISTRY,
  ...GROK_IMAGINE_VIDEO_1_5_FAL_ENGINE_REGISTRY,
  ...FLUX_3_FAL_ENGINE_REGISTRY,
  ...FLUX_3_DRAFT_FAL_ENGINE_REGISTRY,
];

const expectedEndpoints = {
  'wan-3': {
    t2v: 'alibaba/wan-3.0/text-to-video',
    i2v: 'alibaba/wan-3.0/image-to-video',
    ref2v: 'alibaba/wan-3.0/reference-to-video',
  },
  'wan-3-prime': {
    t2v: 'alibaba/wan-3.0-prime/text-to-video',
    i2v: 'alibaba/wan-3.0-prime/image-to-video',
    ref2v: 'alibaba/wan-3.0-prime/reference-to-video',
  },
  'ltx-2-5-fast': {
    t2v: 'lightricks/ltx-2.5/text-to-video/fast',
    i2v: 'lightricks/ltx-2.5/image-to-video/fast',
    a2v: 'lightricks/ltx-2.5/audio-to-video/fast',
  },
  'ltx-2-5-pro': {
    t2v: 'lightricks/ltx-2.5/text-to-video/pro',
    i2v: 'lightricks/ltx-2.5/image-to-video/pro',
    a2v: 'lightricks/ltx-2.5/audio-to-video/pro',
  },
  'grok-imagine-video-1-5': {
    t2v: 'xai/grok-imagine-video/v1.5/text-to-video',
    i2v: 'xai/grok-imagine-video/v1.5/image-to-video',
    ref2v: 'xai/grok-imagine-video/v1.5/reference-to-video',
  },
  'flux-3': {
    t2v: 'blackforestlabs/flux-3/text-to-video',
    i2v: 'blackforestlabs/flux-3/image-to-video',
    fl2v: 'blackforestlabs/flux-3/first-last-frame-to-video',
    extend: 'blackforestlabs/flux-3/extend-video',
  },
  'flux-3-draft': {
    t2v: 'blackforestlabs/flux-3/text-to-video/draft',
    i2v: 'blackforestlabs/flux-3/image-to-video/draft',
    fl2v: 'blackforestlabs/flux-3/first-last-frame-to-video/draft',
    extend: 'blackforestlabs/flux-3/extend-video/draft',
  },
} as const;
const expectedBrandIds = {
  'wan-3': 'wan',
  'wan-3-prime': 'wan',
  'ltx-2-5-fast': 'lightricks',
  'ltx-2-5-pro': 'lightricks',
  'grok-imagine-video-1-5': 'xai',
  'flux-3': 'black-forest-labs',
  'flux-3-draft': 'black-forest-labs',
} as const;

function entry(id: keyof typeof expectedEndpoints) {
  const match = registries.find((candidate) => candidate.id === id);
  assert.ok(match, `${id} raw engine should exist`);
  return match;
}

function fieldsFor(id: keyof typeof expectedEndpoints, mode: Mode) {
  const schema = entry(id).engine.inputSchema;
  assert.ok(schema);
  const all = [...(schema.required ?? []), ...(schema.optional ?? [])];
  return all.filter((field) => !field.modes || field.modes.includes(mode));
}

function field(id: keyof typeof expectedEndpoints, mode: Mode, fieldId: string): EngineInputField {
  const match = fieldsFor(id, mode).find((candidate) => candidate.id === fieldId);
  assert.ok(match, `${id}/${mode} should expose ${fieldId}`);
  return match;
}

test('seven raw engines expose exactly the canonical 23 modes and Fal endpoints', () => {
  assert.equal(registries.length, 7);
  assert.deepEqual(registries.map(({ id }) => id), Object.keys(expectedEndpoints));

  for (const [id, endpoints] of Object.entries(expectedEndpoints)) {
    const actual = entry(id as keyof typeof expectedEndpoints);
    assert.deepEqual(actual.modes.map(({ mode }) => mode), Object.keys(endpoints));
    assert.deepEqual(
      Object.fromEntries(actual.modes.map(({ mode, falModelId }) => [mode, falModelId])),
      endpoints,
    );
    assert.equal(actual.defaultFalModelId, Object.values(endpoints)[0]);
    assert.deepEqual(actual.engine.modes, Object.keys(endpoints));
    assert.equal(actual.brandId, expectedBrandIds[id as keyof typeof expectedBrandIds]);
    assert.equal(actual.engine.brandId, expectedBrandIds[id as keyof typeof expectedBrandIds]);
  }

  const allModes = registries.flatMap((item) => item.modes.map(({ mode }) => mode));
  assert.equal(allModes.length, 23);
  assert.ok(!allModes.includes('keyframes-to-video' as never));
  assert.ok(!allModes.includes('draft-enhance' as never));
  assert.ok(!allModes.includes('r2v'));
  assert.ok(!allModes.includes('v2v'));
});

test('Wan 3 and Prime preserve the complete provider schema and reference contract', () => {
  const commonControls = [
    'enable_thinking', 'duration', 'enable_safety_checker', 'resolution', 'aspect_ratio',
    'seed', 'audio', 'enable_prompt_expansion',
  ];
  const referenceFields = [
    'prompt', ...commonControls, 'reference_image_urls', 'reference_video_urls',
    'reference_audio_urls', 'file_url', 'web_url',
  ].sort();

  for (const id of ['wan-3', 'wan-3-prime'] as const) {
    assert.deepEqual(fieldsFor(id, 't2v').map(({ id: fieldId }) => fieldId).sort(), ['prompt', ...commonControls].sort());
    assert.deepEqual(fieldsFor(id, 'i2v').map(({ id: fieldId }) => fieldId).sort(), ['start_image_url', 'prompt', 'end_image_url', ...commonControls].sort());
    assert.deepEqual(fieldsFor(id, 'ref2v').map(({ id: fieldId }) => fieldId).sort(), referenceFields);
    assert.deepEqual(field(id, 't2v', 'resolution').values, ['480p', '720p', '1080p']);
    assert.deepEqual(field(id, 't2v', 'aspect_ratio').values, ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16']);
    assert.match(field(id, 't2v', 'duration').description ?? '', /null.*smart/i);
    assert.equal(field(id, 'ref2v', 'reference_image_urls').maxCount, 10);
    assert.equal(field(id, 'ref2v', 'reference_video_urls').maxCount, 5);
    assert.equal(field(id, 'ref2v', 'reference_video_urls').maxSizeMB, 100);
    assert.equal(field(id, 'ref2v', 'reference_audio_urls').maxCount, 5);
    assert.equal(field(id, 'ref2v', 'reference_audio_urls').maxSizeMB, 15);
    assert.deepEqual(entry(id).engine.inputSchema?.constraints?.atLeastOneReferenceField, [
      'reference_image_urls', 'reference_video_urls', 'reference_audio_urls', 'file_url', 'web_url',
    ]);
  }

  assert.deepEqual(entry('wan-3').engine.pricingDetails?.perSecondCents?.byResolution, { '480p': 5, '720p': 10, '1080p': 20 });
  assert.deepEqual(entry('wan-3-prime').engine.pricingDetails?.perSecondCents?.byResolution, { '480p': 6.8, '720p': 14, '1080p': 28 });
});

test('LTX 2.5 variants preserve mixed duration, 2160p, camera and audio schema facts', () => {
  const expected = {
    'ltx-2-5-fast': {
      duration: ['6', '8', '10', '12', '14', '16', '18', '20', 'auto'],
      resolutions: ['720p', '1080p', '1440p', '2160p'],
      fps: ['24', '25', '48', '50'],
      audioMax: 20,
      prices: { '720p': 9, '1080p': 13, '1440p': 19, '2160p': 30 },
    },
    'ltx-2-5-pro': {
      duration: ['6', '8', '10', 'auto'],
      resolutions: ['720p', '1080p'],
      fps: ['24', '25', '50'],
      audioMax: 10,
      prices: { '720p': 12, '1080p': 17 },
    },
  } as const;

  for (const id of Object.keys(expected) as Array<keyof typeof expected>) {
    assert.deepEqual(fieldsFor(id, 't2v').map(({ id: fieldId }) => fieldId).sort(), [
      'prompt', 'duration', 'resolution', 'fps', 'aspect_ratio', 'generate_audio', 'camera_motion',
    ].sort());
    assert.deepEqual(fieldsFor(id, 'i2v').map(({ id: fieldId }) => fieldId).sort(), [
      'prompt', 'image_url', 'end_image_url', 'duration', 'resolution', 'fps', 'aspect_ratio',
      'generate_audio', 'camera_motion',
    ].sort());
    assert.deepEqual(fieldsFor(id, 'a2v').map(({ id: fieldId }) => fieldId).sort(), [
      'audio_url', 'prompt', 'image_url', 'aspect_ratio', 'guidance_scale',
    ].sort());
    assert.deepEqual(field(id, 't2v', 'duration').values, expected[id].duration);
    assert.deepEqual(field(id, 't2v', 'resolution').values, expected[id].resolutions);
    assert.deepEqual(field(id, 't2v', 'fps').values, expected[id].fps);
    assert.equal(field(id, 'a2v', 'audio_url').minDurationSec, 2);
    assert.equal(field(id, 'a2v', 'audio_url').maxDurationSec, expected[id].audioMax);
    assert.match(field(id, 'a2v', 'prompt').description ?? '', /required.*image_url.*absent/i);
    assert.deepEqual(entry(id).engine.pricingDetails?.perSecondCents?.byResolution, expected[id].prices);
    assert.match(entry(id).billingNote ?? '', /input-audio/i);
  }
});

test('Grok exposes only its published references, controls, 15 second cap, and surcharge fact', () => {
  const id = 'grok-imagine-video-1-5';
  assert.deepEqual(fieldsFor(id, 't2v').map(({ id: fieldId }) => fieldId).sort(), ['prompt', 'aspect_ratio', 'duration', 'resolution'].sort());
  assert.deepEqual(fieldsFor(id, 'i2v').map(({ id: fieldId }) => fieldId).sort(), ['prompt', 'image_url', 'duration', 'resolution'].sort());
  assert.deepEqual(fieldsFor(id, 'ref2v').map(({ id: fieldId }) => fieldId).sort(), ['prompt', 'reference_image_urls', 'aspect_ratio', 'duration', 'resolution'].sort());
  assert.equal(entry(id).engine.maxDurationSec, 15);
  assert.equal(field(id, 'ref2v', 'reference_image_urls').minCount, 1);
  assert.equal(field(id, 'ref2v', 'reference_image_urls').maxCount, 7);
  assert.equal(field(id, 'ref2v', 'duration').default, 8);
  assert.deepEqual(field(id, 'ref2v', 'resolution').values, ['480p', '720p']);
  assert.match(entry(id).billingNote ?? '', /\$0\.01 per reference image/);
});

test('FLUX standard and Draft preserve exact frame, extension, resolution, and price facts', () => {
  for (const id of ['flux-3', 'flux-3-draft'] as const) {
    const shared = ['prompt', 'duration', 'generate_audio', 'aspect_ratio', 'safety_tolerance'];
    const resolution = id === 'flux-3' ? ['resolution'] : [];
    assert.deepEqual(fieldsFor(id, 't2v').map(({ id: fieldId }) => fieldId).sort(), [...shared, ...resolution].sort());
    assert.deepEqual(fieldsFor(id, 'i2v').map(({ id: fieldId }) => fieldId).sort(), [...shared, 'image_url', ...resolution].sort());
    assert.deepEqual(fieldsFor(id, 'fl2v').map(({ id: fieldId }) => fieldId).sort(), [...shared, 'start_image_url', 'end_image_url', ...resolution].sort());
    assert.deepEqual(fieldsFor(id, 'extend').map(({ id: fieldId }) => fieldId).sort(), [...shared, 'video_url', ...resolution].sort());
    assert.deepEqual(fieldsFor(id, 'fl2v').filter(({ id: fieldId }) => ['start_image_url', 'end_image_url'].includes(fieldId)).map(({ id: fieldId }) => fieldId), ['start_image_url', 'end_image_url']);
    assert.deepEqual(field(id, 'fl2v', 'duration').values, Array.from({ length: 16 }, (_, index) => String(index + 5)));
    assert.deepEqual(field(id, 't2v', 'duration').values, ['auto', ...Array.from({ length: 16 }, (_, index) => String(index + 5))]);
    assert.deepEqual(field(id, 't2v', 'aspect_ratio').values, ['auto', '21:9', '2:1', '16:9', '4:3', '1:1', '3:4', '9:16']);
    assert.deepEqual({ min: field(id, 't2v', 'safety_tolerance').min, max: field(id, 't2v', 'safety_tolerance').max, default: field(id, 't2v', 'safety_tolerance').default }, { min: 0, max: 4, default: 2 });
    assert.ok(!fieldsFor(id, 'fl2v').some(({ id: fieldId }) => fieldId === 'keyframes'));
  }

  assert.deepEqual(field('flux-3', 't2v', 'resolution').values, ['720p', '1080p']);
  assert.ok(!fieldsFor('flux-3-draft', 't2v').some(({ id }) => id === 'resolution'));
  for (const mode of ['t2v', 'i2v', 'fl2v', 'extend'] as const) {
    const caps = entry('flux-3-draft').modes.find((candidate) => candidate.mode === mode)?.ui;
    assert.deepEqual(caps?.resolution, ['720p']);
    assert.equal(caps?.resolutionLocked, true);
  }
  assert.equal(field('flux-3', 'extend', 'video_url').maxSizeMB, 50);
  assert.match(entry('flux-3').billingNote ?? '', /extend.*\$0\.41.*\$0\.53/i);
  assert.match(entry('flux-3-draft').billingNote ?? '', /extend.*\$0\.12/i);
});

test('raw P0 entries do not author registry-owned policy fields', () => {
  for (const item of registries) {
    for (const key of ['modelSlug', 'family', 'category', 'surfaces', 'lifecycle', 'successorId', 'successorSlug', 'isLegacy']) {
      assert.ok(!(key in item), `${item.id} should not author ${key}`);
    }
    assert.ok(!('modelSlug' in (item.engine.providerMeta ?? {})), `${item.id} providerMeta should not author modelSlug`);
  }
});
