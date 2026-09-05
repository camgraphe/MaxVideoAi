import assert from 'node:assert/strict';
import test from 'node:test';

import { dispatchAnalyticsEvent } from '../frontend/lib/analytics-client';
import { projectAllowedAnalyticsPayload } from '../frontend/lib/analytics/journey';

test('public playback analytics keeps only bounded allowlisted fields and values', () => {
  assert.deepEqual(projectAllowedAnalyticsPayload('public_video_startup', {
    asset_id: 'elevator-reunion',
    playback_profile: 'mobile',
    playback_surface: 'home',
    playback_trigger: 'user',
    measurement_method: 'video_frame_callback',
    duration_ms: 123,
    url: 'https://private.example/video.mp4?token=secret',
    prompt: 'private prompt',
    user_id: 'user-1',
    arbitrary: 'field',
  }), {
    asset_id: 'elevator-reunion', playback_profile: 'mobile', playback_surface: 'home',
    playback_trigger: 'user', measurement_method: 'video_frame_callback', duration_ms: 123,
  });

  assert.deepEqual(projectAllowedAnalyticsPayload('public_video_rebuffer', {
    asset_id: 'not-public', playback_profile: 'tablet', playback_surface: 'private',
    playback_trigger: 'hover', duration_ms: 120_001, rebuffer_count: 6,
  }), {});
  assert.deepEqual(projectAllowedAnalyticsPayload('public_video_error', {
    asset_id: 'mars-garden', playback_profile: 'desktop', playback_surface: 'examples',
    playback_trigger: 'automatic', media_error_code: 4, error_message: 'https://private.example',
  }), {
    asset_id: 'mars-garden', playback_profile: 'desktop', playback_surface: 'examples',
    playback_trigger: 'automatic', media_error_code: 4,
  });
});

test('dispatch blocks playback telemetry without analytics consent', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let dispatched = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: { getItem: () => null },
      sessionStorage: { removeItem() {} },
      dispatchEvent() { dispatched += 1; return true; },
    },
  });
  try {
    dispatchAnalyticsEvent('public_video_startup', {
      asset_id: 'elevator-reunion', playback_profile: 'mobile', playback_surface: 'home',
      playback_trigger: 'user', measurement_method: 'playing_fallback', duration_ms: 10,
    });
    assert.equal(dispatched, 0);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('consented dispatch excludes unknown events and private playback fields', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const details: unknown[] = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: { getItem: () => 'granted' },
      dispatchEvent(event: CustomEvent) { details.push(event.detail); return true; },
    },
  });
  try {
    dispatchAnalyticsEvent('public_video_private_debug', { url: 'https://private.example' });
    dispatchAnalyticsEvent('public_video_startup', {
      asset_id: 'elevator-reunion', playback_profile: 'mobile', playback_surface: 'home',
      playback_trigger: 'user', measurement_method: 'playing_fallback', duration_ms: 10,
      url: 'https://private.example/video.mp4?token=secret', prompt: 'private prompt',
    });
    assert.deepEqual(details, [{
      event: 'public_video_startup',
      payload: {
        asset_id: 'elevator-reunion', playback_profile: 'mobile', playback_surface: 'home',
        playback_trigger: 'user', measurement_method: 'playing_fallback', duration_ms: 10,
      },
    }]);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
