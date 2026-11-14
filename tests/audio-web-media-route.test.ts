import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const frontendRequire = createRequire(resolve('frontend/package.json'));

test('Audio media route authenticates each navigation and never caches grants or accepts arbitrary URLs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'audio-web-route-'));
  const output = join(directory, 'route.cjs');
  const mocks: Record<string, string> = {
    '@/lib/supabase-ssr': `export const getRouteAuthContext=async()=>({userId:globalThis.audioRouteTest.owner});`,
    '@/server/audio/audio-web-media-access': `export const resolveAudioWebMedia=async input=>{globalThis.audioRouteTest.reads.push(input);return globalThis.audioRouteTest.media;};`,
  };
  const state = { owner: null as string | null, reads: [] as unknown[], media: { url: 'https://private.example/original.mp4?grant=renewed' } as { url: string } | null };
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'audioRouteTest');
  Object.defineProperty(globalThis, 'audioRouteTest', { value: state, configurable: true });
  try {
    const compiled = await build({ entryPoints: [resolve('frontend/app/api/audio/media/[jobId]/route.ts')], outfile: output, bundle: true, write: false, platform: 'node', format: 'cjs', tsconfig: 'frontend/tsconfig.json', packages: 'external', plugins: [{ name: 'fixture', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        if (args.path in mocks) return { path: args.path, namespace: 'fixture' };
        if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/')) return { path: frontendRequire.resolve(args.path), external: true };
      });
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js' }));
    } }] });
    await writeFile(output, compiled.outputFiles[0].contents);
    const { GET } = require(output);
    const { NextRequest } = frontendRequire('next/server');
    const navigate = (query = 'kind=video') => GET(new NextRequest(`https://app.example/api/audio/media/owned-job?${query}`), { params: { jobId: 'owned-job' } });
    let response = await navigate();
    assert.equal(response.status, 401); assert.equal(state.reads.length, 0);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    state.owner = 'owner';
    for (const query of ['kind=other', 'kind=video&kind=audio', 'kind=video&url=https://foreign.example/file.mp4', '']) {
      assert.equal((await navigate(query)).status, 400);
    }
    assert.equal(state.reads.length, 0);
    for (let attempt = 0; attempt < 2; attempt++) {
      response = await navigate();
      assert.equal(response.status, 307);
      assert.equal(response.headers.get('Location'), state.media!.url);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
    }
    assert.deepEqual(state.reads, Array(2).fill({ userId: 'owner', jobId: 'owned-job', kind: 'video' }));
    state.media = null;
    response = await navigate();
    assert.equal(response.status, 404); assert.equal(response.headers.get('Location'), null);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'audioRouteTest', saved); else delete (globalThis as any).audioRouteTest;
    await rm(directory, { recursive: true, force: true });
  }
});
