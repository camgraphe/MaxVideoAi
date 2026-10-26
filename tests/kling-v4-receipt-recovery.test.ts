import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { submitFalQueueOnce } from '../frontend/src/lib/fal-queue-submit';
import { ENV } from '../frontend/src/lib/env';
import { getDb } from '../frontend/src/lib/db';
import { getFalClient } from '../frontend/src/lib/fal-client';
import { refreshStaleFalJobs } from '../frontend/app/api/jobs/_lib/jobs-fal-refresh';
import { resolveFalJobQueue } from '../frontend/server/fal-job-queue';
import { parseFalQueueReceipt } from '../frontend/src/lib/fal-queue-receipt';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { mapRecentGenerationRecordToWeb } from '../frontend/src/server/generations/recent-generations';
import { createProviderJobTracker } from '../frontend/app/api/generate/_lib/provider-job-tracker';

const endpoint = 'kling/v4/video-to-video/edit';
const requestId = 'offline-receipt-id';
// Valid full endpoint path deliberately differs from the SDK's kling/v4 parent.
const base = `https://queue.fal.run/${endpoint}/requests/${requestId}`;
const receipt = {request_id:requestId,status_url:`${base}/status`,response_url:base,cancel_url:`${base}/cancel`};
const inputSummary = {primaryImageUrl:null,primaryAudioUrl:null,referenceImageCount:0,referenceVideoCount:0,referenceAudioCount:0,hasFirstFrame:false,hasLastFrame:false,inputSlots:[]};

test('accepted V4 receipt is durably associated with its actual provider job before returning', async (t) => {
  const db = await startDisposablePostgres('kling-v4-receipt');
  const previousUrl = process.env.DATABASE_URL;
  const previousKey = ENV.FAL_API_KEY;
  process.env.DATABASE_URL = db.databaseUrl; ENV.FAL_API_KEY = 'offline-only';
  try {
    await db.pool.query(`CREATE TABLE app_jobs(job_id TEXT PRIMARY KEY, provider TEXT, provider_job_id TEXT, engine_id TEXT, settings_snapshot JSONB, updated_at TIMESTAMPTZ);
      CREATE TABLE fal_queue_log(id BIGSERIAL PRIMARY KEY,job_id TEXT,provider TEXT,provider_job_id TEXT,engine_id TEXT,status TEXT,payload JSONB,created_at TIMESTAMPTZ DEFAULT NOW());
      INSERT INTO app_jobs(job_id,engine_id) VALUES ('owned-job','kling-v4');`);
    const queryFn = async(sql:string,params?:unknown[]) => (await db.pool.query(sql,params)).rows;
    const tracker = createProviderJobTracker({jobId:'owned-job',providerKey:'fal',engineId:'kling-v4',prompt:'Offline',inputSummary,queryFn});
    let posts = 0;
    const transport = async () => { posts++; return new Response(JSON.stringify(receipt),{status:202}); };
    await submitFalQueueOnce(endpoint,{prompt:'Offline'},'owned-job',transport,
      async(id,identity) => tracker.persistProviderJobId(id,undefined,identity));
    const job = (await db.pool.query('SELECT * FROM app_jobs')).rows[0];
    assert.equal(job.provider_job_id,requestId);
    const recorded = (await db.pool.query('SELECT payload FROM fal_queue_log')).rows[0].payload.falQueueReceipt;
    assert.equal(recorded.requestId,requestId);
    assert.equal(recorded.endpoint,endpoint);
    assert.equal(recorded.statusUrl,receipt.status_url);
    assert.equal(recorded.responseUrl,receipt.response_url);
    assert.equal(recorded.cancelUrl,receipt.cancel_url);
    assert.equal(posts,1);
    let reads = 0, legacyReads = 0;
    t.mock.method(getFalClient().queue,'status',async()=>{ legacyReads++; return null; });
    t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL,init?:RequestInit)=>{
      assert.equal(String(url),receipt.status_url); assert.equal(init?.method,'GET');
      assert.equal(init?.redirect,'error'); reads++;
      return new Response(JSON.stringify({request_id:requestId,status:'IN_PROGRESS'}),{status:202});
    });
    await refreshStaleFalJobs({rows:[{job_id:'owned-job',provider_job_id:requestId,engine_id:'kling-v4',surface:'video',provider:'fal',status:'queued'} as never],shouldRefreshStaleFalJobs:true,userId:'owner'});
    assert.equal(reads,1,'actual stale recovery follows the stored receipt');
    assert.equal(legacyReads,0,'new receipt never reconstructs an SDK path');
    // Fresh reader has no submit closure or in-memory identity: process-restart seam.
    const restarted = await resolveFalJobQueue({jobId:'owned-job',engineId:'kling-v4',requestId,legacyModel:'kling/v4/text-to-video'}, {
      fetchFn:async(url,init)=>{
        assert.equal(init?.redirect,'error'); assert.equal(init?.method,'GET');
        reads++;
        if(String(url)===receipt.status_url) return new Response(JSON.stringify({request_id:requestId,status:'COMPLETED'}));
        assert.equal(String(url),receipt.response_url);
        return new Response(JSON.stringify({video:{url:'https://fal.media/offline.mp4'}}));
      },
    });
    assert.equal((await restarted.status()).status,'COMPLETED');
    assert.equal((await restarted.result()).data.video.url,'https://fal.media/offline.mp4');
    assert.equal(posts,1); assert.equal(reads,3); assert.equal(legacyReads,0);
    const persisted = (await db.pool.query('SELECT payload FROM fal_queue_log')).rows[0].payload;
    assert.equal(persisted.falQueueReceipt.cancelUrl,receipt.cancel_url);
    const visible=mapRecentGenerationRecordToWeb({job_id:'owned-job',engine_id:'kling-v4',surface:'video',status:'queued',provider_job_id:requestId,settings_snapshot:{},...persisted} as never);
    assert.equal(JSON.stringify(visible).includes('queue.fal.run'),false);
    // A real matching historical job and ID-only enqueue establish compatibility.
    await db.pool.query(`INSERT INTO app_jobs(job_id,engine_id,provider,provider_job_id)
      VALUES ('old-job','kling-v4','fal','old-request');
      INSERT INTO fal_queue_log(job_id,engine_id,provider,provider_job_id,status,payload)
      VALUES ('old-job','kling-v4','fal','old-request','enqueue','{"provider":"fal","engineId":"kling-v4"}');`);
    const legacy=await resolveFalJobQueue({jobId:'old-job',engineId:'kling-v4',requestId:'old-request',legacyModel:endpoint});
    await legacy.status(); assert.equal(legacyReads,1); assert.equal(posts,1);
    // Persisted invalid receipt is never downgraded into that legacy fallback.
    for(const invalid of [
      {...recorded,statusUrl:'https://evil.example/stolen'},
      {...recorded,requestId:'different-request'},
      {...recorded,endpoint:'kling/v4/text-to-video'},
      {requestId,endpoint,metadataState:'missing'},
    ]) {
      await db.pool.query("UPDATE fal_queue_log SET payload = jsonb_build_object('falQueueReceipt', $1::jsonb) WHERE job_id='owned-job'",[JSON.stringify(invalid)]);
      const blocked=await resolveFalJobQueue({jobId:'owned-job',engineId:'kling-v4',requestId,legacyModel:endpoint});
      await assert.rejects(blocked.status(),/receipt metadata/);
      await refreshStaleFalJobs({rows:[{job_id:'owned-job',provider_job_id:requestId,engine_id:'kling-v4',surface:'video',provider:'fal',status:'queued'} as never],shouldRefreshStaleFalJobs:true,userId:'owner'});
      assert.equal(legacyReads,1); assert.equal(reads,3); assert.equal(posts,1);
    }
  } finally {
    await getDb().end(); await db.cleanup(); ENV.FAL_API_KEY = previousKey;
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
  }
});


test('receipt validation rejects origin, credentials, request, endpoint, redirect and query attacks', async () => {
  for(const status_url of [
    'http://queue.fal.run/'+endpoint+'/requests/'+requestId+'/status',
    receipt.status_url.replace('queue.fal.run','queue.fal.run.evil.example'),
    receipt.status_url.replace('queue.fal.run','name:secret@queue.fal.run'),
    receipt.status_url.replace(requestId,'other-request'),
    receipt.status_url.replace(endpoint,'kling/v4/text-to-video'),
    receipt.status_url+'?destination=https://evil.example',
    receipt.status_url+'#fragment',
    receipt.status_url.replace('/requests/','/requests/%2e%2e/requests/'),
  ]) {
    const parsed=parseFalQueueReceipt(endpoint,requestId,{...receipt,status_url});
    assert.equal(parsed.metadataState,'invalid');
    assert.equal(parsed.statusUrl,undefined);
  }
  assert.equal(parseFalQueueReceipt(endpoint,requestId,{...receipt,request_id:'other'}).metadataState,'invalid');
  assert.equal(parseFalQueueReceipt(endpoint,requestId,{request_id:requestId}).metadataState,'missing');
  // A signed/private URL is not copied to an error or the durable unavailable marker.
  assert.equal(JSON.stringify(parseFalQueueReceipt(endpoint,requestId,{...receipt,status_url:'https://evil.example/?secret=private'})).includes('private'),false);
});

test('accepted IDs survive malformed/missing URL metadata with exactly one POST and no substitute',async()=>{
  for(const receiptBody of [{request_id:requestId},{...receipt,status_url:'https://evil.example/status'}]) {
    let posts=0,accepted=''; let state='';
    const id=await submitFalQueueOnce(endpoint,{},'owned-job',async()=>{posts++;return new Response(JSON.stringify(receiptBody),{status:202});},async(id,identity)=>{accepted=id;state=identity.metadataState;});
    assert.equal(id,requestId);assert.equal(accepted,requestId);assert.equal(posts,1);assert.notEqual(state,'verified');
  }
});

test('caller tracking metadata is refused at canonical request and settings admission',()=>{
  const raw={surface:'video',engineId:'kling-v4',mode:'t2v',prompt:'Offline',settings:{durationSec:5,resolution:'720p'},references:[]};
  for(const name of ['falQueueReceipt','falQueueReceiptRequired','status_url','response_url','cancel_url','providerJobId']) {
    assert.throws(()=>normalizeGenerationRequest({...raw,[name]:receipt}));
    assert.throws(()=>normalizeGenerationRequest({...raw,settings:{...raw.settings,[name]:receipt}}));
  }
});
