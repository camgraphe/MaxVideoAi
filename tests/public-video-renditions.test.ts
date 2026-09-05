import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildFfmpegArguments,
  buildPublicProjection,
  activatePublishedManifest,
  checkPublicVideoState,
  inspectMp4TopLevelBoxes,
  parseFfprobeJson,
  parsePublicVideoRenditionOptions,
  publishPreparedCheckpoints,
  validatePreparedRendition,
  validatePublishedManifest,
  verifyPreparedOutputForResume,
  verifyPublicHttpRendition,
  type MediaProbe,
  type PreparedCheckpoint,
  type PublishedManifest,
} from '../frontend/scripts/_lib/public-video-renditions';
import { resolvePublicVideoRenditionFromProjection } from '../frontend/lib/public-video-renditions';
import { downloadPublicVideoToFile } from '../frontend/scripts/_lib/public-video-renditions-runtime';

const SOURCE_URL = 'https://media.maxvideoai.com/renders/a/source.mp4';
const SOURCE_SHA = 'a'.repeat(64);
const OUTPUT_SHA = 'b'.repeat(64);
const DERIVATIVE_URL = `https://media.maxvideoai.com/marketing/video-renditions/${SOURCE_SHA}/public-demo-v1/mobile/${OUTPUT_SHA}.mp4`;

const sourceProbe: MediaProbe = {
  width: 1920,
  height: 1080,
  durationSeconds: 10,
  frameRate: { numerator: 24, denominator: 1 },
  videoCodec: 'h264',
  pixelFormat: 'yuv420p',
  sampleAspectRatio: { numerator: 1, denominator: 1 },
  colorTransfer: 'bt709',
  rotationDegrees: 0,
  audio: { codec: 'aac', channels: 2, sampleRateHz: 48_000, durationSeconds: 10 },
  fastStart: true,
  decodeOk: true,
};

const outputProbe: MediaProbe = {
  ...sourceProbe,
  width: 1280,
  height: 720,
};

function manifestWith(overrides: Partial<PublishedManifest['entries'][number]['renditions']['mobile']> = {}): PublishedManifest {
  return {
    schemaVersion: 1,
    profileVersion: 'public-demo-v1',
    entries: [{
      assetId: 'asset-a',
      role: 'public-demo',
      original: { url: SOURCE_URL, sha256: SOURCE_SHA, bytes: 1_000_000, probe: sourceProbe },
      renditions: {
        mobile: {
          profileVersion: 'public-demo-v1',
          url: DERIVATIVE_URL,
          storageKey: `marketing/video-renditions/${SOURCE_SHA}/public-demo-v1/mobile/${OUTPUT_SHA}.mp4`,
          sha256: OUTPUT_SHA,
          bytes: 800_000,
          probe: outputProbe,
          visualReview: { reviewedAt: '2026-09-05T10:00:00.000Z', evidence: 'artifact review frames 15/50/85' },
          httpCheck: {
            checkedAt: '2026-09-05T11:00:00.000Z',
            contentType: 'video/mp4',
            bytes: 800_000,
            rangeStart: 0,
            rangeEnd: 31,
            totalBytes: 800_000,
          },
          activatedAt: '2026-09-05T11:00:00.000Z',
          ...overrides,
        },
      },
      omissions: [],
    }],
  };
}

test('CLI defaults to offline check and rejects mutation flags before I/O', () => {
  assert.deepEqual(parsePublicVideoRenditionOptions([]), {
    mode: 'check',
    assetIds: [],
    maxAssets: 5,
    http: false,
  });
  assert.throws(() => parsePublicVideoRenditionOptions(['prepare']), /--work-dir is required/);
  assert.throws(() => parsePublicVideoRenditionOptions(['check', '--work-dir=/tmp/x']), /not valid for check/);
  assert.throws(() => parsePublicVideoRenditionOptions(['prepare', '--work-dir=/tmp/x', '--max-assets=21']), /between 1 and 20/);
  assert.throws(() => parsePublicVideoRenditionOptions(['check', '--wat']), /Unknown option/);
  assert.throws(() => parsePublicVideoRenditionOptions(['prepare', 'publish', '--work-dir=/tmp/x']), /one mode/);
});

test('ffprobe parsing rejects malformed and unsupported display media', () => {
  assert.throws(() => parseFfprobeJson('{'), /valid ffprobe JSON/);
  assert.throws(() => parseFfprobeJson(JSON.stringify({ streams: [], format: {} })), /one video stream/);
  assert.throws(() => parseFfprobeJson(JSON.stringify({
    streams: [{ codec_type: 'video', codec_name: 'hevc', width: 1280, height: 720, pix_fmt: 'yuv420p', r_frame_rate: '24/1', sample_aspect_ratio: '1:1' }],
    format: { duration: '5' },
  })), /H\.264/);
  assert.throws(() => parseFfprobeJson(JSON.stringify({
    streams: [{ codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, pix_fmt: 'yuv420p', r_frame_rate: '24/1', sample_aspect_ratio: '4:3' }],
    format: { duration: '5' },
  })), /square pixels/);
  assert.throws(() => parseFfprobeJson(JSON.stringify({
    streams: [
      { codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, pix_fmt: 'yuv420p', r_frame_rate: '24/1', sample_aspect_ratio: '1:1' },
      { codec_type: 'audio', codec_name: 'opus', channels: 2, sample_rate: '48000', duration: '5' },
    ],
    format: { duration: '5' },
  })), /AAC/);
});

test('profile arguments preserve cadence and AAC while scaling without upscale', () => {
  const args = buildFfmpegArguments('/in.mp4', '/out.mp4', sourceProbe, 'mobile');
  assert.deepEqual(args, [
    '-hide_banner', '-nostdin', '-i', '/in.mp4', '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-r', '24/1', '-g', '48', '-keyint_min', '48', '-sc_threshold', '0', '-threads', '2',
    '-c:a', 'copy', '-movflags', '+faststart', '-y', '/out.mp4',
  ]);
  const small = buildFfmpegArguments('/in.mp4', '/out.mp4', { ...sourceProbe, width: 854, height: 480 }, 'desktop');
  assert.match(small[small.indexOf('-vf') + 1]!, /min\(1920,iw\).*min\(1080,ih\)/);
});

test('prepared validation catches cadence, audio, duration, decode, and insufficient savings independently', () => {
  const valid = { sourceBytes: 1_000_000, outputBytes: 850_000, sourceProbe, outputProbe };
  assert.doesNotThrow(() => validatePreparedRendition(valid, 'mobile'));
  assert.throws(() => validatePreparedRendition({ ...valid, outputProbe: { ...outputProbe, frameRate: { numerator: 25, denominator: 1 } } }, 'mobile'), /cadence/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputProbe: { ...outputProbe, durationSeconds: 9.7 } }, 'mobile'), /duration/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputProbe: { ...outputProbe, audio: null } }, 'mobile'), /audio/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputProbe: { ...outputProbe, decodeOk: false } }, 'mobile'), /decode/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputBytes: 850_001 }, 'mobile'), /15%/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputBytes: 1_000_001 }, 'mobile'), /15%/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputProbe: { ...outputProbe, width: 2048 } }, 'mobile'), /upscale/);
});

test('top-level MP4 parsing accepts extended boxes and rejects corrupt bounds', () => {
  const regular = Buffer.alloc(24);
  regular.writeUInt32BE(16, 0);
  regular.write('ftyp', 4, 'ascii');
  regular.writeUInt32BE(8, 16);
  regular.write('moov', 20, 'ascii');
  assert.equal(inspectMp4TopLevelBoxes(regular).fastStart, true);

  const extended = Buffer.alloc(40);
  extended.writeUInt32BE(1, 0);
  extended.write('ftyp', 4, 'ascii');
  extended.writeBigUInt64BE(24n, 8);
  extended.writeUInt32BE(16, 24);
  extended.write('mdat', 28, 'ascii');
  assert.equal(inspectMp4TopLevelBoxes(extended).fastStart, false);

  const corrupt = Buffer.alloc(12);
  corrupt.writeUInt32BE(99, 0);
  corrupt.write('moov', 4, 'ascii');
  assert.throws(() => inspectMp4TopLevelBoxes(corrupt), /bounds/);
});

test('manifest validation rejects stale identities, unsafe URLs, conflicts, and unreviewed activation', () => {
  const sources = [{ assetId: 'asset-a', role: 'public-demo' as const, url: SOURCE_URL, sha256: SOURCE_SHA }];
  assert.doesNotThrow(() => validatePublishedManifest(manifestWith(), sources));
  assert.throws(() => validatePublishedManifest({ ...manifestWith(), profileVersion: 'old' }, sources), /profile version/);
  assert.throws(() => validatePublishedManifest(manifestWith(), [{ ...sources[0]!, sha256: 'c'.repeat(64) }]), /source hash/);
  assert.throws(() => validatePublishedManifest(manifestWith({ url: 'https://evil.example/output.mp4' }), sources), /allowed public media URL/);
  const duplicate = manifestWith();
  duplicate.entries.push(structuredClone(duplicate.entries[0]!));
  assert.throws(() => validatePublishedManifest(duplicate, sources), /Duplicate asset ID/);
  assert.throws(() => validatePublishedManifest(manifestWith({ visualReview: null, activatedAt: '2026-09-05T11:00:00.000Z' }), sources), /visual review/);
  assert.throws(() => validatePublishedManifest(manifestWith({ httpCheck: null, activatedAt: '2026-09-05T11:00:00.000Z' }), sources), /HTTP readiness/);
});

test('projection activation keeps useful siblings and resolver preserves original fallback', () => {
  const projected = buildPublicProjection(manifestWith());
  assert.deepEqual(projected.renditions[SOURCE_URL], {
    assetId: 'asset-a',
    mobile: DERIVATIVE_URL,
  });
  assert.deepEqual(resolvePublicVideoRenditionFromProjection(SOURCE_URL, 'mobile', projected), {
    src: DERIVATIVE_URL,
    originalSrc: SOURCE_URL,
    assetId: 'asset-a',
    profile: 'mobile',
  });
  assert.deepEqual(resolvePublicVideoRenditionFromProjection(SOURCE_URL, 'desktop', projected), {
    src: SOURCE_URL,
    originalSrc: SOURCE_URL,
    assetId: 'asset-a',
    profile: 'original',
  });
  const signed = `${SOURCE_URL}?token=secret`;
  assert.deepEqual(resolvePublicVideoRenditionFromProjection(signed, 'mobile', projected), {
    src: signed,
    originalSrc: signed,
    assetId: null,
    profile: 'original',
  });
});

test('HTTP verification requires an MP4 body, exact length, and a functioning bounded range', async () => {
  const goodFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.headers as Record<string, string> | undefined)?.Range) {
      const prefix = Buffer.alloc(32);
      prefix.writeUInt32BE(24, 0);
      prefix.write('ftyp', 4, 'ascii');
      return new Response(prefix, { status: 206, headers: { 'content-type': 'video/mp4', 'content-length': '32', 'content-range': 'bytes 0-31/800000' } });
    }
    return new Response(null, { status: 200, headers: { 'content-type': 'video/mp4', 'content-length': '800000' } });
  }) as typeof fetch;
  const evidence = await verifyPublicHttpRendition(DERIVATIVE_URL, 800_000, { fetchFn: goodFetch, now: () => new Date('2026-09-05T12:00:00Z') });
  assert.equal(evidence.totalBytes, 800_000);

  const htmlFetch = (async () => new Response('<html/>', { status: 200, headers: { 'content-type': 'text/html', 'content-length': '7' } })) as typeof fetch;
  await assert.rejects(() => verifyPublicHttpRendition(DERIVATIVE_URL, 800_000, { fetchFn: htmlFetch }), /video\/mp4/);
  const noRangeFetch = (async () => new Response(null, { status: 200, headers: { 'content-type': 'video/mp4', 'content-length': '800000' } })) as typeof fetch;
  await assert.rejects(() => verifyPublicHttpRendition(DERIVATIVE_URL, 800_000, { fetchFn: noRangeFetch }), /Range/);
});

test('source download rejects cross-origin redirects and oversized responses before writing', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'rendition-download-'));
  try {
    const target = path.join(directory, 'source.mp4');
    const redirectFetch = (async () => new Response(null, { status: 302, headers: { location: 'https://evil.example/video.mp4' } })) as typeof fetch;
    await assert.rejects(() => downloadPublicVideoToFile(SOURCE_URL, target, { fetchFn: redirectFetch }), /allowed public media URL/);
    const oversizedFetch = (async () => new Response(null, { status: 200, headers: { 'content-type': 'video/mp4', 'content-length': String(64 * 1024 * 1024 + 1) } })) as typeof fetch;
    await assert.rejects(() => downloadPublicVideoToFile(SOURCE_URL, target, { fetchFn: oversizedFetch }), /64 MiB/);
    await assert.rejects(() => readFile(target), /ENOENT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('resume verifies bytes, hash, metadata, and decode rather than trusting file existence', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'rendition-resume-'));
  try {
    const outputPath = path.join(directory, 'output.mp4');
    await writeFile(outputPath, 'correct bytes');
    const expectedHash = '5eaea7c98539b6faac2e243276605f2b5ee19747e66cd13a54706abd48b66582';
    assert.equal(await verifyPreparedOutputForResume({ outputPath, expectedBytes: 13, expectedSha256: expectedHash, expectedProbe: outputProbe }, { probeFile: async () => outputProbe }), true);
    await writeFile(outputPath, 'corrupt');
    assert.equal(await verifyPreparedOutputForResume({ outputPath, expectedBytes: 13, expectedSha256: expectedHash, expectedProbe: outputProbe }, { probeFile: async () => outputProbe }), false);
    await rm(outputPath);
    assert.equal(await verifyPreparedOutputForResume({ outputPath, expectedBytes: 13, expectedSha256: expectedHash, expectedProbe: outputProbe }, { probeFile: async () => outputProbe }), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('an activated projection can be compared byte-for-byte to detect hand edits', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'rendition-projection-'));
  try {
    const file = path.join(directory, 'projection.json');
    await writeFile(file, JSON.stringify(buildPublicProjection(manifestWith()), null, 2) + '\n');
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), buildPublicProjection(manifestWith()));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('offline check detects a stale or hand-edited generated projection', async () => {
  const sources = [{ assetId: 'asset-a', role: 'public-demo' as const, url: SOURCE_URL, sha256: SOURCE_SHA }];
  assert.doesNotThrow(() => checkPublicVideoState({ sources, manifest: manifestWith(), projection: buildPublicProjection(manifestWith()) }));
  const stale = buildPublicProjection(manifestWith());
  stale.renditions[SOURCE_URL]!.mobile = SOURCE_URL;
  assert.throws(() => checkPublicVideoState({ sources, manifest: manifestWith(), projection: stale }), /projection is stale/i);
});

test('activation requires explicit review and current HTTP readiness before producing a projection', async () => {
  const sources = [{ assetId: 'asset-a', role: 'public-demo' as const, url: SOURCE_URL, sha256: SOURCE_SHA }];
  const pending = manifestWith({ httpCheck: null, activatedAt: null });
  let checked = 0;
  const activated = await activatePublishedManifest(pending, sources, {
    verifyHttp: async (_url, bytes) => {
      checked += 1;
      assert.equal(bytes, 800_000);
      return {
        checkedAt: '2026-09-05T12:00:00.000Z', contentType: 'video/mp4' as const,
        bytes, rangeStart: 0, rangeEnd: 31, totalBytes: bytes,
      };
    },
    now: () => new Date('2026-09-05T12:00:00.000Z'),
  });
  assert.equal(checked, 1);
  assert.equal(activated.manifest.entries[0]!.renditions.mobile!.activatedAt, '2026-09-05T12:00:00.000Z');
  assert.equal(activated.projection.renditions[SOURCE_URL]!.mobile, DERIVATIVE_URL);

  const unreviewed = manifestWith({ visualReview: null, httpCheck: null, activatedAt: null });
  await assert.rejects(() => activatePublishedManifest(unreviewed, sources, { verifyHttp: async () => { throw new Error('must not run'); } }), /visual review/);
  await assert.rejects(() => activatePublishedManifest(
    { schemaVersion: 1, profileVersion: 'public-demo-v1', entries: [] },
    sources,
    { verifyHttp: async () => { throw new Error('must not run'); }, assetIds: new Set(['asset-a']) }
  ), /not published/);
});

test('publishing uses immutable conditional create and verifies exact remote bytes after a conflict', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'rendition-publish-'));
  try {
    const outputPath = path.join(directory, 'mobile.mp4');
    const output = Buffer.from('reviewed rendition');
    await writeFile(outputPath, output);
    const sha = 'de157b35728278bae4c53d22d4cbf3b4612e457af2c1d1fd786d02b48db23e69';
    const checkpoint: PreparedCheckpoint = {
      schemaVersion: 1,
      assetId: 'asset-a', role: 'public-demo', profileVersion: 'public-demo-v1',
      original: { url: SOURCE_URL, sha256: SOURCE_SHA, bytes: 1_000_000, path: path.join(directory, 'source.mp4'), probe: sourceProbe },
      renditions: { mobile: { profileVersion: 'public-demo-v1', path: outputPath, sha256: sha, bytes: output.length, probe: outputProbe } },
      omissions: [],
    };
    const empty: PublishedManifest = { schemaVersion: 1, profileVersion: 'public-demo-v1', entries: [] };
    let conditional = false;
    const published = await publishPreparedCheckpoints([checkpoint], empty, 'reviewed comparison sheets', {
      upload: async (input) => {
        conditional = input.conditionalCreate;
        const error = new Error('exists') as Error & { context: { code: string } };
        error.context = { code: 'precondition-conflict' };
        throw error;
      },
      readRemote: async () => output,
      now: () => new Date('2026-09-05T13:00:00.000Z'),
    });
    assert.equal(conditional, true);
    assert.equal(published.entries[0]!.renditions.mobile!.sha256, sha);
    await assert.rejects(() => publishPreparedCheckpoints([checkpoint], empty, 'reviewed', {
      upload: async () => { const error = new Error('exists') as Error & { context: { code: string } }; error.context = { code: 'precondition-conflict' }; throw error; },
      readRemote: async () => Buffer.from('different'),
    }), /existing remote object differs/i);
    let uploadsBeforeConflict = 0;
    await assert.rejects(() => publishPreparedCheckpoints([checkpoint, structuredClone(checkpoint)], empty, 'reviewed', {
      upload: async () => { uploadsBeforeConflict += 1; return { key: 'unused', url: 'unused' }; },
      readRemote: async () => output,
    }), /Duplicate prepared asset ID/);
    assert.equal(uploadsBeforeConflict, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
