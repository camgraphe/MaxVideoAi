import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { videoParams, imageParams } from './helpers/job-journey-fixtures';

test('C05–C09: migration, immutable snapshots, reservations and financial rollback on PostgreSQL 17', async (t) => {
  const pg = await startDisposablePostgres('journey-context');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    const { getDb } = await import('../frontend/src/lib/db');
    await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await pg.cleanup();
  });
  const migration = readFileSync('neon/migrations/81_job_journey_context.sql', 'utf8');
  const legacyClient = await pg.pool.connect();

  await legacyClient.query(`CREATE SCHEMA legacy; SET search_path TO legacy;
    CREATE TABLE app_jobs(job_id text PRIMARY KEY, status text, progress integer);
    INSERT INTO app_jobs VALUES ('legacy', 'pending', 0);`);
  await legacyClient.query(migration);
  await legacyClient.query(migration);
  const legacy = await legacyClient.query('SELECT entry_surface,entry_source,journey_version,entry_release_sha FROM app_jobs');
  assert.deepEqual(legacy.rows[0], { entry_surface: null, entry_source: null, journey_version: null, entry_release_sha: null });
  for (const values of [
    ['generator', 'web_route', null, null], [null, 'web_route', 1, null],
    ['generator', null, 1, null], ['mcp', 'web_route', 1, null],
    ['generator', 'web_route', 2, null], ['generator', 'web_route', 1, 'bad'],
    [null, null, null, 'a'.repeat(40)], [null, null, 1, null],
  ]) {
    await assert.rejects(legacyClient.query(`INSERT INTO app_jobs(job_id,entry_surface,entry_source,journey_version,entry_release_sha)
      VALUES ('invalid',$1,$2,$3,$4)`, values), /app_jobs_journey_context_check/);
  }
  for (const update of ["entry_surface='unknown'", "entry_source='unknown'", 'journey_version=1', `entry_release_sha='${'a'.repeat(40)}'`]) {
    await assert.rejects(legacyClient.query(`UPDATE app_jobs SET ${update} WHERE job_id='legacy'`), /immutable/);
  }
  await legacyClient.query('SET search_path TO public');
  legacyClient.release();
  // Actual baseline CREATE TABLE, followed by the explicit migration, matches fresh bootstrap ownership.
  const bootstrap = readFileSync('frontend/src/lib/schema/billing-core-schema.ts', 'utf8');
  const createJobs = bootstrap.match(/CREATE TABLE IF NOT EXISTS app_jobs \([\s\S]*?\n      \);/)![0];
  await pg.pool.query(createJobs);
  await pg.pool.query(migration);
  await pg.pool.query('DROP TABLE app_jobs');
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(migration);
  const { buildWebJobJourneyContext } = await import('../frontend/src/server/generations/job-journey-context');
  const { createInitialVideoJobInExecutor } = await import('../frontend/app/api/generate/_lib/initial-video-job');
  const { createInitialImageJobInExecutor } = await import('../frontend/src/server/images/image-initial-job');
  const contextA = buildWebJobJourneyContext({ VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40) });
  const contextB = buildWebJobJourneyContext({ VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40) });
  await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES ('user-1','topup',10000,'USD')");
  const transaction = async <T>(run: (executor: TransactionQueryExecutor) => Promise<T>) => {
    const client = await pg.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await run({ query: async (sql, args) => (await client.query(sql, args as unknown[])).rows } as TransactionQueryExecutor);
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };
  for (const media of ['video', 'image'] as const) {
    const reserve = (jobId: string, context = contextA) => transaction(executor => media === 'video'
      ? createInitialVideoJobInExecutor(executor, { ...videoParams(jobId), jobInsert: { ...videoParams(jobId).jobInsert, journeyContext: context } })
      : createInitialImageJobInExecutor(executor, { ...imageParams(jobId), journeyContext: context }));
    const jobId = `race-${media}`;
    const results = await Promise.all([reserve(jobId), reserve(jobId, contextB)]);
    assert.deepEqual(results.map(r => r.kind).sort(), ['created', 'existing_job']);
    const before = (await pg.pool.query('SELECT entry_surface,entry_source,journey_version,entry_release_sha FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
    assert.ok(['a'.repeat(40), 'b'.repeat(40)].includes(before.entry_release_sha));
    await pg.pool.query("UPDATE app_jobs SET status='completed',progress=100 WHERE job_id=$1", [jobId]);
    assert.equal((await reserve(jobId, contextB)).kind, 'existing_job');
    assert.deepEqual((await pg.pool.query('SELECT entry_surface,entry_source,journey_version,entry_release_sha FROM app_jobs WHERE job_id=$1', [jobId])).rows[0], before);
    for (const update of ["entry_surface='unknown'", "entry_source='unknown'", 'journey_version=NULL', 'entry_release_sha=NULL',
      'entry_surface=NULL,entry_source=NULL,journey_version=NULL,entry_release_sha=NULL']) {
      await assert.rejects(pg.pool.query(`UPDATE app_jobs SET ${update} WHERE job_id=$1`, [jobId]), /immutable/);
    }
    const chargeCount = await pg.pool.query("SELECT count(*) FROM app_receipts WHERE job_id=$1 AND type='charge'", [jobId]);
    assert.equal(chargeCount.rows[0].count, '1');
    let providerCalls = 0;
    await pg.pool.query(`ALTER TABLE app_jobs ADD CONSTRAINT fixture_insert_failure CHECK (job_id <> 'fail-${media}')`);
    await assert.rejects(reserve(`fail-${media}`).then(() => { providerCalls++; }), /fixture_insert_failure/);
    assert.equal(providerCalls, 0);
    assert.equal((await pg.pool.query('SELECT count(*) FROM app_receipts WHERE job_id=$1', [`fail-${media}`])).rows[0].count, '0');
    await pg.pool.query('ALTER TABLE app_jobs DROP CONSTRAINT fixture_insert_failure');
    const malformed = { ...contextA, journeyVersion: 2 } as typeof contextA;
    await assert.rejects(reserve(`malformed-${media}`, malformed), /journey context/i);
    assert.equal((await pg.pool.query('SELECT count(*) FROM app_receipts WHERE job_id=$1', [`malformed-${media}`])).rows[0].count, '0');
  }
});
