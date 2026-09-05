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
  hashAdtsPacketPayloads,
  inspectMp4TopLevelBoxes,
  parseFfprobeJson,
  parsePublicVideoRenditionOptions,
  persistActivatedState,
  publishPreparedCheckpoints,
  summarizePreparedCheckpoints,
  validatePreparedRendition,
  validatePublishedManifest,
  verifyPreparedOutputForResume,
  verifyPublicHttpRendition,
  type MediaProbe,
  type PreparedCheckpoint,
  type PublishedManifest,
} from '../frontend/scripts/_lib/public-video-renditions';
import { resolvePublicVideoRenditionFromProjection } from '../frontend/lib/public-video-renditions';
import {
  downloadPublicVideoToFile,
  preparePublicVideoRenditions,
} from '../frontend/scripts/_lib/public-video-renditions-runtime';

const SOURCE_URL = 'https://media.maxvideoai.com/renders/a/source.mp4';
const SOURCE_SHA = 'a'.repeat(64);
const OUTPUT_SHA = 'b'.repeat(64);
const DERIVATIVE_URL = `https://media.maxvideoai.com/marketing/video-renditions/${SOURCE_SHA}/public-demo-v1/mobile/${OUTPUT_SHA}.mp4`;

const sourceProbe: MediaProbe = {
  width: 1920,
  height: 1080,
  durationSeconds: 10,
  containerDurationSeconds: 10,
  videoStartSeconds: 0,
  videoFrameCount: 240,
  cadence: {
    kind: 'cfr', firstTimestampSeconds: 0, lastTimestampSeconds: 9.958333,
    minDeltaSeconds: 0.041666, maxDeltaSeconds: 0.041667, timestampsSha256: 'c'.repeat(64),
  },
  frameRate: { numerator: 24, denominator: 1 },
  videoCodec: 'h264',
  pixelFormat: 'yuv420p',
  sampleAspectRatio: { numerator: 1, denominator: 1 },
  colorTransfer: 'bt709',
  rotationDegrees: 0,
  audio: {
    codec: 'aac', channels: 2, sampleRateHz: 48_000, durationSeconds: 10,
    startSeconds: 0, packetPayloadSha256: 'd'.repeat(64),
  },
  fastStart: true,
  decodeOk: true,
};

const outputProbe: MediaProbe = {
  ...sourceProbe,
  width: 1280,
  height: 720,
};

function manifestWith(overrides: Partial<PublishedManifest['entries'][number]['renditions']['mobile']> = {}): PublishedManifest {
  const rendition = {
    profileVersion: 'public-demo-v1' as const,
    url: DERIVATIVE_URL,
    storageKey: `marketing/video-renditions/${SOURCE_SHA}/public-demo-v1/mobile/${OUTPUT_SHA}.mp4`,
    sha256: OUTPUT_SHA,
    bytes: 800_000,
    probe: outputProbe,
    visualReview: { reviewedAt: '2026-09-05T10:00:00.000Z', evidence: 'artifact review frames 15/50/85' },
    httpCheck: {
      checkedAt: '2026-09-05T11:00:00.000Z',
      contentType: 'video/mp4' as const,
      bytes: 800_000,
      rangeStart: 0,
      rangeEnd: 31,
      totalBytes: 800_000,
    },
    activatedAt: '2026-09-05T11:00:00.000Z',
    ...overrides,
  };
  return {
    schemaVersion: 1,
    profileVersion: 'public-demo-v1',
    entries: [{
      assetId: 'asset-a',
      role: 'public-demo',
      original: { url: SOURCE_URL, sha256: SOURCE_SHA, bytes: 1_000_000, probe: sourceProbe },
      renditions: rendition.activatedAt ? { mobile: rendition } : {},
      pendingRenditions: rendition.activatedAt ? {} : { mobile: rendition },
      omissions: [],
      failures: [],
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

test('prepare summary distinguishes accepted, omitted, and retryable failed profiles', () => {
  const checkpoint = {
    renditions: { mobile: {} }, omissions: [{ profile: 'desktop', reason: 'insufficient savings' }],
    failures: [{ profile: 'desktop', reason: 'probe failed', retryable: true }],
  } as unknown as PreparedCheckpoint;
  assert.deepEqual(summarizePreparedCheckpoints([checkpoint]), {
    assets: 1, acceptedProfiles: 1, omittedProfiles: 1, failedProfiles: 1,
  });
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

test('ffprobe parsing rejects unsupported and variable cadence and uses the video stream timeline', () => {
  const video = {
    codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, pix_fmt: 'yuv420p',
    avg_frame_rate: '60/1', sample_aspect_ratio: '1:1', duration: '1', start_time: '0',
  };
  assert.throws(() => parseFfprobeJson(JSON.stringify({ streams: [video], format: { duration: '1' }, frames: [] })), /24, 25, or 30 fps/);

  const frames = Array.from({ length: 24 }, (_, index) => ({
    media_type: 'video', best_effort_timestamp_time: (index / 24).toFixed(6),
  }));
  const measured = parseFfprobeJson(JSON.stringify({
    streams: [{ ...video, avg_frame_rate: '24/1' }],
    format: { duration: '10', start_time: '0' },
    frames,
  }));
  assert.equal(measured.durationSeconds, 1);
  assert.equal((measured as MediaProbe & { containerDurationSeconds: number }).containerDurationSeconds, 10);
  assert.equal((measured as MediaProbe & { videoFrameCount: number }).videoFrameCount, 24);

  const variableFrames = [0, 0.041667, 0.09].map((timestamp) => ({
    media_type: 'video', best_effort_timestamp_time: String(timestamp),
  }));
  assert.throws(() => parseFfprobeJson(JSON.stringify({
    streams: [{ ...video, avg_frame_rate: '24/1', duration: '0.131667' }],
    format: { duration: '0.131667' },
    frames: variableFrames,
  })), /variable frame cadence/);
});

test('profile arguments preserve cadence and AAC while scaling without upscale', () => {
  const args = buildFfmpegArguments('/in.mp4', '/out.mp4', sourceProbe, 'mobile');
  assert.deepEqual(args, [
    '-hide_banner', '-nostdin', '-i', '/in.mp4', '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-g', '48', '-keyint_min', '48', '-sc_threshold', '0', '-threads', '2',
    '-c:a', 'copy', '-movflags', '+faststart', '-y', '/out.mp4',
  ]);
  const small = buildFfmpegArguments('/in.mp4', '/out.mp4', { ...sourceProbe, width: 854, height: 480 }, 'desktop');
  assert.match(small[small.indexOf('-vf') + 1]!, /min\(1920,iw\).*min\(1080,ih\)/);
});

test('prepared validation catches cadence, audio, duration, decode, and insufficient savings independently', () => {
  const valid = { sourceBytes: 1_000_000, outputBytes: 850_000, sourceProbe, outputProbe };
  assert.doesNotThrow(() => validatePreparedRendition(valid, 'mobile'));
  assert.throws(() => validatePreparedRendition({ ...valid, outputProbe: { ...outputProbe, frameRate: { numerator: 25, denominator: 1 } } }, 'mobile'), /cadence/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputProbe: { ...outputProbe, videoStartSeconds: 0.01 } }, 'mobile'), /timeline/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputProbe: { ...outputProbe, cadence: { ...outputProbe.cadence, timestampsSha256: 'e'.repeat(64) } } }, 'mobile'), /timeline/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputProbe: { ...outputProbe, durationSeconds: 9.7 } }, 'mobile'), /duration/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputProbe: { ...outputProbe, audio: null } }, 'mobile'), /audio/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputProbe: { ...outputProbe, audio: { ...outputProbe.audio!, packetPayloadSha256: 'e'.repeat(64) } } }, 'mobile'), /audio/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputProbe: { ...outputProbe, decodeOk: false } }, 'mobile'), /decode/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputBytes: 850_001 }, 'mobile'), /15%/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputBytes: 1_000_001 }, 'mobile'), /15%/);
  assert.throws(() => validatePreparedRendition({ ...valid, outputProbe: { ...outputProbe, width: 2048 } }, 'mobile'), /upscale/);
});

test('ADTS payload hashing excludes transport headers and preserves packet boundaries', () => {
  const packet = (payload: Buffer, protectionAbsent = true) => {
    const headerBytes = protectionAbsent ? 7 : 9;
    const frameBytes = headerBytes + payload.length;
    const header = Buffer.alloc(headerBytes);
    header[0] = 0xff;
    header[1] = protectionAbsent ? 0xf1 : 0xf0;
    header[3] = (frameBytes >> 11) & 0x03;
    header[4] = (frameBytes >> 3) & 0xff;
    header[5] = (frameBytes & 0x07) << 5;
    return Buffer.concat([header, payload]);
  };
  const first = Buffer.concat([packet(Buffer.from('one')), packet(Buffer.from('two'), false)]);
  const changedHeaders = Buffer.from(first);
  changedHeaders[2] = 0x55;
  assert.equal(hashAdtsPacketPayloads(first), hashAdtsPacketPayloads(changedHeaders));
  assert.notEqual(hashAdtsPacketPayloads(first), hashAdtsPacketPayloads(Buffer.concat([packet(Buffer.from('one')), packet(Buffer.from('too'), false)])));
  assert.throws(() => hashAdtsPacketPayloads(Buffer.from('invalid')), /ADTS/);
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

  let cancelledOversizedBody = false;
  const oversizedRangeFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.headers as Record<string, string> | undefined)?.Range) {
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) { controller.enqueue(new Uint8Array(4096)); },
        cancel() { cancelledOversizedBody = true; },
      });
      return new Response(stream, { status: 206, headers: { 'content-type': 'video/mp4', 'content-length': '32', 'content-range': 'bytes 0-31/800000' } });
    }
    return new Response(null, { status: 200, headers: { 'content-type': 'video/mp4', 'content-length': '800000' } });
  }) as typeof fetch;
  await assert.rejects(() => verifyPublicHttpRendition(DERIVATIVE_URL, 800_000, { fetchFn: oversizedRangeFetch }), /exceeds 32 bytes/);
  assert.equal(cancelledOversizedBody, true);

  const stalledRangeFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.headers as Record<string, string> | undefined)?.Range) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener('abort', () => controller.error(new Error('range aborted')), { once: true });
        },
      });
      return new Response(stream, { status: 206, headers: { 'content-type': 'video/mp4', 'content-length': '32', 'content-range': 'bytes 0-31/800000' } });
    }
    return new Response(null, { status: 200, headers: { 'content-type': 'video/mp4', 'content-length': '800000' } });
  }) as typeof fetch;
  await assert.rejects(() => verifyPublicHttpRendition(DERIVATIVE_URL, 800_000, { fetchFn: stalledRangeFetch, timeoutMs: 10 }), /range aborted/);
});

test('source download rejects cross-origin redirects and oversized responses before writing', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'rendition-download-'));
  try {
    const target = path.join(directory, 'source.mp4');
    const redirectFetch = (async () => new Response(null, { status: 302, headers: { location: 'https://evil.example/video.mp4' } })) as typeof fetch;
    await assert.rejects(() => downloadPublicVideoToFile(SOURCE_URL, target, { fetchFn: redirectFetch }), /allowed public media URL/);
    const portRedirectFetch = (async () => new Response(null, { status: 302, headers: { location: 'https://media.maxvideoai.com:444/video.mp4' } })) as typeof fetch;
    await assert.rejects(() => downloadPublicVideoToFile(SOURCE_URL, target, { fetchFn: portRedirectFetch }), /allowed public media URL/);
    const oversizedFetch = (async () => new Response(null, { status: 200, headers: { 'content-type': 'video/mp4', 'content-length': String(64 * 1024 * 1024 + 1) } })) as typeof fetch;
    await assert.rejects(() => downloadPublicVideoToFile(SOURCE_URL, target, { fetchFn: oversizedFetch }), /64 MiB/);
    await assert.rejects(() => readFile(target), /ENOENT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('source validation rejects traversing IDs, duplicate hashes, and nondefault ports before prepare I/O', async () => {
  const empty: PublishedManifest = { schemaVersion: 1, profileVersion: 'public-demo-v1', entries: [] };
  const base = { assetId: 'asset-a', role: 'public-demo' as const, url: SOURCE_URL, sha256: SOURCE_SHA };
  assert.throws(() => validatePublishedManifest(empty, [base, { ...base, assetId: 'asset-b', url: 'https://media.maxvideoai.com/renders/b/source.mp4' }]), /Duplicate source SHA256/);
  assert.throws(() => validatePublishedManifest(empty, [{ ...base, url: 'https://media.maxvideoai.com:444/renders/a/source.mp4' }]), /allowed public media URL/);

  let downloads = 0;
  await assert.rejects(() => preparePublicVideoRenditions(
    { workDir: path.join(tmpdir(), 'must-not-write'), sources: [{ ...base, assetId: '../escape' }], assetIds: [], maxAssets: 5 },
    { download: async () => { downloads += 1; throw new Error('must not download'); } }
  ), /asset ID/);
  assert.equal(downloads, 0);
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

test('prepare checkpoints a retryable desktop encode failure and still prepares mobile', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'rendition-profile-failure-'));
  const sourceHash = '541b3e9daa09b20bf85fa273e5cbd3e80185aa4ec298e765db87742b70138a53';
  const attempted: string[] = [];
  try {
    const checkpoints = await preparePublicVideoRenditions({
      workDir: directory,
      sources: [{ assetId: 'asset-a', role: 'public-demo', url: SOURCE_URL, sha256: sourceHash }],
      assetIds: [],
      maxAssets: 5,
    }, {
      download: async (_url, destination) => {
        await writeFile(destination, Buffer.alloc(1000));
        return { bytes: 1000, sha256: sourceHash };
      },
      encode: async (_source, output, _probe, profile) => {
        attempted.push(profile);
        if (profile === 'desktop') throw new Error('desktop encoder failed');
        await writeFile(output, Buffer.alloc(800, 1));
      },
      probe: async (file) => file.endsWith('source.mp4') ? sourceProbe : outputProbe,
    });
    assert.deepEqual(attempted, ['desktop', 'mobile']);
    assert.equal(checkpoints[0]!.renditions.mobile?.bytes, 800);
    assert.deepEqual((checkpoints[0] as PreparedCheckpoint & { failures: unknown[] }).failures, [
      { profile: 'desktop', reason: 'desktop encoder failed', retryable: true },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('prepare treats output probe failure as retryable and does not retry an intentional savings omission', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'rendition-probe-failure-'));
  const sourceHash = '541b3e9daa09b20bf85fa273e5cbd3e80185aa4ec298e765db87742b70138a53';
  let desktopEncodes = 0;
  try {
    const input = {
      workDir: directory,
      sources: [{ assetId: 'asset-a', role: 'public-demo' as const, url: SOURCE_URL, sha256: sourceHash }],
      assetIds: [],
      maxAssets: 5,
    };
    const dependencies = {
      download: async (_url: string, destination: string) => {
        await writeFile(destination, Buffer.alloc(1000));
        return { bytes: 1000, sha256: sourceHash };
      },
      encode: async (_source: string, output: string, _probe: MediaProbe, profile: 'desktop' | 'mobile') => {
        if (profile === 'desktop') desktopEncodes += 1;
        await writeFile(output, Buffer.alloc(profile === 'desktop' ? 900 : 800, profile === 'desktop' ? 2 : 1));
      },
      probe: async (file: string) => file.endsWith('source.mp4') ? sourceProbe : outputProbe,
    };
    const first = await preparePublicVideoRenditions(input, dependencies);
    assert.deepEqual(first[0]!.omissions, [{ profile: 'desktop', reason: 'Rendition must save at least 15% of source bytes' }]);
    assert.equal(desktopEncodes, 1);
    await preparePublicVideoRenditions(input, dependencies);
    assert.equal(desktopEncodes, 1);

    await rm(directory, { recursive: true, force: true });
    let probes = 0;
    const probeFailure = await preparePublicVideoRenditions(input, {
      ...dependencies,
      probe: async (file: string) => {
        if (file.endsWith('source.mp4')) return sourceProbe;
        probes += 1;
        if (file.endsWith('desktop.mp4')) throw new Error('desktop decode failed');
        return outputProbe;
      },
    });
    assert.equal(probes, 2);
    assert.equal(probeFailure[0]!.renditions.mobile?.bytes, 800);
    assert.equal((probeFailure[0] as PreparedCheckpoint & { failures: Array<{ profile: string }> }).failures[0]?.profile, 'desktop');
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

test('identical republish is an active no-op while changed bytes stay pending', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'rendition-republish-'));
  try {
    const sourcePath = path.join(directory, 'source.mp4');
    const outputPath = path.join(directory, 'mobile.mp4');
    await writeFile(sourcePath, Buffer.alloc(1000));
    await writeFile(outputPath, Buffer.alloc(800, 1));
    const sourceSha = '541b3e9daa09b20bf85fa273e5cbd3e80185aa4ec298e765db87742b70138a53';
    const outputSha = '776f41a5335f221d6e406c678069b49c6c603742cadf34f3af78d9dbaa917942';
    const checkpoint: PreparedCheckpoint = {
      schemaVersion: 1, assetId: 'asset-a', role: 'public-demo', profileVersion: 'public-demo-v1',
      original: { url: SOURCE_URL, sha256: sourceSha, bytes: 1000, path: sourcePath, probe: sourceProbe },
      renditions: { mobile: { profileVersion: 'public-demo-v1', path: outputPath, sha256: outputSha, bytes: 800, probe: outputProbe } },
      omissions: [], failures: [],
    };
    const sources = [{ assetId: 'asset-a', role: 'public-demo' as const, url: SOURCE_URL, sha256: sourceSha }];
    const publishDependencies = {
      upload: async (input: { key: string }) => ({ key: input.key, url: 'unused' }),
      readRemote: async () => Buffer.alloc(0),
      measureFile: async (file: string) => file === sourcePath ? sourceProbe : outputProbe,
    } as Parameters<typeof publishPreparedCheckpoints>[3];
    const pending = await publishPreparedCheckpoints(
      [checkpoint], { schemaVersion: 1, profileVersion: 'public-demo-v1', entries: [] }, 'content accepted', publishDependencies
    );
    const activated = await activatePublishedManifest(pending, sources, {
      verifyHttp: async (_url, bytes) => ({
        checkedAt: '2026-09-05T12:00:00.000Z', contentType: 'video/mp4', bytes,
        rangeStart: 0, rangeEnd: 31, totalBytes: bytes,
      }),
    });
    const activeUrl = activated.projection.renditions[SOURCE_URL]!.mobile;
    const identical = await publishPreparedCheckpoints([checkpoint], activated.manifest, 'same accepted content', publishDependencies);
    assert.doesNotThrow(() => checkPublicVideoState({ sources, manifest: identical, projection: activated.projection }));
    assert.equal(buildPublicProjection(identical).renditions[SOURCE_URL]!.mobile, activeUrl);

    await writeFile(outputPath, Buffer.alloc(700, 2));
    checkpoint.renditions.mobile = {
      ...checkpoint.renditions.mobile!, bytes: 700,
      sha256: 'dd688dfffbb5b60bad76d8ac3211648dd8baa7d4e50dec94515c0ff8a4ff5752',
    };
    const changed = await publishPreparedCheckpoints([checkpoint], activated.manifest, 'replacement accepted', publishDependencies);
    assert.equal(buildPublicProjection(changed).renditions[SOURCE_URL]!.mobile, activeUrl);
    assert.equal((changed.entries[0] as PublishedManifest['entries'][number] & { pendingRenditions: { mobile?: { sha256: string } } }).pendingRenditions.mobile?.sha256, checkpoint.renditions.mobile.sha256);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('activation rerun recovers a stale projection after interruption between authoritative writes', async () => {
  const sources = [{ assetId: 'asset-a', role: 'public-demo' as const, url: SOURCE_URL, sha256: SOURCE_SHA }];
  const pending = manifestWith({ httpCheck: null, activatedAt: null });
  const staleProjection = { schemaVersion: 1 as const, profileVersion: 'public-demo-v1', renditions: {} };
  let authoritative: PublishedManifest | null = null;
  await assert.rejects(() => persistActivatedState(pending, staleProjection, sources, {
    verifyHttp: async (_url, bytes) => ({
      checkedAt: '2026-09-05T12:00:00.000Z', contentType: 'video/mp4', bytes,
      rangeStart: 0, rangeEnd: 31, totalBytes: bytes,
    }),
    writeManifest: async (manifest) => { authoritative = structuredClone(manifest); },
    writeProjection: async () => { throw new Error('simulated projection write interruption'); },
  }), /simulated projection write interruption/);
  assert.ok(authoritative);
  assert.throws(() => checkPublicVideoState({ sources, manifest: authoritative!, projection: staleProjection }), /projection is stale/i);

  let recoveredProjection = staleProjection;
  await persistActivatedState(authoritative!, staleProjection, sources, {
    verifyHttp: async (_url, bytes) => ({
      checkedAt: '2026-09-05T12:01:00.000Z', contentType: 'video/mp4', bytes,
      rangeStart: 0, rangeEnd: 31, totalBytes: bytes,
    }),
    writeManifest: async (manifest) => { authoritative = structuredClone(manifest); },
    writeProjection: async (projection) => { recoveredProjection = projection; },
  });
  assert.doesNotThrow(() => checkPublicVideoState({ sources, manifest: authoritative!, projection: recoveredProjection }));
});

test('publishing uses immutable conditional create and verifies exact remote bytes after a conflict', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'rendition-publish-'));
  try {
    const sourcePath = path.join(directory, 'source.mp4');
    const outputPath = path.join(directory, 'mobile.mp4');
    const output = Buffer.from('reviewed rendition');
    await writeFile(sourcePath, Buffer.alloc(1000));
    await writeFile(outputPath, output);
    const sha = 'de157b35728278bae4c53d22d4cbf3b4612e457af2c1d1fd786d02b48db23e69';
    const checkpoint: PreparedCheckpoint = {
      schemaVersion: 1,
      assetId: 'asset-a', role: 'public-demo', profileVersion: 'public-demo-v1',
      original: {
        url: SOURCE_URL,
        sha256: '541b3e9daa09b20bf85fa273e5cbd3e80185aa4ec298e765db87742b70138a53',
        bytes: 1000,
        path: sourcePath,
        probe: sourceProbe,
      },
      renditions: { mobile: { profileVersion: 'public-demo-v1', path: outputPath, sha256: sha, bytes: output.length, probe: outputProbe } },
      omissions: [],
      failures: [],
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
      measureFile: async (file) => file === sourcePath ? sourceProbe : outputProbe,
      now: () => new Date('2026-09-05T13:00:00.000Z'),
    });
    assert.equal(conditional, true);
    assert.equal(published.entries[0]!.pendingRenditions.mobile!.sha256, sha);
    await assert.rejects(() => publishPreparedCheckpoints([checkpoint], empty, 'reviewed', {
      upload: async () => { const error = new Error('exists') as Error & { context: { code: string } }; error.context = { code: 'precondition-conflict' }; throw error; },
      readRemote: async () => Buffer.from('different'),
      measureFile: async (file) => file === sourcePath ? sourceProbe : outputProbe,
    }), /existing remote object differs/i);
    let uploadsBeforeConflict = 0;
    await assert.rejects(() => publishPreparedCheckpoints([checkpoint, structuredClone(checkpoint)], empty, 'reviewed', {
      upload: async () => { uploadsBeforeConflict += 1; return { key: 'unused', url: 'unused' }; },
      readRemote: async () => output,
      measureFile: async (file) => file === sourcePath ? sourceProbe : outputProbe,
    }), /Duplicate prepared asset ID/);
    assert.equal(uploadsBeforeConflict, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('publishing remeasures every source and output before the first upload', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'rendition-publish-measure-'));
  try {
    const sourcePath = path.join(directory, 'source.mp4');
    const outputPath = path.join(directory, 'mobile.mp4');
    await writeFile(sourcePath, Buffer.alloc(1000));
    await writeFile(outputPath, Buffer.alloc(800, 1));
    const checkpoint: PreparedCheckpoint = {
      schemaVersion: 1, assetId: 'asset-a', role: 'public-demo', profileVersion: 'public-demo-v1',
      original: {
        url: SOURCE_URL,
        sha256: '541b3e9daa09b20bf85fa273e5cbd3e80185aa4ec298e765db87742b70138a53',
        bytes: 1000,
        path: sourcePath,
        probe: sourceProbe,
      },
      renditions: {
        mobile: {
          profileVersion: 'public-demo-v1', path: outputPath,
          sha256: '776f41a5335f221d6e406c678069b49c6c603742cadf34f3af78d9dbaa917942',
          bytes: 800, probe: outputProbe,
        },
      },
      omissions: [], failures: [],
    };
    const empty: PublishedManifest = { schemaVersion: 1, profileVersion: 'public-demo-v1', entries: [] };
    let uploads = 0;
    await assert.rejects(() => publishPreparedCheckpoints([checkpoint], empty, 'reviewed', {
      upload: async (input) => { uploads += 1; return { key: input.key, url: 'unused' }; },
      readRemote: async () => Buffer.alloc(0),
      measureFile: async (file: string) => file === sourcePath
        ? sourceProbe
        : { ...outputProbe, durationSeconds: 9 },
    } as Parameters<typeof publishPreparedCheckpoints>[3]), /measured probe differs/);
    assert.equal(uploads, 0);

    await writeFile(sourcePath, Buffer.alloc(1000, 3));
    await assert.rejects(() => publishPreparedCheckpoints([checkpoint], empty, 'reviewed', {
      upload: async (input) => { uploads += 1; return { key: input.key, url: 'unused' }; },
      readRemote: async () => Buffer.alloc(0),
      measureFile: async () => sourceProbe,
    } as Parameters<typeof publishPreparedCheckpoints>[3]), /source file hash/);
    assert.equal(uploads, 0);

    await rm(sourcePath);
    await assert.rejects(() => publishPreparedCheckpoints([checkpoint], empty, 'reviewed', {
      upload: async (input) => { uploads += 1; return { key: input.key, url: 'unused' }; },
      readRemote: async () => Buffer.alloc(0),
      measureFile: async () => sourceProbe,
    } as Parameters<typeof publishPreparedCheckpoints>[3]), /source file/);
    assert.equal(uploads, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
