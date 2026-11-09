import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import * as renders from '../frontend/lib/image-renders';
import * as thumbnailOwner from '../frontend/server/image-thumbnails';

const original = 'https://cdn.example.com/original.png';
const display = {
  version: 1,
  profile: 'image-display-v1',
  sourceUrl: original,
  sourceSha256: 'a'.repeat(64),
  url: 'https://cdn.example.com/display.webp',
  mimeType: 'image/webp',
  width: 1920,
  height: 960,
  sizeBytes: 32000,
};
test('structured renders retain source-bound measured display independently for each output', () => {
  const stored = renders.buildStoredImageRenderEntries([
    {
      url: original,
      thumbUrl: 'https://cdn.example.com/thumb.webp',
      previewUrl: display.url,
      imageDisplay: display,
    } as any,
    { url: 'https://cdn.example.com/other.png' },
  ]);
  const parsed = renders.parseStoredImageRenders(stored);
  assert.deepEqual((parsed.entries[0] as any).imageDisplay, display);
  assert.equal((parsed.entries[0] as any).previewUrl, display.url);
  assert.equal((parsed.entries[1] as any).imageDisplay, undefined);
  const stale = renders.buildStoredImageRenderEntries([
    {
      url: 'https://cdn.example.com/other.png',
      previewUrl: display.url,
      imageDisplay: display,
    } as any,
  ]);
  assert.equal(
    (renders.parseStoredImageRenders(stale).entries[0] as any).imageDisplay,
    undefined,
  );
});
test('paired preparation measures real alpha portrait output, reuses bytes, retains thumb on optional display failure', async () => {
  const prepare = (thumbnailOwner as any).prepareImageRenditions;
  assert.equal(
    typeof prepare,
    'function',
    'existing preparation owner exports paired renditions',
  );
  const data = await sharp({
    create: {
      width: 2400,
      height: 3600,
      channels: 4,
      background: { r: 80, g: 40, b: 20, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  const uploads: any[] = [];
  const deps = {
    upload: async (input: any) => {
      uploads.push(input);
      return { url: `https://cdn.example.com/${uploads.length}.webp` };
    },
    authorize: async () => {
      throw Error('buffer must not authorize');
    },
    fetch: async () => {
      throw Error('buffer must not fetch');
    },
  };
  const result = await prepare(
    { data, imageUrl: original, jobId: 'job', userId: 'owner', index: 0 },
    deps,
  );
  assert.ok(result.thumbUrl);
  assert.equal(result.imageDisplay.width, 1280);
  assert.equal(result.imageDisplay.height, 1920);
  assert.equal(
    result.imageDisplay.sourceSha256,
    createHash('sha256').update(data).digest('hex'),
  );
  assert.equal(result.imageDisplay.sizeBytes, uploads[1].data.length);
  assert.equal((await sharp(uploads[1].data).metadata()).hasAlpha, true);
  assert.ok(
    Math.max(
      (await sharp(uploads[0].data).metadata()).width!,
      (await sharp(uploads[0].data).metadata()).height!,
    ) <= 640,
  );
  let count = 0;
  const partial = await prepare(
    { data, imageUrl: original, jobId: 'job', index: 0 },
    {
      ...deps,
      upload: async () => {
        if (++count === 2) throw Error('display unavailable');
        return { url: 'https://cdn.example.com/thumb.webp' };
      },
    },
  );
  assert.equal(partial.thumbUrl, 'https://cdn.example.com/thumb.webp');
  assert.equal(partial.imageDisplay, undefined);
});

test('exact legacy output and browser projection carry only their own validated display', async () => {
  const { mapLegacyJobRowToOutputs } = await import(
    '../frontend/server/media-library-records'
  );
  const { serializeLibraryAsset } = await import(
    '../frontend/server/media-library/asset-response'
  );
  const outputs = mapLegacyJobRowToOutputs({
    job_id: 'job',
    user_id: 'user',
    status: 'completed',
    render_ids: renders.buildStoredImageRenderEntries([
      { url: original, previewUrl: display.url, imageDisplay: display } as any,
      { url: 'https://cdn.example.com/other.png' },
    ]),
  } as any);
  assert.equal(outputs[0].previewUrl, display.url);
  assert.deepEqual(outputs[0].metadata.imageDisplay, display);
  assert.equal(outputs[1].previewUrl, null);
  assert.deepEqual(
    (
      serializeLibraryAsset({
        ...outputs[0],
        metadata: outputs[0].metadata,
      } as any) as any
    ).imageDisplay,
    display,
  );
});

test('paired URL preparation authorizes/fetches once and skips unhelpful/animated source displays', async () => {
  const prepare = (thumbnailOwner as any).prepareImageRenditions;
  const data = await sharp({
    create: { width: 4000, height: 2000, channels: 3, background: '#abcdff' },
  })
    .png()
    .toBuffer();
  let authorization = 0,
    reads = 0,
    puts = 0;
  const input = { imageUrl: original, jobId: 'job', index: 1, userId: 'owner' };
  const deps = {
    authorize: async ({ url, userId }: any) => {
      assert.equal(url, original);
      assert.equal(userId, 'owner');
      authorization++;
      return original + '?private=grant';
    },
    fetch: async () => {
      reads++;
      return new Response(data);
    },
    upload: async () => ({
      url: 'https://cdn.example.com/' + ++puts + '.webp',
    }),
  };
  const result = await prepare(input, deps);
  assert.equal(authorization, 1);
  assert.equal(reads, 1);
  assert.equal(result.imageDisplay.width, 1920);
  assert.equal(result.imageDisplay.height, 960);
  const small = await sharp({
    create: { width: 1, height: 1, channels: 3, background: '#fff' },
  })
    .webp()
    .toBuffer();
  const tiny = await prepare({ ...input, data: small }, deps);
  assert.equal(tiny.imageDisplay, undefined, 'no larger copy of tiny original');
  // Two GIF image descriptors, measured by real Sharp as two pages.
  const gif = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
  );
  const marker = gif.indexOf(Buffer.from([0x21, 0xf9]));
  const animated = Buffer.concat([
    gif.subarray(0, gif.length - 1),
    gif.subarray(marker),
  ]);
  assert.equal((await sharp(animated).metadata()).pages, 2);
  const skipped = await prepare({ ...input, data: animated }, deps);
  assert.equal(skipped.imageDisplay, undefined);
});

test('existing image responses and Gallery keep the display of the exact image output', async () => {
  const { buildResponseFromExistingJob } = await import(
    '../frontend/src/server/images/existing-image-job-response'
  );
  const { galleryMediaAssets } = await import(
    '../frontend/components/library/gallery-media-assets'
  );
  const image = {
    url: original,
    thumbUrl: 'https://cdn.example.com/thumb.webp',
    previewUrl: display.url,
    imageDisplay: display,
  };
  const response = buildResponseFromExistingJob({
    job: {
      job_id: 'job',
      render_ids: renders.buildStoredImageRenderEntries([image as any]),
    },
    mode: 't2i',
    engineId: 'fixture',
    engineLabel: 'fixture',
    resolution: '2K',
    resolvedAspectRatio: null,
  } as any);
  assert.deepEqual(response.images[0].imageDisplay, display);
  const members = [0, 1].map((index) => ({
    id: `job-image-${index}`,
    jobId: 'job',
    status: 'completed',
    job: {
      jobId: 'job',
      renderIds: [original, 'https://cdn.example.com/other.png'],
      imageRenders: [image, { url: 'https://cdn.example.com/other.png' }],
    },
  }));
  const assets = galleryMediaAssets({ id: 'group', members } as any, 'image');
  assert.deepEqual(assets[0].imageDisplay, display);
  assert.equal(assets[1].imageDisplay, undefined);
  assert.equal(assets[0].sourceOutputId, 'job:image:0');
  assert.equal(assets[1].sourceOutputId, 'job:image:1');
});

test('recent/status/history and fresh local groups retain validated displays but refuse a changed original', async () => {
  const { mapRecentGenerationRecordToWeb } = await import(
    '../frontend/src/server/generations/recent-generation-web-mapper'
  );
  const { mapGenerationStatusRecordToWeb } = await import(
    '../frontend/src/server/generations/generation-status'
  );
  const { galleryMediaAssets } = await import(
    '../frontend/components/library/gallery-media-assets'
  );
  const { buildCompletedGroup } = await import(
    '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-history'
  );
  const image = {
    url: original,
    thumbUrl: 'https://cdn.example.com/thumb.webp',
    previewUrl: display.url,
    imageDisplay: display,
  };
  const record = {
    job_id: 'job',
    surface: 'image',
    status: 'completed',
    render_ids: renders.buildStoredImageRenderEntries([image as any]),
    created_at: '2026-11-09',
    engine_id: 'fixture',
    engine_label: 'fixture',
  };
  for (const job of [
    mapRecentGenerationRecordToWeb(record as any),
    mapGenerationStatusRecordToWeb(record as any),
  ]) {
    assert.deepEqual(job.imageRenders?.[0].imageDisplay, display);
    const members = [
      {
        id: 'job-image-0',
        job,
        status: 'completed',
        originalUrl: 'https://cdn.example.com/changed.png',
      },
    ];
    const rejected = galleryMediaAssets(
      { id: 'group', members } as any,
      'image',
    )[0];
    assert.equal(rejected.imageDisplay, undefined);
    assert.equal(rejected.ref, undefined);
  }
  const local = buildCompletedGroup({
    id: 'job',
    engineId: 'fixture',
    engineLabel: 'fixture',
    prompt: '',
    aspectRatio: null,
    images: [image as any],
    createdAt: Date.now(),
  });
  const selected = galleryMediaAssets(local, 'image')[0];
  assert.deepEqual(selected.imageDisplay, display);
  assert.equal(selected.sourceOutputId, 'job:image:0');
});

test('historical image mapping and sparse exact output enrichment preserve output identity without index zipping', async () => {
  const { applyOutputsToJobPayload } = await import(
    '../frontend/server/media-library/job-outputs'
  );
  const { mapJobToHistoryEntry } = await import(
    '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-history'
  );
  const { galleryMediaAssets } = await import(
    '../frontend/components/library/gallery-media-assets'
  );
  const enriched = applyOutputsToJobPayload({ jobId: 'job' }, [
    {
      id: 'job:image:3',
      jobId: 'job',
      kind: 'image',
      position: 3,
      url: original,
      previewUrl: display.url,
      metadata: { imageDisplay: display },
    },
  ] as any) as any;
  const history = mapJobToHistoryEntry(enriched)!;
  assert.deepEqual(history.images[0].imageDisplay, display);
  assert.equal((history.images[0] as any).sourceOutputId, 'job:image:3');
  const asset = galleryMediaAssets(
    { id: 'group', members: [{ id: 'job-image-0', job: enriched }] } as any,
    'image',
  )[0];
  assert.equal(asset.sourceOutputId, 'job:image:3');
  assert.deepEqual(asset.imageDisplay, display);
});

test('real orientation metadata is applied before measuring display dimensions', async (t) => {
  const data = await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: '#bcaaff' },
  })
    .jpeg({ quality: 95 })
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const uploads: Buffer[] = [];
  const result = await thumbnailOwner.prepareImageRenditions(
    { data, imageUrl: original, jobId: 'rotated', index: 0 },
    {
      upload: async (input) => {
        uploads.push(input.data);
        return {
          url: `https://cdn.example.com/rotated-${uploads.length}.webp`,
        };
      },
    },
  );
  assert.equal(result.imageDisplay?.width, 960);
  assert.equal(result.imageDisplay?.height, 1920);
  assert.equal((await sharp(uploads[1]).metadata()).orientation, undefined);
  t.diagnostic(
    JSON.stringify({
      fixture: 'synthetic solid EXIF-6 JPEG',
      originalBytes: data.length,
      thumbnailBytes: uploads[0].length,
      displayBytes: uploads[1].length,
    }),
  );
});
