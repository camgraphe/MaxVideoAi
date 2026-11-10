import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import type { QueryExecutor } from '../frontend/src/lib/db';
import { readActivityOrigins } from '../frontend/src/server/generations/activity-origin';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('Activity origin is one read-only accepted-quote query scoped to both job and quote ownership', { timeout: 60_000 }, async t => {
  const database = await startDisposablePostgres('activity-origin');
  let client: PoolClient | undefined;
  t.after(async () => {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    await database.cleanup();
  });
  // Only the migrated reader columns are needed. Deliberately omit constraints
  // so corrupted/ambiguous evidence can also be qualified conservatively.
  await database.pool.query(`
    CREATE TABLE app_jobs(job_id text PRIMARY KEY, user_id text, hidden boolean DEFAULT false);
    CREATE TABLE mcp_generation_quotes(job_id text, user_id text, state text, auth_origin text, studio_project_id text);
    INSERT INTO app_jobs(job_id,user_id) VALUES
      ('mcp','owner'),('studio','owner'),('toolbox','owner'),('prepared','owner'),('claimed','owner'),
      ('failed','owner'),('foreign-quote','owner'),('foreign-job','other'),('hidden','owner'),
      ('invalid-project','owner'),('missing-project','owner'),('unknown-origin','owner'),
      ('conflicting','owner'),('duplicate','owner'),('unrequested','owner');
    UPDATE app_jobs SET hidden=true WHERE job_id='hidden';
    INSERT INTO mcp_generation_quotes(job_id,user_id,state,auth_origin,studio_project_id) VALUES
      ('mcp','owner','accepted','oauth',NULL),
      ('studio','owner','accepted','studio-session','project-123'),
      ('toolbox','owner','accepted','toolbox-session',NULL),
      ('prepared','owner','prepared','oauth',NULL),
      ('claimed','owner','claimed','oauth',NULL),
      ('failed','owner','failed','oauth',NULL),
      ('foreign-quote','other','accepted','oauth',NULL),
      ('foreign-job','owner','accepted','oauth',NULL),
      ('missing-job','owner','accepted','oauth',NULL),
      ('hidden','owner','accepted','oauth',NULL),
      ('invalid-project','owner','accepted','studio-session','../other'),
      ('missing-project','owner','accepted','studio-session',NULL),
      ('unknown-origin','owner','accepted',NULL,NULL),
      ('conflicting','owner','accepted','oauth',NULL),
      ('conflicting','owner','accepted','studio-session','project-123'),
      ('duplicate','owner','accepted','oauth',NULL),
      ('duplicate','owner','accepted','oauth',NULL),
      ('unrequested','owner','accepted','oauth',NULL);
  `);
  client = await database.pool.connect();
  await client.query('BEGIN READ ONLY');
  const statements: Array<{ sql: string; params?: ReadonlyArray<unknown> }> = [];
  const executor: QueryExecutor = { query: async <T>(sql: string, params?: ReadonlyArray<unknown>) => {
    statements.push({ sql, params });
    return (await client!.query(sql, params ? [...params] : [])).rows as T[];
  } };
  const jobIds = ['mcp', 'studio', 'toolbox', 'prepared', 'claimed', 'failed', 'foreign-quote', 'foreign-job',
    'hidden', 'missing-job', 'invalid-project', 'missing-project', 'unknown-origin', 'conflicting', 'duplicate', 'mcp'];

  const origins = await readActivityOrigins('owner', jobIds, executor);
  assert.deepEqual([...origins.entries()].sort(), [
    ['duplicate', { kind: 'mcp' }], ['mcp', { kind: 'mcp' }], ['studio', { kind: 'studio', projectId: 'project-123' }],
  ]);
  assert.equal(statements.length, 1, 'one page must use one batch query');
  assert.match(statements[0].sql, /^\s*SELECT\b/i);
  assert.equal(statements[0].params?.[0], 'owner');
  assert.deepEqual(statements[0].params?.[1], [...new Set(jobIds)]);

  statements.length = 0;
  assert.equal((await readActivityOrigins('owner', [], executor)).size, 0);
  assert.equal(statements.length, 0, 'empty feeds must not query quote provenance');
  assert.equal((await readActivityOrigins('', jobIds, executor)).size, 0);
  assert.equal(statements.length, 0, 'an unknown principal cannot query provenance');

  const other = await readActivityOrigins('other', jobIds, executor);
  assert.equal(other.size, 0, 'neither side of mismatched ownership establishes provenance');
});
