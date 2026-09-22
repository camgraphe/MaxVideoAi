import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import type { GeneratePayload } from '../frontend/src/lib/fal-types';

function payload(overrides: Partial<GeneratePayload>): GeneratePayload {
  return {
    engineId: 'minimax-h3',
    prompt: 'Original adult character crosses a storm-lit pier.',
    mode: 't2v',
    durationSec: 15,
    resolution: '2K',
    aspectRatio: '16:9',
    fps: 24,
    audio: true,
    extraInputValues: {
      arbitrary_provider_flag: true,
      generate_audio: true,
      audio: true,
    },
    ...overrides,
  };
}

test('MiniMax H3 text-to-video emits only the documented provider fields', () => {
  assert.deepEqual(
    buildFalGenerationRequest(payload({}), 'ignored/default-model'),
    {
      model: 'minimax/h3/text-to-video',
      requestBody: {
        prompt: 'Original adult character crosses a storm-lit pier.',
        duration: 15,
        resolution: '2K',
        aspect_ratio: '16:9',
      },
    }
  );

  assert.deepEqual(
    buildFalGenerationRequest(payload({ mode: 'ref2v', aspectRatio: 'auto' }), 'ignored/default-model').requestBody,
    {
      prompt: 'Original adult character crosses a storm-lit pier.',
      duration: 15,
      resolution: '2K',
      aspect_ratio: 'adaptive',
    }
  );
});

test('MiniMax H3 image-to-video preserves start/end images and omits aspect ratio', () => {
  assert.deepEqual(
    buildFalGenerationRequest(
      payload({
        mode: 'i2v',
        prompt: 'The woman turns toward the lighthouse beam.',
        durationSec: 10,
        resolution: '4K',
        aspectRatio: '9:16',
        imageUrl: 'https://media.maxvideoai.com/fallback-start.jpg',
        endImageUrl: 'https://media.maxvideoai.com/fallback-end.jpg',
        inputs: [
          {
            name: 'start.jpg',
            type: 'image/jpeg',
            size: 1200,
            kind: 'image',
            slotId: 'image_url',
            url: 'https://media.maxvideoai.com/start.jpg',
          },
          {
            name: 'end.jpg',
            type: 'image/jpeg',
            size: 1200,
            kind: 'image',
            slotId: 'end_image_url',
            url: 'https://media.maxvideoai.com/end.jpg',
          },
        ],
      }),
      'ignored/default-model'
    ),
    {
      model: 'minimax/h3/image-to-video',
      requestBody: {
        prompt: 'The woman turns toward the lighthouse beam.',
        duration: 10,
        resolution: '4K',
        image_url: 'https://media.maxvideoai.com/start.jpg',
        end_image_url: 'https://media.maxvideoai.com/end.jpg',
      },
    }
  );
});

test('MiniMax H3 reference-to-video keeps exact field names and de-duplicates URLs', () => {
  assert.deepEqual(
    buildFalGenerationRequest(
      payload({
        mode: 'ref2v',
        prompt: 'Two original cartographers exchange a map on a station platform.',
        resolution: '4K',
        aspectRatio: 'auto',
        inputs: [
          {
            name: 'a.jpg', type: 'image/jpeg', size: 1, kind: 'image', slotId: 'reference_image_urls',
            url: 'https://media.maxvideoai.com/a.jpg',
          },
          {
            name: 'a-duplicate.jpg', type: 'image/jpeg', size: 1, kind: 'image', slotId: 'reference_image_urls',
            url: 'https://media.maxvideoai.com/a.jpg',
          },
          {
            name: 'b.jpg', type: 'image/jpeg', size: 1, kind: 'image', slotId: 'reference_image_urls',
            url: 'https://media.maxvideoai.com/b.jpg',
          },
          {
            name: 'motion.mp4', type: 'video/mp4', size: 1, kind: 'video', slotId: 'reference_video_urls',
            url: 'https://media.maxvideoai.com/motion.mp4',
          },
          {
            name: 'station.wav', type: 'audio/wav', size: 1, kind: 'audio', slotId: 'reference_audio_urls',
            url: 'https://media.maxvideoai.com/station.wav',
          },
          {
            name: 'wrong-slot.jpg', type: 'image/jpeg', size: 1, kind: 'image', slotId: 'image_urls',
            url: 'https://media.maxvideoai.com/drop.jpg',
          },
        ],
      }),
      'ignored/default-model'
    ),
    {
      model: 'minimax/h3/reference-to-video',
      requestBody: {
        prompt: 'Two original cartographers exchange a map on a station platform.',
        duration: 15,
        resolution: '4K',
        aspect_ratio: 'adaptive',
        reference_image_urls: [
          'https://media.maxvideoai.com/a.jpg',
          'https://media.maxvideoai.com/b.jpg',
        ],
        reference_video_urls: ['https://media.maxvideoai.com/motion.mp4'],
        reference_audio_urls: ['https://media.maxvideoai.com/station.wav'],
      },
    }
  );
});

test('MiniMax H3 preserves validated top-level reference images and their prompt order', () => {
  const { requestBody } = buildFalGenerationRequest(payload({
    mode: 'ref2v',
    referenceImages: ['https://media.maxvideoai.com/first.jpg', 'https://media.maxvideoai.com/second.jpg'],
    inputs: [
      { name: 'second.jpg', type: 'image/jpeg', size: 1, kind: 'image', slotId: 'reference_image_urls', url: 'https://media.maxvideoai.com/second.jpg' },
      { name: 'third.jpg', type: 'image/jpeg', size: 1, kind: 'image', slotId: 'reference_image_urls', url: 'https://media.maxvideoai.com/third.jpg' },
    ],
  }), 'ignored/default-model');
  assert.deepEqual(requestBody.reference_image_urls, [
    'https://media.maxvideoai.com/first.jpg', 'https://media.maxvideoai.com/second.jpg', 'https://media.maxvideoai.com/third.jpg',
  ]);
});

test('every MiniMax H3 mode omits unsupported controls and generic reference aliases', () => {
  for (const mode of ['t2v', 'i2v', 'ref2v'] as const) {
    const { requestBody } = buildFalGenerationRequest(
      payload({
        mode,
        imageUrl: mode === 'i2v' ? 'https://media.maxvideoai.com/start.jpg' : undefined,
        inputs:
          mode === 'ref2v'
            ? [{ name: 'a.jpg', type: 'image/jpeg', size: 1, kind: 'image', slotId: 'reference_image_urls', url: 'https://media.maxvideoai.com/a.jpg' }]
            : undefined,
      }),
      'ignored/default-model'
    );
    for (const field of [
      'fps', 'generate_audio', 'audio', 'image_urls', 'video_urls', 'audio_urls',
      'arbitrary_provider_flag',
    ]) {
      assert.equal(field in requestBody, false, `${mode} should omit ${field}`);
    }
  }
});

test('MiniMax H3 maps end-only frames, soundtracks, seed, and expansion without leaking extras', () => {
  const soundtrack = {
    name: 'track.wav', type: 'audio/wav', size: 1000, kind: 'audio' as const,
    slotId: 'target_audio_url', url: 'https://media.maxvideoai.com/track.wav',
  };
  for (const mode of ['t2v', 'i2v'] as const) {
    const { requestBody } = buildFalGenerationRequest(payload({
      mode, resolution: '480P', seed: 42,
      ...(mode === 'i2v' ? { endImageUrl: 'https://media.maxvideoai.com/end.jpg' } : {}),
      inputs: [soundtrack], extraInputValues: { prompt_expansion_mode: 'disabled', arbitrary: true },
    }), 'ignored');
    assert.equal(requestBody.target_audio_url, soundtrack.url);
    assert.equal(requestBody.seed, 42);
    assert.equal(requestBody.prompt_expansion_mode, 'disabled');
    assert.equal(requestBody.resolution, '480P');
    assert.equal('arbitrary' in requestBody, false);
    assert.equal('image_url' in requestBody, false);
    if (mode === 'i2v') assert.equal(requestBody.end_image_url, 'https://media.maxvideoai.com/end.jpg');
  }
  const reference = buildFalGenerationRequest(payload({
    mode: 'ref2v', inputs: [{ ...soundtrack, slotId: 'reference_audio_urls' }],
    extraInputValues: { seed: 3, prompt_expansion_mode: 'fast' },
  }), 'ignored').requestBody;
  assert.deepEqual(reference.reference_audio_urls, [soundtrack.url]);
  assert.equal(reference.seed, 3);
  assert.equal(reference.prompt_expansion_mode, 'fast');
  assert.equal('target_audio_url' in reference, false);
});
