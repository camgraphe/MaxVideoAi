import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './helpers/disposable-postgres';
import {createSubtitleJobStore} from '../frontend/src/server/subtitles/jobs';
import {createSubtitleRepository} from '../frontend/src/server/subtitles/repository';
import {runSubtitleOperation,pollSubtitleOperation,reconcileSubtitleOperations} from '../frontend/src/server/subtitles/worker';
import {createSubtitleOperationsService} from '../frontend/src/server/subtitles/operations';
import {buildWorkspaceTimelineRenderManifest} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render';
import {getDb} from '../frontend/src/lib/db';
import {subtitleExportPricing} from '../frontend/src/server/subtitles/pricing';

const source={ref:{type:'asset' as const,assetId:'owned',kind:'video' as const},fingerprint:'a'.repeat(64),durationMs:10000};
test('durable subtitle worker resumes provider polling without resubmission, publishes one document, and refunds only certain failures',async t=>{
  const pg=await startDisposablePostgres('subtitle-worker'),old=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  for(const migration of ['70_subtitle_documents.sql','73_subtitle_operations.sql'])await pg.pool.query(readFileSync(`neon/migrations/${migration}`,'utf8'));
  await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES('owner','topup',500,'USD')");
  const jobs=createSubtitleJobStore({validatePricing:async()=>{},validateSource:async()=>{},preferredCurrency:async()=> 'usd'}),documents=createSubtitleRepository();
  const actor={authMethod:'toolbox-session' as const,userId:'owner',clientId:null};
  const request={source,facts:{durationMs:10000,width:320,height:180,fps:30,hasAudio:true},settings:{keyterms:[]}};
  const reserve=async()=>{const op=await jobs.prepare(actor,'transcribe',request,{totalCents:17,currency:'USD'});await jobs.reserve(actor,op.id);return op.id;};
  let submitted=0,cleaned=0,polled=0,dispatched=0;
  const dependencies={jobs,documents,prepareMix:async()=>{throw new Error('Unexpected unmocked mix preparation');},prepareAudio:async()=>({audioUrl:'https://owned.invalid/audio.wav',storageKey:'audio-key',storageUrl:'https://owned.invalid/audio.wav'}),
    provider:{submit:async()=>{submitted++;return {requestId:'provider-request'};},poll:async()=>{polled++;return {state:'completed' as const,data:{text:'hello',language_code:'eng',words:[{type:'word',text:'hello',start:1,end:2}]}};}},
    cleanupAudio:async()=>{cleaned++;},dispatch:async()=>{dispatched++;},render:async()=>({assetId:'video-owned',originalUrl:'https://owned.invalid/video.mp4'})};
  const id=await reserve();await Promise.all([runSubtitleOperation(id,dependencies),runSubtitleOperation(id,dependencies)]);
  assert.equal(submitted,1);assert.equal((await jobs.readWork(id))?.state,'provider-pending');
  await Promise.all([pollSubtitleOperation(id,dependencies),pollSubtitleOperation(id,dependencies)]);
  assert.equal(submitted,1);assert.ok(polled>=1);assert.equal((await jobs.readWork(id))?.state,'completed');
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM subtitle_documents')).rows[0].n,1);
  assert.equal((await documents.read('owner',`subtitle-${id}`))?.segments[0].text,'hello');
  assert.equal((await documents.read('stranger',`subtitle-${id}`)),null);assert.equal(cleaned,1);
  await runSubtitleOperation(id,dependencies);await pollSubtitleOperation(id,dependencies);assert.equal(submitted,1);
  const uncertain=await reserve();await runSubtitleOperation(uncertain,{...dependencies,provider:{...dependencies.provider,submit:async()=>{submitted++;throw new Error('connection lost after send');}}});
  assert.equal((await jobs.readWork(uncertain))?.state,'submitting');
  await runSubtitleOperation(uncertain,dependencies);assert.equal(submitted,2,'unknown submit acceptance must never be retried automatically');
  await pg.pool.query("UPDATE subtitle_operations SET updated_at=NOW()-INTERVAL '61 minutes' WHERE id=$1",[uncertain]);
  await Promise.all([reconcileSubtitleOperations(dependencies),reconcileSubtitleOperations(dependencies)]);
  assert.equal((await jobs.readWork(uncertain))?.state,'failed');assert.equal(submitted,2,'An ambiguous request expires with a refund, never a second purchase');
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='refund'")).rows[0].n,1);
  const failed=await reserve();await runSubtitleOperation(failed,{...dependencies,prepareAudio:async()=>{throw new Error('SUBTITLE_SOURCE_CHANGED');}});
  assert.equal((await jobs.readWork(failed))?.state,'failed');
  assert.equal((await pg.pool.query("SELECT count(*)::int n,sum(amount_cents)::int amount FROM app_receipts WHERE type='refund'")).rows[0].amount,34);
  const saved=await documents.read('owner',`subtitle-${id}`);assert.ok(saved);
  const exportOperation=await jobs.prepare(actor,'render',{...request,document:saved!},{totalCents:40,currency:'USD'});await jobs.reserve(actor,exportOperation.id);
  await runSubtitleOperation(exportOperation.id,{...dependencies,render:async operation=>{assert.equal(operation.request_snapshot.document?.revision,1);return {assetId:'video-owned',originalUrl:'https://owned.invalid/video.mp4'};}});
  await jobs.fail(exportOperation.id,'must not refund delivered output');
  assert.equal((await jobs.readWork(exportOperation.id))?.state,'completed');assert.equal((await jobs.readWork(exportOperation.id))?.result?.assetId,'video-owned');
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='refund'")).rows[0].n,2);
  const receiptCount=(await pg.pool.query('SELECT count(*)::int n FROM app_receipts')).rows[0].n;
  let checkedSources=0,includedRenders=0;
  const includedJobs=createSubtitleJobStore({validateSource:async()=>{checkedSources++;},preferredCurrency:async()=> 'usd',
    reserve:async()=>{throw new Error('Included rendering must never reserve wallet funds.');}});
  const includedDependencies={jobs:includedJobs,documents,dispatch:async()=>{},
    readSource:async()=>({source,facts:request.facts,originalIdentity:{id:'owned',url:'https://owned.invalid/source.mp4'}})};
  const includedService=createSubtitleOperationsService(actor,{enabled:true,dependencies:includedDependencies});
  await assert.rejects(createSubtitleOperationsService({...actor,userId:'stranger'},{enabled:true,dependencies:includedDependencies}).prepareExport({documentId:saved!.id,revision:1}),/NOT_FOUND/);
  await assert.rejects(includedJobs.prepare(actor,'transcribe',request,subtitleExportPricing(request.facts)),/PRICING_UNAVAILABLE/);
  const included=await includedService.prepareExport({documentId:saved!.id,revision:1});
  assert.equal(included.quote.price.amountCents,0);
  const recoveredExport=await includedService.status(included.operationId);
  assert.deepEqual(recoveredExport.subtitle,{source:source.ref,settings:{keyterms:[]},document:{id:saved!.id,revision:1}});
  assert.deepEqual(recoveredExport.quote,included.quote);
  await Promise.all([includedService.confirm({operationId:included.operationId,confirmed:true}),includedService.confirm({operationId:included.operationId,confirmed:true})]);
  const renderIncluded=async()=>{includedRenders++;return {assetId:'included-result'};};
  await Promise.all([runSubtitleOperation(included.operationId,{...dependencies,jobs:includedJobs,render:renderIncluded}),runSubtitleOperation(included.operationId,{...dependencies,jobs:includedJobs,render:renderIncluded})]);
  assert.equal((await includedJobs.readWork(included.operationId))?.state,'completed');
  assert.equal((await pg.pool.query('SELECT payment_status,final_price_cents FROM app_jobs WHERE job_id=$1',[`subtitle_${included.operationId}`])).rows[0].payment_status,'platform');
  assert.equal(includedRenders,1);assert.equal(checkedSources,1);
  const edited=await documents.update(actor.userId,saved!.id,1,'included-edit',{style:{...saved!.style,preset:'clean'},segments:[{...saved!.segments[0],text:'Corrected text'}]});
  const editedExport=await includedService.prepareExport({documentId:edited.id,revision:edited.revision});
  assert.equal(editedExport.quote.price.amountCents,0);
  await includedService.confirm({operationId:editedExport.operationId,confirmed:true});
  await runSubtitleOperation(editedExport.operationId,{...dependencies,jobs:includedJobs,render:async()=>{throw new Error('Render failed');}});
  await includedJobs.fail(editedExport.operationId,'Repeated failure');
  assert.equal((await includedJobs.readWork(editedExport.operationId))?.state,'failed');
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM app_receipts')).rows[0].n,receiptCount,'Included success/failure creates neither charge nor refund receipts');
  const oldPending=await includedJobs.prepare(actor,'render',{...request,document:saved!},{totalCents:40,currency:'USD',source:'timeline-export-paid-policy'});
  await assert.rejects(includedJobs.reserve(actor,oldPending.id),/QUOTE_EXPIRED/);
  assert.equal((await jobs.readWork(exportOperation.id))?.pricing_snapshot.totalCents,40,'Accepted historical export keeps its original paid amount');
  const queued=await reserve();await reconcileSubtitleOperations(dependencies);assert.equal(dispatched,1);assert.equal((await jobs.readWork(queued))?.state,'queued','HTTP cron dispatches bounded workers, never starts inline rendering');
  const expired=await jobs.claim(queued);assert.ok(expired);await pg.pool.query("UPDATE subtitle_operations SET lease_until=NOW()-INTERVAL '1 second' WHERE id=$1",[queued]);
  const resumed=await jobs.claim(queued);assert.ok(resumed);await assert.rejects(jobs.complete(queued,{documentId:'stale'},expired!.lease_token),/CLAIM_LOST/);
  await pg.pool.query("UPDATE subtitle_operations SET lease_until=NOW()-INTERVAL '1 second' WHERE id=$1",[queued]);
  await runSubtitleOperation(queued,dependencies);assert.equal((await jobs.readWork(queued))?.state,'provider-pending');
  const manifest=buildWorkspaceTimelineRenderManifest({items:[{id:'voice',outputNodeId:'voice',track:'audio',mediaKind:'audio',mediaUrl:'https://owned.invalid/source.wav',startSec:0,durationSec:10,sourceStartSec:0,sourceDurationSec:10,title:'Voice',status:'completed'}],nodes:[],projectName:'Film',sequenceId:'sequence',sequenceName:'The film mix',projectSettings:{fps:30,resolution:'720p',aspectRatio:'16:9'}});
  const sequence={projectId:'project',sequenceId:'sequence',revision:7,audioManifestHash:'b'.repeat(64),manifest,media:[]};
  const service=createSubtitleOperationsService(actor,{enabled:true,dependencies:{jobs,readSequence:async()=>sequence,quoteTranscription:async()=>({totalCents:17,currency:'USD'}),dispatch:async()=>{}}});
  const mix=await service.prepareStudioSubtitles({projectId:'project',sequenceId:'sequence',expectedRevision:7});
  assert.deepEqual(mix.sourceSummary,{kind:'sequence',name:'The film mix',revision:7});
  assert.deepEqual((await service.status(mix.operationId)).subtitle,{source:null,settings:{keyterms:[]},sequence:{projectId:'project',sequenceId:'sequence',expectedRevision:7}});
  const breakdown=mix.quote.breakdown as {transcription:{amountCents:number};mixPreparation:{amountCents:number;source:string}};
  assert.equal(mix.quote.price.amountCents,breakdown.transcription.amountCents);assert.equal(breakdown.mixPreparation.source,'subtitle-mix-included-v1');assert.equal(breakdown.mixPreparation.amountCents,0);
  await service.confirm({operationId:mix.operationId,confirmed:true});
  const mixedSource={ref:{type:'asset' as const,assetId:'owned-mix-audio',kind:'audio' as const},fingerprint:'c'.repeat(64),durationMs:10000,sequenceMix:{sequenceId:'sequence',revision:7,audioManifestHash:sequence.audioManifestHash}};
  let mixes=0;
  const mixDependencies={...dependencies,prepareMix:async()=>{mixes++;return {source:mixedSource,audioUrl:'https://owned.invalid/mix.wav',storageKey:'mix-key',storageUrl:'https://owned.invalid/mix.wav',retainAsAsset:true};}};
  // Force the second caller to win the PostgreSQL lease, independently of connection scheduling.
  let releaseSecondClaim!:()=>void;
  const secondClaimed=new Promise<void>(resolve=>{releaseSecondClaim=resolve;}),winners:number[]=[];
  const contender=(index:number)=>({...mixDependencies,jobs:{...jobs,claim:async(operationId:string)=>{
    if(index===0)await secondClaimed;
    try{const claim=await jobs.claim(operationId);if(claim)winners.push(index);return claim;}
    finally{if(index===1)releaseSecondClaim();}
  }}});
  const submitsBeforeMix=submitted;
  await Promise.all([runSubtitleOperation(mix.operationId,contender(0)),runSubtitleOperation(mix.operationId,contender(1))]);
  assert.deepEqual(winners,[1],'The second invocation must be the one that owns the work');
  assert.equal(mixes,1);assert.equal(submitted,submitsBeforeMix+1);assert.equal((await jobs.readWork(mix.operationId))?.state,'provider-pending');assert.equal((await jobs.readWork(mix.operationId))?.request_snapshot.source,null,'No fictitious source exists before the worker creates the owned audio');
  await pollSubtitleOperation(mix.operationId,dependencies);
  assert.deepEqual((await documents.read('owner',`subtitle-${mix.operationId}`))?.source,mixedSource);
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge' AND job_id=$1",[(await jobs.readWork(mix.operationId))?.job_id])).rows[0].n,1);

});
