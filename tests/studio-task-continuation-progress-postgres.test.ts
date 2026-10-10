import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {runStudioTaskWorkerOnce} from '../frontend/src/server/studio/tasks/worker';
import {stableJson} from '../frontend/src/server/agent-api/generation-normalization';
import {STUDIO_TASK_POLICY_VERSION} from '../frontend/src/lib/studio/task-budget-contract';
import type {ImageGenerationFactory} from '../frontend/src/server/studio/image-conversation-service';
import {readStudioTaskPreviousWork} from '../frontend/src/server/studio/tasks/previous-work';

test('a resumed worker carries failed comparison evidence and bounded model facts without private payloads',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input();
  await service.enqueue(input);
  const lease=randomUUID();
  await f.pool.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,draft_json,draft_reference_fingerprint,state,lease_id,lease_expires_at)
    VALUES($1,$2,$3,$4,$5::jsonb,'{"reply":"Work remains unfinished","image":null,"continuation":{"reason":"action_limit","completedEdits":0}}',$4,'ready',$6,now())`,[actor.userId,actor.projectId,input.requestId,'a'.repeat(64),JSON.stringify(input),lease]);
  const comparison={action:'pricing.compare',surface:'video',mode:'t2v',prompt:'Private authored script',settings:[{name:'durationSec',value:60}],references:[],baselineModelId:null,candidateModelIds:null,outputCount:1};
  const failure={ok:false,action:'pricing.compare',error:{code:'PARAMETER_INVALID',message:'No current model could be verified and priced for all these constraints and references. Keep the requirements; inspect live model details before suggesting a change.',retryable:false,nextAction:null}};
  const details={ok:true,action:'model.details',data:{modelId:'ltx-2-5-pro',surface:'video',modes:[{mode:'t2v',duration:{options:[6,8,10],range:null},durationPolicy:'requested',audio:'optional',resolutions:['720p','1080p'],aspectRatios:['16:9','9:16']}],privateProviderPayload:'must not enter history',storageUrl:'https://private.example/signed?token=secret'}};
  for(const [callId,action,result] of [['comparison',comparison,failure],['details',{action:'model.details',modelId:'ltx-2-5-pro'},details]] as const){
    await f.pool.query(`INSERT INTO studio_conversation_steps(user_id,project_id,request_id,call_id,lease_id,action_hash,action_json,observed_revision,state,result_json)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,0,'completed',$8::jsonb)`,[actor.userId,actor.projectId,input.requestId,callId,lease,createHash('sha256').update(stableJson(action)).digest('hex'),JSON.stringify(action),JSON.stringify(result)]);
  }
  await f.pool.query("UPDATE studio_tasks SET state='paused',phase='paused',error='steps' WHERE request_id=$1",[input.requestId]);
  await service.resume({requestId:input.requestId,approvalId:randomUUID(),expectedRevision:0,action:'continue',maxCredits:250,policyVersion:STUDIO_TASK_POLICY_VERSION,confirmed:true});
  const generationFactory=(()=>({resolveReferences:async()=>[],walletSummary:async()=>({balanceCents:0,currency:'USD'}),catalog:async()=>[],getQuote:async()=>null})) as unknown as ImageGenerationFactory;
  let calls=0;
  let recordedParams:any;
  await runStudioTaskWorkerOnce({enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async params=>{
    calls++;
    recordedParams=params;
    return {id:'useful-reply',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50},output_text:JSON.stringify({reply:'The full minute needs a multi-clip plan and scripted narration. No video was generated.'}),output:[]};
  }}});
  const data=(recordedParams.input as any[]).find(item=>item.role==='developer'&&item.content.startsWith('Current task data'));
  const prior=JSON.parse(data.content.slice(data.content.indexOf('{'))).previousWork;
  assert.equal(prior.find((item:any)=>item.action==='pricing.compare')?.result?.ok,false);
  assert.equal(prior.find((item:any)=>item.action==='pricing.compare')?.result?.error?.code,'PARAMETER_INVALID');
  assert.deepEqual(prior.find((item:any)=>item.action==='model.details')?.result?.data?.modes[0].duration,{options:[6,8,10],range:null});
  assert.doesNotMatch(JSON.stringify(prior),/Private authored script|privateProviderPayload|storageUrl|private\.example/);
  assert.equal(recordedParams.tool_choice,'auto','Continuation must retain useful montage actions.');
  assert.equal(prior.find((item:any)=>item.action==='pricing.compare')?.comparison?.settings[0].value,60);
  assert.equal(calls,1);
  assert.equal((await service.read(input.requestId)).state,'completed');
  assert.equal((await f.pool.query('SELECT count(*)::int count FROM studio_conversation_steps WHERE request_id<>$1',[input.requestId])).rows[0].count,0);
  assert.equal((await f.pool.query('SELECT count(*)::int count FROM mcp_generation_quotes')).rows[0].count,0);
});

test('comparison-only continuation retains bounded safe mode evidence and failure identities within its owned task',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),other=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input();
  await service.enqueue(input);
  const lease=randomUUID();
  await f.pool.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,state,lease_id,lease_expires_at)
    VALUES($1,$2,$3,$4,$5::jsonb,'thinking',$6,now()+interval '1 minute')`,[actor.userId,actor.projectId,input.requestId,'a'.repeat(64),JSON.stringify(input),lease]);
  const comparison={action:'pricing.compare',surface:'video',mode:'t2v',prompt:'Private authored script',settings:[{name:'durationSec',value:60},{name:'documentUrl',value:'https://private.example/signed?token=secret'}],references:[],baselineModelId:null,candidateModelIds:null,outputCount:1};
  const failure={ok:false,action:'pricing.compare',error:{code:'PARAMETER_INVALID',message:'This single clip duration is unsupported.',retryable:false,nextAction:{type:'generation_comparison',reason:'no_matching_scenario',requestedDurationSec:60,durationMismatch:true,catalogFingerprint:'b'.repeat(64),models:Array.from({length:8},(_,i)=>({modelId:'supported-model-'+i,mode:'t2v',duration:{options:i===1?Array.from({length:27},(_,n)=>n+4):[6,8,10],range:null},durationPolicy:'requested',audio:'optional',resolutions:['720p','1080p'],aspectRatios:['16:9'],privateProviderPayload:'must not enter history',storageUrl:'https://private.example/signed?token=secret'}))}}};
  for(let i=0;i<12;i++)await f.pool.query(`INSERT INTO studio_conversation_steps(user_id,project_id,request_id,call_id,lease_id,action_hash,action_json,observed_revision,state,result_json)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,0,'completed',$8::jsonb)`,[actor.userId,actor.projectId,input.requestId,'comparison-'+i,lease,createHash('sha256').update(stableJson(comparison)).digest('hex'),JSON.stringify(comparison),JSON.stringify(failure)]);
  const prior=await readStudioTaskPreviousWork(actor,input.requestId,randomUUID());
  assert.equal(prior.length,12);
  assert.deepEqual((prior[0].result as any).error.nextAction.models[0].duration,{options:[6,8,10],range:null});
  assert.ok((prior[0].result as any).error.nextAction.models[1].duration.options.includes(20));
  assert.ok((prior[0].result as any).error.nextAction.models[1].duration.options.includes(30));
  assert.doesNotMatch(JSON.stringify(prior),/Private authored script|documentUrl|privateProviderPayload|storageUrl|private\.example/);
  assert.ok(JSON.stringify(prior).length<=12000,'The total fact budget includes truncated entries and separators.');
  for(const work of prior){
    assert.match(work.comparisonFingerprint!,/^[a-f0-9]{64}$/,'A capped payload still retains its operational failure identity.');
    assert.equal((work.result as any).error.nextAction.durationMismatch,true);
    assert.equal((work.result as any).error.nextAction.catalogFingerprint,'b'.repeat(64));
  }
  assert.deepEqual(await readStudioTaskPreviousWork(other,input.requestId,randomUUID()),[]);
  assert.deepEqual(await readStudioTaskPreviousWork(actor,randomUUID(),randomUUID()),[]);
  await f.pool.query('UPDATE studio_projects SET deleted_at=now() WHERE id=$1',[actor.projectId]);
  assert.deepEqual(await readStudioTaskPreviousWork(actor,input.requestId,randomUUID()),[]);
});
