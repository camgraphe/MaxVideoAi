import assert from 'node:assert/strict';
import test from 'node:test';
import {NextRequest} from 'next/server';

test('assistance API binds account identity to session and rejects foreign-origin or oversized budget mutations before persistence',async()=>{
 const route=await import('../frontend/app/api/studio/_lib/studio-assistance-handler').catch(()=>null);
 assert.ok(route,'Studio assistance requires authenticated read and explicit choice routes');
 const url='http://localhost/api/studio/assistance';let writes=0;let actor='';
 const overrides={resolveAccess:async()=>({ok:true as const,userId:'owner'}),read:async(user:string)=>{actor=user;return {enabled:false} as never;},choose:async(user:string)=>{actor=user;writes++;return {enabled:true} as never;}};
 const read=await route.handleStudioAssistance(new NextRequest(url),'read',overrides);assert.equal(read.status,200);assert.equal(actor,'owner');assert.equal(read.headers.get('cache-control'),'private, no-store');
 const denied=await route.handleStudioAssistance(new NextRequest(url),'read',{...overrides,resolveAccess:async()=>({ok:false as const,status:401 as const,error:'UNAUTHORIZED' as const})});assert.equal(denied.status,401);
 const csrf=await route.handleStudioAssistance(new NextRequest(url,{method:'POST',headers:{origin:'https://foreign.test'},body:'{}'}),'choose',overrides);assert.equal(csrf.status,403);assert.equal(writes,0);
 const oversized=await route.handleStudioAssistance(new NextRequest(url,{method:'POST',headers:{origin:'http://localhost'},body:' '.repeat(5000)}),'choose',overrides);assert.equal(oversized.status,413);assert.equal(writes,0);
 const foreign=await route.handleStudioAssistance(new NextRequest(url,{method:'POST',headers:{origin:'http://localhost'},body:JSON.stringify({action:'select_luna',expectedRevision:0,userId:'foreign'})}),'choose',overrides);assert.equal(foreign.status,400);assert.equal(writes,0);
 const chosen=await route.handleStudioAssistance(new NextRequest(url,{method:'POST',headers:{origin:'http://localhost'},body:JSON.stringify({action:'select_luna',expectedRevision:0})}),'choose',overrides);assert.equal(chosen.status,200);assert.equal(writes,1);assert.equal(actor,'owner');
});
