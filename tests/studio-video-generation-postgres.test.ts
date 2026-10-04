import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {getDb} from '../frontend/src/lib/db';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createPaidGenerationTestSchema, startDisposablePostgres} from './helpers/disposable-postgres';
import {addTopup, ProviderHarness, createServices, principal} from './helpers/mcp-paid-e2e-harness';

test('session video shares canonical quotes/reservations and rejects image, MCP and foreign-project scopes', async t => {
  const module = await import('../frontend/src/server/studio/image-generation-service');
  assert.ok(module.createStudioVideoGenerationService, 'Studio needs a certified video session adapter');
  const pg = await startDisposablePostgres('studio-session-video');
  const prior = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {await getDb().end(); if (prior === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prior; await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(readFileSync('neon/migrations/53_studio_media_generation_scope.sql', 'utf8'));
  await addTopup(pg.pool, 'video-owner', 10000);
  await pg.pool.query(`CREATE TABLE job_outputs (id text PRIMARY KEY, job_id text, user_id text, status text, kind text, url text);
    CREATE TABLE media_assets (id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text);
    INSERT INTO media_assets (id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
    VALUES ('image','ma_11111111111111111111111111111111','video-owner','image','https://cdn.maxvideoai.com/source.png','image/png',1024,1024,1024,'ready','{}');`);
  const video = getFalEngineById('wan-3')!;
  const image = getFalEngineById('gpt-image-2')!;
  const catalog = [video, image].map(entry => ({engine: entry.engine, surface: entry === video ? 'video' as const : 'image' as const,
    publicModes: entry === video ? ['t2v' as const, 'i2v' as const] : ['t2i' as const], modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui]))}));
  const provider = new ProviderHarness(pg.pool);
  const actor = {authMethod: 'studio-session' as const, userId: 'video-owner', projectId: 'film', clientId: null};
  const options = {enabled: true, prepareDependencies: {listPublicEngines: async () => catalog, resolveRequestExecutability: () => ({executable: true as const, reason: 'available' as const})},
    confirmDependencies: {listPublicEngines: async () => catalog, resolveRequestExecutability: () => ({executable: true as const, reason: 'available' as const}), submitPaidGeneration: provider.submit}};
  const service = module.createStudioVideoGenerationService(actor, options);
  assert.deepEqual((await service.catalog()).map(entry => entry.engine.id), ['wan-3']);
  const mcp = createServices({publicEngines: catalog, submitPaidGeneration: provider.submit});
  for (const mode of ['t2v', 'i2v'] as const) {
    const quote = await service.prepare({surface: 'video', engineId: 'wan-3', mode, prompt: 'A slow cinematic camera move in warm light',
      settings: {durationSec: 5, resolution: '480p', aspectRatio: '16:9', audio: false},
      references: mode === 'i2v' ? [{kind: 'asset', assetId: 'ma_11111111111111111111111111111111', role: 'first_frame'}] : [], outputCount: 1});
    assert.equal(provider.captures.length, mode === 't2v' ? 0 : 1);
    await assert.rejects(mcp.confirmGeneration!({quoteId: quote.quoteId, confirmed: true}, principal('video-owner')), {code: 'QUOTE_EXPIRED'});
    await assert.rejects(module.createStudioVideoGenerationService({...actor, projectId: 'other'}, options).confirm({quoteId: quote.quoteId, confirmed: true}), {code: 'QUOTE_EXPIRED'});
    await assert.rejects(module.createStudioImageGenerationService(actor, options).confirm({quoteId: quote.quoteId, confirmed: true}), {code: 'QUOTE_EXPIRED'});
    await Promise.all([service.confirm({quoteId: quote.quoteId, confirmed: true}), service.confirm({quoteId: quote.quoteId, confirmed: true})]);
    assert.equal(provider.captures.filter(call => call.quoteId === quote.quoteId).length, 1);
    assert.equal((await service.recover(quote.quoteId))?.jobId, quote.quoteId);
    assert.deepEqual((await pg.pool.query("SELECT amount_cents FROM app_receipts WHERE job_id=$1 AND type='charge'", [quote.quoteId])).rows.map(row => row.amount_cents), [quote.price.amountCents]);
  }
  await assert.rejects(service.prepare({surface: 'image', engineId: 'gpt-image-2', mode: 't2i', prompt: 'A photo', settings: {resolution: '1024x1024'}}), {code: 'ENGINE_UNAVAILABLE'});
});
