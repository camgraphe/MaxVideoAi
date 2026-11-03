import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {runStudioTaskWorkerOnce} from '../frontend/src/server/studio/tasks/worker';
import {studioTaskSchemaReady,studioTaskReplyEnvelopeReady} from '../frontend/src/server/studio/tasks/repository';
import {createImageConversationService,type ImageGenerationFactory} from '../frontend/src/server/studio/image-conversation-service';
import {chooseStudioAssistance,readStudioAssistanceStatus} from '../frontend/src/server/studio/assistance-ledger';
import type {StudioDirectorResponse,StudioResponseCreator} from '../frontend/src/server/studio/conversation-director';

const generationFactory=(()=>({resolveReferences:async()=>[],walletSummary:async()=>({balanceCents:0,currency:'USD'}),catalog:async()=>[],getQuote:async()=>null})) as unknown as ImageGenerationFactory;
const replyText=(length:number)=>'R'+'é'.repeat(length-2)+'Z';
const response=(reply:string,model='gpt-6.1-sol'):StudioDirectorResponse=>({id:'synthetic_'+randomUUID(),model,status:'completed',service_tier:'default',usage:{input_tokens:500,input_tokens_details:{cached_tokens:0},output_tokens:1000,output_tokens_details:{reasoning_tokens:0},total_tokens:1500},output_text:JSON.stringify({reply}),output:[]});
const brief='Propose a detailed visual sequence for a miniature train arriving at a coastal station.';

test('long Studio conversation replies complete once, restore exactly and retain full history within frozen budgets',async t=>{
 const f=await studioTaskFixture(t);
 for(const length of [2400,2401,6081,50000])await t.test(String(length)+' characters',async()=>{
  const actor=await f.actor();await chooseStudioAssistance(actor.userId,{action:'select_sol',expectedRevision:0},f.policy);
  const service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input('standard',brief),reply=replyText(length);
  const admitted=await service.enqueue(input);let creates=0,counts=0;
  const worker={enabled:true,assistancePolicy:f.policy,scope:{...actor,requestId:input.requestId},serviceOptions:{generationFactory,countInputTokens:async()=>{counts++;return 500;},createActionResponse:(async params=>{
   creates++;assert.equal(params.model,'gpt-6.1-sol');assert.equal(params.max_output_tokens,6000);assert.deepEqual(params.reasoning,{effort:'xhigh'});assert.equal(params.store,false);
   return response(reply,params.model);
  }) as StudioResponseCreator}};
  assert.equal(await runStudioTaskWorkerOnce(worker),true);
  const done=await service.read(input.requestId);assert.equal(done.state,'completed');assert.equal(done.completedCalls,1);assert.equal(done.maxCredits,admitted.maxCredits);assert.equal(done.allowedCalls,admitted.allowedCalls);assert.equal(done.consumedCredits,30);assert.equal(done.reservedCredits,0);
  const conversation=createImageConversationService(actor,{enabled:true,actionsEnabled:true,assistancePolicy:f.policy,generationFactory});
  const saved=(await conversation.read()).turns.find(turn=>turn.requestId===input.requestId)!;
  assert.equal(saved.reply,reply);assert.equal(saved.state,'ready');assert.equal(saved.retryable,false);assert.equal(saved.quote,null);
  const task=(await f.pool.query('SELECT partial_reply FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0];assert.equal(task.partial_reply,reply);
  assert.equal(await runStudioTaskWorkerOnce(worker),false);await service.enqueue(input);assert.equal(creates,1);assert.equal(counts,1);
  const settled=await readStudioAssistanceStatus(actor.userId,f.policy);
  assert.deepEqual(await service.read(input.requestId),done);assert.deepEqual(await readStudioAssistanceStatus(actor.userId,f.policy),settled);
  if(length===50000){
   const next=f.input('standard','Keep the final station reveal and develop its lighting.');await service.enqueue(next);
   await runStudioTaskWorkerOnce({...worker,scope:{...actor,requestId:next.requestId},serviceOptions:{...worker.serviceOptions,createActionResponse:async params=>{
    const history=(params.input as Array<{role?:string;content:unknown}>).filter(item=>item.role==='assistant');assert.equal(history.length,1);assert.equal(history[0].content,reply,'the next explicit turn retains the complete assistant reply');return response('A deliberate follow-up.',params.model!);
   }}});
   assert.equal((await service.read(next.requestId)).state,'completed');
  }
 });
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM app_jobs')).rows[0].n,0);assert.equal((await f.pool.query('SELECT count(*)::int n FROM mcp_generation_quotes')).rows[0].n,0);
});

test('a complete reply above the envelope produces one stable nonretryable limit notice without another purchase',async t=>{
 const f=await studioTaskFixture(t),actor=await f.actor();await chooseStudioAssistance(actor.userId,{action:'select_sol',expectedRevision:0},f.policy);
 const service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input('standard',brief),raw=response(replyText(50001));await service.enqueue(input);
 let creates=0,counts=0;
 const worker={enabled:true,assistancePolicy:f.policy,scope:{...actor,requestId:input.requestId},serviceOptions:{generationFactory,countInputTokens:async()=>{counts++;return 500;},createActionResponse:async()=>{creates++;return raw;}}};
 await runStudioTaskWorkerOnce(worker);
 const paused=await service.read(input.requestId);assert.equal(paused.state,'paused');assert.equal(paused.error,'output');assert.equal(paused.completedCalls,1);assert.equal(paused.consumedCredits,30);assert.equal(paused.reservedCredits,0);
 const conversation=createImageConversationService(actor,{enabled:true,actionsEnabled:true,assistancePolicy:f.policy,generationFactory});
 const turn=(await conversation.read()).turns[0];assert.equal(turn.retryable,false);assert.equal(turn.continuation?.reason,'output_limit');assert.equal(turn.continuation?.lastError?.code,'STUDIO_REPLY_TOO_LONG');assert.match(turn.reply!,/could not be delivered/i);assert.notEqual(turn.reply,JSON.parse(raw.output_text).reply);
 const evidence=(await f.pool.query('SELECT response_json FROM studio_conversation_responses WHERE request_id=$1',[input.requestId])).rows[0];assert.equal(evidence.response_json.output_text,raw.output_text,'raw supplier evidence is never shortened or rewritten');
 assert.equal(await runStudioTaskWorkerOnce(worker),false);assert.equal((await conversation.submit(input)).reply,turn.reply);
 await service.recover({requestId:input.requestId,action:'recover',confirmed:true,expectedRevision:paused.revision,policyVersion:paused.policyVersion});
 await runStudioTaskWorkerOnce(worker);assert.equal((await service.read(input.requestId)).state,'paused');assert.equal((await service.read(input.requestId)).error,'output');assert.equal((await conversation.read()).turns[0].reply,turn.reply);
 assert.equal(creates,1);assert.equal(counts,1);assert.equal((await service.read(input.requestId)).consumedCredits,30);
 const approval={requestId:input.requestId,approvalId:randomUUID(),expectedRevision:paused.revision,action:'continue',maxCredits:paused.maxCredits,policyVersion:paused.policyVersion,confirmed:true};
 await service.resume(approval);assert.equal(creates,1,'approving a new segment does not itself dispatch');
 await runStudioTaskWorkerOnce({...worker,serviceOptions:{...worker.serviceOptions,createActionResponse:async()=>{creates++;return response('A new explicitly approved answer.');}}});
 assert.equal((await service.read(input.requestId)).state,'completed');assert.equal(creates,2);assert.equal((await service.read(input.requestId)).maxCredits,paused.maxCredits);
});

test('a saved complete long reply replays after persistence failure without recounting or buying another response',async t=>{
 const f=await studioTaskFixture(t);
 for(const length of [50000,50001]){
  const actor=await f.actor();await chooseStudioAssistance(actor.userId,{action:'select_sol',expectedRevision:0},f.policy);
  const service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input('standard',brief),raw=response(replyText(length));await service.enqueue(input);
  let creates=0,counts=0;
  const worker={enabled:true,assistancePolicy:f.policy,scope:{...actor,requestId:input.requestId},serviceOptions:{generationFactory,countInputTokens:async()=>{counts++;return 500;},createActionResponse:async()=>{creates++;return raw;}}};
  await f.pool.query("CREATE FUNCTION reject_long_reply_ack() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.draft_json IS NOT NULL THEN RAISE EXCEPTION 'controlled draft persistence failure'; END IF; RETURN NEW; END; $$;CREATE TRIGGER reject_long_reply_ack BEFORE UPDATE ON studio_image_turns FOR EACH ROW EXECUTE FUNCTION reject_long_reply_ack()");
  await runStudioTaskWorkerOnce(worker);assert.equal((await service.read(input.requestId)).state,'queued');assert.equal((await service.read(input.requestId)).completedCalls,1);
  await f.pool.query('DROP TRIGGER reject_long_reply_ack ON studio_image_turns;DROP FUNCTION reject_long_reply_ack()');
  await runStudioTaskWorkerOnce(worker);assert.equal((await service.read(input.requestId)).state,length===50000?'completed':'paused');assert.equal(creates,1);assert.equal(counts,1);assert.equal((await service.read(input.requestId)).consumedCredits,30);
 }
});

test('missing reply-envelope migration blocks admission and queued worker dispatch before any spending',async t=>{
 const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input('standard',brief);await service.enqueue(input);
 await f.pool.query('ALTER TABLE studio_tasks DROP CONSTRAINT studio_tasks_reply_envelope_v1');
 assert.equal(await studioTaskSchemaReady(),true,'historical task ownership remains recognizable');assert.equal(await studioTaskReplyEnvelopeReady(),false);
 let creates=0,counts=0;
 assert.equal(await runStudioTaskWorkerOnce({enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>{counts++;return 500;},createActionResponse:async()=>{creates++;return response('Never dispatched.');}}}),false);
 await assert.rejects(service.enqueue(f.input('standard',brief)),/explicit Studio task migration/);assert.equal(creates,0);assert.equal(counts,0);assert.equal((await service.read(input.requestId)).completedCalls,0);
 const legacy=createImageConversationService(actor,{enabled:true,actionsEnabled:true,assistancePolicy:f.policy,generationFactory,countInputTokens:async()=>{counts++;return 500;},createActionResponse:async()=>{creates++;return response('Never dispatched.');}});
 await assert.rejects(legacy.submit(input),/queued or has another active worker/);assert.equal(creates,0);assert.equal(counts,0);
 for(let index=0;index<2;index++)await f.pool.query(readFileSync('neon/migrations/94_studio_conversation_reply_envelope.sql','utf8'));
 assert.equal(await studioTaskReplyEnvelopeReady(),true);
 await f.pool.query('ALTER TABLE studio_tasks ADD CONSTRAINT studio_tasks_partial_reply_check CHECK(length(partial_reply)<=2400)');
 assert.equal(await studioTaskReplyEnvelopeReady(),false,'the old restrictive check must not coexist with the new envelope marker');
 await f.pool.query('ALTER TABLE studio_tasks DROP CONSTRAINT studio_tasks_partial_reply_check;ALTER TABLE studio_tasks DROP CONSTRAINT studio_tasks_reply_envelope_v1;ALTER TABLE studio_tasks ADD CONSTRAINT studio_tasks_reply_envelope_v1 CHECK(length(partial_reply)<=2400)');
 assert.equal(await studioTaskReplyEnvelopeReady(),false,'a misleading marker name cannot authorize dispatch');
 await assert.rejects(f.pool.query(readFileSync('neon/migrations/94_studio_conversation_reply_envelope.sql','utf8')),/Unrecognized Studio reply constraint/);
});
