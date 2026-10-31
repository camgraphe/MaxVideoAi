import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {getDb} from '../frontend/src/lib/db';
import {promptAssistanceRequestSchema} from '../frontend/src/lib/prompt-assistance/contract';
import {sendPromptAssistance,recoverPromptAssistance} from '../frontend/src/server/prompt-assistance/service';
import {readPromptSession} from '../frontend/src/server/prompt-assistance/sessions';
import {buildPromptAssistanceContext} from '../frontend/src/server/prompt-assistance/context';
import {createAgentModelCatalogDeps} from '../frontend/src/server/agent-api/model-catalog';
import {getBaseEngines} from '../frontend/src/lib/engines';
import {chooseStudioAssistance} from '../frontend/src/server/studio/assistance-ledger';
import {studioAssistancePolicy} from '../frontend/src/server/studio/assistance-policy';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './helpers/disposable-postgres';

const plan='External editing plan, 60 seconds.\n00–10: choose rehearsal close-ups.\n10–50: build rhythm from your footage.\n50–60: hold on the performers. Keep the audience out of frame.';
const catalog={...createAgentModelCatalogDeps(),listEngines:async()=>getBaseEngines(),isModeExecutable:()=>true,isEngineExecutable:()=>true};
const request=()=>promptAssistanceRequestSchema.parse({sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'en',message:'Keep our real rehearsal footage. Give me an external editing plan rather than a generation.',draft:{surface:'video',workflow:'create',engineId:'wan-3-prime',mode:'t2v',target:'prompt',text:'Keep my manual draft.',settings:{durationSec:6,aspectRatio:'16:9',audio:false},references:[]}});
const evidence=(output:unknown)=>({id:'resp_'+randomUUID(),model:'gpt-6-luna',status:'completed',service_tier:'default',output_text:JSON.stringify(output),usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:100}} as never);

test('provider destination is frozen before dispatch; conversation output never becomes a replacement',async t=>{
 const pg=await startDisposablePostgres('milo-reply-boundary'),previous=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
 t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
 await createPaidGenerationTestSchema(pg.pool);
 for(const file of ['54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','85_prompt_assistance.sql','86_milo_three_levels.sql','87_milo_runtime_bounds.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
 const policy=studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'});
 const deps={policy,buildContext:async(userId:string,input:ReturnType<typeof request>)=>buildPromptAssistanceContext(userId,input,{catalog}),count:async()=>100};
 const row=async(id:string)=>(await pg.pool.query('SELECT * FROM prompt_assistance_requests WHERE request_id=$1',[id])).rows[0];
 const owner=async()=>{const id=randomUUID();await chooseStudioAssistance(id,{action:'select_luna',expectedRevision:0},policy);return id;};
 await t.test('full advice is readable in result and JSONB session restore without a proposal',async()=>{
  const userId=await owner(),input=request();let creates=0;
  const result=await sendPromptAssistance(userId,input,{...deps,create:async()=>{creates++;return evidence({kind:'conversation',reply:plan,text:null});}});
  assert.equal(result.state,'complete',JSON.stringify(result));assert.deepEqual(result.reply,{reply:plan,text:null});
  const snapshot=await readPromptSession(userId,input.sessionId,'video:create');
  assert.equal(snapshot.turns[0].reply,plan);assert.equal(snapshot.proposal,null);
  assert.equal((await row(input.requestId)).reply_json.text,null);
  assert.deepEqual((await recoverPromptAssistance(userId,input.sessionId,input.requestId,policy)).reply,{reply:plan,text:null});assert.equal(creates,1);
 });
 await t.test('count and create use the same tagged format with its durable marker already calling',async()=>{
  const userId=await owner(),input=request();let counted:unknown,created:unknown,atDispatch:any;
  const result=await sendPromptAssistance(userId,input,{...deps,count:async params=>{counted=params;return 100;},create:async params=>{created=params;atDispatch=await row(input.requestId);return evidence({kind:'replacement',reply:'A single scene, several actions.',text:'A performer enters, sets down a chair, turns to a partner and smiles.'});}});
  assert.equal(result.state,'complete',JSON.stringify(result));assert.equal(counted,created);
  assert.equal(atDispatch.state,'calling');assert.ok(atDispatch.call_id);assert.equal(atDispatch.context_json.replyFormat,'destination-v1');
  const format=(counted as any).text.format;
  assert.equal(format.strict,true);assert.equal(format.schema.type,'object');assert.equal(format.schema.additionalProperties,false);
  assert.deepEqual(format.schema.required,['kind','reply','text']);assert.deepEqual(format.schema.properties.kind.enum,['conversation','replacement']);
  assert.equal(format.schema.anyOf,undefined);assert.equal(format.schema.if,undefined);
  assert.deepEqual(Object.keys(result.reply!).sort(),['reply','text'],'provider tag is not a public API field');
  assert.equal(result.reply?.text,'A performer enters, sets down a chair, turns to a partner and smiles.');
 });
 for(const [name,output] of [
  ['missing destination',{reply:'An untagged plan',text:plan}],
  ['unknown destination',{kind:'other',reply:plan,text:null}],
  ['advice with replacement text',{kind:'conversation',reply:'External plan',text:plan}],
  ['replacement without text',{kind:'replacement',reply:'Done',text:null}],
  ['empty replacement',{kind:'replacement',reply:'Done',text:'   '}],
  ['extra field',{kind:'conversation',reply:plan,text:null,apply:true}],
  ['overlong advice',{kind:'conversation',reply:'x'.repeat(6001),text:null}],
 ] as const)await t.test(name+' fails closed on newly dispatched calls',async()=>{
  const userId=await owner(),input=request();const result=await sendPromptAssistance(userId,input,{...deps,create:async()=>evidence(output)});
  assert.equal(result.state,'failed');assert.equal(result.error,'OUTPUT_INVALID');assert.equal(result.reply,undefined);
  assert.equal((await row(input.requestId)).reply_json,null);
 });
 await t.test('advice does not rewrite an earlier valid working suggestion',async()=>{
  const userId=await owner(),input=request(),proposed='A rehearsal scene. A performer enters, lifts a chair and bows.';
  await sendPromptAssistance(userId,input,{...deps,create:async()=>evidence({kind:'replacement',reply:'Your scene.',text:proposed})});
  await sendPromptAssistance(userId,{...input,requestId:randomUUID(),activeSuggestion:proposed},{...deps,create:async()=>evidence({kind:'conversation',reply:plan,text:null})});
  const snapshot=await readPromptSession(userId,input.sessionId,'video:create');assert.equal(snapshot.proposal?.text,proposed);assert.equal(snapshot.turns.at(-1)?.reply,plan);
 });
 for(const [name,marker,output,want] of [
  ['new recovery','destination-v1',{kind:'conversation',reply:plan,text:null},{reply:plan,text:null}],
  ['legacy recovery',undefined,{reply:'Historical reply.',text:'Historical complete replacement.'},{reply:'Historical reply.',text:'Historical complete replacement.'}],
  ['legacy clarification',undefined,{reply:'Historical question?',text:null},{reply:'Historical question?',text:null}],
  ['present null',null,{reply:'Must not guess legacy.',text:plan},null],
  ['unknown version','destination-v999',{reply:'Must not guess legacy.',text:plan},null],
  ['corrupt version',{version:'destination-v1'},{reply:'Must not guess legacy.',text:plan},null],
 ] as const)await t.test(name+' selects only the persisted decoder without redispatch',async()=>{
  const userId=await owner(),input=request();let release!:(value:never)=>void,started!:()=>void,creates=0;
  const ready=new Promise<void>(resolve=>started=resolve);
  const work=sendPromptAssistance(userId,input,{...deps,create:async()=>{creates++;started();return new Promise<never>(resolve=>release=resolve);}});
  await ready;
  // Simulate an already-dispatched historical/versioned row. No response exists yet.
  if(marker===undefined)await pg.pool.query("UPDATE prompt_assistance_requests SET context_json=context_json-'replyFormat' WHERE request_id=$1",[input.requestId]);
  else await pg.pool.query("UPDATE prompt_assistance_requests SET context_json=jsonb_set(context_json,'{replyFormat}',$2::jsonb) WHERE request_id=$1",[input.requestId,JSON.stringify(marker)]);
  const response=evidence(output);await pg.pool.query("UPDATE prompt_assistance_requests SET response_json=$2::jsonb,state='reported' WHERE request_id=$1",[input.requestId,JSON.stringify(response)]);
  const recovered=await recoverPromptAssistance(userId,input.sessionId,input.requestId,policy);
  try{
   if(want){assert.equal(recovered.state,'complete',JSON.stringify(recovered));assert.deepEqual(recovered.reply,want);}
   else{assert.equal(recovered.state,'failed');assert.equal(recovered.error,'OUTPUT_INVALID');assert.equal(recovered.reply,undefined);}
  }finally{release(response);await work;}
  assert.equal(creates,1);
 });
});
