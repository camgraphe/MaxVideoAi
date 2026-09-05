import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvePublicVideoFfmpegPath } from '../frontend/scripts/_lib/public-video-ffmpeg';

test('public video encoding keeps a compatible bundled FFmpeg', async () => {
  const attempted: string[] = [];
  const resolved = await resolvePublicVideoFfmpegPath({
    bundledPath: '/bundled/ffmpeg',
    verify: async (candidate) => { attempted.push(candidate); return '/executable/ffmpeg'; },
  });
  assert.equal(resolved, '/executable/ffmpeg');
  assert.deepEqual(attempted, ['/bundled/ffmpeg']);
});

test('an old bundled encoder falls back to compatible FFmpeg on PATH', async () => {
  const attempted: string[] = [];
  const resolved = await resolvePublicVideoFfmpegPath({
    bundledPath: '/bundled/old-ffmpeg',
    verify: async (candidate) => {
      attempted.push(candidate);
      if (candidate === '/bundled/old-ffmpeg') throw new Error('force_divisible_by is unavailable');
      return candidate;
    },
  });
  assert.equal(resolved, 'ffmpeg');
  assert.deepEqual(attempted, ['/bundled/old-ffmpeg', 'ffmpeg']);
});

test('an explicitly selected encoder is never silently replaced', async () => {
  const attempted: string[] = [];
  await assert.rejects(resolvePublicVideoFfmpegPath({
    bundledPath: '/bundled/ffmpeg',
    overridePath: ' /chosen/ffmpeg ',
    verify: async (candidate) => { attempted.push(candidate); throw new Error('unsupported filter'); },
  }), /PUBLIC_VIDEO_FFMPEG_PATH.*\/chosen\/ffmpeg: unsupported filter/);
  assert.deepEqual(attempted, ['/chosen/ffmpeg']);
});

test('missing compatible encoders report an actionable error before encoding', async () => {
  await assert.rejects(resolvePublicVideoFfmpegPath({
    bundledPath: '/bundled/old-ffmpeg',
    verify: async () => { throw new Error('unavailable'); },
  }), /Install a current FFmpeg with libx264 and scale force_divisible_by support/);
});
