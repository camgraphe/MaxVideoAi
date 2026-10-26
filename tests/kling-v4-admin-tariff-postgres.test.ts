import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {startDisposablePostgres} from './helpers/disposable-postgres';
import {getDb} from '../frontend/src/lib/db';
import {loadCustomerTariffScenarioDetail,previewCustomerTariffChange,confirmCustomerTariffChange,loadCustomerTariffHistory} from '../frontend/server/pricing-admin/customer-tariff-service';
import {isKlingV4ReleaseBlocked} from '../frontend/src/server/video-generation/kling-v4-release-policy';

test('canonical admin can preview and stage the new V4 class without an old retail amount; stale confirmation fails',async()=>{
 const db=await startDisposablePostgres('kling-v4-admin');
 const previous={DATABASE_URL:process.env.DATABASE_URL,NODE_ENV:process.env.NODE_ENV,PRICING_SANDBOX:process.env.PRICING_SANDBOX};
 Object.assign(process.env,{DATABASE_URL:db.databaseUrl,NODE_ENV:'development',PRICING_SANDBOX:'1'});
 try{
  await db.pool.query(`CREATE TABLE app_pricing_rules(id TEXT PRIMARY KEY,engine_id TEXT,resolution TEXT,mode TEXT,margin_percent NUMERIC,margin_flat_cents INTEGER,surcharge_audio_percent NUMERIC,surcharge_upscale_percent NUMERIC,currency TEXT,compatibility_profile TEXT,vendor_account_id TEXT,effective_from TIMESTAMPTZ,updated_at TIMESTAMPTZ,updated_by UUID);
   CREATE TABLE app_pricing_change_events(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),domain TEXT NOT NULL CHECK(domain IN('policy_rule','membership','billing_product')),operation TEXT NOT NULL CHECK(operation IN('create','update','delete','rollback')),target_id TEXT NOT NULL,actor_id UUID NOT NULL,previous_state JSONB,next_state JSONB,preview_summary JSONB NOT NULL,affected_scenario_ids JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
  for(const file of ['54_customer_tariff_cells.sql','55_customer_tariff_versions.sql'])await db.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
  const detail=await loadCustomerTariffScenarioDetail('kling-v4',{mode:'ref2v',resolution:'720p',durationSec:'5',billingInputType:'video_input',inputVideoDurationSec:'10.2501'});
  assert.equal(detail.currentCents,null);assert.equal(detail.continuousInputTariff?.price,null);
  const proposal={operation:'create' as const,scenarioId:detail.scenarioId,scope:'continuous_input' as const,price:{kind:'kling_v4_billable' as const,customerCentsPerBillableSecond:20}};
  const preview=await previewCustomerTariffChange(proposal);
  assert.equal(preview.currentCents,null);assert.equal(preview.proposedCents,306);assert.equal(preview.active,false);
  await assert.rejects(confirmCustomerTariffChange({...proposal,price:{...proposal.price,customerCentsPerBillableSecond:21}},preview.fingerprint,'11111111-1111-4111-8111-111111111111',()=>{}),/preview changed/i);
  assert.equal((await db.pool.query('SELECT count(*)::integer AS n FROM app_customer_tariff_cells')).rows[0].n,0);
  await confirmCustomerTariffChange(proposal,preview.fingerprint,'11111111-1111-4111-8111-111111111111',()=>{});
  const staged=await loadCustomerTariffScenarioDetail('kling-v4',detail.selector);
  assert.equal(staged.currentCents,null);assert.equal(staged.continuousInputTariff?.prepared,true);
  assert.equal((await loadCustomerTariffHistory()).length,1);assert.equal(isKlingV4ReleaseBlocked('kling-v4'),true);
 }finally{
  await getDb().end().catch(()=>undefined);await db.cleanup();
  for(const [key,value]of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
