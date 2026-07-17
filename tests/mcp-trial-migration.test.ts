import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from 'pg';

const paidMigrationPath = 'neon/migrations/30_mcp_paid_generation.sql';
const trialMigrationPath = 'neon/migrations/31_mcp_trial_entitlements.sql';
const runtimeSchemaPath = 'frontend/src/lib/schema/mcp-schema.ts';

function commandExists(command: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
}

function output(result: ReturnType<typeof spawnSync>): string {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

test('migration 31 owns durable trial tables while runtime bootstrap remains audit-only', () => {
  assert.equal(existsSync(trialMigrationPath), true);
  const source = readFileSync(trialMigrationPath, 'utf8');
  const runtime = readFileSync(runtimeSchemaPath, 'utf8');

  assert.match(source, /requires migration 30[\s\S]*mcp_generation_quotes/i);
  assert.match(source, /CREATE TABLE IF NOT EXISTS mcp_trial_entitlements/i);
  assert.match(source, /CREATE TABLE IF NOT EXISTS mcp_trial_risk_events/i);
  assert.match(source, /id\s+BIGINT\s+GENERATED ALWAYS AS IDENTITY\s+PRIMARY KEY/i);
  assert.match(source, /BEFORE INSERT ON mcp_trial_risk_events[\s\S]*enforce_mcp_trial_risk_event_insert/i);
  assert.match(source, /NEW\.created_at\s*:=\s*clock_timestamp\(\)/i);
  assert.match(source, /enforce_mcp_trial_risk_event_insert[\s\S]*SECURITY DEFINER/i);
  assert.match(
    source,
    /BEGIN\s+IF TG_RELID IS DISTINCT FROM 'public\.mcp_trial_risk_events'::pg_catalog\.regclass THEN/i,
  );
  assert.match(source, /NEW\.id\s*:=\s*pg_catalog\.nextval[\s\S]*pg_get_serial_sequence/i);
  assert.match(
    source,
    /REVOKE ALL(?: PRIVILEGES)? ON FUNCTION enforce_mcp_trial_risk_event_insert\(\)\s+FROM PUBLIC/i,
  );
  assert.ok(
    source.indexOf('REVOKE ALL PRIVILEGES ON FUNCTION enforce_mcp_trial_risk_event_insert()')
      < source.indexOf('CREATE TRIGGER mcp_trial_risk_events_enforce_insert'),
    'PUBLIC execute must be revoked before the migration owner attaches the protected trigger',
  );
  assert.match(source, /cleanup_mcp_trial_risk_events[\s\S]*ORDER BY created_at, id[\s\S]*LIMIT p_limit/i);
  assert.match(source, /SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, public/i);
  assert.match(source, /REVOKE ALL(?: PRIVILEGES)? ON FUNCTION cleanup_mcp_trial_risk_events[\s\S]*FROM PUBLIC/i);
  assert.match(source, /pg_catalog\.pg_proc/i);
  assert.match(source, /\.proowner/i);
  assert.match(source, /::pg_catalog\.regprocedure/i);
  assert.doesNotMatch(source, /current_setting|set_config/i);
  assert.match(source, /runtime role must not own the table or (?:cleanup )?function/i);
  assert.match(runtime, /paid\/trial\/reference durable tables are migration-owned/i);
  assert.doesNotMatch(runtime, /mcp_trial_entitlements|mcp_trial_risk_events/i);

  const riskTable = source.match(/CREATE TABLE IF NOT EXISTS mcp_trial_risk_events\s*\(([\s\S]*?)\n\);/i)?.[1] ?? '';
  assert.doesNotMatch(
    riskTable,
    /\bip\b|ip_address|user_agent|\bemail\b|\bprompt\b|access_token|reference_url|source_url|raw_fingerprint|jsonb|\bmetadata\b/i,
  );
});

test('migration 31 constraints, transitions, immutability, indexes and races execute in disposable PostgreSQL', async (t) => {
  for (const command of ['initdb', 'pg_ctl', 'psql']) {
    if (!commandExists(command)) {
      t.skip(`${command} is unavailable`);
      return;
    }
  }

  const root = process.cwd();
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'mcp-trial-postgres-'));
  const dataDirectory = join(temporaryRoot, 'data');
  const socketDirectory = join(temporaryRoot, 'socket');
  mkdirSync(socketDirectory);

  const init = spawnSync('initdb', [
    '-A', 'trust', '-U', 'postgres', '-D', dataDirectory, '--no-locale', '--encoding=UTF8',
  ], { encoding: 'utf8' });
  assert.equal(init.status, 0, output(init));
  const start = spawnSync('pg_ctl', [
    '-D', dataDirectory, '-o', `-F -k ${socketDirectory} -c listen_addresses=''`, '-w', 'start',
  ], { encoding: 'utf8', stdio: 'ignore' });
  assert.equal(start.status, 0, output(start));

  t.after(() => {
    spawnSync('pg_ctl', ['-D', dataDirectory, '-m', 'immediate', '-w', 'stop'], {
      encoding: 'utf8', stdio: 'ignore',
    });
    rmSync(temporaryRoot, { recursive: true, force: true });
  });

  const psql = (...args: string[]) => spawnSync('psql', [
    '-X', '-h', socketDirectory, '-U', 'postgres', '-d', 'postgres', ...args,
  ], { encoding: 'utf8' });
  const applyTrialAlone = psql(
    '--single-transaction', '-v', 'ON_ERROR_STOP=1', '-f', join(root, trialMigrationPath),
  );
  assert.notEqual(applyTrialAlone.status, 0);
  assert.match(output(applyTrialAlone), /requires migration 30/i);

  for (const path of [paidMigrationPath, trialMigrationPath, trialMigrationPath]) {
    const applied = psql('--single-transaction', '-v', 'ON_ERROR_STOP=1', '-f', join(root, path));
    assert.equal(applied.status, 0, output(applied));
  }

  const quote = (id: string, user: string) => `
    INSERT INTO mcp_generation_quotes (
      quote_id, user_id, request_json, request_hash, catalog_revision, pricing_snapshot,
      price_cents, currency, funding_mode, state, expires_at, created_at, updated_at
    ) VALUES (
      '${id}', '${user}', '{"schemaVersion":1}', repeat('a', 64), 'catalog', '{}',
      1, 'USD', 'wallet', 'prepared',
      '2026-07-17T10:10:00Z', '2026-07-17T10:00:00Z', '2026-07-17T10:00:00Z'
    )`;
  const seeded = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    ${quote('00000000-0000-4000-8000-000000000101', 'trial-a')};
    ${quote('00000000-0000-4000-8000-000000000102', 'trial-a')};
    INSERT INTO mcp_trial_entitlements (user_id) VALUES ('trial-a');
  `);
  assert.equal(seeded.status, 0, output(seeded));

  const invalid = [
    `INSERT INTO mcp_trial_entitlements (user_id, status) VALUES ('bad-state', 'reserved')`,
    `UPDATE mcp_trial_entitlements SET user_id = 'changed' WHERE user_id = 'trial-a'`,
    `UPDATE mcp_trial_entitlements SET status = 'consumed' WHERE user_id = 'trial-a'`,
    `UPDATE mcp_trial_entitlements SET reserved_quote_id = '00000000-0000-4000-8000-000000000999' WHERE user_id = 'trial-a'`,
    `INSERT INTO mcp_trial_risk_events (user_id, oauth_client_id, risk_fingerprint_hash, outcome, reason_code)
      VALUES ('trial-a', 'client', repeat('A', 64), 'allowed', 'eligible')`,
  ];
  for (const sql of invalid) {
    const result = psql('-v', 'ON_ERROR_STOP=1', '-c', sql);
    assert.notEqual(result.status, 0, `${sql}\n${output(result)}`);
  }

  const lifecycle = psql('-At', '-v', 'ON_ERROR_STOP=1', '-c', `
    UPDATE mcp_trial_entitlements
       SET status = 'reserved',
           reserved_quote_id = '00000000-0000-4000-8000-000000000101',
           job_id = 'job-a', reserved_at = clock_timestamp(),
           updated_at = clock_timestamp(), last_reason_code = 'trial_reserved'
     WHERE user_id = 'trial-a';
    UPDATE mcp_trial_entitlements
       SET status = 'released', released_at = clock_timestamp(),
           updated_at = clock_timestamp(), last_reason_code = 'provider_rejected'
     WHERE user_id = 'trial-a';
    UPDATE mcp_trial_entitlements
       SET status = 'reserved',
           reserved_quote_id = '00000000-0000-4000-8000-000000000102',
           job_id = 'job-b', reserved_at = clock_timestamp(),
           consumed_at = NULL, released_at = NULL,
           updated_at = clock_timestamp(), last_reason_code = 'trial_retried'
     WHERE user_id = 'trial-a';
    UPDATE mcp_trial_entitlements
       SET status = 'consumed', consumed_at = clock_timestamp(),
           updated_at = clock_timestamp(), last_reason_code = 'output_completed'
     WHERE user_id = 'trial-a';
    SELECT status || ':' || job_id FROM mcp_trial_entitlements WHERE user_id = 'trial-a';
  `);
  assert.equal(lifecycle.status, 0, output(lifecycle));
  assert.equal(lifecycle.stdout.trim(), 'consumed:job-b');
  for (const sql of [
    `UPDATE mcp_trial_entitlements SET status = 'released', released_at = clock_timestamp(), consumed_at = NULL WHERE user_id = 'trial-a'`,
    `UPDATE mcp_trial_entitlements SET job_id = 'rewritten' WHERE user_id = 'trial-a'`,
    `UPDATE mcp_trial_entitlements SET created_at = created_at + interval '1 second' WHERE user_id = 'trial-a'`,
  ]) {
    const result = psql('-v', 'ON_ERROR_STOP=1', '-c', sql);
    assert.notEqual(result.status, 0, sql);
  }

  const risk = psql('-At', '-v', 'ON_ERROR_STOP=1', '-c', `
    INSERT INTO mcp_trial_risk_events (
      user_id, oauth_client_id, risk_fingerprint_hash, outcome, reason_code
    ) VALUES ('trial-a', 'client-a', repeat('b',64), 'allowed', 'eligible');
    SELECT outcome FROM mcp_trial_risk_events;
  `);
  assert.equal(risk.status, 0, output(risk));
  assert.equal(risk.stdout.trim(), 'allowed');

  const explicitRiskId = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    INSERT INTO mcp_trial_risk_events (
      id, user_id, oauth_client_id, risk_fingerprint_hash, outcome, reason_code
    ) VALUES (999, 'trial-a', NULL, repeat('d',64), 'error', 'explicit_id');
  `);
  assert.notEqual(explicitRiskId.status, 0, 'risk event identity must be database-owned');
  const forcedRiskTime = psql('-At', '-v', 'ON_ERROR_STOP=1', '-c', `
    INSERT INTO mcp_trial_risk_events (
      user_id, oauth_client_id, risk_fingerprint_hash, outcome, reason_code, created_at
    ) VALUES (
      'trial-a', NULL, repeat('e',64), 'error', 'backdated_input', '2000-01-01T00:00:00Z'
    )
    RETURNING created_at > clock_timestamp() - INTERVAL '5 seconds';
  `);
  assert.equal(forcedRiskTime.status, 0, output(forcedRiskTime));
  assert.equal(forcedRiskTime.stdout.trim().split('\n')[0], 't');
  assert.notEqual(
    psql('-v', 'ON_ERROR_STOP=1', '-c', `UPDATE mcp_trial_risk_events SET outcome = 'blocked'`).status,
    0,
  );

  const attackerSetup = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    CREATE ROLE mcp_trial_trigger_attacker NOLOGIN;
    CREATE SCHEMA mcp_trial_trigger_attacker AUTHORIZATION mcp_trial_trigger_attacker;
    GRANT USAGE ON SCHEMA public TO mcp_trial_trigger_attacker;
    SET ROLE mcp_trial_trigger_attacker;
    CREATE TABLE mcp_trial_trigger_attacker.risk_sequence_probe (
      id BIGINT,
      created_at TIMESTAMPTZ
    );
  `);
  assert.equal(attackerSetup.status, 0, output(attackerSetup));
  const protectedSequenceBefore = psql('-At', '-v', 'ON_ERROR_STOP=1', '-c', `
    SELECT last_value::text || ':' || is_called::text
      FROM mcp_trial_risk_events_id_seq
  `);
  assert.equal(protectedSequenceBefore.status, 0, output(protectedSequenceBefore));

  const attackerTrigger = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    SET ROLE mcp_trial_trigger_attacker;
    CREATE TRIGGER steal_protected_sequence
      BEFORE INSERT ON mcp_trial_trigger_attacker.risk_sequence_probe
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_mcp_trial_risk_event_insert();
  `);
  const attackerUse = attackerTrigger.status === 0
    ? psql('-v', 'ON_ERROR_STOP=1', '-c', `
      SET ROLE mcp_trial_trigger_attacker;
      INSERT INTO mcp_trial_trigger_attacker.risk_sequence_probe
        (id, created_at) VALUES (9001, '2000-01-01T00:00:00Z');
    `)
    : null;
  const resetAttackerTrigger = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    DROP TRIGGER IF EXISTS steal_protected_sequence
      ON mcp_trial_trigger_attacker.risk_sequence_probe;
    CREATE TRIGGER guard_protected_sequence
      BEFORE INSERT ON mcp_trial_trigger_attacker.risk_sequence_probe
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_mcp_trial_risk_event_insert();
  `);
  assert.equal(resetAttackerTrigger.status, 0, output(resetAttackerTrigger));
  const guardedAttackerUse = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    SET ROLE mcp_trial_trigger_attacker;
    INSERT INTO mcp_trial_trigger_attacker.risk_sequence_probe
      (id, created_at) VALUES (9002, '2000-01-01T00:00:00Z');
  `);
  const protectedSequenceAfter = psql('-At', '-v', 'ON_ERROR_STOP=1', '-c', `
    SELECT last_value::text || ':' || is_called::text
      FROM mcp_trial_risk_events_id_seq
  `);
  assert.equal(protectedSequenceAfter.status, 0, output(protectedSequenceAfter));
  assert.equal(
    protectedSequenceAfter.stdout.trim(),
    protectedSequenceBefore.stdout.trim(),
    'an attacker-controlled trigger table must not advance the protected identity sequence',
  );
  assert.notEqual(attackerTrigger.status, 0, 'PUBLIC must not attach the protected trigger function');
  assert.equal(attackerUse, null, 'the rejected attacker trigger must never become usable');
  assert.notEqual(guardedAttackerUse.status, 0, 'the trigger function must reject every non-protected table');
  const attackerExecute = psql('-At', '-v', 'ON_ERROR_STOP=1', '-c', `
    SELECT has_function_privilege(
      'mcp_trial_trigger_attacker',
      'public.enforce_mcp_trial_risk_event_insert()',
      'EXECUTE'
    )
  `);
  assert.equal(attackerExecute.status, 0, output(attackerExecute));
  assert.equal(attackerExecute.stdout.trim(), 'f');

  const runtimeRole = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    CREATE ROLE mcp_trial_runtime NOLOGIN;
    GRANT USAGE ON SCHEMA public TO mcp_trial_runtime;
    GRANT SELECT, INSERT, DELETE ON mcp_trial_risk_events TO mcp_trial_runtime;
    GRANT USAGE ON SEQUENCE mcp_trial_risk_events_id_seq TO mcp_trial_runtime;
  `);
  assert.equal(runtimeRole.status, 0, output(runtimeRole));

  const overridingIdentity = psql('-At', '-v', 'ON_ERROR_STOP=1', '-c', `
    SET ROLE mcp_trial_runtime;
    INSERT INTO mcp_trial_risk_events (
      id, user_id, oauth_client_id, risk_fingerprint_hash, outcome, reason_code
    ) OVERRIDING SYSTEM VALUE
    VALUES (9001, 'override-attacker', NULL, repeat('f',64), 'blocked', 'identity_override')
    RETURNING id::text;
  `);
  assert.equal(overridingIdentity.status, 0, output(overridingIdentity));
  const overridingIds = overridingIdentity.stdout.trim().split('\n').filter((line) => /^\d+$/u.test(line));
  assert.equal(overridingIds.length, 1, output(overridingIdentity));
  assert.notEqual(overridingIds[0], '9001', 'OVERRIDING SYSTEM VALUE must not retain the supplied ID');

  const normalAfterOverride = psql('-At', '-v', 'ON_ERROR_STOP=1', '-c', `
    SET ROLE mcp_trial_runtime;
    INSERT INTO mcp_trial_risk_events (
      user_id, oauth_client_id, risk_fingerprint_hash, outcome, reason_code
    ) VALUES ('normal-after-override', NULL, repeat('1',64), 'allowed', 'normal_insert')
    RETURNING id::text;
  `);
  assert.equal(normalAfterOverride.status, 0, output(normalAfterOverride));
  const normalIds = normalAfterOverride.stdout.trim().split('\n').filter((line) => /^\d+$/u.test(line));
  assert.equal(normalIds.length, 1, output(normalAfterOverride));
  assert.notEqual(normalIds[0], '9001');
  const retainedOverride = psql('-At', '-v', 'ON_ERROR_STOP=1', '-c', `
    SELECT count(*)::text FROM mcp_trial_risk_events WHERE id = 9001
  `);
  assert.equal(retainedOverride.status, 0, output(retainedOverride));
  assert.equal(retainedOverride.stdout.trim(), '0');

  const runtimeTriggerExecute = psql('-At', '-v', 'ON_ERROR_STOP=1', '-c', `
    SELECT has_function_privilege(
      'mcp_trial_runtime',
      'public.enforce_mcp_trial_risk_event_insert()',
      'EXECUTE'
    )
  `);
  assert.equal(runtimeTriggerExecute.status, 0, output(runtimeTriggerExecute));
  assert.equal(runtimeTriggerExecute.stdout.trim(), 'f');

  const publicExecute = psql('-At', '-v', 'ON_ERROR_STOP=1', '-c', `
    SELECT has_function_privilege(
      'mcp_trial_runtime',
      'public.cleanup_mcp_trial_risk_events(timestamp with time zone,integer)',
      'EXECUTE'
    )
  `);
  assert.equal(publicExecute.status, 0, output(publicExecute));
  assert.equal(publicExecute.stdout.trim(), 'f');

  const forgedCleanup = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    BEGIN;
    SET ROLE mcp_trial_runtime;
    SELECT set_config('maxvideoai.mcp_trial_risk_cleanup', 'active', TRUE);
    DELETE FROM mcp_trial_risk_events;
    ROLLBACK;
  `);
  assert.notEqual(forgedCleanup.status, 0, 'a runtime role must not forge cleanup authority');
  const unauthorizedCleanup = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    SET ROLE mcp_trial_runtime;
    SELECT cleanup_mcp_trial_risk_events(clock_timestamp(), 10);
  `);
  assert.notEqual(unauthorizedCleanup.status, 0, 'PUBLIC must not execute risk cleanup');

  const indexes = psql('-At', '-F', ',', '-c', `
    SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename IN ('mcp_trial_entitlements','mcp_trial_risk_events')
     ORDER BY indexname
  `);
  assert.equal(indexes.status, 0, output(indexes));
  for (const expected of [
    'mcp_trial_entitlements_status_updated_idx',
    'mcp_trial_entitlements_reserved_at_idx',
    'mcp_trial_entitlements_consumed_at_idx',
    'mcp_trial_entitlements_released_at_idx',
    'mcp_trial_risk_events_user_window_idx',
    'mcp_trial_risk_events_client_window_idx',
    'mcp_trial_risk_events_fingerprint_window_idx',
    'mcp_trial_risk_events_cleanup_idx',
  ]) assert.match(indexes.stdout, new RegExp(`^${expected}$`, 'm'));

  const clientA = new Client({ host: socketDirectory, user: 'postgres', database: 'postgres' });
  const clientB = new Client({ host: socketDirectory, user: 'postgres', database: 'postgres' });
  await Promise.all([clientA.connect(), clientB.connect()]);
  t.after(async () => Promise.allSettled([clientA.end(), clientB.end()]));

  await Promise.all([
    clientA.query(`INSERT INTO mcp_trial_entitlements (user_id) VALUES ('race-user') ON CONFLICT (user_id) DO NOTHING`),
    clientB.query(`INSERT INTO mcp_trial_entitlements (user_id) VALUES ('race-user') ON CONFLICT (user_id) DO NOTHING`),
  ]);
  const one = await clientA.query(`SELECT count(*)::text AS count FROM mcp_trial_entitlements WHERE user_id = 'race-user'`);
  assert.equal(one.rows[0]?.count, '1');

  const { createQueryExecutor } = await import('../frontend/src/lib/db');
  const {
    ensureEntitlement, lockReservableEntitlement, reserveEntitlement,
    consumeEntitlement, releaseEntitlement,
  } = await import('../frontend/src/server/agent-api/trial-entitlement-repository');
  const {
    recordTrialRiskEvent, countTrialRiskEvents, cleanupTrialRiskEvents,
  } = await import('../frontend/src/server/agent-api/trial-risk-repository');
  const executorA = createQueryExecutor(clientA);
  const executorB = createQueryExecutor(clientB);

  const ensured = await Promise.all([
    ensureEntitlement({ userId: 'repository-race-user' }, { executor: executorA }),
    ensureEntitlement({ userId: 'repository-race-user' }, { executor: executorB }),
  ]);
  assert.deepEqual(ensured.map((entry) => entry.status), ['available', 'available']);
  const repositoryCount = await clientA.query(
    `SELECT count(*)::text AS count FROM mcp_trial_entitlements WHERE user_id = 'repository-race-user'`,
  );
  assert.equal(repositoryCount.rows[0]?.count, '1');

  const staleQuote = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    ${quote('00000000-0000-4000-8000-000000000107', 'repository-stale-user')};
  `);
  assert.equal(staleQuote.status, 0, output(staleQuote));
  await ensureEntitlement({ userId: 'repository-stale-user' }, { executor: executorA });
  const staleExecutor = executorA as import('../frontend/src/lib/db').TransactionQueryExecutor;
  await clientA.query('BEGIN');
  const staleHandle = await lockReservableEntitlement(
    { userId: 'repository-stale-user' }, { executor: staleExecutor },
  );
  assert.ok(staleHandle);
  await clientA.query('COMMIT');
  await clientA.query('BEGIN');
  try {
    await assert.rejects(reserveEntitlement({
      lockedEntitlement: staleHandle,
      quoteId: '00000000-0000-4000-8000-000000000107',
      jobId: 'repository-stale-job', reasonCode: 'trial_reserved',
    }, { executor: staleExecutor }), /transaction.*changed|stale.*transaction/i);
  } finally {
    await clientA.query('ROLLBACK');
  }
  const staleState = await clientA.query(
    `SELECT status FROM mcp_trial_entitlements WHERE user_id = 'repository-stale-user'`,
  );
  assert.equal(staleState.rows[0]?.status, 'available');

  const raceQuotes = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    ${quote('00000000-0000-4000-8000-000000000103', 'repository-race-user')};
    ${quote('00000000-0000-4000-8000-000000000104', 'repository-race-user')};
  `);
  assert.equal(raceQuotes.status, 0, output(raceQuotes));
  const compete = async (client: Client, id: string, jobId: string) => {
    const executor = createQueryExecutor(client) as import('../frontend/src/lib/db').TransactionQueryExecutor;
    await client.query('BEGIN');
    try {
      const locked = await lockReservableEntitlement(
        { userId: 'repository-race-user' }, { executor },
      );
      const result = locked
        ? await reserveEntitlement({
          lockedEntitlement: locked, quoteId: id, jobId, reasonCode: 'trial_reserved',
        }, { executor })
        : null;
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  };
  const reservations = await Promise.all([
    compete(clientA, '00000000-0000-4000-8000-000000000103', 'repository-job-a'),
    compete(clientB, '00000000-0000-4000-8000-000000000104', 'repository-job-b'),
  ]);
  assert.equal(reservations.filter(Boolean).length, 1);
  const reservedRows = await clientA.query(`
    SELECT count(*)::text AS count
      FROM mcp_trial_entitlements
     WHERE user_id = 'repository-race-user' AND status = 'reserved'
  `);
  assert.equal(reservedRows.rows[0]?.count, '1');

  const winner = reservations.find((entry) => entry !== null);
  assert.ok(winner?.reservedQuoteId && winner.jobId);
  const terminalExecutor = executorA as import('../frontend/src/lib/db').TransactionQueryExecutor;
  await clientA.query('BEGIN');
  try {
    const terminalInput = {
      userId: winner.userId,
      quoteId: winner.reservedQuoteId,
      jobId: winner.jobId,
      reasonCode: 'output_completed',
    };
    const consumed = await consumeEntitlement(terminalInput, { executor: terminalExecutor });
    const repeated = await consumeEntitlement(terminalInput, { executor: terminalExecutor });
    const lateRelease = await releaseEntitlement({
      ...terminalInput, reasonCode: 'provider_failed',
    }, { executor: terminalExecutor });
    assert.equal(consumed?.status, 'consumed');
    assert.equal(repeated?.consumedAt?.toISOString(), consumed?.consumedAt?.toISOString());
    assert.equal(lateRelease, null);
    await clientA.query('COMMIT');
  } catch (error) {
    await clientA.query('ROLLBACK');
    throw error;
  }

  const retryQuotes = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    ${quote('00000000-0000-4000-8000-000000000105', 'repository-retry-user')};
    ${quote('00000000-0000-4000-8000-000000000106', 'repository-retry-user')};
  `);
  assert.equal(retryQuotes.status, 0, output(retryQuotes));
  await ensureEntitlement({ userId: 'repository-retry-user' }, { executor: executorA });
  await clientA.query('BEGIN');
  try {
    const locked = await lockReservableEntitlement(
      { userId: 'repository-retry-user' }, { executor: terminalExecutor },
    );
    assert.ok(locked);
    const reserved = await reserveEntitlement({
      lockedEntitlement: locked,
      quoteId: '00000000-0000-4000-8000-000000000105',
      jobId: 'repository-retry-job-a', reasonCode: 'trial_reserved',
    }, { executor: terminalExecutor });
    assert.equal(reserved?.status, 'reserved');
    const released = await releaseEntitlement({
      userId: 'repository-retry-user',
      quoteId: '00000000-0000-4000-8000-000000000105',
      jobId: 'repository-retry-job-a', reasonCode: 'provider_failed',
    }, { executor: terminalExecutor });
    assert.equal(released?.status, 'released');
    await clientA.query('COMMIT');
  } catch (error) {
    await clientA.query('ROLLBACK');
    throw error;
  }
  await clientA.query('BEGIN');
  try {
    const locked = await lockReservableEntitlement(
      { userId: 'repository-retry-user' }, { executor: terminalExecutor },
    );
    assert.ok(locked);
    const retried = await reserveEntitlement({
      lockedEntitlement: locked,
      quoteId: '00000000-0000-4000-8000-000000000106',
      jobId: 'repository-retry-job-b', reasonCode: 'trial_retried',
    }, { executor: terminalExecutor });
    assert.equal(retried?.jobId, 'repository-retry-job-b');
    await clientA.query('COMMIT');
  } catch (error) {
    await clientA.query('ROLLBACK');
    throw error;
  }

  const persistedRisk = await recordTrialRiskEvent({
    userId: 'repository-race-user', oauthClientId: 'repository-client',
    riskFingerprintHash: 'c'.repeat(64), outcome: 'blocked', reasonCode: 'velocity_limit',
  }, { executor: executorA });
  assert.match(persistedRisk.id, /^\d+$/u);
  assert.equal(await countTrialRiskEvents({
    scope: 'user', scopeValue: 'repository-race-user',
    since: new Date('2020-01-01T00:00:00Z'), outcomes: ['blocked'],
  }, { executor: executorA }), 1);
  assert.equal(await cleanupTrialRiskEvents({
    cutoff: new Date('2030-01-01T00:00:00Z'), limit: 100,
  }, { executor: executorA }), 5);
});
