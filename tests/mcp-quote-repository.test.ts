import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import type { QueryExecutor, TransactionQueryExecutor } from '../frontend/src/lib/db';
import { hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';

const repositoryPath = 'frontend/src/server/agent-api/quote-repository.ts';
const quoteId = '123e4567-e89b-42d3-a456-426614174000';
const now = new Date('2026-07-16T12:00:00.000Z');
const request: CanonicalGenerationRequest = {
  schemaVersion: 1,
  surface: 'video',
  engineId: 'seedance-2-0-mini',
  mode: 't2v',
  prompt: 'private launch prompt',
  settings: { durationSec: 5 },
  references: [],
  outputCount: 1,
};
const requestHash = hashCanonicalGenerationRequest(request);

type Call = { sql: string; params?: ReadonlyArray<unknown> };

function storedRow(overrides: Record<string, unknown> = {}) {
  return {
    quote_id: quoteId,
    user_id: 'user-1',
    oauth_client_id: 'client-1',
    request_json: request,
    request_hash: requestHash,
    catalog_revision: 'catalog-1',
    pricing_snapshot: { totalCents: 25 },
    price_cents: 25,
    currency: 'USD',
    funding_mode: 'wallet',
    state: 'prepared',
    job_id: null,
    expires_at: new Date('2026-07-16T12:10:00.000Z'),
    claimed_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

test('quote repository is present before behavior contracts load', () => {
  assert.equal(existsSync(repositoryPath), true, `${repositoryPath} should exist`);
});

test('transaction executors are branded by withDbTransaction and ordinary query executors fail type-checking', () => {
  const command = (config: string) => spawnSync(
    './frontend/node_modules/.bin/tsc',
    ['--project', config],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  const valid = command('tests/fixtures/mcp-transaction-executor-valid-tsconfig.json');
  assert.equal(valid.status, 0, `${valid.stdout}\n${valid.stderr}`);
  const invalid = command('tests/fixtures/mcp-transaction-executor-invalid-tsconfig.json');
  assert.notEqual(invalid.status, 0);
  assert.match(`${invalid.stdout}\n${invalid.stderr}`, /transactionQueryExecutorBrand|transaction executor brand/i);

  const dbSource = readFileSync('frontend/src/lib/db.ts', 'utf8');
  const repositorySource = readFileSync(repositoryPath, 'utf8');
  assert.match(dbSource, /unique symbol[\s\S]*TransactionQueryExecutor/);
  assert.match(dbSource, /callback: \(executor: TransactionQueryExecutor/);
  assert.match(repositorySource, /QuoteLockDependencies\s*=\s*\{[\s\S]*TransactionQueryExecutor/);
  assert.match(repositorySource, /lockOwnedPreparedQuote\([\s\S]{0,250}QuoteLockDependencies/);
  assert.doesNotMatch(
    repositorySource,
    /lockOwnedPreparedQuote\([\s\S]{0,300}= defaultDependencies/,
  );
});

test('insertPreparedQuote creates a random UUID and exact server-owned ten-minute expiry', async () => {
  const { insertPreparedQuote, MCP_QUOTE_LIFETIME_SECONDS } = await import(
    '../frontend/src/server/agent-api/quote-repository'
  );
  const calls: Call[] = [];
  const executor: QueryExecutor = {
    async query<TRecord>(sql, params) {
      calls.push({ sql, params });
      return [storedRow()] as TRecord[];
    },
  };
  const input = {
    userId: 'user-1',
    oauthClientId: 'client-1',
    request,
    requestHash,
    catalogRevision: 'catalog-1',
    pricingSnapshot: { totalCents: 25 },
    priceCents: 25,
    currency: 'USD',
    fundingMode: 'wallet' as const,
  };
  const created = await insertPreparedQuote(input, {
    executor,
    now: () => now,
    randomUUID: () => quoteId,
  });

  assert.equal(MCP_QUOTE_LIFETIME_SECONDS, 600);
  assert.equal(created.quoteId, quoteId);
  assert.equal(created.expiresAt.toISOString(), '2026-07-16T12:10:00.000Z');
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO mcp_generation_quotes/i);
  assert.match(calls[0].sql, /VALUES\s*\(\$1,\s*\$2,\s*\$3/i);
  assert.doesNotMatch(calls[0].sql, /private launch prompt|seedance-2-0-mini/);
  assert.ok(calls[0].params?.includes(quoteId));
  assert.ok(calls[0].params?.some((value) => value instanceof Date && value.toISOString() === '2026-07-16T12:10:00.000Z'));
  assert.ok(calls[0].params?.includes('wallet'));
  assert.ok(calls[0].params?.includes('prepared'));

  await assert.rejects(
    insertPreparedQuote({ ...input, expiresAt: new Date('2030-01-01') } as never, {
      executor,
      now: () => now,
      randomUUID: () => quoteId,
    }),
    /invalid prepared quote input/i,
  );
});

test('owned reads bind quote, user, and nullable OAuth ownership with no prompt in SQL', async () => {
  const { getOwnedQuote, lockOwnedPreparedQuote } = await import(
    '../frontend/src/server/agent-api/quote-repository'
  );
  const calls: Call[] = [];
  const executor: QueryExecutor = {
    async query<TRecord>(sql, params) {
      calls.push({ sql, params });
      if (/clock_timestamp\(\)/i.test(sql)) {
        return [{ current_time: new Date('2026-07-16T12:01:00.000Z') }] as TRecord[];
      }
      return [storedRow()] as TRecord[];
    },
  };

  const owner = { quoteId, userId: 'user-1', oauthClientId: 'client-1' };
  assert.equal((await getOwnedQuote(owner, { executor }))?.quoteId, quoteId);
  assert.equal((await lockOwnedPreparedQuote(owner, {
    executor: executor as TransactionQueryExecutor,
  }))?.state, 'prepared');
  assert.equal(calls.length, 3);
  for (const call of calls.slice(0, 2)) {
    assert.match(call.sql, /user_id\s*=\s*\$2/i);
    assert.match(call.sql, /oauth_client_id\s+IS NOT DISTINCT FROM\s+\$3/i);
    assert.deepEqual(call.params?.slice(0, 3), [quoteId, 'user-1', 'client-1']);
    assert.doesNotMatch(call.sql, /private launch prompt/);
  }
  assert.doesNotMatch(calls[0].sql, /FOR UPDATE/i);
  assert.match(calls[1].sql, /state\s*=\s*'prepared'/i);
  assert.doesNotMatch(calls[1].sql, /expires_at\s*>|clock_timestamp|NOW\(\)/i);
  assert.match(calls[1].sql, /FOR UPDATE/i);
  assert.deepEqual(calls[1].params, [quoteId, 'user-1', 'client-1']);
  assert.match(calls[2].sql, /SELECT clock_timestamp\(\) AS current_time/i);
  assert.equal(calls[2].params, undefined);
});

test('lockOwnedPreparedQuote evaluates expiry only after the row lock returns', async () => {
  const { lockOwnedPreparedQuote } = await import(
    '../frontend/src/server/agent-api/quote-repository'
  );
  const order: string[] = [];
  const executor: QueryExecutor = {
    async query<TRecord>(sql) {
      if (/FOR UPDATE/i.test(sql)) {
        order.push('lock-returned');
        return [storedRow()] as TRecord[];
      }
      if (/clock_timestamp\(\)/i.test(sql)) {
        order.push('fresh-clock');
        return [{ current_time: new Date('2026-07-16T12:10:00.000Z') }] as TRecord[];
      }
      throw new Error('unexpected query');
    },
  };
  const result = await lockOwnedPreparedQuote(
    { quoteId, userId: 'user-1', oauthClientId: 'client-1' },
    { executor: executor as TransactionQueryExecutor },
  );
  assert.equal(result, null);
  assert.deepEqual(order, ['lock-returned', 'fresh-clock']);
});

test('terminal mutations are owner/job/state constrained and parameterized', async () => {
  const { markQuoteAccepted, markQuoteFailed, expirePreparedQuotes } = await import(
    '../frontend/src/server/agent-api/quote-repository'
  );
  const calls: Call[] = [];
  const executor: QueryExecutor = {
    async query<TRecord>(sql, params) {
      calls.push({ sql, params });
      if (/COUNT\(\*\)/i.test(sql)) return [{ count: '2' }] as TRecord[];
      return [storedRow({
        state: /state = 'failed'/i.test(sql) ? 'failed' : 'accepted',
        job_id: 'job-1',
        claimed_at: now,
      })] as TRecord[];
    },
  };
  const mutation = { quoteId, userId: 'user-1', oauthClientId: 'client-1', jobId: 'job-1' };

  assert.equal((await markQuoteAccepted(mutation, { executor, now: () => now }))?.state, 'accepted');
  assert.equal((await markQuoteFailed(mutation, { executor, now: () => now }))?.state, 'failed');
  assert.equal(await expirePreparedQuotes({ limit: 50 }, { executor, now: () => now }), 2);

  assert.match(calls[0].sql, /SET state = 'accepted'/i);
  assert.match(calls[0].sql, /state = 'claimed'/i);
  assert.match(calls[0].sql, /job_id = \$4/i);
  assert.match(calls[1].sql, /SET state = 'failed'/i);
  assert.match(calls[1].sql, /state IN \('claimed', 'accepted'\)/i);
  assert.match(calls[1].sql, /job_id = \$4/i);
  assert.match(calls[2].sql, /FOR UPDATE SKIP LOCKED/i);
  assert.match(calls[2].sql, /state = 'prepared'/i);
  assert.match(calls[2].sql, /expires_at <= \$1/i);
  assert.deepEqual(calls[2].params, [now, 50]);
  for (const call of calls) assert.doesNotMatch(call.sql, /job-1|user-1|client-1/);
});

test('quote repository fails closed on missing schema and malformed database rows', async () => {
  const { getOwnedQuote, insertPreparedQuote } = await import(
    '../frontend/src/server/agent-api/quote-repository'
  );
  const missing: QueryExecutor = { async query() { throw new Error('relation does not exist'); } };
  await assert.rejects(
    getOwnedQuote({ quoteId, userId: 'user-1', oauthClientId: null }, { executor: missing }),
    /relation does not exist/,
  );
  const malformed: QueryExecutor = {
    async query<TRecord>() { return [storedRow({ price_cents: -1 })] as TRecord[]; },
  };
  await assert.rejects(
    insertPreparedQuote({
      userId: 'user-1', oauthClientId: null, request, requestHash,
      catalogRevision: 'catalog-1', pricingSnapshot: {}, priceCents: 25, currency: 'USD',
      fundingMode: 'wallet',
    }, { executor: malformed, now: () => now, randomUUID: () => quoteId }),
    /invalid quote row/i,
  );
});
