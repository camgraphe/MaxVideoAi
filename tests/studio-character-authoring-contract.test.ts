import assert from 'node:assert/strict';
import test from 'node:test';
import {actionFromTool} from '../frontend/lib/studio/conversation-action-contract';
import {imageDraftSchema} from '../frontend/src/lib/studio/image-conversation-contract';
import {createStudioConversationDirector} from '../frontend/src/server/studio/conversation-director';

const action={reply:'Review the character recipe and exact price.',recipe:{traits:{customDetailsDescription:'One small cheek freckle'},qualityMode:'final',formatMode:'4k'}};
const context={message:'Create a reusable character with one cheek freckle.',references:[],history:[],project:{name:'Film',revision:0,memory:{revision:0,brief:'',decisions:[]}}};
test('native Milo Character Builder accepts canonical recipes and rejects generic URLs or model confirmation',()=>{
  let parsed;
  try{parsed=actionFromTool('character_prepare',action);}catch{assert.fail('Milo requires native Character Builder authoring.');}
  assert.equal(parsed.action,'character.prepare');
  assert.equal(imageDraftSchema.safeParse({reply:action.reply,image:null,characterBuilder:{action:'character.prepare',...action}}).success,true);
  for(const recipe of [{referenceImages:[{url:'https://foreign.test/image.png',role:'identity'}]},
    {traits:{genderPresentation:{value:'not-a-choice',source:'manual'}}},{generateCount:4}])
    assert.throws(()=>actionFromTool('character_prepare',{...action,recipe}));
  assert.throws(()=>actionFromTool('character_confirm',{quoteId:'12345678-1234-4234-8234-123456789abc',confirmed:true}));
});
test('native Character preparation ends at its exact quote and the new purchase gate hides fresh execution',async()=>{
  let calls=0;
  const createResponse:Parameters<typeof createStudioConversationDirector>[0]['createResponse']=async params=>{
    calls++;
    assert.ok(params.tools?.some(tool=>tool.type==='function'&&tool.name==='character_prepare'));
    assert.ok(params.tools?.every(tool=>tool.type!=='function'||!tool.name.includes('confirm')));
    return{id:'character-response',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output_text:'',
      output:[{type:'function_call',name:'character_prepare',call_id:'character-call',arguments:JSON.stringify(action)}]};
  };
  const result=await createStudioConversationDirector({mediaEnabled:true,characterEnabled:true,characterBuilderEnabled:true,createResponse})({...context,
    checkpoint:async(_,create)=>create(),execute:async()=>({ok:true,action:'character.prepare',data:{quoteId:'12345678-1234-4234-8234-123456789abc'}} as never)});
  assert.equal(result.characterBuilder?.action,'character.prepare');assert.equal(calls,1);
  await createStudioConversationDirector({mediaEnabled:true,characterEnabled:true,characterBuilderEnabled:false,createResponse:async params=>{
    assert.ok(params.tools?.every(tool=>tool.type!=='function'||tool.name!=='character_prepare'));
    return{id:'closed-response',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output:[],output_text:JSON.stringify({reply:'Character authoring is currently unavailable.'})};
  }})({...context,checkpoint:async(_,create)=>create(),execute:async()=>{assert.fail('Closed authoring must not execute.');}});
});

test('native Builder normalizes the real request origin while preserving canonical destination trust',async()=>{
  const {trustedAccountUrlFromOrigin}=await import('../frontend/src/server/agent-api/account-destinations');
  assert.equal(trustedAccountUrlFromOrigin('https://maxvideoai.com'),'https://maxvideoai.com/account/connections');
  assert.equal(trustedAccountUrlFromOrigin('http://localhost:3217'),'http://localhost:3217/account/connections');
  assert.throws(()=>trustedAccountUrlFromOrigin('https://maxvideoai.com.evil.example'),/trusted MaxVideoAI account URL/);
});

test('native save and exact look selection contain no URLs or paid-confirmation authority',()=>{
  const quoteId='12345678-1234-4234-8234-123456789abc';
  assert.equal(actionFromTool('character_save',{quoteId,name:'Freckle'}).action,'character.save');
  assert.equal(actionFromTool('character_select',{characterId:'1',lookId:'2'}).action,'character.select');
  assert.throws(()=>actionFromTool('character_save',{quoteId,name:'Freckle',imageUrl:'https://foreign.test/image.png'}));
  assert.throws(()=>actionFromTool('character_select',{characterId:'1',lookId:'2',confirmed:true}));
});
