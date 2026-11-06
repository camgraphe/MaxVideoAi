import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import ffmpeg from '../frontend/node_modules/@ffmpeg-installer/ffmpeg';
import { ensureExecutableFfmpegPath } from '../frontend/server/ffmpeg-runtime';
import { inspectVideoExcerptBytes, trimVideoExcerptBytes } from '../frontend/server/video-excerpts/media';
import { inspectAudioExcerptBytes, trimAudioExcerptBytes } from '../frontend/server/video-excerpts/audio-media';

const exec = promisify(execFile);
test('selected video and audio contain the requested late content, not the beginning with the same duration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'recast-content-'));
  try {
    const bin = await ensureExecutableFfmpegPath(ffmpeg.path);
    const videoPath = join(dir, 'source.mp4'), audioPath = join(dir, 'source.wav');
    await exec(bin, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=160x120:r=30:d=10',
      '-f', 'lavfi', '-i', 'color=c=blue:s=160x120:r=30:d=16', '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]',
      '-map', '[v]', '-c:v', 'libx264', '-threads', '1', '-an', '-y', videoPath]);
    await exec(bin, ['-v', 'error', '-f', 'lavfi', '-i', 'aevalsrc=sin(2*PI*if(lt(t\\,8)\\,440\\,880)*t):s=48000:d=22',
      '-ac', '2', '-c:a', 'pcm_s16le', '-y', audioPath]);
    const video = await readFile(videoPath), audio = await readFile(audioPath);
    const preparedVideo = await trimVideoExcerptBytes(video, await inspectVideoExcerptBytes(video, 'video/mp4'), { startSec: 18, endSec: 25.5 }, 15);
    const preparedAudio = await trimAudioExcerptBytes(audio, await inspectAudioExcerptBytes(audio), { startSec: 8.25, endSec: 13.5 });
    assert.equal(preparedVideo.facts.durationSec, 7.5);
    assert.equal(preparedAudio.facts.durationSec, 5.25);
    assert.equal(preparedAudio.facts.channels, 2);
    const videoOut = join(dir, 'excerpt.mp4'), audioOut = join(dir, 'excerpt.wav');
    await writeFile(videoOut, preparedVideo.bytes); await writeFile(audioOut, preparedAudio.bytes);
    for (const second of ['0', '7.4']) {
      const { stdout } = await exec(bin, ['-v', 'error', '-ss', second, '-i', videoOut, '-frames:v', '1',
        '-vf', 'scale=1:1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'], { encoding: 'buffer' });
      assert.ok(stdout[2] > 200 && stdout[0] < 30, 'the entire selected passage is blue, not the earlier red section');
    }
    const { stdout: pcm } = await exec(bin, ['-v', 'error', '-ss', '0.1', '-i', audioOut, '-t', '1', '-ac', '1', '-ar', '48000', '-f', 's16le', 'pipe:1'], { encoding: 'buffer' });
    let crossings = 0;
    for (let i = 2; i < pcm.length; i += 2) if (pcm.readInt16LE(i - 2) <= 0 && pcm.readInt16LE(i) > 0) crossings++;
    assert.ok(Math.abs(crossings - 880) <= 2, `expected the later 880Hz passage, measured ${crossings}Hz`);
    assert.deepEqual(await readFile(videoPath), video);
    assert.deepEqual(await readFile(audioPath), audio);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
