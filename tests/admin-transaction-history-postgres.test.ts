import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('history filters before pagination, retains precision and resolves receipts outside the window', async () => {
  const db = await startDisposablePostgres('history');
  process.env.DATABASE_URL = db.databaseUrl;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { getDb } = await import('../frontend/src/lib/db');
  try {
    await db.pool
      .query(`CREATE TABLE app_receipts(id bigint PRIMARY KEY,user_id uuid,type text,amount_cents int,currency text,description text,job_id text,created_at timestamptz,metadata jsonb DEFAULT '{}');
   CREATE TABLE app_jobs(job_id text PRIMARY KEY,status text,payment_status text,engine_label text,video_url text,thumb_url text,message text,progress int,created_at timestamptz,duration_sec int);
   INSERT INTO app_receipts(id,type,amount_cents,currency,description,created_at) SELECT n,'topup',100,'USD','recent', '2026-09-22T10:00:00.123456Z'::timestamptz FROM generate_series(1,120)n;
   INSERT INTO app_receipts VALUES (9007199254740993,'11111111-1111-4111-8111-111111111111','charge',500,'USD','Archive 100%_literal','missing','2025-01-01T00:00:00Z','{}');`);
    const { fetchTransactionHistory, fetchTransactionReceipt } = await import(
      '../frontend/server/admin-transactions/history'
    );
    const { parseTransactionHistoryParams } = await import('../frontend/lib/admin/transaction-history');
    const now = new Date('2026-09-22T12:00:00Z');
    const defaultArchive = await fetchTransactionHistory(
      parseTransactionHistoryParams(new URLSearchParams('q=Archive')),
      now,
    );
    assert.equal(defaultArchive.transactions.length, 1, 'the default view includes older receipts');
    const all = await fetchTransactionHistory({ period: 'all', query: '', type: 'all', limit: 50 }, now);
    assert.equal(all.transactions.length, 50);
    assert.equal(String(all.transactions[0].receiptId), '120');
    assert.ok(all.nextCursor);
    const second = await fetchTransactionHistory(
      { period: 'all', query: '', type: 'all', limit: 50, cursor: all.nextCursor! },
      now,
    );
    assert.equal(String(second.transactions[0].receiptId), '70');
    const third = await fetchTransactionHistory(
      { period: 'all', query: '', type: 'all', limit: 50, cursor: second.nextCursor! },
      now,
    );
    assert.equal(third.transactions.length, 21);
    assert.equal(third.nextCursor, null);
    const archive = await fetchTransactionHistory({ period: 'all', query: '100%_', type: 'all', limit: 50 }, now);
    assert.equal(archive.transactions.length, 1);
    assert.equal(String(archive.transactions[0].receiptId), '9007199254740993');
    assert.equal(
      (await fetchTransactionHistory({ period: 'today', query: 'Archive', type: 'all', limit: 50 }, now)).transactions
        .length,
      0,
    );
    const exact = await fetchTransactionReceipt('9007199254740993');
    assert.equal(exact?.description, 'Archive 100%_literal');
    assert.equal(
      (await fetchTransactionHistory({ period: 'all', query: '', type: 'attention', limit: 50 }, now)).transactions
        .length,
      1,
    );
    await db.pool.query(
      `INSERT INTO app_receipts(id,type,amount_cents,currency,created_at) VALUES (121,'charge',0,'USD','2026-09-21T22:00:00Z'),(122,'tax',1,'USD','2026-09-21T21:59:59.999999Z');`,
    );
    assert.equal(
      (await fetchTransactionHistory({ period: 'today', query: '121', type: 'charge', limit: 50 }, now)).transactions
        .length,
      1,
    );
    assert.equal(
      (await fetchTransactionHistory({ period: 'today', query: '122', type: 'tax', limit: 50 }, now)).transactions
        .length,
      0,
    );
    assert.equal(
      (await fetchTransactionHistory({ period: '24h', query: '122', type: 'tax', limit: 50 }, now)).transactions.length,
      1,
    );
    await assert.rejects(
      fetchTransactionHistory({ period: 'all', query: 'x', type: 'all', limit: 50, cursor: all.nextCursor! }, now),
      /cursor/i,
    );
  } finally {
    await getDb().end();
    await db.cleanup();
    delete process.env.DATABASE_URL;
  }
});
