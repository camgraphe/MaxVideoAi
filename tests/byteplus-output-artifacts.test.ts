import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import ffprobe from 'ffprobe-static';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { ensureExecutableFfmpegPath } from '../frontend/server/ffmpeg-runtime';
import { copyProviderVideoOriginal } from '../frontend/server/provider-video-original-copy';
import { normalizeBytePlusTask } from '../frontend/src/server/video-providers/byteplus-modelark-response';
import { mapLegacyJobRowToOutputs } from '../frontend/server/media-library-records';
import { applyOutputsToJobPayload } from '../frontend/server/media-library/job-outputs';
import { requiresBytePlusDurableEditOutput, bytePlusRequestedOutputOptions } from '../frontend/server/byteplus-output-persistence';

const execute = promisify(execFile);

export async function createMovFixture(directory: string) {
  const binary = await ensureExecutableFfmpegPath(ffmpeg.path);
  const source = join(directory, 'source.mov');
  await execute(binary, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=64x48:r=24',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '1', '-c:v', 'libx264',
    '-pix_fmt', 'yuv444p', '-c:a', 'pcm_s16le', source]);
  return source;
}

test('MOV original copy retains actual yuv444/PCM bytes and QuickTime identity', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'byteplus-mov-test-'));
  try {
    const bytes = await readFile(await createMovFixture(directory));
    let mime = '';
    let filename = '';
    await copyProviderVideoOriginal(new Response(bytes, { headers: { 'content-length': String(bytes.length),
      'content-type': 'video/quicktime' } }), { jobId: 'mov-job', userId: 'owner', outputFormat: 'mov' } as never, {
      maxBytes: 1024 * 1024,
      upload: async params => {
        mime = params.mime;
        filename = params.fileName ?? '';
        assert.deepEqual(await readFile(params.path), bytes);
        return { url: 'https://media.maxvideoai.com/renders/owner/original.mov', key: 'original.mov' };
      },
    });
    assert.equal(mime, 'video/quicktime');
    assert.equal(filename, 'mov-job-original.mov');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('provider normalization retains the returned frame independently of video and format', () => {
  const task = normalizeBytePlusTask({ id: 'cgt-owned', status: 'succeeded', output_format: 'mov',
    content: { video_url: 'https://supplier.test/original.mov', last_frame_url: 'https://supplier.test/last.jpg' } });
  assert.equal((task as unknown as { lastFrameUrl: string }).lastFrameUrl, 'https://supplier.test/last.jpg');
  assert.equal((task as unknown as { outputFormat: string }).outputFormat, 'mov');
});

test('returned JPEG is a distinct output and never replaces poster or video render IDs', () => {
  const row = { job_id: 'frame-job', user_id: 'owner', video_url: 'https://media.maxvideoai.com/original.mov',
    thumb_url: 'https://media.maxvideoai.com/poster.jpg', status: 'completed',
    playback_video_url: 'https://media.maxvideoai.com/playback.mp4',
    last_frame: { url: 'https://media.maxvideoai.com/last.jpg', mimeType: 'image/jpeg', sha256: 'a'.repeat(64),
      sizeBytes: 100, width: 64, height: 48 } };
  const outputs = mapLegacyJobRowToOutputs(row);
  const frame = outputs.find(output => output.kind === 'image');
  assert.ok(frame, 'requested frame must have its own owned output');
  assert.equal(frame.metadata.role, 'last_frame');
  assert.equal(frame.url, row.last_frame.url);
  const mapped = applyOutputsToJobPayload({ jobId: row.job_id, renderIds: null }, outputs) as Record<string, unknown>;
  assert.equal(mapped.videoUrl, row.video_url);
  assert.equal(mapped.thumbUrl, row.thumb_url);
  assert.equal(mapped.lastFrameUrl, row.last_frame.url);
  assert.equal(mapped.playbackVideoUrl, row.playback_video_url);
  assert.equal(mapped.renderIds, null);
});

test('full MOV playback derivative preserves duration and uses browser compatible H264/AAC', async () => {
  const artifacts = await import('../frontend/server/byteplus-output-artifacts').catch(() => ({})) as Record<string, unknown>;
  assert.equal(typeof artifacts.ensureBytePlusCompatiblePlayback, 'function', 'MOV needs a separate full playback encoder');
  const encode = artifacts.ensureBytePlusCompatiblePlayback as (input: unknown, deps: unknown) => Promise<string>;
  const directory = await mkdtemp(join(tmpdir(), 'byteplus-playback-test-'));
  try {
    const source = await createMovFixture(directory);
    const bytes = await readFile(source);
    const playback = await encode({ jobId: 'mov-job', userId: 'owner', videoUrl: 'https://media.maxvideoai.com/original.mov' }, {
      createReadUrl: async () => 'https://media.maxvideoai.com/original.mov',
      fetch: async () => new Response(bytes, { headers: { 'content-length': String(bytes.length), 'content-type': 'video/quicktime' } }),
      upload: async (params: { path: string; mime: string }) => {
        assert.equal(params.mime, 'video/mp4');
        const { stdout } = await execute(ffprobe.path, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', params.path]);
        const probe = JSON.parse(stdout);
        assert.equal(probe.streams.find((stream: { codec_type: string }) => stream.codec_type === 'video').pix_fmt, 'yuv420p');
        assert.equal(probe.streams.find((stream: { codec_type: string }) => stream.codec_type === 'audio').codec_name, 'aac');
        assert.equal(Number(probe.format.duration), 1);
        return { url: 'https://media.maxvideoai.com/playback.mp4', key: 'playback.mp4' };
      },
    });
    assert.equal(playback, 'https://media.maxvideoai.com/playback.mp4');
    assert.deepEqual(await readFile(source), bytes);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('last-frame copy validates actual JPEG and preserves exact supplier bytes', async () => {
  const artifacts = await import('../frontend/server/byteplus-output-artifacts').catch(() => ({})) as Record<string, unknown>;
  assert.equal(typeof artifacts.copyBytePlusLastFrame, 'function', 'last frame needs a distinct durable copy');
  const copy = artifacts.copyBytePlusLastFrame as (input: unknown, deps: unknown) => Promise<Record<string, unknown>>;
  const bytes = await sharp({ create: { width: 64, height: 48, channels: 3, background: 'red' } }).jpeg().toBuffer();
  const result = await copy({ jobId: 'frame-job', userId: 'owner', url: 'https://supplier.test/last.jpg' }, {
    download: async () => ({ bytes, mimeType: 'image/jpeg', fileName: 'last.jpg' }),
    upload: async (params: { data: Buffer; mime: string; fileName: string }) => {
      assert.deepEqual(params.data, bytes);
      assert.equal(params.mime, 'image/jpeg');
      assert.equal(params.fileName, 'frame-job-last-frame.jpg');
      return { url: 'https://media.maxvideoai.com/last.jpg', key: 'last.jpg' };
    },
  });
  assert.deepEqual(result, { url: 'https://media.maxvideoai.com/last.jpg', mimeType: 'image/jpeg',
    sha256: createHash('sha256').update(bytes).digest('hex'), sizeBytes: bytes.length, width: 64, height: 48 });
  await assert.rejects(copy({ jobId: 'frame-job', userId: 'owner', url: 'https://supplier.test/last.jpg' }, {
    download: async () => ({ bytes: await sharp(bytes).png().toBuffer(), mimeType: 'image/jpeg', fileName: 'fake.jpg' }),
    upload: async () => { throw new Error('wrong format must never upload'); },
  }), /JPEG/);
});

test('Seedance 2.5 1080p MP4 needs durable compatible playback independently of MOV and last-frame options', () => {
  const job = { engine_id: 'seedance-2-5', settings_snapshot: { inputMode: 't2v', byteplusTransport: 'modelark',
    core: { resolution: '1080p' }, advanced: { extraInputValues: { output_format: 'mp4' } } } } as never;
  assert.equal(requiresBytePlusDurableEditOutput(job), true);
  assert.equal((bytePlusRequestedOutputOptions(job) as unknown as { requiresCompatiblePlayback: boolean }).requiresCompatiblePlayback, true);
});

test('packaged runtime decodes 10-bit HEVC MP4 into a full H264 playback derivative', async () => {
  const { ensureBytePlusCompatiblePlayback } = await import('../frontend/server/byteplus-output-artifacts');
  const directory = await mkdtemp(join(tmpdir(), 'byteplus-hevc-test-'));
  try {
    const binary = await ensureExecutableFfmpegPath(ffmpeg.path);
    const source = join(directory, 'hevc.mp4');
    await execute(binary, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=64x48:r=24', '-t', '1',
      '-an', '-c:v', 'libx265', '-pix_fmt', 'yuv420p10le', '-x265-params', 'pools=none:frame-threads=1:log-level=error', source]);
    const bytes = await readFile(source);
    await ensureBytePlusCompatiblePlayback({ jobId: 'hevc', userId: 'owner', videoUrl: 'https://media.maxvideoai.com/original.mp4' }, {
      createReadUrl: async () => 'https://media.maxvideoai.com/original.mp4',
      fetch: async () => new Response(bytes, { headers: { 'content-length': String(bytes.length), 'content-type': 'video/mp4' } }),
      upload: async params => {
        const { stdout } = await execute(ffprobe.path, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', params.path]);
        const measured = JSON.parse(stdout);
        assert.equal(measured.streams[0].codec_name, 'h264');
        assert.equal(measured.streams[0].pix_fmt, 'yuv420p');
        assert.equal(Number(measured.format.duration), 1);
        return { url: 'https://media.maxvideoai.com/playback.mp4', key: 'playback.mp4' };
      },
    });
    assert.deepEqual(await readFile(source), bytes);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('playback output budget cannot publish a clipped substitute for the full original', async () => {
  const { ensureBytePlusCompatiblePlayback } = await import('../frontend/server/byteplus-output-artifacts');
  const directory = await mkdtemp(join(tmpdir(), 'byteplus-playback-budget-'));
  try {
    const bytes = await readFile(await createMovFixture(directory));
    await assert.rejects(ensureBytePlusCompatiblePlayback({ jobId: 'bounded', userId: 'owner', videoUrl: 'https://media.maxvideoai.com/original.mov' }, {
      maxPlaybackBytes: 4096,
      createReadUrl: async () => 'https://media.maxvideoai.com/original.mov',
      fetch: async () => new Response(bytes, { headers: { 'content-length': String(bytes.length) } }),
      upload: async () => ({ url: 'https://media.maxvideoai.com/incorrectly-clipped.mp4', key: 'incorrect.mp4' }),
    } as never), /budget|incomplete/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
