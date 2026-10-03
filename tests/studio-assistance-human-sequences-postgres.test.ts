import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {STUDIO_ASSISTANCE_TARIFF} from '../frontend/src/lib/studio/assistance-contract';
import {AgentApiError} from '../frontend/src/server/agent-api/errors';
import {chooseStudioAssistance,readStudioAssistanceStatus,settleStudioAssistanceCall} from '../frontend/src/server/studio/assistance-ledger';
import type {StudioAssistancePolicy} from '../frontend/src/server/studio/assistance-policy';
import type {StudioDirectorResponse,StudioResponseCreator} from '../frontend/src/server/studio/conversation-director';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';

const policy: StudioAssistancePolicy={enabled:true,solAllowanceNanoUsd:1_000_000_000,lunaAllowanceNanoUsd:250_000_000,campaignNanoUsd:100_000_000_000,maxAdditionalBudgetCents:2000};
const input=(message:string)=>({requestId:randomUUID(),message,references:[]});
const response=(model='gpt-6.1-sol'):StudioDirectorResponse=>({
  id:randomUUID(),model,status:'completed',service_tier:'default',
  usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50,output_tokens_details:{reasoning_tokens:0},total_tokens:150},
  output_text:JSON.stringify({reply:'A saved direction'}),output:[],
});
const remember=(model='gpt-6.1-sol'):StudioDirectorResponse=>({...response(model),output_text:'',output:[{
  type:'function_call',call_id:randomUUID(),name:'project_remember',arguments:JSON.stringify({revision:0,brief:'Warm light',decisions:[]}),
}]});
function barrier(){
  let entered!:()=>void,release!:()=>void;
  const reached=new Promise<void>(resolve=>{entered=resolve;});
  const released=new Promise<void>(resolve=>{release=resolve;});
  return {reached,release,async wait(){entered();await released;}};
}
const depleted=(reason:string,completed=0)=>(error:unknown)=>error instanceof AgentApiError
  && error.nextAction?.reason===reason && error.nextAction.safeToStartNewRequest===(completed===0)
  && error.nextAction.canStartFollowup===(completed>0) && error.nextAction.completedModelCalls===completed;
const unresolved=(error:unknown)=>error instanceof AgentApiError && error.nextAction?.reason==='usage_unresolved'
  && error.nextAction.safeToStartNewRequest===false && error.nextAction.canStartFollowup===false;

test('human assistance sequences preserve consent, money and completed work across reconnects', {timeout:60_000}, async t=>{
  const pg=await startDisposablePostgres('studio-human-money'),previous=process.env.DATABASE_URL;
  process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query('CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,deleted_at timestamptz);CREATE TABLE studio_sequences(id text PRIMARY KEY)');
  for(const file of ['50_studio_image_conversation.sql','51_studio_image_model_usage.sql','42_studio_connected_montages.sql','52_studio_conversation_runs.sql','54_studio_assistance_ledger.sql'])
    await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
  async function account(userId:string,balance=1000,currentPolicy=policy){
    const actor={userId,projectId:userId+'-film',authMethod:'studio-session' as const,clientId:null};
    await pg.pool.query("INSERT INTO studio_projects(id,user_id,name) VALUES($1,$2,'Simulation film')",[actor.projectId,userId]);
    if(balance)await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',$2,'USD')",[userId,balance]);
    let counts=0,dispatches=0;
    const models:string[]=[];
    const service=(create:StudioResponseCreator,count?:()=>Promise<number>)=>createImageConversationService(actor,{
      enabled:true,actionsEnabled:true,assistancePolicy:currentPolicy,
      countInputTokens:async()=>{counts++;return count?count():1000;},
      createActionResponse:async params=>{dispatches++;models.push(params.model);return create(params);},
    });
    const authorize=(expectedRevision:number,budgetCents=100)=>chooseStudioAssistance(userId,{action:'authorize_paid',budgetCents,tariffVersion:STUDIO_ASSISTANCE_TARIFF.version,expectedRevision},currentPolicy);
    const choose=(action:'select_luna'|'select_sol'|'disable_paid',expectedRevision:number)=>chooseStudioAssistance(userId,{action,expectedRevision},currentPolicy);
    const ledger=async()=>{
      const receipts=(await pg.pool.query(`SELECT COALESCE(sum(CASE WHEN type='charge' THEN -amount_cents ELSE amount_cents END),0)::int balance,
        COALESCE(sum(amount_cents) FILTER(WHERE type='charge'),0)::int charges,COALESCE(sum(amount_cents) FILTER(WHERE type='refund'),0)::int refunds
        FROM app_receipts WHERE user_id=$1`,[userId])).rows[0];
      const calls=(await pg.pool.query(`SELECT model,mode,state,reserved_cents,charged_cents,provider_min_nano_usd::text,provider_max_nano_usd::text FROM studio_assistance_calls WHERE user_id=$1 ORDER BY created_at`,[userId])).rows;
      const status=await readStudioAssistanceStatus(userId,currentPolicy);
      return {counts,dispatches,models:[...models],...receipts,paid:status.paid,unresolvedCalls:status.unresolvedCalls,calls};
    };
    const memory=async()=>(await pg.pool.query('SELECT revision::int,brief FROM studio_conversation_memory WHERE user_id=$1 AND project_id=$2',[userId,actor.projectId])).rows;
    const emptyDispatch=async()=>{
      for(const table of ['studio_assistance_calls','studio_conversation_responses','studio_conversation_steps'])
        assert.equal((await pg.pool.query(`SELECT count(*)::int n FROM ${table} WHERE user_id=$1`,[userId])).rows[0].n,0);
      assert.equal((await ledger()).charges,0);
      assert.equal(dispatches,0);
    };
    return {actor,service,authorize,choose,ledger,memory,emptyDispatch};
  }

  await t.test('double Send, reconnect and both model switches retain the in-flight model and charge once',async t=>{
    const user=await account('model-switch');
    await user.authorize(0);
    const sol=barrier(),luna=barrier();t.after(()=>{sol.release();luna.release();});
    let calls=0;
    const service=()=>user.service(async params=>{
      calls++;
      if(calls===1){await sol.wait();return remember(params.model);}
      if(calls===3)await luna.wait();
      return response(params.model);
    });
    const original=input('Remember warm light, then suggest a direction');
    const pending=service().submit(original);
    await sol.reached;
    assert.equal((await user.ledger()).paid.reservedCents,8);
    assert.equal((await service().submit(original)).state,'thinking');
    await assert.rejects(service().submit(input('Another tab sends too soon')),{code:'RATE_LIMITED'});
    assert.equal((await service().read()).turns[0].state,'thinking');
    await user.choose('select_luna',1);
    assert.equal((await user.ledger()).dispatches,1,'Changing assistance choice must not send a message');
    sol.release();assert.equal((await pending).state,'ready');
    assert.deepEqual(await user.memory(),[{revision:1,brief:'Warm light'}]);
    assert.equal((await service().submit(original)).reply,'A saved direction');
    await assert.rejects(service().submit({...original,message:'Changed intent under the same ID'}),{code:'PARAMETER_INVALID'});
    const next=input('Continue with Luna');
    const lunaPending=service().submit(next);await luna.reached;
    await user.choose('select_sol',2);
    assert.equal((await service().submit(next)).state,'thinking');
    luna.release();assert.equal((await lunaPending).state,'ready');
    assert.equal((await service().submit(input('Return to Sol'))).state,'ready');
    const result=await user.ledger();
    assert.deepEqual(result.models,['gpt-6.1-sol','gpt-6.1-sol','gpt-6-luna','gpt-6.1-sol']);
    assert.equal(result.counts,4);assert.equal(result.dispatches,4);
    assert.deepEqual(result.calls.map(call=>call.mode),['paid_sol','paid_sol','sponsored_luna','paid_sol']);
    assert.deepEqual(result.calls.map(call=>call.charged_cents),[1,0,0,1]);
    assert.equal(result.balance,998);assert.equal(result.paid.spentCents,2);assert.equal(result.paid.reservedCents,0);
    assert.equal((await service().read()).turns.length,3);assert.equal((await user.memory())[0].revision,1);
    t.diagnostic(JSON.stringify(result));
  });

  await t.test('authorize twice, then change mind during token counting blocks reservation and dispatch',async t=>{
    const user=await account('preflight-revoke');
    const choices=await Promise.allSettled([user.authorize(0),user.authorize(0)]);
    assert.equal(choices.filter(value=>value.status==='fulfilled').length,1);
    assert.equal(choices.filter(value=>value.status==='rejected' && value.reason.code==='PARAMETER_INVALID').length,1);
    assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_choices WHERE user_id=$1',[user.actor.userId])).rows[0].n,1);
    const counter=barrier();t.after(counter.release);
    const service=user.service(async params=>response(params.model),async()=>{await counter.wait();return 1000;});
    const pending=service.submit(input('Changed my mind before the answer starts'));
    const rejected=assert.rejects(pending,depleted('paid_budget_exhausted'));
    await counter.reached;await user.choose('disable_paid',1);counter.release();await rejected;
    await user.emptyDispatch();
    assert.equal((await service.read()).turns[0].state,'failed');
    const stopped=await user.ledger();assert.equal(stopped.balance,1000);assert.equal(stopped.paid.enabled,false);
    await user.authorize(2);
    assert.equal((await user.service(async params=>response(params.model)).submit(input('Now continue explicitly'))).state,'ready');
    const result=await user.ledger();assert.equal(result.dispatches,1);assert.equal(result.paid.spentCents,1);assert.equal(result.balance,999);
    t.diagnostic(JSON.stringify({stopped,result}));
  });

  await t.test('stopping a dispatched paid tool settles it, saves a partial reply and waits for explicit Luna follow-up',async t=>{
    const user=await account('tool-revoke');await user.authorize(0);
    const provider=barrier();t.after(provider.release);
    const service=()=>user.service(async params=>{await provider.wait();return remember(params.model);});
    const original=input('Remember warm light and propose the next scene');
    const pending=service().submit(original);
    const rejected=assert.rejects(pending,depleted('paid_budget_exhausted',1));
    await provider.reached;await user.choose('disable_paid',1);provider.release();await rejected;
    const partial=(await service().read()).turns[0];
    assert.equal(partial.state,'ready');assert.match(partial.reply!,/not finished/);
    assert.deepEqual(await user.memory(),[{revision:1,brief:'Warm light'}]);
    const stopped=await user.ledger();assert.equal(stopped.dispatches,1);assert.equal(stopped.paid.spentCents,1);assert.equal(stopped.paid.reservedCents,0);
    assert.equal((await service().submit(original)).reply,partial.reply);
    assert.equal((await user.ledger()).counts,2,'Retrying the saved partial cannot count tokens again');
    await user.choose('select_luna',2);
    assert.equal((await user.ledger()).dispatches,1);
    const followup=user.service(async params=>{
      assert.equal(params.model,'gpt-6-luna');
      assert.match(JSON.stringify(params.input),/not finished/,'Explicit follow-up retains the visible partial history');
      return response(params.model);
    });
    assert.equal((await followup.submit(input('Continue from the saved brief without repeating it'))).state,'ready');
    const result=await user.ledger();assert.equal(result.dispatches,2);assert.equal(result.balance,999);assert.equal(result.paid.enabled,false);
    assert.equal((await user.memory())[0].revision,1);
    t.diagnostic(JSON.stringify({stopped,result}));
  });

  await t.test('exhausted included Sol and an unfunded paid budget require explicit choices without phantom charges',async t=>{
    const user=await account('unfunded-recovery',0,{...policy,solAllowanceNanoUsd:0});
    const service=()=>user.service(async params=>response(params.model));
    await assert.rejects(service().submit(input('Plan a film')),depleted('included_exhausted'));
    await user.authorize(0);
    await assert.rejects(service().submit(input('Continue using the paid budget')),depleted('wallet_insufficient'));
    await user.emptyDispatch();
    const blocked=await user.ledger();assert.equal(blocked.balance,0);assert.equal(blocked.paid.spentCents,0);assert.equal(blocked.paid.reservedCents,0);
    await user.choose('select_luna',1);
    assert.equal((await service().submit(input('Continue with included Luna'))).state,'ready');
    await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',100,'USD')",[user.actor.userId]);
    assert.equal((await readStudioAssistanceStatus(user.actor.userId,policy)).mode,'sponsored_luna','Funding never chooses a model or sends a message');
    assert.equal((await user.ledger()).dispatches,1);
    await user.authorize(2);
    assert.equal((await service().submit(input('Now use Sol with the funded budget'))).state,'ready');
    const result=await user.ledger();assert.deepEqual(result.models,['gpt-6-luna','gpt-6.1-sol']);
    assert.equal(result.dispatches,2);assert.equal(result.balance,99);assert.equal(result.paid.spentCents,1);
    t.diagnostic(JSON.stringify({blocked,result}));
  });

  await t.test('revocation and reconnect never erase unknown holds; authoritative settlement replays the saved action once',async t=>{
    const user=await account('unknown-recovery');await user.authorize(0);
    const saved=remember();
    const service=()=>user.service(async()=>({...saved,usage:null}));
    const original=input('Remember warm light while the provider usage is unavailable');
    await assert.rejects(service().submit(original),unresolved);
    assert.deepEqual(await user.memory(),[],'Unknown usage cannot execute the saved tool');
    await user.choose('disable_paid',1);
    await assert.rejects(user.authorize(2,7),/displayed range/,'An unknown eight-cent hold prevents lowering authorization to seven cents');
    const held=await user.ledger();assert.equal(held.balance,992);assert.equal(held.paid.reservedCents,8);assert.equal(held.paid.spentCents,0);assert.equal(held.unresolvedCalls,1);
    assert.equal((await service().read()).turns[0].state,'failed');
    await assert.rejects(service().submit(original),unresolved);
    assert.deepEqual(await user.ledger(),held,'Reconnect and retry neither refund nor redispatch unknown usage');
    const call=(await pg.pool.query('SELECT id FROM studio_assistance_calls WHERE user_id=$1',[user.actor.userId])).rows[0];
    assert.equal(await settleStudioAssistanceCall(call.id,user.actor.userId,saved),true);
    assert.equal(await settleStudioAssistanceCall(call.id,user.actor.userId,saved),true);
    await assert.rejects(service().submit(original),depleted('call_limit',1));
    assert.equal((await service().submit(original)).state,'ready');
    assert.deepEqual(await user.memory(),[{revision:1,brief:'Warm light'}]);
    const result=await user.ledger();assert.equal(result.counts,1);assert.equal(result.dispatches,1);
    assert.equal(result.balance,999);assert.equal(result.charges,8);assert.equal(result.refunds,7);
    assert.equal(result.paid.spentCents,1);assert.equal(result.paid.reservedCents,0);assert.equal(result.paid.enabled,false);assert.equal(result.unresolvedCalls,0);
    t.diagnostic(JSON.stringify({held,result}));
  });
});
