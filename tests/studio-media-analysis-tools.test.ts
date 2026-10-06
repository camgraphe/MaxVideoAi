import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioConversationDirector} from '../frontend/src/server/studio/conversation-director';
import {actionFromTool} from '../frontend/lib/studio/conversation-action-contract';

const selection={ref:{type:'asset' as const,assetId:'ma_'+'a'.repeat(32),kind:'video' as const},goal:'Find the turn',reason:'requested' as const,startSec:0,endSec:30,reply:'Review this analysis scope before starting.'};
const quote={analysisId:'f2929a29-91b4-4c81-a731-820d6d3d7102',ref:selection.ref,goal:selection.goal,reason:selection.reason,startSec:0,endSec:30,maxCredits:80,policyVersion:'qualified-v1',expiresAt:'2026-10-06T23:00:00.000Z',profile:'video-frames-v1' as const,model:'gpt-6.1-sol' as const,confirmationRequired:true as const};
test('Luna can prepare a nonspending Sol handoff, but cannot dispatch or confirm analysis',async()=>{
  assert.equal(actionFromTool('analysis_prepare',selection).action,'analysis.prepare');
  assert.throws(()=>actionFromTool('analysis_confirm',{confirmed:true}));
  let executed=0;let calls=0;
  const director=createStudioConversationDirector({model:'gpt-6-luna',analysisEnabled:true,createResponse:async params=>{
    calls++;assert.ok(params.tools?.some(tool=>tool.type==='function'&&tool.name==='analysis_prepare'));
    assert.ok(!params.tools?.some(tool=>tool.type==='function'&&/analysis_confirm|analysis_run/.test(tool.name)));
    return {id:'luna-handoff',model:'gpt-6-luna',status:'completed',service_tier:'default',usage:null,output_text:'',output:[{type:'function_call',name:'analysis_prepare',call_id:'analysis',arguments:JSON.stringify(selection)}]};
  }});
  const result=await director({message:'Analyse cette vidéo',references:[],history:[],project:{name:'Film',revision:0,memory:{revision:0,brief:'',decisions:[]}},checkpoint:async(_index,create)=>create(),execute:async()=>{executed++;return {ok:true,action:'analysis.prepare',data:quote};}});
  assert.equal(result.analysisQuote?.analysisId,quote.analysisId);assert.equal(calls,1);assert.equal(executed,1,'Preparation ends the turn without a second analytical response');
});
test('an unqualified profile rejects forced model calls before executing any action',async()=>{
  let executed=0;
  const director=createStudioConversationDirector({createResponse:async()=>({id:'forced',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output_text:'',output:[{type:'function_call',name:'analysis_prepare',call_id:'analysis',arguments:JSON.stringify(selection)}]})});
  await assert.rejects(director({message:'Create a video',references:[],history:[],project:{name:'Film',revision:0,memory:{revision:0,brief:'',decisions:[]}},checkpoint:async(_index,create)=>create(),execute:async()=>{executed++;throw new Error('Must not execute');}}),/unavailable/i);
  assert.equal(executed,0);
});
