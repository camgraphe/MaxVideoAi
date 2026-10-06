import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from '../frontend/node_modules/next/server';
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
