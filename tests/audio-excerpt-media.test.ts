import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import ffmpeg from '../frontend/node_modules/@ffmpeg-installer/ffmpeg';
import { ensureExecutableFfmpegPath } from '../frontend/server/ffmpeg-runtime';
import { inspectAudioExcerptBytes, trimAudioExcerptBytes } from '../frontend/server/video-excerpts/audio-media';
const exec = promisify(execFile);

test('real audio excerpts preserve channels and exact integer/fractional timing without modifying the source', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'audio-excerpt-test-'));
  try {
    for (const channels of [1, 2]) {
      const path = join(directory, `source-${channels}.wav`);
      await exec(await ensureExecutableFfmpegPath(ffmpeg.path), ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=7', '-ac', String(channels), '-y', path]);
      const original = await readFile(path), hash = createHash('sha256').update(original).digest('hex');
      const facts = await inspectAudioExcerptBytes(original);
      assert.equal(facts.durationSec, 7);
      for (const range of [{ startSec: 1, endSec: 6 }, { startSec: 2.125, endSec: 5.683333 }]) {
        const result = await trimAudioExcerptBytes(original, facts, range);
        assert.equal(result.facts.channels, channels);
        assert.equal(result.facts.sampleRate, 48000);
        assert.ok(result.facts.durationSec <= range.endSec - range.startSec + 1e-7);
        assert.ok(Math.abs(result.facts.durationSec - (range.endSec - range.startSec)) < 1 / 48000);
        assert.equal(result.facts.codec, 'pcm_s16le');
      }
      await assert.rejects(trimAudioExcerptBytes(original, facts, { startSec: 4, endSec: 8 }));
      assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'), hash);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('compressed MP3 and M4A references decode into the requested passage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'audio-reference-formats-'));
  try {
    for (const [extension, codec] of [['mp3', 'libmp3lame'], ['m4a', 'aac']]) {
      const path = join(directory, `reference.${extension}`);
      await exec(await ensureExecutableFfmpegPath(ffmpeg.path), ['-v', 'error', '-f', 'lavfi', '-i',
        'sine=frequency=440:sample_rate=44100:duration=7', '-ac', '2', '-c:a', codec, '-y', path]);
      const original = await readFile(path);
      const facts = await inspectAudioExcerptBytes(original);
      const range = { startSec: 1.25, endSec: 5.75 };
      const result = await trimAudioExcerptBytes(original, facts, range);
      assert.equal(result.facts.durationSec, 4.5, extension);
      assert.equal(result.facts.channels, 2);
      assert.deepEqual(await readFile(path), original);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
