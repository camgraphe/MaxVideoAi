import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres, missingDisposablePostgresCommand } from './helpers/disposable-postgres';
import { markProviderAttemptAccepted, markProviderAttemptFailed, markProviderAttemptFinished, syncProviderAttemptTerminalStatus } from '../frontend/src/server/video-providers/provider-attempts';

test('provider attempt completion clears stale failure metadata, preserves genuine history and survives late responses', async t => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`local PostgreSQL command unavailable: ${missing}`);
  const database = await startDisposablePostgres('provider-attempt-recovery');
  t.after(() => database.cleanup());
  await database.pool.query(`CREATE TABLE app_jobs(id bigserial PRIMARY KEY, job_id text UNIQUE, provider text,
    provider_job_id text, status text); INSERT INTO app_jobs VALUES(1,'job-recovery','fal','fal-request','completed');`);
  await database.pool.query(readFileSync('neon/migrations/21_provider_attempts.sql', 'utf8'));
  const queryFn = async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => (await database.pool.query(sql, params)).rows;
  async function seed(status = 'failed') {
    await database.pool.query('TRUNCATE provider_attempts');
    await database.pool.query(`INSERT INTO provider_attempts(id,job_id,attempt_index,provider,status,provider_job_id,error_class,error_code,fallback_eligible,response_snapshot,provider_cost_usd)
      VALUES(1,1,1,'kling_direct','failed','kling-request','insufficient_provider_credits','1102',true,'{"code":1102}',1.25),
      (2,1,2,'fal',$1,'fal-request','fal_fallback_failed','TIMEOUT',true,'{"deferred":true}',1.75),
      (3,1,3,'fal','failed','other-request','real_rejection','422',false,'{"error":"rejected"}',2.5)`, [status]);
  }
  const rows = async () => (await database.pool.query('SELECT * FROM provider_attempts ORDER BY id')).rows;
  await t.test('terminal reconciliation clears the recovered attempt only', async () => {
    await seed(); const before = await rows();
    await syncProviderAttemptTerminalStatus({ publicJobId: 'job-recovery', provider: 'fal', providerJobId: 'fal-request', queryFn });
    const after = await rows();
    assert.equal(after[1].status, 'completed');
    assert.equal(after[1].error_class, null); assert.equal(after[1].error_code, null); assert.equal(after[1].fallback_eligible, false);
    assert.equal(after[1].provider_cost_usd, before[1].provider_cost_usd);
    assert.deepEqual(after[0], before[0]); assert.deepEqual(after[2], before[2]);
    await syncProviderAttemptTerminalStatus({ publicJobId: 'job-recovery', provider: 'fal', providerJobId: 'fal-request', queryFn });
    assert.deepEqual(await rows(), after, 'a clean completed attempt is already reconciled');
  });
  await t.test('an already completed legacy attempt is cleaned on reconciliation', async () => {
    await seed('completed');
    await syncProviderAttemptTerminalStatus({ publicJobId: 'job-recovery', provider: 'fal', providerJobId: 'fal-request', queryFn });
    const after = await rows(); assert.equal(after[1].error_class, null); assert.equal(after[1].error_code, null);
  });
  await t.test('direct completion clears stale fields and late failures cannot undo it', async () => {
    await seed();
    await markProviderAttemptFinished({ attemptId: 2, status: 'completed', providerCostUsd: 1.75, queryFn });
    const completed = await rows(); assert.equal(completed[1].error_class, null); assert.equal(completed[1].error_code, null);
    await markProviderAttemptFailed({ attemptId: 2, errorClass: 'fal_fallback_failed', responseSnapshot: { deferred: true }, queryFn });
    await markProviderAttemptFinished({ attemptId: 2, status: 'polling', queryFn });
    assert.deepEqual(await rows(), completed);
  });
  await t.test('a late acceptance response preserves the completed provider diagnostic', async () => {
    await seed('completed');
    await database.pool.query(`UPDATE provider_attempts SET response_snapshot='{"status":"completed","output":"stored"}' WHERE id=2`);
    await markProviderAttemptAccepted({ attemptId: 2, providerJobId: 'fal-request', responseSnapshot: { deferred: true }, queryFn });
    assert.deepEqual((await rows())[1].response_snapshot, { status: 'completed', output: 'stored' });
  });
});
