import assert from 'node:assert/strict';
import test from 'node:test';
import {NextRequest} from 'next/server';

test('Live composer endpoint rejects disabled, unauthenticated and cross-origin requests before reading data',async()=>{
  const handler=await import('../frontend/src/server/prompt-assistance/route-handler').catch(()=>null);
  assert.ok(handler,'A dedicated protected route is required');
  const request=()=>new NextRequest('http://localhost/api/prompt-assistance',{method:'POST',headers:{origin:'https://elsewhere.invalid'},body:'{}'});
  const denied=await handler.handlePromptAssistance(request(),{enabled:false});assert.equal(denied.status,404);
  const anonymous=await handler.handlePromptAssistance(request(),{enabled:true,access:async()=>({ok:false,status:401,error:'UNAUTHORIZED'})});assert.equal(anonymous.status,401);
  const cross=await handler.handlePromptAssistance(request(),{enabled:true,access:async()=>({ok:true,userId:'owner'})});assert.equal(cross.status,403);
  const large=await handler.handlePromptAssistance(new NextRequest('http://localhost/api/prompt-assistance',{method:'POST',headers:{origin:'http://localhost'},body:'x'.repeat(65537)}),{enabled:true,access:async()=>({ok:true,userId:'owner'})});
  assert.equal(large.status,413);assert.match(large.headers.get('cache-control')??'',/no-store/);
});
