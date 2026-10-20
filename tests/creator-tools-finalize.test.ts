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

test('Lip Sync rejects the measured 10.34449s audio / 10.041667s video regression before mux and publication',async()=>{
  const portrait={type:'asset' as const,assetId:'ma_portrait',kind:'image' as const};
  const audio={type:'asset' as const,assetId:'ma_audio',kind:'audio' as const};
  const lipInput=creatorOperationInputSchema.parse({toolId:'lip-sync',version:1,inputs:[{role:'source',source:portrait},{role:'audio',source:audio}],settings:{mode:'photo'}});
  const lipPrepared=prepareCreatorProfile(lipInput,[
    {input:lipInput.inputs[0],asset:portrait,url:'https://cdn.example.com/portrait.png',fingerprint:'portrait',facts:{...facts,kind:'image',durationSec:null,fps:null,hasAudio:false,mimeType:'image/png'}},
    {input:lipInput.inputs[1],asset:audio,url:'https://cdn.example.com/audio.mp3',fingerprint:'audio',facts:{...facts,kind:'audio',durationSec:10.34449,audioDurationSec:10.34449,fps:null,mimeType:'audio/mpeg'}},
  ]);
  assert.equal(lipPrepared.expectedDurationSec,10.34449);
  assert.equal(lipPrepared.request.settings.durationSec,11);
  const effects:string[]=[];
  await assert.rejects(finalizeCreatorOperation('owner','job',lipPrepared,{
    listOutputs:async()=>new Map([['job',[output]]]),
    resolve:async()=>({id:'original',ref:source,kind:'video',url:output.url,mime:'video/mp4',thumbUrl:null,previewUrl:null,mediaFacts:undefined,originalAccess:{type:'external'}}),
    download:async()=>({bytes:Buffer.from('provider'),mimeType:'video/mp4',fileName:'provider.mp4'}),
    inspect:async()=>({...facts,durationSec:10.041667,fps:24}),
    mux:async()=>{effects.push('mux');throw Error('must not run');},persist:async()=>{effects.push('persist');throw Error('must not run');},
  }),error=>error instanceof CreatorFinalizationError&&/duration differs/.test(error.message));
  assert.deepEqual(effects,[]);
});

function wanLipPrepared(seconds=2.53) {
  const portrait={type:'asset' as const,assetId:'ma_portrait',kind:'image' as const},audio={type:'asset' as const,assetId:'ma_audio',kind:'audio' as const};
  const input=creatorOperationInputSchema.parse({toolId:'lip-sync',version:1,inputs:[{role:'source',source:portrait},{role:'audio',source:audio}],settings:{mode:'photo'}});
  return prepareCreatorProfile(input,[
    {input:input.inputs[0],asset:portrait,url:'https://cdn.example.com/portrait.png',fingerprint:'portrait',facts:{...facts,kind:'image',durationSec:null,fps:null,hasAudio:false,mimeType:'image/png'}},
    {input:input.inputs[1],asset:audio,url:'https://cdn.example.com/audio.wav',fingerprint:'audio',facts:{...facts,kind:'audio',durationSec:seconds,audioDurationSec:seconds,fps:null,mimeType:'audio/wav'}},
  ]);
}
test('Wan Lip finalization removes only generated trailing video and muxes the complete selected audio',async()=>{
  const prepared=wanLipPrepared(),actions:string[]=[];
  const result=await finalizeCreatorOperation('owner','job',prepared,{
    listOutputs:async()=>new Map([['job',[output]]]),
    resolve:async(_userId,ref)=>({id:'original',ref:ref as typeof source,kind:ref.kind,url:ref.type==='asset'?prepared.sources[1].url:output.url,mime:ref.kind==='audio'?'audio/wav':'video/mp4',thumbUrl:null,previewUrl:null,mediaFacts:undefined,originalAccess:{type:'external'}}),
    download:async file=>({bytes:Buffer.from(file.download_url===output.url?'provider':'complete-selected-audio'),mimeType:file.download_url===output.url?'video/mp4':'audio/wav',fileName:'source'}),
    inspect:async bytes=>Buffer.from(bytes).toString()==='provider'?{...facts,durationSec:3}:prepared.sources[1].facts,
    trimVideoTail:async(bytes,measured,target)=>{assert.equal(Buffer.from(bytes).toString(),'provider');assert.equal(measured.durationSec,3);assert.equal(target,2.53);actions.push('trim-video');return{bytes:Buffer.from('trimmed-video-only'),facts:{...facts,durationSec:2.533333,hasAudio:false,audioDurationSec:null,audioStartSec:null}};},
    mux:async(video,audio)=>{assert.equal(Buffer.from(video).toString(),'trimmed-video-only');assert.equal(Buffer.from(audio!).toString(),'complete-selected-audio');actions.push('mux-original-audio');return{bytes:Buffer.from('final'),facts:{...facts,durationSec:2.533333,audioDurationSec:2.53}};},
    persist:async(_userId,_bytes,_facts,lineage)=>{assert.deepEqual(lineage.outputTiming,{kind:'trim-generated-tail',generatedDurationSec:3});actions.push('persist');return{asset:{type:'asset',assetId:'ma_final',kind:'video'},url:'https://cdn.example.com/final.mp4',thumbnailUrl:null};},
  });
  assert.equal(result.outputs[0].durationSec,2.533333);assert.deepEqual(actions,['trim-video','mux-original-audio','persist']);
});
test('Wan tail policy rejects short, out-of-envelope and altered snapshots without publication or repair',async()=>{
  for(const [prepared,seconds] of [
    [wanLipPrepared(),2.5],[wanLipPrepared(),3.08],
    [{...wanLipPrepared(),outputTiming:undefined},3],
    [{...wanLipPrepared(),outputTiming:{kind:'trim-generated-tail' as const,generatedDurationSec:4}},3],
    [{...wanLipPrepared(),profile:{...wanLipPrepared().profile,id:'lip-photo-ltx-v1'}},3],
  ] as const){
    let effects=0;
    await assert.rejects(finalizeCreatorOperation('owner','job',prepared,{
      listOutputs:async()=>new Map([['job',[output]]]),
      resolve:async()=>({id:'original',ref:source,kind:'video',url:output.url,mime:'video/mp4',thumbUrl:null,previewUrl:null,mediaFacts:undefined,originalAccess:{type:'external'}}),
      download:async()=>({bytes:Buffer.from('provider'),mimeType:'video/mp4',fileName:'source'}),inspect:async()=>({...facts,durationSec:seconds}),
      trimVideoTail:async()=>{effects++;throw Error('must not run');},mux:async()=>{effects++;throw Error('must not run');},persist:async()=>{effects++;throw Error('must not run');},
    }),CreatorFinalizationError);
    assert.equal(effects,0);
  }
});

test('accepted legacy LTX snapshots retain strict duration validation without adopting the new Wan tail policy',async()=>{
  const legacy={...wanLipPrepared(),outputTiming:undefined,profile:{...wanLipPrepared().profile,id:'lip-photo-ltx-v1'},request:{...wanLipPrepared().request,engineId:'ltx-2-5-fast',mode:'a2v' as const}};
  let persisted=0;
  const result=await finalizeCreatorOperation('owner','job',legacy,{
    listOutputs:async()=>new Map([['job',[output]]]),
    resolve:async(_userId,ref)=>({id:'original',ref:ref as typeof source,kind:ref.kind,url:ref.type==='asset'?legacy.sources[1].url:output.url,mime:ref.kind==='audio'?'audio/wav':'video/mp4',thumbUrl:null,previewUrl:null,mediaFacts:undefined,originalAccess:{type:'external'}}),
    download:async file=>({bytes:Buffer.from(file.download_url===output.url?'legacy-video':'selected-audio'),mimeType:'video/mp4',fileName:'source'}),
    inspect:async bytes=>Buffer.from(bytes).toString()==='legacy-video'?{...facts,durationSec:2.533333}:legacy.sources[1].facts,
    trimVideoTail:async()=>{throw Error('Legacy outputs must not adopt a new policy');},
    mux:async()=>({bytes:Buffer.from('final'),facts:{...facts,durationSec:2.533333,audioDurationSec:2.53}}),
    persist:async()=>{persisted++;return{asset:{type:'asset',assetId:'ma_legacy',kind:'video'},url:'https://cdn.example.com/legacy-final.mp4',thumbnailUrl:null};},
  });
  assert.equal(persisted,1);assert.equal(result.outputs[0].originalUrl,'https://cdn.example.com/legacy-final.mp4');
});
