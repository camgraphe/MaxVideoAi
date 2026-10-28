import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { build } from 'esbuild';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const assetId = `ma_${'a'.repeat(32)}`;
const expectedFacts = { source: 'probe', durationSec: 6, width: 320, height: 180, hasAudio: true };

async function fixture(kind: 'multipart' | 'direct', corrupt = false, portrait = false) {
  let source = await readFile('tests/fixtures/studio-media/pattern-a.mp4');
  if (portrait) {
    const directory = await mkdtemp(join(tmpdir(), 'video-upload-mov-test-'));
    try {
      const output = join(directory, 'iphone.mov');
      execFileSync(requireFrontend('@ffmpeg-installer/ffmpeg').path, [
        '-v', 'error', '-i', 'tests/fixtures/studio-media/pattern-a.mp4',
        // AAC edit-list handling differs between bundled FFmpeg builds (6 vs
        // 6.022 s). Isolate rotation with video only; the other cases cover audio.
        '-an', '-c', 'copy', '-metadata:s:v:0', 'rotate=90', output,
      ], { timeout: 15_000 });
      source = await readFile(output);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
  // The real probe reads the complete file, including a payload above the API body limit.
  const bytes = corrupt ? Buffer.from('not a video') : Buffer.concat([
    source, Buffer.alloc(5 * 1024 * 1024),
  ]);
  const state = {
    owner: 'owner' as string | null, reads: 0, uploads: [] as any[], legacy: [] as any[], canonical: [] as any[],
    bytes, key: 'user-assets/owner/source.mov', url: 'https://media.example.com/user-assets/owner/source.mov',
  };
  const stubs: Record<string, string> = {
    '@/lib/supabase-ssr': 'export const getRouteAuthContext=async()=>({userId:fixture.owner});',
    '@/server/storage': `
      export const isStorageKeyWithinUserPrefix=({key,prefix,userId})=>key.startsWith(prefix+'/'+userId+'/');
      export const buildPublicStorageUrl=()=>fixture.url;
      export const getStorageObjectMetadata=async()=>({size:fixture.bytes.length,mime:'video/quicktime'});
      export const getStorageObjectBuffer=async()=>{fixture.reads++;return fixture.bytes};
      export const uploadFileBufferToKey=async p=>{fixture.uploads.push(p);return {url:fixture.url}};
      export const recordUserAsset=async p=>{fixture.legacy.push(p);return 'legacy'};
      export const deleteStorageObjectKey=async()=>{};
    `,
    '@/server/media-library': `export const ensureReusableAsset=async p=>{fixture.canonical.push(p);return {publicId:'${assetId}'}};`,
  };
  const path = kind === 'multipart' ? 'multipart/complete' : 'complete';
  const bundle = await build({
    entryPoints: [`frontend/app/api/uploads/video/${path}/route.ts`], bundle: true, write: false,
    platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'upload-boundaries', setup(b) {
      b.onResolve({ filter: /.*/ }, a => a.path in stubs ? { path: a.path, namespace: 'fixture' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: stubs[a.path], loader: 'ts' }));
    } }],
  });
  const module = { exports: {} as { POST(request: unknown): Promise<Response> } };
  new Function('require', 'module', 'exports', 'fixture', bundle.outputFiles[0].text)(requireFrontend, module, module.exports, state);
  const payload = { key: state.key, fileName: 'iPhone.mov', mime: 'video/quicktime', size: bytes.length,
    uploadId: 'upload_123', parts: [{ partNumber: 1, key: 'user-assets/video-upload-parts/upload_123/owner/1', size: bytes.length }] };
  return { state, payload, run: () => module.exports.POST({ json: async () => payload }) };
}

for (const kind of ['multipart', 'direct'] as const) {
  test(`${kind} completion measures the original and returns/persists facts needed by Modify Video`, async () => {
    const { state, run } = await fixture(kind);
    const response = await run();
    assert.equal(response.status, 200);
    const { asset } = await response.json();
    assert.deepEqual(asset.mediaFacts, expectedFacts);
    assert.equal(asset.durationSec, 6);
    assert.equal(asset.width, 320); assert.equal(asset.height, 180);
    assert.equal(asset.assetId, assetId);
    assert.equal(asset.url, state.url); assert.equal(asset.mime, 'video/quicktime');
    assert.equal(state.reads, 1);
    for (const saved of [state.legacy[0], state.canonical[0]]) {
      assert.deepEqual(saved.metadata.mediaFacts, expectedFacts);
      assert.equal(saved.width, 320); assert.equal(saved.height, 180);
      assert.equal(saved.url, state.url); assert.equal(saved.userId, 'owner');
    }
    assert.equal(state.legacy[0].metadata.durationSec, 6);
    assert.equal(state.canonical[0].durationSec, 6);
    if (kind === 'multipart') assert.deepEqual(state.uploads[0].data, state.bytes);
  });

  test(`${kind} completion rejects unreadable bytes before recording a ready asset`, async () => {
    const { state, run } = await fixture(kind, true);
    const response = await run();
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error, 'METADATA_UNVERIFIED');
    assert.equal(state.legacy.length, 0); assert.equal(state.canonical.length, 0);
    assert.equal(state.uploads.length, 0);
  });

  test(`${kind} completion checks ownership before reading or measuring bytes`, async () => {
    const { state, run } = await fixture(kind);
    state.owner = 'another-owner';
    assert.equal((await run()).status, 400);
    assert.equal(state.reads, 0); assert.equal(state.legacy.length, 0); assert.equal(state.canonical.length, 0);
  });

  test(`${kind} completion measures portrait MOV display geometry without changing the original`, async () => {
    const { state, run } = await fixture(kind, false, true);
    const response = await run();
    assert.equal(response.status, 200);
    const { asset } = await response.json();
    assert.deepEqual(asset.mediaFacts, { ...expectedFacts, width: 180, height: 320, hasAudio: false });
    assert.equal(state.canonical[0].width, 180); assert.equal(state.canonical[0].height, 320);
    assert.equal(asset.url, state.url); assert.equal(asset.mime, 'video/quicktime');
    if (kind === 'multipart') assert.deepEqual(state.uploads[0].data, state.bytes);
  });
}
