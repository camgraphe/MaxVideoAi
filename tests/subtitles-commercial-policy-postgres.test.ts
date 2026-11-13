import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { projectCanonicalQuoteToSnapshot, quoteCanonicalPricing } from '@maxvideoai/pricing';
import { DEFAULT_SUBTITLE_STYLE } from '../frontend/src/lib/subtitles/document';
import { getDb } from '../frontend/src/lib/db';
import { getVersionedPricingPolicy } from '../frontend/src/lib/pricing-policy-defaults';
import { loadPricingPolicyOverridesWithExecutor } from '../frontend/src/lib/pricing-rule-store';
import { createSubtitleJobStore, type SubtitleOperationRequest } from '../frontend/src/server/subtitles/jobs';
import { createSubtitleOperationsService } from '../frontend/src/server/subtitles/operations';
import { subtitleMixPricing } from '../frontend/src/server/subtitles/pricing';
import { quoteSubtitleTranscription } from '../frontend/src/server/tools/creator-subtitle-pricing';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

/** Frozen former source policy; this is historical fixture authoring, not a live quote owner. */
function former120PercentSnapshot(seconds:number) {
  const providerUsd=seconds/60*0.008,providerCents=providerUsd*100;
  const policyId='creator-tools:provider-plus-120:v1';
  return projectCanonicalQuoteToSnapshot({quote:quoteCanonicalPricing({
    facts:{engineId:'toolbox-subtitles',currency:'USD',vendorSubtotalExactCents:providerCents,unit:'audio',quantity:1},
    scenario:{id:'billing:creator:subtitles:toolbox-subtitles',engineId:'toolbox-subtitles',membershipTier:'member',discountPercent:0},
    policy:{source:'versioned',matchedBy:'precise',sourceRuleId:policyId,rule:{id:policyId,engineId:'toolbox-subtitles',currency:'USD',marginPercent:1.2,marginFlatCents:0,surchargeAudioPercent:0,surchargeUpscalePercent:0,compatibilityProfile:'standard'}},
    compatibilityProfile:getVersionedPricingPolicy().compatibilityProfiles.find(profile=>profile.id==='standard')!,
  }),base:{seconds,rate:0.008/60,unit:'audio',amountCents:providerCents},addons:[],vendorAccountId:null,
    meta:{surface:'tool',toolId:'subtitles',operation:'transcription',providerCostKind:'list-reference',providerCostSource:'https://fal.ai/models/fal-ai/elevenlabs/speech-to-text/scribe-v2',providerCostCheckedAt:'2026-10-19',providerCostListUsd:providerUsd,keytermsSurchargePercent:0,
      creatorPricingPolicy:policyId,providerCostExactCents:providerCents,providerCostMultiplier:2.2,ruleId:policyId},
  });
}

test('subtitle 200% policy rejects stale 120% preparations, preserves accepted history and includes mix/export without another charge',async t=>{
  const pg=await startDisposablePostgres('subtitle-policy'),previous=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  for(const migration of ['72_subtitle_pricing.sql','73_subtitle_operations.sql'])await pg.pool.query(readFileSync('neon/migrations/'+migration,'utf8'));
  await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES('owner','topup',1000,'USD')");
  const actor={authMethod:'oauth' as const,userId:'owner',clientId:'host'};
  const source=(seconds:number)=>({ref:{type:'asset' as const,assetId:'audio-'+seconds,kind:'audio' as const},fingerprint:'a'.repeat(64),durationMs:seconds*1000});
  const facts=(seconds:number)=>({durationMs:seconds*1000,width:320,height:180,fps:30,hasAudio:true});
  const request=(seconds:number):SubtitleOperationRequest=>({source:source(seconds),facts:facts(seconds),originalIdentity:{id:'owned-'+seconds,url:'https://cdn.maxvideoai.com/audio-'+seconds+'.wav'},settings:{keyterms:[]}});
  const pricingPolicy={loadOverrides:()=>loadPricingPolicyOverridesWithExecutor({query:async(sql,values)=>(await pg.pool.query(sql,values)).rows})};
  const jobs=createSubtitleJobStore({validateSource:async()=>{},preferredCurrency:async()=> 'usd'});let dispatches=0;
  const service=createSubtitleOperationsService(actor,{enabled:true,dependencies:{jobs,dispatch:async()=>{dispatches++;},
    readSource:async(userId,ref)=>{assert.equal(userId,'owner');assert.equal(ref.type,'asset');const seconds=Number((ref as {assetId:string}).assetId.slice(6));const input=request(seconds);return{source:{...input.source!,ref},facts:input.facts,originalIdentity:input.originalIdentity!};},
    documents:{read:async()=>({version:1,id:'captions-current',revision:1,source:{...source(240),ref:{type:'asset',assetId:'video-240',kind:'video'}},language:'eng',words:[],segments:[{id:'line',text:'Hello.',startMs:0,endMs:1000,wordIds:[],alignment:'edited'}],style:DEFAULT_SUBTITLE_STYLE})} as never,
    quoteTranscription:async input=>({...await quoteSubtitleTranscription(input,{pricingPolicy})}),
    readSequence:async()=>({projectId:'film',sequenceId:'main',revision:1,audioManifestHash:'b'.repeat(64),media:[],manifest:{sequenceName:'Main',durationSec:240,projectSettings:{aspectRatio:'16:9',resolution:'720p',fps:30}}}) as never,
  }});
  for(const seconds of [10,240]) {
    const legacy=former120PercentSnapshot(seconds);assert.equal(legacy.totalCents,seconds===10?1:7);
    const operation=await jobs.prepare(actor,'transcribe',request(seconds),{...legacy});
    await assert.rejects(service.confirm({operationId:operation.id,confirmed:true}),/SUBTITLE_QUOTE_EXPIRED/);
    const preserved=await jobs.read(actor,operation.id);assert.equal(preserved.state,'prepared');assert.deepEqual(preserved.pricing_snapshot,legacy);
  }
  const mixRequest={...request(240),source:null};
  const staleMix=await jobs.prepare(actor,'mix-transcribe',mixRequest,subtitleMixPricing({...former120PercentSnapshot(240)},facts(240)));
  await assert.rejects(service.confirm({operationId:staleMix.id,confirmed:true}),/SUBTITLE_QUOTE_EXPIRED/);
  assert.equal(dispatches,0);assert.equal((await pg.pool.query('SELECT count(*)::int n FROM app_jobs')).rows[0].n,0);
  // Simulate a real previously accepted operation using its exact former validator and normal ledger reservation.
  const historical=former120PercentSnapshot(240);
  const priorJobs=createSubtitleJobStore({validateSource:async()=>{},preferredCurrency:async()=> 'usd',validatePricing:async operation=>{assert.deepEqual(operation.pricing_snapshot,historical);}});
  const old=await priorJobs.prepare(actor,'transcribe',request(240),{...historical});
  await priorJobs.reserve(actor,old.id);
  const acceptedBefore=(await pg.pool.query('SELECT final_price_cents,pricing_snapshot FROM app_jobs WHERE job_id=$1',['subtitle_'+old.id])).rows[0];assert.equal(acceptedBefore.final_price_cents,7);
  assert.equal((await service.confirm({operationId:old.id,confirmed:true})).quote.price.amountCents,7);
  assert.equal((await jobs.reserve(actor,old.id)).created,false);assert.equal(dispatches,0);
  const current=await service.prepare({source:source(240).ref});assert.equal(current.quote.price.amountCents,10);
  const currentRow=await jobs.read(actor,current.operationId);assert.equal((currentRow.pricing_snapshot.meta as any).creatorPricingPolicy,'creator-subtitles:provider-plus-200:v1');
  assert.equal(current.exportEstimate,null,'Audio-only transcription does not invent a video export.');
  await service.confirm({operationId:current.operationId,confirmed:true});await service.confirm({operationId:current.operationId,confirmed:true});assert.equal(dispatches,1);
  const mix=await service.prepareStudioSubtitles({projectId:'film',sequenceId:'main',expectedRevision:1});assert.equal(mix.quote.price.amountCents,10);
  assert.deepEqual(mix.quote.breakdown,{transcription:{amountCents:10,currency:'USD'},mixPreparation:{amountCents:0,currency:'USD',source:'subtitle-mix-included-v1',included:true}});
  await service.confirm({operationId:mix.operationId,confirmed:true});await service.confirm({operationId:mix.operationId,confirmed:true});assert.equal(dispatches,2);
  const keywordMix=await service.prepareStudioSubtitles({projectId:'film',sequenceId:'main',expectedRevision:1,keyterms:['MaxVideoAI']});assert.equal(keywordMix.quote.price.amountCents,13);
  const video=await service.prepare({source:{type:'asset',assetId:'video-240',kind:'video'}});assert.equal(video.quote.price.amountCents,10);assert.equal(video.exportEstimate?.amountCents,0);
  const render=await service.prepareExport({documentId:'captions-current',revision:1});assert.equal(render.quote.price.amountCents,0);
  await service.confirm({operationId:render.operationId,confirmed:true});await service.confirm({operationId:render.operationId,confirmed:true});assert.equal(dispatches,3);
  await jobs.fail(render.operationId,'Included export failed');
  assert.equal((await pg.pool.query('SELECT payment_status FROM app_jobs WHERE job_id=$1',['subtitle_'+render.operationId])).rows[0].payment_status,'platform');
  await jobs.fail(old.id,'Historical accepted attempt failed');await jobs.fail(old.id,'Duplicate failure');
  assert.equal((await service.confirm({operationId:old.id,confirmed:true})).state,'failed');assert.equal(dispatches,3);
  const acceptedAfter=(await pg.pool.query('SELECT final_price_cents,pricing_snapshot FROM app_jobs WHERE job_id=$1',['subtitle_'+old.id])).rows[0];assert.deepEqual(acceptedAfter,acceptedBefore);
  assert.equal((await pg.pool.query("SELECT count(*)::int n,sum(amount_cents)::int amount FROM app_receipts WHERE type='refund'")).rows[0].amount,7);
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='refund'")).rows[0].n,1);
  assert.equal((await pg.pool.query("SELECT count(*)::int n,sum(amount_cents)::int amount FROM app_receipts WHERE type='charge'")).rows[0].amount,27);
  const quote=(await pg.pool.query('SELECT price_cents,pricing_snapshot FROM mcp_generation_quotes WHERE quote_id=$1',[old.id])).rows[0];assert.equal(quote.price_cents,7);assert.deepEqual(quote.pricing_snapshot,historical);
});
