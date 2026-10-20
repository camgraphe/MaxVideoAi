import assert from 'node:assert/strict';
import test from 'node:test';
import { creatorOperationInputSchema } from '../frontend/src/lib/toolbox/creator-tools';
import { createConversationMediaReadAccess } from '../frontend/src/server/studio/conversation-media-read-access';
import { resolveCreatorSources,creatorSourceFingerprint } from '../frontend/src/server/tools/creator-sources';
import type { CreatorSourcesDependencies } from '../frontend/src/server/tools/creator-sources';
import type { StudioResolvedMedia } from '../frontend/src/server/studio/media-resolver';
const source={type:'asset' as const,assetId:'ma_11111111111111111111111111111111',kind:'video' as const};
const block=creatorOperationInputSchema.parse({toolId:'product-video-editor',version:1,inputs:[{role:'source',source,segment:{startSec:2,endSec:7}}],settings:{}});
const media:StudioResolvedMedia={id:'internal',ref:source,kind:'video',url:'https://cdn.example.com/original.mp4',mime:'video/mp4',thumbUrl:null,previewUrl:null,mediaFacts:undefined,originalAccess:{type:'external'}};
const facts={kind:'video' as const,width:640,height:480,durationSec:10,fps:30,hasAudio:true,sizeBytes:10,mimeType:'video/mp4'};
function dependencies(overrides:Partial<CreatorSourcesDependencies>={}) {
  const state={downloads:0,persists:0,trims:[] as unknown[],lineage:null as unknown};
  const deps:CreatorSourcesDependencies={readAccess:createConversationMediaReadAccess,resolve:async()=>media,download:async()=>{state.downloads++;return{bytes:Buffer.from('source'),fileName:'source.mp4',mimeType:'video/mp4'};},inspect:async()=>facts,trim:async(bytes,measured,segment)=>{state.trims.push({bytes:Buffer.from(bytes).toString(),duration:measured.durationSec,segment});return{bytes:Buffer.from('segment'),facts:{...facts,durationSec:5}};},persist:async(userId,bytes,measured,lineage)=>{state.persists++;state.lineage=lineage;assert.equal(Buffer.from(bytes).toString(),'segment');assert.equal(measured.durationSec,5);return{asset:{...source,assetId:'ma_22222222222222222222222222222222'},url:'https://cdn.example.com/segment.mp4',thumbnailUrl:null};},...overrides};
  return{deps,state};
}
test('source resolution proves ownership before reading bytes and freezes a distinct measured segment',async()=>{
  const {deps,state}=dependencies();const [resolved]=await resolveCreatorSources(block,'owner',deps);
  assert.equal(resolved.input.source,source===block.inputs[0].source?source:block.inputs[0].source);
  assert.notEqual(resolved.asset.assetId,source.assetId);assert.equal(resolved.facts.durationSec,5);
  assert.deepEqual(state.trims,[{bytes:'source',duration:10,segment:{startSec:2,endSec:7}}]);
  assert.equal(state.persists,1);assert.equal((state.lineage as {source:unknown}).source,block.inputs[0].source);
  const foreign=dependencies({resolve:async()=>{throw new Error('MEDIA_NOT_AVAILABLE');}});
  await assert.rejects(resolveCreatorSources(block,'foreign',foreign.deps),/MEDIA_NOT_AVAILABLE/);
  assert.equal(foreign.state.downloads,0);assert.equal(foreign.state.persists,0);
});
test('source change during measured preparation cannot create an authorized derivative',async()=>{
  let reads=0;const {deps,state}=dependencies({resolve:async()=>({...media,url:++reads===1?media.url:'https://cdn.example.com/replaced.mp4'})});
  await assert.rejects(resolveCreatorSources(block,'owner',deps),/changed during preparation/);
  assert.equal(state.persists,0);
});

test('private source preparation signs only temporary read access and retains canonical identity',async()=>{
  const original:StudioResolvedMedia={...media,url:'https://cdn.example.com/private-original.mp4',originalAccess:{type:'owned-storage',storageKey:'files/owner/private-original.mp4'}};
  const signed='https://storage.example.com/private-original.mp4?signature=temporary',keys:string[]=[];
  const {deps,state}=dependencies({resolve:async()=>original,readAccess:async(userId,value)=>{assert.equal(userId,'owner');assert.equal(value.url,original.url);return createConversationMediaReadAccess(userId,value,{sign:async key=>{keys.push(key);return signed;}});},download:async file=>{assert.equal(file.download_url,signed);return{bytes:Buffer.from('source'),fileName:'source.mp4',mimeType:'video/mp4'};}});
  const [resolved]=await resolveCreatorSources(block,'owner',deps);
  assert.deepEqual(keys,['files/owner/private-original.mp4']);assert.equal(resolved.fingerprint,creatorSourceFingerprint(original));
  assert.equal((state.lineage as {sourceFingerprint:string}).sourceFingerprint,creatorSourceFingerprint(original));
  assert.equal(resolved.url,'https://cdn.example.com/segment.mp4');assert.equal(JSON.stringify({resolved,lineage:state.lineage}).includes('signature='),false);
});
test('private signing failure never falls back to downloading a canonical source URL',async()=>{
  const {deps,state}=dependencies({resolve:async()=>({...media,originalAccess:{type:'owned-storage',storageKey:'files/owner/private.mp4'}}),readAccess:async()=>{throw new Error('SIGNING_UNAVAILABLE');}});
  await assert.rejects(resolveCreatorSources(block,'owner',deps),/SIGNING_UNAVAILABLE/);assert.equal(state.downloads,0);assert.equal(state.persists,0);
});
