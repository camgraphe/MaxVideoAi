import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

import { getDb, type QueryExecutor } from '../frontend/src/lib/db';
import { loadPricingPolicyOverridesWithExecutor } from '../frontend/src/lib/pricing-rule-store';
import { prepareAudioRun } from '../frontend/src/server/audio/prepare-audio';
import type { ReservedAudioRun } from '../frontend/src/server/audio/audio-run-reservation';
import { completeAudioJob, failAudioJob } from '../frontend/src/server/audio/audio-generate-jobs';
import { refundAudioCharge } from '../frontend/src/server/audio/audio-generate-receipts';
import { listAudioCapabilities } from '../frontend/src/server/agent-api/audio-capabilities';
import { createPrepareAudioGenerationService, createPrepareAudioGenerationForActorService } from '../frontend/src/server/agent-api/prepare-audio-generation';
import { createConfirmAudioGenerationService, createConfirmAudioGenerationForActorService } from '../frontend/src/server/agent-api/confirm-audio-generation';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const capabilities = () => listAudioCapabilities({ FAL_KEY: 'fixture-provider-configuration' });
const request = { surface: 'audio' as const, engineId: 'audio-sfx-only', mode: 'sfx_only' as const,
  prompt: 'A quiet door closes', settings: { durationSec: 8 } };

test('Audio dispatch reserves and runs at most once against durable PostgreSQL state', { timeout: 90_000 }, async t => {
  const repository = await import('../frontend/src/server/audio/dispatch-repository').catch(() => null);
  const worker = await import('../frontend/src/server/audio/dispatch-worker').catch(() => null);
  assert.equal(typeof repository?.enqueueAudioDispatch, 'function', 'Durable Audio enqueue is implemented');
  assert.equal(typeof worker?.runAudioGenerationWorkerOnce, 'function', 'Durable Audio worker is implemented');
  const pg = await startDisposablePostgres('audio-dispatch');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE profiles(id uuid PRIMARY KEY, preferred_currency text);
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,url text,storage_url text,mime_type text,
      width integer,height integer,duration_sec integer,status text,metadata jsonb);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,width integer,height integer,
      size_bytes bigint,source_job_id text,status text,metadata jsonb,deleted_at timestamptz);`);
  const executor: QueryExecutor = { query: async (sql, values) => (await pg.pool.query(sql, values as unknown[])).rows };
  const prepareDependencies = {
    paidGenerationEnabled: () => true, listCapabilities: capabilities,
    prepareRun: (body: Parameters<typeof prepareAudioRun>[0], userId: string) => prepareAudioRun(body, userId, {
      env: { FAL_KEY: 'fixture-provider-configuration' },
      pricingPolicy: { loadOverrides: () => loadPricingPolicyOverridesWithExecutor(executor) },
    }),
  };
  const prepare = createPrepareAudioGenerationService('https://maxvideoai.com', prepareDependencies);
  let identityIndex = 100;
  const seed = async () => {
    const suffix = String(identityIndex++);
    const principal: AgentPrincipal = { userId: `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`,
      clientId: `dispatch-client-${suffix}`, authMethod: 'oauth', emailVerified: true };
    await pg.pool.query("INSERT INTO profiles VALUES($1,'usd')", [principal.userId]);
    await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',1000,'USD')", [principal.userId]);
    const quote = await prepare(request, principal);
    return { principal, quote };
  };
  const confirm = (enqueueRun = repository!.enqueueAudioDispatch) => createConfirmAudioGenerationService('https://maxvideoai.com', {
    paidGenerationEnabled: () => true, listCapabilities: capabilities, enqueueRun,
    executeRun: async () => { throw new Error('HTTP execution must not run'); },
  });
  const queue = async () => {
    const { principal, quote } = await seed();
    const status = await confirm()({ quoteId: quote.quoteId, confirmed: true }, principal);
    return { principal, quote, jobId: status.jobId };
  };
  const dispatch = async (quoteId: string) => (await pg.pool.query('SELECT * FROM audio_generation_dispatch WHERE quote_id=$1', [quoteId])).rows[0];
  const job = async (jobId: string) => (await pg.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
  let providerCalls = 0;
  const executeRun = async (run: ReservedAudioRun) => {
    providerCalls++;
    assert.equal((await dispatch((await pg.pool.query('SELECT quote_id FROM audio_generation_dispatch WHERE job_id=$1', [run.jobId])).rows[0].quote_id)).state, 'processing');
    assert.equal(await completeAudioJob(run.jobId, { progress: 100, message: 'Complete', audioUrl: 'https://media.maxvideoai.com/result.mp3' }), true);
  };
  const run = (overrides: Record<string, unknown> = {}) => worker!.runAudioGenerationWorkerOnce({
    assertProviderConfigured: () => undefined, executeRun, promoteOutputs: async () => undefined, ...overrides,
  });

  await t.test('missing dispatch schema rolls back quote claim, job and charge together', async () => {
    const { principal, quote } = await seed();
    await assert.rejects(confirm()({ quoteId: quote.quoteId, confirmed: true }, principal));
    assert.equal((await pg.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1', [quote.quoteId])).rows[0].state, 'prepared');
    assert.equal((await pg.pool.query('SELECT count(*)::int n FROM app_jobs WHERE user_id=$1', [principal.userId])).rows[0].n, 0);
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE user_id=$1 AND type='charge'", [principal.userId])).rows[0].n, 0);
  });
  await pg.pool.query(readFileSync('neon/migrations/100_audio_generation_dispatch.sql', 'utf8'));
  await pg.pool.query(readFileSync('neon/migrations/73_subtitle_operations.sql', 'utf8'));

  await t.test('wrong enqueue client rolls back the complete reservation', async () => {
    const { principal, quote } = await seed();
    await assert.rejects(confirm((input, dependencies) => repository!.enqueueAudioDispatch({ ...input,
      principal: { ...principal, clientId: 'wrong-client' } }, dependencies))({ quoteId: quote.quoteId, confirmed: true }, principal));
    assert.equal((await pg.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1', [quote.quoteId])).rows[0].state, 'prepared');
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE user_id=$1 AND type='charge'", [principal.userId])).rows[0].n, 0);
  });

  await t.test('two workers execute one durable claim and confirmation replays the same job', async () => {
    const item = await queue();
    assert.equal((await dispatch(item.quote.quoteId)).state, 'queued');
    assert.equal((await job(item.jobId)).settings_snapshot.audioDispatch.state, 'queued');
    const before = providerCalls;
    await Promise.all([run(), run()]);
    assert.equal(providerCalls - before, 1);
    assert.equal((await dispatch(item.quote.quoteId)).state, 'completed');
    assert.equal((await job(item.jobId)).settings_snapshot.audioDispatch.state, 'completed');
    const replay = await confirm()({ quoteId: item.quote.quoteId, confirmed: true }, item.principal);
    assert.equal(replay.jobId, item.jobId);
    assert.equal((await pg.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1', [item.quote.quoteId])).rows[0].state, 'accepted');
  });

  await t.test('queue identity and payload are immutable and quote/job foreign keys remain enforced', async () => {
    const item = await queue();
    for (const sql of ["UPDATE audio_generation_dispatch SET execution_json='{}'::jsonb WHERE quote_id=$1",
      "UPDATE audio_generation_dispatch SET oauth_client_id='other' WHERE quote_id=$1",
      "UPDATE audio_generation_dispatch SET state='completed' WHERE quote_id=$1",
      "DELETE FROM app_jobs WHERE job_id=(SELECT job_id FROM audio_generation_dispatch WHERE quote_id=$1)"]) {
      await assert.rejects(pg.pool.query(sql, [item.quote.quoteId]));
    }
    await run();
  });

  await t.test('a mismatched billing product cannot dispatch even when job and charge agree with each other', async () => {
    const item = await queue();
    await pg.pool.query("UPDATE app_jobs SET billing_product_key='audio-wrong-product' WHERE job_id=$1", [item.jobId]);
    await pg.pool.query("UPDATE app_receipts SET billing_product_key='audio-wrong-product' WHERE job_id=$1", [item.jobId]);
    const before = providerCalls;
    await run();
    assert.equal(providerCalls, before);
    assert.equal((await job(item.jobId)).payment_status, 'refunded_wallet');
    assert.equal((await dispatch(item.quote.quoteId)).state, 'failed');
  });

  await t.test('configuration failure and account restriction fail/refund before provider use', async () => {
    for (const restriction of [false, true]) {
      const item = await queue();
      if (restriction) await pg.pool.query("INSERT INTO user_account_restrictions(user_id,reason) VALUES($1,'manual_review')", [item.principal.userId]);
      const before = providerCalls;
      await run(restriction ? {} : { assertProviderConfigured: () => { throw new Error('private configuration details'); } });
      assert.equal(providerCalls, before);
      assert.equal((await dispatch(item.quote.quoteId)).state, 'failed');
      assert.equal((await job(item.jobId)).payment_status, 'refunded_wallet');
      assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE job_id=$1 AND type='refund'", [item.jobId])).rows[0].n, 1);
    }
  });

  await t.test('provider failure uses the existing exact refund once', async () => {
    const item = await queue();
    await run({ executeRun: async () => {
      providerCalls++;
      await failAudioJob(item.jobId, { message: 'Failed' });
      await refundAudioCharge({ userId: item.principal.userId, jobId: item.jobId });
      throw new Error('provider private message');
    } });
    assert.equal((await dispatch(item.quote.quoteId)).state, 'failed');
    assert.equal((await job(item.jobId)).payment_status, 'refunded_wallet');
    await run();
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE job_id=$1 AND type='refund'", [item.jobId])).rows[0].n, 1);
  });

  await t.test('completed output projection outage never refunds or executes again', async () => {
    const item = await queue();
    const before = providerCalls;
    await run({ promoteOutputs: async () => { throw new Error('projection outage'); } });
    assert.equal((await job(item.jobId)).status, 'completed');
    assert.equal((await job(item.jobId)).payment_status, 'paid_wallet');
    assert.equal((await dispatch(item.quote.quoteId)).state, 'ambiguous');
    await run();
    assert.equal(providerCalls - before, 1);
  });

  await t.test('Toolbox and Studio dispatch preserve their exact session/project scope', async () => {
    const prepareActor = createPrepareAudioGenerationForActorService('https://maxvideoai.com', prepareDependencies);
    const confirmActor = createConfirmAudioGenerationForActorService('https://maxvideoai.com', {
      paidGenerationEnabled: () => true, listCapabilities: capabilities, enqueueRun: repository!.enqueueAudioDispatch,
    });
    for (const authMethod of ['toolbox-session', 'studio-session'] as const) {
      const { principal } = await seed();
      const actor = authMethod === 'toolbox-session' ? { authMethod, userId: principal.userId, clientId: null }
        : { authMethod, userId: principal.userId, clientId: null, projectId: 'audio-project' };
      const quote = await prepareActor(request, actor);
      await assert.rejects(confirm()({ quoteId: quote.quoteId, confirmed: true }, { ...principal, clientId: null }));
      if (actor.authMethod === 'studio-session') await assert.rejects(confirmActor({ quoteId: quote.quoteId, confirmed: true }, { ...actor, projectId: 'wrong-project' }));
      const accepted = await confirmActor({ quoteId: quote.quoteId, confirmed: true }, actor);
      const queued = await dispatch(quote.quoteId);
      assert.equal(queued.auth_origin, authMethod);
      assert.equal(queued.oauth_client_id, null);
      assert.equal(queued.studio_project_id, actor.authMethod === 'studio-session' ? 'audio-project' : null);
      const before = providerCalls;
      await run();
      assert.equal(providerCalls - before, 1);
      assert.equal((await job(accepted.jobId)).status, 'completed');
    }
  });

  await t.test('a source deleted after confirmation is re-resolved and rejected before provider use', async () => {
    const { principal } = await seed();
    const assetId = 'ma_' + 'a'.repeat(32);
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,status,metadata)
      VALUES($1,$1,$2,'audio','https://media.maxvideoai.com/original-voice.mp3','audio/mpeg','ready','{"durationSec":4}')`, [assetId, principal.userId]);
    const quote = await prepare({ surface: 'audio', engineId: 'audio-voice-only', mode: 'voice_only', prompt: '',
      settings: { script: 'The quick brown fox jumps over the lazy dog.', voiceModel: 'seed' },
      references: [{ role: 'voice_sample', asset: { type: 'asset', assetId, kind: 'audio' } }] }, principal);
    const accepted = await confirm()({ quoteId: quote.quoteId, confirmed: true }, principal);
    await pg.pool.query('UPDATE media_assets SET deleted_at=clock_timestamp() WHERE public_id=$1', [assetId]);
    const before = providerCalls;
    await run();
    assert.equal(providerCalls, before);
    assert.equal((await dispatch(quote.quoteId)).state, 'failed');
    assert.equal((await job(accepted.jobId)).payment_status, 'refunded_wallet');
  });

  await t.test('wrong worker client or user never reaches the provider', async () => {
    for (const wrongUser of [false, true]) {
      const item = await queue();
      const before = providerCalls;
      await run({ claim: async () => {
        const record = await repository!.claimNextAudioDispatch();
        assert.ok(record);
        return wrongUser ? { ...record, userId: 'different-user' } : { ...record, oauthClientId: 'different-client' };
      } });
      assert.equal(providerCalls, before);
      assert.equal((await dispatch(item.quote.quoteId)).state, 'ambiguous');
      if (wrongUser) {
        assert.equal((await job(item.jobId)).status, 'pending');
        assert.equal((await job(item.jobId)).payment_status, 'paid_wallet');
      } else assert.equal((await job(item.jobId)).payment_status, 'refunded_wallet');
    }
  });

  await t.test('external CLI exits cleanly with --once and an empty queue', async () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'frontend/scripts/run-audio-generation-worker.ts', '--once'],
      { encoding: 'utf8', timeout: 20_000, env: { ...process.env, TSX_TSCONFIG_PATH: 'frontend/tsconfig.json' } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  });

  await t.test('external worker drains its loop and closes its database connection on SIGTERM', async () => {
    const url = new URL(pg.databaseUrl); url.searchParams.set('application_name', 'audio-worker-shutdown-test');
    const child = spawn(process.execPath, ['--import', 'tsx', 'frontend/scripts/run-audio-generation-worker.ts'], {
      env: { ...process.env, DATABASE_URL: url.toString(), TSX_TSCONFIG_PATH: 'frontend/tsconfig.json' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = ''; child.stdout.on('data', data => { output += String(data); }); child.stderr.on('data', data => { output += String(data); });
    const exit = new Promise<number | null>(resolve => { child.once('exit', resolve); });
    t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
    let connected = false;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      connected = (await pg.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE application_name='audio-worker-shutdown-test'")).rows[0].n > 0;
      if (connected) break;
      await setTimeout(25);
    }
    assert.equal(connected, true, output);
    child.kill('SIGTERM');
    assert.equal(await exit, 0, output);
    assert.equal(output, '');
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE application_name='audio-worker-shutdown-test'")).rows[0].n, 0);
  });

  await t.test('lost processing is never reclaimed, even with an old observation', async () => {
    const item = await queue();
    const claim = await repository!.claimNextAudioDispatch();
    assert.equal(claim?.jobId, item.jobId);
    const before = providerCalls;
    await run();
    assert.equal(providerCalls, before);
    assert.equal((await dispatch(item.quote.quoteId)).state, 'processing');
  });

  await t.test('unknown provider acceptance preserves charge and never resubmits', async () => {
    const item = await queue();
    const before = providerCalls;
    await run({ executeRun: async () => { providerCalls++; throw new Error('connection disappeared'); } });
    assert.equal((await dispatch(item.quote.quoteId)).state, 'ambiguous');
    assert.equal((await job(item.jobId)).payment_status, 'paid_wallet');
    await run();
    assert.equal(providerCalls - before, 1);
  });
});
