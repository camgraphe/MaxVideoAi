import assert from 'node:assert/strict';
import test from 'node:test';
import { ENV } from '../frontend/src/lib/env';
import { getFalClient } from '../frontend/src/lib/fal-client';
import { generateVideo } from '../frontend/src/lib/fal';
import { FalGenerationError } from '../frontend/src/lib/fal-error';

test('MCP enqueue returns the accepted request without subscribing to a long render and awaits persistence', async (t) => {
  const previousKey = ENV.FAL_API_KEY;
  ENV.FAL_API_KEY = 'test-only';
  t.after(() => { ENV.FAL_API_KEY = previousKey; });
  const client = getFalClient();
  let submits = 0;
  t.mock.method(globalThis, 'fetch', async (url: URL, options: RequestInit) => {
    submits += 1;
    assert.equal(url.pathname, '/minimax/h3/reference-to-video');
    assert.equal(JSON.parse(String(options.body)).submissionMode, undefined);
    return new Response(JSON.stringify({ request_id: 'accepted-request' }));
  });
  t.mock.method(client, 'subscribe', async () => {
    throw new Error('Must not wait for rendering inside MCP confirmation');
  });
  let release!: () => void;
  const persisted = new Promise<void>((resolve) => { release = resolve; });
  let enteredPersistence!: () => void;
  const started = new Promise<void>((resolve) => { enteredPersistence = resolve; });
  let settled = false;
  const generation = generateVideo({
    engineId: 'minimax-h3', prompt: 'Test', mode: 'ref2v',
    submissionMode: 'enqueue', durationSec: 5, resolution: '2K', aspectRatio: '16:9',
  }, {
    onRequestId: async (id) => {
      assert.equal(id, 'accepted-request');
      enteredPersistence();
      await persisted;
    },
  });
  generation.then(() => { settled = true; }, () => { settled = true; enteredPersistence(); });
  await started;
  assert.equal(settled, false, 'acceptance must wait for durable request tracking');
  release();
  const result = await generation;
  assert.equal(submits, 1);
  assert.equal(result.providerJobId, 'accepted-request');
  assert.equal(result.status, 'queued');
  assert.equal(result.videoUrl, undefined);
});

test('an enqueue rejection preserves the provider error and never submits a replacement', async (t) => {
  const previousKey = ENV.FAL_API_KEY;
  ENV.FAL_API_KEY = 'test-only';
  t.after(() => { ENV.FAL_API_KEY = previousKey; });
  const client = getFalClient();
  let submits = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    submits += 1;
    return new Response(JSON.stringify({ detail: 'Invalid reference' }), { status: 422 });
  });
  t.mock.method(client, 'subscribe', async () => { throw new Error('Unexpected subscription'); });
  await assert.rejects(generateVideo({
    engineId: 'minimax-h3', prompt: 'Test', mode: 't2v', submissionMode: 'enqueue',
  }), (error: unknown) => {
    assert.ok(error instanceof FalGenerationError);
    assert.equal(error.status, 422);
    assert.equal(error.providerJobId, undefined);
    return true;
  });
  assert.equal(submits, 1);
});

test('ordinary video requests retain synchronous completion', async (t) => {
  const previousKey = ENV.FAL_API_KEY;
  ENV.FAL_API_KEY = 'test-only';
  t.after(() => { ENV.FAL_API_KEY = previousKey; });
  const client = getFalClient();
  t.mock.method(client.queue, 'submit', async () => { throw new Error('Unexpected enqueue-only path'); });
  t.mock.method(client, 'subscribe', async () => ({
    requestId: 'completed-request', data: { video_url: 'https://example.test/output.mp4' },
  }));
  const result = await generateVideo({ engineId: 'minimax-h3', prompt: 'Test', mode: 't2v' });
  assert.equal(result.status, 'completed');
  assert.equal(result.videoUrl, 'https://example.test/output.mp4');
});

test('shared standard Fal native Draft writer persists the exact submitted endpoint and request digest',async t=>{
 const {createProviderJobTracker}=await import('../frontend/app/api/generate/_lib/provider-job-tracker');
 const {createHash}=await import('node:crypto');
 const {stableJson}=await import('../frontend/src/server/agent-api/generation-normalization');
 const previousKey=ENV.FAL_API_KEY;ENV.FAL_API_KEY='test-only';t.after(()=>{ENV.FAL_API_KEY=previousKey;});
 let submits=0,wire:Record<string,unknown>={};
 t.mock.method(globalThis,'fetch',async(url:URL,options:RequestInit)=>{submits++;assert.equal(url.pathname,'/blackforestlabs/flux-3/text-to-video/draft');wire=JSON.parse(String(options.body));return new Response(JSON.stringify({request_id:'native-request'}));});
 for(const surface of ['caller']){
  const writes:Array<{sql:string;params?:unknown[]}>=[];
  const tracker=createProviderJobTracker({jobId:surface+'-job',providerKey:'fal',engineId:'flux-3-draft',prompt:'Animate',inputSummary:{primaryImageUrl:null,primaryAudioUrl:null,referenceImageCount:0,referenceVideoCount:0,referenceAudioCount:0,hasFirstFrame:false,hasLastFrame:false,inputSlots:[]},queryFn:async(sql,params)=>{writes.push({sql,params});}});
  const result=await generateVideo({engineId:'flux-3-draft',prompt:'Animate',mode:'t2v',submissionMode:'enqueue',durationSec:5,resolution:'480p',aspectRatio:'16:9'}, {onRequestId:tracker.persistProviderJobId});
  assert.equal(result.providerJobId,'native-request');
  const row=writes.find(write=>write.sql.includes('INSERT INTO fal_queue_log'))!;
  assert.deepEqual(row.params?.slice(0,5),[surface+'-job','fal','native-request','flux-3-draft','enqueue']);
  const proof=JSON.parse(String(row.params?.[5])).nativeDraftSubmission;
  assert.deepEqual(proof,{version:1,engineId:'flux-3-draft',mode:'t2v',endpoint:'blackforestlabs/flux-3/text-to-video/draft',requestSha256:createHash('sha256').update(stableJson({engineId:'flux-3-draft',mode:'t2v',endpoint:'blackforestlabs/flux-3/text-to-video/draft',requestBody:wire})).digest('hex')});
 }
 assert.equal(submits,1,'one accepted request, never an Enhance retry');
});

test('optional native Draft enqueue-proof persistence failure cannot resubmit or fail accepted generation',async t=>{
 const {createProviderJobTracker}=await import('../frontend/app/api/generate/_lib/provider-job-tracker');
 const previousKey=ENV.FAL_API_KEY;ENV.FAL_API_KEY='test-only';t.after(()=>{ENV.FAL_API_KEY=previousKey;});
 let submits=0;t.mock.method(globalThis,'fetch',async()=>{submits++;return new Response(JSON.stringify({request_id:'accepted-native'}));});t.mock.method(console,'warn',()=>{});
 const tracker=createProviderJobTracker({jobId:'job',providerKey:'fal',engineId:'flux-3-draft',prompt:'Animate',inputSummary:{primaryImageUrl:null,primaryAudioUrl:null,referenceImageCount:0,referenceVideoCount:0,referenceAudioCount:0,hasFirstFrame:false,hasLastFrame:false,inputSlots:[]},queryFn:async sql=>{if(sql.includes('INSERT'))throw new Error('offline queue unavailable');}});
 const result=await generateVideo({engineId:'flux-3-draft',prompt:'Animate',mode:'t2v',submissionMode:'enqueue',durationSec:5,resolution:'480p',aspectRatio:'16:9'},{onRequestId:tracker.persistProviderJobId});
 assert.equal(result.providerJobId,'accepted-native');assert.equal(result.status,'queued');assert.equal(submits,1);
});

 test('synchronous native Draft completion persists proof even when queue status arrives before request tracking',async t=>{
 const {createProviderJobTracker}=await import('../frontend/app/api/generate/_lib/provider-job-tracker');
 const previousKey=ENV.FAL_API_KEY;ENV.FAL_API_KEY='test-only';t.after(()=>{ENV.FAL_API_KEY=previousKey;});
 const writes:Array<{sql:string;params?:unknown[]}>=[];
 const tracker=createProviderJobTracker({jobId:'job',providerKey:'fal',engineId:'flux-3-draft',prompt:'Animate',inputSummary:{primaryImageUrl:null,primaryAudioUrl:null,referenceImageCount:0,referenceVideoCount:0,referenceAudioCount:0,hasFirstFrame:false,hasLastFrame:false,inputSlots:[]},queryFn:async(sql,params)=>{writes.push({sql,params});}});
 t.mock.method(getFalClient(),'subscribe',async(_model,options)=>{
   options.onQueueUpdate({status:'COMPLETED',request_id:'native-completed'});
   return {requestId:'native-completed',data:{video_url:'https://example.test/output.mp4'}};
 });
 let tracked:Promise<void>|undefined;
 const result=await generateVideo({engineId:'flux-3-draft',prompt:'Animate',mode:'t2v',durationSec:5,resolution:'480p',aspectRatio:'16:9'},{
   onQueueUpdate:status=>tracker.setLastProviderJobId(status.request_id),
   onRequestId:(id,proof)=>{tracked=Promise.all([tracker.persistProviderJobId(id,proof),tracker.persistProviderJobId(id,proof)]).then(()=>{});return tracked;},
 });
 await tracked;
 assert.equal(result.status,'completed');
 const enqueues=writes.filter(write=>write.sql.includes('INSERT INTO fal_queue_log'));
 assert.equal(enqueues.length,1,'queue status must not swallow proof, and repeated request hooks must not duplicate it');
 assert.equal(JSON.parse(String(enqueues[0].params?.[5])).nativeDraftSubmission.endpoint,'blackforestlabs/flux-3/text-to-video/draft');
 });
