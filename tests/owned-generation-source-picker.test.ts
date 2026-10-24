import assert from 'node:assert/strict';
import test from 'node:test';
import { listOwnedGenerationSources } from '../frontend/server/generations/owned-operation-sources';

test('owned source listing uses ready outputs even without a media asset and never exposes provider/cache IDs',async()=>{
 const sql:string[]=[];
 const executor={query:async(text:string)=>{sql.push(text);return [{recordId:'42',jobId:'owned',outputId:'output',label:'A portrait',createdAt:'2026-10-24',durationSec:5,cacheState:'prepare'}];}} as any;
 const seen:any[]=[];
 const deps={executor,luma:async(input:any)=>{seen.push(input);return {sourceJobId:'owned',sourceOutputIdentity:'output',providerGenerationId:'private-provider'} as any;},flux:async(input:any)=>{seen.push(input);return {jobId:'owned',outputId:'output',cacheUrl:'private-cache'} as any;}};
 for(const operation of ['luma-extend','flux-draft-enhance'] as const){
  const result=await listOwnedGenerationSources('owner',{operation},deps);
  assert.equal(result.sources[0].sourceJobId,'owned');assert.equal(result.sources[0].sourceOutputId,'output');
  assert.equal(JSON.stringify(result).includes('private-'),false);
 }
 assert.ok(sql.every(value=>value.includes('j.user_id=$1')&&value.includes('job_outputs')));
 assert.ok(sql.every(value=>!value.includes('JOIN media_assets')),'no media asset existence restriction');
 assert.ok(seen.every(value=>(value.actor?.userId??value.userId)==='owner'));
 await assert.rejects(listOwnedGenerationSources('',{operation:'luma-extend'},deps));
 await assert.rejects(listOwnedGenerationSources('owner',{operation:'kling-edit' as any},deps));
});

test('read-only Draft readiness distinguishes absent, raw and matching qualified provenance without cache IO',async()=>{
 const origin={ownerId:'owner',jobId:'draft',outputId:'output',providerRequestId:'private-request',attemptId:2,provenance:{kind:'provider_attempt' as const},endpoint:'draft-endpoint',outputUrl:'owned',outputSha256:'a'.repeat(64)};
 for(const [qualifiedSource,expected]of [[null,'prepare'],[{},'unavailable'],[{...origin,attemptId:1},'unavailable'],[{...origin,cacheUrl:'private-cache'},'ready']] as const){
  const executor={query:async()=>[{recordId:'1',jobId:'draft',outputId:'output',label:'Draft',createdAt:'2026-10-24',durationSec:5,cacheState:qualifiedSource?'ready':'prepare',qualifiedSource}]} as any;
  const page=await listOwnedGenerationSources('owner',{operation:'flux-draft-enhance'},{executor,flux:async()=>origin,luma:async()=>{throw new Error('Wrong lineage');}});
  assert.equal(page.sources[0].preparation,expected);assert.doesNotMatch(JSON.stringify(page),/private-|outputSha256/);
 }
});
