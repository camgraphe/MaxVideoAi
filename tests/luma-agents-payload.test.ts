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
      durationSec: 10,
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
        duration: '10s',
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

test('Reframe sends the billed duration when a stale duration label accompanies the request', () => {
  const payload = buildLumaAgentsVideoPayload({ engineId: 'luma-ray-3-2', mode: 'reframe',
    prompt: 'Extend the canvas.', durationSec: 10, durationOption: '5s', resolution: '720p',
    aspectRatio: '16:9', videoUrl: 'https://cdn.maxvideoai.com/source.mp4' });
  assert.equal(payload.video.duration, '10s');
});

for (const durationSec of [5.558333, 6, 8.4, 18]) {
  test(`Modify leaves ${durationSec}s timing to the source, never a generation preset`, () => {
    const payload = buildLumaAgentsVideoPayload({ engineId: 'luma-ray-3-2', mode: 'v2v',
      prompt: 'Replace the background while preserving the person', durationSec,
      durationOption: '5s', resolution: '720p', videoUrl: 'https://cdn.maxvideoai.com/phone.mov',
      sourceVideoMimeType: 'video/quicktime', imageUrl: 'https://cdn.maxvideoai.com/guide.png',
      extraInputValues: { edit_face_enabled: true, edit_pose_enabled: true } });
    assert.equal(Object.hasOwn(payload.video, 'duration'), false);
    assert.equal(payload.source?.media_type, 'video/quicktime');
    assert.deepEqual(payload.video.start_frame, { url: 'https://cdn.maxvideoai.com/guide.png' });
  });
}

const modify = (extraInputValues: Record<string, unknown>) => buildLumaAgentsVideoPayload({
  engineId: 'luma-ray-3-2', mode: 'v2v', prompt: 'Private prompt', durationSec: 18,
  videoUrl: 'https://private.example/source.mp4', extraInputValues,
}).video.edit;

test('manual preset and signals coexist, including explicit disabled signals', () => {
  assert.deepEqual(modify({ edit_control_mode: 'manual', edit_strength: 'adhere_1', edit_face_mode: 'off',
    edit_pose_mode: 'on', edit_pose_strength: 'precise', edit_depth_mode: 'off', edit_depth_blur: 0.5 }), {
    strength: 'adhere_1', controls: { pose: { enabled: true, strength: 'precise' }, depth: { enabled: false }, face: { enabled: false } },
  });
});
test('legacy false and off remain omitted while legacy preset is no longer dropped', () => {
  assert.deepEqual(modify({ edit_strength: 'adhere_1', edit_face: true, edit_pose_strength: 'off' }), {
    strength: 'adhere_1', controls: { face: { enabled: true } },
  });
  assert.deepEqual(modify({ edit_control_mode: 'manual', edit_face: false, edit_pose_strength: 'off' }), {});
});
test('automatic excludes active manual controls and manual may omit a preset', () => {
  assert.throws(() => modify({ edit_control_mode: 'automatic', edit_face_mode: 'on' }), /automatic/i);
  assert.throws(() => modify({ edit_control_mode: 'automatic', edit_strength: 'adhere_1' }), /automatic/i);
  assert.deepEqual(modify({ edit_control_mode: 'automatic' }), { auto_controls: true });
  assert.deepEqual(modify({ edit_control_mode: 'manual', edit_strength: 'auto', edit_face_mode: 'default' }), {});
});

test('creation accepts 1–64 indexed images without replacing start/end fields', () => {
  const urls = Array.from({length: 64}, (_, index) => `https://example.com/${index}.png`);
  const payload = buildLumaAgentsVideoPayload({engineId:'luma-ray-3-2',mode:'t2v',prompt:'Create',durationSec:5,
    keyframeUrls:urls,extraInputValues:{keyframe_indexes:urls.map((_,i)=>i).join(',')}});
  assert.equal(payload.video.keyframes?.length,64);
  assert.deepEqual(payload.video.keyframe_indexes,urls.map((_,i)=>i));
  for (const indexes of ['0,0','0.5,1','-1,1','0']) assert.throws(()=>buildLumaAgentsVideoPayload({engineId:'luma-ray-3-2',mode:'t2v',prompt:'Create',durationSec:5,
    keyframeUrls:urls.slice(0,2),extraInputValues:{keyframe_indexes:indexes}}));
});
test('extend uses only a trusted forward/backward generation anchor', () => {
  for (const direction of ['forward','backward'] as const) {
    const payload=buildLumaAgentsVideoPayload({engineId:'luma-ray-3-2',mode:'extend',prompt:'Continue',durationSec:5,
      trustedGenerationSource:{providerGenerationId:'private-id'},extendDirection:direction});
    assert.equal(payload.source,undefined);
    assert.deepEqual(payload.video[direction==='forward'?'start_frame':'end_frame'],{generation_id:'private-id'});
  }
});


test('Extend rejects mixed anchors, unsupported flags, durations and backward loops', () => {
  const base = { engineId: 'luma-ray-3-2', mode: 'extend', prompt: 'Continue', durationSec: 5,
    trustedGenerationSource: { providerGenerationId: 'private-id' } };
  for (const patch of [{ videoUrl: 'https://private.example/video' }, { imageUrl: 'https://private.example/start' },
    { endImageUrl: 'https://private.example/end' }, { keyframeUrls: ['https://private.example/key'] },
    { extraInputValues: { hdr: true } }, { extraInputValues: { exr_export: true } }, { durationSec: 10 },
    { extraInputValues: { keyframe_indexes: '0' } }, { extendDirection: 'backward', loop: true }, { extendDirection: 'sideways' }]) {
    assert.throws(() => buildLumaAgentsVideoPayload({ ...base, ...patch } as Parameters<typeof buildLumaAgentsVideoPayload>[0]));
  }
});
