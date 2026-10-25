import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const base = 'https://library-private-fixture.s3.us-east-1.amazonaws.com';
Object.assign(process.env, { S3_BUCKET: 'library-private-fixture', S3_REGION: 'us-east-1', S3_ACCESS_KEY_ID: 'fixture-key', S3_SECRET_ACCESS_KEY: 'fixture-secret', S3_PUBLIC_BASE_URL: base });
const original = `${base}/user-assets/owner/excerpt.mp4`;
const thumbnail = `${base}/user-assets/owner/excerpt.webp`;
const boundaries: Record<string, string> = {
  '@/lib/supabase-ssr': 'export const getRouteAuthContext=async()=>({userId:globalThis.libraryReadFixture.owner});',
  '@/server/media-library': 'export const listLibraryAssetPage=async()=>({items:globalThis.libraryReadFixture.assets,nextCursor:null,hasMore:false});export const findLibraryAssetByOrigin=async()=>globalThis.libraryReadFixture.assets[0];export const deleteLibraryAsset=async()=>{};',
  '@/server/marketing-media/access': 'export const canReadMarketingFile=async()=>false;',
};
const loaded = build({ entryPoints: ['frontend/app/api/media-library/assets/route.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external', tsconfig: 'frontend/tsconfig.json', plugins: [{name:'library-boundaries', setup(b) {
  b.onResolve({filter:/.*/}, a=>a.path in boundaries ? {path:a.path,namespace:'boundary'} : undefined);
  b.onLoad({filter:/.*/,namespace:'boundary'}, a=>({contents:boundaries[a.path],loader:'js'}));
}}]}).then(result=>{const module={exports:{} as any};new Function('require','module','exports',result.outputFiles[0].text)(requireFrontend,module,module.exports);return module.exports;});

test('authenticated library grants owned upload reads without rewriting canonical identities or unrelated media', async () => {
  const route = await loaded;
  const fixture = { owner:'owner', assets:[{id:'excerpt',publicId:'ma_'+'a'.repeat(32),userId:'owner',kind:'video',source:'upload',url:original,thumbUrl:thumbnail,previewUrl:original,metadata:{videoExcerpt:{version:2,storageAccess:'private'}}}] };
  (globalThis as any).libraryReadFixture=fixture;
  const {NextRequest}=requireFrontend('next/server');
  const response=await route.GET(new NextRequest('https://app.test/api/media-library/assets?kind=video'));
  assert.equal(response.status,200);
  const {assets:[asset]}=await response.json();
  assert.equal(asset.url,original);assert.equal(asset.thumbUrl,thumbnail);assert.equal(asset.previewUrl,original);
  for(const [field,path] of [['accessUrl','excerpt.mp4'],['thumbnailAccessUrl','excerpt.webp'],['previewAccessUrl','excerpt.mp4']]) {
    assert.equal(typeof asset[field],'string',`${field} must provide authorized display access`);
    const grant=new URL(asset[field]);assert.equal(grant.pathname,`/user-assets/owner/${path}`);
    assert.equal(grant.searchParams.get('X-Amz-Expires'),'300');assert.ok(grant.searchParams.get('X-Amz-Signature'));
  }
  assert.match(response.headers.get('cache-control')??'',/private.*no-store/);
  assert.equal(fixture.assets[0].url,original);
  fixture.assets[0].metadata={} as typeof fixture.assets[0]['metadata'];
  const mcpAsset=(await (await route.GET(new NextRequest('https://app.test/api/media-library/assets'))).json()).assets[0];
  assert.ok(new URL(mcpAsset.accessUrl).searchParams.get('X-Amz-Signature'),'legacy private MCP imports have no ACL metadata marker');
  fixture.assets[0].source='generated';
  const publicAsset=(await (await route.GET(new NextRequest('https://app.test/api/media-library/assets'))).json()).assets[0];
  assert.equal(publicAsset.url,original);assert.equal(publicAsset.accessUrl,undefined);
});

test('library refuses foreign-owner signing and unauthenticated reads rather than returning a private unsigned fallback',async()=>{
  const route=await loaded;const {NextRequest}=requireFrontend('next/server');
  (globalThis as any).libraryReadFixture={owner:'owner',assets:[{id:'foreign',userId:'owner',url:`${base}/user-assets/other/private.mp4`,kind:'video',source:'upload',metadata:{}}]};
  const response=await route.GET(new NextRequest('https://app.test/api/media-library/assets'));
  assert.equal(response.status,500);assert.deepEqual((await response.json()).assets,[]);
  (globalThis as any).libraryReadFixture.owner=null;
  assert.equal((await route.GET(new NextRequest('https://app.test/api/media-library/assets'))).status,401);
});
