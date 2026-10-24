import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createFluxDraftRecoveryFetch, recoverOwnedFluxDraftCache } from '../frontend/server/flux-draft-cache-recovery';
import { withVideoExcerptSlot } from '../frontend/server/video-excerpts/media';
const origin={ownerId:'owner',jobId:'draft',outputId:'out',providerRequestId:'request',attemptId:9,endpoint:'blackforestlabs/flux-3/image-to-video/draft',outputUrl:'owned',outputSha256:'a'.repeat(64)};
test('terminal recovery transport binds exact GET endpoint/request, disables redirects, and bounds responses',async()=>{
 let calls=0;const base='https://queue.fal.run/blackforestlabs/flux-3/requests/request';
 const recover=createFluxDraftRecoveryFetch(origin,async(_,init)=>{calls++;assert.equal(init?.redirect,'error');assert.ok(init?.signal);return new Response('{}');});
 await recover(base);await recover(base+'/status?logs=0');
 for(const url of [base+'/cancel',base.replace('request','different'),base+'/status?logs=1'])await assert.rejects(()=>recover(url));
 await assert.rejects(()=>recover(base,{method:'POST'}));assert.equal(calls,2);
 const oversized=createFluxDraftRecoveryFetch(origin,async()=>new Response('x'.repeat(2*1024*1024+1)));
 await assert.rejects(()=>oversized(base));
});
function harness(data:any={video:{url:'https://v3.fal.media/v.mp4'},draft_cache:{url:'https://v3.fal.media/cache.bin'}}){
 const events:string[]=[];const facts={durationSec:20+1/24,fps:24,decodedFrameCount:481};
 const deps={origin:async()=>{events.push('origin');return origin;},client:()=>({queue:{status:async()=>{events.push('status');return {status:'COMPLETED',request_id:'request'};},result:async()=>{events.push('result');return{requestId:'request',data};}}}),read:async()=>{events.push('owned-read');return'owned';},download:async()=>{events.push('download');return{bytes:Buffer.from('x'),mimeType:'video/mp4'};},inspect:async()=>{events.push('decode');return{facts,sha256:origin.outputSha256,videoIdentity:'same',audioIdentity:'same'};},availability:async()=>{events.push('availability');},transaction:async(fn:any)=>{events.push('begin');const result=await fn({query:async()=>{events.push('lock');return[];}});events.push('commit');return result;},persist:async()=>{events.push('persist');}};
 return{events,deps};
}
test('recovery admits before I/O, verifies pair before short persistence transaction, and never submits',async()=>{
 const {events,deps}=harness();
 await withVideoExcerptSlot('owner',async()=>{await assert.rejects(()=>recoverOwnedFluxDraftCache({userId:'owner',sourceJobId:'draft'},deps as any),{code:'PREPARATION_BUSY'});assert.deepEqual(events,[]);});
 const result=await recoverOwnedFluxDraftCache({userId:'owner',sourceJobId:'draft'},deps as any);
 assert.equal(result.enhanceable,true);assert.equal(events.filter(e=>e==='decode').length,2);
 assert.deepEqual(events.slice(events.indexOf('begin')),['begin','lock','persist','commit']);
 assert.ok(events.indexOf('availability')<events.indexOf('begin'));assert.equal(JSON.stringify(result).includes('fal.media'),false);
});
test('missing cache and mismatched bytes cannot write or alter original success',async()=>{
 const missing=harness({video:{url:'https://v3.fal.media/v.mp4'},draft_cache:null});
 assert.deepEqual(await recoverOwnedFluxDraftCache({userId:'owner',sourceJobId:'draft'},missing.deps as any),{enhanceable:false,reason:'cache_missing'});
 assert.deepEqual(missing.events,['origin','status','result']);
 const mismatch=harness();mismatch.deps.inspect=async()=>({facts:{durationSec:10,fps:24,decodedFrameCount:241},sha256:'b'.repeat(64),videoIdentity:'same',audioIdentity:'same'});
 await assert.rejects(()=>recoverOwnedFluxDraftCache({userId:'owner',sourceJobId:'draft'},mismatch.deps as any));assert.equal(mismatch.events.includes('begin'),false);
});
test('Draft optional cache qualification follows all critical completion persistence and settlement',()=>{
 const source=readFileSync('frontend/server/fal-webhook-handler.ts','utf8');
 assert.ok(source.lastIndexOf('await recoverOwnedFluxDraftCache(')>source.lastIndexOf('if (forcedNoMediaFailure)'));
 assert.match(readFileSync('frontend/server/flux-draft-cache-store.ts','utf8'),/isTransactionQueryExecutor/);
});

import { NextRequest } from 'next/server';
import { createFluxDraftCacheRecoveryHandler } from '../frontend/server/flux-draft-cache-http';
test('explicit recovery authorizes owner and same origin and never exposes private provider errors',async()=>{
 let calls=0;let user:string|null='owner';
 const handler=createFluxDraftCacheRecoveryHandler({userId:async()=>user,recover:async(input)=>{calls++;assert.deepEqual(input,{userId:'owner',sourceJobId:'draft'});throw new Error('https://v3.fal.media/private-cache');}});
 const context={params:Promise.resolve({jobId:'draft'})};
 const request=(origin='https://maxvideoai.com')=>new NextRequest('https://maxvideoai.com/api/jobs/draft/draft-cache',{method:'POST',headers:{origin}});
 assert.equal((await handler(request('https://foreign.example'),context)).status,403);assert.equal(calls,0);
 user=null;assert.equal((await handler(request(),context)).status,401);assert.equal(calls,0);
 user='owner';const response=await handler(request(),context);assert.equal(response.status,409);assert.equal(calls,1);assert.equal((await response.text()).includes('fal.media'),false);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
});

test('exact bounded status/result association permits absent SDK response header but rejects a conflicting request ID',async()=>{
 for(const requestId of ['', 'other']) {
  const {events,deps}=harness();const original=deps.client;
  deps.client=()=>{const client=original();const result=client.queue.result;client.queue.result=async()=>({...await result(),requestId});return client;};
  if(requestId==='')assert.equal((await recoverOwnedFluxDraftCache({userId:'owner',sourceJobId:'draft'},deps as any)).enhanceable,true);
  else {await assert.rejects(()=>recoverOwnedFluxDraftCache({userId:'owner',sourceJobId:'draft'},deps as any));assert.equal(events.includes('begin'),false);}
 }
});
