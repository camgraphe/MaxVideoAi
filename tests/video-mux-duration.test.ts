import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildVideoPreservingMuxArgs } from '../frontend/src/server/audio/video-mux-args';

test('real mux preserves every video frame with 0.5s and 30s missing audio tails and longer audio', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mux-duration-'));
  const run = (args: string[]) => execFileSync('ffmpeg', ['-v', 'error', ...args], { timeout: 30_000 });
  const frames = (file: string) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'json', file], { encoding: 'utf8' })).streams[0].nb_read_frames;
  try {
    const video = join(dir, 'video.mp4'), audio = join(dir, 'audio.m4a'), output = join(dir, 'out.mp4');
    for (const [videoSec, audioSec] of [[2, 1.5], [31, 1], [2, 5]]) {
      run(['-y', '-f', 'lavfi', '-i', 'testsrc2=s=64x64:r=24', '-t', String(videoSec), '-c:v', 'libx264', video]);
      run(['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', String(audioSec), '-c:a', 'aac', audio]);
      run(buildVideoPreservingMuxArgs(video, audio, output));
      assert.equal(frames(output), frames(video), `${videoSec}s video / ${audioSec}s audio`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
