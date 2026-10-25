import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const { S3Client, PutObjectCommand } = requireFrontend('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3');
process.env.S3_BUCKET = 'excerpt-backfill-fixture';
process.env.S3_REGION = 'us-east-1';
process.env.S3_ACCESS_KEY_ID = 'fixture-access';
process.env.S3_SECRET_ACCESS_KEY = 'fixture-secret';
process.env.S3_PUBLIC_BASE_URL = 'https://excerpt-backfill-fixture.s3.us-east-1.amazonaws.com';
process.env.S3_UPLOAD_ACL = 'public-read';
delete process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX;

test('upload backfill recovers v3 privately, refuses foreign owners and preserves ordinary public uploads', async t => {
  const storage = await import('../frontend/server/storage');
  const scope = await import('../frontend/server/private-media-storage');
  const media = await import('../frontend/server/media-library/asset-media');
  const thumbnails = await import('../frontend/server/upload-thumbnails');
  const { ensureExecutableFfmpegPath } = await import('../frontend/server/ffmpeg-runtime');
  const directory = await mkdtemp(resolve(tmpdir(), 'excerpt-backfill-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const video = resolve(directory, 'source.mp4');
  await promisify(execFile)(await ensureExecutableFfmpegPath(requireFrontend('@ffmpeg-installer/ffmpeg').path), [
    '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=64x64:r=24:d=1', '-c:v', 'libx264', '-threads', '1', '-an', '-y', video,
  ], { timeout: 15000 });
  const bytes = await readFile(video);
  const ownerHash = createHash('sha256').update('owner').digest('hex').slice(0, 32);
  const original = `${process.env.S3_PUBLIC_BASE_URL}/user-assets/by-content/${ownerHash}/video-excerpts-private-v3-prepared.mp4`;
  const ordinary = `${process.env.S3_PUBLIC_BASE_URL}/user-assets/by-content/${ownerHash}/ordinary.mp4`;
  const rows = [
    { id: 'private', user_id: 'owner', kind: 'video', url: original },
    { id: 'foreign', user_id: 'foreign', kind: 'video', url: original },
    { id: 'ownerless', user_id: null, kind: 'video', url: original },
    { id: 'ordinary', user_id: 'owner', kind: 'video', url: ordinary },
  ];
  const updates: Array<{ sql: string; values: unknown[] }> = [];
  const requests: string[] = [];
  const puts: Array<InstanceType<typeof PutObjectCommand>['input']> = [];
  const logs: unknown[][] = [];
  t.mock.method(S3Client.prototype, 'send', async command => { assert.ok(command instanceof PutObjectCommand); puts.push(command.input); return {}; });
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(String(input));
    requests.push(url.pathname);
    if (url.pathname === new URL(original).pathname && !url.searchParams.get('X-Amz-Signature')) return new Response('', { status: 403 });
    return new Response(bytes, { headers: { 'Content-Type': 'video/mp4' } });
  });
  t.mock.method(console, 'warn', (...args) => { logs.push(args); });
  let scans = 0;
  const fixture = {
    storage, scope, media, thumbnails, run: Promise.resolve(),
    query: async (sql: string, values: unknown[]) => {
      if (sql.includes('SELECT id, user_id')) return scans++ === 0 ? rows : [];
      updates.push({ sql, values }); return [];
    },
  };
  const stubs: Record<string, string> = {
    'dotenv': 'export const config = () => {};',
    'tsconfig-paths/register.js': '',
    'p-limit': 'export default () => fn => fn();',
    'node:process': 'export default { argv: [], env: {}, cwd: () => "/fixture", exit: () => { throw Error("Unexpected exit"); } };',
    '../src/lib/db': 'export const query = (...args) => fixture.query(...args); export const getDb = () => ({end: async () => {}});',
    '../server/upload-thumbnails': 'export const createUploadImageThumbnail = (...args) => fixture.thumbnails.createUploadImageThumbnail(...args); export const createUploadVideoThumbnail = (...args) => fixture.thumbnails.createUploadVideoThumbnail(...args);',
    '../server/storage': 'export const extractStorageKeyFromUrl = (...args) => fixture.storage.extractStorageKeyFromUrl(...args);',
    '../server/private-media-storage': 'export const privateMediaStorageScopeForKey = (...args) => fixture.scope.privateMediaStorageScopeForKey(...args);',
    '../server/media-library/asset-media': 'export const createRemoteVideoAssetThumbnail = (...args) => fixture.media.createRemoteVideoAssetThumbnail(...args);',
  };
  const frontend = resolve('frontend');
  const source = await readFile(resolve(frontend, 'scripts/backfill-upload-thumbnails.ts'), 'utf8');
  const compiled = await build({
    stdin: { contents: source.replace('void main().catch', 'fixture.run = main().catch'), resolveDir: resolve(frontend, 'scripts'), loader: 'ts' },
    bundle: true, platform: 'node', format: 'cjs', write: false,
    plugins: [{ name: 'offline-backfill', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
    } }],
  });
  runInNewContext(compiled.outputFiles[0].text, { fixture, require: requireFrontend, Buffer, fetch: globalThis.fetch,
    console: { log: (...args: unknown[]) => logs.push(args), error: (...args: unknown[]) => logs.push(args) } });
  await fixture.run;
  const privateUpdate = updates.find(({ sql, values }) => sql.includes('SET thumb_url') && values[0] === 'private');
  assert.ok(privateUpdate, 'the protected original must receive a thumbnail rather than a permanent 403 failure marker');
  const privatePut = puts.find(put => put.Key?.includes('video-excerpts-private-v3-'));
  assert.ok(privatePut);
  assert.equal(privatePut.ACL, undefined);
  assert.equal(privatePut.CacheControl, 'private, no-store');
  assert.ok(updates.some(({ sql, values }) => sql.includes('WHERE url = $1') && values[0] === original && values[1] === privateUpdate.values[1]));
  for (const id of ['foreign', 'ownerless']) {
    assert.ok(updates.some(({ sql, values }) => sql.includes('thumbnailBackfillFailedAt') && values[0] === id));
    assert.ok(!updates.some(({ sql, values }) => sql.includes('SET thumb_url') && values[0] === id));
  }
  assert.deepEqual(requests.sort(), [new URL(original).pathname, new URL(ordinary).pathname].sort());
  assert.equal(puts.length, 2);
  assert.equal(puts.find(put => !put.Key?.includes('video-excerpts-private-v3-'))?.ACL, 'public-read');
  assert.equal(rows[0].url, original);
  assert.doesNotMatch(JSON.stringify({ updates, logs }), /X-Amz-Signature|fixture-secret/);
});
