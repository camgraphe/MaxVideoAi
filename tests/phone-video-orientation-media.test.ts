import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { probeMediaBuffer } from '../frontend/server/media/detect-has-audio';

test('the bundled ffprobe reads a rotated MOV without decoding every packet or changing bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'phone-orientation-'));
  try {
    const input = join(dir, 'landscape.mp4');
    const rotated = join(dir, 'phone.mov');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=size=64x32:rate=25',
      '-t', '0.4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', input], { timeout: 15_000 });
    const help = execFileSync('ffmpeg', ['-hide_banner', '-h', 'full'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    const rotationArgs = help.includes('-display_rotation')
      ? ['-display_rotation', '90', '-i', input, '-c', 'copy']
      : ['-i', input, '-c', 'copy', '-metadata:s:v:0', 'rotate=90'];
    execFileSync('ffmpeg', ['-v', 'error', ...rotationArgs, rotated], { timeout: 15_000 });
    const bytes = await readFile(rotated);
    const measured = await probeMediaBuffer(bytes, { fileName: 'phone.mov', mimeType: 'video/quicktime' });
    assert.equal(measured?.width, 32);
    assert.equal(measured?.height, 64);
    assert.equal(measured?.durationSec, 0.4);
    assert.deepEqual(await readFile(rotated), bytes);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
