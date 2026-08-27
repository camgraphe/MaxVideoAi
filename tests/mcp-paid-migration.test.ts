import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from 'pg';

import type { QueryExecutor, TransactionQueryExecutor } from '../frontend/src/lib/db';
import { hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';

const migrationPath = 'neon/migrations/30_mcp_paid_generation.sql';
const quoteLifetimeMigrationPath = 'neon/migrations/39_mcp_quote_lifetime.sql';
const referenceUploadMigrationPath = 'neon/migrations/32_mcp_reference_uploads.sql';
const runtimeSchemaPath = 'frontend/src/lib/schema/mcp-schema.ts';

function commandExists(command: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
}

function commandFailure(result: ReturnType<typeof spawnSync>): string {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

test('migration 30 remains the paid-generation owner alongside trial migration 31', () => {
  assert.equal(existsSync(migrationPath), true, `${migrationPath} should exist`);
  const numbered = readdirSync('neon/migrations')
    .filter((name) => /^\d+_.+\.sql$/u.test(name))
    .filter((name) => /^3[0-3]_/u.test(name))
    .sort();
  assert.deepEqual(numbered, [
    '30_mcp_paid_generation.sql',
    '31_mcp_trial_entitlements.sql',
    '32_mcp_reference_uploads.sql',
    '33_mcp_acquisition_funnel.sql',
  ]);

  const runtimeSchema = readFileSync(runtimeSchemaPath, 'utf8');
  assert.match(runtimeSchema, /migration-owned/i);
  assert.doesNotMatch(runtimeSchema, /mcp_generation_quotes|mcp_spending_limits/i);
});

test('migration 30 defines private versioned quotes, NULL-safe limits, transitions, and query indexes', () => {
  const source = readFileSync(migrationPath, 'utf8');

  assert.match(source, /CREATE TABLE IF NOT EXISTS mcp_generation_quotes/i);
  assert.match(source, /quote_id\s+UUID\s+PRIMARY KEY/i);
  assert.match(source, /request_json\s+JSONB\s+NOT NULL/i);
  assert.match(source, /jsonb_typeof\s*\(request_json\)\s*=\s*'object'/i);
  assert.match(source, /request_json\s*->\s*'schemaVersion'/i);
  assert.match(source, /pricing_snapshot\s+JSONB\s+NOT NULL/i);
  assert.match(source, /jsonb_typeof\s*\(pricing_snapshot\)\s*=\s*'object'/i);
  assert.match(source, /price_cents\s+INTEGER\s+NOT NULL/i);
  assert.match(source, /funding_mode\s+TEXT\s+NOT NULL/i);
  assert.match(source, /funding_mode\s*=\s*'wallet'/i);
  assert.match(source, /state\s+TEXT\s+NOT NULL/i);
  assert.match(source, /expires_at\s*=\s*created_at\s*\+\s*INTERVAL\s*'10 minutes'/i);
  assert.match(source, /IS DISTINCT FROM/i);
  assert.match(source, /prepared[\s\S]*claimed[\s\S]*accepted[\s\S]*failed[\s\S]*expired/i);

  assert.match(source, /CREATE TABLE IF NOT EXISTS mcp_spending_limits/i);
  assert.match(source, /paid_generation_enabled\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+TRUE/i);
  for (const column of ['per_generation_cents', 'daily_cents', 'web_approval_above_cents']) {
    assert.match(source, new RegExp(`${column}\\s+INTEGER`, 'i'));
    assert.match(source, new RegExp(`${column}\\s+IS NULL[\\s\\S]*${column}\\s*>=\\s*0`, 'i'));
  }

  assert.match(source, /\(user_id, created_at DESC\)/i);
  assert.match(source, /\(oauth_client_id, created_at DESC\)/i);
  assert.match(source, /\(expires_at\)/i);
  assert.match(source, /\(state(?:, created_at DESC)?\)/i);
  assert.match(
    source,
    /\(user_id, currency, claimed_at\)[\s\S]*WHERE state IN \('claimed', 'accepted'\)/i,
  );

  const quoteTable = source.match(/CREATE TABLE IF NOT EXISTS mcp_generation_quotes\s*\(([\s\S]*?)\n\);/i)?.[1] ?? '';
  assert.doesNotMatch(quoteTable, /\bprompt\b|reference_url|source_url|provider_body|access_token/i);
});

test('migration 39 extends new MCP quotes to forty-five minutes while preserving legacy rows', () => {
  assert.equal(
    existsSync(quoteLifetimeMigrationPath),
    true,
    `${quoteLifetimeMigrationPath} should exist`,
  );
  const source = readFileSync(quoteLifetimeMigrationPath, 'utf8');

  assert.match(source, /DROP CONSTRAINT IF EXISTS mcp_generation_quotes_lifetime/i);
  assert.match(source, /ADD CONSTRAINT mcp_generation_quotes_lifetime/i);
  assert.match(source, /INTERVAL\s*'10 minutes'/i);
  assert.match(source, /INTERVAL\s*'45 minutes'/i);
  assert.doesNotMatch(source, /UPDATE\s+mcp_generation_quotes/i);
});

test('migration 30 constraints, state machine, immutability, indexes, row locks, and rollback execute in local PostgreSQL', async (t) => {
  for (const command of ['initdb', 'pg_ctl', 'psql']) {
    if (!commandExists(command)) {
      t.skip(`${command} is unavailable`);
      return;
    }
  }

  const root = process.cwd();
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'mcp-paid-postgres-'));
  const dataDirectory = join(temporaryRoot, 'data');
  const socketDirectory = join(temporaryRoot, 'socket');
  mkdirSync(socketDirectory);

  const init = spawnSync('initdb', [
    '-A', 'trust', '-U', 'postgres', '-D', dataDirectory, '--no-locale', '--encoding=UTF8',
  ], { encoding: 'utf8' });
  assert.equal(init.status, 0, commandFailure(init));

  const start = spawnSync('pg_ctl', [
    '-D', dataDirectory, '-o', `-F -k ${socketDirectory} -c listen_addresses=''`, '-w', 'start',
  ], { encoding: 'utf8', stdio: 'ignore' });
  assert.equal(start.status, 0, commandFailure(start));

  t.after(() => {
    spawnSync('pg_ctl', ['-D', dataDirectory, '-m', 'immediate', '-w', 'stop'], {
      encoding: 'utf8', stdio: 'ignore',
    });
    rmSync(temporaryRoot, { recursive: true, force: true });
  });

  const psql = (...args: string[]) => spawnSync('psql', [
    '-X', '-h', socketDirectory, '-U', 'postgres', '-d', 'postgres', ...args,
  ], { encoding: 'utf8' });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const migration = psql(
      '--single-transaction', '-v', 'ON_ERROR_STOP=1', '-f', join(root, migrationPath),
    );
    assert.equal(migration.status, 0, commandFailure(migration));
    const referenceUploadMigration = psql(
      '--single-transaction', '-v', 'ON_ERROR_STOP=1', '-f', join(root, referenceUploadMigrationPath),
    );
    assert.equal(referenceUploadMigration.status, 0, commandFailure(referenceUploadMigration));
    const quoteLifetimeMigration = psql(
      '--single-transaction', '-v', 'ON_ERROR_STOP=1', '-f', join(root, quoteLifetimeMigrationPath),
    );
    assert.equal(quoteLifetimeMigration.status, 0, commandFailure(quoteLifetimeMigration));
  }

  const baseValues = `
    '00000000-0000-4000-8000-000000000001', 'user-a', 'client-a',
    '{"schemaVersion":1,"prompt":"private prompt","references":[]}'::jsonb,
    repeat('a', 64), 'catalog-1', '{"totalCents":25}'::jsonb,
    25, 'USD', 'wallet', 'prepared',
    '2026-07-16T10:10:00Z', '2026-07-16T10:00:00Z', '2026-07-16T10:00:00Z'
  `;
  const insertValid = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    INSERT INTO mcp_generation_quotes (
      quote_id, user_id, oauth_client_id, request_json, request_hash, catalog_revision,
      pricing_snapshot, price_cents, currency, funding_mode, state,
      expires_at, created_at, updated_at
    ) VALUES (${baseValues});
    INSERT INTO mcp_generation_quotes (
      quote_id, user_id, oauth_client_id, request_json, request_hash, catalog_revision,
      pricing_snapshot, price_cents, currency, funding_mode, state,
      expires_at, created_at, updated_at
    ) VALUES (
      '00000000-0000-4000-8000-000000000009', 'forty-five-user', 'client-a',
      '{"schemaVersion":1}'::jsonb, repeat('e', 64), 'catalog-1', '{}'::jsonb,
      25, 'USD', 'wallet', 'prepared',
      '2026-07-16T10:45:00Z', '2026-07-16T10:00:00Z', '2026-07-16T10:00:00Z'
    );
    INSERT INTO mcp_spending_limits (
      user_id, paid_generation_enabled, per_generation_cents, daily_cents, web_approval_above_cents
    ) VALUES ('user-a', FALSE, NULL, 500, 100);
  `);
  assert.equal(insertValid.status, 0, commandFailure(insertValid));
  const switchDefault = psql('-At', '-v', 'ON_ERROR_STOP=1', '-c', `
    INSERT INTO mcp_spending_limits (user_id) VALUES ('switch-default');
    SELECT paid_generation_enabled FROM mcp_spending_limits WHERE user_id = 'switch-default';
  `);
  assert.equal(switchDefault.status, 0, commandFailure(switchDefault));
  assert.equal(switchDefault.stdout.trim(), 't');

  const invalidInserts = new Map<string, string>([
    ['request object', `INSERT INTO mcp_generation_quotes (
      quote_id, user_id, request_json, request_hash, catalog_revision, pricing_snapshot,
      price_cents, currency, funding_mode, state, expires_at, created_at, updated_at
    ) VALUES (
      '00000000-0000-4000-8000-000000000010', 'bad-request', '[]',
      repeat('b',64), 'catalog', '{}', 1, 'USD', 'wallet', 'prepared',
      '2026-07-16T10:10:00Z', '2026-07-16T10:00:00Z', '2026-07-16T10:00:00Z'
    )`],
    ['request version', `INSERT INTO mcp_generation_quotes (
      quote_id, user_id, request_json, request_hash, catalog_revision, pricing_snapshot,
      price_cents, currency, funding_mode, state, expires_at, created_at, updated_at
    ) VALUES (
      '00000000-0000-4000-8000-000000000011', 'bad-version', '{"schemaVersion":"1"}',
      repeat('b',64), 'catalog', '{}', 1, 'USD', 'wallet', 'prepared',
      '2026-07-16T10:10:00Z', '2026-07-16T10:00:00Z', '2026-07-16T10:00:00Z'
    )`],
    ['pricing object', `INSERT INTO mcp_generation_quotes (
      quote_id, user_id, request_json, request_hash, catalog_revision, pricing_snapshot,
      price_cents, currency, funding_mode, state, expires_at, created_at, updated_at
    ) VALUES (
      '00000000-0000-4000-8000-000000000012', 'bad-pricing', '{"schemaVersion":1}',
      repeat('b',64), 'catalog', '[]', 1, 'USD', 'wallet', 'prepared',
      '2026-07-16T10:10:00Z', '2026-07-16T10:00:00Z', '2026-07-16T10:00:00Z'
    )`],
    ['nonnegative price', `UPDATE mcp_generation_quotes SET price_cents = -1 WHERE user_id = 'user-a'`],
    ['currency', `UPDATE mcp_generation_quotes SET currency = 'usd' WHERE user_id = 'user-a'`],
    ['funding', `UPDATE mcp_generation_quotes SET funding_mode = NULL WHERE user_id = 'user-a'`],
    ['state null', `UPDATE mcp_generation_quotes SET state = NULL WHERE user_id = 'user-a'`],
    ['claimed shape', `UPDATE mcp_generation_quotes SET state = 'claimed' WHERE user_id = 'user-a'`],
    ['initial state', `INSERT INTO mcp_generation_quotes (
      quote_id, user_id, request_json, request_hash, catalog_revision, pricing_snapshot,
      price_cents, currency, funding_mode, state, job_id, expires_at, claimed_at, created_at, updated_at
    ) VALUES (
      '00000000-0000-4000-8000-000000000013', 'bad-initial-state', '{"schemaVersion":1}',
      repeat('b',64), 'catalog', '{}', 1, 'USD', 'wallet', 'accepted', 'bad-job',
      '2026-07-16T10:10:00Z', '2026-07-16T10:01:00Z',
      '2026-07-16T10:00:00Z', '2026-07-16T10:02:00Z'
    )`],
    ['lifetime', `UPDATE mcp_generation_quotes SET expires_at = expires_at + INTERVAL '1 second' WHERE user_id = 'user-a'`],
    ['unsupported lifetime', `INSERT INTO mcp_generation_quotes (
      quote_id, user_id, request_json, request_hash, catalog_revision, pricing_snapshot,
      price_cents, currency, funding_mode, state, expires_at, created_at, updated_at
    ) VALUES (
      '00000000-0000-4000-8000-000000000014', 'bad-lifetime', '{"schemaVersion":1}',
      repeat('b',64), 'catalog', '{}', 1, 'USD', 'wallet', 'prepared',
      '2026-07-16T10:20:00Z', '2026-07-16T10:00:00Z', '2026-07-16T10:00:00Z'
    )`],
    ['negative per generation', `UPDATE mcp_spending_limits SET per_generation_cents = -1 WHERE user_id = 'user-a'`],
    ['negative daily', `UPDATE mcp_spending_limits SET daily_cents = -1 WHERE user_id = 'user-a'`],
    ['negative approval', `UPDATE mcp_spending_limits SET web_approval_above_cents = -1 WHERE user_id = 'user-a'`],
  ]);

  for (const [label, sql] of invalidInserts) {
    const result = psql('-v', 'ON_ERROR_STOP=1', '-c', sql);
    assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
  }

  const transition = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    UPDATE mcp_generation_quotes
       SET state = 'claimed', job_id = 'job-one', claimed_at = '2026-07-16T10:01:00Z',
           updated_at = '2026-07-16T10:01:00Z'
     WHERE user_id = 'user-a';
    UPDATE mcp_generation_quotes
       SET state = 'accepted', updated_at = '2026-07-16T10:02:00Z'
     WHERE user_id = 'user-a';
  `);
  assert.equal(transition.status, 0, commandFailure(transition));

  for (const sql of [
    `UPDATE mcp_generation_quotes SET request_hash = repeat('f',64) WHERE user_id = 'user-a'`,
    `UPDATE mcp_generation_quotes SET job_id = 'job-two' WHERE user_id = 'user-a'`,
    `UPDATE mcp_generation_quotes SET state = 'prepared' WHERE user_id = 'user-a'`,
  ]) {
    const result = psql('-v', 'ON_ERROR_STOP=1', '-c', sql);
    assert.notEqual(result.status, 0, sql);
  }

  const terminalMutation = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    INSERT INTO mcp_generation_quotes (
      quote_id, user_id, request_json, request_hash, catalog_revision, pricing_snapshot,
      price_cents, currency, funding_mode, state, expires_at, created_at, updated_at
    ) VALUES (
      '00000000-0000-4000-8000-000000000020', 'terminal-user', '{"schemaVersion":1}',
      repeat('d',64), 'catalog', '{}', 1, 'USD', 'wallet', 'prepared',
      '2026-07-16T10:10:00Z', '2026-07-16T10:00:00Z', '2026-07-16T10:00:00Z'
    );
    UPDATE mcp_generation_quotes
       SET state = 'failed', updated_at = '2026-07-16T10:01:00Z'
     WHERE user_id = 'terminal-user';
  `);
  assert.equal(terminalMutation.status, 0, commandFailure(terminalMutation));
  const lateJobMutation = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    UPDATE mcp_generation_quotes
       SET job_id = 'late-job', claimed_at = '2026-07-16T10:01:00Z'
     WHERE user_id = 'terminal-user'
  `);
  assert.notEqual(lateJobMutation.status, 0, 'a terminal quote must not gain a job after transition');

  const clientA = new Client({ host: socketDirectory, user: 'postgres', database: 'postgres' });
  const clientB = new Client({ host: socketDirectory, user: 'postgres', database: 'postgres' });
  await Promise.all([clientA.connect(), clientB.connect()]);
  t.after(async () => Promise.allSettled([clientA.end(), clientB.end()]));

  const lockRequest: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'seedance-2-0-mini',
    mode: 't2v',
    prompt: 'private lock prompt',
    settings: { durationSec: 5 },
    references: [],
    outputCount: 1,
  };
  const lockRequestHash = hashCanonicalGenerationRequest(lockRequest);
  await clientA.query(`
    WITH quote_time AS (
      SELECT clock_timestamp() AS created_at
    )
    INSERT INTO mcp_generation_quotes (
      quote_id, user_id, oauth_client_id, request_json, request_hash, catalog_revision,
      pricing_snapshot, price_cents, currency, funding_mode, state,
      expires_at, created_at, updated_at
    )
    SELECT '00000000-0000-4000-8000-000000000002', 'lock-user', 'lock-client',
           $1::jsonb, $2, 'catalog-lock', '{}', 10, 'USD', 'wallet',
           'prepared', created_at + INTERVAL '10 minutes', created_at, created_at
      FROM quote_time
  `, [JSON.stringify(lockRequest), lockRequestHash]);
  const executorA: QueryExecutor = {
    async query<TRecord>(text, params) {
      return (await clientA.query<TRecord>(text, params as unknown[] | undefined)).rows;
    },
  };
  const executorB: QueryExecutor = {
    async query<TRecord>(text, params) {
      return (await clientB.query<TRecord>(text, params as unknown[] | undefined)).rows;
    },
  };
  const transactionExecutorA = executorA as TransactionQueryExecutor;
  const transactionExecutorB = executorB as TransactionQueryExecutor;
  const { lockOwnedPreparedQuote, markQuoteAccepted } = await import(
    '../frontend/src/server/agent-api/quote-repository'
  );
  const { checkMcpSpendingLimits } = await import(
    '../frontend/src/server/agent-api/spending-limits'
  );

  await clientA.query('BEGIN');
  const locked = await lockOwnedPreparedQuote(
    { quoteId: '00000000-0000-4000-8000-000000000002', userId: 'lock-user', oauthClientId: 'lock-client' },
    { executor: transactionExecutorA },
  );
  assert.equal(locked?.state, 'prepared');

  await clientB.query('BEGIN');
  await clientB.query(`SET LOCAL statement_timeout = '200ms'`);
  await assert.rejects(
    lockOwnedPreparedQuote(
      { quoteId: '00000000-0000-4000-8000-000000000002', userId: 'lock-user', oauthClientId: 'lock-client' },
      { executor: transactionExecutorB },
    ),
    /statement timeout|canceling statement/i,
  );
  await clientB.query('ROLLBACK');
  await clientA.query('ROLLBACK');

  const expiringQuoteId = '00000000-0000-4000-8000-000000000003';
  await clientA.query(`
    WITH quote_time AS (
      SELECT clock_timestamp() - INTERVAL '9 minutes 58 seconds' AS created_at
    )
    INSERT INTO mcp_generation_quotes (
      quote_id, user_id, oauth_client_id, request_json, request_hash, catalog_revision,
      pricing_snapshot, price_cents, currency, funding_mode, state,
      expires_at, created_at, updated_at
    )
    SELECT $1, 'expiring-user', 'expiring-client', $2::jsonb, $3, 'catalog-expiring',
           '{}', 10, 'USD', 'wallet', 'prepared',
           created_at + INTERVAL '10 minutes', created_at, created_at
      FROM quote_time
  `, [expiringQuoteId, JSON.stringify(lockRequest), lockRequestHash]);
  await clientA.query('BEGIN');
  assert.equal((await lockOwnedPreparedQuote(
    { quoteId: expiringQuoteId, userId: 'expiring-user', oauthClientId: 'expiring-client' },
    { executor: transactionExecutorA },
  ))?.quoteId, expiringQuoteId);
  await clientB.query('BEGIN');
  let quoteWaiterSettled = false;
  const waiter = lockOwnedPreparedQuote(
    { quoteId: expiringQuoteId, userId: 'expiring-user', oauthClientId: 'expiring-client' },
    { executor: transactionExecutorB },
  );
  void waiter.then(
    () => { quoteWaiterSettled = true; },
    () => { quoteWaiterSettled = true; },
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(quoteWaiterSettled, false, 'transaction B must still be waiting on transaction A');
  await new Promise((resolve) => setTimeout(resolve, 2_100));
  await clientA.query('COMMIT');
  assert.equal(
    await waiter,
    null,
    'a waiter must evaluate expiry after acquiring the row lock, not before waiting',
  );
  await clientB.query('ROLLBACK');

  await clientA.query('BEGIN');
  const claimedForRollback = await clientA.query<{ claimed_at: Date }>(`
    UPDATE mcp_generation_quotes
       SET state = 'claimed', job_id = 'job-rollback', claimed_at = clock_timestamp(),
           updated_at = clock_timestamp()
     WHERE quote_id = '00000000-0000-4000-8000-000000000002'
     RETURNING claimed_at
  `);
  const accepted = await markQuoteAccepted({
    quoteId: '00000000-0000-4000-8000-000000000002',
    userId: 'lock-user',
    oauthClientId: 'lock-client',
    jobId: 'job-rollback',
  }, {
    executor: executorA,
    now: () => new Date(claimedForRollback.rows[0].claimed_at.getTime() + 1_000),
  });
  assert.equal(accepted?.state, 'accepted');
  await clientA.query('ROLLBACK');
  const afterRollback = await clientA.query<{ state: string }>(
    `SELECT state FROM mcp_generation_quotes WHERE quote_id = '00000000-0000-4000-8000-000000000002'`,
  );
  assert.equal(afterRollback.rows[0]?.state, 'prepared');

  await clientA.query(`
    INSERT INTO mcp_spending_limits (user_id, daily_cents)
    VALUES ('spend-user', 100);
    WITH day_clock AS (
      SELECT date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS day_start
    )
    INSERT INTO mcp_generation_quotes (
      quote_id, user_id, request_json, request_hash, catalog_revision, pricing_snapshot,
      price_cents, currency, funding_mode, state, expires_at, created_at, updated_at
    )
    SELECT
        '00000000-0000-4000-8000-000000000031'::uuid, 'spend-user', '{"schemaVersion":1}'::jsonb,
        repeat('e',64), 'catalog', '{}'::jsonb, 40, 'USD', 'wallet', 'prepared',
        day_start, day_start - INTERVAL '10 minutes', day_start - INTERVAL '10 minutes'
      FROM day_clock
    UNION ALL
    SELECT
        '00000000-0000-4000-8000-000000000032'::uuid, 'spend-user', '{"schemaVersion":1}'::jsonb,
        repeat('f',64), 'catalog', '{}'::jsonb, 30, 'USD', 'wallet', 'prepared',
        day_start + INTERVAL '10 minutes', day_start, day_start
      FROM day_clock;
    UPDATE mcp_generation_quotes
       SET state = 'claimed',
           job_id = CASE quote_id
             WHEN '00000000-0000-4000-8000-000000000031' THEN 'spend-yesterday'
             ELSE 'spend-today'
           END,
           claimed_at = CASE quote_id
             WHEN '00000000-0000-4000-8000-000000000031'
               THEN date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' - INTERVAL '9 minutes'
             ELSE date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + INTERVAL '1 minute'
           END,
           updated_at = CASE quote_id
             WHEN '00000000-0000-4000-8000-000000000031'
               THEN date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' - INTERVAL '9 minutes'
             ELSE date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + INTERVAL '1 minute'
           END
     WHERE user_id = 'spend-user';
    UPDATE mcp_generation_quotes
       SET state = 'accepted', updated_at = claimed_at + INTERVAL '1 minute'
     WHERE user_id = 'spend-user';
  `);

  await clientA.query('BEGIN');
  const spending = await checkMcpSpendingLimits(
    { userId: 'spend-user', priceCents: 60, currency: 'USD' },
    { executor: transactionExecutorA },
  );
  assert.equal(spending.acceptedTodayCents, 30);
  assert.equal(spending.allowed, true);

  await clientB.query('BEGIN');
  let spendingWaiterSettled = false;
  const secondSpendingCheck = checkMcpSpendingLimits(
    { userId: 'spend-user', priceCents: 60, currency: 'USD' },
    { executor: transactionExecutorB },
  );
  void secondSpendingCheck.then(
    () => { spendingWaiterSettled = true; },
    () => { spendingWaiterSettled = true; },
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(spendingWaiterSettled, false, 'transaction B must wait for the account spending lock');
  await clientA.query(`
    WITH quote_time AS (
      SELECT clock_timestamp() - INTERVAL '1 second' AS created_at
    )
    INSERT INTO mcp_generation_quotes (
      quote_id, user_id, request_json, request_hash, catalog_revision, pricing_snapshot,
      price_cents, currency, funding_mode, state, expires_at, created_at, updated_at
    ) SELECT
      '00000000-0000-4000-8000-000000000033', 'spend-user', '{"schemaVersion":1}',
      repeat('1',64), 'catalog', '{}', 20, 'USD', 'wallet', 'prepared',
      created_at + INTERVAL '10 minutes', created_at, created_at
    FROM quote_time;
    UPDATE mcp_generation_quotes
       SET state = 'claimed', job_id = 'spend-concurrent',
           claimed_at = clock_timestamp(), updated_at = clock_timestamp()
     WHERE quote_id = '00000000-0000-4000-8000-000000000033';
    UPDATE mcp_generation_quotes
       SET state = 'accepted', updated_at = clock_timestamp()
     WHERE quote_id = '00000000-0000-4000-8000-000000000033';
  `);
  await clientA.query('COMMIT');
  const refreshedSpending = await secondSpendingCheck;
  assert.equal(refreshedSpending.allowed, false);
  if (!refreshedSpending.allowed) {
    assert.equal(refreshedSpending.reason, 'daily');
    assert.equal(refreshedSpending.acceptedTodayCents, 50);
    assert.equal(refreshedSpending.projectedTodayCents, 110);
  }
  await clientB.query('ROLLBACK');

  await clientA.query('BEGIN');
  const nullLimits = await checkMcpSpendingLimits(
    { userId: 'null-limit-user', priceCents: 1, currency: 'USD' },
    { executor: transactionExecutorA },
  );
  assert.equal(nullLimits.allowed, true);
  const insideTransaction = await clientA.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
      FROM mcp_spending_limits
     WHERE user_id = 'null-limit-user'
  `);
  assert.equal(insideTransaction.rows[0]?.count, '1');
  await clientA.query('ROLLBACK');
  const afterLimitRollback = await clientA.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
      FROM mcp_spending_limits
     WHERE user_id = 'null-limit-user'
  `);
  assert.equal(afterLimitRollback.rows[0]?.count, '0');

  const indexes = await clientA.query<{ indexname: string }>(`
    SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'mcp_generation_quotes'
  `);
  const names = new Set(indexes.rows.map((row) => row.indexname));
  for (const expected of [
    'mcp_generation_quotes_user_created_idx',
    'mcp_generation_quotes_oauth_client_created_idx',
    'mcp_generation_quotes_expiration_idx',
    'mcp_generation_quotes_state_idx',
    'mcp_generation_quotes_accepted_spend_idx',
  ]) assert.equal(names.has(expected), true, expected);
});
