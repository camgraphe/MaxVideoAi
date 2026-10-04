import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from 'pg';
import { getDb } from '../frontend/src/lib/db.ts';
import { ensureMcpSchema } from '../frontend/src/lib/schema/mcp-schema.ts';

import {
  AUDIT_SUMMARY_SQL,
  ERROR_SQL,
  FUNNEL_SQL,
  PROVIDER_COST_SQL,
  PROVIDER_OPERATIONS_SQL,
  RECEIPTS_SQL,
  RECOMMENDATION_TO_QUOTE_SQL,
  TOOL_USAGE_SQL,
} from '../frontend/server/admin-mcp-metrics-queries.ts';

import { buildMcpGenerationItemsSql, buildMcpOutcomesSql } from '../frontend/server/admin-mcp-outcomes-queries.ts';
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
      id BIGSERIAL PRIMARY KEY,
      job_id BIGINT NOT NULL REFERENCES app_jobs(id),
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TIMESTAMPTZ,
      accepted_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      fallback_to_attempt_id BIGINT,
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

    INSERT INTO provider_attempts (job_id, provider, status, started_at, accepted_at, finished_at, provider_cost_usd, created_at)
    SELECT id, 'alibaba_model_studio', 'completed', '2026-07-01 00:00Z', '2026-07-01 00:00:01Z', '2026-07-01 00:00:11Z', 1.50, '2026-07-01 00:00Z' FROM app_jobs WHERE job_id = 'mcp-paid-old';
    INSERT INTO provider_attempts (job_id, provider, status, started_at, finished_at, provider_cost_usd, created_at)
    SELECT id, 'alibaba_model_studio', 'polling_stalled', '2026-07-05 00:00Z', '2026-07-05 00:03Z', NULL, '2026-07-05 00:00Z' FROM app_jobs WHERE job_id = 'mcp-paid-old';
    INSERT INTO provider_attempts (job_id, provider, status, provider_cost_usd, created_at)
    SELECT id, 'alibaba_model_studio', 'completed', 9.00, '2026-07-08 00:00Z' FROM app_jobs WHERE job_id = 'mcp-paid-old';
    INSERT INTO provider_attempts (job_id, provider, status, started_at, finished_at, provider_cost_usd, created_at)
    SELECT id, 'fal', 'failed', '2026-07-04 00:00Z', '2026-07-04 00:00:02Z', 0.25, '2026-07-04 00:00Z' FROM app_jobs WHERE job_id = 'mcp-trial-old';
    UPDATE provider_attempts SET fallback_to_attempt_id = id WHERE provider = 'fal';
    INSERT INTO provider_attempts (job_id, provider, status, provider_cost_usd, created_at)
    SELECT id, 'fal', 'completed', 0.75, '2026-06-30 23:59:59Z' FROM app_jobs WHERE job_id = 'mcp-paid-inside';
    INSERT INTO provider_attempts (job_id, provider, status, provider_cost_usd, created_at)
    SELECT id, 'fal', 'completed', 7.00, '2026-07-03 00:00Z' FROM app_jobs WHERE job_id = 'not-mcp';
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

  await t.test('provider operations group Alibaba lifecycle, fallback, cost, and latency without payloads', async () => {
    const rows = (await client.query(PROVIDER_OPERATIONS_SQL, params)).rows;
    assert.deepEqual(rows.map((row) => ({
      provider: row.provider,
      attempts: Number(row.attempt_count),
      accepted: Number(row.accepted_count),
      completed: Number(row.completed_count),
      failed: Number(row.failed_count),
      fallbacks: Number(row.fallback_count),
      stalled: Number(row.stalled_polling_count),
      costCents: row.provider_cost_cents === null ? null : Number(row.provider_cost_cents),
      acceptanceLatencyMs: row.average_acceptance_latency_ms === null ? null : Number(row.average_acceptance_latency_ms),
      terminalLatencyMs: row.average_terminal_latency_ms === null ? null : Number(row.average_terminal_latency_ms),
    })), [{
      provider: 'alibaba_model_studio', attempts: 2, accepted: 1, completed: 1, failed: 0,
      fallbacks: 0, stalled: 1, costCents: 150, acceptanceLatencyMs: 1000, terminalLatencyMs: 95_500,
    }, {
      provider: 'fal', attempts: 1, accepted: 0, completed: 0, failed: 1,
      fallbacks: 1, stalled: 0, costCents: 25, acceptanceLatencyMs: null, terminalLatencyMs: 2000,
    }]);
  });

  await t.test('video outcomes deduplicate users, exclude web/image jobs, and attribute each job to its own application', async () => {
    await client.query(`
      CREATE SCHEMA outcomes_fixture;
      SET search_path TO outcomes_fixture;
      CREATE TABLE mcp_audit_events (event_type text, user_id text, oauth_client_id text, outcome text, client_family text, created_at timestamptz);
      CREATE TABLE mcp_funnel_events (event_type text, user_id text, oauth_client_id text, acquisition_client text, occurred_at timestamptz);
      CREATE TABLE mcp_generation_quotes (user_id text, oauth_client_id text, job_id text, created_at timestamptz);
      CREATE TABLE app_jobs (job_id text UNIQUE, user_id text, surface text, engine_id text, engine_label text, status text, created_at timestamptz);
      CREATE TABLE profiles (id text PRIMARY KEY, created_at timestamptz, synced_from_supabase boolean);
      INSERT INTO profiles VALUES
        ('a', '2026-06-01Z', true), ('b', '2026-07-01Z', true), ('c', '2026-07-02Z', true),
        ('d', '2026-07-03Z', true), ('e', '2026-07-03Z', true);
      INSERT INTO mcp_audit_events VALUES
        ('connection_initialized', 'a', 'codex-id', 'success', 'codex', '2026-06-01Z'),
        ('connection_initialized', 'a', 'codex-id', 'success', 'codex', '2026-07-02Z'),
        ('connection_initialized', 'a', 'claude-id', 'success', 'claude', '2026-07-03Z'),
        ('connection_initialized', 'b', 'chatgpt-id', 'success', NULL, '2026-07-01Z'),
        ('connection_initialized', 'c', 'unknown-id', 'success', 'other', '2026-07-02Z'),
        ('connection_initialized', 'd', 'openclaw-id', 'success', 'openclaw', '2026-07-03Z'),
        ('connection_initialized', 'e', 'n8n-id', 'success', 'n8n', '2026-07-03Z'),
        ('connection_initialized', 'future', 'codex-id', 'success', 'codex', '2026-07-08Z');
      INSERT INTO mcp_funnel_events VALUES ('oauth_connection_completed', 'b', 'chatgpt-id', 'chatgpt', '2026-07-01Z');
      INSERT INTO app_jobs VALUES
        ('a1', 'a', 'video', 'veo-3', 'Veo 3', 'completed', '2026-07-01Z'),
        ('a2', 'a', 'video', 'sora-2', 'Sora 2', 'completed', '2026-07-02Z'),
        ('a3', 'a', 'video', 'seedance-2', 'Seedance 2', 'completed', '2026-07-04Z'),
        ('image', 'a', 'image', 'gpt-image-2', 'GPT Image 2', 'completed', '2026-07-04Z'),
        ('b1', 'b', 'video', 'veo-3', 'Veo 3', 'queued', '2026-07-02Z'),
        ('b2', 'b', 'video', 'sora-2', 'Sora 2', 'failed', '2026-07-03Z'),
        ('c1', 'c', 'video', 'veo-3', 'Veo 3', 'completed', '2026-07-04Z'),
        ('d1', 'd', 'video', 'veo-3', 'Veo 3', 'completed', '2026-07-05Z'),
        ('e1', 'e', 'video', 'veo-3', 'Veo 3', 'queued', '2026-07-05Z'),
        ('image-pending', 'a', 'image', 'gpt-image-2', 'GPT Image 2', 'queued', '2026-07-05Z'),
        ('image-failed', 'a', 'image', 'gpt-image-2', 'GPT Image 2', 'failed', '2026-07-06Z'),
        ('web', 'a', 'video', 'veo-3', 'Veo 3', 'completed', '2026-07-04Z'),
        ('wrong-owner', 'outsider', 'video', 'veo-3', 'Veo 3', 'completed', '2026-07-04Z'),
        ('before', 'a', 'video', 'veo-3', 'Veo 3', 'completed', '2026-06-30Z'),
        ('after', 'a', 'video', 'veo-3', 'Veo 3', 'completed', '2026-07-08Z');
      INSERT INTO mcp_generation_quotes
        SELECT 'a', CASE WHEN job_id IN ('a3', 'image') THEN 'claude-id' ELSE 'codex-id' END, job_id, '2026-06-30Z'
          FROM app_jobs WHERE job_id IN ('a1', 'a2', 'a3', 'image', 'before', 'after', 'wrong-owner');
      INSERT INTO mcp_generation_quotes VALUES ('a', 'codex-id', 'a1', '2026-07-01 00:30Z');
      INSERT INTO mcp_generation_quotes VALUES
        ('b', 'chatgpt-id', 'b1', '2026-07-02Z'), ('b', 'chatgpt-id', 'b2', '2026-07-03Z'),
        ('c', 'unknown-id', 'c1', '2026-07-04Z'), ('c', 'unknown-id', NULL, '2026-07-04Z'),
        ('d', 'openclaw-id', 'd1', '2026-07-05Z'), ('e', 'n8n-id', 'e1', '2026-07-05Z'),
        ('a', 'codex-id', 'image-pending', '2026-07-05Z'), ('a', 'codex-id', 'image-failed', '2026-07-06Z');
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
    assert.deepEqual(result.totals, { accounts: 5, newSignups: 4, generators: 3, submitted: 8, videos: 5, failed: 1, pending: 2, imageGenerators: 1, imagesSubmitted: 3, images: 1, imageFailed: 1, imagePending: 1 });
    assert.equal(result.clients.find((row) => row.client === 'codex')?.videos, 2);
    assert.equal(result.clients.find((row) => row.client === 'claude')?.videos, 1);
    assert.equal(result.clients.find((row) => row.client === 'chatgpt')?.newSignups, 1);
    assert.equal(result.clients.find((row) => row.client === 'openclaw')?.videos, 1);
    assert.equal(result.clients.find((row) => row.client === 'n8n')?.pending, 1);
    assert.equal(result.clients.find((row) => row.client === 'claude')?.images, 1);
    assert.equal(result.generations.find((row) => row.jobId === 'image')?.surface, 'image');
    assert.equal(result.generations.find((row) => row.jobId === 'image')?.engineId, 'gpt-image-2');
    assert.equal(result.generations.length, 11);
    assert.equal(result.generations.filter((row) => row.jobId === 'a1').length, 1, 'quote retries must not duplicate a generation row');
    assert.equal(result.clients.find((row) => row.client === 'other')?.videos, 1);
    assert.equal(result.clients.reduce((sum, row) => sum + row.generators, 0), 4, 'one user uses two applications while the global count remains distinct');

    await (async () => {
      await client.query(`
        INSERT INTO app_jobs
        SELECT 'bulk-' || n, 'a', CASE WHEN n % 2 = 0 THEN 'image' ELSE 'video' END,
               CASE WHEN n % 2 = 0 THEN 'gpt-image-2' ELSE 'veo-3' END,
               CASE WHEN n % 2 = 0 THEN 'GPT Image 2' ELSE 'Veo 3' END,
               'completed', '2026-07-07Z'::timestamptz + n * interval '1 minute'
          FROM generate_series(1, 35) AS series(n);
        INSERT INTO mcp_generation_quotes
        SELECT 'a', 'codex-id', 'bulk-' || n, '2026-07-07Z'::timestamptz + n * interval '1 minute'
          FROM generate_series(1, 35) AS series(n);
        INSERT INTO mcp_generation_quotes VALUES ('a', 'codex-id', 'bulk-35', '2026-07-07 01:00Z');
      `);
      const rows = (await client.query(buildMcpGenerationItemsSql({ audit: true, quotes: true, jobs: true, profiles: true, funnel: true, clientFamily: true }), [
        ...params, JSON.stringify({ profiles: [], clients: [] }), 30,
      ])).rows;
      assert.equal(rows.length, 30);
      assert.equal(rows[0].job_id, 'bulk-35');
      assert.equal(new Set(rows.map((row) => row.job_id)).size, 30);
      assert.ok(rows.some((row) => row.surface === 'image'));
      assert.ok(rows.some((row) => row.surface === 'video'));
      assert.ok(rows.every((row) => row.created_at >= params[0] && row.created_at < params[1]));
      await client.query(`DELETE FROM mcp_generation_quotes WHERE job_id LIKE 'bulk-%'; DELETE FROM app_jobs WHERE job_id LIKE 'bulk-%';`);
    })();

    await client.query(`INSERT INTO mcp_audit_events VALUES ('connection_initialized', 'c', 'unknown-id', 'success', 'codex', '2026-07-06Z')`);
    const laterIdentity = await load();
    assert.equal(laterIdentity.clients.find((row) => row.client === 'other')?.videos, 1, 'later client metadata must not relabel earlier videos');

    await client.query(`UPDATE profiles SET synced_from_supabase = false WHERE id = 'b'`);
    const missingProfile = await load();
    assert.equal(missingProfile.totals?.newSignups, null);
    assert.equal(missingProfile.totals?.videos, 5, 'registration gaps do not hide video outcomes');
    assert.equal(missingProfile.notices.length, 1);
    const recovered = await load(async (users, clients) => {
      assert.deepEqual(users, ['b']);
      assert.deepEqual(clients, ['unknown-id']);
      return { profiles: [{ user_id: 'b', registered_at: '2026-07-01Z' }], clients: [{ oauth_client_id: 'unknown-id', family: 'chatgpt' }] };
    });
    assert.equal(recovered.totals?.newSignups, 4);
    assert.equal(recovered.clients.find((row) => row.client === 'chatgpt')?.videos, 1);
    assert.equal(recovered.clients.find((row) => row.client === 'codex')?.videos, 2, 'recorded attribution wins over the registry fallback');
    assert.doesNotMatch(JSON.stringify(recovered), /user_id|oauth_client_id|missing_user_ids|unknown_client_ids/);
    const authOutage = await load(async () => { throw new Error('auth unavailable'); });
    assert.equal(authOutage.totals?.videos, 5);
    assert.equal(authOutage.totals?.newSignups, null);

    await client.query(`
      INSERT INTO profiles VALUES ('glama-user', '2026-07-04Z', true);
      INSERT INTO mcp_audit_events VALUES ('connection_initialized', 'glama-user', 'glama-id', 'success', 'glama', '2026-07-04Z');
      INSERT INTO app_jobs VALUES ('glama-video', 'glama-user', 'video', 'veo-3', 'Veo 3', 'completed', '2026-07-05Z');
      INSERT INTO mcp_generation_quotes VALUES ('glama-user', 'glama-id', 'glama-video', '2026-07-04Z');
    `);
    const glamaOutcome = await load();
    assert.equal(glamaOutcome.clients.find((row) => row.client === 'glama')?.accounts, 1);
    assert.equal(glamaOutcome.clients.find((row) => row.client === 'glama')?.videos, 1);
    assert.equal(glamaOutcome.totals?.videos, 6);
    await client.query(`
      DELETE FROM mcp_generation_quotes WHERE job_id = 'glama-video';
      DELETE FROM app_jobs WHERE job_id = 'glama-video';
      DELETE FROM mcp_audit_events WHERE user_id = 'glama-user';
      DELETE FROM profiles WHERE id = 'glama-user';
    `);

    await client.query('ALTER TABLE mcp_audit_events DROP COLUMN client_family');
    const legacy = await client.query(buildMcpOutcomesSql({ ...relations, clientFamily: false, profiles: false }), [...params, JSON.stringify({ profiles: [], clients: [] })]);
    assert.equal(Number(legacy.rows.find((row) => row.client === 'all').videos), 5);
    assert.equal(Number(legacy.rows.find((row) => row.client === 'chatgpt').accounts), 1, 'signed landing attribution works on the old schema');
    await client.query('DROP TABLE mcp_funnel_events');
    const noAttribution = await client.query(buildMcpOutcomesSql({ ...relations, clientFamily: false, profiles: false, funnel: false }), [...params, JSON.stringify({ profiles: [], clients: [] })]);
    assert.equal(Number(noAttribution.rows.find((row) => row.client === 'other').videos), 5);

    await client.query('TRUNCATE mcp_audit_events, mcp_generation_quotes, app_jobs');
    const empty = await client.query(buildMcpOutcomesSql({ ...relations, clientFamily: false, profiles: false, funnel: false }), [...params, JSON.stringify({ profiles: [], clients: [] })]);
    assert.equal(Number(empty.rows[0].videos), 0);
    assert.equal(Number(empty.rows[0].accounts), 0);
    const migration = readFileSync(join(process.cwd(), 'neon/migrations/41_mcp_client_family.sql'), 'utf8');
    const ecosystemMigration = readFileSync(join(process.cwd(), 'neon/migrations/42_mcp_client_family_ecosystem.sql'), 'utf8');
    const glamaMigrationPath = join(process.cwd(), 'neon/migrations/48_mcp_client_family_glama.sql');
    assert.equal(existsSync(glamaMigrationPath), true, 'Glama needs a forward-only client-family migration');
    const glamaMigration = readFileSync(glamaMigrationPath, 'utf8');
    await client.query(migration);
    await client.query(ecosystemMigration);
    await client.query(ecosystemMigration);
    await assert.rejects(() => client.query(`INSERT INTO mcp_audit_events (client_family) VALUES ('glama')`), /check constraint/);
    await client.query(glamaMigration);
    await client.query(glamaMigration);
    await assert.rejects(() => client.query(`INSERT INTO mcp_audit_events (client_family) VALUES ('raw-client-name')`), /check constraint/);
    await client.query(`INSERT INTO mcp_audit_events (client_family) VALUES
      ('codex'), ('claude'), ('chatgpt'), ('openclaw'), ('n8n'), ('glama'), ('cursor'),
      ('githubCopilot'), ('geminiCli'), ('microsoftCopilot'), ('other'), (NULL)`);
    await client.query(ecosystemMigration);
    await client.query(`INSERT INTO mcp_audit_events (client_family) VALUES ('glama')`);

    await client.query(`
      ALTER TABLE mcp_audit_events DROP CONSTRAINT mcp_audit_events_client_family_check;
      ALTER TABLE mcp_audit_events ADD CONSTRAINT mcp_audit_events_client_family_check
        CHECK (client_family IS NULL OR client_family IN (
          'chatgpt', 'claude', 'codex', 'openclaw', 'n8n', 'glama', 'cursor',
          'githubCopilot', 'geminiCli', 'microsoftCopilot', 'other', 'future-client'
        ));
    `);
    const before = await client.query(`SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid = 'mcp_audit_events'::regclass
        AND conname = 'mcp_audit_events_client_family_check'`);
    await assert.rejects(() => client.query(ecosystemMigration), /unexpected MCP client-family constraint/);
    await assert.rejects(() => client.query(glamaMigration), /unexpected MCP client-family constraint/);
    const after = await client.query(`SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid = 'mcp_audit_events'::regclass
        AND conname = 'mcp_audit_events_client_family_check'`);
    assert.equal(after.rows[0]?.definition, before.rows[0]?.definition, 'a later constraint change must survive unchanged');
    await client.query(`INSERT INTO mcp_audit_events (client_family) VALUES ('future-client')`);
    await client.query('SET search_path TO public');
  });

  await t.test('runtime audit bootstrap accepts the same Glama family as the migration', async () => {
    const priorDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = `postgresql://postgres@localhost/postgres?host=${encodeURIComponent(socketDirectory)}`;
    try {
      await ensureMcpSchema();
      await client.query(`INSERT INTO public.mcp_audit_events (event_type, user_id, outcome, client_family, created_at)
        VALUES ('connection_initialized', 'bootstrap-glama', 'success', 'glama', NOW())`);
      await assert.rejects(() => client.query(`INSERT INTO public.mcp_audit_events (event_type, user_id, outcome, client_family, created_at)
        VALUES ('connection_initialized', 'bootstrap-unknown', 'success', 'glama-proxy', NOW())`), /check constraint/);
    } finally {
      await getDb().end();
      if (priorDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = priorDatabaseUrl;
    }
  });

});
