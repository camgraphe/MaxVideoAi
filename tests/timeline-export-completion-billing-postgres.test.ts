import assert from 'node:assert/strict';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {completeTimelineExportJob} from '../frontend/src/server/timeline-exports/repository';
import {ensureTimelineExportSchema} from '../frontend/src/server/timeline-exports/schema';
import type {TimelineExportBillingStatus} from '../frontend/src/server/timeline-exports/contracts';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';

test('export completion preserves exact existing refunds and never changes the receipt ledger',async t=>{
  assert.equal(process.env.DATABASE_URL,undefined,'Only disposable PostgreSQL is allowed.');
  const pg=await startDisposablePostgres('export-complete-billing');
  process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();delete process.env.DATABASE_URL;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await ensureTimelineExportSchema();
  const seed=async(id:string,billingStatus='paid_reserved',kind='paid')=>{
    await pg.pool.query(`INSERT INTO app_timeline_exports(id,user_id,idempotency_key,project_name,status,amount_cents,currency,billing_kind,billing_status,render_manifest,export_settings)
      VALUES($1,'owner',$1,'Film','rendering',$4,'USD',$3,$2,'{}','{}')`,[id,billingStatus,kind,kind==='paid'?28:0]);
    if(kind==='paid')await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id) VALUES('owner','charge',28,'USD',$1)",[id]);
  };
  const refund=async(id:string,owner='owner',amount=28,currency='USD')=>pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id) VALUES($2,'refund',$3,$4,$1)",[id,owner,amount,currency]);
  const complete=(exportId:string,billingStatus:TimelineExportBillingStatus='paid_completed')=>completeTimelineExportJob({exportId,billingStatus,outputUrl:'https://media.maxvideoai.com/fixture.mp4',outputAssetId:'fixture-asset',sizeBytes:1234,mimeType:'video/mp4'});
  const state=async(id:string)=>(await pg.pool.query('SELECT status,progress,billing_status,output_url FROM app_timeline_exports WHERE id=$1',[id])).rows[0];
  const receipts=async()=>(await pg.pool.query('SELECT * FROM app_receipts ORDER BY id')).rows;
  await t.test('a full owned charge/refund pair survives a successful late render and replay',async()=>{
    await seed('refunded-render');await refund('refunded-render');
    const before=await receipts();
    await complete('refunded-render');
    await complete('refunded-render');
    assert.deepEqual(await state('refunded-render'),{status:'completed',progress:100,billing_status:'refunded',output_url:'https://media.maxvideoai.com/fixture.mp4'});
    assert.deepEqual(await receipts(),before);
  });
  await t.test('foreign, partial, different-currency and unrelated refunds cannot mark the export refunded',async()=>{
    for(const [id,owner,amount,currency]of [['foreign-refund','foreign',28,'USD'],['partial-refund','owner',14,'USD'],['currency-refund','owner',28,'EUR']]as const){
      await seed(id);await refund(id,owner,amount,currency);await complete(id);
      assert.equal((await state(id)).billing_status,'paid_completed');
    }
    await seed('unrelated-refund');await refund('different-job');await complete('unrelated-refund');
    assert.equal((await state('unrelated-refund')).billing_status,'paid_completed');
    await seed('mismatched-charge');await refund('mismatched-charge');
    await pg.pool.query("UPDATE app_receipts SET amount_cents=40 WHERE job_id='mismatched-charge' AND type='charge'");
    await complete('mismatched-charge');
    assert.equal((await state('mismatched-charge')).billing_status,'paid_completed');
    await seed('foreign-charge');await refund('foreign-charge');
    await pg.pool.query("UPDATE app_receipts SET user_id='foreign' WHERE job_id='foreign-charge' AND type='charge'");
    await complete('foreign-charge');
    assert.equal((await state('foreign-charge')).billing_status,'paid_completed');
    await seed('refund-without-charge');await refund('refund-without-charge');
    await pg.pool.query("DELETE FROM app_receipts WHERE job_id='refund-without-charge' AND type='charge'");
    await complete('refund-without-charge');
    assert.equal((await state('refund-without-charge')).billing_status,'paid_completed');
  });
  await t.test('ordinary paid, free and platform completion retain their financial owner',async()=>{
    for(const [id,beforeStatus,kind,completedStatus,expected]of [
      ['paid-normal','paid_reserved','paid','paid_completed','paid_completed'],
      ['free-normal','free_reserved','free','free_completed','free_completed'],
      ['platform-normal','platform','paid','paid_completed','platform'],
    ]as const){await seed(id,beforeStatus,kind);await complete(id,completedStatus);assert.equal((await state(id)).billing_status,expected);}
  });
  await t.test('completion waiting behind an export transition sees its newly committed refund',async()=>{
    await seed('concurrent-refund');
    const transition=await pg.pool.connect();
    let completing:Promise<void>|undefined;
    try{
      await transition.query('BEGIN');
      await transition.query("SELECT id FROM app_timeline_exports WHERE id='concurrent-refund' FOR UPDATE");
      completing=complete('concurrent-refund');
      const deadline=Date.now()+5000;
      let blocked=false;
      do{
        blocked=(await pg.pool.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%app_timeline_exports%') blocked")).rows[0].blocked;
        if(!blocked)await new Promise(resolve=>setTimeout(resolve,10));
      }while(!blocked&&Date.now()<deadline);
      assert.equal(blocked,true,'Completion must be in flight behind the export row lock.');
      await transition.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id) VALUES('owner','refund',28,'USD','concurrent-refund')");
      await transition.query('COMMIT');
      await completing;
      assert.equal((await state('concurrent-refund')).billing_status,'refunded');
      assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE job_id='concurrent-refund' AND type='refund'")).rows[0].n,1);
    }finally{await transition.query('ROLLBACK');await completing?.catch(()=>undefined);transition.release();}
  });
  await t.test('missing required ledger schema fails paid completion atomically without bootstrap',async()=>{
    await seed('missing-ledger');
    await seed('free-without-ledger','free_reserved','free');
    await seed('platform-without-ledger','platform');
    const before=(await pg.pool.query("SELECT to_jsonb(e) snapshot FROM app_timeline_exports e WHERE id='missing-ledger'")).rows[0].snapshot;
    await pg.pool.query('ALTER TABLE app_receipts RENAME TO fixture_receipts');
    try{
      await assert.rejects(complete('missing-ledger'),{code:'42P01'});
      assert.deepEqual((await pg.pool.query("SELECT to_jsonb(e) snapshot FROM app_timeline_exports e WHERE id='missing-ledger'")).rows[0].snapshot,before);
      assert.equal((await pg.pool.query("SELECT to_regclass('public.app_receipts') name")).rows[0].name,null);
      await complete('free-without-ledger','free_completed');
      await complete('platform-without-ledger');
      assert.equal((await state('free-without-ledger')).billing_status,'free_completed');
      assert.equal((await state('platform-without-ledger')).billing_status,'platform');
    }finally{await pg.pool.query('ALTER TABLE fixture_receipts RENAME TO app_receipts');}
  });
});
