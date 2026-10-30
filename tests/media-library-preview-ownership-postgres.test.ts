import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';
import { startDisposablePostgres } from './helpers/disposable-postgres';

const frontend = resolve('frontend');
const base = 'https://preview-ownership-fixture.s3.us-east-1.amazonaws.com';
const owner = '00000000-0000-4000-8000-00000000000a';
const viewer = '00000000-0000-4000-8000-00000000000b';

test('saving a foreign storage URL cannot turn an owned library row into a private MCP read grant', async (t) => {
  const database = await startDisposablePostgres('preview-owner');
  t.after(database.cleanup);
  const facts = (await database.pool.query("SELECT current_setting('listen_addresses') AS listeners, current_setting('server_version_num')::int AS version")).rows[0];
  assert.equal(facts.listeners, '');
  assert.ok(facts.version >= 170000 && facts.version < 180000);
  await database.pool.query(`CREATE TABLE media_assets (
    id text PRIMARY KEY, public_id text DEFAULT ('ma_' || md5(random()::text)),
    user_id text, kind text, url text, thumb_url text, preview_url text, mime_type text,
    width int, height int, size_bytes bigint, source text, source_job_id text, source_output_id text,
    status text, metadata jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), deleted_at timestamptz
  )`);
  const fixture = {
    query: async (sql: string, values: unknown[]) => (await database.pool.query(sql, values)).rows,
    userId: viewer,
    publicImports: 0,
  };
  const stubs: Record<string, string> = {
    '@/lib/db': 'export const query = (sql, values) => fixture.query(sql, values); export const isTransactionQueryExecutor = () => false; export const withDbTransaction = () => {throw Error("Unexpected transaction");};',
    '@/lib/schema': 'export const ensureAssetSchema = async () => {}; export const ensureMediaLibrarySchema = async () => {};',
    '@/lib/supabase-ssr': 'export const getRouteAuthContext = async () => ({userId:fixture.userId});',
    'next/server': 'export const NextResponse = {json:(body, init) => new Response(JSON.stringify(body), init)};',
    '@/server/storage': `export * from './server/storage'; export const recordUserAsset = async () => {};`,
    '@/server/upload-thumbnails': 'export const createVideoThumbnailFromFile = () => {throw Error("Unexpected thumbnail operation");}; export const createUploadVideoThumbnail = createVideoThumbnailFromFile;',
    '@/server/marketing-media/import-reference': 'export const importPublicRecipeReference = () => {fixture.publicImports++; throw Error("Unexpected public reference import");};',
    '@/server/marketing-media/access': 'export const canReadMarketingFile = async () => false;',
  };
  const built = await build({
    absWorkingDir: frontend,
    stdin: { contents: `
      export {POST} from './app/api/media-library/ensure/route';
      export {listAgentMedia} from './src/server/agent-api/media-library';
      export {mapAssetRow} from './server/media-library-records';
    `, resolveDir: frontend, loader: 'ts' },
    tsconfig: resolve(frontend, 'tsconfig.json'), bundle: true, platform: 'node', format: 'cjs',
    packages: 'external', write: false,
    plugins: [{ name: 'offline-library-ownership', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: frontend }));
    } }],
  });
  const loadApi = (storageBase = base) => {
    const module = { exports: {} as any };
    runInNewContext(built.outputFiles[0].text, {
      module, exports: module.exports, fixture, require: createRequire(resolve(frontend, 'package.json')),
      process: { cwd: () => frontend, env: {
        S3_BUCKET: 'preview-ownership-fixture', S3_REGION: 'us-east-1', S3_PUBLIC_BASE_URL: storageBase,
        S3_ACCESS_KEY_ID: 'fixture-key', S3_SECRET_ACCESS_KEY: 'fixture-secret',
      } }, URL, Response, Buffer, Date, AbortController, setTimeout, clearTimeout, console,
      fetch: () => { throw Error('No network access permitted'); },
    });
    return module.exports;
  };
  const api = loadApi();
  const principal = { authMethod: 'oauth', userId: viewer, clientId: 'fixture-client', scopes: [] };
  const ownPath = `/user-assets/${viewer}`;
  const foreignUrl = `${base}/user-assets/${owner}/private.png`;
  const cases = [
    { name: 'foreign original has no grant', payload: { url: foreignUrl }, expectedPath: null },
    { name: 'foreign thumbnail falls back to owned image original', payload: {
      url: `${base}${ownPath}/thumb-fallback.png`, thumbUrl: foreignUrl,
    }, expectedPath: `${ownPath}/thumb-fallback.png` },
    { name: 'owned thumbnail keeps priority over owned original', payload: {
      url: `${base}${ownPath}/image.png`, thumbUrl: `${base}${ownPath}/thumb.png`,
    }, expectedPath: `${ownPath}/thumb.png` },
    { name: 'foreign video preview falls back to owned original', payload: {
      kind: 'video', mime: 'video/mp4', durationSec: 5,
      url: `${base}${ownPath}/preview-fallback.mp4`,
      thumbUrl: 'https://v3b.fal.media/public-poster.png', previewUrl: foreignUrl,
    }, expectedPath: `${ownPath}/preview-fallback.mp4` },
    { name: 'owned video preview survives a foreign thumbnail', payload: {
      kind: 'video', mime: 'video/mp4', durationSec: 5,
      url: `${base}${ownPath}/video.mp4`, thumbUrl: foreignUrl,
      previewUrl: `${base}${ownPath}/preview.mp4`,
    }, expectedPath: `${ownPath}/preview.mp4` },
    { name: 'all foreign video candidates have no grant', payload: {
      kind: 'video', mime: 'video/mp4', durationSec: 5,
      url: `${base}/user-assets/${owner}/private.mp4`, thumbUrl: foreignUrl,
      previewUrl: `${base}/user-assets/${owner}/preview.mp4`,
    }, expectedPath: null },
  ];
  for (const { name, payload: submittedPayload, expectedPath } of cases) {
    await t.test(name, async () => {
      const response = await api.POST({ json: async () => ({
        kind: 'image', mime: 'image/png', source: 'upload', ...submittedPayload,
      }) });
      assert.equal(response.status, 200);
      const payload = await response.json();
      const stored = (await database.pool.query('SELECT * FROM media_assets WHERE id=$1 AND user_id=$2', [payload.asset.id, viewer])).rows[0];
      assert.equal(stored.user_id, viewer);
      assert.equal(stored.url, submittedPayload.url);
      if (submittedPayload.previewUrl) assert.equal(stored.preview_url, submittedPayload.previewUrl);
      const page = await api.listAgentMedia({}, principal, {
        listAssetPage: async () => ({ items: [api.mapAssetRow(stored)], nextCursor: null, hasMore: false }),
      });
      assert.equal(page.items.length, 1);
      if (expectedPath === null) assert.equal(page.items[0].previewUrl, null);
      else {
        assert.equal(new URL(page.items[0].previewUrl).pathname, expectedPath);
        assert.ok(new URL(page.items[0].previewUrl).searchParams.get('X-Amz-Signature'));
        assert.equal(new URL(page.items[0].previewUrl).searchParams.get('X-Amz-Expires'), '300');
      }
    });
  }
  await t.test('owned CDN originals retain a usable signed S3 preview without granting foreign objects', async () => {
    const cdnApi = loadApi('https://media.maxvideoai.com');
    for (const [url, expectedPath] of [
      [`https://media.maxvideoai.com${ownPath}/cdn-image.png`, `${ownPath}/cdn-image.png`],
      [`https://media.maxvideoai.com/user-assets/${owner}/foreign-cdn-image.png`, null],
    ]) {
      const response = await cdnApi.POST({ json: async () => ({ kind: 'image', mime: 'image/png', source: 'upload', url }) });
      assert.equal(response.status, 200);
      const payload = await response.json();
      const stored = (await database.pool.query('SELECT * FROM media_assets WHERE id=$1 AND user_id=$2', [payload.asset.id, viewer])).rows[0];
      const page = await cdnApi.listAgentMedia({}, principal, {
        listAssetPage: async () => ({ items: [cdnApi.mapAssetRow(stored)], nextCursor: null, hasMore: false }),
      });
      if (expectedPath === null) assert.equal(page.items[0].previewUrl, null);
      else {
        assert.ok(page.items[0].previewUrl, 'The storage CDN must not cause our own signed S3 preview to be dropped');
        const preview = new URL(page.items[0].previewUrl);
        assert.equal(preview.hostname, 'preview-ownership-fixture.s3.us-east-1.amazonaws.com');
        assert.equal(preview.pathname, expectedPath);
        assert.ok(preview.searchParams.get('X-Amz-Signature'));
        assert.equal(preview.searchParams.get('X-Amz-Expires'), '300');
      }
    }
  });
  assert.equal(fixture.publicImports, 0, 'ordinary saving never imports a public recipe or invokes its media owners');
});
