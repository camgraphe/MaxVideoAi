import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { validatePreparedRendition } from '../frontend/scripts/_lib/public-video-renditions';
import {
  encodePublicVideoRendition,
  getPublicVideoFfmpegPath,
  probeMediaFile,
} from '../frontend/scripts/_lib/public-video-renditions-runtime';

const execFileAsync = promisify(execFile);

test('real CFR H264/AAC fixture preserves frame and AAC packet timelines through a rendition', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'public-rendition-real-'));
  try {
    const sourcePath = path.join(directory, 'source.mp4');
    const outputPath = path.join(directory, 'desktop.mp4');
    const ffmpegPath = await getPublicVideoFfmpegPath();
    await execFileAsync(ffmpegPath, [
      '-hide_banner', '-nostdin', '-v', 'error',
      '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=24:duration=1',
      '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000:duration=0.9',
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'slow', '-crf', '0',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', sourcePath,
    ], { timeout: 60_000, maxBuffer: 1024 * 1024 });

    const sourceProbe = await probeMediaFile(sourcePath);
    await encodePublicVideoRendition(sourcePath, outputPath, sourceProbe, 'desktop');
    const outputProbe = await probeMediaFile(outputPath);
    const sourceBytes = (await stat(sourcePath)).size;
    const outputBytes = (await stat(outputPath)).size;

    assert.equal(sourceProbe.frameRate.numerator / sourceProbe.frameRate.denominator, 24);
    assert.equal(sourceProbe.videoFrameCount, 24);
    assert.ok(sourceProbe.audio && sourceProbe.audio.durationSeconds < sourceProbe.durationSeconds);
    assert.equal(outputProbe.cadence.timestampsSha256, sourceProbe.cadence.timestampsSha256);
    assert.equal(outputProbe.audio?.packetPayloadSha256, sourceProbe.audio?.packetPayloadSha256);
    assert.doesNotThrow(() => validatePreparedRendition({ sourceBytes, outputBytes, sourceProbe, outputProbe }, 'desktop'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
