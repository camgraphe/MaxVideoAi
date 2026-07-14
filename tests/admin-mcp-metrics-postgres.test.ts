import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
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
} from '../frontend/server/admin-mcp-metrics-queries.ts';

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
    assert.equal(Number(summary.polling_calls), 1);
    assert.equal(Number(summary.refund_restoration_failures), 1);
    assert.deepEqual(errors.map((row) => row.code), ['RESTORE_FAILED', 'TOOL_FAILURE']);
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
});
