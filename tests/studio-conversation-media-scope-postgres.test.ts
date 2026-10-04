import assert from 'node:assert/strict';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createStudioImageGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {readStudioProjectMedia, studioMotionSource} from '../frontend/src/server/studio/conversation-media-generation';
import {createPaidGenerationTestSchema, startDisposablePostgres} from './helpers/disposable-postgres';
import {addTopup, ProviderHarness} from './helpers/mcp-paid-e2e-harness';

test('motion sources are explicit library attachments or exact completed outputs from this project', async t => {
  const pg = await startDisposablePostgres('studio-motion-source');
  const prior = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {await getDb().end(); if (prior === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prior; await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,name text,deleted_at timestamptz);
    INSERT INTO studio_projects VALUES ('film','owner','Film',NULL),('other','owner','Other',NULL);
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,url text,mime_type text,status text,duration_sec double precision,metadata jsonb,created_at timestamptz DEFAULT clock_timestamp());
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text);
    INSERT INTO media_assets VALUES ('image','ma_11111111111111111111111111111111','owner','image','https://cdn.maxvideoai.com/original.png','image/png','ready',NULL,'{}',NULL,NULL,NULL,NULL);`);
  await addTopup(pg.pool, 'owner', 1000);
  const actor = {authMethod: 'studio-session' as const, userId: 'owner', projectId: 'film', clientId: null};
  const engine = getFalEngineById('gpt-image-2')!;
  const catalog = [{engine: engine.engine, surface: 'image' as const, publicModes: ['t2i' as const], modeCaps: Object.fromEntries(engine.modes.map(mode => [mode.mode, mode.ui]))}];
  const provider = new ProviderHarness(pg.pool);
  const service = createStudioImageGenerationService(actor, {enabled: true,
    prepareDependencies: {listPublicEngines: async () => catalog, resolveRequestExecutability: () => ({executable: true, reason: 'available'})},
    confirmDependencies: {listPublicEngines: async () => catalog, resolveRequestExecutability: () => ({executable: true, reason: 'available'}), submitPaidGeneration: provider.submit}});
  const quote = await service.prepare({surface: 'image', engineId: engine.engine.id, mode: 't2i', prompt: 'Quiet warm light', settings: {resolution: 'landscape_16_9', aspectRatio: '16:9', quality: 'high', outputFormat: 'png'}});
  const job = await service.confirm({quoteId: quote.quoteId, confirmed: true});
  await pg.pool.query("UPDATE app_jobs SET status='accepted' WHERE job_id=$1", [job.jobId]);
  await pg.pool.query("INSERT INTO job_outputs VALUES ('ready-image',$1,'owner','image','https://cdn.maxvideoai.com/original.png','image/png','ready',NULL,'{}',clock_timestamp())", [job.jobId]);
  assert.deepEqual(await readStudioProjectMedia(actor), [], 'Ready output alone does not establish a completed generation');
  await pg.pool.query("UPDATE app_jobs SET status='completed' WHERE job_id=$1", [job.jobId]);
  const media = await readStudioProjectMedia(actor);
  assert.equal(media.length, 1);
  assert.deepEqual(media[0].ref, {type: 'job-output', kind: 'image', jobId: job.jobId, outputId: 'ready-image'});
  assert.deepEqual(await readStudioProjectMedia({...actor, projectId: 'other'}), []);
  assert.deepEqual(await readStudioProjectMedia({...actor, userId: 'foreign'}), []);
  const input = {requestId: '00000000-0000-4000-8000-000000000001', message: 'Animate it', references: [] as string[]};
  let saves = 0;
  const save = async (identity: {userId: string; jobId: string; outputId: string}) => {saves++; assert.deepEqual(identity, {userId: 'owner', jobId: job.jobId, outputId: 'ready-image'}); return {publicId: 'ma_' + '1'.repeat(32)} as never;};
  const resolved = await studioMotionSource(actor, media[0].ref, input, {saveOutput: save});
  assert.equal(resolved, 'ma_' + '1'.repeat(32));
  assert.equal(saves, 1);
  await assert.rejects(studioMotionSource({...actor, projectId: 'other'}, media[0].ref, input, {saveOutput: save}), {code: 'REFERENCE_INVALID'});
  await assert.rejects(studioMotionSource(actor, {...media[0].ref, outputId: 'invented'} as never, input, {saveOutput: save}), {code: 'REFERENCE_INVALID'});
  assert.equal(saves, 1, 'Foreign or guessed output never reaches the library write owner');
  const ref = {type: 'asset' as const, kind: 'image' as const, assetId: 'ma_' + '1'.repeat(32)};
  await assert.rejects(studioMotionSource(actor, ref, input), {code: 'REFERENCE_INVALID'});
  assert.equal(await studioMotionSource(actor, ref, {...input, references: [ref.assetId]}), ref.assetId);
  for (const output of [
    {id: 'measured-audio',kind: 'audio',duration: 13,metadata: {mediaFacts: {source: 'probe',durationSec: 12.408}}},
    {id: 'measured-video',kind: 'video',duration: 5,metadata: {mediaFacts: {source: 'probe',durationSec: 4.92}}},
    {id: 'requested-audio',kind: 'audio',duration: 13,metadata: {durationSec: 13}},
    {id: 'requested-video',kind: 'video',duration: 5,metadata: {mediaFacts: {source: 'requested',durationSec: 5}}},
    {id: 'browser-audio',kind: 'audio',duration: 13,metadata: {mediaFacts: {source: 'browser',durationSec: 12.408}}},
    {id: 'incomplete-video',kind: 'video',duration: 5,metadata: {mediaFacts: {source: 'probe',width: 854,height: 480}}},
  ]) {
    await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,mime_type,status,duration_sec,metadata)
      VALUES ($1,$2,'owner',$3,$4,$5,'ready',$6,$7::jsonb)`, [output.id,job.jobId,output.kind,
      `https://cdn.maxvideoai.com/${output.id}.${output.kind === 'audio' ? 'mp3' : 'mp4'}`,
      output.kind === 'audio' ? 'audio/mpeg' : 'video/mp4',output.duration,JSON.stringify(output.metadata)]);
  }
  const projected = await readStudioProjectMedia(actor);
  const durationFor = (outputId: string) => projected.find(item => item.ref.type === 'job-output' && item.ref.outputId === outputId)?.durationSec;
  assert.equal(durationFor('measured-audio'),12.408,'The director must receive actual source duration, never the legacy rounded 13-second request.');
  assert.equal(durationFor('measured-video'),4.92);
  const stored = (await pg.pool.query("SELECT duration_sec,metadata FROM job_outputs WHERE id='measured-audio'")).rows[0];
  assert.equal(stored.duration_sec,13,'Projection remains read-only; legacy request history is preserved.');
  assert.deepEqual(stored.metadata,{mediaFacts: {source: 'probe',durationSec: 12.408}});
  for (const id of ['requested-audio','requested-video','browser-audio','incomplete-video']) assert.equal(durationFor(id),null,`${id} is not measured duration evidence.`);
  assert.deepEqual(await readStudioProjectMedia({...actor,projectId: 'other'}),[]);
  assert.deepEqual(await readStudioProjectMedia({...actor,userId: 'foreign'}),[]);
  await pg.pool.query("UPDATE app_jobs SET hidden=true WHERE job_id=$1", [job.jobId]);
  assert.deepEqual(await readStudioProjectMedia(actor), []);
});
