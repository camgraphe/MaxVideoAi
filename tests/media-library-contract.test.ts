import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  buildMediaAssetInsert,
  mapLegacyJobRowToOutputs,
  normalizeMediaAssetSource,
  resolveLibraryAssetDedupeKey,
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

test('deduplicates canonical and legacy library rows by media URL identity', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/media-library.ts'),
    'utf8'
  );

  assert.equal(
    resolveLibraryAssetDedupeKey({
      id: 'url:user_1:image:https://cdn.example.com/upload.png',
      userId: 'user_1',
      kind: 'image',
      url: 'https://cdn.example.com/upload.png',
      source: 'upload',
      sourceOutputId: null,
    }),
    resolveLibraryAssetDedupeKey({
      id: 'legacy_random_id',
      userId: 'user_1',
      kind: 'image',
      url: 'https://cdn.example.com/upload.png',
      source: 'upload',
      sourceOutputId: null,
    })
  );
  assert.match(source, /const\s+dedupeKey\s*=\s*resolveLibraryAssetDedupeKey\(asset\)/);
  assert.match(source, /seen\.has\(dedupeKey\)/);
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

test('ensure route treats job-linked saves as generated assets by default', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/api/media-library/ensure/route.ts'),
    'utf8'
  );

  assert.match(source, /const\s+sourceJobId\s*=/);
  assert.match(source, /source:\s*payload\?\.source\s*\?\?\s*\(sourceJobId\s*\?\s*'generated'\s*:\s*undefined\)/);
});

test('library cards use icon actions and put source navigation on the visual', () => {
  const browserSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/library/AssetLibraryBrowser.tsx'),
    'utf8'
  );
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/library/page.tsx'),
    'utf8'
  );

  assert.match(browserSource, /getAssetHref\?:\s*\(asset:\s*AssetBrowserAsset\)\s*=>\s*string\s*\|\s*null/);
  assert.match(browserSource, /data-library-card-media-link/);
  assert.match(pageSource, /getAssetHref=\{\(asset\)\s*=>[\s\S]*getAssetJobHref\(asset\)/);
  assert.match(pageSource, /function\s+isMaxVideoGeneratedAsset/);
  assert.doesNotMatch(pageSource, /\?\?\s*asset\.url/);
  assert.match(pageSource, /getAssetHrefLabel=\{\(\)\s*=>[\s\S]*copy\.assets\.openAssetButton/);
  assert.doesNotMatch(pageSource, />\s*\{copy\.assets\.useSettingsButton\}\s*</);
  assert.match(pageSource, /<Download\s+className=/);
  assert.match(pageSource, /<Trash2\s+className=/);
});

test('media assets preserve and backfill thumbnails from job outputs', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/media-library.ts'),
    'utf8'
  );
  const migrationPath = path.join(process.cwd(), 'neon/migrations/18_media_assets_thumb_backfill.sql');

  assert.match(source, /resolveReusableAssetThumbUrl/);
  assert.match(source, /thumb_url\s*=\s*COALESCE\(EXCLUDED\.thumb_url,\s*media_assets\.thumb_url\)/);
  assert.ok(fs.existsSync(migrationPath));

  const migration = fs.readFileSync(migrationPath, 'utf8');
  assert.match(migration, /UPDATE\s+media_assets/i);
  assert.match(migration, /JOIN\s+job_outputs/i);
  assert.match(migration, /source_output_id/i);
  assert.match(migration, /source_job_id/i);
});

test('video preview urls stay separate from final media urls across library contracts', () => {
  const serviceSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/media-library.ts'),
    'utf8'
  );
  const assetsRoute = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/api/media-library/assets/route.ts'),
    'utf8'
  );
  const recentRoute = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/api/media-library/recent-outputs/route.ts'),
    'utf8'
  );
  const browserSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/library/AssetLibraryBrowser.tsx'),
    'utf8'
  );
  const migrationPath = path.join(process.cwd(), 'neon/migrations/19_media_preview_urls.sql');

  assert.ok(fs.existsSync(migrationPath));
  const migration = fs.readFileSync(migrationPath, 'utf8');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS preview_url TEXT/i);
  assert.match(migration, /preview_video_url/i);
  assert.match(migration, /job_fallback/i);
  assert.match(migration, /COALESCE\(asset\.source_job_id,\s*asset\.metadata->>'jobId'/);

  assert.match(serviceSource, /previewUrl:\s*string\s*\|\s*null/);
  assert.match(serviceSource, /preview_url/);
  assert.match(serviceSource, /resolveReusableAssetPreviewUrl/);
  assert.match(serviceSource, /createRemoteVideoAssetThumbnail/);
  assert.match(serviceSource, /createUploadVideoThumbnail/);
  assert.match(assetsRoute, /previewUrl:\s*asset\.previewUrl/);
  assert.match(recentRoute, /previewUrl:\s*output\.previewUrl/);
  assert.match(browserSource, /activePreviewId/);
  assert.match(browserSource, /src=\{activePreviewId === asset\.id \? asset\.previewUrl : undefined\}/);
  assert.match(browserSource, /poster=\{asset\.thumbUrl \?\? undefined\}/);
});

test('history cards use thumbnails and explicit card actions', () => {
  const cardSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/GroupedJobCard.tsx'),
    'utf8'
  );
  const jobsSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/jobs/page.tsx'),
    'utf8'
  );

  assert.match(cardSource, /const\s+thumbSrc\s*=\s*preview\?\.thumbUrl/);
  assert.match(cardSource, /src=\{thumbSrc\}/);
  assert.match(cardSource, /openLabel\?:\s*string/);
  assert.match(cardSource, /actionMenuLabel\?:\s*string/);
  assert.match(cardSource, /aria-label=\{actionMenuLabel\}/);
  assert.match(jobsSource, /openLabel=\{copy\.actions\.openDetails\}/);
  assert.match(jobsSource, /actionMenuLabel=\{copy\.actions\.actions\}/);
  assert.match(jobsSource, /expandSection/);
  assert.match(jobsSource, /collapseSection/);
  assert.match(jobsSource, /<ChevronDown/);
  assert.doesNotMatch(jobsSource, /'▸'|'▾'/);
});

test('history can save renders to library from cards and job details', () => {
  const cardSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/GroupedJobCard.tsx'),
    'utf8'
  );
  const jobsSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/jobs/page.tsx'),
    'utf8'
  );
  const apiSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/lib/api.ts'),
    'utf8'
  );

  assert.match(cardSource, /\|\s*'save-to-library'/);
  assert.match(cardSource, /showLibraryCta\?:\s*boolean/);
  assert.match(cardSource, /<Plus\s+className=/);
  assert.match(cardSource, /handleAction\('save-to-library'\)/);
  assert.match(jobsSource, /saveAssetToLibrary/);
  assert.match(jobsSource, /function\s+resolveGroupLibrarySavePayload/);
  assert.match(jobsSource, /function\s+resolveEntryLibrarySavePayload/);
  assert.match(jobsSource, /showLibraryCta/);
  assert.match(jobsSource, /CollapsedGroupRail\([\s\S]*onSaveToLibrary/);
  assert.match(jobsSource, /onSaveToLibrary=\{handleSaveGroupToLibrary\}/);
  assert.match(jobsSource, /onSaveToLibrary=\{handleSaveLightboxEntryToLibrary\}/);
  assert.match(apiSource, /kind\?:\s*'image'\s*\|\s*'video'\s*\|\s*'audio'/);
  assert.match(apiSource, /thumbUrl:\s*payload\.thumbUrl/);
  assert.match(apiSource, /previewUrl:\s*payload\.previewUrl/);
});

test('upload routes persist reusable thumbnails for new image and video assets', () => {
  const imageRoute = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/api/uploads/image/route.ts'),
    'utf8'
  );
  const videoRoute = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/api/uploads/video/route.ts'),
    'utf8'
  );

  assert.match(imageRoute, /createUploadImageThumbnail/);
  assert.match(imageRoute, /thumbUrl:\s*imageThumbUrl/);
  assert.match(imageRoute, /ensureReusableAsset\([\s\S]*thumbUrl:\s*imageThumbUrl/);
  assert.match(imageRoute, /asset:\s*\{[\s\S]*thumbUrl:\s*imageThumbUrl/);

  assert.match(videoRoute, /createUploadVideoThumbnail/);
  assert.match(videoRoute, /thumbUrl:\s*videoThumbUrl/);
  assert.match(videoRoute, /ensureReusableAsset\([\s\S]*thumbUrl:\s*videoThumbUrl/);
  assert.match(videoRoute, /asset:\s*\{[\s\S]*thumbUrl:\s*videoThumbUrl/);
});

test('thumbnail backfill targets uploaded media and legacy video assets', () => {
  const scriptPath = path.join(process.cwd(), 'frontend/scripts/backfill-upload-thumbnails.ts');

  assert.ok(fs.existsSync(scriptPath));
  const source = fs.readFileSync(scriptPath, 'utf8');
  assert.match(source, /source\s*=\s*'upload'/);
  assert.match(source, /OR\s+kind\s*=\s*'video'/);
  assert.match(source, /thumb_url\s+IS\s+NULL/i);
  assert.match(source, /createUploadImageThumbnail/);
  assert.match(source, /UPDATE\s+media_assets/i);
  assert.match(source, /UPDATE\s+user_assets/i);
});
