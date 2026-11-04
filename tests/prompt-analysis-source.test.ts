import assert from 'node:assert/strict';
import test from 'node:test';
import {resolvePromptAnalysisSource,withinPromptAnalysisPreparation} from '../frontend/src/server/prompt-assistance/analysis-source';
import type {StudioResolvedMedia} from '../frontend/src/server/studio/media-resolver';

const ref={type:'job-output' as const,jobId:'job',outputId:'output',kind:'video' as const};
const media=(durationSec:number|null=null):StudioResolvedMedia=>({id:'output',ref,kind:'video',url:'https://media.test/original.mp4',mime:'video/mp4',thumbUrl:null,previewUrl:null,
  mediaFacts:durationSec?{source:'probe',durationSec,width:720,height:1280,hasAudio:true}:undefined,originalAccess:{type:'external'},durationSec,width:720,height:1280,sizeBytes:1000});

test('missing video duration requires persisted canonical facts, with exact original identity preserved',async()=>{
  let source=media(),probes=0;
  const result=await resolvePromptAnalysisSource('owner',ref,new AbortController().signal,{
    resolve:async()=>structuredClone(source),hydrate:async input=>{probes++;assert.equal(input.expectedUrl,source.url);assert.equal(input.userId,'owner');assert.equal(input.ref,ref);assert.ok(input.signal);source=media(6);return source.mediaFacts!;},
  });
  assert.equal(result.durationSec,6);assert.equal(probes,1);
  await resolvePromptAnalysisSource('owner',ref,new AbortController().signal,{resolve:async()=>result,hydrate:async()=>{throw Error('Known facts never probe');}});
  await assert.rejects(resolvePromptAnalysisSource('owner',ref,new AbortController().signal,{resolve:async()=>media(),hydrate:async()=>({source:'probe',durationSec:999,width:1,height:1,hasAudio:false})}),/REFERENCE_DURATION_UNKNOWN/);
});

test('foreign, replaced or hidden originals cannot bind a measured reference',async()=>{
  let probes=0;
  await assert.rejects(resolvePromptAnalysisSource('foreign',ref,new AbortController().signal,{resolve:async()=>{throw Error('MEDIA_NOT_AVAILABLE');},hydrate:async()=>{probes++;return {source:'probe'};}}));
  assert.equal(probes,0);
  for(const change of ['url','id','kind','mime','hidden'] as const){
    let qualified=false;
    await assert.rejects(resolvePromptAnalysisSource('owner',ref,new AbortController().signal,{
      resolve:async()=>{if(!qualified)return media();if(change==='hidden')throw Error('MEDIA_NOT_AVAILABLE');return {...media(6),[change]:change==='kind'?'audio':'changed'} as StudioResolvedMedia;},
      hydrate:async()=>{qualified=true;return {source:'probe',durationSec:6};},
    }));
  }
});

test('failed and aborted source qualification exposes no grant or late result',async()=>{
  const controller=new AbortController();
  await assert.rejects(resolvePromptAnalysisSource('owner',ref,controller.signal,{resolve:async()=>media(),hydrate:async()=>{controller.abort();return {source:'probe',durationSec:6};}}));
  await assert.rejects(resolvePromptAnalysisSource('owner',ref,new AbortController().signal,{resolve:async()=>media(),hydrate:async()=>{throw Error('ffprobe SECRET https://private.test?X-Amz-Signature=SECRET');}}),error=>{
    assert.equal((error as Error).message,'REFERENCE_DURATION_UNKNOWN');assert.doesNotMatch(String(error),/SECRET|https:|ffprobe/);return true;
  });
});

test('the single preparation deadline ends the HTTP wait even during an unfinished context read',async()=>{
  const controller=new AbortController();let release:(value:string)=>void=()=>{};
  const read=new Promise<string>(resolve=>{release=resolve;});
  const waiting=withinPromptAnalysisPreparation(async signal=>{assert.equal(signal,controller.signal);return read;},controller.signal);
  controller.abort();await assert.rejects(waiting,/REFERENCE_DURATION_UNKNOWN/);release('late result');
});
