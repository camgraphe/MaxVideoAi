import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'esbuild';

test('final creator assets carry job provenance without reusing original output identity; prepared inputs stay separate', async () => {
  const state = { saved: [] as Record<string, any>[] };
  (globalThis as any).creatorPublicationFixture = state;
  const stubs: Record<string, string> = {
    '@/server/studio/conversation-media-read-access': 'export const createConversationMediaReadAccess=()=>{throw Error("unexpected source read")};',
    '@/server/studio/media-resolver': 'export const resolveStudioMedia=()=>{throw Error("unexpected resolution")};',
    './creator-profiles': 'export const prepareCreatorProfile=()=>{},isCreatorLipVideoEnabled=()=>false,isCreatorMotionControlEnabled=()=>false;',
    './creator-segment-media': 'export const downloadCreatorMedia=()=>{},inspectCreatorBytes=()=>{},trimCreatorBytes=()=>{},validateCreatorSegment=()=>{},withCreatorMediaSlot=()=>{};',
    '@/server/storage': `export const buildObjectKey=({userId,leafName})=>'files/'+userId+'/'+leafName;export const uploadFileBufferToKey=async({key})=>({url:'https://media.example.test/'+key});`,
    '@/server/upload-thumbnails': `export const createUploadVideoThumbnail=async()=>null;export const createUploadImageThumbnail=async()=>null;`,
    '@/server/media-library': `export const ensureReusableAsset=async params=>{globalThis.creatorPublicationFixture.saved.push(params);return {publicId:'ma_final',url:params.url,thumbUrl:null};};`,
  };
  try {
    const bundle = await build({entryPoints:['frontend/src/server/tools/creator-sources.ts'],bundle:true,platform:'node',format:'cjs',write:false,packages:'external',tsconfig:'frontend/tsconfig.json',plugins:[{name:'publication-boundaries',setup(builder){
      builder.onResolve({filter:/.*/},args=>args.path in stubs?{path:args.path,namespace:'fixture'}:undefined);
      builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'js'}));
    }}]});
    const module = {exports:{} as any};
    new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(resolve('frontend/package.json')),module,module.exports);
    for (const toolId of ['lip-sync','product-photo-editor','product-video-editor','motion-transfer']) {
      const kind = toolId === 'product-photo-editor' ? 'image' : 'video';
      const facts = {kind,width:640,height:480,sizeBytes:5,mimeType:kind==='image'?'image/png':'video/mp4',durationSec:kind==='image'?null:8};
      const lineage = {toolId,generation:{jobId:`job-${toolId}`,outputId:'provider-original'},sourceAssets:[]};
      const result = await module.exports.persistCreatorMedia('owner',Buffer.from('final'),facts,lineage);
      const saved = state.saved.at(-1)!;
      assert.equal(saved.sourceJobId, `job-${toolId}`);
      assert.equal(saved.sourceOutputId, undefined, 'a finalized derivative cannot take the original output identity');
      assert.equal(saved.kind, kind);
      assert.equal(saved.userId, 'owner');
      assert.deepEqual(saved.metadata.creator, lineage);
      assert.equal(saved.url, result.url);
      assert.match(result.url, /\/creator-[a-f0-9]{64}\.(mp4|png)$/);
      await module.exports.persistCreatorMedia('owner',Buffer.from('source'),facts,{role:'source',source:{type:'asset',assetId:'ma_input'}});
      assert.equal(state.saved.at(-1)!.sourceJobId, null, 'reference preparation is not a generated result');
    }
  } finally { delete (globalThis as any).creatorPublicationFixture; }
});
