import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioConversationDirector,type StudioDirectorResponse} from '../frontend/src/server/studio/conversation-director';
import {compareGenerationPrices} from '../frontend/src/server/agent-api/generation-price-comparison';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {AgentApiError,toAgentApiFailure} from '../frontend/src/server/agent-api/errors';
import type {StudioActionRequest,StudioActionResult} from '../frontend/lib/studio/conversation-action-contract';
import type {StudioTaskExecution} from '../frontend/src/server/studio/tasks/execution';
import {imageDraftSchema} from '../frontend/src/lib/studio/image-conversation-contract';
import {studioCurrentComparisonReply} from '../frontend/src/server/studio/conversation-current-comparison-reply';

const project={name:'Garden film',revision:0,memory:{revision:0,brief:'',decisions:[]}};
const context={message:'I prefer three twenty-second parts, widescreen with sound. Compare the current options before creating anything.',references:[],history:[],project,checkpoint:async(_:number,create:()=>Promise<StudioDirectorResponse>)=>create()};
const scenario={surface:'video' as const,mode:'t2v' as const,prompt:'A cinematic garden with morning light',settings:[{name:'durationSec',value:20},{name:'resolution',value:'720p'},{name:'aspectRatio',value:'16:9'},{name:'audio',value:true}],references:[],baselineModelId:null,baselineSettings:null,candidateModelIds:['ltx-2-5-fast','seedance-2-5'],outputCount:1 as const};
const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'project',clientId:null};
const catalog=()=>scenario.candidateModelIds.map(id=>{
  const entry=getFalEngineById(id)!;
  return {engine:entry.engine,surface:'video' as const,publicModes:['t2v' as const],modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))};
});
function toolResponse(index:number,name:string,args:unknown):StudioDirectorResponse {
  return {id:'response-'+index,model:'gpt-6-luna',status:'completed',usage:null,service_tier:'default',output_text:'',output:[{type:'function_call',name,call_id:'action-'+index,arguments:JSON.stringify(args)}]};
}
async function comparison(action:Extract<StudioActionRequest,{action:'pricing.compare'}>,unavailable=false):Promise<StudioActionResult> {
  try {
    const data=await compareGenerationPrices({surface:action.surface,mode:action.mode,prompt:action.prompt,settings:Object.fromEntries(action.settings.map(({name,value})=>[name,value])),references:[],
      ...(action.baselineModelId?{baselineModelId:action.baselineModelId}:{}),...(action.candidateModelIds?{candidateModelIds:action.candidateModelIds}:{}),
      ...(action.baselineSettings?{baselineSettings:Object.fromEntries(action.baselineSettings.map(({name,value})=>[name,value]))}:{}),
    },actor,{
      listPublicEngines:async()=>catalog(),
      resolveMembershipPricing:async()=>({tier:'member',source:'app_receipts_rolling_30d',spent30Cents:0,thresholdCents:0,discountPercent:0}),
      resolveRequestExecutability:()=>({executable:true,reason:'available'}),
      priceGeneration:async request=>{
        if(unavailable)throw new AgentApiError('ENGINE_UNAVAILABLE','Current pricing is temporarily unavailable.');
        const amount=request.engineId==='ltx-2-5-fast'?175:425;
        return {priceCents:amount,currency:'USD',membershipTier:'member',pricingSnapshot:{totalCents:amount,currency:'USD',membershipTier:'member'}};
      },
    });
    return {ok:true,action:'pricing.compare',data};
  } catch(error) {
    if(!(error instanceof AgentApiError))throw error;
    return {...toAgentApiFailure(error),action:'pricing.compare'};
  }
}

test('the last allowed Response returns canonical comparison prices and settings without another Response or quote',async()=>{
  let calls=0;
  const actions:StudioActionRequest['action'][]=[];
  const draft=await createStudioConversationDirector({model:'gpt-6-luna',mediaEnabled:true,createResponse:async params=>{
    const index=calls++;
    if(index===3){
      assert.ok(params.tools?.some(tool=>tool.type==='function'&&tool.name==='pricing_compare'),'Pricing remains usable after the discovery reads.');
      return toolResponse(index,'pricing_compare',scenario);
    }
    if(index===0)return toolResponse(index,'catalog_read',{});
    return toolResponse(index,'model_details',{modelId:index===1?'seedance-2-5':'ltx-2-5-fast'});
  }})({...context,execute:async(_,action)=>{
    actions.push(action.action);
    if(action.action==='pricing.compare')return comparison(action);
    if(action.action==='catalog.read')return {ok:true,action:action.action,data:[]};
    if(action.action==='model.details')return {ok:true,action:action.action,data:{modelId:action.modelId,surface:'video',modes:[]}} as StudioActionResult;
    throw new Error('Planning must not prepare, confirm or generate.');
  }});
  assert.equal(calls,4);
  assert.deepEqual(actions,['catalog.read','model.details','model.details','pricing.compare']);
  assert.match(draft.reply,/\$1\.75/);
  assert.match(draft.reply,/\$4\.25/);
  assert.match(draft.reply,/20\s*s(?:econds)?/);
  assert.match(draft.reply,/720p/);
  assert.match(draft.reply,/16:9/);
  assert.match(draft.reply,/sound|audio/i);
  assert.match(draft.reply,/one clip|per clip/i);
  assert.match(draft.reply,/confirmation/i);
  assert.doesNotMatch(draft.reply,/recover|narration|voiceover|haven't verified.*every part|no pricing tool/i);
  assert.equal(draft.continuation,undefined);
  assert.equal(draft.image,null);
  assert.equal(draft.media,undefined);
  assert.deepEqual(imageDraftSchema.parse(draft),draft);
});

test('a failed terminal comparison retains duration framing and sound requirements without preparing a replacement',async()=>{
  let calls=0;
  const requested={...scenario,settings:scenario.settings.map(setting=>setting.name==='durationSec'?{...setting,value:60}:setting)};
  const execution:StudioTaskExecution={taskRequestId:'task',segmentRequestId:'segment',workerId:'worker',profile:{maxCredits:100,maxCalls:2,maxOutputTokens:2200,maxInputTokens:12000,deadlineSec:180,historyTurns:4,reasoning:'low'},maxCalls:1,deadlineAt:new Date(Date.now()+180000),enabled:true};
  const draft=await createStudioConversationDirector({model:'gpt-6-luna',mediaEnabled:true,taskExecution:execution,createResponse:async()=>toolResponse(calls++,'pricing_compare',requested)})({...context,execute:async(_,action)=>{
    assert.equal(action.action,'pricing.compare');
    return comparison(action as Extract<StudioActionRequest,{action:'pricing.compare'}>);
  }});
  assert.equal(calls,1);
  assert.match(draft.reply,/60\s*s(?:econds)?/);
  assert.match(draft.reply,/720p/);
  assert.match(draft.reply,/16:9/);
  assert.match(draft.reply,/sound|audio/i);
  assert.match(draft.reply,/requirements|constraints/i);
  assert.doesNotMatch(draft.reply,/recover|narration|voiceover|\$|prepared.*quote/i);
  assert.equal(draft.continuation?.reason,'action_limit');
  assert.equal(draft.continuation?.lastError?.code,'PARAMETER_INVALID');
  assert.equal(draft.media,undefined);
  assert.equal(draft.image,null);
});

test('comparison is presented before separate catalog and single-scenario price discovery',async()=>{
  await createStudioConversationDirector({createResponse:async params=>{
    const names=params.tools?.filter(tool=>tool.type==='function').map(tool=>tool.name)??[];
    assert.equal(names[0],'pricing_compare');
    return {...toolResponse(0,'catalog_read',{}),output:[],output_text:JSON.stringify({reply:'Let us shape the garden film.'})};
  }})({...context,execute:async()=>{throw new Error('Prompt-only advice needs no creation.');}});
});

test('Luna uses the exact frozen task reasoning and output allowance even after catalog discovery',async()=>{
  const profiles=[
    {maxCredits:250,maxCalls:4,maxOutputTokens:2200,maxInputTokens:24000,deadlineSec:300,historyTurns:8,reasoning:'medium' as const},
    {maxCredits:500,maxCalls:8,maxOutputTokens:6000,maxInputTokens:48000,deadlineSec:600,historyTurns:12,reasoning:'high' as const},
  ] as const;
  for(const profile of profiles){
    let calls=0;
    const execution:StudioTaskExecution={taskRequestId:'task',segmentRequestId:'segment',workerId:'worker',profile,maxCalls:4,deadlineAt:new Date(Date.now()+300000),enabled:true};
    await createStudioConversationDirector({model:'gpt-6-luna',taskExecution:execution,createResponse:async params=>{
      assert.equal(params.reasoning?.effort,profile.reasoning);
      assert.equal(params.max_output_tokens,profile.maxOutputTokens);
      return calls++===0?toolResponse(0,'catalog_read',{}):{...toolResponse(1,'catalog_read',{}),output:[],output_text:JSON.stringify({reply:'Your requested settings are retained.'})};
    }})({...context,execute:async()=>({ok:true,action:'catalog.read',data:[]})});
    assert.equal(calls,2);
  }
});

test('non-task Luna uses high reasoning with the existing 2200-token bound',async()=>{
  await createStudioConversationDirector({model:'gpt-6-luna',createResponse:async params=>{
    assert.equal(params.reasoning?.effort,'high');
    assert.equal(params.max_output_tokens,2200);
    return {...toolResponse(0,'catalog_read',{}),output:[],output_text:JSON.stringify({reply:'A slow camera move will suit this scene.'})};
  }})({...context,execute:async()=>{throw new Error('Advice requires no action.');}});
});

test('long scenario details retain every displayed option price inside the persisted reply bound',async()=>{
  const result=await comparison({...scenario,action:'pricing.compare'});
  if(!result.ok||result.action!=='pricing.compare')throw new Error('The fixture must have compatible current prices.');
  const extra=Object.fromEntries(Array.from({length:20},(_,index)=>['setting'+index,'x'.repeat(80)]));
  const options=[...result.data.options,{...result.data.options[0],modelId:'third-option',modelLabel:'Third option',price:{amountCents:900,currency:'USD',formattedAmount:'$9.00'}}]
    .map(option=>({...option,settings:{...option.settings,...extra},defaultedSettings:Object.keys(extra)}));
  const draft=studioCurrentComparisonReply({...scenario,action:'pricing.compare'},{...result,data:{...result.data,options}},0);
  assert.ok(draft.reply.length<=2400,'A valid comparison must not fail draft persistence because its settings are long.');
  for(const price of ['$1.75','$4.25','$9.00'])assert.ok(draft.reply.includes(price),'Bound detail text without dropping a verified option.');
  assert.match(draft.reply,/720p/);
  assert.match(draft.reply,/16:9/);
  assert.match(draft.reply,/confirmation/i);
  assert.deepEqual(imageDraftSchema.parse(draft),draft);
});
