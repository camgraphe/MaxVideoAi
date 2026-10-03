import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getDb } from '../frontend/src/lib/db';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { imageTurnRetryInput, type ImageConversationHistoryTurn } from '../frontend/src/lib/studio/image-conversation-contract';
import { createImageConversationService, type ImageGenerationFactory } from '../frontend/src/server/studio/image-conversation-service';
import { createStudioImageGenerationService } from '../frontend/src/server/studio/image-generation-service';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { addTopup } from './helpers/mcp-paid-e2e-harness';

test('saved labels survive failed renewal, immutable replay and history without granting foreign asset access', async t => {
  const pg = await startDisposablePostgres('studio-reference-mentions');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,name text,deleted_at timestamptz);
    INSERT INTO studio_projects VALUES('project-labels','owner','Labels',NULL);
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,status text,kind text,url text);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text);`);
  for (const name of ['50_studio_image_conversation.sql', '51_studio_image_model_usage.sql']) await pg.pool.query(readFileSync('neon/migrations/' + name, 'utf8'));
  await addTopup(pg.pool, 'owner', 10000);
  const imageA = 'ma_' + 'a'.repeat(32);
  const imageB = 'ma_' + 'b'.repeat(32);
  const foreign = 'ma_' + 'c'.repeat(32);
  for (const [index, assetId] of [imageA, imageB, foreign].entries()) await pg.pool.query(
    `INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata) VALUES($1,$2,$3,'image',$4,'image/png',1024,1024,1024,'ready','{}')`,
    [`asset-${index}`, assetId, index === 2 ? 'foreign' : 'owner', `https://cdn.maxvideoai.com/owned-${index}.png`],
  );
  const engine = getFalEngineById('gpt-image-2')!;
  const catalog = [{ engine: engine.engine, surface: 'image' as const, publicModes: ['t2i' as const, 'i2i' as const], modeCaps: Object.fromEntries(engine.modes.map(mode => [mode.mode, mode.ui])) }];
  const factory: ImageGenerationFactory = (actor, options) => createStudioImageGenerationService(actor, { ...options,
    prepareDependencies: { listPublicEngines: async () => catalog, resolveRequestExecutability: () => ({ executable: true, reason: 'available' }) },
  });
  const actor = { authMethod: 'studio-session' as const, userId: 'owner', projectId: 'project-labels', clientId: null };
  let calls = 0;
  let observedHistory: ImageConversationHistoryTurn[] = [];
  const service = createImageConversationService(actor, { enabled: true, generationFactory: factory, director: async (input, history, refs) => {
    calls++;
    observedHistory = history;
    assert.deepEqual(input.referenceMentions, [{ assetId: refs[0].assetId, label: 'Image 1' }]);
    return { reply: 'Use Image 1 as the reference. Review the quote.', image: { prompt: 'A quiet blue product photograph', aspectRatio: '1:1' } };
  } });
  const input = { requestId: randomUUID(), message: 'Create with @Image 1.', references: [imageA], referenceMentions: [{ assetId: imageA, label: 'Image 1' }] };
  const original = await service.submit(input);
  assert.ok(original.quote);
  assert.deepEqual(original.referenceMentions, input.referenceMentions);
  assert.deepEqual((await service.read()).turns[0].referenceMentions, input.referenceMentions);
  assert.deepEqual((await pg.pool.query('SELECT input_json FROM studio_image_turns WHERE request_id=$1', [input.requestId])).rows[0].input_json.referenceMentions, input.referenceMentions);
  assert.deepEqual(await service.submit(imageTurnRetryInput(original)), original);
  assert.equal(calls, 1);
  await assert.rejects(service.submit({ ...input, referenceMentions: [{ assetId: imageA, label: 'Image 2' }] }), { code: 'PARAMETER_INVALID' });

  await pg.pool.query("UPDATE mcp_generation_quotes SET state='expired' WHERE quote_id=$1", [original.quote.quoteId]);
  const renewal = { ...imageTurnRetryInput(original), requestId: randomUUID(), renewedFromRequestId: original.requestId };
  await assert.rejects(service.submit({ ...renewal, referenceMentions: [{ assetId: imageA, label: 'Image 2' }] }), { code: 'PARAMETER_INVALID' });
  const { referenceMentions: _ignored, ...missingLabels } = renewal;
  await assert.rejects(service.submit(missingLabels), { code: 'PARAMETER_INVALID' });
  let failOnce = true;
  const retryFactory: ImageGenerationFactory = (current, options) => {
    const base = factory(current, options);
    return { ...base, prepare: async request => { if (failOnce) { failOnce = false; throw new Error('Lost renewal response'); } return base.prepare(request); } };
  };
  const retryService = createImageConversationService(actor, { enabled: true, generationFactory: retryFactory, director: async () => { throw new Error('Renewal must reuse its saved direction'); } });
  await assert.rejects(retryService.submit(renewal), /Lost renewal response/);
  const failed = (await retryService.read()).turns.find(turn => turn.requestId === renewal.requestId)!;
  assert.deepEqual(imageTurnRetryInput(failed), renewal);
  const recovered = await retryService.submit(imageTurnRetryInput(failed));
  assert.ok(recovered.quote);
  assert.notEqual(recovered.quote.quoteId, original.quote.quoteId);
  assert.deepEqual(recovered.referenceMentions, input.referenceMentions);
  assert.equal(calls, 1);

  const second = await service.submit({ ...input, requestId: randomUUID(), references: [imageB], referenceMentions: [{ assetId: imageB, label: 'Image 1' }] });
  assert.deepEqual(second.referenceMentions, [{ assetId: imageB, label: 'Image 1' }]);
  assert.deepEqual(observedHistory.map(turn => turn.referenceMentions), [input.referenceMentions, input.referenceMentions]);
  await assert.rejects(service.submit({ ...input, requestId: randomUUID(), references: [foreign], referenceMentions: [{ assetId: foreign, label: 'Image 1' }] }), { code: 'REFERENCE_INVALID' });
  assert.equal(calls, 2, 'foreign media must fail before invoking the director');
});
