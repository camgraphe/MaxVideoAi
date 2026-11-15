import assert from 'node:assert/strict';
import test from 'node:test';
import { actionFromTool } from '../frontend/lib/studio/conversation-action-contract';
import { imageDraftSchema } from '../frontend/src/lib/studio/image-conversation-contract';
import { imageConfirmationSchema } from '../frontend/src/server/studio/image-conversation-service';

const id = '12345678-1234-4234-8234-123456789abc';
const source = {type:'asset',assetId:'ma_11111111111111111111111111111111',kind:'image'};
const request = {reply:'Review this exact tool quote.',toolId:'product-photo-editor',inputs:[{role:'source',source,segment:null}],settings:[],profileId:null,language:null,keyterms:[]};
const quote = {operationId:id,toolId:'subtitles',kind:'render',price:{amountCents:0,currency:'USD'},expiresAt:'2026-11-12T18:00:00.000Z',confirmationRequired:true,document:{id:'captions',revision:2}};

test('Milo creator preparation has typed owned sources and no caller identity or paid confirmation', () => {
  assert.equal(actionFromTool('creator_prepare',request).action,'creator.prepare');
  for (const extra of [{userId:'foreign'},{projectId:'other'},{confirmed:true}])assert.throws(()=>actionFromTool('creator_prepare',{...request,...extra}));
  assert.throws(()=>actionFromTool('creator_prepare',{...request,inputs:[{role:'source',source:{type:'url',url:'https://foreign.test/image.png',kind:'image'},segment:null}]}));
  assert.throws(()=>actionFromTool('confirm_creator_tool',{operationId:id,confirmed:true}));
});
test('saved Milo creator quote retains an included zero price and cannot share a turn with another quote',()=>{
  assert.equal(imageDraftSchema.safeParse({reply:'Review the included export.',image:null,creatorQuote:quote}).success,true);
  assert.equal(imageDraftSchema.safeParse({reply:'Review.',image:{prompt:'A scene',aspectRatio:'1:1'},creatorQuote:quote}).success,false);
});
test('the existing confirmation route accepts an exact creator tuple only with explicit price approval',()=>{
  const input={requestId:id,confirmed:true,creator:{operationId:id,toolId:'subtitles',amountCents:0,currency:'USD'}};
  assert.equal(imageConfirmationSchema.safeParse(input).success,true);
  assert.equal(imageConfirmationSchema.safeParse({...input,confirmed:false}).success,false);
  const {amountCents,...creator}=input.creator;
  assert.equal(imageConfirmationSchema.safeParse({...input,creator}).success,false);
  assert.equal(imageConfirmationSchema.safeParse({...input,quoteId:id}).success,false);
});
test('native Milo creator preparation ends at the exact quote card and exposes no confirmation function',async()=>{
  const {createStudioConversationDirector}=await import('../frontend/src/server/studio/conversation-director');
  let calls=0;
  const director=createStudioConversationDirector({creatorEnabled:true,createResponse:async params=>{
    calls++;const names=params.tools?.filter(tool=>tool.type==='function').map(tool=>tool.name)??[];
    assert.ok(names.includes('creator_prepare'));assert.ok(!names.includes('confirm_creator_tool'));
    return{id:'creator-response',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output_text:'',output:[{type:'function_call',name:'creator_prepare',call_id:'creator-call',arguments:JSON.stringify(request)}]};
  }});
  const result=await director({message:'Edit this product photo.',references:[],history:[],project:{name:'Film',revision:0,memory:{revision:0,brief:'',decisions:[]}},
    checkpoint:async(_,create)=>create(),execute:async()=>({ok:true,action:'creator.prepare',data:quote})});
  assert.deepEqual(result.creatorQuote,quote);assert.equal(calls,1);
});
