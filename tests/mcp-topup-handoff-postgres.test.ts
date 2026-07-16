import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { Pool, type PoolClient } from 'pg';

import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import { hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import {
  insertPreparedQuote,
  invalidatePreparedQuote,
  lockOwnedQuote,
} from '../frontend/src/server/agent-api/quote-repository';
import { createMcpTopupHandoff } from '../frontend/src/server/agent-api/topup-handoff';
import { getWalletSummary } from '../frontend/src/server/wallet-summary';

const migrationPath = join(process.cwd(), 'neon/migrations/30_mcp_paid_generation.sql');
const SECRET = '0123456789abcdef0123456789abcdef';
const principal: AgentPrincipal = {
  userId: 'p9-pg-user',
  clientId: 'p9-pg-client',
  emailVerified: true,
  authMethod: 'oauth',
};
const generationRequest: CanonicalGenerationRequest = {
  schemaVersion: 1,
  surface: 'video',
  engineId: 'seedance-2-0-mini',
  mode: 't2v',
  prompt: 'private PostgreSQL top-up prompt',
  settings: { durationSec: 5 },
  references: [],
  outputCount: 1,
};

function commandExists(command: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
}

function failure(result: ReturnType<typeof spawnSync>): string {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

function asExecutor(client: PoolClient): TransactionQueryExecutor {
  return {
    async query<TRecord>(sql: string, params?: ReadonlyArray<unknown>) {
      return (await client.query<TRecord>(sql, params as unknown[] | undefined)).rows;
    },
  } as TransactionQueryExecutor;
}

function transactionRunner(pool: Pool) {
  return async <TResult>(
    callback: (executor: TransactionQueryExecutor) => Promise<TResult>,
  ): Promise<TResult> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(asExecutor(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  };
}

test('top-up handoff invalidation and ledger non-mutation execute atomically in disposable PostgreSQL', async (t) => {
  for (const command of ['initdb', 'pg_ctl', 'psql']) {
    if (!commandExists(command)) {
      t.skip(`${command} is unavailable`);
      return;
    }
  }
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'mcp-topup-pg-'));
  const dataDirectory = join(temporaryRoot, 'data');
  const socketDirectory = join(temporaryRoot, 'socket');
  mkdirSync(socketDirectory);
  const init = spawnSync('initdb', [
    '-A', 'trust', '-U', 'postgres', '-D', dataDirectory, '--no-locale', '--encoding=UTF8',
  ], { encoding: 'utf8' });
  assert.equal(init.status, 0, failure(init));
  const start = spawnSync('pg_ctl', [
    '-D', dataDirectory, '-o', `-F -k ${socketDirectory} -c listen_addresses=''`, '-w', 'start',
  ], { encoding: 'utf8', stdio: 'ignore' });
  assert.equal(start.status, 0, failure(start));
  const pool = new Pool({ host: socketDirectory, user: 'postgres', database: 'postgres' });
  t.after(async () => {
    await pool.end();
    spawnSync('pg_ctl', ['-D', dataDirectory, '-m', 'immediate', '-w', 'stop'], {
      encoding: 'utf8', stdio: 'ignore',
    });
    rmSync(temporaryRoot, { recursive: true, force: true });
  });
  const psql = (...args: string[]) => spawnSync('psql', [
    '-X', '-h', socketDirectory, '-U', 'postgres', '-d', 'postgres', ...args,
  ], { encoding: 'utf8' });
  const migration = psql('--single-transaction', '-v', 'ON_ERROR_STOP=1', '-f', migrationPath);
  assert.equal(migration.status, 0, failure(migration));
  const schema = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    CREATE TABLE app_receipts (
      id bigserial PRIMARY KEY,
      user_id text NOT NULL,
      type text NOT NULL,
      amount_cents integer NOT NULL,
      currency text
    );
    INSERT INTO app_receipts (user_id, type, amount_cents, currency)
    VALUES ('p9-pg-user', 'topup', 250, 'USD');
  `);
  assert.equal(schema.status, 0, failure(schema));

  const withTransaction = transactionRunner(pool);
  const insertQuote = (quoteId: string, priceCents: number) => withTransaction((executor) =>
    insertPreparedQuote({
      userId: principal.userId,
      oauthClientId: principal.clientId,
      request: generationRequest,
      requestHash: hashCanonicalGenerationRequest(generationRequest),
      catalogRevision: 'p9-pg-catalog',
      pricingSnapshot: { totalCents: priceCents, currency: 'USD' },
      priceCents,
      currency: 'USD',
    }, {
      executor,
      randomUUID: () => quoteId,
      now: () => new Date(),
    }));
  const quoteId = '00000000-0000-4000-8000-000000000091';
  await insertQuote(quoteId, 1750);
  const dependencies = {
    secret: SECRET,
    billingBaseUrl: 'https://maxvideoai.com',
    randomUUID: () => '00000000-0000-4000-8000-000000000092',
    withTransaction,
    lockOwnedQuote,
    getWalletSummary,
    invalidatePreparedQuote,
  };

  const before = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM app_receipts WHERE user_id = $1',
    [principal.userId],
  );
  const outcomes = await Promise.allSettled([
    createMcpTopupHandoff({ quoteId }, principal, dependencies),
    createMcpTopupHandoff({ quoteId }, principal, dependencies),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(
    (outcome) => outcome.status === 'rejected'
      && outcome.reason instanceof AgentApiError
      && outcome.reason.code === 'QUOTE_EXPIRED',
  ).length, 1);
  const fulfilled = outcomes.find((outcome) => outcome.status === 'fulfilled');
  assert.ok(fulfilled && fulfilled.status === 'fulfilled' && 'url' in fulfilled.value);
  if (!fulfilled || fulfilled.status !== 'fulfilled' || !('url' in fulfilled.value)) {
    assert.fail('expected exactly one signed handoff');
  }
  assert.equal(fulfilled.value.amountCents, 1500);
  const persisted = await pool.query<{ state: string }>(
    'SELECT state FROM mcp_generation_quotes WHERE quote_id = $1',
    [quoteId],
  );
  assert.equal(persisted.rows[0]?.state, 'expired');
  const after = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM app_receipts WHERE user_id = $1',
    [principal.userId],
  );
  assert.equal(after.rows[0]?.count, before.rows[0]?.count);

  const fundedQuoteId = '00000000-0000-4000-8000-000000000093';
  await pool.query(
    `INSERT INTO app_receipts (user_id, type, amount_cents, currency) VALUES ($1, 'topup', 2000, 'USD')`,
    [principal.userId],
  );
  await insertQuote(fundedQuoteId, 500);
  const funded = await createMcpTopupHandoff({ quoteId: fundedQuoteId }, principal, {
    ...dependencies,
    randomUUID: () => '00000000-0000-4000-8000-000000000094',
  });
  assert.deepEqual(funded, {
    topupRequired: false,
    nextAction: {
      tool: 'confirm_generation',
      arguments: { quoteId: fundedQuoteId, confirmed: true },
    },
  });
  const fundedState = await pool.query<{ state: string }>(
    'SELECT state FROM mcp_generation_quotes WHERE quote_id = $1',
    [fundedQuoteId],
  );
  assert.equal(fundedState.rows[0]?.state, 'prepared');
});
