import assert from 'node:assert/strict';
import test from 'node:test';
import {createStudioConversationDirector} from '../frontend/src/server/studio/conversation-director';
import {actionFromTool} from '../frontend/lib/studio/conversation-action-contract';
import {studioExplicitFilmDuration} from '../frontend/src/server/studio/conversation-intent';

const context={message:'HEY!',references:[],history:[],project:{name:'Film',revision:0,memory:{revision:0,brief:'',decisions:[]}},
  execute:async()=>{throw new Error('A greeting must not execute actions.');},
  checkpoint:async()=>{throw new Error('A greeting must not reserve/count/charge a model call.');}};

test('existing-film exports, writing and edits are not rerouted to paid creation planning',()=>{
  for(const message of ['I want to export my 100-second film','I need a synopsis for my 100-second movie','I want to trim my existing film to 100 seconds','Je veux raccourcir mon film à 100 secondes','I want to slow my existing 100-second film','Quiero recortar mi video a 100 segundos','I want to download my 100-second film','I want to watch my 100-second video','I need a link to my 100-second video','I want a download of my 100-second film','Show me the 100-second film I created yesterday','I want a link to my 100-second product video','Create subtitles for my 100-second video','Create a poster for my 100-second film','Make my 100-second film black and white','Plan a marketing campaign for my 100-second video','What price for a poster of my 100-second film?','Create a video thumbnail for my 100-second film','Create a film poster for a 100-second movie'])assert.equal(studioExplicitFilmDuration(message),null,message);
});

test('natural new-film and full budget intent still qualify in English, French and Spanish',()=>{
  for(const message of ['Create a 100-second - Mario Kart World - Knockout Tour Bambi Rally','I want a 100-second film','Je voudrais une vidéo de 100 secondes','Quiero un video de 100 segundos','Quiero una película de 100 segundos','Quel prix pour un film de 100 secondes ?'])assert.equal(studioExplicitFilmDuration(message),100,message);
});

test('a natural film preserves an explicit component duration, including spelled-out lengths, before checkpointing',async()=>{
  for(const [message,duration] of [['Create a 100-second film using five-second clips',5],['Je veux un film de 100 secondes avec des plans de cinq secondes',5]] as const){
    const args={surface:'video',mode:'t2v',prompt:'Bambi Rally',settings:[{name:'durationSec',value:duration}],filmDurationSec:100,references:[],baselineModelId:null,candidateModelIds:null,outputCount:1};
    const stop=new Error('Validated request');
    await assert.rejects(createStudioConversationDirector({mediaEnabled:true,createResponse:async()=>({id:'r',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output_text:'',output:[{type:'function_call',name:'pricing_compare',call_id:'plan',arguments:JSON.stringify(args)}]})})
      ({...context,message,checkpoint:async(_,create)=>{const response=await create();const call=response.output.find(item=>item.type==='function_call');assert.ok(call?.type==='function_call');assert.deepEqual(JSON.parse(call.arguments).settings,args.settings);return response;},execute:async(_,action)=>{
        assert.equal(action.action,'pricing.compare');assert.deepEqual((action as {settings:unknown}).settings,args.settings);throw stop;
      }}),error=>error===stop);
  }
});

test('standalone greetings answer locally without a model checkpoint, including punctuation and accents',async()=>{
  for(const message of ['HEY!','Bonjour 👋','salut','hola!','Hello Studio','Bonsoir !']){
    const draft=await createStudioConversationDirector({createResponse:async()=>{throw new Error('No provider call.');}})({...context,message});
    assert.ok(draft.reply.length>10);
    assert.equal(draft.continuation,undefined);
    assert.equal(draft.image,null);
  }
});

test('greeting followed by real work still dispatches the complete request',async()=>{
  let calls=0;
  const draft=await createStudioConversationDirector({createResponse:async()=>{calls++;return {id:'r',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output:[],output_text:JSON.stringify({reply:'Let us plan your film.'})};}})
    ({...context,message:'Hello, make a video of a forest',checkpoint:async(_,create)=>create()});
  assert.equal(calls,1);assert.match(draft.reply,/film/);
});

test('a natural 100-second film routes to complete pricing on the first call, before a component quote',async()=>{
  let calls=0;
  await createStudioConversationDirector({mediaEnabled:true,createResponse:async params=>{
    calls++;
    assert.deepEqual(params.tool_choice,{type:'function',name:'pricing_compare'});
    assert.match(String(params.instructions),/100/);
    return {id:'r',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output:[],output_text:JSON.stringify({reply:'Plan pending.'})};
  }})({...context,message:'Create a 100-second - Mario Kart World - Knockout Tour Bambi Rally',checkpoint:async(_,create)=>create()});
  assert.equal(calls,1);
});

test('film duration is an explicit bounded total, separate from the per-clip duration and purchase authority',()=>{
  const args={surface:'video',mode:'t2v',prompt:'Bambi Rally',settings:[{name:'durationSec',value:10}],references:[],baselineModelId:null,candidateModelIds:null,outputCount:1,filmDurationSec:100};
  assert.equal((actionFromTool('pricing_compare',args) as {filmDurationSec?:number}).filmDurationSec,100);
  for(const extra of [{filmDurationSec:-1},{filmDurationSec:90000},{confirmed:true},{priceCents:45}])assert.throws(()=>actionFromTool('pricing_compare',{...args,...extra}));
});

test('whole-film comparison ends with priced variants even when Quick cannot fund a follow-up response',async()=>{
  let calls=0;
  const clip={modelId:'model',modelLabel:'Model',surface:'video' as const,mode:'t2v',settings:{durationSec:20,resolution:'720p',aspectRatio:'16:9',audio:true},outputCount:1 as const,outputDurationSec:20,referenceCount:0,price:{amountCents:175,currency:'USD',formattedAmount:'$1.75'},estimatedAt:'2026-10-11T09:00:00Z',quoteRequired:true as const,audio:'optional' as const,references:[],defaultedSettings:[],editorialGuidance:{},bestFor:[]};
  const draft=await createStudioConversationDirector({mediaEnabled:true,createResponse:async()=>{
    calls++;return {id:'r',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output_text:'',output:[{type:'function_call',name:'pricing_compare',call_id:'plan',arguments:JSON.stringify({surface:'video',mode:'t2v',prompt:'Bambi Rally',settings:[{name:'durationSec',value:10}],filmDurationSec:null,references:[],baselineModelId:null,candidateModelIds:null,outputCount:1})}]};
  }})({...context,message:'Create a 100-second Bambi Rally video',checkpoint:async(_,create)=>{assert.equal(calls,0,'No second reservation is affordable.');return create();},execute:async(_,action)=>{
    assert.equal(action.action,'pricing.compare');
    assert.equal((action as {filmDurationSec?:number}).filmDurationSec,100,'The complete brief overrides a mistaken per-clip comparison.');
    return {ok:true,action:'pricing.compare',data:{options:[],baseline:null,unavailable:[],estimatedAt:clip.estimatedAt,quoteRequired:true,filmDurationSec:100,filmPlans:[{clip,fullClipCount:5,tail:null,tailUsedSec:0,totalDurationSec:100,generatedDurationSec:100,price:{amountCents:875,currency:'USD',formattedAmount:'$8.75'}}]}} as any;
  }});
  assert.equal(calls,1);assert.match(draft.reply,/5\s*×\s*20/);assert.match(draft.reply,/100/);assert.match(draft.reply,/\$8\.75/);assert.equal(draft.continuation,undefined);assert.equal(draft.media,undefined);
});
