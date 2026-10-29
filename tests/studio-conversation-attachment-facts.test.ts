import assert from 'node:assert/strict';
import test from 'node:test';
import {AgentApiError} from '../frontend/src/server/agent-api/errors';
import type {StudioResolvedMedia} from '../frontend/src/server/studio/media-resolver';

const actor={userId:'owner',projectId:'project'};
const attachments=Array.from({length:13},(_,index)=>({type:'asset' as const,kind:'video' as const,assetId:'ma_'+index.toString(16).padStart(32,'0')}));
const measured={source:'probe' as const,durationSec:5.12,width:720,height:1280,hasAudio:true};
function media(index:number,known=false):StudioResolvedMedia {
  return {id:`row-${index}`,ref:attachments[index],kind:'video',url:`https://media.example/owned-${index}.mp4`,mime:'video/mp4',
    thumbUrl:null,previewUrl:null,mediaFacts:known?measured:undefined,originalAccess:{type:'external'},sizeBytes:4_630_982,
    durationSec:known?5.12:null,width:known?720:null,height:known?1280:null};
}
async function owner() {
  const module=await import('../frontend/src/server/studio/conversation-attachment-facts').catch(()=>null);
  assert.ok(module?.resolveStudioConversationAttachments,'Selected legacy video facts must be qualified before director/pricing.');
  return module.resolveStudioConversationAttachments;
}

test('selected missing video facts are measured once per original and canonical rereads feed the director',async()=>{
  const resolve=await owner();
  const sources=[media(0),media(1,true)];
  let qualified=0;
  const refs=await resolve(actor,[attachments[0],attachments[1],attachments[0]],{
    resolveMedia:async(userId,ref)=>{assert.equal(userId,'owner');return structuredClone(sources[attachments.findIndex(item=>item.assetId===(ref as typeof attachments[number]).assetId)]);},
    hydrateVideoFacts:async input=>{qualified++;assert.deepEqual(input,{userId:'owner',ref:attachments[0],expectedUrl:'https://media.example/owned-0.mp4'});sources[0]=media(0,true);return measured;},
  });
  assert.equal(qualified,1);
  assert.deepEqual(refs.map(ref=>[ref.assetId,ref.mediaKind,ref.durationSec,ref.width,ref.height]),
    [[attachments[0].assetId,'video',5.12,720,1280],[attachments[1].assetId,'video',5.12,720,1280],[attachments[0].assetId,'video',5.12,720,1280]]);
  assert.ok(refs.every(ref=>ref.originalName===null),'A missing historical filename is not invented or required.');
});

test('complete video facts, audio and historical replay do not trigger qualification',async()=>{
  const resolve=await owner();
  const audio={type:'asset' as const,kind:'audio' as const,assetId:'ma_'+'f'.repeat(32)};
  const fail=async()=>{throw new Error('No probe is needed.');};
  await resolve(actor,[attachments[0],audio],{hydrateVideoFacts:fail,resolveMedia:async(_userId,ref)=>ref===audio
    ? {...media(0),ref:audio,kind:'audio',mime:'audio/wav'}:media(0,true)});
  const replay=await resolve(actor,[attachments[0]],{qualifyMissingVideoFacts:false,hydrateVideoFacts:fail,resolveMedia:async()=>media(0)});
  assert.equal(replay[0].durationSec,null,'Recorded response recovery must retain its original reviewed facts.');
});

test('missing video qualification is bounded before probing and cannot loop on unpersisted facts',async()=>{
  const resolve=await owner();
  let probes=0;
  const options={resolveMedia:async(_owner:string,ref:unknown)=>media(attachments.findIndex(item=>item.assetId===(ref as typeof attachments[number]).assetId)),
    hydrateVideoFacts:async()=>{probes++;return measured;}};
  await assert.rejects(resolve(actor,attachments,options),error=>error instanceof AgentApiError&&error.code==='REFERENCE_INVALID');
  assert.equal(probes,0);
  await assert.rejects(resolve(actor,[attachments[0]],options),error=>error instanceof AgentApiError&&/verify.*saved video/i.test(error.message));
  assert.equal(probes,1,'An unsuccessful persistence read must stop after one attempt.');
});

test('all sources are authorized first and changed originals or ownership during qualification fail closed',async()=>{
  const resolve=await owner();
  let probes=0;
  await assert.rejects(resolve(actor,attachments.slice(0,2),{resolveMedia:async(_owner,ref)=>{
    if((ref as typeof attachments[number]).assetId===attachments[1].assetId)throw new Error('FOREIGN_SOURCE');return media(0);
  },hydrateVideoFacts:async()=>{probes++;return measured;}}));
  assert.equal(probes,0,'An unauthorized later reference must stop before any qualification.');
  for(const changed of ['original','owner'] as const){
    let didQualify=false;
    await assert.rejects(resolve(actor,[attachments[0]],{resolveMedia:async()=>{
      if(changed==='owner'&&didQualify)throw new Error('FOREIGN_SOURCE');
      return {...media(0,didQualify),...(changed==='original'&&didQualify?{url:'https://media.example/replacement.mp4'}:{})};
    },hydrateVideoFacts:async()=>{didQualify=true;return measured;}}),error=>error instanceof AgentApiError&&error.code==='REFERENCE_INVALID');
  }
});

test('probe failures stop before assistant work and expose neither private media grants nor raw commands',async()=>{
  const resolve=await owner();
  await assert.rejects(resolve(actor,[attachments[0]],{resolveMedia:async()=>media(0),hydrateVideoFacts:async()=>{
    throw new Error('ffprobe SECRET https://private.example/file?X-Amz-Signature=SECRET');
  }}),error=>{
    assert.ok(error instanceof AgentApiError);assert.equal(error.code,'REFERENCE_INVALID');
    assert.match(error.message,/verify.*saved video/i);
    assert.doesNotMatch(error.message,/SECRET|https:|ffprobe|re.upload/i);
    return true;
  });
});
