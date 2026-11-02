import assert from 'node:assert/strict';
import test from 'node:test';
import { privateMediaAssetName } from '../frontend/server/media-library/private-asset-name';

test('private library names prefer custom names and retain the actual original extension', () => {
  assert.equal(privateMediaAssetName({ originalName: 'watch-motion-poster.png' }), 'watch-motion-poster.png');
  assert.equal(privateMediaAssetName({ originalName: 'watch-scroll.mp4' }), 'watch-scroll.mp4');
  assert.equal(privateMediaAssetName({ label: 'My chosen title', originalName: 'private-file.png' }), 'My chosen title');
  assert.equal(privateMediaAssetName({ fileName: 'custom.png', originalName: 'private-file.png' }), 'custom.png');
  assert.equal(privateMediaAssetName({ filename: 'legacy.png', originalName: 'private-file.png' }), 'legacy.png');
  assert.equal(privateMediaAssetName({ label: ' ', fileName: null, filename: false, originalName: ' reference.tiff ' }), 'reference.tiff');
  assert.equal(privateMediaAssetName({ label: 42, originalName: [] }), null);
  assert.equal(privateMediaAssetName({}), null);
});

// Run the actual private route with offline account/library boundaries, without SQL or HTTP.
test('only an authenticated library response receives the private display name', async () => {
  const { build } = await import('esbuild');
  const { runInNewContext } = await import('node:vm');
  const path = await import('node:path');
  const fixture = { owner: null as string | null, reads: 0, assets: [
    { id: 'image', kind: 'image', url: 'https://private.invalid/hash.png', metadata: { originalName: 'watch-static.png' } },
    { id: 'video', kind: 'video', url: 'https://private.invalid/hash.mp4', metadata: { label: 'Chosen title', originalName: 'watch-scroll.mp4' } },
  ] };
  const stubs: Record<string, string> = {
    'next/server': 'export const NextResponse={json:(data,init)=>new Response(JSON.stringify(data),init)};',
    '@/lib/supabase-ssr': 'export const getRouteAuthContext=async()=>({userId:fixture.owner});',
    '@/server/media-library/read-access': 'export const createLibraryMediaReadAccess=async()=>({});',
    '@/server/media-library': 'export const listLibraryAssetPage=async()=>{fixture.reads++;return {items:fixture.assets,nextCursor:null,hasMore:false}}; export const findLibraryAssetByOrigin=async()=>null; export const deleteLibraryAsset=async()=>null;',
  };
  const frontend = path.join(process.cwd(), 'frontend');
  const compiled = await build({ absWorkingDir: frontend, entryPoints: ['app/api/media-library/assets/route.ts'], tsconfig: path.join(frontend, 'tsconfig.json'), bundle: true, platform: 'node', format: 'cjs', write: false,
    plugins: [{ name: 'private-name-fixture', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: frontend }));
    } }],
  });
  const module = { exports: {} as { GET(req: unknown): Promise<Response> } };
  runInNewContext(compiled.outputFiles[0].text, { module, exports: module.exports, fixture, Response, console });
  const request = { nextUrl: new URL('https://local.invalid/api/media-library/assets?kind=image') };
  const denied = await module.exports.GET(request);
  assert.equal(denied.status, 401);
  assert.equal(fixture.reads, 0);
  assert.deepEqual((await denied.json()).assets, []);
  fixture.owner = 'owner';
  const response = await module.exports.GET(request);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const payload = await response.json();
  assert.deepEqual(payload.assets.map((asset: { name: string }) => asset.name), ['watch-static.png', 'Chosen title']);
  assert.ok(payload.assets.every((asset: object) => !('metadata' in asset)), 'private names do not require exposing all stored metadata');
});
