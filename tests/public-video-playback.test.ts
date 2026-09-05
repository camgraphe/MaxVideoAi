import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPublicVideoOriginalFallbackAttempt,
  createPublicVideoPlaybackMeasurement,
  selectPublicVideoPlaybackRendition,
  type PublicVideoPlaybackAttempt,
} from '../frontend/lib/public-video-playback';

const ORIGINAL = 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/6e299d72-22dd-46f4-8260-4d6887777558.mp4';

test('source selection uses viewport and explicit data-saving playback without changing unknown inputs', () => {
  const mobile = selectPublicVideoPlaybackRendition(ORIGINAL, {
    viewportWidth: 390, saveData: false, trigger: 'user',
  });
  assert.equal(mobile.profile, 'mobile');
  assert.notEqual(mobile.src, ORIGINAL);

  const desktop = selectPublicVideoPlaybackRendition(ORIGINAL, {
    viewportWidth: 1440, saveData: false, trigger: 'automatic',
  });
  assert.equal(desktop.profile, 'desktop');
  assert.notEqual(desktop.src, ORIGINAL);

  const dataSavingClick = selectPublicVideoPlaybackRendition(ORIGINAL, {
    viewportWidth: 1440, saveData: true, trigger: 'user',
  });
  assert.equal(dataSavingClick.profile, 'mobile');

  const signed = 'https://private.example/render.mp4?signature=secret';
  assert.deepEqual(selectPublicVideoPlaybackRendition(signed, {
    viewportWidth: 390, saveData: false, trigger: 'user',
  }), { src: signed, originalSrc: signed, assetId: null, profile: 'original' });
});

test('original fallback retains the initial user startup clock', () => {
  const attempt = knownAttempt({ startedAt: 123 });
  const fallback = createPublicVideoOriginalFallbackAttempt(attempt, 2);
  assert.equal(fallback.startedAt, 123);
  assert.equal(fallback.rendition.src, ORIGINAL);
  assert.equal(fallback.rendition.profile, 'original');
  assert.equal(fallback.usedOriginalFallback, true);
});

function knownAttempt(overrides: Partial<PublicVideoPlaybackAttempt> = {}): PublicVideoPlaybackAttempt {
  return {
    id: 1,
    rendition: {
      src: '/mobile.mp4', originalSrc: ORIGINAL, assetId: 'elevator-reunion', profile: 'mobile',
    },
    trigger: 'user',
    startedAt: 10,
    usedOriginalFallback: false,
    ...overrides,
  };
}

test('measurement reports one presented frame, bounded visible rebuffering, and cancels stale frame callbacks', () => {
  let clock = 20;
  let nextFrame = 1;
  const frames = new Map<number, (now: number, metadata: { expectedDisplayTime: number }) => void>();
  const cancelled: number[] = [];
  const events: Array<{ event: string; payload: Record<string, string | number> }> = [];
  const video = {
    requestVideoFrameCallback(callback: (now: number, metadata: { expectedDisplayTime: number }) => void) {
      const handle = nextFrame++;
      frames.set(handle, callback);
      return handle;
    },
    cancelVideoFrameCallback(handle: number) { cancelled.push(handle); },
  } as unknown as HTMLVideoElement;
  const measurement = createPublicVideoPlaybackMeasurement({
    attempt: knownAttempt(), surface: 'home', now: () => clock,
    emit: (event, payload) => events.push({ event, payload }),
  });

  measurement.setContext({ intended: true, visible: true });
  measurement.waiting();
  measurement.attach(video);
  assert.equal(frames.size, 1, 'the first presented-frame callback is armed before playing');
  measurement.playing(video);
  assert.equal(events.length, 0, 'playing does not prove a presented frame when the frame API exists');
  const staleFrame = frames.get(1)!;
  measurement.pause();
  assert.deepEqual(cancelled, [1]);
  staleFrame(25, { expectedDisplayTime: 25 });
  assert.equal(events.length, 0, 'a cancelled late frame cannot report an obsolete attempt');

  measurement.playing(video);
  frames.get(2)!(28, { expectedDisplayTime: 30 });
  assert.deepEqual(events, [{
    event: 'public_video_startup',
    payload: {
      asset_id: 'elevator-reunion', playback_profile: 'mobile', playback_surface: 'home',
      playback_trigger: 'user', measurement_method: 'video_frame_callback', duration_ms: 20,
    },
  }]);

  clock = 40;
  measurement.waiting();
  clock = 60;
  measurement.setContext({ intended: true, visible: false });
  clock = 90;
  measurement.setContext({ intended: true, visible: true });
  measurement.playing(video);
  assert.equal(events.length, 1, 'hidden time is not reported as rebuffering');

  clock = 100;
  measurement.waiting();
  clock = 160;
  measurement.playing(video);
  assert.deepEqual(events[1], {
    event: 'public_video_rebuffer',
    payload: {
      asset_id: 'elevator-reunion', playback_profile: 'mobile', playback_surface: 'home',
      playback_trigger: 'user', duration_ms: 60, rebuffer_count: 1,
    },
  });
  measurement.dispose();
  clock = 200;
  measurement.waiting();
  measurement.error(4);
  assert.equal(events.length, 2);
});

test('playing fallback is labelled separately and unknown sources emit no public asset telemetry', () => {
  const events: Array<{ event: string; payload: Record<string, string | number> }> = [];
  const fallback = createPublicVideoPlaybackMeasurement({
    attempt: knownAttempt(), surface: 'model', now: () => 42,
    emit: (event, payload) => events.push({ event, payload }),
  });
  fallback.setContext({ intended: true, visible: true });
  fallback.playing({} as HTMLVideoElement);
  fallback.playing({} as HTMLVideoElement);
  fallback.error(99);
  assert.equal(events[0]?.payload.measurement_method, 'playing_fallback');
  assert.equal(events.filter(({ event }) => event === 'public_video_startup').length, 1);
  assert.equal(Object.hasOwn(events[1]?.payload ?? {}, 'media_error_code'), false);

  const unknown = createPublicVideoPlaybackMeasurement({
    attempt: knownAttempt({
      rendition: { src: '/private.mp4', originalSrc: '/private.mp4', assetId: null, profile: 'original' },
    }),
    surface: 'examples', emit: (event, payload) => events.push({ event, payload }),
  });
  unknown.setContext({ intended: true, visible: true });
  unknown.playing({} as HTMLVideoElement);
  unknown.waiting();
  unknown.error(2);
  assert.equal(events.length, 2, 'unknown/private sources cannot fabricate a public asset id');
});

test('measurement caps rebuffer duration, event count, and media errors per attempt', () => {
  let clock = 0;
  const events: Array<{ event: string; payload: Record<string, string | number> }> = [];
  const measurement = createPublicVideoPlaybackMeasurement({
    attempt: knownAttempt({ startedAt: 0 }), surface: 'home', now: () => clock,
    emit: (event, payload) => events.push({ event, payload }),
  });
  measurement.setContext({ intended: true, visible: true });
  measurement.playing({} as HTMLVideoElement);
  for (let index = 0; index < 7; index += 1) {
    clock += 1;
    measurement.waiting();
    clock += 200_000;
    measurement.playing({} as HTMLVideoElement);
  }
  measurement.error(1);
  measurement.error(2);
  measurement.error(3);

  const rebuffers = events.filter(({ event }) => event === 'public_video_rebuffer');
  const errors = events.filter(({ event }) => event === 'public_video_error');
  assert.equal(rebuffers.length, 5);
  assert.ok(rebuffers.every(({ payload }) => payload.duration_ms === 120_000));
  assert.equal(errors.length, 2);
});
