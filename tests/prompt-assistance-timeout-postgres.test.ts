import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import OpenAI from 'openai';
import {Client} from 'pg';
import {getDb} from '../frontend/src/lib/db';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './helpers/disposable-postgres';
import {sendPromptAssistance,recoverPromptAssistance} from '../frontend/src/server/prompt-assistance/service';
import {studioAssistancePolicy} from '../frontend/src/server/studio/assistance-policy';
import {promptAssistanceRequestSchema} from '../frontend/src/lib/prompt-assistance/contract';
import {readStudioAssistanceStatus,chooseStudioAssistance,settleStudioAssistanceCall} from '../frontend/src/server/studio/assistance-ledger';

test('unanswered composer calls release only customer holds and never redispatch or lock the account',async t=>{
  const pg=await startDisposablePostgres('milo-timeout'),old=process.env.DATABASE_URL;
  process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  for(const file of ['54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','85_prompt_assistance.sql','86_milo_three_levels.sql','87_milo_runtime_bounds.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
  const policy=studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'});
  const request=()=>promptAssistanceRequestSchema.parse({sessionId:randomUUID(),requestId:randomUUID(),draftRevision:2,locale:'en',message:'Slow the camera movement',draft:{surface:'video',engineId:'seedance-2-5',mode:'t2v',target:'prompt',text:'A dancer on stage.',settings:{durationSec:5},references:[]}});
  const context={model:{id:'seedance-2-5',label:'Seedance 2.5'},mode:'t2v',target:'prompt' as const,maxChars:20000,capabilities:{},guide:{},references:[],referencePerception:'metadata_only' as const};
  const deps={policy,buildContext:async()=>context as never,count:async()=>1000};
  const evidence=()=>({id:'resp_'+randomUUID(),model:'gpt-6.1-sol',status:'completed',service_tier:'default',output_text:JSON.stringify({kind:'replacement',reply:'Done',text:'A slow tracking shot.'}),usage:{input_tokens:1000,input_tokens_details:{cached_tokens:0},output_tokens:1000}} as never);
  const row=async(id:string)=>(await pg.pool.query('SELECT * FROM prompt_assistance_requests WHERE request_id=$1',[id])).rows[0];
  await t.test('timeout, repeat recovery and fresh message preserve supplier uncertainty',async()=>{
    const input=request();let calls=0;
    const timed={...deps,create:async()=>{calls++;throw new OpenAI.APIConnectionTimeoutError();}};
    const failed=await sendPromptAssistance('timeout-owner',input,timed);
    assert.equal(failed.state,'failed');assert.equal(failed.error,'REQUEST_UNANSWERED');
    assert.equal(failed.assistance.credits?.included.remaining,500);assert.equal(failed.assistance.unresolvedCalls,0);
    const saved=await row(input.requestId),call=(await pg.pool.query('SELECT * FROM studio_assistance_calls WHERE id=$1',[saved.call_id])).rows[0];
    assert.equal(call.state,'unknown');assert.equal(call.usage_facts,null);assert.equal(call.provider_max_nano_usd,null);assert.ok(Number(call.reserved_nano_usd)>0);
    assert.notEqual(saved.lease_id,call.lease_id);
    assert.equal(saved.context_json.providerFailure.kind,'timeout');
    await Promise.all([recoverPromptAssistance('timeout-owner',input.sessionId,input.requestId,policy),sendPromptAssistance('timeout-owner',input,timed)]);
    assert.equal(calls,1);assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_resolutions WHERE call_id=$1',[call.id])).rows[0].n,1);
    assert.equal((await sendPromptAssistance('timeout-owner',request(),{...deps,create:async()=>{calls++;return evidence();}})).state,'complete');
    assert.equal(calls,2);
  });
  await t.test('active lease and another user cannot release; expired recovery fences a late success',async()=>{
    const input=request();let release!:(value:ReturnType<typeof evidence>)=>void,started!:()=>void;
    const ready=new Promise<void>(resolve=>started=resolve);
    const running=sendPromptAssistance('lease-owner',input,{...deps,create:()=>{started();return new Promise(resolve=>release=resolve);}});
    await ready;
    assert.equal((await recoverPromptAssistance('other-owner',input.sessionId,input.requestId,policy)).error,'REQUEST_NOT_FOUND');
    assert.equal((await recoverPromptAssistance('lease-owner',input.sessionId,input.requestId,policy)).state,'pending');
    const original=await row(input.requestId);
    assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_resolutions WHERE call_id=$1',[original.call_id])).rows[0].n,0);
    await pg.pool.query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[input.requestId]);
    const closed=await recoverPromptAssistance('lease-owner',input.sessionId,input.requestId,policy);
    assert.equal(closed.state,'failed');assert.equal(closed.error,'REQUEST_UNANSWERED');
    release(evidence());assert.equal((await running).state,'failed');
    assert.ok((await row(input.requestId)).response_json,'Late evidence remains available for reconciliation');
    assert.equal((await pg.pool.query('SELECT state FROM studio_assistance_calls WHERE id=$1',[original.call_id])).rows[0].state,'settled');
    assert.equal((await readStudioAssistanceStatus('lease-owner',policy)).credits?.included.remaining,500);
  });
  await t.test('recorded evidence after lease expiry settles normally rather than being waived',async()=>{
    const input=request();
    const response=evidence();
    const result=await sendPromptAssistance('evidence-owner',input,{...deps,create:async()=>{
      await pg.pool.query("UPDATE prompt_assistance_requests SET response_json=$2::jsonb,lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[input.requestId,JSON.stringify(response)]);
      throw new Error('response persistence acknowledgement lost');
    }});
    assert.equal(result.state,'unknown');
    assert.equal((await recoverPromptAssistance('evidence-owner',input.sessionId,input.requestId,policy)).state,'complete');
    assert.equal((await readStudioAssistanceStatus('evidence-owner',policy)).credits?.included.remaining,470);
    assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_resolutions WHERE call_id=$1',[(await row(input.requestId)).call_id])).rows[0].n,0);
  });
  await t.test('purchased-only repeated failures release holds but stop before unbounded supplier exposure',async inner=>{
    await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES('paid-owner','topup',2000,'USD')");
    const status=await readStudioAssistanceStatus('paid-owner',policy);
    await chooseStudioAssistance('paid-owner',{action:'purchase_pack',amountCents:200,tariffVersion:status.tariff.version,expectedRevision:0,purchaseKey:randomUUID()},policy);
    await pg.pool.query("UPDATE studio_assistance_credit_lots SET consumed_credits=total_credits WHERE user_id='paid-owner' AND kind='included'");
    // A manual support waiver must not consume the automatic recovery cap.
    const manual=request();let rejectManual!:(error:Error)=>void,manualStarted!:()=>void;
    const ready=new Promise<void>(resolve=>manualStarted=resolve);
    const manualWork=sendPromptAssistance('paid-owner',manual,{...deps,create:()=>{manualStarted();return new Promise<never>((_resolve,reject)=>rejectManual=reject);}});
    await ready;const manualRow=await row(manual.requestId);
    await pg.pool.query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[manual.requestId]);
    const support=await import('../frontend/src/server/studio/assistance-resolution');
    const inspected=await support.inspectStudioAssistanceResolution(manualRow.call_id,'waive_unknown');
    await support.applyStudioAssistanceResolution({callId:manualRow.call_id,action:'waive_unknown',expectedFingerprint:inspected.fingerprint,operator:'test-support',reason:'Synthetic manual recovery'});
    rejectManual(new Error('transport lost'));await manualWork;
    let calls=0;
    const failing={...deps,create:async()=>{calls++;throw new OpenAI.APIConnectionTimeoutError();}};
    const originals=[];
    for(let index=0;index<3;index++){
      const input=request();originals.push(input);
      const failed=await sendPromptAssistance('paid-owner',input,failing);
      assert.equal(failed.error,'REQUEST_UNANSWERED');assert.equal(failed.assistance.credits?.purchased.remaining,2000);
    }
    await assert.rejects(sendPromptAssistance('paid-owner',request(),failing),/ASSISTANCE_RECOVERY_REQUIRED/);
    assert.equal(calls,3);
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM prompt_assistance_requests WHERE user_id='paid-owner'")).rows[0].n,4,'Rejected fourth automatic attempt creates no request or hold');
    const diagnostic=await import('../frontend/src/server/prompt-assistance/support-diagnostic');
    const blocked=await diagnostic.diagnoseComposerRecovery('paid-owner');
    assert.equal(blocked.blocked,true);assert.equal(blocked.unreconciledCount,3);
    assert.equal(blocked.calls.length,3);assert.ok(blocked.calls.every(call=>call.settlement==='evidence_unavailable'));
    const page1=await diagnostic.diagnoseComposerRecovery('paid-owner',{limit:2});
    const page2=await diagnostic.diagnoseComposerRecovery('paid-owner',{limit:2,cursor:page1.nextCursor!});
    assert.equal(page1.unreconciledCount,3);assert.equal(page2.unreconciledCount,3);
    assert.deepEqual([...page1.calls,...page2.calls].map(call=>call.callId).sort(),blocked.calls.map(call=>call.callId).sort());
    assert.equal(page2.nextCursor,null);
    await inner.test('diagnostic pagination remains bound to the exact account',async()=>{
      await assert.rejects(diagnostic.diagnoseComposerRecovery('other-owner',{cursor:page1.nextCursor!}),/cursor/i);
      await assert.rejects(diagnostic.diagnoseComposerRecovery(' paid-owner'));
      await assert.rejects(diagnostic.diagnoseComposerRecovery('paid-owner',{userId:'other-owner'} as never));
    });
    await inner.test('support diagnostic bounds concurrent evidence reads and preserves page order',async concurrencyTest=>{
      const financialSnapshot=async()=>Promise.all(['studio_assistance_calls','studio_assistance_accounts','studio_assistance_credit_lots','studio_assistance_credit_allocations','studio_assistance_resolutions','app_receipts','prompt_assistance_requests'].map(async table=>(await pg.pool.query(`SELECT to_jsonb(t) data FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows));
      const before=await financialSnapshot();
      const original=Client.prototype.query;
      let active=0,maximum=0;
      concurrencyTest.mock.method(Client.prototype,'query',function(this:Client,...args:unknown[]){
        if(typeof args[0]!=='string'||args[0]!=='SELECT * FROM studio_assistance_calls WHERE id=$1')return Reflect.apply(original,this,args);
        active++;maximum=Math.max(maximum,active);
        return new Promise<void>(resolve=>setImmediate(resolve)).then(()=>Reflect.apply(original,this,args)).finally(()=>active--);
      });
      const bounded=await diagnostic.diagnoseComposerRecovery('paid-owner',{limit:100});
      assert.deepEqual(bounded.calls.map(call=>call.callId),blocked.calls.map(call=>call.callId));
      assert.ok(maximum<=2,`Observed ${maximum} simultaneous evidence reads; support must retain DB capacity.`);
      assert.equal(active,0);
      assert.deepEqual(await financialSnapshot(),before,'Read-only diagnostic preserves financial evidence and request leases.');
    });
    await assert.rejects(diagnostic.diagnoseComposerRecovery('paid-owner',{limit:101}));
    assert.equal((await diagnostic.diagnoseComposerRecovery('other-owner')).unreconciledCount,0);
    const first=await row(originals[0].requestId);
    assert.equal((await sendPromptAssistance('paid-owner',originals[0],failing)).state,'failed');assert.equal(calls,3);
    assert.equal((await pg.pool.query('SELECT campaign_id FROM studio_assistance_calls WHERE id=$1',[first.call_id])).rows[0].campaign_id,null);
    await pg.pool.query('UPDATE prompt_assistance_requests SET response_json=$2::jsonb WHERE request_id=$1',[originals[1].requestId,JSON.stringify({id:'invalid',model:'gpt-6.1-sol'})]);
    const invalid=await row(originals[1].requestId);
    assert.equal((await diagnostic.diagnoseComposerRecovery('paid-owner')).calls.find(call=>call.callId===invalid.call_id)?.settlement,'evidence_unavailable');
    await pg.pool.query('UPDATE prompt_assistance_requests SET response_json=$2::jsonb WHERE request_id=$1',[originals[0].requestId,JSON.stringify(evidence())]);
    assert.equal((await diagnostic.diagnoseComposerRecovery('paid-owner')).calls.find(call=>call.callId===first.call_id)?.settlement,'ready');
    const preview=await support.inspectStudioAssistanceResolution(first.call_id,'settle_recorded');
    const approval={callId:first.call_id,action:'settle_recorded' as const,expectedFingerprint:preview.fingerprint,operator:'offline-support',reason:'Review recorded provider evidence'};
    await inner.test('a support settlement after page selection is reported explicitly',async raceTest=>{
      const original=Client.prototype.query;let settled=false;
      raceTest.mock.method(Client.prototype,'query',function(this:Client,...args:unknown[]){
        const result=Reflect.apply(original,this,args);
        if(typeof args[0]!=='string'||!args[0].startsWith('WITH scoped AS'))return result;
        return Promise.resolve(result).then(async page=>{
          assert.equal((await support.applyStudioAssistanceResolution(approval)).applied,true);
          settled=true;return page;
        });
      });
      const raced=await diagnostic.diagnoseComposerRecovery('paid-owner');
      assert.equal(settled,true);assert.equal(raced.unreconciledCount,3);
      assert.equal(raced.calls.find(call=>call.callId===first.call_id)?.settlement,'already_settled');
    });
    assert.equal((await support.applyStudioAssistanceResolution(approval)).applied,false);
    const late=await recoverPromptAssistance('paid-owner',originals[0].sessionId,originals[0].requestId,policy);
    assert.equal(late.state,'failed');assert.equal(late.reply,undefined);assert.equal(late.assistance.credits?.purchased.remaining,2000);
    assert.equal((await diagnostic.diagnoseComposerRecovery('paid-owner')).unreconciledCount,2);
    const last=await row(originals[2].requestId),lateEvidence=evidence();
    await pg.pool.query('UPDATE prompt_assistance_requests SET response_json=$2::jsonb WHERE request_id=$1',[originals[2].requestId,JSON.stringify(lateEvidence)]);
    await inner.test('normal late settlement after page selection never advertises ready',async raceTest=>{
      const original=Client.prototype.query;let settled=false;
      raceTest.mock.method(Client.prototype,'query',function(this:Client,...args:unknown[]){
        const result=Reflect.apply(original,this,args);
        if(typeof args[0]!=='string'||!args[0].startsWith('WITH scoped AS'))return result;
        return Promise.resolve(result).then(async page=>{
          assert.equal(await settleStudioAssistanceCall(last.call_id,'paid-owner',lateEvidence),true);
          settled=true;return page;
        });
      });
      const raced=await diagnostic.diagnoseComposerRecovery('paid-owner');
      assert.equal(settled,true);assert.equal(raced.unreconciledCount,2);
      assert.equal(raced.calls.find(call=>call.callId===last.call_id)?.settlement,'already_settled');
    });
    assert.equal((await diagnostic.diagnoseComposerRecovery('paid-owner')).unreconciledCount,1);
    assert.equal((await readStudioAssistanceStatus('paid-owner',policy)).credits?.purchased.remaining,2000);
    assert.equal((await sendPromptAssistance('paid-owner',request(),{...deps,create:async()=>evidence()})).state,'complete');
  });
  await t.test('preparation consumes the creation budget and expired preparation never reserves',async inner=>{
    const originalNow=Date.now,base=originalNow();let elapsed=0;
    inner.mock.method(Date,'now',()=>base+elapsed);
    let timeout=0;
    await sendPromptAssistance('budget-owner',request(),{...deps,buildContext:async()=>{elapsed=40_000;return context as never;},create:async(_params,remaining)=>{timeout=remaining!;return evidence();}});
    assert.equal(timeout,50_000);
    elapsed=0;
    const expired=await sendPromptAssistance('expired-owner',request(),{...deps,buildContext:async()=>{elapsed=91_000;return context as never;},create:async()=>{throw Error('must not dispatch');}});
    assert.equal(expired.error,'REQUEST_DEADLINE');assert.equal(expired.safeToRetry,true);
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM studio_assistance_calls WHERE user_id='expired-owner'")).rows[0].n,0);
  });

  await t.test('a new chat closes an expired unanswered request in another chat',async()=>{
    const input=request();let release!:(value:ReturnType<typeof evidence>)=>void,started!:()=>void;
    const ready=new Promise<void>(resolve=>started=resolve);
    const running=sendPromptAssistance('cross-chat-owner',input,{...deps,create:()=>{started();return new Promise(resolve=>release=resolve);}});
    await ready;
    await pg.pool.query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[input.requestId]);
    const next=await sendPromptAssistance('cross-chat-owner',request(),{...deps,create:async()=>evidence()});
    assert.equal(next.state,'complete');assert.equal((await row(input.requestId)).state,'failed');
    release(evidence());assert.equal((await running).state,'failed');
  });
  await t.test('a reservation consuming the remaining budget rolls back before provider dispatch',async inner=>{
    const base=Date.now();let elapsed=0,timer:ReturnType<typeof setTimeout>|undefined,calls=0;
    inner.mock.method(Date,'now',()=>base+elapsed);
    await pg.pool.query(`CREATE FUNCTION delay_composer_reservation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.2); RETURN NEW; END $$;CREATE TRIGGER delay_composer_reservation BEFORE INSERT ON studio_assistance_calls FOR EACH ROW EXECUTE FUNCTION delay_composer_reservation()`);
    try{
      const result=await sendPromptAssistance('slow-reservation-owner',request(),{...deps,count:async()=>{timer=setTimeout(()=>elapsed=91_000,100);return 1000;},create:async()=>{calls++;return evidence();}});
      assert.equal(result.error,'REQUEST_DEADLINE');assert.equal(calls,0);
      assert.equal((await pg.pool.query("SELECT count(*)::int n FROM studio_assistance_calls WHERE user_id='slow-reservation-owner'")).rows[0].n,0);
      assert.equal(result.assistance.credits?.included.remaining,500);
    }finally{clearTimeout(timer);await pg.pool.query('DROP TRIGGER delay_composer_reservation ON studio_assistance_calls');}
  });

});
