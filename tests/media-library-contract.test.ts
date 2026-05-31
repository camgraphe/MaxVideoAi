import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  buildMediaAssetInsert,
  mapLegacyJobRowToOutputs,
  normalizeMediaAssetSource,
  resolveLibraryAssetDedupeKey,
  resolveLibraryAssetOriginDedupeKey,
  resolveLibraryAssetIdentity,
} from '../frontend/server/media-library';

test('media library keeps record mapping helpers outside server orchestration', () => {
  const libraryPath = path.join(process.cwd(), 'frontend/server/media-library.ts');
  const recordsPath = path.join(process.cwd(), 'frontend/server/media-library-records.ts');
  const source = fs.readFileSync(libraryPath, 'utf8');
  const recordsSource = fs.readFileSync(recordsPath, 'utf8');
  const libraryLines = source.trimEnd().split(/\r?\n/).length;

  assert.ok(fs.existsSync(recordsPath));
  assert.ok(libraryLines <= 80, `media-library.ts should stay a thin facade, got ${libraryLines} lines`);
  assert.match(source, /from '\.\/media-library-records'/);
  assert.match(source, /export\s+\{[\s\S]*buildMediaAssetInsert[\s\S]*\}\s+from '\.\/media-library-records'/);
  assert.match(source, /from '\.\/media-library\/job-outputs'/);
  assert.match(source, /from '\.\/media-library\/assets'/);
  assert.doesNotMatch(source, /function\s+mapAssetRow\(/);
  assert.doesNotMatch(source, /function\s+listLibraryAssets\(/);
  assert.doesNotMatch(source, /function\s+ensureReusableAsset\(/);
  assert.doesNotMatch(source, /function\s+normalizeString\(/);
  assert.doesNotMatch(source, /export\s+type\s+MediaKind\s*=/);
  assert.match(recordsSource, /export\s+type\s+MediaKind\s*=/);
  assert.match(recordsSource, /export\s+function\s+mapLegacyJobRowToOutputs/);
  assert.match(recordsSource, /export\s+function\s+buildMediaAssetInsert/);
  assert.match(recordsSource, /export\s+function\s+mapOutputRow/);
  assert.match(recordsSource, /export\s+function\s+mapAssetRow/);
  assert.match(recordsSource, /parseStoredImageRenders/);
  assert.match(recordsSource, /normalizeMediaUrl/);
});

test('maps legacy app_jobs media columns into ordered job outputs', () => {
  const outputs = mapLegacyJobRowToOutputs({
    job_id: 'job_123',
    user_id: 'user_1',
    surface: 'image',
    video_url: 'https://cdn.example.com/video.mp4',
    video_width: 1440,
    video_height: 1440,
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
  } as Parameters<typeof mapLegacyJobRowToOutputs>[0] & { video_width: number; video_height: number });

  assert.deepEqual(
    outputs.map((output) => ({
      kind: output.kind,
      url: output.url,
      thumbUrl: output.thumbUrl,
      position: output.position,
      mimeType: output.mimeType,
      width: output.width,
      height: output.height,
    })),
    [
      {
        kind: 'video',
        url: 'https://cdn.example.com/video.mp4',
        thumbUrl: 'https://cdn.example.com/poster.webp',
        position: 0,
        mimeType: 'video/mp4',
        width: 1440,
        height: 1440,
      },
      {
        kind: 'audio',
        url: 'https://cdn.example.com/audio.wav',
        thumbUrl: null,
        position: 0,
        mimeType: 'audio/wav',
        width: null,
        height: null,
      },
      {
        kind: 'image',
        url: 'https://cdn.example.com/image-1.png',
        thumbUrl: 'https://cdn.example.com/image-1-thumb.webp',
        position: 0,
        mimeType: 'image/png',
        width: 1024,
        height: 768,
      },
      {
        kind: 'image',
        url: 'https://cdn.example.com/image-2.png',
        thumbUrl: 'https://cdn.example.com/image-2.png',
        position: 1,
        mimeType: 'image/png',
        width: null,
        height: null,
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
    path.join(process.cwd(), 'frontend/server/media-library/assets.ts'),
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

test('deduplicates copied generated assets against legacy origin urls', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/media-library/assets.ts'),
    'utf8'
  );

  assert.equal(
    resolveLibraryAssetOriginDedupeKey({
      id: 'output:job_123:image:0',
      userId: 'user_1',
      kind: 'image',
      url: 'https://storage.example.com/renders/job_123-1.png',
      metadata: {
        originUrl: 'https://v3b.fal.media/files/b/render.png',
      },
    }),
    resolveLibraryAssetOriginDedupeKey({
      id: 'job_123:character:1',
      userId: 'user_1',
      kind: 'image',
      url: 'https://v3b.fal.media/files/b/render.png',
      metadata: {
        jobId: 'job_123',
      },
    })
  );
  assert.match(source, /resolveLibraryAssetOriginDedupeKey\(asset\)/);
  assert.match(source, /resolveLibraryAssetOriginDedupeKey\(legacyAsset\)/);
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

test('job detail route repairs completed video thumbnails and syncs outputs', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/api/jobs/[jobId]/route.ts'),
    'utf8'
  );
  const repairStart = source.indexOf('let responseVideoUrl = normalizedVideoUrl');
  const repairEnd = source.indexOf('return json({', repairStart);
  const repairBlock = source.slice(repairStart, repairEnd);

  assert.match(repairBlock, /ensureFastStartVideo/);
  assert.match(repairBlock, /isPlaceholderThumbnail\(normalizedThumbUrl\)/);
  assert.match(repairBlock, /ensureJobThumbnail/);
  assert.match(repairBlock, /UPDATE app_jobs[\s\S]*thumb_url = \$2[\s\S]*preview_frame = \$2/);
  assert.match(repairBlock, /upsertLegacyJobOutputs/);
  assert.match(repairBlock, /video_url:\s*responseVideoUrl/);
  assert.match(repairBlock, /thumb_url:\s*normalizedThumbUrl/);
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
  const clientSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/library/_components/LibraryPageClient.tsx'),
    'utf8'
  );
  const helpersSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/library/_lib/library-page-helpers.ts'),
    'utf8'
  );

  assert.match(browserSource, /getAssetHref\?:\s*\(asset:\s*AssetBrowserAsset\)\s*=>\s*string\s*\|\s*null/);
  assert.match(browserSource, /data-library-card-media-link/);
  assert.match(clientSource, /getAssetHref=\{\(asset\)\s*=>[\s\S]*getAssetJobHref\(asset\)/);
  assert.match(helpersSource, /export function\s+isMaxVideoGeneratedAsset/);
  assert.doesNotMatch(clientSource, /\?\?\s*asset\.url/);
  assert.match(clientSource, /getAssetHrefLabel=\{\(\)\s*=>[\s\S]*copy\.assets\.openAssetButton/);
  assert.doesNotMatch(clientSource, />\s*\{copy\.assets\.useSettingsButton\}\s*</);
  assert.match(clientSource, /<Download\s+className=/);
  assert.match(clientSource, /<Trash2\s+className=/);
});

test('media assets preserve and backfill thumbnails from job outputs', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/media-library/assets.ts'),
    'utf8'
  );
  const resolverSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/media-library/asset-resolvers.ts'),
    'utf8'
  );
  const migrationPath = path.join(process.cwd(), 'neon/migrations/18_media_assets_thumb_backfill.sql');

  assert.match(resolverSource, /export async function resolveReusableAssetThumbUrl/);
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
    path.join(process.cwd(), 'frontend/server/media-library/assets.ts'),
    'utf8'
  );
  const resolverSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/media-library/asset-resolvers.ts'),
    'utf8'
  );
  const mediaSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/media-library/asset-media.ts'),
    'utf8'
  );
  const recordsSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/media-library-records.ts'),
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

  assert.match(recordsSource, /previewUrl:\s*string\s*\|\s*null/);
  assert.match(serviceSource, /preview_url/);
  assert.match(resolverSource, /export async function resolveReusableAssetPreviewUrl/);
  assert.match(mediaSource, /export async function createRemoteVideoAssetThumbnail/);
  assert.match(mediaSource, /createUploadVideoThumbnail/);
  assert.match(assetsRoute, /previewUrl:\s*asset\.previewUrl/);
  assert.match(recentRoute, /previewUrl:\s*output\.previewUrl/);
  assert.match(browserSource, /activePreviewId/);
  assert.match(browserSource, /src=\{activePreviewId === asset\.id \? asset\.previewUrl : undefined\}/);
  assert.match(browserSource, /poster=\{asset\.thumbUrl \?\? undefined\}/);
});

test('job output upserts preserve detected dimensions when legacy sync omits them', () => {
  const jobOutputsSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/media-library/job-outputs.ts'),
    'utf8'
  );

  assert.match(jobOutputsSource, /width = COALESCE\(EXCLUDED\.width, job_outputs\.width\)/);
  assert.match(jobOutputsSource, /height = COALESCE\(EXCLUDED\.height, job_outputs\.height\)/);
});

test('history cards use thumbnails and explicit card actions', () => {
  const cardSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/GroupedJobCard.tsx'),
    'utf8'
  );
  const mediaSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/GroupedJobCardMedia.tsx'),
    'utf8'
  );
  const jobsSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/jobs/_hooks/useJobsPageController.ts'),
    'utf8'
  );
  const jobsShellSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/jobs/_components/JobsPageShell.tsx'),
    'utf8'
  );

  assert.match(mediaSource, /const\s+thumbSrc\s*=\s*preview\?\.thumbUrl/);
  assert.match(mediaSource, /src=\{thumbSrc\}/);
  assert.match(cardSource, /openLabel\?:\s*string/);
  assert.match(cardSource, /actionMenuLabel\?:\s*string/);
  assert.match(cardSource, /aria-label=\{actionMenuLabel\}/);
  assert.match(jobsShellSource, /openLabel=\{copy\.actions\.openDetails\}/);
  assert.match(jobsShellSource, /actionMenuLabel=\{copy\.actions\.actions\}/);
  assert.match(jobsShellSource, /expandSection/);
  assert.match(jobsShellSource, /collapseSection/);
  assert.match(jobsShellSource, /<ChevronDown/);
  assert.doesNotMatch(`${jobsSource}\n${jobsShellSource}`, /'▸'|'▾'/);
});

test('history can save renders to library from cards and job details', () => {
  const cardSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/GroupedJobCard.tsx'),
    'utf8'
  );
  const cardTypesSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/grouped-job-card-types.ts'),
    'utf8'
  );
  const jobsSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/jobs/_hooks/useJobsPageController.ts'),
    'utf8'
  );
  const jobsShellSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/jobs/_components/JobsPageShell.tsx'),
    'utf8'
  );
  const jobsHelpersSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/jobs/_lib/jobs-page-helpers.ts'),
    'utf8'
  );
  const apiSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/lib/api-assets.ts'),
    'utf8'
  );

  assert.match(cardTypesSource, /\|\s*'save-to-library'/);
  assert.match(cardSource, /showLibraryCta\?:\s*boolean/);
  assert.match(cardSource, /<Plus\s+className=/);
  assert.match(cardSource, /handleAction\('save-to-library'\)/);
  assert.match(jobsSource, /saveAssetToLibrary/);
  assert.match(jobsHelpersSource, /function\s+resolveGroupLibrarySavePayload/);
  assert.match(jobsHelpersSource, /function\s+resolveEntryLibrarySavePayload/);
  assert.match(jobsShellSource, /showLibraryCta/);
  assert.match(jobsShellSource, /<CollapsedGroupRail[\s\S]*onSaveToLibrary/);
  assert.match(jobsShellSource, /onSaveToLibrary=\{onSaveGroupToLibrary\}/);
  assert.match(jobsShellSource, /onSaveToLibrary=\{onSaveLightboxEntryToLibrary\}/);
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

test('image upload and library routes return stable JSON errors for storage failures', () => {
  const imageRoute = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/api/uploads/image/route.ts'),
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

  assert.match(imageRoute, /failed to prepare image asset store/);
  assert.match(imageRoute, /error:\s*'STORE_FAILED'/);
  assert.match(assetsRoute, /failed to list assets/);
  assert.match(assetsRoute, /error:\s*'LOAD_FAILED'/);
  assert.match(recentRoute, /failed to list recent outputs/);
  assert.match(recentRoute, /error:\s*'LOAD_FAILED'/);
});

test('image upload UI maps storage error codes to actionable copy', () => {
  const errorSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/src/lib/error-messages.ts'),
    'utf8'
  );
  const imageClientUploadSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/src/lib/client-image-upload.ts'),
    'utf8'
  );

  assert.match(errorSource, /UPLOAD_FAILED:\s*\(\)\s*=>/);
  assert.match(errorSource, /STORE_FAILED:\s*\(\)\s*=>/);
  assert.match(errorSource, /status\s*===\s*413/);
  assert.match(imageClientUploadSource, /NEXT_PUBLIC_ASSET_UPLOAD_TARGET_MB/);
  assert.match(imageClientUploadSource, /targetBytes/);
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

test('single-job thumbnail regeneration keeps legacy outputs in sync', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'frontend/scripts/regenerate-thumbnail.ts'),
    'utf8'
  );

  assert.match(source, /upsertLegacyJobOutputs/);
  assert.match(source, /await import\('\.\.\/server\/thumbnails'\)/);
  assert.match(source, /preview_frame = \$2/);
  assert.match(source, /thumb_url:\s*newThumb/);
  assert.match(source, /preview_frame:\s*newThumb/);
});

test('admin moderation thumbnail updates keep generated media records in sync', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/api/admin/videos/[videoId]/thumbnail/route.ts'),
    'utf8'
  );

  assert.match(source, /ensureJobThumbnail/);
  assert.match(source, /force:\s*true/);
  assert.match(source, /UPDATE app_jobs[\s\S]*thumb_url = \$2[\s\S]*preview_frame = \$2/);
  assert.match(source, /upsertLegacyJobOutputs/);
  assert.match(source, /UPDATE media_assets[\s\S]*thumb_url = \$2[\s\S]*source_job_id = \$1/);
  assert.match(source, /logAdminAction/);
});
