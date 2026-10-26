import assert from 'node:assert/strict';
import test from 'node:test';
import {createFalClient} from '@fal-ai/client';
import {submitFalQueueOnce} from '../frontend/src/lib/fal-queue-submit';
import {KLING_V4_ENDPOINTS} from '../frontend/src/config/fal-engines/kling-v4';

for(const endpoint of Object.values(KLING_V4_ENDPOINTS))test(`installed SDK retains the V4 parent queue path for ${endpoint} and never resubmits on 202`,async()=>{
 const requestId='offline-v4-request';const parent=`https://queue.fal.run/kling/v4/requests/${requestId}`;
 const calls:{url:string;method:string}[]=[];
 let statuses=0;
 const transport=(async(url:RequestInfo|URL,init?:RequestInit)=>{
  const method=(init?.method??'GET').toUpperCase();calls.push({url:String(url),method});
  const target=new URL(String(url));
  if(method==='POST'){
   assert.equal(target.origin+target.pathname,`https://queue.fal.run/${endpoint}`);
   return new Response(JSON.stringify({request_id:requestId,status:'IN_QUEUE',status_url:parent+'/status',response_url:parent,cancel_url:parent+'/cancel'}),{status:202,headers:{'content-type':'application/json'}});
  }
  if(target.pathname.endsWith('/status')){
   assert.equal(target.origin+target.pathname,parent+'/status');statuses++;
   return new Response(JSON.stringify({request_id:requestId,status:statuses===1?'IN_PROGRESS':'COMPLETED',response_url:parent}),{status:statuses===1?202:200,headers:{'content-type':'application/json'}});
  }
  assert.equal(target.toString(),parent);
  return new Response(JSON.stringify({video:{url:'https://fal.media/offline.mp4'}}),{headers:{'content-type':'application/json'}});
 }) as typeof fetch;
 const accepted=await submitFalQueueOnce(endpoint,{prompt:'Offline fixture'},'offline-owned-job',transport);
 const client=createFalClient({credentials:'offline-only',fetch:transport});
 assert.equal((await client.queue.status(endpoint,{requestId:accepted,logs:false})).status,'IN_PROGRESS');
 assert.equal((await client.queue.status(endpoint,{requestId:accepted,logs:false})).status,'COMPLETED');
 assert.equal((await client.queue.result(endpoint,{requestId:accepted})).data.video.url,'https://fal.media/offline.mp4');
 assert.equal(calls.filter(call=>call.method==='POST').length,1);
 assert.equal(calls.length,4);
});
