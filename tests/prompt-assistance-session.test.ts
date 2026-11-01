import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {NextRequest} from 'next/server';
import {getDb} from '../frontend/src/lib/db';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './helpers/disposable-postgres';
import {promptAssistanceRequestSchema} from '../frontend/src/lib/prompt-assistance/contract';

test('workflow is explicit, validated and separate from the provider transport mode',async()=>{
 const base={sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'en',message:'Help',draft:{surface:'video',workflow:'create',engineId:'seedance-2-5',mode:'i2v',target:'prompt',text:'Old editor',settings:{},references:[]}};
 assert.equal(promptAssistanceRequestSchema.safeParse(base).success,true);
 assert.equal(promptAssistanceRequestSchema.safeParse({...base,draft:{...base.draft,workflow:'voiceover'}}).success,false);
 const {promptSessionScope,videoPromptWorkflow}=await import('../frontend/src/lib/prompt-assistance/session');
 assert.equal(promptSessionScope(base.draft),'video:create');
 for(const [mode,id,expected] of [[null,'seedance-2-5','create'],['v2v','luma-ray-3-2','modify'],['extend','seedance-2-5','extend'],['reframe','luma-ray-3-2','reframe'],['retake','ltx-2-3','retake'],['ref2v','flux-3-max','keyframes'],['ref2v','veo-3-1','references']] as const)assert.equal(videoPromptWorkflow(mode,id),expected);
 assert.equal(promptSessionScope({...base.draft,workflow:'modify',mode:'v2v'}),'video:modify');
 assert.equal(promptSessionScope({surface:'video',mode:'t2v'}),'video');
});

test('session restore is private, read-only, retains the working suggestion and extends expiry only once on success',async t=>{
 const pg=await startDisposablePostgres('milo-session');
 const old=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
 t.after(async()=>{await getDb().end();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;await pg.cleanup();});
 await createPaidGenerationTestSchema(pg.pool);
 for(const file of ['54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','85_prompt_assistance.sql','86_milo_three_levels.sql','87_milo_runtime_bounds.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
 const service=await import('../frontend/src/server/prompt-assistance/service');
 const sessions=await import('../frontend/src/server/prompt-assistance/sessions');
 const {studioAssistancePolicy}=await import('../frontend/src/server/studio/assistance-policy');
 const {chooseStudioAssistance}=await import('../frontend/src/server/studio/assistance-ledger');
 const policy=studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'});
 await chooseStudioAssistance('owner',{action:'select_luna',expectedRevision:0},policy);
 const request=promptAssistanceRequestSchema.parse({sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'fr',message:'A dog behind a car',draft:{surface:'video',workflow:'create',engineId:'seedance-2-5',mode:'t2v',target:'prompt',text:'Old parkour prompt',settings:{durationSec:5},references:[]}});
 let calls=0,proposal:string|null='A dog runs behind a car.';
 const deps={policy,buildContext:async()=>({model:{id:'seedance-2-5'},maxChars:20000,references:[],referencePerception:'metadata_only'} as never),count:async()=>100,create:async()=>{calls++;return {id:'resp_'+randomUUID(),model:'gpt-6-luna',status:'completed',service_tier:'default',output_text:JSON.stringify({kind:proposal?'replacement':'conversation',reply:'Voici le prompt.',text:proposal}),usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:100}} as never;}};
 await pg.pool.query("INSERT INTO prompt_assistance_sessions(user_id,id,scope,expires_at) VALUES('owner',$1,'video:create',clock_timestamp()+interval '1 hour')",[request.sessionId]);
 const first=await service.sendPromptAssistance('owner',request,deps);assert.equal(first.state,'complete',JSON.stringify(first));
 const expires=async()=>(await pg.pool.query('SELECT expires_at FROM prompt_assistance_sessions WHERE id=$1',[request.sessionId])).rows[0].expires_at.getTime();
 const completedExpiry=await expires();assert.ok(completedExpiry>Date.now()+23*3600000);
 const snapshot=await sessions.readPromptSession('owner',request.sessionId,'video:create');
 assert.equal(snapshot.turns.length,1);assert.equal(snapshot.proposal?.text,proposal);assert.match(snapshot.proposal!.draftFingerprint,/^[a-f0-9]{64}$/);
 assert.deepEqual(Object.keys(snapshot.turns[0]).sort(),['message','reply','requestId']);
 const serialized=JSON.stringify(snapshot);for(const privateField of ['input_json','context_json','response_json','credits','Old parkour prompt'])assert.ok(!serialized.includes(privateField));
 await service.recoverPromptAssistance('owner',request.sessionId,request.requestId,policy);assert.equal(await expires(),completedExpiry);assert.equal(calls,1);
 await assert.rejects(sessions.readPromptSession('other',request.sessionId,'video:create'),/SESSION_NOT_FOUND/);
 await assert.rejects(sessions.readPromptSession('owner',request.sessionId,'video:modify'),/SESSION_SCOPE_CHANGED/);
 await assert.rejects(service.sendPromptAssistance('owner',{...request,requestId:randomUUID(),draft:{...request.draft,workflow:'modify',mode:'v2v'}},deps),/SESSION_SCOPE_CHANGED/);
 proposal=null;
 await service.sendPromptAssistance('owner',{...request,requestId:randomUUID(),message:'Which part?',activeSuggestion:'A locally edited dog follows a car.'},deps);
 const clarified=await sessions.readPromptSession('owner',request.sessionId,'video:create');assert.equal(clarified.turns.length,2);assert.equal(clarified.proposal?.text,'A locally edited dog follows a car.');
 const beforeFailed=await expires();
 await service.sendPromptAssistance('owner',{...request,requestId:randomUUID()}, {...deps,buildContext:async()=>{throw Error('MODEL_UNAVAILABLE');}});assert.equal(await expires(),beforeFailed);
 await pg.pool.query("UPDATE prompt_assistance_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[request.sessionId]);
 assert.equal((await sessions.readPromptSession('owner',request.sessionId,'video:create')).status,'expired');
 assert.equal(calls,2);
 await pg.pool.query("UPDATE prompt_assistance_sessions SET expires_at=clock_timestamp()+interval '1 hour' WHERE id=$1",[request.sessionId]);
 const unresolved={...request,requestId:randomUUID()};
 let rejectPending!:(error:Error)=>void,startedPending!:()=>void;
 const pendingReady=new Promise<void>(resolve=>startedPending=resolve);
 const pendingWork=service.sendPromptAssistance('owner',unresolved,{...deps,create:()=>{startedPending();return new Promise<never>((_resolve,reject)=>rejectPending=reject);}});
 await pendingReady;
 const pending=await sessions.readPromptSession('owner',request.sessionId,'video:create');assert.equal(pending.pending?.requestId,unresolved.requestId);assert.equal(pending.turns.length,3);
 assert.deepEqual(pending.turns[2],{requestId:pending.turns[2].requestId,message:request.message,state:'failed',reply:null,error:'MODEL_UNAVAILABLE'});
 const {handlePromptAssistance}=await import('../frontend/src/server/prompt-assistance/route-handler');
 const response=await handlePromptAssistance(new NextRequest(`http://localhost/api/prompt-assistance?sessionId=${request.sessionId}&scope=video:create`),{enabled:true,access:async()=>({ok:true,userId:'owner'})});
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control')??'',/no-store/);assert.deepEqual((await response.json()).result,pending);
 const fullId=randomUUID();
 await pg.pool.query("INSERT INTO prompt_assistance_sessions(user_id,id,scope) VALUES('full-owner',$1,'video:create')",[fullId]);
 await pg.pool.query("INSERT INTO prompt_assistance_requests(user_id,session_id,request_id,input_hash,input_json,lease_id,state,model) SELECT 'full-owner',$1,gen_random_uuid(),'hash',$2::jsonb,gen_random_uuid(),'failed','gpt-6-luna' FROM generate_series(1,100)",[fullId,JSON.stringify(request)]);
 assert.equal((await sessions.readPromptSession('full-owner',fullId,'video:create')).status,'full');
 rejectPending(new Error('disconnected'));await pendingWork;
 assert.equal((await sessions.readPromptSession('owner',request.sessionId,'video:create')).pending,null,'An ended unanswered call is no longer restored as pending');
});

test('a failed long brief remains human context for a short follow-up and survives read-only restore',async t=>{
 const pg=await startDisposablePostgres('milo-failed-context'),old=process.env.DATABASE_URL;
 process.env.DATABASE_URL=pg.databaseUrl;
 t.after(async()=>{await getDb().end();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;await pg.cleanup();});
 await createPaidGenerationTestSchema(pg.pool);
 for(const file of ['54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','85_prompt_assistance.sql','86_milo_three_levels.sql','87_milo_runtime_bounds.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
 const {sendPromptAssistance}=await import('../frontend/src/server/prompt-assistance/service');
 const {readPromptSession}=await import('../frontend/src/server/prompt-assistance/sessions');
 const {readPromptHistory}=await import('../frontend/src/server/prompt-assistance/repository');
 const {studioAssistancePolicy}=await import('../frontend/src/server/studio/assistance-policy');
 const policy=studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'});
 const brief='Create a welcoming film for a coastal astronomy club visit. '+
   'Preserve the observatory setting, accessible transport, warm narration and a clear invitation. '.repeat(25).trim();
 const input=promptAssistanceRequestSchema.parse({sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'en',message:brief,
   draft:{surface:'video',workflow:'create',engineId:'seedance-2-5',mode:'t2v',target:'prompt',text:'An unrelated city sample.',settings:{durationSec:5},references:[]}});
 const base={policy,buildContext:async()=>({model:{id:'seedance-2-5'},maxChars:20000,references:[],referencePerception:'metadata_only'} as never),count:async()=>1000};
 const failed=await sendPromptAssistance('failed-context-owner',input,{...base,create:async()=>{throw Object.assign(new Error('Synthetic timeout'),{name:'TimeoutError'});}});
 assert.equal(failed.error,'REQUEST_UNANSWERED');
 let observed:any;
 const follow={...input,requestId:randomUUID(),message:'Also include a few reference photographs.'};
 const completed=await sendPromptAssistance('failed-context-owner',follow,{...base,create:async params=>{
   observed=params;
   return {id:'resp_'+randomUUID(),model:'gpt-6.1-sol',status:'completed',service_tier:'default',
     output_text:JSON.stringify({kind:'conversation',reply:'I can continue the observatory brief.',text:null}),
     usage:{input_tokens:1000,input_tokens_details:{cached_tokens:0},output_tokens:100}} as never;
 }});
 assert.equal(completed.state,'complete');
 const history=observed.input.slice(0,-1);
 assert.equal(history.length,1,'the unanswered request is retained without an invented assistant message');
 assert.equal(history[0].role,'user');
 assert.equal(JSON.parse(history[0].content).message,brief);
 assert.equal(JSON.parse(history[0].content).replyUnavailable,true);
 const snapshotBefore=async()=>JSON.stringify((await pg.pool.query(`SELECT
   (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM studio_assistance_calls c WHERE user_id='failed-context-owner') calls,
   (SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM studio_assistance_credit_lots l WHERE user_id='failed-context-owner') lots,
   (SELECT expires_at FROM prompt_assistance_sessions WHERE user_id='failed-context-owner' AND id=$1) expires`,[input.sessionId])).rows);
 const before=await snapshotBefore();
 const snapshot=await readPromptSession('failed-context-owner',input.sessionId,'video:create');
 assert.equal(snapshot.turns.length,2);
 assert.deepEqual(snapshot.turns[0],{requestId:input.requestId,message:brief,state:'failed',reply:null,error:'REQUEST_UNANSWERED'});
 assert.equal(snapshot.turns[1].reply,'I can continue the observatory brief.');
 assert.equal(await snapshotBefore(),before,'restoring failed user context does not touch financial evidence or session expiry');
 assert.deepEqual(await readPromptHistory({user_id:'another-owner',session_id:input.sessionId,request_id:randomUUID()} as never),[]);
 await assert.rejects(readPromptSession('another-owner',input.sessionId,'video:create'),/SESSION_NOT_FOUND/);
});
