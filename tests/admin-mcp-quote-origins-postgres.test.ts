import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { loadAdminMcpOutcomes } from '../frontend/server/admin-mcp-outcomes';

test('MCP outcomes and recent generations use only owned OAuth quotes and disclose excluded origins', async t => {
  const database = await startDisposablePostgres('admin-mcp-quote-origins');
  t.after(() => database.cleanup());
  const { pool } = database;
  await pool.query(`
    CREATE TABLE mcp_audit_events (event_type text, user_id text, oauth_client_id text, outcome text, client_family text, created_at timestamptz);
    CREATE TABLE mcp_generation_quotes (user_id text, oauth_client_id text, job_id text, created_at timestamptz, auth_origin text);
    CREATE TABLE app_jobs (job_id text PRIMARY KEY, user_id text, surface text, engine_id text, engine_label text, status text, created_at timestamptz);
    CREATE TABLE profiles (id text PRIMARY KEY, created_at timestamptz, synced_from_supabase boolean);
    INSERT INTO profiles VALUES ('shared', '2026-06-01Z', true), ('oauth-only', '2026-06-01Z', true);
    INSERT INTO app_jobs
      SELECT id, CASE WHEN id = 'foreign-owner' THEN 'someone-else' ELSE 'shared' END,
             CASE WHEN id = 'studio' THEN 'image' ELSE 'video' END,
             'model', 'Model', 'completed', '2026-07-04Z'
      FROM unnest(ARRAY['real', 'studio', 'toolbox', 'unknown', 'malformed', 'foreign-owner']) id;
    INSERT INTO mcp_generation_quotes VALUES
      ('shared', 'codex', 'real', '2026-07-03Z', 'oauth'),
      ('shared', 'claude', 'real', '2026-07-05Z', 'studio-session'),
      ('shared', 'codex', 'studio', '2026-07-03Z', 'studio-session'),
      ('shared', 'codex', 'toolbox', '2026-07-03Z', 'toolbox-session'),
      ('shared', 'codex', 'unknown', '2026-07-03Z', NULL),
      ('shared', 'codex', 'malformed', '2026-07-03Z', 'legacy-unrecognized'),
      ('studio-only', 'codex', NULL, '2026-07-03Z', 'studio-session'),
      ('toolbox-only', 'codex', NULL, '2026-07-03Z', 'toolbox-session'),
      ('unknown-only', 'codex', NULL, '2026-07-03Z', NULL),
      ('oauth-only', 'codex', NULL, '2026-07-03Z', 'oauth'),
      ('shared', 'codex', 'foreign-owner', '2026-07-03Z', 'oauth'),
      ('future', 'codex', NULL, '2026-07-08Z', NULL);
  `);
  const range = { from: new Date('2026-07-01Z'), to: new Date('2026-07-08Z'), timeZone: 'UTC' as const, conversionWindowSeconds: 60 };
  const load = () => loadAdminMcpOutcomes(range, { configured: () => true, executor: {
    async query<T>(sql: string, values?: ReadonlyArray<unknown>): Promise<T[]> {
      return (await pool.query(sql, values ? [...values] : [])).rows as T[];
    },
  } });

  await t.test('aggregate and quote-based accounts exclude Studio, Toolbox and unknown origins', async () => {
    const result = await load();
    assert.deepEqual(result.totals, {
      accounts: 2, newSignups: 0, generators: 1, submitted: 1, videos: 1, failed: 0, pending: 0,
      imageGenerators: 0, imagesSubmitted: 0, images: 0, imageFailed: 0, imagePending: 0,
    });
    assert.match(result.notices.join(' '), /Studio: 3/);
    assert.match(result.notices.join(' '), /Toolbox: 2/);
    assert.match(result.notices.join(' '), /Unknown origin: 3/);
    assert.match(result.notices.join(' '), /before.*window end/i);
  });

  await t.test('feed cannot select a newer Studio quote or a different job owner', async () => {
    const result = await load();
    assert.deepEqual(result.generations?.map(({ jobId }) => jobId), ['real']);
    assert.equal(result.clients.find(({ client }) => client === 'claude')?.videos, 0);
    assert.equal(result.clients.find(({ client }) => client === 'other')?.videos, 1);
    assert.equal((await pool.query('SELECT COUNT(*) FROM mcp_generation_quotes')).rows[0].count, '12');
  });

  await t.test('a schema without quote origin reports unavailable rather than historical MCP zeros', async () => {
    await pool.query('ALTER TABLE mcp_generation_quotes DROP COLUMN auth_origin');
    const result = await load();
    assert.equal(result.totals, null);
    assert.equal(result.generations, null);
    assert.match(result.notices.join(' '), /quote.*origin.*unavailable/i);
  });
});
