import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getDb, type QueryExecutor } from '../frontend/src/lib/db';
import { createCreatorGenerationService } from '../frontend/src/server/tools/creator-generation-service';
import { createQuoteRepository, generationQuoteCodec } from '../frontend/src/server/agent-api/quote-repository';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { addTopup, ProviderHarness } from './helpers/mcp-paid-e2e-harness';
import { getFalEngineById } from '../frontend/src/config/falEngines';

test('Tools prepares without charging, enforces immutable session scope, submits once and recovers', async t => {
  const pg = await startDisposablePostgres('toolbox-generation');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(readFileSync('neon/migrations/53_studio_media_generation_scope.sql', 'utf8'));
  await pg.pool.query(readFileSync('neon/migrations/69_toolbox_generation_scope.sql', 'utf8'));
  await addTopup(pg.pool, 'tool-owner', 10000);
  await pg.pool.query('CREATE TABLE job_outputs (id text PRIMARY KEY, job_id text, user_id text, status text, kind text, url text)');
  await pg.pool.query(`CREATE TABLE media_assets (
    id text PRIMARY KEY, public_id text, user_id text, kind text, url text,
    mime_type text, size_bytes bigint, width int, height int, status text,
    deleted_at timestamptz, metadata jsonb, source_job_id text,
    source_output_id text, thumb_url text, preview_url text)`);
  const assetId = 'ma_11111111111111111111111111111111';
  await pg.pool.query(`INSERT INTO media_assets (id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
    VALUES ('owned-image',$1,'tool-owner','image','https://cdn.maxvideoai.com/product.png','image/png',1024,1024,1024,'ready','{}')`, [assetId]);
  const entry = getFalEngineById('gpt-image-2-5-flare')!;
  const catalog = [{ engine: entry.engine, surface: 'image' as const, publicModes: ['i2i'], modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])) }];
  const provider = new ProviderHarness(pg.pool);
  const available = () => ({ executable: true as const, reason: 'available' as const });
  const options = {
    enabled: true,
    prepareDependencies: { listPublicEngines: async () => catalog, resolveRequestExecutability: available },
    confirmDependencies: { listPublicEngines: async () => catalog, resolveRequestExecutability: available, submitPaidGeneration: provider.submit },
  };
  const actor = { authMethod: 'toolbox-session' as const, userId: 'tool-owner', clientId: null };
  const service = createCreatorGenerationService(actor, options);
  const input = { surface: 'image' as const, engineId: entry.id, mode: 'i2i' as const, prompt: 'Replace only the background with a studio setting.', outputCount: 1,
    settings: { resolution: 'landscape_16_9', aspectRatio: '16:9', quality: 'high', outputFormat: 'png' },
    references: [{ kind: 'asset' as const, role: 'reference' as const, assetId }] };
  await assert.rejects(createCreatorGenerationService({ ...actor, userId: 'foreign' }, options).prepare(input), { code: 'REFERENCE_INVALID' });
  const prepared = await service.prepare(input);
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n, 0);
  const executor: QueryExecutor = { async query(sql, params) { return (await pg.pool.query(sql, params as unknown[])).rows; } };
  const owner = { quoteId: prepared.quoteId, userId: actor.userId, oauthClientId: null };
  assert.equal(await createQuoteRepository(generationQuoteCodec).getOwnedQuote(owner, { executor }), null);
  assert.equal(await createQuoteRepository(generationQuoteCodec, { origin: 'studio-session', projectId: 'p' }).getOwnedQuote(owner, { executor }), null);
  const quotes = createQuoteRepository(generationQuoteCodec, { origin: 'toolbox-session' });
  assert.equal((await quotes.getOwnedQuote(owner, { executor }))?.authOrigin, 'toolbox-session');
  await assert.rejects(pg.pool.query("UPDATE mcp_generation_quotes SET auth_origin='oauth' WHERE quote_id=$1", [prepared.quoteId]), /immutable/i);
  const confirmation = { quoteId: prepared.quoteId, confirmed: true as const };
  await assert.rejects(createCreatorGenerationService({ ...actor, userId: 'foreign' }, options).confirm(confirmation));
  const results = await Promise.all([service.confirm(confirmation), service.confirm(confirmation)]);
  assert.ok(results.every(result => result.jobId === prepared.quoteId));
  assert.equal(provider.captures.filter(call => call.quoteId === prepared.quoteId).length, 1);
  assert.deepEqual((await pg.pool.query("SELECT amount_cents FROM app_receipts WHERE job_id=$1 AND type='charge'", [prepared.quoteId])).rows.map(row => row.amount_cents), [prepared.price.amountCents]);
  assert.equal((await service.confirm(confirmation)).jobId, prepared.quoteId);
  assert.equal(provider.captures.length, 1);
  const changed = await service.prepare(input);
  await pg.pool.query("UPDATE media_assets SET url='https://cdn.maxvideoai.com/changed.png' WHERE public_id=$1", [assetId]);
  await assert.rejects(service.confirm({ quoteId: changed.quoteId, confirmed: true }), { code: 'QUOTE_EXPIRED' });
  assert.equal(provider.captures.length, 1);
});
