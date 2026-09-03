import assert from 'node:assert/strict';
import test from 'node:test';

import { stageGoogleVertexOmniPayloadMedia } from '../frontend/src/server/video-providers/google-vertex-omni/media-input';
import {
  buildGoogleVertexOmniOutputGcsUri,
  buildGoogleVertexOmniPayload,
} from '../frontend/src/server/video-providers/google-vertex-omni/payload';

const directVideoOptions = {
  durationSec: 4,
  resolution: '720p',
  outputGcsUri: 'gs://maxvideoai-vertex/omni-outputs/job-test/',
} as const;

test('Omni text-to-video payload uses Interactions video_config task and video response format', async () => {
  const payload = await buildGoogleVertexOmniPayload({
    engineId: 'gemini-omni-flash',
    mode: 't2v',
    prompt: 'A 16:9 cinematic hero shot of a matte black espresso machine',
    aspectRatio: '16:9',
    ...directVideoOptions,
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'A 16:9 cinematic hero shot of a matte black espresso machine',
      mode: 't2v',
      aspectRatio: '16:9',
      extraInputValues: { store_interaction: true, prompt_audio_direction: 'soft cafe ambience' },
    },
  });

  assert.equal(payload.model, 'gemini-omni-1.1-flash-preview');
  assert.deepEqual(payload.response_format, [
    {
      type: 'video',
      aspect_ratio: '16:9',
      delivery: 'uri',
      gcs_uri: 'gs://maxvideoai-vertex/omni-outputs/job-test/',
      resolution: '720p',
      duration: '4s',
    },
  ]);
  assert.equal(payload.background, true);
  assert.equal(payload.store, true);
  assert.deepEqual(payload.generation_config.video_config, { task: 'text_to_video' });
  assert.match(JSON.stringify(payload.input), /soft cafe ambience/);
});

test('Omni reference-to-video payload forwards reference images and camera direction', async () => {
  const payload = await buildGoogleVertexOmniPayload({
    engineId: 'gemini-omni-flash',
    mode: 'ref2v',
    prompt: 'Keep the sneaker design consistent in a product video',
    aspectRatio: '9:16',
    ...directVideoOptions,
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'Keep the sneaker design consistent in a product video',
      mode: 'ref2v',
      aspectRatio: '9:16',
      referenceImages: ['gs://maxvideoai-vertex/ref-a.png', 'gs://maxvideoai-vertex/ref-b.png'],
      extraInputValues: { prompt_camera_direction: 'slow pedestal up' },
    },
  });

  assert.equal(payload.generation_config.video_config.task, 'reference_to_video');
  assert.deepEqual(payload.response_format, [
    {
      type: 'video',
      aspect_ratio: '9:16',
      delivery: 'uri',
      gcs_uri: 'gs://maxvideoai-vertex/omni-outputs/job-test/',
      resolution: '720p',
      duration: '4s',
    },
  ]);
  assert.deepEqual(
    payload.input.filter((item) => item.type === 'image'),
    [
      { type: 'image', uri: 'gs://maxvideoai-vertex/ref-a.png', mime_type: 'image/png' },
      { type: 'image', uri: 'gs://maxvideoai-vertex/ref-b.png', mime_type: 'image/png' },
    ]
  );
  assert.doesNotMatch(JSON.stringify(payload.input), /"role"/);
  assert.match(JSON.stringify(payload.input), /Use the given image\(s\) as references/);
  assert.match(JSON.stringify(payload.input), /ref-a\.png/);
  assert.match(JSON.stringify(payload.input), /slow pedestal up/);
});

test('Omni image-to-video payload tags the source image in the prompt', async () => {
  const payload = await buildGoogleVertexOmniPayload({
    engineId: 'gemini-omni-flash',
    mode: 'i2v',
    prompt: 'A cinematic reveal of a glass perfume bottle on wet stone',
    aspectRatio: '16:9',
    ...directVideoOptions,
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'A cinematic reveal of a glass perfume bottle on wet stone',
      mode: 'i2v',
      aspectRatio: '16:9',
      imageUrl: 'gs://maxvideoai-vertex/source.png',
    },
  });

  assert.deepEqual(
    payload.input.filter((item) => item.type === 'image'),
    [{ type: 'image', uri: 'gs://maxvideoai-vertex/source.png', mime_type: 'image/png' }]
  );
  assert.equal(payload.store, true);
  assert.doesNotMatch(JSON.stringify(payload.input), /"role"/);
  assert.match(JSON.stringify(payload.input), /<FIRST_FRAME>/);
  assert.match(JSON.stringify(payload.input), /Use Image1 as the starting frame/);
});

test('Omni background payload always stores the interaction', async () => {
  const payload = await buildGoogleVertexOmniPayload({
    engineId: 'gemini-omni-flash',
    mode: 't2v',
    prompt: 'A cinematic warehouse robot demonstration',
    aspectRatio: '16:9',
    ...directVideoOptions,
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'A cinematic warehouse robot demonstration',
      mode: 't2v',
      aspectRatio: '16:9',
      extraInputValues: { store_interaction: false },
    },
  });

  assert.equal(payload.store, true);
});

test('Omni first/last-frame payload serializes the start image before the end image', async () => {
  const payload = await buildGoogleVertexOmniPayload({
    engineId: 'gemini-omni-flash',
    mode: 'fl2v',
    prompt: 'Travel from the opening frame to the closing frame',
    aspectRatio: '16:9',
    ...directVideoOptions,
    resolution: '1080p',
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'Travel from the opening frame to the closing frame',
      mode: 'fl2v',
      imageUrl: 'gs://maxvideoai-vertex/first.png',
      endImageUrl: 'gs://maxvideoai-vertex/last.webp',
    },
  });

  assert.equal(payload.generation_config.video_config.task, 'image_to_video');
  assert.deepEqual(payload.input.filter((item) => item.type === 'image'), [
    { type: 'image', uri: 'gs://maxvideoai-vertex/first.png', mime_type: 'image/png' },
    { type: 'image', uri: 'gs://maxvideoai-vertex/last.webp', mime_type: 'image/webp' },
  ]);
  assert.match(String(payload.input[0]?.text), /<FIRST_FRAME>/);
  assert.match(String(payload.input[0]?.text), /<LAST_FRAME>/);
  assert.equal(payload.response_format[0]?.resolution, '1080p');
});

test('Omni extension payload carries exactly one owned source video', async () => {
  const payload = await buildGoogleVertexOmniPayload({
    engineId: 'gemini-omni-flash',
    mode: 'extend',
    prompt: 'Continue the camera move into the next beat',
    aspectRatio: '9:16',
    durationSec: 7,
    resolution: '4k',
    outputGcsUri: directVideoOptions.outputGcsUri,
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'Continue the camera move into the next beat',
      mode: 'extend',
      videoUrl: 'gs://maxvideoai-vertex/owned-source.mp4',
    },
  });

  assert.equal(payload.generation_config.video_config.task, 'extend');
  assert.deepEqual(payload.input.filter((item) => item.type === 'video'), [
    { type: 'video', uri: 'gs://maxvideoai-vertex/owned-source.mp4', mime_type: 'video/mp4' },
  ]);
  assert.equal(payload.response_format[0]?.resolution, '4k');
});

test('Omni rejects out-of-range duration, unsupported ratio, and extension without a source video', async () => {
  const base = {
    engineId: 'gemini-omni-flash',
    prompt: 'Continue the scene',
    resolution: '720p',
    outputGcsUri: directVideoOptions.outputGcsUri,
  } as const;

  await assert.rejects(
    () => buildGoogleVertexOmniPayload({
      ...base,
      mode: 't2v',
      aspectRatio: '16:9',
      durationSec: 11,
      falPayload: { engineId: base.engineId, prompt: base.prompt, mode: 't2v' },
    }),
    /3 to 10 seconds/i
  );
  await assert.rejects(
    () => buildGoogleVertexOmniPayload({
      ...base,
      mode: 't2v',
      aspectRatio: '1:1',
      durationSec: 5,
      falPayload: { engineId: base.engineId, prompt: base.prompt, mode: 't2v' },
    }),
    /16:9 and 9:16/i
  );
  await assert.rejects(
    () => buildGoogleVertexOmniPayload({
      ...base,
      mode: 'extend',
      aspectRatio: '16:9',
      durationSec: 5,
      falPayload: { engineId: base.engineId, prompt: base.prompt, mode: 'extend' },
    }),
    /extension requires a source video/i
  );
});

test('Omni retake payload preserves previous interaction id', async () => {
  const payload = await buildGoogleVertexOmniPayload({
    engineId: 'gemini-omni-flash',
    mode: 'retake',
    prompt: 'Make the camera slower and add more steam',
    aspectRatio: '16:9',
    ...directVideoOptions,
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'Make the camera slower and add more steam',
      mode: 'retake',
      aspectRatio: '16:9',
      extraInputValues: { previous_interaction_id: 'interactions/abc123' },
    },
  });

  assert.equal(payload.previous_interaction_id, 'interactions/abc123');
  assert.equal(payload.generation_config.video_config.task, 'edit');
  assert.deepEqual(payload.response_format, [
    {
      type: 'video',
      delivery: 'uri',
      gcs_uri: 'gs://maxvideoai-vertex/omni-outputs/job-test/',
      resolution: '720p',
    },
  ]);
});

test('Omni video edit response format inherits source timing and aspect ratio', async () => {
  const payload = await buildGoogleVertexOmniPayload({
    engineId: 'gemini-omni-flash',
    mode: 'v2v',
    prompt: 'Make the product reveal calmer and preserve the original framing',
    aspectRatio: '9:16',
    ...directVideoOptions,
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'Make the product reveal calmer and preserve the original framing',
      mode: 'v2v',
      aspectRatio: '9:16',
      videoUrl: 'gs://maxvideoai-vertex/source.mp4',
    },
  });

  assert.equal(payload.generation_config.video_config.task, 'edit');
  assert.deepEqual(payload.response_format, [
    {
      type: 'video',
      delivery: 'uri',
      gcs_uri: 'gs://maxvideoai-vertex/omni-outputs/job-test/',
      resolution: '720p',
    },
  ]);
});

test('Omni payload rejects unsupported negative prompt and seed before provider call', async () => {
  await assert.rejects(
    () =>
      buildGoogleVertexOmniPayload({
        engineId: 'gemini-omni-flash',
        mode: 't2v',
        prompt: 'test',
        aspectRatio: '16:9',
        ...directVideoOptions,
        negativePrompt: 'bad',
        falPayload: { engineId: 'gemini-omni-flash', prompt: 'test', mode: 't2v', aspectRatio: '16:9' },
      }),
    /negative prompt/i
  );

  await assert.rejects(
    () =>
      buildGoogleVertexOmniPayload({
        engineId: 'gemini-omni-flash',
        mode: 't2v',
        prompt: 'test',
        aspectRatio: '16:9',
        ...directVideoOptions,
        falPayload: { engineId: 'gemini-omni-flash', prompt: 'test', mode: 't2v', aspectRatio: '16:9', seed: 7 },
      }),
    /seed/i
  );
});

test('Omni stages non-GCS media through the shared Google Vertex bucket', async () => {
  const uploads: Array<{ prefix: string; mime: string; objectNamespace: string }> = [];
  const staged = await stageGoogleVertexOmniPayloadMedia({
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'Animate the source',
      mode: 'ref2v',
      imageUrl: 'https://media.maxvideoai.com/source.png',
      referenceImages: ['https://media.maxvideoai.com/ref.webp', 'gs://existing/ref.png'],
      videoUrl: 'https://media.maxvideoai.com/source.mp4',
      endImageUrl: 'https://media.maxvideoai.com/end.png',
    },
    inputGcsPrefix: 'gs://maxvideoai-vertex/inputs',
    objectNamespace: 'omni-inputs/job-123',
    accessToken: 'test-token',
    deps: {
      fetchFn: async (url) => {
        const isVideo = String(url).endsWith('.mp4');
        return new Response(isVideo ? 'video-bytes' : 'image-bytes', {
          status: 200,
          headers: { 'content-type': isVideo ? 'video/mp4' : 'image/webp' },
        });
      },
      uploadGoogleVertexGcsObjectFn: async (params) => {
        uploads.push({ prefix: params.prefix, mime: params.mime, objectNamespace: params.objectNamespace });
        return `gs://maxvideoai-vertex/${params.objectNamespace}/${uploads.length}.${params.extension}`;
      },
    },
  });

  assert.equal(staged.imageUrl, 'gs://maxvideoai-vertex/omni-inputs/job-123/1.webp');
  assert.deepEqual(staged.referenceImages, [
    'gs://maxvideoai-vertex/omni-inputs/job-123/2.webp',
    'gs://existing/ref.png',
  ]);
  assert.equal(staged.videoUrl, 'gs://maxvideoai-vertex/omni-inputs/job-123/3.mp4');
  assert.equal(staged.endImageUrl, 'gs://maxvideoai-vertex/omni-inputs/job-123/4.webp');
  assert.deepEqual(uploads.map((upload) => upload.mime), ['image/webp', 'image/webp', 'video/mp4', 'image/webp']);
});

test('Omni rejects images larger than the Google Vertex 30 MB limit before upload', async () => {
  await assert.rejects(
    () =>
      stageGoogleVertexOmniPayloadMedia({
        falPayload: {
          engineId: 'gemini-omni-flash',
          prompt: 'Animate the source',
          mode: 'i2v',
          imageUrl: 'https://media.maxvideoai.com/oversized.png',
        },
        inputGcsPrefix: 'gs://maxvideoai-vertex/inputs',
        objectNamespace: 'omni-inputs/job-oversized',
        accessToken: 'test-token',
        deps: {
          fetchFn: async () =>
            new Response('not-downloaded', {
              status: 200,
              headers: {
                'content-type': 'image/png',
                'content-length': String(30 * 1024 * 1024 + 1),
              },
            }),
          uploadGoogleVertexGcsObjectFn: async () => {
            throw new Error('oversized image should not be uploaded');
          },
        },
      }),
    /30 MB/i
  );
});

test('Omni builds an isolated output prefix from the configured Google Vertex bucket', () => {
  assert.equal(
    buildGoogleVertexOmniOutputGcsUri('gs://maxvideoai-vertex/shared-inputs', 'job_omni_123'),
    'gs://maxvideoai-vertex/shared-inputs/omni-outputs/job_omni_123/'
  );
});
