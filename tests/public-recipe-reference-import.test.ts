import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { importPublicRecipeReference } from '../frontend/server/marketing-media/import-reference';
import { createReferenceFileDownloader } from '../frontend/src/server/agent-api/reference-file-download';
import { createStoreVideoUploadService } from '../frontend/src/server/uploads/store-media-upload';
import { validateGenerationMediaConstraints } from '../frontend/app/api/generate/_lib/generation-media-constraints';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { sanitizePublicRecreationSnapshot } from '../frontend/server/marketing-media/public-recreation';
import { resolveVideoSettingsSnapshot, buildVideoSettingsFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings';
import { importPublicRecipeReferences } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-public-recipe-references';
import { buildWorkspacePreflightRequest } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-preflight-request';
import { parsePreflightRequestPayload } from '../frontend/app/api/preflight/_lib/preflight-request';
import type { QueryExecutor } from '../frontend/src/lib/db';

const publicUrl = 'https://media.example/marketing-media/copy/source.mp4';
const originalUrl = 'https://media.example/user-assets/private-original.mp4';
const bytes = Buffer.from('synthetic approved video bytes');
const sha256 = createHash('sha256').update(bytes).digest('hex');

test('the ensure route isolates approved imports from legacy saving and ignores caller facts and lineage', async () => {
  const fixture = { userId: 'visitor' as string | null, imports: [] as Record<string, unknown>[], saves: [] as unknown[] };
  const globals = globalThis as typeof globalThis & { __publicReferenceRoute?: typeof fixture };
  globals.__publicReferenceRoute = fixture;
  const mocks: Record<string, string> = {
    '@/lib/supabase-ssr': 'export const getRouteAuthContext=async()=>({userId:globalThis.__publicReferenceRoute.userId});',
    '@/server/marketing-media/import-reference': `export const importPublicRecipeReference=async input=>{globalThis.__publicReferenceRoute.imports.push(input);return {id:'ma_owned',url:input.url,size:123,width:1920,height:1080,durationSec:7.5};};`,
    '@/server/media-library': `export const ensureReusableAsset=async input=>{globalThis.__publicReferenceRoute.saves.push(input);return {id:'legacy-save',url:input.url};};`,
  };
  try {
    const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `export {POST} from './frontend/app/api/media-library/ensure/route';` },
      bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, tsconfig: 'frontend/tsconfig.json',
      plugins: [{ name: 'public-reference-route-boundaries', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : undefined);
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'ts' }));
      } }],
    });
    const module = { exports: {} as { POST: (request: Request) => Promise<Response> } };
    new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(resolve('frontend/package.json')), module, module.exports);
    const post = (payload: unknown) => module.exports.POST(new Request('https://maxvideoai.com/api/media-library/ensure',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
    const response = await post({ publicVideoId: 'public-copy', url: publicUrl, kind: 'video',
      jobId: 'private-job', sourceOutputId: 'private-output', durationSec: 999, width: 1, height: 1, size: 1 });
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(fixture.imports[0]).sort(), ['kind', 'signal', 'url', 'userId', 'videoId']);
    assert.equal((await response.json()).asset.durationSec, 7.5);
    assert.equal(fixture.saves.length, 0);
    for (const publicVideoId of ['', 42]) assert.equal((await post({ publicVideoId, url: publicUrl })).status, 422);
    assert.equal(fixture.imports.length, 1); assert.equal(fixture.saves.length, 0);
    assert.equal((await post({ url: publicUrl, kind: 'image' })).status, 200);
    assert.equal(fixture.saves.length, 1, 'ordinary ensure retains its existing owner');
    fixture.userId = null;
    assert.equal((await post({ publicVideoId: 'public-copy', url: publicUrl, kind: 'video' })).status, 401);
    assert.equal(fixture.imports.length, 1, 'authentication precedes import work');
  } finally { delete globals.__publicReferenceRoute; }
});

test('authored image references use only the exact reviewed recipe and require a canonical measured asset', async () => {
  const imageUrl = 'https://media.example/approved-keyframe.jpg';
  const image = { id: `ma_${'c'.repeat(32)}`, url: 'https://media.example/user-assets/visitor/keyframe.jpg',
    width: 640, height: 480, mime: 'image/jpeg', size: 23, durationSec: null, thumbUrl: null };
  let downloads = 0, stores = 0, approved = false, canonical = true;
  const deps: NonNullable<Parameters<typeof importPublicRecipeReference>[1]> = {
    marketingEnabled: () => false,
    getVideoById: async () => ({ id: 'authored-video', engineId: 'flux-3-max', visibility: 'public', indexable: true,
      settingsSnapshot: { refs: { referenceImages: [originalUrl] } } }) as never,
    loadPublicKeyframeRecipeForVideo: async () => approved ? { jobId: 'authored-video', keyframes: [{ imageUrl }] } as never : null,
    downloadReferenceFile: async file => { downloads++; assert.equal(file.download_url, imageUrl);
      return { bytes: Buffer.alloc(23), fileName: 'keyframe.jpg', mimeType: 'image/jpeg' }; },
    storeImageUpload: async input => { stores++; assert.equal(input.bytes.length, 23);
      assert.equal(Object.hasOwn(input, 'sourceJobId'), false); assert.equal(Object.hasOwn(input, 'metadata'), false);
      return { assetId: 'ua_internal', width: 640, height: 480, mimeType: 'image/jpeg', sizeBytes: 23, previewUrl: null }; },
    loadStoredImageUploadRouteAsset: async () => ({ assetId: 'ua_internal', canonicalAssetId: canonical ? image.id : null,
      url: image.url, width: 640, height: 480, mimeType: 'image/jpeg', sizeBytes: 23, thumbUrl: null }),
    query: async <T>() => [{ url: image.url, kind: 'image', mime_type: image.mime,
      size_bytes: image.size, width: image.width, height: image.height, metadata: {} }] as T[],
  };
  await assert.rejects(importPublicRecipeReference({ userId: 'visitor', videoId: 'authored-video', url: originalUrl, kind: 'image' }, deps), /NOT_AVAILABLE/);
  assert.equal(downloads, 0); assert.equal(stores, 0, 'public output visibility cannot grant its private legacy inputs');
  approved = true;
  assert.deepEqual(await importPublicRecipeReference({ userId: 'visitor', videoId: 'authored-video', url: imageUrl, kind: 'image' }, deps), image);
  canonical = false;
  await assert.rejects(importPublicRecipeReference({ userId: 'visitor', videoId: 'authored-video', url: imageUrl, kind: 'image' }, deps), /METADATA_UNVERIFIED/);
});

test('approved audio references return measured owned timing without private source bindings', async () => {
  const audio = { id: `ma_${'d'.repeat(32)}`, url: 'https://media.example/user-assets/visitor/speech.mp3',
    width: null, height: null, mime: 'audio/mpeg', size: bytes.length, durationSec: 12.25, thumbUrl: null };
  const deps: NonNullable<Parameters<typeof importPublicRecipeReference>[1]> = {
    marketingEnabled: () => true,
    query: async <T>(sql: string) => (sql.includes('FROM marketing_media')
      ? [{ files: [{ url: publicUrl, mime: 'audio/mpeg', sha256, sizeBytes: bytes.length }] }]
      : [{ url: audio.url, kind: 'audio', mime_type: audio.mime, size_bytes: audio.size,
        width: null, height: null, metadata: { durationSec: 12.25, mediaFacts: { source: 'probe', durationSec: 12.25 } } }]) as T[],
    downloadReferenceFile: async () => ({ bytes, fileName: 'speech.mp3', mimeType: 'audio/mpeg' }),
    storeAudioUpload: async input => {
      assert.equal(input.referenceEligibility, 'mcp'); assert.deepEqual(input.bytes, bytes);
      assert.equal(Object.hasOwn(input, 'sourceJobId'), false); assert.equal(Object.hasOwn(input, 'durationSec'), false);
      return { assetId: audio.id, legacyAssetId: 'ua_speech', width: null, height: null, durationSec: 12.25,
        mimeType: 'audio/mpeg', sizeBytes: bytes.length, previewUrl: null, storageUrl: audio.url };
    },
  };
  assert.deepEqual(await importPublicRecipeReference({ userId: 'visitor', videoId: 'public-copy', url: publicUrl, kind: 'audio' }, deps), audio);
});

test('approved public references become measured owned media before source-aware preflight', async t => {
  const db = await startDisposablePostgres('public-reference-import');
  const query: QueryExecutor['query'] = async (sql, params) => (await db.pool.query(sql, params as unknown[])).rows;
  let downloads = 0, stores = 0, revokeOnDownload = false, changedBytes = false, preserveStaleCanonical = false;
  const files = [{ url: publicUrl, sourceUrl: originalUrl, key: 'marketing-media/copy/source.mp4',
    sizeBytes: bytes.length, sha256, mime: 'video/mp4' }];
  const store = createStoreVideoUploadService({
    probeMediaBuffer: async () => ({ kind: 'video', canonicalMime: 'video/mp4', detectedMime: 'video/mp4',
      durationSec: 7.5, width: 1920, height: 1080, hasAudio: false }),
    async uploadFileBuffer(input) {
      stores++;
      assert.equal(input.acl, null); assert.equal(input.cacheControl, 'private, no-store');
      const key = `user-assets/by-content/${createHash('sha256').update(input.userId!).digest('hex')}/${sha256}.mp4`;
      await input.beforeUpload?.(key);
      return { key, url: `https://media.example/${key}` };
    },
    createUploadVideoThumbnail: async () => null,
    async recordUserAsset(input) {
      await query(`INSERT INTO user_assets VALUES($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT(asset_id) DO UPDATE SET metadata=EXCLUDED.metadata`,
        [input.assetId, input.userId, input.url, input.mime, input.size, input.width, input.height, JSON.stringify(input.metadata)]);
      return input.assetId!;
    },
    async ensureReusableAsset(input) {
      const id = `ma_${createHash('sha256').update(`${input.userId}:${input.url}`).digest('hex').slice(0, 32)}`;
      if (!preserveStaleCanonical) await query(`INSERT INTO media_assets
        (id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
        VALUES($1,$1,$2,$3,$4,$5,$6,$7,$8,'ready',$9)
        ON CONFLICT(id) DO UPDATE SET metadata=EXCLUDED.metadata`,
        [id, input.userId, input.kind, input.url, input.mimeType, input.sizeBytes, input.width, input.height,
          JSON.stringify({ ...input.metadata, durationSec: input.durationSec })]);
      return { publicId: id } as never;
    },
    claimStorageObjectProducer: async ({ objectKey }) => ({ objectKey, claimId: 'fixture', leaseExpiresAt: new Date('2030-01-01') }),
    renewStorageObjectProducer: async ({ claim }) => claim, settleStorageObjectProducer: async () => {},
    scheduleProducerHeartbeat: () => () => {},
  });
  const download = createReferenceFileDownloader({
    lookupHost: async () => [{ address: '8.8.8.8', family: 4 }],
    async openPinnedHttps(url) {
      downloads++; assert.equal(url.href, publicUrl);
      if (revokeOnDownload) await query(`UPDATE marketing_media SET state='deleted'`);
      const body = changedBytes ? Buffer.from('changed public bytes') : bytes;
      return { statusCode: 200, headers: { 'content-type': 'video/mp4', 'content-length': String(body.length) },
        body: (async function* () { yield body; })() };
    },
  });
  const deps = { query, marketingEnabled: () => true, downloadReferenceFile: download, storeVideoUpload: store,
    getVideoById: async () => null, loadPublicKeyframeRecipeForVideo: async () => null };
  const request = { userId: 'visitor', videoId: 'public-copy', url: publicUrl, kind: 'video' as const };
  try {
    await query(`CREATE TABLE marketing_media(video_id text,state text,publication jsonb,files jsonb);
      CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,
        width int,height int,status text,metadata jsonb,deleted_at timestamptz);
      CREATE TABLE user_assets(asset_id text PRIMARY KEY,user_id text,url text,mime_type text,size_bytes bigint,width int,height int,metadata jsonb);`);
    await query(`INSERT INTO marketing_media VALUES('public-copy','ready','{"visibility":"public"}',$1)`, [JSON.stringify(files)]);
    const owned = await importPublicRecipeReference(request, deps);
    assert.equal(owned.size, bytes.length); assert.equal(owned.width, 1920); assert.equal(owned.durationSec, 7.5);
    assert.notEqual(owned.url, publicUrl, 'the original public copy remains separate from the visitor’s measured upload');
    assert.deepEqual(await importPublicRecipeReference(request, deps), owned, 'repeated imports retain their account-owned identity');
    const other = await importPublicRecipeReference({ ...request, userId: 'another-visitor' }, deps);
    assert.notEqual(other.id, owned.id); assert.notEqual(other.url, owned.url);

    for (const mode of ['v2v', 'extend'] as const) {
      const engine = getBaseEnginesByCategory('video').find(candidate => candidate.id === 'wan-3')!;
      const snapshot = sanitizePublicRecreationSnapshot({ schemaVersion: 1, surface: 'video', engineId: engine.id,
        inputMode: mode, prompt: 'Preserve the saved creative settings', core: { durationSec: 5, resolution: '720p', aspectRatio: '16:9' },
        refs: { inputs: [{ slotId: 'video_url', kind: 'video', url: publicUrl, assetId: 'creator-private-asset',
          durationSec: 999, width: 1, height: 1, size: 1 }] } });
      const resolved = resolveVideoSettingsSnapshot(snapshot, { engines: [engine], engineMap: new Map([[engine.id, engine]]),
        createLocalId: prefix => prefix, createFallbackScene: () => ({ id: 'scene', prompt: '', duration: 5 }),
        createFallbackKlingElement: () => ({ id: 'subject', frontal: null, video: null, references: [] }) });
      const references = await importPublicRecipeReferences(resolved, value => importPublicRecipeReference({ ...request,
        url: value.url, kind: value.kind! }, deps), () => true);
      const preflight = buildWorkspacePreflightRequest({ form: buildVideoSettingsFormState(resolved), selectedEngine: engine,
        submissionMode: mode, effectiveDurationSec: 5, supportsAudioToggle: true, voiceControlEnabled: false,
        inputAssets: references.inputAssets!, memberTier: 'Member' });
      assert.equal(parsePreflightRequestPayload(preflight).ok, true);
      const constraints = await validateGenerationMediaConstraints({ engineId: engine.id, mode, userId: request.userId,
        inputSchema: engine.inputSchema, referenceMediaItems: preflight.inputs!.map(input => ({ ...input, fieldId: input.slotId })),
        attachments: preflight.inputs!.map(input => ({ ...input, name: 'reference.mp4', type: 'video/mp4', size: 1 })),
        deps: { queryFn: query } });
      assert.equal(constraints.ok, true, JSON.stringify(constraints));
      assert.equal(references.inputAssets?.video_url?.[0]?.durationSec, 7.5, 'server measurements replace untrusted recipe metadata');
    }
    await t.test('wrong publication, original source URLs, private/deleted copies and kind mismatch reject before download', async () => {
      const before = downloads;
      for (const input of [{ ...request, videoId: 'another-public-copy' }, { ...request, url: originalUrl },
        { ...request, kind: 'audio' as const }]) await assert.rejects(importPublicRecipeReference(input, deps), /NOT_AVAILABLE/);
      for (const [state, visibility] of [['copying', 'public'], ['deleted', 'public'], ['ready', 'private']]) {
        await query(`UPDATE marketing_media SET state=$1,publication=jsonb_build_object('visibility',$2::text)`, [state, visibility]);
        await assert.rejects(importPublicRecipeReference(request, deps), /NOT_AVAILABLE/);
      }
      assert.equal(downloads, before);
      await query(`UPDATE marketing_media SET state='ready',publication='{"visibility":"public"}'`);
    });
    await t.test('revocation or changed bytes cannot reach the owned writer', async () => {
      const before = stores;
      revokeOnDownload = true;
      await assert.rejects(importPublicRecipeReference(request, deps), /NOT_AVAILABLE/);
      revokeOnDownload = false;
      await query(`UPDATE marketing_media SET state='ready'`);
      changedBytes = true;
      await assert.rejects(importPublicRecipeReference(request, deps), /CHANGED/);
      changedBytes = false;
      assert.equal(stores, before);
    });
    await t.test('an old canonical row with stale measurements cannot appear import-ready', async () => {
      await query(`UPDATE media_assets SET size_bytes=1,width=1 WHERE public_id=$1`, [owned.id]);
      preserveStaleCanonical = true;
      await assert.rejects(importPublicRecipeReference(request, deps), /METADATA_UNVERIFIED/);
    });
  } finally { await db.cleanup(); }
});
