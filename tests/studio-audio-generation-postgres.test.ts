import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {loadPricingPolicyOverridesWithExecutor} from '../frontend/src/lib/pricing-rule-store';
import {prepareAudioRun} from '../frontend/src/server/audio/prepare-audio';
import type {ReservedAudioRun} from '../frontend/src/server/audio/audio-run-reservation';
import {completeAudioJob, failAudioJob} from '../frontend/src/server/audio/audio-generate-jobs';
import {refundAudioCharge} from '../frontend/src/server/audio/audio-generate-receipts';
import {listAudioCapabilities} from '../frontend/src/server/agent-api/audio-capabilities';
import {createConfirmAudioGenerationService} from '../frontend/src/server/agent-api/confirm-audio-generation';
import {createPaidGenerationTestSchema, startDisposablePostgres} from './helpers/disposable-postgres';

test('session voice/music retain exact Audio billing, recovery, refund and OAuth/project isolation', async t => {
  const module = await import('../frontend/src/server/studio/audio-generation-service').catch(() => null);
  assert.ok(module?.createStudioAudioGenerationService, 'Studio needs the canonical Audio session adapter');
  const pg = await startDisposablePostgres('studio-session-audio');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {await getDb().end(); if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous; await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(readFileSync('neon/migrations/53_studio_media_generation_scope.sql', 'utf8'));
  const userId = '00000000-0000-4000-8000-000000000083';
  await pg.pool.query(`CREATE TABLE studio_projects (id text PRIMARY KEY,user_id text,name text,deleted_at timestamptz);
    CREATE TABLE profiles(id uuid PRIMARY KEY,preferred_currency text);`);
  await pg.pool.query("INSERT INTO profiles VALUES ($1,'usd')", [userId]);
  await pg.pool.query("INSERT INTO studio_projects VALUES ('film',$1,'Film',NULL),('other',$1,'Other',NULL),('foreign','foreign','Private',NULL)", [userId]);
  await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES ($1,'topup',1000,'USD')", [userId]);
  const actor = {authMethod: 'studio-session' as const, userId, projectId: 'film', clientId: null};
  const env = {FAL_KEY: 'test-only-provider', GOOGLE_VERTEX_PROJECT_ID: 'test-project', GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: 'test-only-no-network'};
  const caps = () => listAudioCapabilities(env);
  const executor = {query: async <TRecord=unknown>(sql: string, params?: ReadonlyArray<unknown>) => (await pg.pool.query<TRecord>(sql, params)).rows};
  let executions = 0;
  let fail = false;
  const options = {enabled: true,
    prepareDependencies: {listCapabilities: caps, prepareRun: (body: Parameters<typeof prepareAudioRun>[0], owner: string) => prepareAudioRun(body, owner, {env, pricingPolicy: {loadOverrides: () => loadPricingPolicyOverridesWithExecutor(executor)}})},
    confirmDependencies: {listCapabilities: caps, executeRun: async (run: ReservedAudioRun) => {
      executions++;
      if (fail) {await failAudioJob(run.jobId, {progress: 0, message: 'Controlled provider failure'}); await refundAudioCharge({jobId: run.jobId, userId}); throw new Error('Provider rejected');}
      assert.ok(await completeAudioJob(run.jobId, {progress: 100, message: 'Ready', audioUrl: 'https://media.maxvideoai.com/audio/result.mp3'}));
    }},
  };
  const service = module.createStudioAudioGenerationService(actor, options);
  assert.deepEqual((await service.catalog()).modes.map(mode=>mode.mode),['music_only','voice_only','sfx_only','song','ambience_only','cinematic','cinematic_voice']);
  const requests = [
    {surface: 'audio' as const, engineId: 'audio-voice-only', mode: 'voice_only' as const, prompt: '', settings: {script: 'Your film starts with a conversation.', voiceModel: 'seed' as const, language: 'english' as const}, references: []},
    {surface: 'audio' as const, engineId: 'audio-music-only', mode: 'music_only' as const, prompt: 'Quiet elegant instrumental piano, no vocals', settings: {musicModel: 'clip' as const, mood: 'dreamy' as const, durationSec: 30}, references: []},
  ];
  for (const request of requests) {
    const quote = await service.prepare(request);
    assert.equal(quote.confirmationRequired, true);
    assert.equal((await pg.pool.query("SELECT * FROM app_receipts WHERE type='charge' AND job_id=$1", [quote.quoteId])).rows.length, 0);
    await assert.rejects(module.createStudioAudioGenerationService({...actor, projectId: 'other'}, options).confirm({quoteId: quote.quoteId, confirmed: true}), {code: 'QUOTE_EXPIRED'});
    await assert.rejects(createConfirmAudioGenerationService('https://maxvideoai.com', {paidGenerationEnabled: () => true, listCapabilities: caps})({quoteId: quote.quoteId, confirmed: true}, {authMethod: 'oauth', userId, clientId: 'client', emailVerified: true}), {code: 'QUOTE_EXPIRED'});
    const before = executions;
    const results = await Promise.all([service.confirm({quoteId: quote.quoteId, confirmed: true}), service.confirm({quoteId: quote.quoteId, confirmed: true})]);
    assert.equal(executions, before + 1);
    assert.equal(results[0].jobId, results[1].jobId);
    assert.equal((await service.recover(quote.quoteId))?.result?.surface, 'audio');
    const charge = (await pg.pool.query<{amount_cents:number}>("SELECT amount_cents FROM app_receipts WHERE job_id=$1 AND type='charge'", [results[0].jobId])).rows;
    assert.deepEqual(charge.map(row => row.amount_cents), [quote.price.amountCents]);
  }
  await assert.rejects(module.createStudioAudioGenerationService({...actor, projectId: 'foreign'}, options).prepare(requests[0]), {code: 'PARAMETER_INVALID'});
  fail = true;
  const rejectedQuote = await service.prepare(requests[0]);
  const failed = await service.confirm({quoteId: rejectedQuote.quoteId, confirmed: true});
  assert.equal(failed.status, 'failed');
  assert.equal(failed.paymentStatus, 'refunded_wallet');
  const priorExecutions = executions;
  await service.confirm({quoteId: rejectedQuote.quoteId, confirmed: true});
  assert.equal(executions, priorExecutions);
  const receipts = (await pg.pool.query<{type:string;amount_cents:number}>("SELECT type,amount_cents FROM app_receipts WHERE job_id=$1 ORDER BY type", [failed.jobId])).rows;
  assert.deepEqual(receipts.map(row => row.type), ['charge', 'refund']);
  assert.equal(receipts[0].amount_cents, receipts[1].amount_cents);
});
