import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { ensureExecutableFfmpegPath } from '../frontend/server/ffmpeg-runtime';
import { measureGeneratedVideoBuffer } from '../frontend/server/media/generated-video-facts';
const execute = promisify(execFile);
test('installed ffprobe measures real local files at 15.000 and 15.001 without rounding', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'duration-runtime-test-'));
  try {
    const binary = await ensureExecutableFfmpegPath(ffmpeg.path);
    for (const duration of [15, 15.001]) {
      const output = join(directory, `${duration}.mp4`);
      await execute(binary, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=16x16:r=1000',
        '-t', String(duration), '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-video_track_timescale', '1000', output],
        { timeout: 20_000, maxBuffer: 1024 * 1024 });
      const facts = await measureGeneratedVideoBuffer(await readFile(output), `https://owned.test/${duration}.mp4`);
      assert.ok(facts, 'packaged ffprobe must measure a valid fixture');
      assert.equal(facts.videoDurationSec, duration);
      assert.equal(facts.containerDurationSec, duration);
      assert.equal(facts.durationSec, duration);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
