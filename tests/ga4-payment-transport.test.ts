import assert from 'node:assert/strict';
import test from 'node:test';

test('payment transport preserves occurrence time and distinguishes accepted, HTTP refusal and uncertain network', async (t) => {
  process.env.GA4_MEASUREMENT_ID='G-FIXTURE'; process.env.GA4_API_SECRET='fixture-secret';
  const original=globalThis.fetch; t.after(()=>{globalThis.fetch=original;});
  const {sendGa4EventWithResult}=await import('../frontend/src/server/ga4');
  const event={name:'purchase',clientId:'123.456',userId:'fixture',timestampMicros:1792500000000000,params:{transaction_id:'pi_fixture',value:25,currency:'EUR'}};
  let payload: any;
  globalThis.fetch=async(_url,init)=>{payload=JSON.parse(String(init?.body)); assert.ok(init?.signal); return new Response(null,{status:204});};
  assert.deepEqual(await sendGa4EventWithResult(event),{status:'accepted',code:'http_2xx',httpStatus:204});
  assert.equal(payload.timestamp_micros,1792500000000000);
  assert.equal(payload.events[0].params.transaction_id,'pi_fixture');
  assert.equal(payload.client_id,'123.456');
  globalThis.fetch=async()=>new Response('sensitive collector body',{status:500});
  assert.deepEqual(await sendGa4EventWithResult(event),{status:'dead',code:'http_error',httpStatus:500});
  globalThis.fetch=async()=>{throw new Error('sensitive network URL');};
  assert.deepEqual(await sendGa4EventWithResult(event),{status:'retry',code:'network'});
  globalThis.fetch=async(_url,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(new Error('aborted'))));
  assert.deepEqual(await sendGa4EventWithResult(event,{timeoutMs:5}),{status:'retry',code:'timeout'});
});
