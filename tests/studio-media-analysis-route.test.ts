import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from '../frontend/node_modules/next/server';
import {STUDIO_ANALYSIS_PILOT_HEADER} from '../frontend/lib/studio/media-analysis-contract';
import {handleStudioAnalysis} from '../frontend/app/api/studio/_lib/studio-analysis-handler';

const access=async()=>({ok:true as const,userId:'owner'});
const id='f2929a29-91b4-4c81-a731-820d6d3d7102';
test('analysis status is a read-only authenticated operation and confirmation requires same origin',async()=>{
  let reads=0,confirms=0;
  const service={read:async()=>{reads++;return {state:'prepared'};},confirm:async()=>{confirms++;return {state:'queued'};},prepare:async()=>{throw new Error('Unexpected prepare');}};
  const dependencies={resolveAccess:access,serviceFactory:()=>service};
  const endpoint=`https://maxvideoai.com/api/studio/projects/film/analyses/${id}`;
  const read=await handleStudioAnalysis(new NextRequest(endpoint),'film','read',id,dependencies);
  assert.equal(read.status,200);assert.equal(reads,1);assert.equal(confirms,0);
  const cross=await handleStudioAnalysis(new NextRequest(endpoint,{method:'POST',headers:{origin:'https://foreign.example'},body:'{}'}),'film','confirm',id,dependencies);
  assert.equal(cross.status,403);assert.equal(confirms,0);
  const denied=await handleStudioAnalysis(new NextRequest(endpoint),'film','read',id,{...dependencies,resolveAccess:async()=>({ok:false as const,error:'AUTH_REQUIRED',status:401})});
  assert.equal(denied.status,401);assert.equal(reads,1);
});
test('confirmation rejects oversized and mismatched identities before mutation',async()=>{
  let confirms=0;
  const service={read:async()=>null,confirm:async()=>{confirms++;return {state:'queued'};},prepare:async()=>null};
  const endpoint=`https://maxvideoai.com/api/studio/projects/film/analyses/${id}`;
  const dependencies={resolveAccess:access,serviceFactory:()=>service};
  const headers={origin:'https://maxvideoai.com','content-type':'application/json'};
  const large=await handleStudioAnalysis(new NextRequest(endpoint,{method:'POST',headers,body:'x'.repeat(24_001)}),'film','confirm',id,dependencies);
  assert.equal(large.status,413);
  const mismatch=await handleStudioAnalysis(new NextRequest(endpoint,{method:'POST',headers,body:JSON.stringify({analysisId:'f2929a29-91b4-4c81-a731-820d6d3d7103',maxCredits:80,policyVersion:'v1',confirmed:true})}),'film','confirm',id,dependencies);
  assert.equal(mismatch.status,400);assert.equal(confirms,0);
});
test('only exact client confirmation schedules owned analysis; status reads never do',async()=>{
  const scheduled:unknown[]=[];
  const dependencies={resolveAccess:access,scheduleWorker:(...args:unknown[])=>{scheduled.push(args);},serviceFactory:()=>({read:async()=>({state:'queued'}),prepare:async()=>null,confirm:async()=>({analysisId:id,state:'queued'})})};
  const endpoint=`https://maxvideoai.com/api/studio/projects/film/analyses/${id}`;
  await handleStudioAnalysis(new NextRequest(endpoint),'film','read',id,dependencies);
  assert.equal(scheduled.length,0);
  const response=await handleStudioAnalysis(new NextRequest(endpoint,{method:'POST',headers:{origin:'https://maxvideoai.com'},body:JSON.stringify({analysisId:id,maxCredits:80,policyVersion:'v1',confirmed:true})}),'film','confirm',id,dependencies);
  assert.equal(response.status,200);
  assert.deepEqual(scheduled,[['analysis',{userId:'owner',projectId:'film',requestId:id}]]);
});

test('preparing a sponsored Studio analysis wakes the owned worker without a confirmation POST',async()=>{
  const scheduled:unknown[]=[];
  const dependencies={
    resolveAccess:access,
    scheduleWorker:(...args:unknown[])=>{scheduled.push(args);},
    serviceFactory:()=>({read:async()=>null,prepare:async()=>({analysisId:id,confirmationRequired:false,maxCredits:0}),confirm:async()=>{throw new Error('Unexpected confirmation');}}),
  };
  const response=await handleStudioAnalysis(new NextRequest('https://maxvideoai.com/api/studio/projects/film/analyses',{
    method:'POST',headers:{origin:'https://maxvideoai.com'},body:JSON.stringify({
      requestKey:id,request:{ref:{type:'asset',assetId:'ma_'+'a'.repeat(32),kind:'video'},goal:'Inspect the scene',reason:'requested',startSec:0,endSec:12},
    }),
  }),'film','prepare',undefined,dependencies);
  assert.equal(response.status,200);
  assert.deepEqual(scheduled,[['analysis',{userId:'owner',projectId:'film',requestId:id}]]);
});


test('the sponsored status can be reopened with the supported client and tells old tabs to refresh',async()=>{
  const quote={analysisId:id,confirmationRequired:false,maxCredits:0};
  const dependencies={resolveAccess:access,serviceFactory:()=>({read:async()=>({state:'queued',quote}),prepare:async()=>null,confirm:async()=>null})};
  const endpoint='https://maxvideoai.com/api/studio/projects/film/analyses/'+id;
  const oldTab=await handleStudioAnalysis(new NextRequest(endpoint),'film','read',id,dependencies);
  assert.equal(oldTab.status,409);
  assert.match((await oldTab.json()).message,/Refresh Studio/);
  const updated=await handleStudioAnalysis(new NextRequest(endpoint,{headers:{[STUDIO_ANALYSIS_PILOT_HEADER]:'1'}}),'film','read',id,dependencies);
  assert.equal(updated.status,200);
  assert.deepEqual((await updated.json()).result.quote,quote);
});
