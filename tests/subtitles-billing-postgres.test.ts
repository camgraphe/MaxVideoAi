import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './helpers/disposable-postgres';
import {createSubtitleJobStore} from '../frontend/src/server/subtitles/jobs';
import {createSubtitleOperationsService} from '../frontend/src/server/subtitles/operations';
import {quoteSubtitleTranscription} from '../frontend/src/server/tools/creator-subtitle-pricing';
import {loadPricingPolicyOverridesWithExecutor} from '../frontend/src/lib/pricing-rule-store';
import {getDb} from '../frontend/src/lib/db';
import {projectCanonicalQuoteToSnapshot,quoteCanonicalPricing} from '@maxvideoai/pricing';
import {getVersionedPricingPolicy} from '../frontend/src/lib/pricing-policy-defaults';
test('subtitle purchases recheck account restrictions, locked pricing and aggregate spending across concurrent OAuth confirmations',async t=>{
  const pg=await startDisposablePostgres('subtitle-billing'),old=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);for(const file of ['72_subtitle_pricing.sql','73_subtitle_operations.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
  await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES('owner','topup',500,'USD')");
  const jobs=createSubtitleJobStore({validateSource:async()=>{},preferredCurrency:async()=> 'usd'}),actor={authMethod:'oauth' as const,userId:'owner',clientId:'client'};
  const source={ref:{type:'asset' as const,assetId:'owned',kind:'audio' as const},fingerprint:'a'.repeat(64),durationMs:240000};
  const service=createSubtitleOperationsService(actor,{enabled:true,dependencies:{jobs,dispatch:async()=>{},readSource:async()=>({source,originalIdentity:{id:'asset',url:'https://cdn.maxvideoai.com/source.wav'},facts:{durationMs:source.durationMs,width:0,height:0,fps:0,hasAudio:true}}),quoteTranscription:async input=>({...await quoteSubtitleTranscription(input,{pricingPolicy:{loadOverrides:()=>loadPricingPolicyOverridesWithExecutor({query:async(sql,values)=>(await pg.pool.query(sql,values)).rows})}})})}});
  const prepare=()=>service.prepare({source:source.ref}),confirm=(operationId:string)=>service.confirm({operationId,confirmed:true});
  const prepared=await prepare();assert.equal(prepared.quote.price.amountCents,7);
  await pg.pool.query("UPDATE mcp_spending_limits SET per_generation_cents=6 WHERE user_id='owner'");
  await assert.rejects(prepare(),error=>(error as {code:string}).code==='SPENDING_LIMIT_EXCEEDED');
  await assert.rejects(confirm(prepared.operationId),error=>(error as {code:string}).code==='SPENDING_LIMIT_EXCEEDED');
  await pg.pool.query("UPDATE mcp_spending_limits SET per_generation_cents=NULL WHERE user_id='owner'");
  await pg.pool.query("INSERT INTO user_account_restrictions(user_id,reason) VALUES('owner','fixture')");
  await assert.rejects(prepare(),error=>(error as {code:string}).code==='ACCOUNT_RESTRICTED');await assert.rejects(confirm(prepared.operationId),error=>(error as {code:string}).code==='ACCOUNT_RESTRICTED');
  await pg.pool.query("UPDATE user_account_restrictions SET active=FALSE WHERE user_id='owner'");
  await pg.pool.query("UPDATE app_pricing_rules SET margin_percent=1.6 WHERE id='toolbox-subtitles'");
  assert.equal((await prepare()).quote.price.amountCents,7,'The scoped 120% markup replaces the legacy DB margin instead of stacking it');
  // Reproduce a valid prepared snapshot from the former 150% policy. A new
  // confirmation must reject that historical price before reserving funds.
  const legacyRule={id:'toolbox-subtitles',engineId:'toolbox-subtitles',marginPercent:1.5,marginFlatCents:0,surchargeAudioPercent:0,surchargeUpscalePercent:0,currency:'USD'};
  const legacyPricing=projectCanonicalQuoteToSnapshot({quote:quoteCanonicalPricing({
    facts:{engineId:'toolbox-subtitles',currency:'USD',vendorSubtotalExactCents:3.2,unit:'audio',quantity:1},
    scenario:{id:'billing:toolbox-subtitles:transcription',engineId:'toolbox-subtitles',mode:'transcription',membershipTier:'member',discountPercent:0},
    policy:{rule:legacyRule,source:'database',matchedBy:'engine',sourceRuleId:legacyRule.id},
    compatibilityProfile:getVersionedPricingPolicy().compatibilityProfiles.find(profile=>profile.id==='standard')!,
  }),base:{seconds:240,rate:0.008/60,unit:'audio',amountCents:3.2},addons:[]});
  assert.equal(legacyPricing.totalCents,8);
  const legacy=await jobs.prepare(actor,'transcribe',(await jobs.read(actor,prepared.operationId)).request_snapshot,{...legacyPricing});
  await assert.rejects(confirm(legacy.id),/SUBTITLE_QUOTE_EXPIRED/);
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  await pg.pool.query("UPDATE app_pricing_rules SET margin_percent=1.5 WHERE id='toolbox-subtitles'");
  await pg.pool.query("UPDATE mcp_spending_limits SET daily_cents=7 WHERE user_id='owner'");
  const [a,b]=await Promise.all([prepare(),prepare()]);const result=await Promise.allSettled([confirm(a.operationId),confirm(b.operationId)]);
  assert.equal(result.filter(value=>value.status==='fulfilled').length,1);assert.equal(result.filter(value=>value.status==='rejected'&&(value.reason as {code:string}).code==='SPENDING_LIMIT_EXCEEDED').length,1);
  assert.equal((await pg.pool.query("SELECT sum(price_cents)::int total FROM mcp_generation_quotes WHERE state='accepted'")).rows[0].total,7,'The canonical spending owner counts accepted subtitles');
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,1);
  assert.equal((await pg.pool.query("SELECT sum(amount_cents)::int total FROM app_receipts WHERE type='charge'")).rows[0].total,7);
  await assert.rejects(prepare(),error=>(error as {code:string}).code==='SPENDING_LIMIT_EXCEEDED');
  const paid=result.find(value=>value.status==='fulfilled')! as PromiseFulfilledResult<Awaited<ReturnType<typeof confirm>>>;
  await jobs.fail(paid.value.operationId,'Fixture failure');assert.equal((await pg.pool.query("SELECT state FROM mcp_generation_quotes WHERE quote_id=$1",[paid.value.operationId])).rows[0].state,'failed');await prepare();
  assert.equal((await pg.pool.query("SELECT count(*)::int n,sum(amount_cents)::int total FROM app_receipts WHERE type='refund'")).rows[0].total,7,'Failure refunds the exact accepted charge');
});
