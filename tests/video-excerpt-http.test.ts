import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from '../frontend/node_modules/next/server';
import { createVideoExcerptPostHandler } from '../frontend/server/video-excerpts/http';
const source={type:'asset' as const,assetId:'ma_11111111111111111111111111111111',kind:'video' as const};
const result={asset:{id:'prepared',url:'https://media.example/excerpt.mp4'},range:{startSec:1,endSec:4},original:source};
function request(body='{}',headers:Record<string,string>={}) {return new NextRequest('https://maxvideoai.com/api/uploads/video/excerpt',{method:'POST',headers:{origin:'https://maxvideoai.com','content-type':'application/json',...headers},body});}
test('adapter authenticates same-origin bounded JSON and returns the prepared asset without billing gates',async()=>{
  const handler=createVideoExcerptPostHandler({userId:async()=> 'owner',prepare:async(owner,value)=>{assert.equal(owner,'owner');assert.deepEqual(value,{source});return result;}});
  const response=await handler(request(JSON.stringify({source})));assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,...result});assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('missing auth, cross-origin, non-JSON and oversized requests never prepare',async()=>{
  let calls=0;const handler=createVideoExcerptPostHandler({userId:async()=> 'owner',prepare:async()=>{calls++;return result;}});
  assert.equal((await handler(request('{}',{origin:'https://evil.example'}))).status,403);
  assert.equal((await handler(request('{}',{'sec-fetch-site':'cross-site'}))).status,403);
  assert.equal((await handler(request('{}',{'content-type':'text/plain'}))).status,415);
  assert.equal((await handler(request('x'.repeat(17000)))).status,413);
  assert.equal((await handler(request('{}',{'content-length':'17000'}))).status,413);
  const noOrigin=request();noOrigin.headers.delete('origin');assert.equal((await handler(noOrigin)).status,403);
  assert.equal((await createVideoExcerptPostHandler({userId:async()=>null,prepare:async()=>{calls++;return result;}})(request())).status,401);
  assert.equal(calls,0);
});
test('malformed JSON and internal failures return bounded errors without exposing source URLs',async()=>{
  const handler=createVideoExcerptPostHandler({userId:async()=> 'owner',prepare:async()=>{throw new Error('https://secret.example/signed?token=private');}});
  assert.equal((await handler(request('{'))).status,400);
  const failed=await handler(request());assert.equal(failed.status,500);assert.equal((await failed.text()).includes('secret'),false);
});
