import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { factsFromProbe } from '../frontend/lib/generated-video-media-facts';
import { mapLegacyJobRowToOutputs, mapOutputRow, mapAssetRow } from '../frontend/server/media-library-records';

const originalUrl = 'https://owned.test/original.mp4';
const libraryUrl = 'https://owned.test/library-copy.mp4';
const facts = factsFromProbe({ streams: [{ codec_type: 'video', duration: '15.001' }], format: { duration: '15.001' } },
  { url: originalUrl, sha256: 'a'.repeat(64), sizeBytes: 42 })!;
async function load(entry: string, fixture: unknown, stubs: Record<string, string>) {
  const frontend = path.join(process.cwd(), 'frontend');
  const bundle = await build({ absWorkingDir: frontend, bundle: true, format: 'cjs', platform: 'node', write: false,
    tsconfig: path.join(frontend, 'tsconfig.json'), entryPoints: [entry],
    plugins: [{ name: 'boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: frontend }));
    } }],
  });
  const module = { exports: {} };
  runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, fixture,
    require: createRequire(import.meta.url), Buffer, URL, process: { env: (fixture as { env?: Record<string, string> }).env ?? {} }, console: { info() {}, warn() {}, error() {} } });
  return module.exports as Record<string, (...args: any[]) => Promise<any>>;
}
test('precise facts survive output projection while nominal requested duration stays integer', () => {
  const output = mapLegacyJobRowToOutputs({ job_id: 'job', user_id: 'owner', video_url: originalUrl,
    duration_sec: 10, video_media_facts: facts, status: 'completed' })[0];
  assert.equal(output.durationSec, 10);
  assert.equal((output.metadata.mediaFacts as typeof facts).durationSec, 15.001);
  const projected = mapOutputRow({ id: output.id, job_id: 'job', user_id: 'owner', kind: 'video', url: originalUrl,
    storage_url: null, thumb_url: null, preview_url: null, mime_type: 'video/mp4', width: 1280, height: 720,
    duration_sec: 10, position: 0, status: 'ready', metadata: output.metadata, created_at: '2026-01-01' });
  assert.equal(projected.durationSec, 15.001);
  assert.equal(mapOutputRow({ ...({ id: output.id, job_id: 'job', user_id: 'owner', kind: 'video', url: 'https://owned.test/new.mp4',
    storage_url: null, thumb_url: null, preview_url: null, mime_type: 'video/mp4', width: 1280, height: 720,
    duration_sec: 10, position: 0, status: 'ready', metadata: output.metadata, created_at: '2026-01-01' } as const) }).durationSec, null);
});
const assetRow = (metadata: unknown, url = libraryUrl) => ({ id: 'output:job:video:0', user_id: 'owner', kind: 'video' as const, url,
  thumb_url: 'https://owned.test/thumb.jpg', preview_url: null, mime_type: 'video/mp4', width: 1280, height: 720,
  size_bytes: 42, source: 'saved_job_output', source_job_id: 'job', source_output_id: 'job:video:0', status: 'ready', metadata, created_at: '2026-01-01' });
const assetStubs = {
  '@/lib/db': 'export const query = (...args) => fixture.query(...args);',
  '@/lib/schema': 'export const ensureMediaLibrarySchema = async () => {};',
  '@/server/storage': 'export const recordUserAsset = async (value) => fixture.mirror.push(value);',
  './asset-listing': 'export const findLibraryAssetByOrigin = async () => null; export const listLibraryAssetPage = async () => ({});',
  './asset-resolvers': 'export const resolveReusableAssetThumbUrl = async () => null; export const resolveReusableAssetPreviewUrl = async () => null;',
  './asset-media': 'export const createRemoteVideoAssetThumbnail = async () => null; export const copyRemoteMedia = (...args) => fixture.copy(...args);',
};
test('existing saved copy receives reliable facts, reused on subsequent save; inaccessible refresh stays usable', async () => {
  for (const unavailable of [false, true]) {
    let stored = assetRow({ originUrl: originalUrl, durationSec: 10 });
    let copies = 0;
    const fixture = { mirror: [] as unknown[], query: async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM job_outputs')) return [{ id: 'job:video:0', job_id: 'job', user_id: 'owner', kind: 'video', url: originalUrl, storage_url: null, metadata: { mediaFacts: facts } }];
      if (sql.includes('FROM media_assets')) return [stored];
      if (sql.includes('INSERT INTO media_assets')) { stored = assetRow(JSON.parse(params[14] as string)); return [stored]; }
      throw new Error('Unexpected query');
    }, copy: async (params: { ownedGeneratedVideo?: { mediaFacts: typeof facts } }) => {
      copies++;
      assert.equal(params.ownedGeneratedVideo?.mediaFacts.durationSec, 15.001);
      if (unavailable) throw new Error('Media unavailable');
      return { url: libraryUrl, thumbUrl: null, mimeType: 'video/mp4', width: null, height: null, sizeBytes: 42,
        mediaFacts: { ...facts, original: { ...facts.original, url: libraryUrl } } };
    } };
    const module = await load('server/media-library/assets.ts', fixture, assetStubs);
    const params = { userId: 'owner', url: originalUrl, kind: 'video', source: 'saved_job_output', sourceJobId: 'job', sourceOutputId: 'job:video:0', durationSec: 10, allowRemoteThumbnailFallback: false };
    const result = await module.ensureReusableAsset(params);
    assert.equal(result.durationSec, unavailable ? 10 : 15.001);
    assert.equal(copies, 1);
    if (!unavailable) {
      assert.equal((await module.ensureReusableAsset(params)).durationSec, 15.001);
      assert.equal(copies, 1);
      assert.equal(mapAssetRow(stored).durationSec, 15.001);
    }
  }
});
test('substituted client URL is rejected before copy or probe', async () => {
  let copies = 0;
  const module = await load('server/media-library/assets.ts', { mirror: [], query: async () => [{ id: 'job:video:0', job_id: 'job', user_id: 'owner', kind: 'video', url: originalUrl, metadata: {} }],
    copy: async () => { copies++; throw new Error('Must not copy'); } }, assetStubs);
  await assert.rejects(module.ensureReusableAsset({ userId: 'owner', url: 'https://unowned.test/substituted.mp4', kind: 'video', source: 'saved_job_output', sourceOutputId: 'job:video:0' }), /OUTPUT_NOT_FOUND/);
  assert.equal(copies, 0);
});

test('real Fal finalization persists measured facts and measurement absence keeps paid completion', async () => {
  const stubs = {
    '@/lib/db': 'export const query = (...args) => fixture.query(...args);',
    './fal-webhook-refunds': 'export const maybeAutoRefundWalletCharge = async () => { throw Error("Must not refund"); };',
    './fal-webhook-provisional': 'export const createProvisionalJobFromWebhook = async () => { throw Error("Unexpected provisional"); };',
    '@/lib/fal-client': 'export const getFalClient = () => ({ queue: { result: async () => fixture.result } });',
    '@/lib/fal-catalog': 'export const resolveFalModelId = async () => "fixture/model";',
    '@/config/falEngines': 'export const getFalEngineById = () => ({ category: "video" });',
    './fal-webhook-engine': 'export const inferEngineFromPayload = async () => ({}); export const getUpscaleToolMediaType = () => null;',
    '@/server/thumbnails': 'export const ensureJobThumbnail = async () => null; export const isPlaceholderThumbnail = () => false;',
    '@/server/video-faststart': 'export const ensureFastStartVideo = async (options) => { if(fixture.recovery) return null; if(fixture.facts) options.onVideoMediaFacts?.(fixture.facts); return fixture.url; };',
    '@/server/video-keyframes': 'export const generateAndPersistJobKeyframes = async () => {};',
    '@/server/video-preview': 'export const generateAndPersistJobPreviewVideo = async () => {};',
    '@/server/fal-job-sync': 'export const fetchFalJobMedia = async () => ({ videoUrl: fixture.url, thumbUrl: "https://owned.test/thumb.jpg", videoMediaFacts: fixture.facts });',
    '@/server/media/detect-has-audio': 'export const detectHasAudioStream = async () => false; export const detectVideoDimensions = async () => ({ width:1280,height:720 });',
    '@/server/media-library': 'export const upsertLegacyJobOutputs = async (value) => fixture.outputs.push(value);',
    './upscale-duration-integrity': 'export const checkUpscaleDuration = async () => "complete"; export const rejectTruncatedUpscale = async () => {};',
    './fal-webhook-image-output': 'export const persistFalWebhookImageOutputs = async () => { throw Error("Unexpected image"); };',
  };
  for (const [measured, recovery] of [[true, false], [false, false], [true, true], [false, true]]) {
    const updates: unknown[][] = [];
    const fixture = { url: originalUrl, facts: measured ? facts : undefined, recovery,
      env: { S3_PUBLIC_BASE_URL: 'https://owned.test' },
      result: recovery ? {} : { video: { url: 'https://provider.test/source.mp4' }, thumb_url: 'https://owned.test/thumb.jpg' },
      outputs: [] as any[], query: async (sql: string, params: unknown[]) => {
        if (sql.startsWith('SELECT')) return [{ job_id: 'job', user_id: 'owner', engine_id: 'minimax-h3', engine_label: 'MiniMax H3', status: 'running',
          progress: 30, payment_status: 'paid_wallet', duration_sec: 10, video_url: null, render_ids: [], has_audio: false, created_at: '2026-09-11T12:00:00Z' }];
        if (sql.startsWith('UPDATE app_jobs')) { updates.push(params); return [{ job_id: 'job' }]; }
        if (sql.startsWith('UPDATE provider_attempts') || sql.startsWith('INSERT INTO fal_queue_log')) return [];
        throw new Error('Unexpected SQL boundary');
      } };
    const module = await load('server/fal-webhook-handler.ts', fixture, stubs);
    await module.updateJobFromFalWebhook({ request_id: 'provider-job', status: 'OK', result: fixture.result });
    assert.equal(updates[0][1], 'completed');
    assert.equal(fixture.outputs[0].status, 'completed');
    assert.equal(fixture.outputs[0].duration_sec, 10);
    assert.equal(fixture.outputs[0].video_media_facts?.durationSec ?? null, measured ? 15.001 : null);
  }
});

test('owned raw S3 output is resolved before controlled CDN normalization', async () => {
  const raw = 'https://fixture-bucket.s3.eu-west-1.amazonaws.com/original.mp4';
  let copies = 0;
  const fixture = { env: { S3_BUCKET: 'fixture-bucket', S3_REGION: 'eu-west-1', S3_PUBLIC_BASE_URL: 'https://cdn.owned.test' }, mirror: [],
    query: async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM job_outputs')) {
        assert.equal(params[2], raw);
        return [{ id: 'job:video:0', job_id: 'job', user_id: 'owner', kind: 'video', url: raw, storage_url: null, metadata: {} }];
      }
      if (sql.includes('FROM media_assets')) return [];
      if (sql.includes('INSERT INTO media_assets')) return [assetRow(JSON.parse(params[14] as string))];
      throw new Error('Unexpected query');
    }, copy: async (params: { url: string; ownedGeneratedVideo: unknown }) => {
      copies++;
      assert.equal(params.url, 'https://cdn.owned.test/original.mp4');
      assert.ok(params.ownedGeneratedVideo);
      return { url: libraryUrl, thumbUrl: null, mimeType: 'video/mp4', width: null, height: null, sizeBytes: 42, mediaFacts: null };
    } };
  const module = await load('server/media-library/assets.ts', fixture, assetStubs);
  await module.ensureReusableAsset({ userId: 'owner', url: raw, kind: 'video', source: 'saved_job_output', sourceOutputId: 'job:video:0', allowRemoteThumbnailFallback: false });
  assert.equal(copies, 1);
});


test('promotion never downgrades versioned generated facts into unbound legacy measurements', async () => {
  const fixture = { mirror: [] as unknown[], query: async (sql: string, params: unknown[]) => {
    if (sql.includes('FROM job_outputs')) return [{ id: 'job:video:0', job_id: 'job', user_id: 'owner', kind: 'video', url: originalUrl,
      storage_url: null, status: 'ready', duration_sec: 10, metadata: { mediaFacts: facts } }];
    if (sql.includes('FROM media_assets')) return [];
    if (sql.includes('INSERT INTO media_assets')) return [assetRow(JSON.parse(params[14] as string))];
    throw new Error('Unexpected query');
  }, copy: async () => ({ url: libraryUrl, thumbUrl: null, mimeType: 'video/mp4', width: null, height: null, sizeBytes: 42, mediaFacts: null }) };
  const module = await load('server/media-library/assets.ts', fixture, assetStubs);
  const result = await module.saveJobOutputToLibrary({ userId: 'owner', jobId: 'job', outputId: 'job:video:0' });
  assert.equal(result.metadata.mediaFacts, undefined, 'copy without verified facts cannot reuse source-bound measurements as legacy facts');
});

test('caller versioned facts and existing versioned facts never enter the legacy backfill path', async () => {
  for (const existingVersioned of [false, true]) {
    const stored = assetRow({ durationSec: 10, ...(existingVersioned ? { mediaFacts: { ...facts, durationSec: null } } : {}) });
    const fixture = { mirror: [], query: async (sql: string) => {
      if (sql.includes('FROM media_assets')) return [stored];
      throw new Error('Unexpected write for versioned measurements');
    }, copy: async () => { throw new Error('Unexpected copy'); } };
    const module = await load('server/media-library/assets.ts', fixture, assetStubs);
    const result = await module.ensureReusableAsset({ userId: 'owner', url: libraryUrl, kind: 'video', source: 'upload',
      metadata: { mediaFacts: existingVersioned ? { source: 'probe', durationSec: 15 } : facts }, allowRemoteThumbnailFallback: false });
    assert.deepEqual(result.metadata, stored.metadata);
  }
});
