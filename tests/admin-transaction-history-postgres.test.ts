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
    assert.equal(defaultArchive.transactions[0]?.isMcpGeneration, false, 'older schemas still serve receipts');
    assert.equal(defaultArchive.transactions[0]?.isStudioGeneration, false);
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
    await db.pool.query(`
      CREATE TABLE mcp_generation_quotes(job_id text, user_id text);
      INSERT INTO app_jobs(job_id,status,payment_status,engine_label,duration_sec,created_at)
        VALUES ('mcp-job','completed','paid_wallet','Veo',8,'2026-09-22T10:00:00Z'),
               ('app-job','completed','paid_wallet','Veo',8,'2026-09-22T10:00:00Z');
      INSERT INTO app_receipts(id,user_id,type,amount_cents,currency,job_id,created_at)
        VALUES (123,'11111111-1111-4111-8111-111111111111','charge',500,'USD','mcp-job','2026-09-22T10:00:00Z'),
               (124,'11111111-1111-4111-8111-111111111111','charge',500,'USD','app-job','2026-09-22T10:00:00Z');
      INSERT INTO mcp_generation_quotes(job_id,user_id)
        VALUES ('mcp-job','11111111-1111-4111-8111-111111111111'),
               ('app-job','22222222-2222-4222-8222-222222222222');
    `);
    assert.equal((await fetchTransactionReceipt('123'))?.isMcpGeneration, true);
    assert.equal((await fetchTransactionReceipt('124'))?.isMcpGeneration, false, 'another user’s quote is not attribution');
    const mcpHistory = await fetchTransactionHistory({ period: 'all', query: 'mcp-job', type: 'all', limit: 50 }, now);
    assert.equal(mcpHistory.transactions.length, 1);
    assert.equal(mcpHistory.transactions[0]?.isMcpGeneration, true);

    await db.pool.query(`ALTER TABLE mcp_generation_quotes ADD COLUMN auth_origin text DEFAULT 'oauth'`);
    const owner = '11111111-1111-4111-8111-111111111111';
    for (const [id, jobId, origin, quoteOwner, mcp, studio] of [
      [125, 'studio-image', 'studio-session', owner, false, true],
      [126, 'studio-video', 'studio-session', owner, false, true],
      [127, 'studio-audio', 'studio-session', owner, false, true],
      [128, 'toolbox-job', 'toolbox-session', owner, false, false],
      [129, 'unknown-origin', 'future-origin', owner, false, false],
      [130, 'foreign-studio', 'studio-session', '22222222-2222-4222-8222-222222222222', false, false],
    ] as const) {
      await db.pool.query(`INSERT INTO app_receipts(id,user_id,type,amount_cents,currency,job_id,created_at)
        VALUES ($1,$2,'charge',500,'USD',$3,'2026-09-22T10:00:00Z')`, [id, owner, jobId]);
      await db.pool.query(`INSERT INTO mcp_generation_quotes(job_id,user_id,auth_origin) VALUES ($1,$2,$3)`,
        [jobId, quoteOwner, origin]);
      const receipt = await fetchTransactionReceipt(String(id));
      assert.equal(receipt?.isMcpGeneration, mcp, `${jobId}: MCP attribution`);
      assert.equal(receipt?.isStudioGeneration, studio, `${jobId}: Studio attribution`);
    }
    assert.equal((await fetchTransactionReceipt('123'))?.isMcpGeneration, true, 'OAuth remains MCP');
    assert.equal((await fetchTransactionReceipt('123'))?.isStudioGeneration, false);
    await db.pool.query(`INSERT INTO app_receipts(id,user_id,type,amount_cents,currency,job_id,created_at)
      VALUES (131,$1,'refund',500,'USD','studio-image','2026-09-22T10:01:00Z')`, [owner]);
    const studioHistory = await fetchTransactionHistory({ period: 'all', query: 'studio-image', type: 'all', limit: 50 }, now);
    assert.equal(studioHistory.transactions.length, 2, 'the charge and its refund retain origin');
    for (const receipt of studioHistory.transactions) {
      assert.equal(receipt.isMcpGeneration, false);
      assert.equal(receipt.isStudioGeneration, true);
    }

    // The first reader has no product column: historical prefix identity must still work.
    await db.pool.query(`INSERT INTO app_receipts(id,user_id,type,amount_cents,currency,job_id,created_at)
      VALUES (140,$1,'charge',500,'USD','studio-sol-pack:synthetic-pack','2026-09-22T10:05:00Z')`, [owner]);
    const legacyPack = await fetchTransactionReceipt('140');
    await db.pool.query(`ALTER TABLE app_receipts ADD COLUMN billing_product_key text`);
    await db.pool.query(`INSERT INTO app_receipts(id,user_id,type,amount_cents,currency,job_id,created_at,billing_product_key)
      VALUES (141,$1,'charge',500,'USD',NULL,'2026-09-22T10:10:00Z','studio_assistance_pack'),
             (142,$1,'charge',500,'USD','product-only-reference','2026-09-22T10:11:00Z','studio_assistance_pack'),
             (143,$1,'charge',500,'USD','missing-media','2026-09-22T10:09:00Z',NULL),
             (144,$1,'charge',500,'USD','studio-sol-pack-lookalike','2026-09-22T10:08:00Z',NULL),
             (145,$1,'charge',0,'USD',NULL,'2026-09-22T10:07:00Z','studio_assistance_pack')`, [owner]);
    const attention = await fetchTransactionHistory({ period: 'all', query: '', type: 'attention', limit: 2 }, now);
    assert.deepEqual(attention.transactions.map(row => String(row.receiptId)), ['143', '144'],
      'positive packs are excluded before the attention page limit, while NULL-product media remains');
    assert.ok(attention.nextCursor);
    const nextAttention = await fetchTransactionHistory({ period: 'all', query: '', type: 'attention', limit: 2, cursor: attention.nextCursor! }, now);
    assert.equal(String(nextAttention.transactions[0]?.receiptId), '145', 'a nonpositive pack charge still needs review');
    const allAttention = await fetchTransactionHistory({ period: 'all', query: '', type: 'attention', limit: 50 }, now);
    assert.equal(allAttention.transactions.some(row => ['140','141','142'].includes(String(row.receiptId))), false);
    for (const id of ['141', '142']) {
      const pack = await fetchTransactionReceipt(id);
      assert.equal(pack?.billingProductKey, 'studio_assistance_pack');
      assert.equal(pack?.canRefund, false);
    }
    assert.equal(legacyPack?.billingProductKey, null);
    assert.equal(legacyPack?.canRefund, false);
    assert.equal((await fetchTransactionReceipt('143'))?.canRefund, true, 'real historical missing-media eligibility is unchanged');
    assert.equal((await fetchTransactionReceipt('123'))?.canRefund, true, 'real paid media remains refundable');
  } finally {
    await getDb().end();
    await db.cleanup();
    delete process.env.DATABASE_URL;
  }
});
