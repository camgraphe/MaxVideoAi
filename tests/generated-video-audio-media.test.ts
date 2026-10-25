import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeGeneratedVideoAudio } from '../frontend/server/media/generated-video-audio';
import { probeMediaBuffer } from '../frontend/server/media/detect-has-audio';

test('silent delivery removes audio without changing encoded video packets, dimensions or duration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'silent-output-test-'));
  try {
    const input = join(dir, 'input.mp4'), output = join(dir, 'silent.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=size=32x64:rate=25',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '0.4',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', input], { timeout: 15_000 });
    const original = await readFile(input), before = await probeMediaBuffer(original, { fileName: 'input.mp4' });
    assert.equal(before?.hasAudio, true);
    const silent = await removeGeneratedVideoAudio(original);
    await writeFile(output, silent);
    const after = await probeMediaBuffer(silent, { fileName: 'silent.mp4' });
    assert.equal(after?.hasAudio, false);
    assert.deepEqual([after?.width, after?.height, after?.durationSec], [before?.width, before?.height, before?.durationSec]);
    const packetHash = (file: string) => execFileSync('ffmpeg', ['-v', 'error', '-i', file,
      '-map', '0:v:0', '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-'], { encoding: 'utf8', timeout: 15_000 });
    assert.equal(packetHash(output), packetHash(input));
    assert.deepEqual(await readFile(input), original);
    assert.equal((await probeMediaBuffer(await removeGeneratedVideoAudio(silent), { fileName: 'silent.mp4' }))?.hasAudio, false);
    await assert.rejects(removeGeneratedVideoAudio(Buffer.from('not a video')));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
