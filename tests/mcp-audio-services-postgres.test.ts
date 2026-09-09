import assert from 'node:assert/strict';
import test from 'node:test';

import { getDb, withDbTransaction, type QueryExecutor } from '../frontend/src/lib/db';
import { loadPricingPolicyOverridesWithExecutor } from '../frontend/src/lib/pricing-rule-store';
import { prepareAudioRun } from '../frontend/src/server/audio/prepare-audio';
import { completeAudioJob, createInitialAudioJobInExecutor, failAudioJob } from '../frontend/src/server/audio/audio-generate-jobs';
import { refundAudioCharge } from '../frontend/src/server/audio/audio-generate-receipts';
import { listAudioCapabilities } from '../frontend/src/server/agent-api/audio-capabilities';
import { createPrepareAudioGenerationService } from '../frontend/src/server/agent-api/prepare-audio-generation';
import { createConfirmAudioGenerationService } from '../frontend/src/server/agent-api/confirm-audio-generation';
import { resolveOwnedAudioReference } from '../frontend/src/server/agent-api/audio-reference-assets';
import { hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import * as videoQuotes from '../frontend/src/server/agent-api/quote-repository';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import { createPaidGenerationTestSchema, missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

const capabilities = () => listAudioCapabilities({ FAL_KEY: 'fixture-provider-configuration' });
const sfxRequest = {
  schemaVersion: 1 as const, surface: 'audio' as const,
  engineId: 'audio-sfx-only', mode: 'sfx_only' as const,
  prompt: 'A wooden door closes in a quiet room', settings: { durationSec: 8 },
  references: [], outputCount: 1 as const,
};

function identity(suffix: string): AgentPrincipal {
  return {
    userId: `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`,
    clientId: `audio-client-${suffix}`,
    emailVerified: true,
    authMethod: 'oauth',
  };
}

test('Audio prepare/confirm services preserve exact quote and reservation semantics in PostgreSQL', { timeout: 90_000 }, async t => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  const pg = await startDisposablePostgres('mcp-audio-services');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`
    CREATE TABLE profiles(id uuid PRIMARY KEY, preferred_currency text);
    CREATE TABLE job_outputs (
      id text PRIMARY KEY, job_id text NOT NULL, user_id text, kind text NOT NULL,
      url text NOT NULL, storage_url text, mime_type text, width integer, height integer,
      duration_sec integer, status text NOT NULL DEFAULT 'ready', metadata jsonb
    );
    CREATE TABLE media_assets (
      id text PRIMARY KEY, public_id text UNIQUE NOT NULL, user_id text, kind text NOT NULL,
      url text NOT NULL, mime_type text, width integer, height integer, size_bytes bigint,
      source_job_id text, status text NOT NULL DEFAULT 'ready', metadata jsonb,
      deleted_at timestamptz
    );
  `);
  const executor: QueryExecutor = {
    query: async (sql, params) => (await pg.pool.query(sql, params as unknown[])).rows,
  };
  const pricingPolicy = {
    loadOverrides: () => loadPricingPolicyOverridesWithExecutor(executor),
  };
  const prepare = createPrepareAudioGenerationService('https://maxvideoai.com', {
    paidGenerationEnabled: () => true,
    listCapabilities: capabilities,
    prepareRun: (body, userId) => prepareAudioRun(body, userId, {
      env: { FAL_KEY: 'fixture-provider-configuration' }, pricingPolicy,
    }),
  });
  const seedWallet = async (principal: AgentPrincipal, cents: number) => {
    await pg.pool.query("INSERT INTO profiles VALUES ($1,'usd')", [principal.userId]);
    await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES ($1,'topup',$2,'USD')", [principal.userId, cents]);
  };
  const successfulConfirm = (onExecute: (jobId: string) => void = () => undefined) =>
    createConfirmAudioGenerationService('https://maxvideoai.com', {
      paidGenerationEnabled: () => true,
      listCapabilities: capabilities,
      executeRun: async run => {
        onExecute(run.jobId);
        const won = await completeAudioJob(run.jobId, {
          progress: 100, message: 'Audio render complete.', audioUrl: 'https://media.maxvideoai.com/audio/result.mp3',
        });
        assert.equal(won, true);
        return { ok: true };
      },
    });

  await t.test('ToolAssetRef resolution keeps exact owner, output identity, original URL and stored facts', async () => {
    const principal = identity('80');
    await seedWallet(principal, 1000);
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,surface,status,hidden)
      VALUES ('source-video-job',$1,'video','completed',false)`, [principal.userId]);
    await pg.pool.query(`INSERT INTO job_outputs
      (id,job_id,user_id,kind,url,storage_url,mime_type,width,height,duration_sec,status,metadata)
      VALUES ('source-video-output','source-video-job',$1,'video','https://media.maxvideoai.com/preview.mp4',
        'https://media.maxvideoai.com/original.mp4','video/mp4',1920,1080,9,'ready',$2::jsonb)`,
    [principal.userId, JSON.stringify({ durationSec: 9.125 })]);
    const resolved = await resolveOwnedAudioReference(principal, {
      role: 'source_video',
      asset: { type: 'job-output', jobId: 'source-video-job', outputId: 'source-video-output', kind: 'video' },
    });
    assert.equal(resolved.originalUrl, 'https://media.maxvideoai.com/original.mp4');
    assert.equal(resolved.durationSec, 9.125);
    assert.equal(resolved.width, 1920);
    await assert.rejects(resolveOwnedAudioReference({ ...principal, userId: identity('79').userId }, {
      role: 'source_video',
      asset: { type: 'job-output', jobId: 'source-video-job', outputId: 'source-video-output', kind: 'video' },
    }), (error: unknown) => (error as { code?: string }).code === 'REFERENCE_NOT_FOUND');
  });

  await t.test('prepare writes only its exact expiring quote and exposes top-up facts', async () => {
    const principal = identity('81');
    await seedWallet(principal, 70);
    const result = await prepare(sfxRequest, principal);
    assert.equal(result.price.amountCents, 5);
    assert.deepEqual(result.balance, { beforeCents: 70, afterCents: 65 });
    assert.equal(result.topupRequired, false);
    assert.equal(result.confirmationRequired, true);
    assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM app_jobs WHERE user_id=$1', [principal.userId])).rows[0].n, 0);
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE user_id=$1 AND type='charge'", [principal.userId])).rows[0].n, 0);
    const stored = (await pg.pool.query('SELECT state,price_cents,currency,request_json,pricing_snapshot FROM mcp_generation_quotes WHERE quote_id=$1', [result.quoteId])).rows[0];
    assert.equal(stored.state, 'prepared');
    assert.equal(stored.price_cents, 5);
    assert.equal(stored.request_json.surface, 'audio');
    assert.equal(stored.pricing_snapshot.mcpAudio.requestHash, result.requestHash);
  });

  await t.test('same-quote concurrent confirmation creates one job/debit/provider attempt and replays the status', async () => {
    const principal = identity('82');
    await seedWallet(principal, 1000);
    const quote = await prepare(sfxRequest, principal);
    let executions = 0;
    const confirm = successfulConfirm(() => { executions += 1; });
    const [first, second] = await Promise.all([
      confirm({ quoteId: quote.quoteId, confirmed: true }, principal),
      confirm({ quoteId: quote.quoteId, confirmed: true }, principal),
    ]);
    const replay = await confirm({ quoteId: quote.quoteId, confirmed: true }, principal);
    assert.equal(first.jobId, second.jobId);
    assert.equal(first.jobId, replay.jobId);
    assert.equal(executions, 1);
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE user_id=$1 AND type='charge'", [principal.userId])).rows[0].n, 1);
    assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM app_jobs WHERE user_id=$1', [principal.userId])).rows[0].n, 1);
    assert.equal((await pg.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1', [quote.quoteId])).rows[0].state, 'accepted');
  });

  await t.test('distinct quotes serialize a wallet that can fund only one attempt', async () => {
    const principal = identity('83');
    await seedWallet(principal, 7);
    const quotes = await Promise.all([prepare(sfxRequest, principal), prepare(sfxRequest, principal)]);
    let executions = 0;
    const confirm = successfulConfirm(() => { executions += 1; });
    const results = await Promise.allSettled(quotes.map(quote =>
      confirm({ quoteId: quote.quoteId, confirmed: true }, principal)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    const rejection = (results.find(result => result.status === 'rejected') as PromiseRejectedResult).reason;
    assert.equal(rejection.code, 'INSUFFICIENT_FUNDS');
    assert.equal(executions, 1);
    const ledger = await pg.pool.query(`SELECT
      count(*) FILTER (WHERE type='charge')::int AS charges,
      SUM(CASE WHEN type='topup' THEN amount_cents WHEN type='refund' THEN amount_cents WHEN type='charge' THEN -amount_cents ELSE 0 END)::int AS balance
      FROM app_receipts WHERE user_id=$1`, [principal.userId]);
    assert.deepEqual(ledger.rows[0], { charges: 1, balance: 2 });
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM mcp_generation_quotes WHERE user_id=$1 AND state='prepared'", [principal.userId])).rows[0].n, 1);
  });

  await t.test('job/debit/claim rollback together when reservation persistence aborts', async () => {
    const principal = identity('84');
    await seedWallet(principal, 1000);
    const quote = await prepare(sfxRequest, principal);
    const confirm = createConfirmAudioGenerationService('https://maxvideoai.com', {
      paidGenerationEnabled: () => true,
      listCapabilities: capabilities,
      reserveInitialJob: async (initialJob, { executor: tx }) => {
        await createInitialAudioJobInExecutor(tx, initialJob);
        throw new Error('forced reservation rollback');
      },
      executeRun: async () => assert.fail('rolled-back reservation cannot execute'),
    });
    await assert.rejects(confirm({ quoteId: quote.quoteId, confirmed: true }, principal), /forced reservation rollback/);
    assert.equal((await pg.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1', [quote.quoteId])).rows[0].state, 'prepared');
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE user_id=$1 AND type='charge'", [principal.userId])).rows[0].n, 0);
    assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM app_jobs WHERE user_id=$1', [principal.userId])).rows[0].n, 0);
  });

  await t.test('provider failure is terminal, exactly refunded, and never retried by confirmation replay', async () => {
    const principal = identity('85');
    await seedWallet(principal, 1000);
    const quote = await prepare(sfxRequest, principal);
    let executions = 0;
    const confirm = createConfirmAudioGenerationService('https://maxvideoai.com', {
      paidGenerationEnabled: () => true,
      listCapabilities: capabilities,
      executeRun: async run => {
        executions += 1;
        assert.equal(await failAudioJob(run.jobId, { progress: 0, message: 'Fixture provider rejected.' }), true);
        await refundAudioCharge({ userId: run.userId, jobId: run.jobId });
        throw new Error('fixture provider failure');
      },
    });
    const failed = await confirm({ quoteId: quote.quoteId, confirmed: true }, principal);
    const replay = await confirm({ quoteId: quote.quoteId, confirmed: true }, principal);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.paymentStatus, 'refunded_wallet');
    assert.doesNotMatch(failed.message ?? '', /Fixture provider/i);
    assert.equal(replay.jobId, failed.jobId);
    assert.equal(executions, 1);
    const ledger = await pg.pool.query("SELECT type,amount_cents FROM app_receipts WHERE user_id=$1 AND type IN ('charge','refund') ORDER BY type", [principal.userId]);
    assert.deepEqual(ledger.rows, [{ type: 'charge', amount_cents: 5 }, { type: 'refund', amount_cents: 5 }]);
    assert.equal((await pg.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1', [quote.quoteId])).rows[0].state, 'failed');
  });

  await t.test('expiry, catalogue/price drift, reference removal, ownership and cumulative mixed limits reject before debit', async () => {
    const expiredPrincipal = identity('86');
    await seedWallet(expiredPrincipal, 1000);
    const prepareExpired = createPrepareAudioGenerationService('https://maxvideoai.com', {
      paidGenerationEnabled: () => true,
      listCapabilities: capabilities,
      prepareRun: (body, userId) => prepareAudioRun(body, userId, {
        env: { FAL_KEY: 'fixture-provider-configuration' }, pricingPolicy,
      }),
      now: () => new Date(Date.now() - 46 * 60_000),
    });
    const expired = await prepareExpired(sfxRequest, expiredPrincipal);
    const confirm = successfulConfirm();
    await assert.rejects(confirm({ quoteId: expired.quoteId, confirmed: true }, expiredPrincipal), (error: unknown) => (error as { code?: string }).code === 'QUOTE_EXPIRED');
    assert.equal((await pg.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1', [expired.quoteId])).rows[0].state, 'expired');

    const driftPrincipal = identity('87');
    await seedWallet(driftPrincipal, 1000);
    const drift = await prepare(sfxRequest, driftPrincipal);
    const catalogDrift = createConfirmAudioGenerationService('https://maxvideoai.com', {
      paidGenerationEnabled: () => true,
      listCapabilities: () => ({ ...capabilities(), revision: 'changed-audio-catalogue' }),
      executeRun: async () => assert.fail('catalogue drift cannot execute'),
    });
    await assert.rejects(catalogDrift({ quoteId: drift.quoteId, confirmed: true }, driftPrincipal), (error: unknown) => (error as { code?: string }).code === 'QUOTE_EXPIRED');

    const pricePrincipal = identity('88');
    await seedWallet(pricePrincipal, 1000);
    const priceDrift = await prepare(sfxRequest, pricePrincipal);
    await pg.pool.query("UPDATE app_pricing_rules SET margin_percent=0.95, updated_at=clock_timestamp() WHERE id='default'");
    await assert.rejects(confirm({ quoteId: priceDrift.quoteId, confirmed: true }, pricePrincipal), (error: unknown) => (error as { code?: string }).code === 'QUOTE_EXPIRED');
    await pg.pool.query("UPDATE app_pricing_rules SET margin_percent=0.2, updated_at=clock_timestamp() WHERE id='default'");

    const refPrincipal = identity('89');
    await seedWallet(refPrincipal, 1000);
    const assetId = 'ma_11111111111111111111111111111111';
    await pg.pool.query(`INSERT INTO media_assets
      (id,public_id,user_id,kind,url,mime_type,size_bytes,status,metadata)
      VALUES ('asset-voice',$1,$2,'audio','https://media.maxvideoai.com/ref.wav','audio/wav',2048,'ready',$3::jsonb)`,
    [assetId, refPrincipal.userId, JSON.stringify({ durationSec: 4.25 })]);
    const voiceQuote = await prepare({
      schemaVersion: 1, surface: 'audio', engineId: 'audio-voice-only', mode: 'voice_only',
      prompt: '', settings: { script: 'Hello from the exact owned voice.', voiceModel: 'seed' },
      references: [{ role: 'voice_sample', asset: { type: 'asset', assetId, kind: 'audio' } }], outputCount: 1,
    }, refPrincipal);
    await pg.pool.query('UPDATE media_assets SET deleted_at=clock_timestamp() WHERE public_id=$1', [assetId]);
    await assert.rejects(confirm({ quoteId: voiceQuote.quoteId, confirmed: true }, refPrincipal), (error: unknown) => (error as { code?: string }).code === 'QUOTE_EXPIRED');

    const ownerPrincipal = identity('90');
    await seedWallet(ownerPrincipal, 1000);
    const ownerQuote = await prepare(sfxRequest, ownerPrincipal);
    await assert.rejects(confirm({ quoteId: ownerQuote.quoteId, confirmed: true }, { ...ownerPrincipal, clientId: 'other-client' }), (error: unknown) => (error as { code?: string }).code === 'QUOTE_EXPIRED');

    const restrictedPrincipal = identity('92');
    await seedWallet(restrictedPrincipal, 1000);
    await pg.pool.query("INSERT INTO user_account_restrictions(user_id,reason) VALUES ($1,'fixture')", [restrictedPrincipal.userId]);
    await assert.rejects(prepare(sfxRequest, restrictedPrincipal), (error: unknown) => (error as { code?: string }).code === 'ACCOUNT_RESTRICTED');

    const limitedPrincipal = identity('93');
    await seedWallet(limitedPrincipal, 1000);
    await pg.pool.query('INSERT INTO mcp_spending_limits(user_id,per_generation_cents) VALUES ($1,4)', [limitedPrincipal.userId]);
    await assert.rejects(prepare(sfxRequest, limitedPrincipal), (error: unknown) => (error as { code?: string }).code === 'SPENDING_LIMIT_EXCEEDED');

    const wrongSurface = await videoQuotes.insertPreparedQuote({ userId: ownerPrincipal.userId, oauthClientId: ownerPrincipal.clientId,
      request: { schemaVersion: 1, surface: 'video', engineId: 'sora-2', mode: 't2v', prompt: 'Video', settings: { durationSec: 5 }, references: [], outputCount: 1 },
      requestHash: hashCanonicalGenerationRequest({ schemaVersion: 1, surface: 'video', engineId: 'sora-2', mode: 't2v', prompt: 'Video', settings: { durationSec: 5 }, references: [], outputCount: 1 }),
      catalogRevision: 'video-test', pricingSnapshot: { totalCents: 5 }, priceCents: 5, currency: 'USD', fundingMode: 'wallet' });
    await assert.rejects(confirm({ quoteId: wrongSurface.quoteId, confirmed: true }, ownerPrincipal), (error: unknown) => (error as { code?: string }).code === 'QUOTE_EXPIRED');

    const mixedPrincipal = identity('91');
    await seedWallet(mixedPrincipal, 1000);
    const videoRequest = { schemaVersion: 1 as const, surface: 'video' as const, engineId: 'sora-2', mode: 't2v' as const, prompt: 'Video', settings: { durationSec: 5 }, references: [], outputCount: 1 };
    const video = await videoQuotes.insertPreparedQuote({ userId: mixedPrincipal.userId, oauthClientId: mixedPrincipal.clientId,
      request: videoRequest, requestHash: hashCanonicalGenerationRequest(videoRequest), catalogRevision: 'video-test', pricingSnapshot: { totalCents: 40 },
      priceCents: 40, currency: 'USD', fundingMode: 'wallet' });
    await withDbTransaction(async tx => {
      const claimed = await videoQuotes.claimPreparedQuote({ quoteId: video.quoteId, userId: mixedPrincipal.userId, oauthClientId: mixedPrincipal.clientId, jobId: 'video-mixed-job' }, { executor: tx, claimedAt: new Date() });
      assert.ok(claimed);
    });
    await videoQuotes.markQuoteAccepted({ quoteId: video.quoteId, userId: mixedPrincipal.userId, oauthClientId: mixedPrincipal.clientId, jobId: 'video-mixed-job' });
    await pg.pool.query(`INSERT INTO mcp_spending_limits(user_id,daily_cents)
      VALUES ($1,100) ON CONFLICT(user_id) DO UPDATE SET daily_cents=100`, [mixedPrincipal.userId]);
    const mixedAudio = await prepare(sfxRequest, mixedPrincipal);
    await pg.pool.query('UPDATE mcp_spending_limits SET daily_cents=44 WHERE user_id=$1', [mixedPrincipal.userId]);
    await assert.rejects(confirm({ quoteId: mixedAudio.quoteId, confirmed: true }, mixedPrincipal), (error: unknown) => (error as { code?: string }).code === 'SPENDING_LIMIT_EXCEEDED');
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE user_id=$1 AND type='charge'", [mixedPrincipal.userId])).rows[0].n, 0);
  });
});
