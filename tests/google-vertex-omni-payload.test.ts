import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGoogleVertexOmniPayload } from '../frontend/src/server/video-providers/google-vertex-omni/payload';

test('Omni text-to-video payload uses Interactions video_config task and URL response format', async () => {
  const payload = await buildGoogleVertexOmniPayload({
    engineId: 'gemini-omni-flash',
    mode: 't2v',
    prompt: 'A 16:9 cinematic hero shot of a matte black espresso machine',
    aspectRatio: '16:9',
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'A 16:9 cinematic hero shot of a matte black espresso machine',
      mode: 't2v',
      aspectRatio: '16:9',
      extraInputValues: { store_interaction: true, prompt_audio_direction: 'soft cafe ambience' },
    },
  });

  assert.equal(payload.model, 'gemini-omni-flash-preview');
  assert.equal(payload.response_format, 'url');
  assert.equal(payload.background, true);
  assert.equal(payload.store, true);
  assert.deepEqual(payload.generation_config.video_config, {
    task: 'text_to_video',
    aspect_ratio: '16:9',
  });
  assert.match(JSON.stringify(payload.input), /soft cafe ambience/);
});

test('Omni reference-to-video payload forwards reference images and camera direction', async () => {
  const payload = await buildGoogleVertexOmniPayload({
    engineId: 'gemini-omni-flash',
    mode: 'ref2v',
    prompt: 'Keep the sneaker design consistent in a product video',
    aspectRatio: '9:16',
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'Keep the sneaker design consistent in a product video',
      mode: 'ref2v',
      aspectRatio: '9:16',
      referenceImages: ['https://cdn.maxvideoai.com/ref-a.png', 'https://cdn.maxvideoai.com/ref-b.png'],
      extraInputValues: { prompt_camera_direction: 'slow pedestal up' },
    },
  });

  assert.equal(payload.generation_config.video_config.task, 'reference_to_video');
  assert.equal(payload.generation_config.video_config.aspect_ratio, '9:16');
  assert.match(JSON.stringify(payload.input), /ref-a\.png/);
  assert.match(JSON.stringify(payload.input), /slow pedestal up/);
});

test('Omni retake payload preserves previous interaction id', async () => {
  const payload = await buildGoogleVertexOmniPayload({
    engineId: 'gemini-omni-flash',
    mode: 'retake',
    prompt: 'Make the camera slower and add more steam',
    aspectRatio: '16:9',
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'Make the camera slower and add more steam',
      mode: 'retake',
      aspectRatio: '16:9',
      extraInputValues: { previous_interaction_id: 'interactions/abc123' },
    },
  });

  assert.equal(payload.previous_interaction_id, 'interactions/abc123');
  assert.equal(payload.generation_config.video_config.task, 'video_edit');
});

test('Omni payload rejects unsupported negative prompt and seed before provider call', async () => {
  await assert.rejects(
    () =>
      buildGoogleVertexOmniPayload({
        engineId: 'gemini-omni-flash',
        mode: 't2v',
        prompt: 'test',
        aspectRatio: '16:9',
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
        falPayload: { engineId: 'gemini-omni-flash', prompt: 'test', mode: 't2v', aspectRatio: '16:9', seed: 7 },
      }),
    /seed/i
  );
});
