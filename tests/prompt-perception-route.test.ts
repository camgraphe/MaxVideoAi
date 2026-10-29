import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from '../frontend/node_modules/next/server';
import {handlePromptAnalysis} from '../frontend/src/server/prompt-assistance/analysis-route-handler';

test('analysis route enforces activation, authenticated same-origin writes and bounded input before work',async()=>{
 const request=(origin='http://localhost',body='{}')=>new NextRequest('http://localhost/api/prompt-assistance/analyses',{method:'POST',headers:{origin},body});
 const access=async()=>({ok:true as const,userId:'owner'});
 assert.equal((await handlePromptAnalysis(request(),{enabled:false})).status,404);
 assert.equal((await handlePromptAnalysis(request(),{enabled:true,access:async()=>({ok:false,status:401,error:'UNAUTHORIZED'})})).status,401);
 assert.equal((await handlePromptAnalysis(request('https://foreign.invalid'),{enabled:true,access})).status,403);
 assert.equal((await handlePromptAnalysis(request('http://localhost','x'.repeat(65537)),{enabled:true,access})).status,413);
 assert.equal((await handlePromptAnalysis(request(),{enabled:true,access})).status,400);
 assert.equal((await handlePromptAnalysis(new NextRequest('http://localhost/api/prompt-assistance/analyses?sessionId=foreign&analysisId=bad'),{enabled:true,access})).status,400);
});
