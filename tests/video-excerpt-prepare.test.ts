import assert from 'node:assert/strict';
import test from 'node:test';
import { getBaseEngineIncludingHidden } from '../frontend/src/lib/engines';
import type { StudioResolvedMedia } from '../frontend/src/server/studio/media-resolver';
import { prepareVideoExcerpt, type VideoExcerptDependencies } from '../frontend/server/video-excerpts/prepare';
import type { VideoExcerptFacts } from '../frontend/server/video-excerpts/media';
const source = {type:'asset' as const,assetId:'ma_11111111111111111111111111111111',kind:'video' as const};
const ref = {...source,assetId:'ma_22222222222222222222222222222222'};
const media: StudioResolvedMedia = {id:'source',ref:source,kind:'video',url:'https://media.example/source.mp4',mime:'video/mp4',thumbUrl:null,previewUrl:null,mediaFacts:undefined,originalAccess:{type:'external'}};
const facts:VideoExcerptFacts = {kind:'video',width:640,height:480,durationSec:60,fps:30,hasAudio:true,sizeBytes:10,mimeType:'video/mp4',videoCodec:'h264',audioCodec:'aac'};
const input = {source,engineId:'luma-ray-3-2',mode:'v2v' as const,range:{startSec:20,endSec:38}};
function setup(overrides: Partial<VideoExcerptDependencies> = {}) {
  const state = {downloads:0,persists:0,lineage:null as unknown,trims:0};
  const deps: VideoExcerptDependencies = {
    engine:async id=>getBaseEngineIncludingHidden(id),
    resolve:async(_user,selected)=> (selected as typeof source).assetId===ref.assetId ? {...media,id:'prepared',ref,url:'https://media.example/excerpt.mp4',durationSec:18} : media,
    readAccess:async(_user,value)=>({url:value.url+'?signed=read',expires:null}),
    download:async file=>{state.downloads++;assert.equal(file.download_url,media.url+'?signed=read');return {bytes:Buffer.from('source'),fileName:'source.mp4',mimeType:'video/mp4'};},
    inspect:async()=>facts,
    trim:async(_bytes,_facts,range)=>{state.trims++;return {bytes:Buffer.from('prepared'),facts:{...facts,durationSec:range.endSec-range.startSec}};},
    persist:async(_user,bytes,measured,lineage)=>{state.persists++;state.lineage=lineage;assert.equal(bytes.toString(),'prepared');assert.equal(measured.durationSec,18);return {id:ref.assetId,assetId:ref.assetId,ref,url:'https://media.example/excerpt.mp4',durationSec:18};},...overrides,
  };
  return {state,deps};
}
test('preparation proves original ownership, measures bytes and saves a distinct reusable asset with lineage', async()=>{
  const {state,deps}=setup(); const result=await prepareVideoExcerpt('owner',input,deps);
  assert.deepEqual(result.original,source); assert.deepEqual(result.range,input.range);
  assert.equal(result.asset.url,'https://media.example/excerpt.mp4');
  assert.equal(result.asset.previewUrl,'https://media.example/excerpt.mp4?signed=read');
  assert.notEqual(result.asset.assetId,source.assetId);assert.equal(state.persists,1);
  const lineage=state.lineage as {source:unknown;range:unknown;sourceSha256:string};
  assert.deepEqual(lineage.source,source);assert.deepEqual(lineage.range,input.range);assert.match(lineage.sourceSha256,/^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(lineage).includes('?signed='),false);
});
test('unauthorized, arbitrary URL, inactive model and unsupported mode requests cannot download',async()=>{
  for (const [user,value,overrides] of [
    ['',input,{}], ['owner',{...input,source:{...source,url:'https://evil.example/a.mp4'}},{}],
    ['owner',input,{engine:async()=>undefined}], ['owner',{...input,mode:'extend'},{}],
    ['other',input,{resolve:async()=>{throw new Error('MEDIA_NOT_AVAILABLE');}}],
  ] as Array<[string,unknown,Partial<VideoExcerptDependencies>]>) {
    const {state,deps}=setup(overrides);await assert.rejects(prepareVideoExcerpt(user,value,deps));assert.equal(state.downloads,0);assert.equal(state.persists,0);
  }
});
test('invalid measured ranges never cut or persist; stored duration is not trusted',async()=>{
  for (const range of [{startSec:-1,endSec:3},{startSec:1,endSec:1},{startSec:0,endSec:19},{startSec:59,endSec:62},{startSec:0,endSec:Infinity}]) {
    const {state,deps}=setup();await assert.rejects(prepareVideoExcerpt('owner',{...input,range},deps));assert.equal(state.trims,0);assert.equal(state.persists,0);
  }
});
test('source replacement or revoked ownership during preparation cannot persist an authorized derivative',async()=>{
  for (const revoke of [false,true]) {
    let reads=0;const {state,deps}=setup({resolve:async()=>{if(++reads===1)return media;if(revoke)throw new Error('MEDIA_NOT_AVAILABLE');return {...media,url:'https://media.example/replaced.mp4'};}});
    await assert.rejects(prepareVideoExcerpt('owner',input,deps));assert.equal(state.persists,0);
  }
});
test('bad output facts and a model disabled during preparation cannot persist',async()=>{
  for (const overrides of [
    {trim:async()=>({bytes:Buffer.from('prepared'),facts:{...facts,durationSec:20}})},
    {trim:async()=>({bytes:Buffer.from('prepared'),facts:{...facts,durationSec:18,hasAudio:false}})},
  ] as Partial<VideoExcerptDependencies>[]) {
    const {state,deps}=setup(overrides);await assert.rejects(prepareVideoExcerpt('owner',input,deps));assert.equal(state.persists,0);
  }
  let reads=0;const {state,deps}=setup({engine:async id=>++reads===1?getBaseEngineIncludingHidden(id):undefined});
  await assert.rejects(prepareVideoExcerpt('owner',input,deps));assert.equal(state.persists,0);
});
test('the response independently authorizes the saved owned asset',async()=>{
  const {deps}=setup({resolve:async(_user,selected)=>{if((selected as typeof source).assetId===ref.assetId)throw new Error('MEDIA_NOT_AVAILABLE');return media;}});
  await assert.rejects(prepareVideoExcerpt('owner',input,deps));
});

test('strict model maximum still rejects overlong fractional-frame output before or after persistence',async()=>{
  for(const storedOverflow of [false,true]) {
    const {deps}=setup(storedOverflow?{
      persist:async()=>({id:ref.assetId,assetId:ref.assetId,ref,url:'https://media.example/excerpt.mp4',durationSec:18.018}),
    }:{
      trim:async()=>({bytes:Buffer.from('prepared'),facts:{...facts,fps:30000/1001,durationSec:18.018}}),
    });
    await assert.rejects(prepareVideoExcerpt('owner',input,deps),/current model source limits/);
  }
});
