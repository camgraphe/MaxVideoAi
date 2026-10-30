import assert from 'node:assert/strict';
import test from 'node:test';
import OpenAI from 'openai';
import {createServer} from 'node:http';
import {promptProviderTimeout,promptProviderFailure,createPromptResponse} from '../frontend/src/server/prompt-assistance/provider';

test('provider budget subtracts preparation and refuses a dispatch after the deadline',t=>{
  t.mock.method(Date,'now',()=>40_000);
  assert.equal(promptProviderTimeout(90_000),50_000);
  assert.equal(promptProviderTimeout(90_000,15_000),15_000);
  assert.throws(()=>promptProviderTimeout(40_000),/REQUEST_DEADLINE/);
});
test('provider diagnostics classify transport failures without persisting their contents',()=>{
  assert.deepEqual(promptProviderFailure(new OpenAI.APIConnectionTimeoutError(),1234),{kind:'timeout',elapsedMs:1234});
  assert.deepEqual(promptProviderFailure(new Error('secret user text https://private.invalid/token'),1234),{kind:'unknown',elapsedMs:1234});
  const error=new OpenAI.APIError(429,{},'private response body',new Headers({'x-request-id':'req_synthetic'}));
  assert.deepEqual(promptProviderFailure(error,1234),{kind:'http',elapsedMs:1234,status:429,providerRequestId:'req_synthetic'});
});


test('response body parsing remains bounded after headers and never retries',async t=>{
  let requests=0;
  const server=createServer((_request,response)=>{requests++;response.writeHead(200,{'Content-Type':'application/json'});response.flushHeaders();});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address() as {port:number};
  const previousKey=process.env.OPENAI_API_KEY,previousUrl=process.env.OPENAI_BASE_URL;
  process.env.OPENAI_API_KEY='synthetic-local-test';process.env.OPENAI_BASE_URL=`http://127.0.0.1:${address.port}/v1`;
  t.after(()=>{server.closeAllConnections();server.close();if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;if(previousUrl===undefined)delete process.env.OPENAI_BASE_URL;else process.env.OPENAI_BASE_URL=previousUrl;});
  const result=await Promise.race([createPromptResponse({model:'gpt-6.1-sol',input:'synthetic'},100).then(()=> 'complete',()=> 'aborted'),new Promise<string>(resolve=>setTimeout(()=>resolve('unbounded'),500))]);
  assert.equal(result,'aborted');assert.equal(requests,1);
});
