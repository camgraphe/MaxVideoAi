import assert from 'node:assert/strict';
import test from 'node:test';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {runStudioTaskWorkerOnce} from '../frontend/src/server/studio/tasks/worker';
import type {ImageGenerationFactory} from '../frontend/src/server/studio/image-conversation-service';
import {createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import type {StudioMediaFactories} from '../frontend/src/server/studio/conversation-media-generation';
import {getFalEngineById} from '../frontend/src/config/falEngines';

test('a real queued Quick greeting completes durably with zero assistance calls, credits, reservations or wallet charges',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  const input=f.input('quick','HEY!');await service.enqueue(input);
  const generationFactory=(()=>({resolveReferences:async()=>[],catalog:async()=>[],getQuote:async()=>null})) as unknown as ImageGenerationFactory;
  await runStudioTaskWorkerOnce({enabled:true,assistancePolicy:f.policy,scope:{...actor,requestId:input.requestId},serviceOptions:{generationFactory,
    countInputTokens:async()=>{throw new Error('Greeting must not count paid input.');},createActionResponse:async()=>{throw new Error('Greeting must not dispatch.');}}});
  const task=await service.read(input.requestId);
  assert.equal(task.state,'completed');assert.equal(task.completedCalls,0);assert.equal(task.consumedCredits,0);assert.equal(task.reservedCredits,0);
  const turn=(await f.pool.query('SELECT state,draft_json FROM studio_image_turns WHERE request_id=$1',[input.requestId])).rows[0];
  assert.equal(turn.state,'ready');assert.match(turn.draft_json.reply,/What would you like/);
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_assistance_calls WHERE user_id=$1',[actor.userId])).rows[0].n,0);
  assert.equal((await f.pool.query("SELECT count(*)::int n FROM app_receipts WHERE user_id=$1 AND type='charge'",[actor.userId])).rows[0].n,0);
  assert.equal(await runStudioTaskWorkerOnce({enabled:true,assistancePolicy:f.policy,scope:{...actor,requestId:input.requestId}}),false,'Re-reading/completed wake-ups cannot dispatch.');
});

test('a Quick 100-second natural film saves complete alternatives after one paid call without a ceiling extension or media purchase',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  const input=f.input('quick','Create a 100-second - Mario Kart World - Knockout Tour Bambi Rally');await service.enqueue(input);
  const generationFactory=(()=>({resolveReferences:async()=>[],catalog:async()=>[],getQuote:async()=>null})) as unknown as ImageGenerationFactory;
  const factories={image:generationFactory,video:()=>createStudioVideoGenerationService(actor,{enabled:true,prepareDependencies:{
    listPublicEngines:async()=>['ltx-2-5-fast','seedance-2-5','gemini-omni-flash'].map(id=>{const entry=getFalEngineById(id)!;return {engine:entry.engine,surface:'video' as const,publicModes:entry.engine.modes,modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))};}),
    resolveMembershipPricing:async()=>({tier:'member',source:'app_receipts_rolling_30d',spent30Cents:0,thresholdCents:0,discountPercent:0}),
    resolveRequestExecutability:()=>({executable:true,reason:'available'}),priceGeneration:async(request,tier)=>{
      const duration=Number(request.settings.durationSec),amount=duration*7+3;return {priceCents:amount,currency:'USD',membershipTier:tier,pricingSnapshot:{totalCents:amount,currency:'USD',membershipTier:tier,meta:{output_duration_sec:duration}}};
    },getWalletSummary:async()=>{throw new Error('No wallet read for film planning.');},withTransaction:async()=>{throw new Error('No generation quote.');},
  }}),audio:()=>{throw new Error('No extra soundtrack discovery.');}} as unknown as StudioMediaFactories;
  let calls=0;
  await runStudioTaskWorkerOnce({enabled:true,assistancePolicy:f.policy,scope:{...actor,requestId:input.requestId},serviceOptions:{generationFactory,videoGenerationFactory:factories.video,audioGenerationFactory:factories.audio,mediaEnabled:true,
    countInputTokens:async()=>6800,createActionResponse:async()=>{assert.equal(calls++,0,'Never buy a follow-up to present the completed plan.');return {
      id:'film-response',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:{input_tokens:6800,input_tokens_details:{cached_tokens:0},output_tokens:100,output_tokens_details:{reasoning_tokens:0}},output_text:'',
      output:[{type:'function_call',name:'pricing_compare',call_id:'film-plan',arguments:JSON.stringify({surface:'video',mode:'t2v',prompt:'Bambi Rally race',settings:[],references:[],filmDurationSec:null,baselineModelId:null,candidateModelIds:null,outputCount:1})}],
    };}}});
  const task=await service.read(input.requestId);
  assert.equal(task.state,'completed');assert.equal(task.completedCalls,1);assert.equal(task.maxCredits,100);assert.equal(task.revision,0);assert.equal(task.reservedCredits,0);
  const draft=(await f.pool.query('SELECT draft_json FROM studio_image_turns WHERE request_id=$1',[input.requestId])).rows[0].draft_json;
  assert.match(draft.reply,/10 × 10 s/);assert.match(draft.reply,/5 × 20 s/);assert.match(draft.reply,/100-second/);assert.match(draft.reply,/total/);assert.equal(draft.continuation,undefined);
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM mcp_generation_quotes')).rows[0].n,0);
  assert.equal((await f.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM app_jobs')).rows[0].n,0);
  await service.read(input.requestId);assert.equal(calls,1,'Status/reload cannot repurchase the plan.');
});
