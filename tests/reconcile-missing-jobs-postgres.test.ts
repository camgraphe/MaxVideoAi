import assert from 'node:assert/strict';
import test from 'node:test';
import {NextRequest} from 'next/server';
import {getDb} from '../frontend/src/lib/db';
import {ensureTimelineExportSchema} from '../frontend/src/server/timeline-exports/schema';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';

test('orphan reconciliation refunds missing generations without refunding exports owned by the render ledger',async t=>{
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
    await charge('tlx_no_export_record');
    await charge('saved-generation','video');
    await charge('accepted-provider','video');
    await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status) VALUES('saved-generation','owner','queued');INSERT INTO fal_queue_log VALUES('accepted-provider')");
    const result=await run();
    assert.equal(result.refunded,3);
    assert.deepEqual(await refunds(),['ordinary-orphan','similar-unrelated-label','tlx_no_export_record']);
    assert.equal((await pg.pool.query("SELECT to_regclass('public.app_timeline_exports') name")).rows[0].name,null,'The cron must not initialize optional export schema.');
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
    assert.deepEqual(await refunds(),['ordinary-orphan','refunded-export','similar-unrelated-label','tlx_no_export_record','unmatched-export-id','wrong-account-export']);
    assert.deepEqual((await pg.pool.query("SELECT * FROM app_receipts WHERE type='refund' AND job_id=ANY($1::text[]) ORDER BY id",[before.map(row=>row.job_id)])).rows,before,'Existing customer refunds remain unchanged.');
    assert.equal((await run()).refunded,0,'A second cron run cannot create duplicate refunds.');
  });
  await t.test('required source-table errors remain visible instead of synthesizing empty success',async()=>{
    await pg.pool.query('DROP TABLE fal_queue_log');
    await assert.rejects(run(),{code:'42P01'});
  });
});
