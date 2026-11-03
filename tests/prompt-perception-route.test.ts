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

test('analysis keeps its 64 KiB byte boundary when conversation messages allow larger bodies',async()=>{
 const access=async()=>({ok:true as const,userId:'owner'}),url='http://localhost/api/prompt-assistance/analyses';
 // JSON quotes plus 32,767 two-byte characters total exactly 65,536 bytes.
 const body=JSON.stringify('é'.repeat(32767));
 assert.equal(Buffer.byteLength(body),65536);
 const request=(text:string)=>new NextRequest(url,{method:'POST',headers:{origin:'http://localhost','content-length':'1'},body:text});
 const exact=await handlePromptAnalysis(request(body),{enabled:true,access});
 assert.equal(exact.status,400,'The exact byte boundary reaches schema validation.');
 assert.equal((await exact.json()).error,'INVALID_REQUEST');
 const oversized=await handlePromptAnalysis(request(body+' '),{enabled:true,access});
 assert.equal(oversized.status,413,'One byte beyond the analysis limit is rejected before schema validation.');
 assert.equal((await oversized.json()).error,'BODY_TOO_LARGE');
 assert.match(oversized.headers.get('cache-control')??'',/no-store/);
 let cancelled=0;
 const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new TextEncoder().encode(body));controller.enqueue(new Uint8Array([32]));},cancel(){cancelled++;}});
 const streamed=await handlePromptAnalysis(new NextRequest(url,{method:'POST',headers:{origin:'http://localhost'},body:stream,duplex:'half'} as never),{enabled:true,access});
 assert.equal(streamed.status,413);assert.equal(cancelled,1,'Crossing the limit cancels further body reads.');
});
