import assert from 'node:assert/strict';
import test from 'node:test';
import {createConversationMediaReadAccess} from '../frontend/src/server/studio/conversation-media-read-access';
import { finalizeCreatorOperation,CreatorFinalizationError } from '../frontend/src/server/tools/creator-finalize';
import { prepareCreatorProfile } from '../frontend/src/server/tools/creator-profiles';
import { creatorOperationInputSchema } from '../frontend/src/lib/toolbox/creator-tools';
import type { JobOutputRecord } from '../frontend/server/media-library';
const source={type:'asset' as const,assetId:'ma_source',kind:'video' as const};
const input=creatorOperationInputSchema.parse({toolId:'product-video-editor',version:1,inputs:[{role:'source',source}],settings:{audioPolicy:'preserve'}});
const facts={kind:'video' as const,width:640,height:480,durationSec:10,fps:30,hasAudio:true,sizeBytes:123,mimeType:'video/mp4',audioDurationSec:10,audioStartSec:0};
const prepared=prepareCreatorProfile(input,[{input:input.inputs[0],asset:source,url:'https://cdn.example.com/source.mp4',facts,fingerprint:'snapshot'}]);
const output:JobOutputRecord={id:'actual-output',jobId:'job',userId:'owner',kind:'video',url:'https://cdn.example.com/generated.mp4',storageUrl:null,thumbUrl:null,previewUrl:null,mimeType:'video/mp4',width:640,height:480,durationSec:10,position:0,status:'ready',metadata:{}};
test('finalizer validates exact output ID, maps selected sound and publishes a separate owned asset',async()=>{
  const refs:unknown[]=[];let persisted=false;
  const result=await finalizeCreatorOperation('owner','job',prepared,{
    listOutputs:async()=>new Map([['job',[output]]]),
    resolve:async(userId,ref)=>{refs.push(ref);return{id:'original',ref:ref as typeof source,kind:'video',url:(ref as {type:string}).type==='asset'?prepared.sources[0].url:output.url,mime:'video/mp4',thumbUrl:null,previewUrl:null,mediaFacts:undefined,originalAccess:{type:'external'}};},
    download:async file=>({bytes:Buffer.from(file.download_url===output.url?'provider':'selected-sound'),mimeType:'video/mp4',fileName:'source.mp4'}),
    inspect:async()=>facts,
    mux:async(video,audio)=>{assert.equal(Buffer.from(video).toString(),'provider');assert.equal(Buffer.from(audio!).toString(),'selected-sound');return{bytes:Buffer.from('final'),facts};},
    persist:async(userId,bytes,measured,lineage)=>{assert.equal(userId,'owner');assert.equal(Buffer.from(bytes).toString(),'final');assert.deepEqual(lineage.generation,{jobId:'job',outputId:'actual-output'});persisted=true;return{asset:{type:'asset',assetId:'ma_new-result',kind:'video'},url:'https://cdn.example.com/final.mp4',thumbnailUrl:null};},
  });
  assert.equal(persisted,true);assert.equal(result.outputs[0].asset.type,'asset');assert.notEqual(result.outputs[0].originalUrl,output.url);
  assert.deepEqual(refs[0],{type:'job-output',jobId:'job',outputId:'actual-output',kind:'video'});
  assert.deepEqual(result.sourceAssets,[source]);
});
test('unusable duration fails before audio mux or publication',async()=>{
  let effects=0;
  await assert.rejects(finalizeCreatorOperation('owner','job',prepared,{
    listOutputs:async()=>new Map([['job',[output]]]),
    resolve:async()=>({id:'original',ref:source,kind:'video',url:output.url,mime:'video/mp4',thumbUrl:null,previewUrl:null,mediaFacts:undefined,originalAccess:{type:'external'}}),
    download:async()=>({bytes:Buffer.from('bad'),mimeType:'video/mp4',fileName:'bad.mp4'}),
    inspect:async()=>({...facts,durationSec:7}),
    mux:async()=>{effects++;throw new Error('must not run');},persist:async()=>{effects++;throw new Error('must not run');},
  }),CreatorFinalizationError);
  assert.equal(effects,0);
});

test('private generated output and preserved audio use signed reads without changing canonical snapshots',async()=>{
  const keys:string[]=[],reads:string[]=[];let savedLineage:unknown;
  const result=await finalizeCreatorOperation('owner','job',prepared,{
    listOutputs:async()=>new Map([['job',[output]]]),
    resolve:async(_userId,ref)=>{const audio=(ref as {type:string}).type==='asset';return{id:'original',ref:ref as typeof source,kind:'video',url:audio?prepared.sources[0].url:output.url,mime:'video/mp4',thumbUrl:null,previewUrl:null,mediaFacts:undefined,originalAccess:{type:'owned-storage',storageKey:audio?'files/owner/audio.mp4':'files/owner/generated.mp4'}};},
    readAccess:async(userId,media)=>createConversationMediaReadAccess(userId,media,{sign:async key=>{keys.push(key);return 'https://storage.example.com/'+key+'?signature=temporary';}}),
    download:async file=>{reads.push(file.download_url);assert.match(file.download_url,/signature=temporary$/);return{bytes:Buffer.from(file.download_url.includes('generated')?'provider':'selected-sound'),mimeType:'video/mp4',fileName:'source.mp4'};},
    inspect:async()=>facts,
    mux:async(video,audio)=>{assert.equal(Buffer.from(video).toString(),'provider');assert.equal(Buffer.from(audio!).toString(),'selected-sound');return{bytes:Buffer.from('final'),facts};},
    persist:async(_userId,_bytes,_facts,lineage)=>{savedLineage=lineage;return{asset:{type:'asset',assetId:'ma_final',kind:'video'},url:'https://cdn.example.com/final.mp4',thumbnailUrl:null};},
  });
  assert.deepEqual(keys,['files/owner/generated.mp4','files/owner/audio.mp4']);assert.equal(reads.length,2);
  assert.equal(JSON.stringify({result,savedLineage,prepared}).includes('signature='),false);assert.equal(prepared.sources[0].url,'https://cdn.example.com/source.mp4');
});
