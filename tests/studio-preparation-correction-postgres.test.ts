import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {getDb} from '../frontend/src/lib/db';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createStudioCallRuntime} from '../scripts/qa/studio-call-runtime';
import type {AgentPublicGenerationEngine} from '../frontend/src/server/agent-api/model-catalog';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {createStudioImageGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {chooseStudioAssistance,readStudioAssistanceStatus} from '../frontend/src/server/studio/assistance-ledger';
import {STUDIO_ASSISTANCE_TARIFF} from '../frontend/src/lib/studio/assistance-contract';
import {AgentApiError} from '../frontend/src/server/agent-api/errors';
import type {StudioResponseCreator,StudioDirectorResponse} from '../frontend/src/server/studio/conversation-director';
import type {ImageDraft} from '../frontend/src/lib/studio/image-conversation-contract';

type StoredDraftRow={draft_json:ImageDraft|null;quote_id:string|null;state:string};

const usage={input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50,output_tokens_details:{reasoning_tokens:0},total_tokens:150};
function response(name:string,args:unknown,index:number):StudioDirectorResponse {
  return {id:'response-'+randomUUID(),model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage,output_text:'',output:[{
    type:'function_call',name,call_id:'prepare-'+index,arguments:JSON.stringify(args)}]};
}
function imageArgs(valid:boolean) {
  return {reply:'Review the landscape quote.',prompt:'Warm paper in sunlight',aspectRatio:'16:9',modelId:'gpt-image-2-5-flare',mode:'t2i',references:[],outputCount:1,
    settings:valid?[{name:'resolution',value:'1920x1080'}]:[{name:'resolution',value:'custom'},{name:'imageWidth',value:1920},{name:'imageHeight',value:1080}]};
}
function failureReceipt(params:Parameters<StudioResponseCreator>[0]) {
  assert.ok(Array.isArray(params.input));
  const output=params.input.filter(item=>typeof item!=='string'&&item.type==='function_call_output').at(-1);
  assert.ok(output&&typeof output.output==='string');
  return JSON.parse(output.output);
}

test('safe selection correction preserves durable receipts, ownership and monetary checkpoints',async t=>{
  const entry=getFalEngineById('gpt-image-2-5-flare')!;
  const video=getFalEngineById('wan-3')!;
  const catalog:AgentPublicGenerationEngine[]=[entry,video].map(item=>({engine:item.engine,surface:item.category==='image'?'image':'video',publicModes:item.modes.map(m=>m.mode) as AgentPublicGenerationEngine['publicModes'],modeCaps:Object.fromEntries(item.modes.map(m=>[m.mode,m.ui]))}));
  const runtime=await createStudioCallRuntime(catalog);
  t.after(()=>runtime.close());
  const stored=async(id:string)=>(await getDb().query<StoredDraftRow>('SELECT draft_json,quote_id,state FROM studio_image_turns WHERE project_id=$1 ORDER BY created_at DESC',[id])).rows[0];

  await t.test('invalid custom image selection is corrected before one quote and without persisting the invalid draft',async()=>{
  let calls=0;
  const ready=await runtime.submit('correct-custom','Prepare a 1920x1080 image.',[],async params=>{
    calls++;
    if(calls===2){assert.equal(failureReceipt(params).error.code,'PARAMETER_INVALID');assert.equal((await stored('correct-custom')).draft_json,null);}
    return response('image_prepare',imageArgs(calls===2),calls);
  });
  assert.equal(ready.error,undefined);
  assert.equal(calls,2);
  assert.equal(ready.quotes.length,1);
  assert.deepEqual(ready.counts,{jobs:0,charges:0});
  });

  await t.test('a provider voice ID is corrected to the public audio model ID',async()=>{
    let calls=0;
    const ready=await runtime.submit('correct-voice','Prepare an English voiceover.',[],async params=>{
      calls++;
      if(calls===2){assert.equal(failureReceipt(params).error.code,'ENGINE_UNAVAILABLE');assert.equal((await stored('correct-voice')).draft_json,null);}
      return response('voice_prepare',{reply:'Review the voice quote.',script:'Welcome to our workshop.',language:'english',modelId:calls===1?'fal-ai/seed-tts':'audio-voice-only',settings:[{name:'voiceModel',value:'seed'}],outputCount:1},calls);
    });
    assert.equal(ready.error,undefined);assert.equal(calls,2);assert.equal(ready.quotes.length,1);
    assert.equal(ready.quotes[0].request_json.engineId,'audio-voice-only');assert.deepEqual(ready.counts,{jobs:0,charges:0});
  });

  await t.test('video validates settings before persisting intent and accepts the corrected request',async()=>{
    let calls=0;
    const ready=await runtime.submit('correct-video','Prepare a five second video.',[],async params=>{
      calls++;
      if(calls===2){assert.equal(failureReceipt(params).error.code,'PARAMETER_INVALID');assert.equal((await stored('correct-video')).draft_json,null);}
      return response('video_prepare',{reply:'Review the video quote.',prompt:'Warm paper in sunlight',aspectRatio:'16:9',source:null,modelId:'wan-3',mode:'t2v',references:[],outputCount:1,
        settings:calls===1?[{name:'inventedSetting',value:true}]:[{name:'resolution',value:'720p'},{name:'durationSec',value:5}]},calls);
    });
    assert.equal(ready.error,undefined);assert.equal(calls,2);assert.equal(ready.quotes.length,1);assert.deepEqual(ready.counts,{jobs:0,charges:0});
  });

  await t.test('the fourth unbound asset selection ends with an honest continuation and no draft creation or quote',async()=>{
    const foreign=runtime.referenceId('correct-custom','watch');
    let calls=0;
    const ready=await runtime.submit('fourth-invalid-reference','Use the attached image.',['watch'],async()=>{
      calls++;
      if(calls<4)return response('catalog_read',{},calls);
      return response('image_prepare',{...imageArgs(true),mode:'i2i',references:[{ref:{type:'asset',kind:'image',assetId:foreign},role:'reference',slot:null}]},calls);
    });
    assert.equal(ready.error,undefined);assert.equal(calls,4);assert.equal(ready.quotes.length,0);
    assert.match(ready.result?.reply??'',/not.*finished|haven't verified/i);
    assert.match(ready.result?.reply??'',/Attach this library image/);
    const saved=await stored('fourth-invalid-reference');assert.equal(saved.state,'ready');assert.equal(saved.quote_id,null);assert.ok(saved.draft_json);assert.equal(saved.draft_json.image,null);
    assert.equal(ready.steps.at(-1)?.result.ok,false);assert.deepEqual(ready.counts,{jobs:0,charges:0});
  });

  // Seed one synthetic owner through the same isolated runtime, then exercise the real paid assistance gate.
  await runtime.submit('paid-recovery','Hello.',[],async()=>({...response('catalog_read',{},0),output:[],output_text:JSON.stringify({reply:'Ready.'})}));
  for(const migration of ['54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql'])
    await getDb().query(readFileSync('neon/migrations/'+migration,'utf8'));
  const owner=(await getDb().query<{user_id:string}>('SELECT user_id FROM studio_projects WHERE id=$1',['paid-recovery'])).rows[0].user_id;
  const actor={userId:owner,projectId:'paid-recovery',authMethod:'studio-session' as const,clientId:null};
  const policy={enabled:true,solAllowanceNanoUsd:1_000_000_000,lunaAllowanceNanoUsd:250_000_000,campaignNanoUsd:100_000_000_000,maxAdditionalBudgetCents:2000};
  await chooseStudioAssistance(owner,{action:'authorize_paid',budgetCents:100,tariffVersion:STUDIO_ASSISTANCE_TARIFF.version,expectedRevision:0},policy);
  const factory:typeof createStudioImageGenerationService=(current,options)=>createStudioImageGenerationService(current,{...options,
    prepareDependencies:{listPublicEngines:async()=>catalog,resolveRequestExecutability:()=>({executable:true,reason:'available'})},
    confirmDependencies:{submitPaidGeneration:async()=>{throw new Error('Media must not dispatch');}},
  });

  await t.test('interruption after a failed action receipt replays the paid response and purchases only the next response',async()=>{
    let dispatches=0,counts=0,interrupt=true;
    const input={requestId:randomUUID(),message:'Prepare a landscape image.',references:[]};
    const service=createImageConversationService(actor,{enabled:true,actionsEnabled:true,generationFactory:factory,assistancePolicy:policy,
      countInputTokens:async()=>{counts++;if(counts===2&&interrupt)throw new Error('Counter interrupted after receipt');return 1000;},
      createActionResponse:async params=>{dispatches++;if(dispatches===2)assert.equal(failureReceipt(params).error.code,'PARAMETER_INVALID');return response('image_prepare',imageArgs(dispatches===2),dispatches);},
    });
    await assert.rejects(service.submit(input),/Counter interrupted after receipt/);
    const failed=(await getDb().query<Pick<StoredDraftRow,'draft_json'>>('SELECT draft_json FROM studio_image_turns WHERE request_id=$1',[input.requestId])).rows[0];
    assert.equal(failed.draft_json,null);assert.equal(dispatches,1);
    assert.equal((await getDb().query<{n:number}>("SELECT count(*)::int n FROM studio_assistance_calls WHERE request_id=$1 AND state='settled'",[input.requestId])).rows[0].n,1);
    const before=await readStudioAssistanceStatus(owner,policy);assert.equal(before.paid.spentCents,1);
    interrupt=false;
    const ready=await service.submit(input);assert.equal(ready.state,'ready');assert.ok(ready.quote);assert.equal(dispatches,2);
    const calls=(await getDb().query<{response_index:number;state:string}>('SELECT response_index,state FROM studio_assistance_calls WHERE request_id=$1 ORDER BY response_index',[input.requestId])).rows;
    assert.deepEqual(calls,[{response_index:0,state:'settled'},{response_index:1,state:'settled'}]);
    const settled=await readStudioAssistanceStatus(owner,policy);
    assert.equal((await service.submit(input)).quote?.quoteId,ready.quote.quoteId);assert.equal(dispatches,2);
    assert.deepEqual(await readStudioAssistanceStatus(owner,policy),settled);
    assert.equal((await getDb().query<{n:number}>('SELECT count(*)::int n FROM mcp_generation_quotes WHERE studio_project_id=$1',[actor.projectId])).rows[0].n,1);
    assert.equal((await getDb().query<{n:number}>('SELECT count(*)::int n FROM app_jobs')).rows[0].n,0);
  });

  for(const [label,error,atCatalog] of [
    ['wallet',new AgentApiError('PARAMETER_INVALID','The wallet currency does not match this quote.'),false],
    ['lease',new AgentApiError('PARAMETER_INVALID','This message has been superseded.'),false],
    ['provider',new AgentApiError('ENGINE_UNAVAILABLE','Provider unavailable.'),false],
    ['storage',new Error('Quote commit acknowledgement unknown'),false],
    ['catalog',new AgentApiError('ENGINE_UNAVAILABLE','Catalog read failed.'),true],
  ] as const)await t.test(label+' failures with overlapping public codes remain terminal',async()=>{
    let calls=0;
    const guarded:typeof factory=(current,options)=>{
      const base=factory(current,options);
      return {...base,...(atCatalog?{catalog:async()=>{throw error;}}:{prepare:async()=>{throw error;}})};
    };
    const service=createImageConversationService(actor,{enabled:true,actionsEnabled:true,generationFactory:guarded,assistancePolicy:policy,countInputTokens:async()=>1000,
      createActionResponse:async()=>response('image_prepare',imageArgs(true),++calls),
    });
    await assert.rejects(service.submit({requestId:randomUUID(),message:'Prepare one image.',references:[]}),(failure:unknown)=>failure instanceof AgentApiError&&failure.nextAction===null);
    assert.equal(calls,1);
    assert.equal((await getDb().query<{n:number}>('SELECT count(*)::int n FROM app_jobs')).rows[0].n,0);
  });
});
