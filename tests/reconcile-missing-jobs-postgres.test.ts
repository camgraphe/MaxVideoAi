import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {NextRequest} from 'next/server';
import {getDb} from '../frontend/src/lib/db';
import {ensureTimelineExportSchema} from '../frontend/src/server/timeline-exports/schema';
import {chooseStudioAssistance,readStudioAssistanceStatus} from '../frontend/src/server/studio/assistance-ledger';
import {studioAssistancePolicy} from '../frontend/src/server/studio/assistance-policy';
import {getWalletBalanceCents} from '../frontend/src/lib/wallet';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';

test('orphan reconciliation refunds missing media without refunding products owned by other ledgers',async t=>{
  assert.equal(process.env.DATABASE_URL,undefined,'Only disposable PostgreSQL is allowed.');
  const pg=await startDisposablePostgres('reconcile-exports');
  const oldEnvironment={DATABASE_URL:process.env.DATABASE_URL,CRON_RECONCILE_ORPHANS_ENABLED:process.env.CRON_RECONCILE_ORPHANS_ENABLED,CRON_RECONCILE_ALLOW_STRIPE_REFUNDS:process.env.CRON_RECONCILE_ALLOW_STRIPE_REFUNDS,CRON_RECONCILE_MIN_AGE_MINUTES:process.env.CRON_RECONCILE_MIN_AGE_MINUTES,CRON_RECONCILE_MAX_LOOKBACK_MINUTES:process.env.CRON_RECONCILE_MAX_LOOKBACK_MINUTES,CRON_SECRET:process.env.CRON_SECRET,VERCEL:process.env.VERCEL};
  Object.assign(process.env,{DATABASE_URL:pg.databaseUrl,CRON_RECONCILE_ORPHANS_ENABLED:'true',CRON_RECONCILE_ALLOW_STRIPE_REFUNDS:'false',CRON_RECONCILE_MIN_AGE_MINUTES:'25',CRON_RECONCILE_MAX_LOOKBACK_MINUTES:'180',CRON_SECRET:'disposable-cron',VERCEL:'0'});
  t.after(async()=>{await getDb().end();for(const [key,value]of Object.entries(oldEnvironment)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query('CREATE TABLE fal_queue_log(job_id text)');
  const {GET}=await import('../frontend/app/api/cron/reconcile-missing-jobs/route');
  const run=async()=>{const response=await GET(new NextRequest('http://localhost/api/cron/reconcile-missing-jobs',{headers:{authorization:'Bearer disposable-cron'}}));assert.equal(response.status,200);return response.json();};
  const charge=async(jobId:string,surface:string|null=null,product:string|null=null)=>pg.pool.query(`INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id,surface,billing_product_key,created_at)
    VALUES('owner','charge',28,'USD',$1,$2,$3,NOW()-INTERVAL '45 minutes')`,[jobId,surface,product]);
  const refunds=async()=>(await pg.pool.query("SELECT job_id FROM app_receipts WHERE type='refund' ORDER BY job_id")).rows.map(row=>row.job_id);

  await t.test('explicit export products remain excluded when the optional exports table is absent',async()=>{
    await charge('ordinary-orphan','video','video');
    await charge('surface-export','timeline_export');
    await charge('product-export',null,'server_render');
    await charge('similar-unrelated-label','timeline_export_other','server_render_other');
    await charge('unknown-tool','tool','future-service');
    await charge('pack-product-only','tool','studio_assistance_pack');
    await charge('assistance-product-only','video','studio_assistance');
    await charge('studio-sol-pack:prefix-only');
    await charge('studio-assistance:prefix-only');
    await charge('legacy-unknown-product',null,'future-service');
    await charge('tlx_no_export_record');
    await charge('saved-generation','video');
    await charge('accepted-provider','video');
    await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status) VALUES('saved-generation','owner','queued');INSERT INTO fal_queue_log VALUES('accepted-provider')");
    const result=await run();
    assert.equal(result.refunded,2);
    assert.deepEqual(await refunds(),['ordinary-orphan','tlx_no_export_record']);
    assert.equal((await pg.pool.query("SELECT to_regclass('public.app_timeline_exports') name")).rows[0].name,null,'The cron must not initialize optional export schema.');
    assert.equal((await pg.pool.query("SELECT to_regclass('public.studio_assistance_credit_lots') name")).rows[0].name,null,'The cron must not initialize optional assistance schema.');
  });
  await t.test('legacy null labels use exact export account and ID ownership across all render states',async()=>{
    await ensureTimelineExportSchema();
    for(const [jobId,status,billingStatus,billingKind,owner]of [
      ['queued-export','queued','paid_reserved','paid','owner'],
      ['completed-export','completed','paid_completed','paid','owner'],
      ['refunded-export','failed','refunded','paid','owner'],
      ['free-export','queued','free_reserved','free','owner'],
      ['wrong-account-export','completed','paid_completed','paid','foreign'],
      ['different-export-id','completed','paid_completed','paid','owner'],
    ])await pg.pool.query(`INSERT INTO app_timeline_exports(id,user_id,idempotency_key,project_name,status,billing_kind,billing_status,render_manifest,export_settings)
      VALUES($1,$5,$1,'Fixture',$2,$4,$3,'{}','{}')`,[jobId,status,billingStatus,billingKind,owner]);
    for(const jobId of ['queued-export','completed-export','refunded-export','free-export','wrong-account-export','unmatched-export-id'])await charge(jobId);
    await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id) VALUES('owner','refund',28,'USD','refunded-export')");
    const before=(await pg.pool.query("SELECT * FROM app_receipts WHERE type='refund' ORDER BY id")).rows;
    const result=await run();
    assert.equal(result.inspected,2);
    assert.equal(result.refunded,2);
    assert.deepEqual(await refunds(),['ordinary-orphan','refunded-export','tlx_no_export_record','unmatched-export-id','wrong-account-export']);
    assert.deepEqual((await pg.pool.query("SELECT * FROM app_receipts WHERE type='refund' AND job_id=ANY($1::text[]) ORDER BY id",[before.map(row=>row.job_id)])).rows,before,'Existing customer refunds remain unchanged.');
    assert.equal((await run()).refunded,0,'A second cron run cannot create duplicate refunds.');
  });
  await t.test('real pack purchases retain both wallet debit and credits, including legacy receipt ownership',async()=>{
    for(const file of ['54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','86_milo_three_levels.sql','87_milo_runtime_bounds.sql'])await pg.pool.query(readFileSync(`neon/migrations/${file}`,'utf8'));
    const policy=studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'});
    for(const identity of ['actual','prefix-only','product-only','ledger-only']){
      const userId=`synthetic-pack-${identity}`;
      await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',1000,'USD')",[userId]);
      const status=await readStudioAssistanceStatus(userId,policy);
      await chooseStudioAssistance(userId,{action:'purchase_pack',amountCents:500,expectedRevision:0,tariffVersion:status.tariff.version,purchaseKey:randomUUID()},policy);
      await pg.pool.query(`UPDATE app_receipts SET created_at=NOW()-INTERVAL '45 minutes',
        billing_product_key=CASE WHEN $2 IN ('prefix-only','ledger-only') THEN NULL ELSE billing_product_key END,
        surface=CASE WHEN $2='ledger-only' THEN NULL ELSE surface END,
        job_id=CASE WHEN $2 IN ('product-only','ledger-only') THEN $2 ELSE job_id END
        WHERE user_id=$1 AND type='charge'`,[userId,identity]);
      const before=(await pg.pool.query('SELECT * FROM app_receipts WHERE user_id=$1 ORDER BY id',[userId])).rows;
      await run();
      assert.equal((await getWalletBalanceCents(userId)).balanceCents,500);
      assert.equal((await readStudioAssistanceStatus(userId,policy)).credits?.purchased.remaining,5000);
      assert.deepEqual((await pg.pool.query('SELECT * FROM app_receipts WHERE user_id=$1 ORDER BY id',[userId])).rows,before);
    }
  });
  await t.test('legacy assistance call ownership is exact and account scoped across terminal states',async()=>{
    await pg.pool.query("INSERT INTO studio_assistance_accounts(user_id,sol_limit_nano_usd,luna_limit_nano_usd) VALUES('owner',0,0),('foreign',0,0)");
    for(const identity of ['reserved','unknown','settled','foreign','wrong-receipt']){
      const status=['foreign','wrong-receipt'].includes(identity)?'reserved':identity;
      const userId=identity==='foreign'?'foreign':'owner';
      const jobId=`legacy-call-${identity}`;
      await charge(jobId);
      const receipt=(await pg.pool.query("SELECT id FROM app_receipts WHERE job_id=$1 AND type='charge'",[jobId])).rows[0];
      const callId=randomUUID();
      await pg.pool.query(`INSERT INTO studio_assistance_turns(user_id,project_id,request_id,model,mode,policy_version,tariff_version,tariff_snapshot)
        VALUES($2,'fixture',$1,'gpt-6.1-sol','paid_sol','synthetic','synthetic','{}')`,[callId,userId]);
      await pg.pool.query(`INSERT INTO studio_assistance_calls(id,user_id,project_id,request_id,lease_id,response_index,model,mode,policy_version,rate_version,tariff_version,input_token_bound,output_token_bound,reserved_nano_usd,reserved_cents,charge_receipt_id,state,charged_cents,provider_max_nano_usd,settled_at)
        VALUES($1,$4,'fixture',$1,$1,0,'gpt-6.1-sol','paid_sol','synthetic','synthetic','synthetic',100,100,0,28,$3,$2,
          CASE WHEN $2='settled' THEN 28 END,CASE WHEN $2='settled' THEN 0 END,CASE WHEN $2='settled' THEN NOW() END)`,[callId,status,identity==='wrong-receipt'?'unrelated-receipt':String(receipt.id),userId]);
    }
    await charge('foreign-lot-owner');
    const foreign=(await pg.pool.query("SELECT id FROM app_receipts WHERE job_id='foreign-lot-owner' AND type='charge'")).rows[0];
    await pg.pool.query(`INSERT INTO studio_assistance_credit_lots(id,user_id,kind,total_credits,amount_cents,purchase_key,tariff_version,receipt_id)
      VALUES($1,'foreign','purchased',5000,500,$2,'synthetic',$3)`,[randomUUID(),randomUUID(),String(foreign.id)]);
    const result=await run();
    assert.equal(result.refunded,3);
    assert.deepEqual((await pg.pool.query("SELECT job_id FROM app_receipts WHERE type='refund' AND job_id LIKE 'legacy-call-%' ORDER BY job_id")).rows.map(row=>row.job_id),['legacy-call-foreign','legacy-call-wrong-receipt']);
  });
  await t.test('an invalid optional owner table fails visibly without refunding anything',async()=>{
    await pg.pool.query('ALTER TABLE studio_assistance_calls RENAME COLUMN charge_receipt_id TO unavailable_receipt_id');
    const before=(await pg.pool.query('SELECT * FROM app_receipts ORDER BY id')).rows;
    await assert.rejects(run(),{code:'42703'});
    assert.deepEqual((await pg.pool.query('SELECT * FROM app_receipts ORDER BY id')).rows,before);
    await pg.pool.query('ALTER TABLE studio_assistance_calls RENAME COLUMN unavailable_receipt_id TO charge_receipt_id');
  });
  await t.test('all media surfaces and known finishing tools still refund exact amounts once under concurrency',async()=>{
    const media=['video','image','storyboard','character','angle','audio','upscale','background-removal'];
    const tools=['tool:restore-video:standard','tool:restore-video:pro','tool:denoise:standard','tool:denoise:pro','tool:fix-blur:standard','tool:smooth-motion:standard','tool:smooth-motion:pro'];
    for(const surface of media)await charge(`media-${surface}`,surface);
    for(const product of tools)await charge(product,'tool',product);
    await pg.pool.query(`UPDATE app_receipts SET currency='EUR',pricing_snapshot='{"totalCents":28,"fixture":true}' WHERE job_id='media-image'`);
    const before=(await pg.pool.query('SELECT * FROM app_receipts ORDER BY id')).rows;
    await pg.pool.query(`CREATE FUNCTION hold_orphan_refund() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type='refund' THEN PERFORM pg_sleep(0.05); END IF; RETURN NEW; END $$;
      CREATE TRIGGER hold_orphan_refund BEFORE INSERT ON app_receipts FOR EACH ROW EXECUTE FUNCTION hold_orphan_refund()`);
    const results=await Promise.all([run(),run(),run()]);
    assert.equal(results.reduce((sum,result)=>sum+result.refunded,0),media.length+tools.length,'Only inserted receipts count as refunds.');
    const inserted=(await pg.pool.query('SELECT * FROM app_receipts WHERE id>$1 ORDER BY id',[before.at(-1)!.id])).rows;
    assert.equal(inserted.length,media.length+tools.length);
    for(const refund of inserted){
      const original=before.find(row=>row.type==='charge'&&row.job_id===refund.job_id)!;
      assert.deepEqual([refund.user_id,refund.amount_cents,refund.currency,refund.pricing_snapshot,refund.surface,refund.billing_product_key],
        [original.user_id,original.amount_cents,original.currency,original.pricing_snapshot,original.surface,original.billing_product_key]);
      assert.deepEqual(refund.metadata,{reason:'orphan_job_missing',source:'cron-reconcile',original_receipt_id:original.id});
    }
    assert.deepEqual((await pg.pool.query('SELECT * FROM app_receipts WHERE id<=$1 ORDER BY id',[before.at(-1)!.id])).rows,before);
    assert.equal((await run()).refunded,0);
    await pg.pool.query('DROP TRIGGER hold_orphan_refund ON app_receipts; DROP FUNCTION hold_orphan_refund()');
  });
  await t.test('required source-table errors remain visible instead of synthesizing empty success',async()=>{
    await pg.pool.query('DROP TABLE fal_queue_log');
    await assert.rejects(run(),{code:'42P01'});
  });
});
