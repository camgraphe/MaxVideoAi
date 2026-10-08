import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createQueryExecutor, withDbTransaction } from '../frontend/src/lib/db';
import { applyCompletedFalAttemptRepair, inspectCompletedFalAttemptRepair, parseCompletedFalAttemptRepairOptions } from '../frontend/scripts/_lib/completed-fal-attempt-repair';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

test('Fal repair requires explicit bounded jobs and an expected apply count', () => {
  assert.deepEqual(parseCompletedFalAttemptRepairOptions(['--job-row-id=1']), { mode: 'dry-run', jobRowIds: [1], expected: null });
  assert.throws(() => parseCompletedFalAttemptRepairOptions([]));
  for (const args of [['--job-row-id=0'], ['--job-row-id=1', '--unknown'], ['--apply', '--job-row-id=1'], ['--apply', '--dry-run', '--job-row-id=1', '--expect=1']]) {
    assert.throws(() => parseCompletedFalAttemptRepairOptions(args));
  }
  assert.throws(() => parseCompletedFalAttemptRepairOptions(Array.from({ length: 51 }, (_, i) => `--job-row-id=${i + 1}`)));
});

test('bounded completed Fal repair preserves customer data and aborts a changed snapshot atomically', async t => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`local PostgreSQL command unavailable: ${missing}`);
  const database = await startDisposablePostgres('completed-fal-repair');
  t.after(() => database.cleanup());
  await database.pool.query(`CREATE TABLE app_jobs(id bigserial PRIMARY KEY, job_id text UNIQUE, provider text, provider_job_id text, status text, video_url text);
    INSERT INTO app_jobs VALUES(1,'first','fal','fal-one','completed','original-one'),(2,'second','fal','fal-two','completed','original-two');
    CREATE TABLE app_receipts(id integer PRIMARY KEY, job_id text, amount_cents integer);
    INSERT INTO app_receipts VALUES(1,'first',328),(2,'second',132);`);
  await database.pool.query(readFileSync('neon/migrations/21_provider_attempts.sql', 'utf8'));
  const dependencies = {
    ...createQueryExecutor(database.pool),
    transaction: <T>(work: Parameters<typeof withDbTransaction<T>>[0]) => withDbTransaction(work, { pool: database.pool }),
  };
  const snapshot = async (table: string) => (await database.pool.query(`SELECT to_jsonb(row)::text AS snapshot FROM ${table} row ORDER BY id`)).rows;
  async function seed() {
    await database.pool.query('TRUNCATE provider_attempts');
    await database.pool.query(`INSERT INTO provider_attempts(id,job_id,attempt_index,provider,status,provider_job_id,error_class,error_code,response_snapshot,provider_cost_usd)
      VALUES(1,1,1,'kling_direct','failed','kling-one','insufficient_provider_credits','1102','{"code":1102}',1.25),
      (2,1,2,'fal','completed','fal-one','fal_fallback_failed','TIMEOUT','{"ok":true,"deferred":true,"status":"running"}',1.75),
      (3,1,3,'fal','completed','unrelated','fal_fallback_failed',NULL,'{"ok":true,"deferred":true,"status":"running"}',2.5),
      (4,2,1,'fal','completed','fal-two','fal_fallback_failed',NULL,'{"ok":true,"deferred":true,"status":"running"}',3.5)`);
  }
  await t.test('inspection is read only; application clears only the exact current successful attempts', async () => {
    await seed();
    const jobsBefore = await snapshot('app_jobs'); const receiptsBefore = await snapshot('app_receipts');
    const attemptsBefore = await snapshot('provider_attempts');
    const candidates = await inspectCompletedFalAttemptRepair([1, 2], dependencies);
    assert.deepEqual(candidates.map(row => row.attemptId), [2, 4]);
    assert.deepEqual(await snapshot('provider_attempts'), attemptsBefore);
    assert.equal(await applyCompletedFalAttemptRepair(candidates, dependencies), 2);
    assert.deepEqual(await snapshot('app_jobs'), jobsBefore); assert.deepEqual(await snapshot('app_receipts'), receiptsBefore);
    const after = await snapshot('provider_attempts');
    assert.deepEqual(after[0], attemptsBefore[0]); assert.deepEqual(after[2], attemptsBefore[2]);
    for (const index of [1, 3]) {
      const beforeRow = JSON.parse(attemptsBefore[index].snapshot); const afterRow = JSON.parse(after[index].snapshot);
      assert.equal(afterRow.error_class, null); assert.equal(afterRow.error_code, null); assert.equal(afterRow.fallback_eligible, false);
      delete beforeRow.updated_at; delete afterRow.updated_at;
      assert.deepEqual(afterRow, { ...beforeRow, error_code: null, error_class: null, fallback_eligible: false });
    }
    assert.deepEqual(await inspectCompletedFalAttemptRepair([1, 2], dependencies), []);
  });
  await t.test('a change to the second job rolls back even an earlier repaired row', async () => {
    await seed(); const candidates = await inspectCompletedFalAttemptRepair([1, 2], dependencies);
    await database.pool.query(`UPDATE app_jobs SET video_url='new-original' WHERE id=2`);
    const before = await snapshot('provider_attempts');
    await assert.rejects(applyCompletedFalAttemptRepair(candidates, dependencies), /changed/);
    assert.deepEqual(await snapshot('provider_attempts'), before);
  });
  await t.test('a changed provider attempt aborts; an unlisted job is never included', async () => {
    await seed(); const candidates = await inspectCompletedFalAttemptRepair([1], dependencies);
    assert.deepEqual(candidates.map(row => row.attemptId), [2]);
    await database.pool.query(`UPDATE provider_attempts SET provider_cost_usd=8 WHERE id=2`);
    await assert.rejects(applyCompletedFalAttemptRepair(candidates, dependencies), /changed/);
    assert.equal((await database.pool.query('SELECT error_class FROM provider_attempts WHERE id=2')).rows[0].error_class, 'fal_fallback_failed');
  });
});
