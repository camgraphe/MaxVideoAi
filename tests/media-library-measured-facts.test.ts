import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';

const facts = { source: 'probe', durationSec: 4.75, width: 854, height: 480, hasAudio: false };
async function libraryFixture(existing: boolean, source = 'probe') {
  const frontend = path.resolve('frontend');
  const fixture = { copies: 0, updates: [] as unknown[], mirrors: [] as unknown[],
    output: { id: 'job:video:0', job_id: 'job', user_id: 'owner', kind: 'video', url: 'https://media.maxvideoai.com/original.mp4', storage_url: null, thumb_url: 'https://media.maxvideoai.com/thumb.jpg', preview_url: null, mime_type: 'video/mp4', width: null, height: null, duration_sec: 5, position: 0, status: 'ready', metadata: { mediaFacts: { ...facts, source } } },
    asset: { id: '', public_id: `ma_${'a'.repeat(32)}`, user_id: 'owner', kind: 'video', url: 'https://media.maxvideoai.com/copy.mp4', thumb_url: 'https://media.maxvideoai.com/thumb.jpg', preview_url: null, mime_type: 'video/mp4', width: 854, height: 480, size_bytes: 123, source: 'saved_job_output', source_job_id: 'job', source_output_id: 'job:video:0', status: 'ready', metadata: { originUrl: 'https://media.maxvideoai.com/original.mp4', durationSec: 5, custom: 'preserved' } as Record<string, unknown> },
    query: async (sql: string, values: unknown[]) => {
      if (sql.includes('FROM job_outputs')) return [fixture.output];
      if (sql.includes('SELECT id, public_id')) { fixture.asset.id = String(values[0]); return existing ? [fixture.asset] : []; }
      fixture.updates.push({ sql, values });
      if (sql.includes('UPDATE media_assets')) {
        const measuredJson = values.find(value => typeof value === 'string' && value.startsWith('{') && value.includes('"source":"probe"'));
        if (measuredJson) fixture.asset.metadata.mediaFacts = JSON.parse(String(measuredJson));
        return [fixture.asset];
      }
      if (sql.includes('INSERT INTO media_assets')) {
        fixture.asset.id = String(values[0]); fixture.asset.metadata = JSON.parse(String(values[14])); return [fixture.asset];
      }
      throw new Error('Unexpected offline library query');
    },
  };
  const stubs: Record<string, string> = {
    '@/lib/db': 'export const query = (...args) => fixture.query(...args);',
    '@/lib/schema': 'export const ensureMediaLibrarySchema = async () => {};',
    '@/server/storage': 'export const recordUserAsset = async value => fixture.mirrors.push(value);',
    './asset-listing': 'export const findLibraryAssetByOrigin = async () => null; export const listLibraryAssetPage = async () => ({items:[]});',
    './asset-resolvers': 'export const resolveReusableAssetThumbUrl = async value => value.thumbUrl ?? null; export const resolveReusableAssetPreviewUrl = async value => value.previewUrl ?? null;',
    './asset-media': 'export const copyRemoteMedia = async value => {fixture.copies++; return {url:"https://media.maxvideoai.com/copy.mp4",mimeType:"video/mp4",width:null,height:null,sizeBytes:123,thumbUrl:null};}; export const createRemoteVideoAssetThumbnail = async () => {throw Error("Unexpected thumbnail retry");};',
  };
  const compiled = await build({ absWorkingDir: frontend, entryPoints: ['server/media-library/assets.ts'], tsconfig: path.join(frontend, 'tsconfig.json'), bundle: true, platform: 'node', format: 'cjs', write: false,
    plugins: [{ name: 'offline-library', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: frontend }));
    } }],
  });
  const module = { exports: {} as { saveJobOutputToLibrary(input: { userId: string; jobId: string; outputId: string }): Promise<any> } };
  runInNewContext(compiled.outputFiles[0].text, { module, exports: module.exports, fixture, URL, console, process: { env: {} }, require: createRequire(path.join(frontend, 'package.json')), Buffer });
  return { fixture, library: module.exports };
}

test('saving a measured output carries facts into a new library asset without changing original history', async () => {
  const { fixture, library } = await libraryFixture(false);
  const result = await library.saveJobOutputToLibrary({ userId: 'owner', jobId: 'job', outputId: 'job:video:0' });
  assert.ok(result.metadata.mediaFacts); assert.deepEqual(JSON.parse(JSON.stringify(result.metadata.mediaFacts)), facts);
  assert.equal(result.metadata.durationSec, 5); assert.equal(fixture.copies, 1);
});

test('an existing promoted asset receives missing facts without recopying or losing unrelated metadata', async () => {
  const { fixture, library } = await libraryFixture(true);
  const result = await library.saveJobOutputToLibrary({ userId: 'owner', jobId: 'job', outputId: 'job:video:0' });
  assert.ok(result.metadata.mediaFacts); assert.deepEqual(JSON.parse(JSON.stringify(result.metadata.mediaFacts)), facts);
  assert.equal(result.metadata.custom, 'preserved'); assert.equal(result.metadata.durationSec, 5); assert.equal(fixture.copies, 0);
});

test('library promotion never certifies browser or requested duration as probe evidence', async () => {
  for (const source of ['browser', 'requested']) {
    const { library } = await libraryFixture(false, source);
    const result = await library.saveJobOutputToLibrary({ userId: 'owner', jobId: 'job', outputId: 'job:video:0' });
    assert.equal(result.metadata.mediaFacts, undefined);
  }
});
