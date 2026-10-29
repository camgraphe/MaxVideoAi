import assert from 'node:assert/strict';
import test from 'node:test';
import type { QueryExecutor } from '../frontend/src/lib/db';
import { collectJobJourneyCoverage } from '../frontend/scripts/_lib/job-journey-coverage';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('C15–C18: aggregate keeps exact evidence, conflicts, bounds, exclusions and unavailable schema', async t => {
  const pg = await startDisposablePostgres('journey-projection');
  t.after(() => pg.cleanup());
  const executor: QueryExecutor = { async query(sql, args) { return (await pg.pool.query(sql, args as unknown[])).rows; } };
  const args = { executor, start: new Date('2026-10-25T00:00:00Z'), end: new Date('2026-10-26T00:00:00Z'), adminUserIds: ['static-admin'] };
  await assert.rejects(collectJobJourneyCoverage({ ...args, end: args.start }), /window/i);
  await assert.rejects(collectJobJourneyCoverage({ ...args, start: new Date('invalid') }), /window/i);
  const missing = await collectJobJourneyCoverage(args);
  assert.equal(missing.status, 'unavailable');
  if (missing.status !== 'unavailable') assert.fail('missing schema must not look like zero activity');
  assert.ok(missing.missing.includes('app_jobs.entry_surface'));
  await pg.pool.query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,surface text,payment_status text,
    status text,settings_snapshot jsonb,created_at timestamptz,updated_at timestamptz,
    entry_surface text,entry_source text,journey_version smallint,entry_release_sha text);
    CREATE TABLE mcp_generation_quotes(user_id text,job_id text,auth_origin text,funding_mode text,state text,created_at timestamptz);
    CREATE TABLE app_admins(user_id text); CREATE TABLE user_roles(user_id text,role text);
    CREATE TABLE user_account_restrictions(user_id text,active boolean);
    CREATE TABLE wallet_fraud_cleanup_audit(user_id text);`);
  const insert = async (id: string, overrides: Record<string, unknown> = {}) => {
    const row = { job_id: id, user_id: id, surface: 'video', payment_status: 'paid_wallet', status: 'completed',
      settings_snapshot: {}, created_at: args.start, updated_at: args.start,
      entry_surface: null, entry_source: null, journey_version: null, entry_release_sha: null, ...overrides };
    await pg.pool.query(`INSERT INTO app_jobs(${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map((_, i) => `$${i + 1}`).join(',')})`, Object.values(row));
  };
  const quote = async (id: string, origin: string | null, overrides: Record<string, unknown> = {}) => {
    const row = { user_id: id, job_id: id, auth_origin: origin, funding_mode: 'wallet', state: 'accepted', created_at: args.start, ...overrides };
    await pg.pool.query(`INSERT INTO mcp_generation_quotes(${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map((_, i) => `$${i + 1}`).join(',')})`, Object.values(row));
  };
  await insert('web', { surface: 'image', entry_surface: 'generator', entry_source: 'web_route', journey_version: 1, entry_release_sha: 'a'.repeat(40) });
  await insert('studio', { entry_surface: 'studio', entry_source: 'confirmed_actor', journey_version: 1, entry_release_sha: 'b'.repeat(40) });
  await insert('explicit-unknown', { entry_surface: 'unknown', entry_source: 'unknown', journey_version: 1 });
  await quote('explicit-unknown', 'oauth');
  for (const [id, origin] of [['historical-mcp', 'oauth'], ['historical-studio', 'studio-session'], ['historical-tool', 'toolbox-session']] as const) {
    await insert(id); await quote(id, origin, { state: 'failed' });
  }
  await insert('legacy-null'); await quote('legacy-null', null);
  await insert('foreign'); await quote('foreign', 'oauth', { user_id: 'another-owner' });
  await insert('conflict-context', { entry_surface: 'mcp', entry_source: 'confirmed_actor', journey_version: 1 });
  await quote('conflict-context', 'studio-session');
  await insert('conflict-quotes'); await quote('conflict-quotes', 'oauth'); await quote('conflict-quotes', 'studio-session');
  await insert('partial', { journey_version: 1 });
  await insert('bad-raw'); await quote('bad-raw', 'unrecognized');
  await insert('audio', { surface: 'audio' });
  await insert('storyboard', { surface: 'storyboard' });
  await insert('import', { settings_snapshot: { origin: 'external_fal_import' } });
  await insert('trial', { payment_status: 'included_mcp_trial' });
  await insert('null-media', { surface: null });
  await insert('restricted'); await pg.pool.query("INSERT INTO user_account_restrictions VALUES ('restricted',true)");
  await insert('audited'); await pg.pool.query("INSERT INTO wallet_fraud_cleanup_audit VALUES ('audited')");
  await insert('inactive-restriction'); await pg.pool.query("INSERT INTO user_account_restrictions VALUES ('inactive-restriction',false)");
  for (const id of ['static-admin', 'table-admin', 'admin', 'super_admin', 'staff', 'internal']) await insert(id);
  await pg.pool.query("INSERT INTO app_admins VALUES ('table-admin'); INSERT INTO user_roles VALUES ('admin','admin'),('super_admin','super_admin'),('staff','staff'),('internal','internal')");
  await insert('end-excluded', { created_at: args.end });
  await insert('before-excluded', { created_at: new Date(args.start.getTime() - 1) });
  await insert('unowned', { user_id: null });
  await insert('post-cutoff-update', { status: 'failed', updated_at: args.end });
  await insert('pending-quote'); await quote('pending-quote', 'oauth', { state: 'prepared' });
  await insert('late-quote'); await quote('late-quote', 'oauth', { created_at: args.end });
  await insert('trial-quote'); await quote('trial-quote', 'oauth', { funding_mode: 'included_trial' });

  const client = await pg.pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const readonlyExecutor: QueryExecutor = { async query(sql, params) { return (await client.query(sql, params as unknown[])).rows; } };
    const result = await collectJobJourneyCoverage({ ...args, executor: readonlyExecutor });
    assert.equal(result.status, 'available');
    if (result.status !== 'available') assert.fail('fixture schema should be available');
    assert.equal(result.projectionVersion, 1);
    const rows = result.rows.filter(row => row.scope === 'all_non_admin');
    const count = (predicate: (row: typeof rows[number]) => boolean, field = 'jobs') => rows.filter(predicate).reduce((n, row) => n + Number(row[field]), 0);
    assert.equal(count(() => true), 24);
    assert.equal(count(r => r.resolved_surface === 'conflict'), 2);
    assert.equal(count(r => r.resolved_surface === 'inconsistent'), 2);
    assert.equal(count(r => r.evidence_source === 'quote_history'), 3);
    assert.ok(rows.filter(r => r.evidence_source === 'quote_history').every(r => r.journey_version === null && r.known_reservation_release === null));
    assert.equal(count(r => r.resolved_surface === 'out_of_scope'), 5);
    assert.equal(count(r => r.media_surface === 'image' && r.resolved_surface === 'generator'), 1);
    assert.equal(count(r => r.resolved_surface === 'unknown' && r.journey_version === 1), 1, 'explicit unknown is never relabeled from quote absence or quote history');
    assert.equal(count(() => true, 'missing_reservation_release'), 2);
    assert.equal(count(() => true, 'updated_after_cutoff'), 1);
    assert.equal(result.rows.filter(row => row.scope === 'without_documented_flags').reduce((n, row) => n + Number(row.jobs), 0), 22);
    assert.ok(!JSON.stringify(result).includes('another-owner'), 'aggregate has no account/job identifiers');
    await client.query('COMMIT');
  } finally { client.release(); }
  await pg.pool.query('ALTER TABLE app_jobs DROP COLUMN entry_source');
  assert.equal((await collectJobJourneyCoverage(args)).status, 'unavailable');
});
