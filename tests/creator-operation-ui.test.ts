import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';
const opId = '12345678-1234-4234-8234-123456789abc';
const prepared = { ok: true, operationId: opId, quote: { price: { amountCents: 125, currency: 'USD' }, expiresAt: '2099-01-01T00:00:00Z' } };
const stubs = { '@/lib/authFetch': 'export const authFetch=(url,init)=>window.fixtureFetch(url,init);' };
async function mount(storage: Record<string,string> = {}, userId = 'A') {
  return mountToolFixture(`import{useCreatorOperation}from'./src/components/tools/creator/useCreatorOperation';function App(){window.operation=useCreatorOperation({userId:window.userId,toolId:'lip-sync',family:'creator'});return null}`, stubs, w => { w.userId=userId; for(const [key,value]of Object.entries(storage)) w.sessionStorage.setItem(key,value); });
}
test('a changed input discards an outstanding quote and cannot confirm the old payload', async () => {
  const f = await mount();
  try {
    await f.act(async () => { void f.w.operation.prepare({source:'old'}); });
    await f.act(async () => f.w.operation.invalidate());
    await f.respond(f.w.requests[0],prepared);
    assert.equal(f.w.operation.quote,null);
    await f.act(async () => { void f.w.operation.confirm(); });
    assert.equal(f.w.requests.length,1);
  } finally { await f.close(); }
});
test('confirmation is single-flight, persists the approved operation and recovers after an ambiguous response', async () => {
  const f = await mount();
  try {
    await f.act(async () => { void f.w.operation.prepare({source:'first'}); });
    await f.respond(f.w.requests[0],prepared);
    await f.act(async () => { void f.w.operation.confirm(); void f.w.operation.confirm(); });
    assert.equal(f.w.requests.length,2);
    const confirmation=f.w.requests[1];
    assert.deepEqual(JSON.parse(confirmation.init.body),{operationId:opId,confirmed:true});
    assert.ok(confirmation.init.headers['x-maxvideoai-pricing-policy']);
    assert.ok(f.w.sessionStorage.getItem('creator:operation:A:lip-sync').includes(opId));
    await f.act(async () => confirmation.reject(Error('Network interrupted')));
    const recovery=f.w.requests.at(-1);
    assert.equal(recovery.url,`/api/tools/creator/operations/${opId}`);
    await f.respond(recovery,{ok:true,operationId:opId,status:'completed',result:{outputs:[{originalUrl:'https://private.invalid/exact.mp4'}]}});
    assert.equal(f.w.operation.result.outputs[0].originalUrl,'https://private.invalid/exact.mp4');
    assert.equal(f.w.operation.running,false);
    assert.equal(f.w.requests.filter((r:any)=>r.url.endsWith('/prepare')).length,1);
  } finally { await f.close(); }
});
test('operation recovery stays scoped to the signed-in account', async () => {
  const f=await mount({'creator:operation:A:lip-sync':JSON.stringify({operationId:opId,quote:prepared.quote})},'B');
  try { assert.equal(f.w.requests.length,0); assert.equal(f.w.operation.result,null); }
  finally { await f.close(); }
});
test('a generic failure after confirmation does not discard an operation that may already be paid', async()=>{
  const f=await mount();try{
    await f.act(async()=>{void f.w.operation.prepare({source:'first'});});await f.respond(f.w.requests.at(-1),prepared);
    await f.act(async()=>{void f.w.operation.confirm();});await f.respond(f.w.requests.at(-1),{ok:false,error:{code:'TOOL_OPERATION_FAILED'}},422);
    assert.equal(f.w.operation.running,true);assert.equal(f.w.requests.at(-1).url,`/api/tools/creator/operations/${opId}`);
    assert.ok(f.w.sessionStorage.getItem('creator:operation:A:lip-sync'));
  }finally{await f.close();}
});
test('an expired quote cannot authorize a confirmation',async()=>{
  const f=await mount();try{
    await f.act(async()=>{void f.w.operation.prepare({source:'first'});});await f.respond(f.w.requests[0],{...prepared,quote:{...prepared.quote,expiresAt:'2000-01-01T00:00:00Z'}});
    assert.equal(f.w.operation.expired,true);await f.act(async()=>{void f.w.operation.confirm();});assert.equal(f.w.requests.length,1);
  }finally{await f.close();}
});
test('unknown provider acceptance keeps the operation for manual status checks and never offers a new confirmation',async()=>{
  const f=await mount();try{
    await f.act(async()=>{void f.w.operation.prepare({source:'first'});});await f.respond(f.w.requests.at(-1),prepared);await f.act(async()=>{void f.w.operation.confirm();});
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,status:'running'});
    const timers:number[]=[];const original=f.w.setTimeout;f.w.setTimeout=(fn:any,delay:number)=>{timers.push(delay);return original(fn,delay);};
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,state:'running',needsAttention:true,retryable:false});
    assert.equal(f.w.operation.needsAttention,true);assert.equal(f.w.operation.needsConfirmation,false);assert.equal(f.w.operation.running,true);assert.ok(!timers.includes(5000));
    await f.act(async()=>f.w.operation.retry());assert.equal(f.w.requests.at(-1).url,`/api/tools/creator/operations/${opId}`);
    assert.equal(f.w.requests.filter((r:any)=>r.url.endsWith('/confirm')).length,1);
  }finally{await f.close();}
});
test('recovery with execution disabled only reads the existing operation even when actions are called',async()=>{
  const f=await mountToolFixture(`import{useCreatorOperation}from'./src/components/tools/creator/useCreatorOperation';function App(){window.operation=useCreatorOperation({userId:'A',toolId:'lip-sync',family:'creator',executionEnabled:false,initialOperationId:'${opId}'});return null}`,stubs);
  try{
    assert.equal(f.w.requests[0].url,`/api/tools/creator/operations/${opId}`);
    await f.respond(f.w.requests[0],{ok:true,operationId:opId,status:'completed',result:{outputs:[]}});
    await f.act(async()=>{void f.w.operation.prepare({source:'new'});void f.w.operation.confirm();});
    assert.equal(f.w.requests.length,1);assert.deepEqual(f.w.operation.result.outputs,[]);
  }finally{await f.close();}
});
test('synchronous invalidation blocks confirmation even before React rerenders',async()=>{
  const f=await mount();try{
    await f.act(async()=>{void f.w.operation.prepare({source:'first'});});await f.respond(f.w.requests[0],prepared);
    await f.act(async()=>{const previous=f.w.operation;previous.invalidate();void previous.confirm();});assert.equal(f.w.requests.length,1);
  }finally{await f.close();}
});
