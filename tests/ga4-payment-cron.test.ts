import assert from 'node:assert/strict';
import test from 'node:test';
import { createGa4PaymentCronHandler } from '../frontend/server/ga4-payment-cron';

test('payment cron rejects missing/spoofed credentials and preview, exposes only aggregate work',async()=>{
 let calls=0;
 const run=async()=>{calls++;return {accepted:2,pending:0};};
 const req=(headers:Record<string,string>={})=>new Request('https://fixture/api/cron/ga4-payments',{headers});
 const env={VERCEL_ENV:'production',CRON_SECRET:'fixture-secret'};
 const handler=createGa4PaymentCronHandler(env,run);
 assert.equal((await handler(req({'x-vercel-cron':'1','user-agent':'vercel-cron/1.0'}))).status,401);
 assert.equal((await handler(req({authorization:'Bearer wrong'}))).status,401);
 assert.equal(calls,0);
 const response=await handler(req({authorization:'Bearer fixture-secret'}));assert.equal(response.status,200);assert.equal(calls,1);
 assert.deepEqual(await response.json(),{ok:true,accepted:2,pending:0});
 assert.equal((await createGa4PaymentCronHandler({...env,VERCEL_ENV:'preview'},run)(req({authorization:'Bearer fixture-secret'}))).status,503);
 assert.equal((await createGa4PaymentCronHandler({...env,CRON_SECRET:''},run)(req())).status,503);
 assert.equal((await createGa4PaymentCronHandler({...env,GA4_PAYMENTS_DISABLED:'1'},run)(req({authorization:'Bearer fixture-secret'}))).status,503);
 assert.equal(calls,1);
 const failure=createGa4PaymentCronHandler(env,async()=>{throw new Error('private SQL');});
 const failed=await failure(req({authorization:'Bearer fixture-secret'}));assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/private SQL/);
});
