import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {getDb} from '../frontend/src/lib/db';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './helpers/disposable-postgres';
import {addTopup} from './helpers/mcp-paid-e2e-harness';
import {creatorOperationInputSchema} from '../frontend/src/lib/toolbox/creator-tools';
import {prepareCreatorProfile} from '../frontend/src/server/tools/creator-profiles';
import {creatorSourceFingerprint} from '../frontend/src/server/tools/creator-sources';
import {resolveStudioMedia} from '../frontend/src/server/studio/media-resolver';
import {resolveOwnedReferenceAssetForActor} from '../frontend/src/server/agent-api/reference-assets';
import {studioReferenceFingerprint} from '../frontend/src/server/agent-api/generation-actor';
import {prepareCreatorLipSyncQuote,confirmCreatorLipSync} from '../frontend/src/server/tools/creator-operations-lipsync';
import {refreshCreatorLipSync} from '../frontend/src/server/tools/creator-operations-lipsync-provider';
import {readCreatorOperation} from '../frontend/src/server/tools/creator-operations-store';
import {createCreatorOperationsService} from '../frontend/src/server/tools/creator-operations';
import {quoteCreatorLipSync} from '../frontend/src/server/tools/creator-profiles-lipsync';
import {quoteCreatorProviderBillingSnapshot} from '../frontend/server/pricing/quote-creator';
test('LatentSync uses canonical wallet reservation once; unknown acceptance refunds once without resubmission',async t=>{
  const pg=await startDisposablePostgres('creator-lipsync');const previous=process.env.DATABASE_URL,gate=process.env.CREATOR_LIP_VIDEO_ENABLED;process.env.DATABASE_URL=pg.databaseUrl;process.env.CREATOR_LIP_VIDEO_ENABLED='1';
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;if(gate===undefined)delete process.env.CREATOR_LIP_VIDEO_ENABLED;else process.env.CREATOR_LIP_VIDEO_ENABLED=gate;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);for(const migration of ['53_studio_media_generation_scope.sql','69_toolbox_generation_scope.sql','71_creator_operations.sql','74_creator_lipsync_pricing.sql'])await pg.pool.query(readFileSync(`neon/migrations/${migration}`,'utf8'));
  await pg.pool.query('CREATE TABLE profiles(id text PRIMARY KEY,preferred_currency text)');
  await addTopup(pg.pool,'owner',10000);await pg.pool.query('CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,status text,kind text,url text)');
  await pg.pool.query(`CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text)`);
  const actor={authMethod:'toolbox-session' as const,userId:'owner',clientId:null};const video='ma_11111111111111111111111111111111',audio='ma_22222222222222222222222222222222';
  await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata) VALUES
    ('video',$1,'owner','video','https://cdn.maxvideoai.com/v.mp4','video/mp4',1234,640,480,'ready','{"durationSec":10,"mediaFacts":{"source":"probe","durationSec":10}}'),
    ('audio',$2,'owner','audio','https://cdn.maxvideoai.com/a.wav','audio/wav',1234,NULL,NULL,'ready','{"durationSec":10}')`,[video,audio]);
  const input=creatorOperationInputSchema.parse({toolId:'lip-sync',version:1,profileId:'lip-video-latentsync-v1',inputs:[{role:'source',source:{type:'asset',assetId:video,kind:'video'}},{role:'audio',source:{type:'asset',assetId:audio,kind:'audio'}}],settings:{mode:'video'}});
  const sources=await Promise.all(input.inputs.map(async entry=>{const original=await resolveStudioMedia('owner',entry.source);return{input:entry,asset:entry.source as {type:'asset';assetId:string;kind:'video'|'audio'},url:original.url,fingerprint:creatorSourceFingerprint(original),facts:{kind:entry.source.kind,width:entry.source.kind==='video'?640:null,height:entry.source.kind==='video'?480:null,durationSec:10,audioDurationSec:10,audioStartSec:0,hasAudio:true,fps:entry.source.kind==='video'?30:null,sizeBytes:1234,mimeType:original.mime}};}));
  const prepared=prepareCreatorProfile(input,sources);const references=await Promise.all(prepared.request.references.map(async ref=>{assert.equal(ref.kind,'asset');return{...await resolveOwnedReferenceAssetForActor(actor,(ref as {assetId:string}).assetId),role:ref.role,...(ref.slot===undefined?{}:{slot:ref.slot})};}));
  const snapshot={...prepared,referenceFingerprint:studioReferenceFingerprint(references)};let submissions=0;
  const dependencies={storageReady:()=>true,providerReady:()=>true,submit:async()=>{submissions++;return{kind:'ambiguous' as const};}};
  const quote=await prepareCreatorLipSyncQuote(actor,snapshot,true,dependencies);assert.ok(quote.price.amountCents>=20);
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  await assert.rejects(confirmCreatorLipSync({...actor,userId:'foreign'},quote.quoteId,true,dependencies));
  await Promise.all([confirmCreatorLipSync(actor,quote.quoteId,true,dependencies),confirmCreatorLipSync(actor,quote.quoteId,true,dependencies)]);
  assert.equal(submissions,1);let operation=await readCreatorOperation(actor,quote.quoteId);assert.equal(operation.provider_state,'ambiguous');
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n,1);
  await pg.pool.query("UPDATE creator_operations SET provider_started_at=now()-interval '16 minutes' WHERE id=$1",[quote.quoteId]);
  operation=await readCreatorOperation(actor,quote.quoteId);
  await Promise.all([refreshCreatorLipSync(actor,operation),refreshCreatorLipSync(actor,operation)]);
  assert.equal((await readCreatorOperation(actor,quote.quoteId)).status,'failed');
  const receipts=(await pg.pool.query("SELECT type,amount_cents FROM app_receipts WHERE job_id=$1 ORDER BY type",[quote.quoteId])).rows;
  assert.deepEqual(receipts.map(row=>row.type),['charge','refund']);assert.equal(receipts[0].amount_cents,receipts[1].amount_cents);
  await confirmCreatorLipSync(actor,quote.quoteId,true,dependencies);assert.equal(submissions,1);
  const changed=await prepareCreatorLipSyncQuote(actor,snapshot,true,dependencies);
  // A changed supplier list cost must invalidate the immutable quote before charging.
  // Generic model margin overrides do not own the creator product's price policy.
  await assert.rejects(confirmCreatorLipSync(actor,changed.quoteId,true,{...dependencies,quote:async(durationSec,pricingDependencies)=>{
    const current=await quoteCreatorLipSync(durationSec,pricingDependencies);
    return quoteCreatorProviderBillingSnapshot({toolId:'lip-sync',facts:{engineId:'toolbox-lip-sync',currency:'USD',vendorSubtotalExactCents:21,unit:'video',quantity:1},base:{...current.base,rate:0.21,amountCents:21},addons:current.addons,vendorAccountId:current.vendorAccountId,meta:{...current.meta,providerCostListUsd:0.21}});
  }}),/price changed/);
  assert.equal(submissions,1);
  assert.equal((await readCreatorOperation(actor,changed.quoteId)).status,'prepared');
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n,1);
  const success=await prepareCreatorLipSyncQuote(actor,snapshot,true,dependencies);
  await confirmCreatorLipSync(actor,success.quoteId,true,{...dependencies,submit:async()=>{submissions++;return{kind:'accepted',requestId:'provider-id'};}});
  let persists=0;const pending=await readCreatorOperation(actor,success.quoteId);
  const observation={poll:async()=>({status:'COMPLETED' as const,request_id:'provider-id',logs:[],metrics:{inference_time:1}}),result:async()=>({data:{video:{url:'https://cdn.maxvideoai.com/output.mp4'}},requestId:'provider-id'}),persist:async()=>{persists++;return{url:'https://cdn.maxvideoai.com/output.mp4',thumbnailUrl:null};}};
  await Promise.all([refreshCreatorLipSync(actor,pending,observation),refreshCreatorLipSync(actor,pending,observation)]);
  assert.equal(persists,1);assert.equal((await readCreatorOperation(actor,success.quoteId)).provider_state,'completed');
  let finalized=0;
  const service=createCreatorOperationsService(actor,{enabled:false,dependencies:{finalize:async(userId,jobId)=>{finalized++;return{toolId:'lip-sync',version:1,jobId,sourceAssets:input.inputs.map(entry=>entry.source),outputs:[{asset:{type:'asset',assetId:video,kind:'video'},kind:'video',originalUrl:'https://cdn.maxvideoai.com/v.mp4'}]};}}});
  assert.equal((await service.status(success.quoteId)).status,'completed');assert.equal((await service.status(success.quoteId)).status,'completed');assert.equal(finalized,1);assert.equal(submissions,2);
});
