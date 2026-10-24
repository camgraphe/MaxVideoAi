import assert from 'node:assert/strict';
import test from 'node:test';
import { getBaseEngineIncludingHidden } from '../frontend/src/lib/engines';
import type { StudioResolvedMedia } from '../frontend/src/server/studio/media-resolver';
import { prepareVideoExcerpt, type VideoExcerptDependencies } from '../frontend/server/video-excerpts/prepare';
import type { VideoExcerptFacts } from '../frontend/server/video-excerpts/media';
const source = {type:'asset' as const,assetId:'ma_11111111111111111111111111111111',kind:'video' as const};
const ref = {...source,assetId:'ma_22222222222222222222222222222222'};
const media: StudioResolvedMedia = {id:'source',ref:source,kind:'video',url:'https://media.example/source.mp4',mime:'video/mp4',thumbUrl:null,previewUrl:null,mediaFacts:undefined,originalAccess:{type:'external'}};
const facts:VideoExcerptFacts = {kind:'video',width:1280,height:720,durationSec:60,fps:30,hasAudio:true,sizeBytes:10,mimeType:'video/mp4',videoCodec:'h264',audioCodec:'aac'};
const input = {source,engineId:'luma-ray-3-2',mode:'v2v' as const,range:{startSec:20,endSec:38}};

test('reference video preparation retains its real field/mode policy and rejects audio-slot impersonation', async () => {
  for (const [engineId, fieldId] of [['wan-3', 'reference_video_urls'], ['seedance-2-5', 'video_urls']]) {
    const { state, deps } = setup({ persist: async () => ({ id: ref.assetId, assetId: ref.assetId, ref, url: 'https://media.example/excerpt.mp4', durationSec: 5 }) });
    const result = await prepareVideoExcerpt('owner', { source, engineId, mode: 'ref2v', fieldId, range: { startSec: 10, endSec: 15 } }, deps);
    assert.equal(result.asset.durationSec, 5);
    assert.equal(state.downloads, 1);
  }
  const { state, deps } = setup();
  await assert.rejects(prepareVideoExcerpt('owner', { source, engineId: 'wan-3', mode: 'ref2v', fieldId: 'reference_audio_urls', range: { startSec: 10, endSec: 15 } }, deps));
  assert.equal(state.downloads, 0);
});
function setup(overrides: Partial<VideoExcerptDependencies> = {}) {
  const state = {downloads:0,persists:0,lineage:null as unknown,trims:0};
  const deps: VideoExcerptDependencies = {
    engine:async id=>getBaseEngineIncludingHidden(id),
    resolve:async(_user,selected)=> (selected as typeof source).assetId===ref.assetId ? {...media,id:'prepared',ref,url:'https://media.example/excerpt.mp4',durationSec:18} : media,
    readAccess:async(_user,value)=>({url:value.url+'?signed=read',expires:null}),
    download:async file=>{state.downloads++;assert.equal(file.download_url,media.url+'?signed=read');return {bytes:Buffer.from('source'),fileName:'source.mp4',mimeType:'video/mp4'};},
    inspect:async()=>facts,
    relight:async()=>{throw new Error('Unused Relight encoder');},
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

test('explicit Kling Edit prepares 15 seconds while Reference omission keeps its 10 second bound', async () => {
  for (const operation of ['kling-edit', 'kling-reference', undefined]) {
    const { deps } = setup({ persist: async (_user, _bytes, measured, lineage) => {
      assert.equal(lineage.operation, 'kling-edit');
      return { id: ref.assetId, assetId: ref.assetId, ref, url: 'https://media.example/excerpt.mp4', durationSec: measured.durationSec };
    }});
    const request = { source, engineId: 'kling-o3-standard', mode: 'v2v', fieldId: 'video_url', range: {startSec:0,endSec:15}, ...(operation ? {operation} : {}) };
    if (operation === 'kling-edit') assert.equal((await prepareVideoExcerpt('owner', request, deps)).asset.durationSec, 15);
    else await assert.rejects(prepareVideoExcerpt('owner', request, deps));
  }
});
test('operation/engine/mode/field mismatch and provider-lineage preparation fail before reading media', async () => {
  for (const request of [
    {...input,operation:'kling-edit'}, {...input,engineId:'kling-o3-pro',mode:'t2v',operation:'kling-edit'},
    {...input,engineId:'kling-o3-pro',operation:'kling-edit',fieldId:'image_urls'},
    {...input,operation:'luma-extend',mode:'extend',fieldId:'video_url'},
    {...input,engineId:'flux-3-draft',operation:'flux-draft-enhance',fieldId:'video_url'},
    {...input,operation:null}, {...input,operation:'unknown'},
  ]) {
    const {state,deps}=setup(); await assert.rejects(prepareVideoExcerpt('owner',request,deps));assert.equal(state.downloads,0);
  }
});
test('operation capability revocation after encoding prevents persistence', async () => {
  let reads=0;
  const {state,deps}=setup({engine:async id=>{ const engine=getBaseEngineIncludingHidden(id)!; return ++reads===1?engine:{...engine,operationCaps:{}}; }});
  await assert.rejects(prepareVideoExcerpt('owner',{source,engineId:'kling-o3-pro',mode:'v2v',operation:'kling-edit',range:{startSec:0,endSec:15}},deps));
  assert.equal(state.trims,1);assert.equal(state.persists,0);
});

test('Relight requires the reviewed actual copy duration and persists its distinct cadence profile', async () => {
  const request={source,engineId:'minimax-h3-max',mode:'v2v',operation:'h3-relight',fieldId:'video_url',range:{startSec:0,endSec:5.56}};
  const {state,deps}=setup();
  await assert.rejects(prepareVideoExcerpt('owner',request,deps));assert.equal(state.downloads,0);
  let lineage: any;
  const result=await prepareVideoExcerpt('owner',{...request,acceptedCopyDurationSec:124/24},{...deps,
    relight:async()=>({bytes:Buffer.from('prepared'),facts:{...facts,durationSec:124/24,fps:24,decodedFrameCount:124,constantFrameRate:true},plan:{fps:24,frameCount:124,durationSec:124/24,removedEndSec:5.56-124/24},sourceSha256:'hash'}),
    persist:async(_u,_b,measured,l)=>{lineage=l;return {id:ref.assetId,assetId:ref.assetId,ref,url:'https://media.example/excerpt.mp4',durationSec:measured.durationSec};},
  });
  assert.equal(result.asset.durationSec,124/24);assert.equal(lineage.encoder,'h3-relight-24fps-v1');assert.equal(lineage.operation,'h3-relight');assert.deepEqual(lineage.range,request.range);
});
