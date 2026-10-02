import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {handleStudioConversationExportConfirmation} from '../frontend/app/api/studio/_lib/studio-conversation-export-handler';
import {LIVE_PRICING_POLICY_REVISION,PRICING_POLICY_HEADER} from '../frontend/src/lib/membership-policy';

test('native export confirmation rejects forged scope, stale pricing and cross-site requests before dispatch',async()=>{
  let starts=0;
  const options={enabled:true,resolveAccess:async()=>({ok:true as const,userId:'owner'}),confirm:async(actor:any,input:any)=>{starts++;assert.deepEqual(actor,{userId:'owner',authOrigin:'studio-session',clientId:null});assert.equal(input.projectId,'film');return {ok:true as const,export:{id:'job',status:'queued' as const,progress:0,message:null,artifact:null},reused:false};}};
  const url='http://localhost:3000/api/studio/projects/film/conversation-exports';
  const quoteId='11111111-1111-4111-8111-111111111111';
  const req=(body:unknown,extra:Record<string,string>={})=>new NextRequest(url,{method:'POST',headers:{origin:'http://localhost:3000',[PRICING_POLICY_HEADER]:LIVE_PRICING_POLICY_REVISION,...extra},body:JSON.stringify(body)});
  const input={quoteId,confirmed:true};
  assert.equal((await handleStudioConversationExportConfirmation(req(input),'film',{...options,resolveAccess:async()=>({ok:false as const,status:401 as const,error:'UNAUTHORIZED' as const})})).status,401);
  assert.equal((await handleStudioConversationExportConfirmation(req(input),'film',{...options,enabled:false})).status,404);
  assert.equal((await handleStudioConversationExportConfirmation(req(input,{origin:'https://foreign.example'}),'film',options)).status,403);
  assert.equal((await handleStudioConversationExportConfirmation(req(input,{[PRICING_POLICY_HEADER]:'old'}),'film',options)).status,409);
  assert.equal((await handleStudioConversationExportConfirmation(req({...input,confirmed:false}),'film',options)).status,400);
  assert.equal((await handleStudioConversationExportConfirmation(req({...input,projectId:'foreign'}),'film',options)).status,400);
  assert.equal((await handleStudioConversationExportConfirmation(req({...input,estimateToken:'forged'}),'film',options)).status,400);
  assert.equal(starts,0);
  const result=await handleStudioConversationExportConfirmation(req(input),'film',options);
  assert.equal(starts,1);
  assert.equal(result.status,200);
  assert.equal(result.headers.get('Cache-Control'),'private, no-store');
});
