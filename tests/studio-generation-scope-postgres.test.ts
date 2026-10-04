import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeGenerationRequest, hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { createQuoteRepository, generationQuoteCodec } from '../frontend/src/server/agent-api/quote-repository';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import type { QueryExecutor, TransactionQueryExecutor } from '../frontend/src/lib/db';

test('quotes retain immutable OAuth/session/project scope on disposable PostgreSQL', async (t) => {
  const pg = await startDisposablePostgres('studio-quote-scope');
  t.after(() => pg.cleanup());
  await pg.pool.query(readFileSync('neon/migrations/30_mcp_paid_generation.sql', 'utf8'));
  await pg.pool.query(readFileSync('neon/migrations/39_mcp_quote_lifetime.sql', 'utf8'));
  const executor: QueryExecutor = { async query(sql, params) { return (await pg.pool.query(sql, params as unknown[])).rows; } };
  const oauth = createQuoteRepository(generationQuoteCodec);
  const request = normalizeGenerationRequest({ surface: 'image', engineId: 'gpt-image-2', mode: 't2i', prompt: 'Private studio keyframe', outputCount: 1 });
  const insert = { userId: 'owner', oauthClientId: null, request, requestHash: hashCanonicalGenerationRequest(request), catalogRevision: 'catalog', pricingSnapshot: { totalCents: 25 }, priceCents: 25, currency: 'USD', fundingMode: 'wallet' as const };
  // A quote made before the migration remains OAuth even with a null client.
  const historical = { quoteId: '123e4567-e89b-42d3-a456-426614174000' };
  await pg.pool.query(`INSERT INTO mcp_generation_quotes (quote_id, user_id, request_json, request_hash, catalog_revision, pricing_snapshot, price_cents, currency, funding_mode, state, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'prepared', NOW() + INTERVAL '45 minutes')`, [historical.quoteId, insert.userId, request, insert.requestHash, insert.catalogRevision, insert.pricingSnapshot, insert.priceCents, insert.currency, insert.fundingMode]);
  await pg.pool.query(readFileSync('neon/migrations/49_studio_generation_scope.sql', 'utf8'));
  const studio = createQuoteRepository(generationQuoteCodec, { origin: 'studio-session', projectId: 'project-a' });
  const otherProject = createQuoteRepository(generationQuoteCodec, { origin: 'studio-session', projectId: 'project-b' });
  const quote = await studio.insertPreparedQuote(insert, { executor });
  const owner = { quoteId: quote.quoteId, userId: 'owner', oauthClientId: null };
  assert.equal((await studio.getOwnedQuote(owner, { executor }))?.quoteId, quote.quoteId);
  assert.equal(await oauth.getOwnedQuote(owner, { executor }), null);
  assert.equal(await otherProject.getOwnedQuote(owner, { executor }), null);
  assert.equal(await studio.getOwnedQuote({ ...owner, userId: 'foreign' }, { executor }), null);
  assert.equal(await studio.getOwnedQuote({ ...owner, quoteId: historical.quoteId }, { executor }), null);
  assert.equal((await oauth.getOwnedQuote({ ...owner, quoteId: historical.quoteId }, { executor }))?.quoteId, historical.quoteId);
  await assert.rejects(pg.pool.query('UPDATE mcp_generation_quotes SET auth_origin = $2, studio_project_id = NULL WHERE quote_id = $1', [quote.quoteId, 'oauth']), /immutable/i);
  await assert.rejects(pg.pool.query('UPDATE mcp_generation_quotes SET studio_project_id = $2 WHERE quote_id = $1', [quote.quoteId, 'project-b']), /immutable/i);
  await assert.rejects(studio.insertPreparedQuote({ ...insert, oauthClientId: 'fake-client' }, { executor }), /scope/i);
  await assert.rejects(studio.insertPreparedQuote({ ...insert, fundingMode: 'trial' }, { executor }), /scope|funding/i);
  const client = await pg.pool.connect();
  const tx = { async query(sql: string, params?: readonly unknown[]) { return (await client.query(sql, params as unknown[])).rows; } } as TransactionQueryExecutor;
  try {
    await client.query('BEGIN');
    assert.equal(await oauth.lockOwnedQuote(owner, { executor: tx }), null);
    assert.equal(await otherProject.claimPreparedQuote({ ...owner, jobId: quote.quoteId }, { executor: tx, claimedAt: new Date() }), null);
    assert.equal((await studio.claimPreparedQuote({ ...owner, jobId: quote.quoteId }, { executor: tx, claimedAt: new Date() }))?.state, 'claimed');
    await client.query('COMMIT');
  } finally { client.release(); }
  assert.equal(await oauth.markQuoteAccepted({ ...owner, jobId: quote.quoteId }, { executor }), null);
  assert.equal((await studio.markQuoteAccepted({ ...owner, jobId: quote.quoteId }, { executor }))?.state, 'accepted');
  assert.equal((await studio.getOwnedQuote(owner, { executor }))?.jobId, quote.quoteId);
});
