import assert from 'node:assert/strict';
import test from 'node:test';
import {createStudioConversationDirector,isReplayableStudioResponse,type StudioDirectorContext,type StudioDirectorResponse,type StudioResponseCreator} from '../frontend/src/server/studio/conversation-director';
import {createStudioImageDirector} from '../frontend/src/server/studio/image-conversation-director';
import {imageDraftSchema} from '../frontend/src/lib/studio/image-conversation-contract';
import type {StudioActionRequest,StudioActionResult} from '../frontend/lib/studio/conversation-action-contract';

const fallback='The explanation is unavailable. Review any available quote before deciding, or send a follow-up to continue.';
const contaminated='Review the direction.</final> assistant (analysis) We should just final. <|/final|>';
const creativePrompt='A poster with the exact lettering "analysis / final / </final>", plus <em>flowers</em>.';
function response(reply:string):StudioDirectorResponse {
  return {id:'offline-reply',model:'gpt-6-luna',status:'completed',service_tier:'default',usage:undefined,output:[],output_text:JSON.stringify({reply})};
}
function context():StudioDirectorContext {
  return {message:'Analyse the final shot; preserve </final> in my lettering.',references:[],history:[],
    project:{name:'Synthetic direction',revision:0,memory:{revision:0,brief:'',decisions:[]}},
    execute:async()=>{throw new Error('No action is expected');},checkpoint:async(_index,create)=>create()};
}

test('a valid paid reply containing protocol delimiters remains replayable but is projected before returning',async()=>{
  for(const reply of [contaminated,'Direction <|im_start|>assistant<|im_end|>',
    'Direction <|start|>assistant<|channel|>analysis<|message|>',
    'Direction <|start_header_id|>assistant<|end_header_id|>',
    'Direction\nassistant (analysis)\nInternal commentary.']) {
    const raw=response(reply),before=structuredClone(raw);
    assert.equal(isReplayableStudioResponse(raw),true);
    const draft=await createStudioConversationDirector({createResponse:async()=>raw})(context());
    assert.equal(draft.reply,fallback);
    assert.equal(draft.image,null);
    assert.deepEqual(raw,before,'Projection must not change the private paid checkpoint.');
  }
});

test('ordinary analysis/final prose, creative markup and code remain unchanged',async()=>{
  for(const reply of ['My final analysis: use soft light.','The assistant gave a final answer after analysis.',
    'Keep <em>flowers</em> and the exact words "analysis" and "final".',
    'Copy this prompt:\n```text\nA final dance, analytical geometry, and </em> lettering.\n```']) {
    const draft=await createStudioConversationDirector({createResponse:async()=>response(reply)})(context());
    assert.equal(draft.reply,reply);
    assert.equal(imageDraftSchema.parse({reply,image:null}).reply,reply);
  }
});

const preparations=[
  {name:'image_prepare',args:{reply:contaminated,prompt:creativePrompt,aspectRatio:'16:9',modelId:null,mode:'t2i',settings:null,references:[],outputCount:1}},
  {name:'video_prepare',args:{reply:contaminated,prompt:creativePrompt,aspectRatio:'16:9',source:null,modelId:null,mode:'t2v',settings:null,references:[],outputCount:1}},
  {name:'voice_prepare',args:{reply:contaminated,script:creativePrompt,language:'english',modelId:null,settings:null,outputCount:1}},
  {name:'music_prepare',args:{reply:contaminated,prompt:creativePrompt,mood:'dreamy',modelId:null,settings:null,outputCount:1}},
  {name:'export_prepare',args:{reply:contaminated,sequenceId:'sequence',expectedRevision:0,qualityPreset:'standard',includeAudio:true}},
] as const;
for(const preparation of preparations)test(`${preparation.name} projects only visible replies while preserving the raw action and creative input`,async()=>{
  const raw:StudioDirectorResponse={...response(''),output_text:'',output:[{type:'function_call',call_id:'prepare-once',name:preparation.name,arguments:JSON.stringify(preparation.args)}]};
  const before=structuredClone(raw);
  let executed:StudioActionRequest|undefined;
  const draft=await createStudioConversationDirector({createResponse:async()=>raw,mediaEnabled:true,exportsEnabled:true})({...context(),execute:async(_id,action)=>{
    executed=action;
    return {ok:true,action:action.action,data:{quoteId:'123e4567-e89b-42d3-a456-426614174000',price:{amountCents:42,currency:'USD'}}} as StudioActionResult;
  }});
  assert.equal(draft.reply,fallback);
  if(draft.media)assert.equal(draft.media.reply,fallback);
  assert.ok(executed&&'reply' in executed);
  assert.equal(executed.reply,contaminated,'Receipt identity must still use the exact checkpointed action.');
  if('prompt' in executed)assert.equal(executed.prompt,creativePrompt);
  if('script' in executed)assert.equal(executed.script,creativePrompt);
  assert.equal(isReplayableStudioResponse(raw),true);
  assert.deepEqual(raw,before);
});

test('draft validation projects top-level and media replies without changing creation fields',()=>{
  const image={reply:contaminated,image:{prompt:creativePrompt,aspectRatio:'16:9' as const}};
  assert.deepEqual(imageDraftSchema.parse(image),{...image,reply:fallback});
  const media={reply:'Review the quote.',image:null,media:{action:'voice.prepare' as const,reply:contaminated,script:creativePrompt,language:'english' as const}};
  assert.deepEqual(imageDraftSchema.parse(media),{...media,media:{...media.media,reply:fallback}});
  assert.equal(media.media.reply,contaminated,'Projection must not mutate its source.');
});

test('a bounded correction explanation projects protocol markers without changing the failure receipt',async()=>{
  const preparation=preparations[0];
  let calls=0;
  const draft=await createStudioConversationDirector({createResponse:async()=>({...response(''),output_text:'',output:[{
    type:'function_call',call_id:'rejected-'+(++calls),name:preparation.name,arguments:JSON.stringify(preparation.args)}]})})({...context(),execute:async()=>({
    ok:false,action:'image.prepare',error:{code:'PARAMETER_INVALID',message:contaminated,retryable:false,nextAction:{type:'studio_preparation_input',version:1}},
  })});
  assert.equal(calls,2);
  assert.equal(draft.reply,fallback);
  assert.equal(draft.continuation?.reason,'action_limit');
  assert.equal(draft.continuation?.lastError?.message,contaminated);
});

test('both directors clean legacy assistant history while preserving user messages',async()=>{
  const history=[{message:'Preserve </final> and <|im_start|> in the requested artwork.',reply:contaminated}];
  const current=context();
  let inspected=0;
  const inspect=(params:Parameters<StudioResponseCreator>[0])=>{
    assert.ok(Array.isArray(params.input));
    const assistant=params.input.find(item=>typeof item!=='string'&&'role' in item&&item.role==='assistant');
    assert.ok(assistant&&'content' in assistant);assert.equal(assistant.content,fallback);
    assert.ok(JSON.stringify(params.input).includes(history[0].message));
    inspected++;
  };
  await createStudioConversationDirector({createResponse:async params=>{inspect(params);return response('A clean final analysis.');}})({...current,history});
  const legacyDraft=await createStudioImageDirector({createResponse:async params=>{inspect(params);return {...response(''),output_text:JSON.stringify({reply:contaminated,image:null})};}})(
    {requestId:'123e4567-e89b-42d3-a456-426614174000',message:current.message,references:[]},history,[]);
  assert.equal(legacyDraft.reply,fallback);
  assert.equal(inspected,2);
  assert.equal(history[0].reply,contaminated);
});
