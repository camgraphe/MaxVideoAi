import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { createQueryExecutor } from '../frontend/src/lib/db';
import { ADMIN_EXCLUDED_USER_IDS } from '../frontend/lib/admin/exclusions';
import { readPurchases, readLedger, readAttempts } from '../frontend/server/admin-routing-finance/data';
import { routingFinanceSummary } from '../frontend/server/admin-routing-finance/summary';
import { attemptsCsv, ledgerCsv, purchaseCsv, summaryCsv } from '../frontend/server/admin-routing-finance/csv';

test('routing books match a serving attempt once, keep late refunds in the posting month and retain unknowns', async () => {
  const db = await startDisposablePostgres('routing-books');
  try {
    const q = createQueryExecutor(db.pool).query;
    await q(`CREATE TABLE app_jobs(id bigserial primary key,job_id text unique,user_id text,surface text default 'video',
      engine_id text default 'wan-3-prime',status text default 'completed',created_at timestamptz default '2026-10-12Z',
      provider text default 'fal',provider_job_id text,final_price_cents integer default 85,currency text default 'USD',cost_breakdown_usd jsonb);
      CREATE TABLE app_receipts(id bigserial primary key,job_id text,user_id text,type text,currency text,amount_cents int,
        created_at timestamptz default '2026-10-12Z',metadata jsonb);`);
    await q(await readFile('neon/migrations/21_provider_attempts.sql', 'utf8'));
    await q(
      `INSERT INTO app_jobs(job_id,user_id,provider_job_id) VALUES ('job','customer','=untrusted-ref'),('legacy','customer','legacy-task'),
      ('ambiguous','customer','two'),('old','customer','old-task'),('internal',$1,'staff-task'),('usd-loss','customer','loss-task')`,
      [ADMIN_EXCLUDED_USER_IDS[0]],
    );
    await q(`UPDATE app_jobs SET created_at='2026-09-07Z' WHERE job_id='old';
      UPDATE app_jobs SET cost_breakdown_usd='{"provider":"fal","provider_cost_status":"list_estimate_from_provider_usage","provider_cost_usd_list":0}' WHERE job_id='legacy';
      INSERT INTO provider_attempts(job_id,attempt_index,provider,status,created_at,provider_job_id) VALUES
        (1,1,'alibaba_model_studio','failed','2026-10-12Z',null),(1,2,'fal','completed','2026-10-12Z','=untrusted-ref'),
        (3,1,'fal','accepted','2026-10-12Z','two'),(3,2,'fal','accepted','2026-10-12Z','second'),
        (4,1,'fal','failed','2026-10-01Z','late-attempt'),(6,1,'fal','completed','2026-10-12Z','loss-task');
      UPDATE provider_attempts SET fallback_to_attempt_id=2 WHERE id=1;`);
    const plan = (ref: number) => ({
      engineId: 'wan-3-prime',
      mode: 'canary',
      baselineProvider: 'alibaba_model_studio',
      order: ['alibaba_model_studio', 'fal'],
      candidates: [
        { provider: 'alibaba_model_studio', excluded: null, costMicros: ref },
        { provider: 'fal', excluded: null, costMicros: 560000 },
      ],
    });
    await q(
      `UPDATE provider_attempts SET request_snapshot=jsonb_build_object('purchaseRouting',$1::jsonb) WHERE id=1`,
      [plan(700000)],
    );
    await q(
      `UPDATE provider_attempts SET request_snapshot=jsonb_build_object('purchaseRouting',$1::jsonb) WHERE id=6`,
      [plan(500000)],
    );
    await q(
      `INSERT INTO app_receipts(job_id,user_id,type,currency,amount_cents,created_at,metadata) VALUES
      ('job','customer','charge','USD',85,'2026-10-12Z',null),('job','customer','refund','USD',5,'2026-10-13Z','{"original_receipt_id":"1"}'),
      ('old','customer','charge','EUR',61,'2026-09-10Z',null),(null,'customer','refund','EUR',61,'2026-10-01Z','{"original_receipt_id":3}'),
      ('job','different-owner','charge','USD',700,'2026-10-13Z',null),('job','customer','refund','USD',2,'2026-11-01Z',null),
      (null,'different-owner','refund','EUR',61,'2026-10-01Z','{"original_receipt_id":3}'),
      ('internal',$1,'charge','USD',11,'2026-10-12Z',null),('legacy','customer','topup','USD',1000,'2026-10-15Z',null),
      ('legacy','customer','charge','GBP',55,'2026-10-15Z',null)`,
      [ADMIN_EXCLUDED_USER_IDS[0]],
    );
    const period = { from: '2026-10-01', to: '2026-10-31', includeAdmin: false };
    const jobs = await readPurchases(period, q),
      receipts = await readLedger(period, q),
      attempts = await readAttempts(period, q);
    assert.deepEqual(
      receipts.map((row) => row.receipt),
      ['4', '1', '2', '10'],
    );
    assert.equal(receipts[0].original, '3');
    const report = routingFinanceSummary(jobs, receipts);
    assert.deepEqual(report.total, {
      jobs: 4,
      delivered: 4,
      fallbacks: 1,
      priced: 3,
      costMicros: 1120000,
      comparable: 2,
      baselineMicros: 1200000,
      savingsMicros: 80000,
    });
    assert.deepEqual(report.spread, { jobs: 1, micros: 240000 });
    const download = summaryCsv(report);
    assert.match(download, /"period",,,"estimated_routing_savings","USD",0\.08,/);
    assert.match(download, /"receipts",,,"net_usage","EUR",-0\.61,/);
    assert.deepEqual(report.receipts, [
      { currency: 'EUR', charges: 0, refunds: 61, count: 1 },
      { currency: 'GBP', charges: 55, refunds: 0, count: 1 },
      { currency: 'USD', charges: 85, refunds: 5, count: 2 },
    ]);
    assert.equal(jobs.find((row) => row.job === 'ambiguous')?.provider, null);
    assert.equal(jobs.find((row) => row.job === 'legacy')?.estimateMicros, 0);
    assert.equal(jobs.find((row) => row.job === 'usd-loss')?.baselineMicros, 500000);
    assert.equal(attempts.length, 6);
    assert.equal(attempts.find((row) => row.ordinal === 2 && row.job === 'job')?.previous, '1');
    assert.match(purchaseCsv(jobs), /"'=untrusted-ref"/);
    assert.match(attemptsCsv(attempts), /late-attempt/);
    assert.match(ledgerCsv(receipts), /"4","3","old","wan-3-prime","refund","EUR",61,-61/);
    assert.equal((await readPurchases({ ...period, includeAdmin: true }, q)).length, 5);
    assert.equal((await readLedger({ ...period, includeAdmin: true }, q)).length, 5);
    const empty = routingFinanceSummary([], []);
    assert.equal(empty.total.comparable, 0);
    assert.equal(empty.routes.length, 0);
  } finally {
    await db.cleanup();
  }
});
