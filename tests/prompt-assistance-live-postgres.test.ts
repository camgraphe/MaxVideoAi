import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './helpers/disposable-postgres';

test('Composer conversations share real Milo credits, replay once and retain unknown usage', async t=>{
  const service=await import('../frontend/src/server/prompt-assistance/service').catch(()=>null);
  assert.ok(service,'The composer needs a durable real service');
  const pg=await startDisposablePostgres('milo-composer');
  const old=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  for(const file of ['54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','85_prompt_assistance.sql','86_milo_three_levels.sql','87_milo_runtime_bounds.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
  const {studioAssistancePolicy}=await import('../frontend/src/server/studio/assistance-policy');
  const {readStudioAssistanceStatus,chooseStudioAssistance}=await import('../frontend/src/server/studio/assistance-ledger');
  const {promptAssistanceRequestSchema}=await import('../frontend/src/lib/prompt-assistance/contract');
  const policy=studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'});
  const request=promptAssistanceRequestSchema.parse({sessionId:randomUUID(),requestId:randomUUID(),draftRevision:2,locale:'en',message:'Make the motion slower',draft:{surface:'video',engineId:'seedance-2-5',mode:'t2v',target:'prompt',text:'A dancer on a stage.',settings:{durationSec:5},references:[]}});
  let calls=0;
  const context={model:{id:'seedance-2-5',label:'Seedance 2.5'},mode:'t2v',target:'prompt' as const,maxChars:20000,capabilities:{},guide:{},references:[],referencePerception:'metadata_only' as const};
  const deps={policy,buildContext:async()=>context as never,count:async()=>1000,create:async(params:{model?:string|null})=>{calls++;return {id:'resp_'+randomUUID(),model:params.model!,status:'completed',service_tier:'default',output_text:JSON.stringify({reply:'I slowed the motion.',text:'A dancer moves slowly across the stage.'}),usage:{input_tokens:1000,input_tokens_details:{cached_tokens:0},output_tokens:1000}} as never;}};
  const abandoned={...request,requestId:randomUUID()};
  assert.equal((await service.recoverPromptAssistance('owner',abandoned.sessionId,abandoned.requestId,policy)).state,'failed');
  await assert.rejects(service.sendPromptAssistance('owner',abandoned,deps),/REQUEST_CLOSED/);
  assert.equal(calls,0,'A delayed original POST cannot start after recovery closed its absent identity');
  const results=await Promise.all([service.sendPromptAssistance('owner',request,deps),service.sendPromptAssistance('owner',request,deps)]);
  assert.equal(calls,1);
  assert.ok(results.some(r=>r.state==='complete'));
  const replay=await service.sendPromptAssistance('owner',request,deps);
  assert.equal(calls,1);assert.equal(replay.reply?.text,'A dancer moves slowly across the stage.');
  assert.equal(replay.draftRevision,2);
  assert.equal((await readStudioAssistanceStatus('owner',policy)).credits?.included.remaining,470);
  await assert.rejects(service.sendPromptAssistance('owner',{...request,message:'Different body'},deps),/REQUEST_CONFLICT/);
  await assert.rejects(service.readPromptAssistance('other',request.sessionId,request.requestId,policy),/NOT_FOUND/);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_calls')).rows[0].n,1);
  await chooseStudioAssistance('owner',{action:'select_luna',expectedRevision:0},policy);
  const luna=await service.sendPromptAssistance('owner',{...request,requestId:randomUUID()},deps);
  assert.equal(luna.assistance.selectedModel,'gpt-6-luna');
  assert.equal(luna.assistance.credits?.included.remaining,470);
  const unknownRequest={...request,requestId:randomUUID()};
  const unknown=await service.sendPromptAssistance('owner',unknownRequest,{...deps,create:async()=>{calls++;throw new Error('connection lost');}});
  assert.equal(unknown.state,'unknown');const callsAfterUnknown=calls;
  assert.equal((await service.sendPromptAssistance('owner',unknownRequest,deps)).state,'unknown');assert.equal(calls,callsAfterUnknown);
  await assert.rejects(service.sendPromptAssistance('owner',{...request,requestId:randomUUID()},deps),/REQUEST_PENDING/);
  const saved=(await pg.pool.query("SELECT * FROM prompt_assistance_requests WHERE request_id=$1",[unknownRequest.requestId])).rows[0];
  assert.ok(saved.call_id);assert.equal(saved.state,'unknown');
  assert.equal((await pg.pool.query('SELECT state FROM studio_assistance_calls WHERE id=$1',[saved.call_id])).rows[0].state,'unknown');
  const evidence={id:'resp_recovered',model:'gpt-6-luna',status:'completed',service_tier:'default',output_text:JSON.stringify({reply:'Recovered answer',text:'A slow camera move.'}),usage:{input_tokens:1000,input_tokens_details:{cached_tokens:0},output_tokens:100}};
  await pg.pool.query('UPDATE prompt_assistance_requests SET response_json=$2::jsonb WHERE request_id=$1',[unknownRequest.requestId,JSON.stringify(evidence)]);
  assert.equal((await service.sendPromptAssistance('owner',unknownRequest,deps)).state,'complete');
  assert.equal(calls,callsAfterUnknown,'Recorded usage must settle without another model call');
  const unusable=await service.sendPromptAssistance('malformed-owner',{...request,requestId:randomUUID()},{...deps,create:async(params)=>({...await deps.create(params),output_text:'not JSON'}) as never});
  assert.equal(unusable.state,'failed');assert.equal(unusable.error,'OUTPUT_INVALID');assert.equal(unusable.reply,undefined);
  assert.equal(unusable.assistance.credits?.included.remaining,470,'Known provider usage is charged even for unusable output');
  for (const [owner, responsePatch, expectedError] of [
    ['incomplete-owner', {status:'incomplete',incomplete_details:{reason:'max_output_tokens'}}, 'OUTPUT_INCOMPLETE'],
    ['refusal-owner', {output:[{type:'message',content:[{type:'refusal',refusal:'I cannot help with that request.'}]}]}, 'OUTPUT_REFUSED'],
    ['long-output-owner', {output_text:JSON.stringify({reply:'Done.',text:'x'.repeat(20001)})}, 'OUTPUT_TOO_LONG'],
  ] as const) {
    const rejectedRequest={...request,requestId:randomUUID()};
    const rejected=await service.sendPromptAssistance(owner,rejectedRequest,{...deps,create:async(params)=>({...await deps.create(params),...responsePatch}) as never});
    assert.equal(rejected.state,'failed');assert.equal(rejected.error,expectedError);assert.equal(rejected.reply,undefined,'No partial, refused or oversized proposal may be applied');
    assert.equal(rejected.assistance.credits?.included.remaining,470,'Known usage is settled even when no proposal is available');
    const countAfterRejection=calls;
    assert.equal((await service.sendPromptAssistance(owner,rejectedRequest,deps)).error,expectedError);
    assert.equal(calls,countAfterRejection,'An unusable reply never triggers an automatic retry');
  }
  const unavailable=await service.sendPromptAssistance('invalid-owner',{...request,requestId:randomUUID()},{...deps,buildContext:async()=>{throw new Error('MODEL_UNAVAILABLE');}});
  assert.equal(unavailable.state,'failed');assert.equal(unavailable.assistance.credits?.included.remaining,500);
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM studio_assistance_calls WHERE user_id='invalid-owner'")).rows[0].n,0);
  const lost=await service.sendPromptAssistance('support-owner',{...request,requestId:randomUUID()}, {...deps,create:async()=>{throw new Error('lost');}});
  const lostRow=(await pg.pool.query('SELECT * FROM prompt_assistance_requests WHERE request_id=$1',[lost.requestId])).rows[0];
  const support=await import('../frontend/src/server/studio/assistance-resolution');
  await assert.rejects(support.inspectStudioAssistanceResolution(lostRow.call_id,'waive_unknown'),/active lease/);
  const recovery=await import('../frontend/src/server/prompt-assistance/recovery');
  const call=(await pg.pool.query('SELECT * FROM studio_assistance_calls WHERE id=$1',[lostRow.call_id])).rows[0];
  await assert.rejects(recovery.closeComposerAssistanceRecovery(call,{query:async(text,params)=>(await pg.pool.query(text,params)).rows}),/changed before support closeout/);
  await pg.pool.query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp()-interval '1 minute' WHERE request_id=$1",[lost.requestId]);
  const inspection=await support.inspectStudioAssistanceResolution(lostRow.call_id,'waive_unknown');
  await support.applyStudioAssistanceResolution({callId:lostRow.call_id,action:'waive_unknown',expectedFingerprint:inspection.fingerprint,operator:'test',reason:'Confirmed transport loss'});
  await support.applyStudioAssistanceResolution({callId:lostRow.call_id,action:'waive_unknown',expectedFingerprint:inspection.fingerprint,operator:'test',reason:'Confirmed transport loss'});
  await pg.pool.query('UPDATE prompt_assistance_requests SET response_json=$2::jsonb WHERE request_id=$1',[lost.requestId,JSON.stringify({...evidence,id:'resp_late',model:'gpt-6.1-sol'})]);
  assert.equal((await service.sendPromptAssistance('support-owner',{...request,requestId:lost.requestId},deps)).state,'failed');
  assert.equal((await pg.pool.query('SELECT response_json FROM prompt_assistance_requests WHERE request_id=$1',[lost.requestId])).rows[0].response_json.id,'resp_late');
  assert.equal((await readStudioAssistanceStatus('support-owner',policy)).credits?.included.remaining,500);
});
