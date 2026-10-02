import test from 'node:test';
import assert from 'node:assert/strict';
import {actionFromTool} from '../frontend/lib/studio/conversation-action-contract';
import {createStudioConversationDirector} from '../frontend/src/server/studio/conversation-director';
import {imageDraftSchema} from '../frontend/src/lib/studio/image-conversation-contract';
const quote={quoteId:'11111111-1111-4111-8111-111111111111',exportId:'tlx_'+'a'.repeat(64),projectId:'film',sequenceId:'main',revision:2,durationSec:5,resolution:'720p',aspectRatio:'16:9',fps:30,qualityPreset:'draft' as const,includeAudio:true,price:{amountCents:0,currency:'USD' as const,billingKind:'free' as const},expiresAt:'2099-01-01T00:00:00.000Z',confirmationRequired:true as const};
test('director can prepare an export card, but has no purchase confirmation tool',async()=>{
  const args={reply:'The saved cut is ready for your export confirmation.',sequenceId:'main',expectedRevision:2,qualityPreset:'draft',includeAudio:true};
  assert.deepEqual(actionFromTool('export_prepare',args),{action:'export.prepare',...args});
  assert.throws(()=>actionFromTool('export_confirm',{quoteId:quote.quoteId,confirmed:true}));
  let responses=0;
  const director=createStudioConversationDirector({editingEnabled:true,exportsEnabled:true,createResponse:async params=>{
    responses++;
    assert.ok(params.tools?.some((tool:any)=>tool.name==='export_prepare'));
    assert.ok(!params.tools?.some((tool:any)=>tool.name==='export_confirm'));
    return {id:'prepare',model:'gpt-6.1-sol',status:'completed',usage:null,service_tier:'default',output_text:'',output:[{type:'function_call',name:'export_prepare',call_id:'quote',arguments:JSON.stringify(args)}]};
  }});
  const draft=await director({message:'Finish and export it.',references:[],history:[],project:{name:'Film',revision:2,memory:{revision:0,brief:'',decisions:[]}},checkpoint:async(_index,create)=>create(),execute:async()=>({ok:true,action:'export.prepare',data:quote})});
  assert.deepEqual(draft,{reply:args.reply,image:null,exportQuote:quote});
  assert.deepEqual(imageDraftSchema.parse(draft),draft);
  assert.equal(responses,1);
});
test('export quotes remain scoped and cannot be mixed with another media quote',()=>{
  assert.throws(()=>actionFromTool('export_prepare',{reply:'Ready',sequenceId:'main',expectedRevision:2,qualityPreset:'draft',includeAudio:true,userId:'foreign'}));
  assert.throws(()=>imageDraftSchema.parse({reply:'Ready',image:{prompt:'A bottle',aspectRatio:'16:9'},exportQuote:quote}));
});
