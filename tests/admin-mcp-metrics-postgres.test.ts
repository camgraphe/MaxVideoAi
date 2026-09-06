import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from 'pg';

import {
  AUDIT_SUMMARY_SQL,
  ERROR_SQL,
  FUNNEL_SQL,
  PROVIDER_COST_SQL,
  RECEIPTS_SQL,
  RECOMMENDATION_TO_QUOTE_SQL,
  TOOL_USAGE_SQL,
} from '../frontend/server/admin-mcp-metrics-queries.ts';

import { buildMcpOutcomesSql } from '../frontend/server/admin-mcp-outcomes-queries.ts';
import type { readMcpAuthMetadata } from '../frontend/server/admin-mcp-auth-metadata.ts';
import { loadAdminMcpOutcomes } from '../frontend/server/admin-mcp-outcomes.ts';

type CommandResult = ReturnType<typeof spawnSync>;

function commandExists(command: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
}

function commandFailure(result: CommandResult): string {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

test('admin MCP aggregates enforce causal ordering, canonical UTC windows, and tool-call scope in PostgreSQL', async (t) => {
  for (const command of ['initdb', 'pg_ctl']) {
    if (!commandExists(command)) {
      t.skip(`${command} is unavailable`);
      return;
    }
  }

  const temporaryRoot = mkdtempSync(join(tmpdir(), 'admin-mcp-metrics-postgres-'));
  const dataDirectory = join(temporaryRoot, 'data');
  const socketDirectory = join(temporaryRoot, 'socket');
  mkdirSync(socketDirectory);

  const init = spawnSync('initdb', [
    '-A', 'trust', '-U', 'postgres', '-D', dataDirectory, '--no-locale', '--encoding=UTF8',
  ], { encoding: 'utf8' });
  assert.equal(init.status, 0, commandFailure(init));

  const start = spawnSync('pg_ctl', [
    '-D', dataDirectory,
    '-o', `-F -k ${socketDirectory} -c listen_addresses=''`,
    '-w', 'start',
  ], { encoding: 'utf8', stdio: 'ignore' });
  assert.equal(start.status, 0, commandFailure(start));

  t.after(() => {
    spawnSync('pg_ctl', ['-D', dataDirectory, '-m', 'immediate', '-w', 'stop'], {
      encoding: 'utf8', stdio: 'ignore',
    });
    rmSync(temporaryRoot, { recursive: true, force: true });
  });

  const client = new Client({ host: socketDirectory, user: 'postgres', database: 'postgres' });
  await client.connect();
  t.after(() => client.end());

  await client.query(`
    CREATE TABLE mcp_funnel_events (
      occurred_at TIMESTAMPTZ NOT NULL,
      event_type TEXT NOT NULL,
      stage TEXT,
      user_id TEXT,
      acquisition_client TEXT,
      quote_id UUID,
      job_id TEXT
    );
    CREATE INDEX mcp_funnel_events_type_occurred_idx
      ON mcp_funnel_events (event_type, occurred_at DESC);

    CREATE TABLE mcp_audit_events (
      event_type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      tool_name TEXT,
      outcome TEXT NOT NULL,
      error_code TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX mcp_audit_events_type_created_idx
      ON mcp_audit_events (event_type, created_at DESC);

    CREATE TABLE app_receipts (
      type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT,
      job_id TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE app_jobs (id BIGSERIAL PRIMARY KEY, job_id TEXT NOT NULL UNIQUE);
    CREATE TABLE provider_attempts (
      job_id BIGINT NOT NULL REFERENCES app_jobs(id),
      provider_cost_usd NUMERIC(12, 6),
      created_at TIMESTAMPTZ NOT NULL
    );
  `);

  await client.query(`
    INSERT INTO mcp_funnel_events
      (occurred_at, event_type, stage, user_id, acquisition_client, quote_id, job_id)
    VALUES
      ('2026-07-02 10:00Z', 'trial_quote_prepared', NULL, 'quote-a', 'other', '00000000-0000-0000-0000-000000000001', NULL),
      ('2026-07-02 09:00Z', 'trial_generation_accepted', NULL, 'quote-a', 'other', '00000000-0000-0000-0000-000000000001', NULL),
      ('2026-07-03 10:00Z', 'trial_quote_prepared', NULL, 'quote-b', 'other', '00000000-0000-0000-0000-000000000002', NULL),
      ('2026-07-03 09:00Z', 'trial_generation_accepted', NULL, 'quote-b', 'other', '00000000-0000-0000-0000-000000000002', NULL),
      ('2026-07-03 11:00Z', 'trial_generation_accepted', NULL, 'quote-b', 'other', '00000000-0000-0000-0000-000000000002', NULL),
      ('2026-07-04 10:00Z', 'trial_quote_prepared', NULL, 'quote-c', 'other', '00000000-0000-0000-0000-000000000003', NULL),
      ('2026-07-04 11:00Z', 'trial_generation_accepted', NULL, 'quote-c', 'other', '00000000-0000-0000-0000-000000000003', NULL),
      ('2026-07-04 10:30Z', 'trial_generation_released', NULL, 'quote-c', 'other', '00000000-0000-0000-0000-000000000003', NULL),
      ('2026-07-04 12:00Z', 'trial_generation_released', NULL, 'quote-c', 'other', '00000000-0000-0000-0000-000000000003', NULL),
      ('2026-07-05 10:00Z', 'trial_quote_prepared', NULL, 'quote-d', 'other', '00000000-0000-0000-0000-000000000004', NULL),
      ('2026-07-05 11:00Z', 'trial_generation_accepted', NULL, 'quote-d', 'other', '00000000-0000-0000-0000-000000000004', NULL),
      ('2026-07-05 10:30Z', 'trial_generation_released', NULL, 'quote-d', 'other', '00000000-0000-0000-0000-000000000004', NULL),
      ('2026-07-02 09:00Z', 'paid_quote_prepared', NULL, 'rec-one', 'other', '00000000-0000-0000-0000-000000000005', NULL),
      ('2026-07-02 11:00Z', 'paid_quote_prepared', NULL, 'rec-one', 'other', '00000000-0000-0000-0000-000000000006', NULL),
      ('2026-07-03 09:00Z', 'paid_quote_prepared', NULL, 'rec-two', 'other', '00000000-0000-0000-0000-000000000007', NULL),
      ('2026-06-10 10:00Z', 'paid_generation_accepted', NULL, 'paid-old', 'other', NULL, 'mcp-paid-old'),
      ('2026-06-11 10:00Z', 'trial_generation_accepted', NULL, 'trial-old', 'other', NULL, 'mcp-trial-old'),
      ('2026-07-02 10:00Z', 'paid_generation_accepted', NULL, 'paid-inside', 'other', NULL, 'mcp-paid-inside');

    INSERT INTO mcp_audit_events
      (event_type, user_id, tool_name, outcome, error_code, created_at)
    VALUES
      ('connection_initialized', 'new-connection', NULL, 'success', NULL, '2026-07-02 08:00Z'),
      ('connection_initialized', 'new-connection', NULL, 'success', NULL, '2026-07-03 08:00Z'),
      ('connection_initialized', 'returning-connection', NULL, 'success', NULL, '2026-06-30 08:00Z'),
      ('connection_initialized', 'returning-connection', NULL, 'success', NULL, '2026-07-04 08:00Z'),
      ('tool_call', 'rec-one', 'recommend_models', 'success', NULL, '2026-07-02 10:00Z'),
      ('tool_call', 'rec-two', 'recommend_models', 'success', NULL, '2026-07-03 10:00Z'),
      ('connection_initialized', 'noise-poll', 'get_generation_status', 'success', NULL, '2026-07-02 10:00Z'),
      ('tool_call', 'real-poll', 'get_generation_status', 'success', NULL, '2026-07-02 11:00Z'),
      ('connection_initialized', 'noise-error', NULL, 'failure', 'NOT_A_TOOL_ERROR', '2026-07-02 12:00Z'),
      ('tool_call', 'real-error', 'list_models', 'failure', 'TOOL_FAILURE', '2026-07-02 13:00Z'),
      ('connection_initialized', 'noise-restore', NULL, 'failure', 'REFUND_RESTORE', '2026-07-02 14:00Z'),
      ('tool_call', 'real-restore', 'list_models', 'failure', 'RESTORE_FAILED', '2026-07-02 15:00Z');

    INSERT INTO app_jobs (job_id)
    VALUES ('mcp-paid-old'), ('mcp-trial-old'), ('mcp-paid-inside'), ('not-mcp');

    INSERT INTO app_receipts (type, amount_cents, currency, job_id, created_at)
    VALUES
      ('charge', 1000, 'USD', 'mcp-paid-old', '2026-07-01 00:00Z'),
      ('refund', 200, 'USD', 'mcp-paid-old', '2026-07-04 00:00Z'),
      ('charge', 999, 'USD', 'mcp-paid-old', '2026-07-08 00:00Z'),
      ('charge', 50, NULL, 'mcp-paid-old', '2026-07-05 00:00Z'),
      ('charge', 300, 'USD', 'mcp-paid-inside', '2026-06-30 23:59:59Z'),
      ('charge', 700, 'USD', 'not-mcp', '2026-07-03 00:00Z');

    INSERT INTO provider_attempts (job_id, provider_cost_usd, created_at)
    SELECT id, 1.50, '2026-07-01 00:00Z' FROM app_jobs WHERE job_id = 'mcp-paid-old';
    INSERT INTO provider_attempts (job_id, provider_cost_usd, created_at)
    SELECT id, NULL, '2026-07-05 00:00Z' FROM app_jobs WHERE job_id = 'mcp-paid-old';
    INSERT INTO provider_attempts (job_id, provider_cost_usd, created_at)
    SELECT id, 9.00, '2026-07-08 00:00Z' FROM app_jobs WHERE job_id = 'mcp-paid-old';
    INSERT INTO provider_attempts (job_id, provider_cost_usd, created_at)
    SELECT id, 0.25, '2026-07-04 00:00Z' FROM app_jobs WHERE job_id = 'mcp-trial-old';
    INSERT INTO provider_attempts (job_id, provider_cost_usd, created_at)
    SELECT id, 0.75, '2026-06-30 23:59:59Z' FROM app_jobs WHERE job_id = 'mcp-paid-inside';
    INSERT INTO provider_attempts (job_id, provider_cost_usd, created_at)
    SELECT id, 7.00, '2026-07-03 00:00Z' FROM app_jobs WHERE job_id = 'not-mcp';
  `);

  const params = [new Date('2026-07-01T00:00:00.000Z'), new Date('2026-07-08T00:00:00.000Z')];

  await t.test('confirmation and release require a later event while an earlier plus later event still converts', async () => {
    const row = (await client.query(FUNNEL_SQL, [...params, 30 * 24 * 60 * 60])).rows[0];
    assert.equal(Number(row.quote_prepared), 7);
    assert.equal(Number(row.quote_confirmed), 3);
    assert.equal(Number(row.trial_accepted), 3);
    assert.equal(Number(row.trial_released), 1);
  });

  await t.test('recommendation conversion finds any later quote instead of only the earliest quote', async () => {
    const row = (await client.query(RECOMMENDATION_TO_QUOTE_SQL, params)).rows[0];
    assert.equal(Number(row.recommended_users), 2);
    assert.equal(Number(row.recommended_to_quote_users), 1);
  });

  await t.test('audit aggregates and error groups include tool_call events only', async () => {
    const summary = (await client.query(AUDIT_SUMMARY_SQL, params)).rows[0];
    const errors = (await client.query(ERROR_SQL, params)).rows;
    assert.equal(Number(summary.connected_users), 5);
    assert.equal(Number(summary.new_connected_users), 4);
    assert.equal(Number(summary.connection_events), 6);
    assert.equal(Number(summary.active_tool_users), 5);
    assert.equal(Number(summary.tool_calls), 5);
    assert.equal(Number(summary.successful_tool_calls), 3);
    assert.equal(Number(summary.failed_tool_calls), 2);
    assert.equal(Number(summary.polling_calls), 1);
    assert.equal(Number(summary.refund_restoration_failures), 1);
    assert.deepEqual(errors.map((row) => row.code), ['RESTORE_FAILED', 'TOOL_FAILURE']);
  });

  await t.test('tool usage groups privacy-safe call, user, and failure totals by tool', async () => {
    const rows = (await client.query(TOOL_USAGE_SQL, params)).rows;
    assert.deepEqual(rows.map((row) => ({
      tool: row.tool,
      calls: Number(row.calls),
      users: Number(row.users),
      failures: Number(row.failures),
    })), [
      { tool: 'list_models', calls: 2, users: 2, failures: 2 },
      { tool: 'recommend_models', calls: 2, users: 2, failures: 0 },
      { tool: 'get_generation_status', calls: 1, users: 1, failures: 0 },
    ]);
  });

  await t.test('receipt timestamps own the UTC window while MCP job provenance is range-independent', async () => {
    const withNullCurrency = (await client.query(RECEIPTS_SQL, params)).rows[0];
    assert.equal(Number(withNullCurrency.non_usd_receipts), 1);

    await client.query(`DELETE FROM app_receipts WHERE currency IS NULL`);
    const row = (await client.query(RECEIPTS_SQL, params)).rows[0];
    assert.equal(Number(row.revenue_cents), 1000, 'from is inclusive and to is exclusive');
    assert.equal(Number(row.refunds_cents), 200);
    assert.equal(Number(row.charged_jobs), 1);
    assert.equal(Number(row.refunded_jobs), 1);
  });

  await t.test('provider attempt timestamps own the UTC window and missing costs stay visible', async () => {
    const row = (await client.query(PROVIDER_COST_SQL, params)).rows[0];
    assert.equal(Number(row.attempt_count), 3);
    assert.equal(Number(row.trial_attempt_count), 1);
    assert.equal(Number(row.missing_cost_attempts), 1);
    assert.equal(Number(row.provider_cost_cents), 175);
    assert.equal(Number(row.trial_cost_cents), 25);
  });

  await t.test('video outcomes deduplicate users, exclude web/image jobs, and attribute each job to its own application', async () => {
    await client.query(`
      CREATE SCHEMA outcomes_fixture;
      SET search_path TO outcomes_fixture;
      CREATE TABLE mcp_audit_events (event_type text, user_id text, oauth_client_id text, outcome text, client_family text, created_at timestamptz);
      CREATE TABLE mcp_funnel_events (event_type text, user_id text, oauth_client_id text, acquisition_client text, occurred_at timestamptz);
      CREATE TABLE mcp_generation_quotes (user_id text, oauth_client_id text, job_id text UNIQUE, created_at timestamptz);
      CREATE TABLE app_jobs (job_id text UNIQUE, user_id text, surface text, status text, created_at timestamptz);
      CREATE TABLE profiles (id text PRIMARY KEY, created_at timestamptz, synced_from_supabase boolean);
      INSERT INTO profiles VALUES ('a', '2026-06-01Z', true), ('b', '2026-07-01Z', true), ('c', '2026-07-02Z', true);
      INSERT INTO mcp_audit_events VALUES
        ('connection_initialized', 'a', 'codex-id', 'success', 'codex', '2026-06-01Z'),
        ('connection_initialized', 'a', 'codex-id', 'success', 'codex', '2026-07-02Z'),
        ('connection_initialized', 'a', 'claude-id', 'success', 'claude', '2026-07-03Z'),
        ('connection_initialized', 'b', 'chatgpt-id', 'success', NULL, '2026-07-01Z'),
        ('connection_initialized', 'c', 'unknown-id', 'success', 'other', '2026-07-02Z'),
        ('connection_initialized', 'future', 'codex-id', 'success', 'codex', '2026-07-08Z');
      INSERT INTO mcp_funnel_events VALUES ('oauth_connection_completed', 'b', 'chatgpt-id', 'chatgpt', '2026-07-01Z');
      INSERT INTO app_jobs VALUES
        ('a1', 'a', 'video', 'completed', '2026-07-01Z'),
        ('a2', 'a', 'video', 'completed', '2026-07-02Z'),
        ('a3', 'a', 'video', 'completed', '2026-07-04Z'),
        ('image', 'a', 'image', 'completed', '2026-07-04Z'),
        ('b1', 'b', 'video', 'queued', '2026-07-02Z'),
        ('b2', 'b', 'video', 'failed', '2026-07-03Z'),
        ('c1', 'c', 'video', 'completed', '2026-07-04Z'),
        ('web', 'a', 'video', 'completed', '2026-07-04Z'),
        ('wrong-owner', 'outsider', 'video', 'completed', '2026-07-04Z'),
        ('before', 'a', 'video', 'completed', '2026-06-30Z'),
        ('after', 'a', 'video', 'completed', '2026-07-08Z');
      INSERT INTO mcp_generation_quotes
        SELECT 'a', CASE WHEN job_id IN ('a3', 'image') THEN 'claude-id' ELSE 'codex-id' END, job_id, '2026-06-30Z'
          FROM app_jobs WHERE job_id IN ('a1', 'a2', 'a3', 'image', 'before', 'after', 'wrong-owner');
      INSERT INTO mcp_generation_quotes VALUES
        ('b', 'chatgpt-id', 'b1', '2026-07-02Z'), ('b', 'chatgpt-id', 'b2', '2026-07-03Z'),
        ('c', 'unknown-id', 'c1', '2026-07-04Z'), ('c', 'unknown-id', NULL, '2026-07-04Z');
    `);
    const relations = { audit: true, quotes: true, jobs: true, profiles: true, funnel: true, clientFamily: true };
    const load = (readAuthMetadata?: typeof readMcpAuthMetadata) => loadAdminMcpOutcomes({ from: params[0], to: params[1], timeZone: 'UTC', conversionWindowSeconds: 60 }, {
      configured: () => true,
      readAuthMetadata,
      executor: { async query<T>(sql, values) {
        return (sql.includes('admin-mcp:outcome-relations') ? [relations] : (await client.query(sql, values ? [...values] : [])).rows) as T[];
      } },
    });
    const result = await load();
    assert.deepEqual(result.notices, []);
    assert.deepEqual(result.totals, { accounts: 3, newSignups: 2, generators: 2, submitted: 6, videos: 4, failed: 1, pending: 1 });
    assert.equal(result.clients.find((row) => row.client === 'codex')?.videos, 2);
    assert.equal(result.clients.find((row) => row.client === 'claude')?.videos, 1);
    assert.equal(result.clients.find((row) => row.client === 'chatgpt')?.newSignups, 1);
    assert.equal(result.clients.find((row) => row.client === 'other')?.videos, 1);
    assert.equal(result.clients.reduce((sum, row) => sum + row.generators, 0), 3, 'one user uses two applications while the global count remains distinct');

    await client.query(`INSERT INTO mcp_audit_events VALUES ('connection_initialized', 'c', 'unknown-id', 'success', 'codex', '2026-07-06Z')`);
    const laterIdentity = await load();
    assert.equal(laterIdentity.clients.find((row) => row.client === 'other')?.videos, 1, 'later client metadata must not relabel earlier videos');

    await client.query(`UPDATE profiles SET synced_from_supabase = false WHERE id = 'b'`);
    const missingProfile = await load();
    assert.equal(missingProfile.totals?.newSignups, null);
    assert.equal(missingProfile.totals?.videos, 4, 'registration gaps do not hide video outcomes');
    assert.equal(missingProfile.notices.length, 1);
    const recovered = await load(async (users, clients) => {
      assert.deepEqual(users, ['b']);
      assert.deepEqual(clients, ['unknown-id']);
      return { profiles: [{ user_id: 'b', registered_at: '2026-07-01Z' }], clients: [{ oauth_client_id: 'unknown-id', family: 'chatgpt' }] };
    });
    assert.equal(recovered.totals?.newSignups, 2);
    assert.equal(recovered.clients.find((row) => row.client === 'chatgpt')?.videos, 1);
    assert.equal(recovered.clients.find((row) => row.client === 'codex')?.videos, 2, 'recorded attribution wins over the registry fallback');
    assert.doesNotMatch(JSON.stringify(recovered), /user_id|oauth_client_id|missing_user_ids|unknown_client_ids/);
    const authOutage = await load(async () => { throw new Error('auth unavailable'); });
    assert.equal(authOutage.totals?.videos, 4);
    assert.equal(authOutage.totals?.newSignups, null);

    await client.query('ALTER TABLE mcp_audit_events DROP COLUMN client_family');
    const legacy = await client.query(buildMcpOutcomesSql({ ...relations, clientFamily: false, profiles: false }), [...params, JSON.stringify({ profiles: [], clients: [] })]);
    assert.equal(Number(legacy.rows.find((row) => row.client === 'all').videos), 4);
    assert.equal(Number(legacy.rows.find((row) => row.client === 'chatgpt').accounts), 1, 'signed landing attribution works on the old schema');
    await client.query('DROP TABLE mcp_funnel_events');
    const noAttribution = await client.query(buildMcpOutcomesSql({ ...relations, clientFamily: false, profiles: false, funnel: false }), [...params, JSON.stringify({ profiles: [], clients: [] })]);
    assert.equal(Number(noAttribution.rows.find((row) => row.client === 'other').videos), 4);

    await client.query('TRUNCATE mcp_audit_events, mcp_generation_quotes, app_jobs');
    const empty = await client.query(buildMcpOutcomesSql({ ...relations, clientFamily: false, profiles: false, funnel: false }), [...params, JSON.stringify({ profiles: [], clients: [] })]);
    assert.equal(Number(empty.rows[0].videos), 0);
    assert.equal(Number(empty.rows[0].accounts), 0);
    const migration = readFileSync(join(process.cwd(), 'neon/migrations/41_mcp_client_family.sql'), 'utf8');
    await client.query(migration);
    await client.query(migration);
    await assert.rejects(() => client.query(`INSERT INTO mcp_audit_events (client_family) VALUES ('raw-client-name')`), /check constraint/);
    await client.query(`INSERT INTO mcp_audit_events (client_family) VALUES ('codex'), ('claude'), ('chatgpt'), ('other'), (NULL)`);
    await client.query('SET search_path TO public');
  });

});
