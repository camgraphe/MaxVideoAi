import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import ffprobe from 'ffprobe-static';
import { ensureExecutableFfmpegPath } from '@/server/ffmpeg-runtime';
import { createBoundedMediaDownloader } from '@/server/agent-api/reference-file-download';
import { VIDEO_EXCERPT_PREPARATION_LIMITS as limits, type VideoExcerptRange } from '@/lib/video-excerpt';
import { VideoExcerptError } from './media';

const exec = promisify(execFile);
export const downloadAudioExcerptMedia = createBoundedMediaDownloader({
  accepted: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/webm'],
  maxBytes: limits.maxBytes,
});
export type AudioExcerptFacts = { kind: 'audio'; durationSec: number; sampleRate: number; channels: number; codec: string };
async function workspace<T>(run: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'audio-excerpt-'));
  try { return await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
export async function inspectAudioExcerptBytes(bytes: Uint8Array): Promise<AudioExcerptFacts> {
  if (!bytes.length || bytes.length > limits.maxBytes) throw new VideoExcerptError('PREPARATION_LIMIT', 'Audio preparation size limit exceeded.');
  return workspace(async directory => {
    const source = join(directory, 'source');
    await writeFile(source, bytes);
    const { stdout } = await exec(ffprobe.path!, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_entries',
      'stream=codec_type,codec_name,sample_rate,channels:stream_disposition=attached_pic:format=duration', '-of', 'json', source], { timeout: 15_000, maxBuffer: 1024 * 1024 });
    const data = JSON.parse(stdout) as { streams: Array<{ codec_type: string; codec_name: string; sample_rate: string; channels: number; disposition?: { attached_pic?: number } }>; format: { duration: string } };
    const audio = data.streams.find(stream => stream.codec_type === 'audio');
    const durationSec = Number(data.format?.duration), sampleRate = Number(audio?.sample_rate);
    if (!audio || data.streams.some(stream => stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1)
      || !Number.isFinite(durationSec) || durationSec <= 0 || durationSec > limits.maxSourceSec
      || !Number.isFinite(sampleRate) || sampleRate <= 0 || ![1, 2].includes(audio.channels))
      throw new VideoExcerptError('PREPARATION_LIMIT', 'Use a mono or stereo audio source within the preparation duration limit.');
    return { kind: 'audio', durationSec, sampleRate, channels: audio.channels, codec: audio.codec_name };
  });
}
export function validateAudioExcerptOutput(source: AudioExcerptFacts, actual: AudioExcerptFacts, range: VideoExcerptRange) {
  if (!Number.isFinite(actual.durationSec) || Math.abs(actual.durationSec - (range.endSec - range.startSec)) > 1 / 48000 + 1e-8
    || actual.channels !== source.channels || actual.sampleRate !== 48000 || actual.codec !== 'pcm_s16le')
    throw new VideoExcerptError('PREPARATION_FAILED', 'Audio timing or channels were not preserved.');
}
export async function trimAudioExcerptBytes(bytes: Uint8Array, facts: AudioExcerptFacts, range: VideoExcerptRange) {
  const length = range.endSec - range.startSec;
  if (!Number.isFinite(range.startSec) || !Number.isFinite(range.endSec) || range.startSec < 0 || length <= 0 || range.endSec > facts.durationSec)
    throw new VideoExcerptError('PARAMETER_INVALID', 'Choose a valid audio range.');
  if (length > limits.maxExcerptSec) throw new VideoExcerptError('PREPARATION_LIMIT', 'Choose a passage up to 60 seconds.');
  const samples = Math.floor(length * 48000 + 1e-8);
  if (samples < 1) throw new VideoExcerptError('PARAMETER_INVALID', 'Choose at least one audio sample.');
  return workspace(async directory => {
    const source = join(directory, 'source'), output = join(directory, 'excerpt.wav');
    await writeFile(source, bytes);
    await exec(await ensureExecutableFfmpegPath(ffmpeg.path), ['-hide_banner', '-loglevel', 'error', '-nostdin', '-threads', '2',
      '-protocol_whitelist', 'file,pipe', '-i', source, '-map', '0:a:0', '-vn', '-map_metadata', '-1',
      '-af', `aresample=48000,atrim=start=${range.startSec},asetpts=PTS-STARTPTS,atrim=end_sample=${samples}`,
      '-c:a', 'pcm_s16le', '-ar', '48000', '-fs', String(limits.maxBytes), '-y', output], { timeout: 90_000, maxBuffer: 1024 * 1024 });
    if ((await stat(output)).size > limits.maxBytes) throw new VideoExcerptError('PREPARATION_LIMIT', 'Prepared audio is too large.');
    const result = await readFile(output), actual = await inspectAudioExcerptBytes(result);
    validateAudioExcerptOutput(facts, actual, range);
    return { bytes: result, facts: actual };
  });
}
