import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {validateStudioMediaRequest,type StudioMediaFactories} from '../frontend/src/server/studio/conversation-media-generation';
import type {StudioMediaIntent} from '../frontend/lib/studio/conversation-media-contract';
const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'project',clientId:null};
const source={type:'job-output' as const,jobId:'job-source',outputId:'job-source:video:0',kind:'video' as const};
const entry=getFalEngineById('luma-ray-3-2')!;
const factories={video:()=>({catalog:async()=>[{engine:entry.engine,surface:'video',publicModes:['extend'],modeCaps:{extend:entry.modes.find(m=>m.mode==='extend')!.ui}}]})} as unknown as StudioMediaFactories;
const action={action:'video.prepare',modelId:entry.id,mode:'extend',operation:'luma-extend',prompt:'Continue',source,settings:[],references:[]} as StudioMediaIntent;
const input={requestId:'request',message:'Continue this generation',references:[]};
const row={owner_id:'owner',source_job_id:'job-source',engine_id:entry.id,surface:'video',status:'completed',provider:'luma_agents_direct',provider_job_id:'private',attempt_id:9,attempt_provider:'luma_agents_direct',attempt_model:'ray-3.2',attempt_status:'completed',attempt_provider_job_id:'private',output_id:source.outputId,output_owner:'owner',output_status:'ready',original_url:'https://private.example/original',output_url:'https://private.example/original'};
test('Studio retains project-output lineage without library promotion or inferred continuation and revalidates materialization',async()=>{
  let available=true,reads=0,promotions=0;
  const dependencies={readProjectMedia:async()=>[{ref:source,name:'video output',durationSec:10}],
    resolveMedia:async()=>({id:source.outputId,ref:source,kind:'video',url:row.output_url,originalAccess:{type:'external'},mime:'video/mp4',mediaFacts:{source:'probe',durationSec:10}}) as never,
    saveOutput:async()=>{promotions++;throw new Error('no promotion');},
    lumaSourceExecutor:{query:async()=>{reads++;return (available?[row]:[]) as never;}}};
  const validated=await validateStudioMediaRequest(actor,action,input,factories,true,dependencies);
  assert.equal(validated.extensionOutput,undefined);
  const request=await validated.materialize();assert.equal(request.sourceJobId,'job-source');assert.equal(request.sourceOutputId,source.outputId);assert.deepEqual(request.references,[]);
  assert.equal(promotions,0);assert.equal(reads,2);
  available=false;await assert.rejects(validated.materialize(),/not available/);
  await assert.rejects(validateStudioMediaRequest(actor,action,input,factories,true,{...dependencies,readProjectMedia:async()=>[]}),/not a ready output/);
});
