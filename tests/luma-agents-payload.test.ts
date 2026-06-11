import assert from 'node:assert/strict';
import test from 'node:test';

import { LumaAgentsError } from '../frontend/src/server/video-providers/luma-agents/errors';
import { buildLumaAgentsVideoPayload } from '../frontend/src/server/video-providers/luma-agents/payload';

test('Luma Ray 3.2 text-to-video payload maps public settings', () => {
  assert.deepEqual(
    buildLumaAgentsVideoPayload({
      engineId: 'luma-ray-3-2',
      mode: 't2v',
      prompt: 'A cinematic tram at night',
      durationSec: 5,
      durationOption: '5s',
      aspectRatio: '16:9',
      resolution: '720p',
      loop: true,
      imageUrl: null,
      endImageUrl: null,
      videoUrl: null,
      referenceImageUrls: [],
      extraInputValues: null,
    }),
    {
      model: 'ray-3.2',
      type: 'video',
      prompt: 'A cinematic tram at night',
      aspect_ratio: '16:9',
      video: {
        resolution: '720p',
        duration: '5s',
        loop: true,
      },
    }
  );
});

test('Luma Ray 3.2 image-to-video payload maps start and end frames', () => {
  const payload = buildLumaAgentsVideoPayload({
    engineId: 'luma-ray-3-2',
    mode: 'i2v',
    prompt: 'Subtle product push-in',
    durationSec: 5,
    durationOption: '5s',
    aspectRatio: '9:16',
    resolution: '1080p',
    loop: false,
    imageUrl: 'https://cdn.maxvideoai.com/start.png',
    endImageUrl: 'https://cdn.maxvideoai.com/end.png',
    videoUrl: null,
    referenceImageUrls: [],
    extraInputValues: null,
  });

  assert.deepEqual(payload.video, {
    resolution: '1080p',
    duration: '5s',
    start_frame: { url: 'https://cdn.maxvideoai.com/start.png' },
    end_frame: { url: 'https://cdn.maxvideoai.com/end.png' },
  });
});

test('Luma Ray 3.2 direct payload rejects fal-only aspect ratios before submit', () => {
  assert.throws(
    () =>
      buildLumaAgentsVideoPayload({
        engineId: 'luma-ray-3-2',
        mode: 't2v',
        prompt: 'Wide product shot',
        durationSec: 5,
        durationOption: '5s',
        aspectRatio: '3:1',
        resolution: '720p',
        loop: false,
        imageUrl: null,
        endImageUrl: null,
        videoUrl: null,
        referenceImageUrls: [],
        extraInputValues: null,
      }),
    (error) => error instanceof LumaAgentsError && error.errorClass === 'invalid_request'
  );
});

test('Luma Ray 3.2 direct payload rejects incompatible 10s public combinations', () => {
  assert.throws(
    () =>
      buildLumaAgentsVideoPayload({
        engineId: 'luma-ray-3-2',
        mode: 'i2v',
        prompt: 'Animate this frame',
        durationSec: 10,
        durationOption: '10s',
        aspectRatio: '16:9',
        resolution: '720p',
        loop: false,
        imageUrl: 'https://cdn.maxvideoai.com/start.png',
        endImageUrl: null,
        videoUrl: null,
        referenceImageUrls: [],
        extraInputValues: null,
      }),
    /10s/
  );

  assert.throws(
    () =>
      buildLumaAgentsVideoPayload({
        engineId: 'luma-ray-3-2',
        mode: 't2v',
        prompt: 'Loop this shot',
        durationSec: 10,
        durationOption: '10s',
        aspectRatio: '16:9',
        resolution: '720p',
        loop: true,
        imageUrl: null,
        endImageUrl: null,
        videoUrl: null,
        referenceImageUrls: [],
        extraInputValues: null,
      }),
    /loop/
  );
});

test('Luma Ray 3.2 emits public direct HDR and EXR requests', () => {
  const payload = buildLumaAgentsVideoPayload({
    engineId: 'luma-ray-3-2',
    mode: 't2v',
    prompt: 'A high dynamic range city',
    durationSec: 5,
    durationOption: '5s',
    aspectRatio: '16:9',
    resolution: '1080p',
    loop: false,
    imageUrl: null,
    endImageUrl: null,
    videoUrl: null,
    referenceImageUrls: [],
    extraInputValues: { hdr: true, exr_export: true },
    advancedDirectOnlyEnabled: false,
  });

  assert.equal(payload.video.hdr, true);
  assert.equal(payload.video.exr_export, true);
});

test('Luma Ray 3.2 rejects HDR and EXR incompatible requests', () => {
  assert.throws(
    () =>
      buildLumaAgentsVideoPayload({
        engineId: 'luma-ray-3-2',
        mode: 't2v',
        prompt: 'HDR at unsupported resolution',
        durationSec: 5,
        durationOption: '5s',
        aspectRatio: '16:9',
        resolution: '540p',
        loop: false,
        imageUrl: null,
        endImageUrl: null,
        videoUrl: null,
        referenceImageUrls: [],
        extraInputValues: { hdr: true },
      }),
    (error) =>
      error instanceof LumaAgentsError &&
      error.errorClass === 'invalid_request' &&
      error.code === 'LUMA_AGENTS_HDR_RESOLUTION_UNSUPPORTED'
  );
  assert.throws(
    () =>
      buildLumaAgentsVideoPayload({
        engineId: 'luma-ray-3-2',
        mode: 't2v',
        prompt: 'EXR without HDR',
        durationSec: 5,
        durationOption: '5s',
        aspectRatio: '16:9',
        resolution: '720p',
        loop: false,
        imageUrl: null,
        endImageUrl: null,
        videoUrl: null,
        referenceImageUrls: [],
        extraInputValues: { exr_export: true },
      }),
    (error) =>
      error instanceof LumaAgentsError &&
      error.errorClass === 'invalid_request' &&
      error.code === 'LUMA_AGENTS_EXR_REQUIRES_HDR'
  );
});

test('Luma Ray 3.2 video-to-video payload maps source and auto Modify edit', () => {
  assert.deepEqual(
    buildLumaAgentsVideoPayload({
      engineId: 'luma-ray-3-2',
      mode: 'v2v',
      prompt: 'Keep the camera motion, change the product into brushed steel',
      durationSec: 5,
      durationOption: '5s',
      aspectRatio: null,
      resolution: '720p',
      loop: false,
      imageUrl: null,
      endImageUrl: null,
      videoUrl: 'https://cdn.maxvideoai.com/source.mp4',
      sourceVideoMimeType: 'video/mp4',
      keyframeUrls: [],
      referenceImageUrls: [],
      extraInputValues: null,
    }),
    {
      model: 'ray-3.2',
      type: 'video_edit',
      prompt: 'Keep the camera motion, change the product into brushed steel',
      source: { url: 'https://cdn.maxvideoai.com/source.mp4', media_type: 'video/mp4' },
      video: {
        resolution: '720p',
        duration: '5s',
        edit: { auto_controls: true },
      },
    }
  );
});

test('Luma Ray 3.2 video-to-video payload maps guide keyframes and strength', () => {
  const payload = buildLumaAgentsVideoPayload({
    engineId: 'luma-ray-3-2',
    mode: 'v2v',
    prompt: 'Preserve blocking, reimagine the environment as a bright showroom',
    durationSec: 10,
    durationOption: '10s',
    aspectRatio: null,
    resolution: '1080p',
    loop: false,
    imageUrl: null,
    endImageUrl: null,
    videoUrl: 'https://cdn.maxvideoai.com/source.mov',
    sourceVideoMimeType: 'video/quicktime',
    keyframeUrls: ['https://cdn.maxvideoai.com/key-a.png', 'https://cdn.maxvideoai.com/key-b.png'],
    referenceImageUrls: [],
    extraInputValues: {
      edit_strength: 'flex_2',
      edit_keyframe_indexes: '0, 96',
    },
  });

  assert.deepEqual(payload.source, {
    url: 'https://cdn.maxvideoai.com/source.mov',
    media_type: 'video/quicktime',
  });
  assert.deepEqual(payload.video.edit, {
    strength: 'flex_2',
    keyframes: [{ url: 'https://cdn.maxvideoai.com/key-a.png' }, { url: 'https://cdn.maxvideoai.com/key-b.png' }],
    keyframe_indexes: [0, 96],
  });
});

test('Luma Ray 3.2 video-to-video rejects single guide frame combined with keyframes', () => {
  assert.throws(
    () =>
      buildLumaAgentsVideoPayload({
        engineId: 'luma-ray-3-2',
        mode: 'v2v',
        prompt: 'Combine conflicting guides',
        durationSec: 5,
        durationOption: '5s',
        aspectRatio: null,
        resolution: '720p',
        loop: false,
        imageUrl: 'https://cdn.maxvideoai.com/guide.png',
        endImageUrl: null,
        videoUrl: 'https://cdn.maxvideoai.com/source.mp4',
        sourceVideoMimeType: 'video/mp4',
        keyframeUrls: ['https://cdn.maxvideoai.com/key-a.png'],
        referenceImageUrls: [],
        extraInputValues: { edit_keyframe_indexes: '12' },
      }),
    (error) =>
      error instanceof LumaAgentsError &&
      error.errorClass === 'invalid_request' &&
      error.code === 'LUMA_AGENTS_EDIT_FRAME_CONFLICT'
  );
});

test('Luma Ray 3.2 reframe payload maps source, aspect ratio, and source position', () => {
  assert.deepEqual(
    buildLumaAgentsVideoPayload({
      engineId: 'luma-ray-3-2',
      mode: 'reframe',
      prompt: 'Keep the surfer centered and extend the wave into vertical social framing',
      durationSec: 8,
      durationOption: null,
      aspectRatio: '9:16',
      resolution: '720p',
      loop: false,
      imageUrl: null,
      endImageUrl: null,
      videoUrl: 'https://cdn.maxvideoai.com/source.webm',
      sourceVideoMimeType: 'video/webm',
      referenceImageUrls: [],
      extraInputValues: {
        source_position_x_norm: 0.1,
        source_position_y_norm: -0.2,
        source_position_w_norm: 0.8,
        source_position_h_norm: 1.2,
      },
    }),
    {
      model: 'ray-3.2',
      type: 'video_reframe',
      prompt: 'Keep the surfer centered and extend the wave into vertical social framing',
      aspect_ratio: '9:16',
      source: { url: 'https://cdn.maxvideoai.com/source.webm', media_type: 'video/webm' },
      video: {
        resolution: '720p',
        source_position: {
          x_norm: 0.1,
          y_norm: -0.2,
          w_norm: 0.8,
          h_norm: 1.2,
        },
      },
    }
  );
});

test('Luma Ray 3.2 reframe rejects vertical 1080p targets', () => {
  assert.throws(
    () =>
      buildLumaAgentsVideoPayload({
        engineId: 'luma-ray-3-2',
        mode: 'reframe',
        prompt: 'Make it vertical',
        durationSec: 5,
        durationOption: '5s',
        aspectRatio: '9:16',
        resolution: '1080p',
        loop: false,
        imageUrl: null,
        endImageUrl: null,
        videoUrl: 'https://cdn.maxvideoai.com/source.mp4',
        referenceImageUrls: [],
        extraInputValues: null,
      }),
    (error) =>
      error instanceof LumaAgentsError &&
      error.errorClass === 'invalid_request' &&
      error.code === 'LUMA_AGENTS_REFRAME_VERTICAL_1080P_UNSUPPORTED'
  );
});

test('Luma Ray 3.2 direct payload rejects extend instead of dropping the source video', () => {
  assert.throws(
    () =>
      buildLumaAgentsVideoPayload({
        engineId: 'luma-ray-3-2',
        mode: 'extend',
        prompt: 'Continue this clip',
        durationSec: 5,
        durationOption: '5s',
        aspectRatio: '16:9',
        resolution: '720p',
        loop: false,
        imageUrl: null,
        endImageUrl: null,
        videoUrl: 'https://cdn.maxvideoai.com/source.mp4',
        referenceImageUrls: [],
        extraInputValues: null,
        advancedDirectOnlyEnabled: true,
      }),
    (error) =>
      error instanceof LumaAgentsError &&
      error.errorClass === 'invalid_request' &&
      error.code === 'LUMA_AGENTS_EXTEND_UNSUPPORTED'
  );
});
