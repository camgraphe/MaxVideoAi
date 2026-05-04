import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  buildMediaAssetInsert,
  mapLegacyJobRowToOutputs,
  normalizeMediaAssetSource,
  resolveLibraryAssetIdentity,
} from '../frontend/server/media-library';

test('maps legacy app_jobs media columns into ordered job outputs', () => {
  const outputs = mapLegacyJobRowToOutputs({
    job_id: 'job_123',
    user_id: 'user_1',
    surface: 'image',
    video_url: 'https://cdn.example.com/video.mp4',
    audio_url: 'https://cdn.example.com/audio.wav',
    thumb_url: 'https://cdn.example.com/poster.webp',
    preview_frame: null,
    render_ids: [
      {
        url: 'https://cdn.example.com/image-1.png',
        thumb_url: 'https://cdn.example.com/image-1-thumb.webp',
        width: 1024,
        height: 768,
        mime_type: 'image/png',
      },
      'https://cdn.example.com/image-2.png',
    ],
    duration_sec: 8,
    status: 'completed',
  });

  assert.deepEqual(
    outputs.map((output) => ({
      kind: output.kind,
      url: output.url,
      thumbUrl: output.thumbUrl,
      position: output.position,
      mimeType: output.mimeType,
    })),
    [
      {
        kind: 'video',
        url: 'https://cdn.example.com/video.mp4',
        thumbUrl: 'https://cdn.example.com/poster.webp',
        position: 0,
        mimeType: 'video/mp4',
      },
      {
        kind: 'audio',
        url: 'https://cdn.example.com/audio.wav',
        thumbUrl: null,
        position: 0,
        mimeType: 'audio/wav',
      },
      {
        kind: 'image',
        url: 'https://cdn.example.com/image-1.png',
        thumbUrl: 'https://cdn.example.com/image-1-thumb.webp',
        position: 0,
        mimeType: 'image/png',
      },
      {
        kind: 'image',
        url: 'https://cdn.example.com/image-2.png',
        thumbUrl: 'https://cdn.example.com/image-2.png',
        position: 1,
        mimeType: 'image/png',
      },
    ]
  );
});

test('normalizes library sources to the canonical allowed set', () => {
  assert.equal(normalizeMediaAssetSource('generated'), 'saved_job_output');
  assert.equal(normalizeMediaAssetSource('character'), 'character');
  assert.equal(normalizeMediaAssetSource('angle'), 'angle');
  assert.equal(normalizeMediaAssetSource('upscale'), 'upscale');
  assert.equal(normalizeMediaAssetSource('upload'), 'upload');
  assert.equal(normalizeMediaAssetSource('anything-else'), 'import');
  assert.equal(normalizeMediaAssetSource(null), 'import');
});

test('builds idempotent media asset identity from source output when available', () => {
  assert.equal(
    resolveLibraryAssetIdentity({
      userId: 'user_1',
      kind: 'video',
      url: 'https://cdn.example.com/render.mp4',
      source: 'saved_job_output',
      sourceOutputId: 'out_123',
    }),
    'output:out_123'
  );

  assert.equal(
    resolveLibraryAssetIdentity({
      userId: 'user_1',
      kind: 'image',
      url: 'https://cdn.example.com/render.png',
      source: 'import',
    }),
    'url:user_1:image:https://cdn.example.com/render.png'
  );
});

test('media asset insert keeps saved job output linked to the source output', () => {
  const insert = buildMediaAssetInsert({
    userId: 'user_1',
    kind: 'video',
    url: 'https://storage.example.com/render.mp4',
    thumbUrl: 'https://storage.example.com/render.webp',
    mimeType: 'video/mp4',
    width: 1920,
    height: 1080,
    sizeBytes: 1024,
    source: 'saved_job_output',
    sourceJobId: 'job_123',
    sourceOutputId: 'out_123',
    metadata: { label: 'Render' },
  });

  assert.equal(insert.source, 'saved_job_output');
  assert.equal(insert.sourceJobId, 'job_123');
  assert.equal(insert.sourceOutputId, 'out_123');
  assert.equal(insert.status, 'ready');
  assert.equal(insert.metadata.label, 'Render');
});

test('job detail route exposes PATCH for persistent hide', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/api/jobs/[jobId]/route.ts'),
    'utf8'
  );

  assert.match(source, /export\s+async\s+function\s+PATCH/);
  assert.match(source, /hidden\s*=\s*\$|SET\s+hidden\s*=/i);
});
