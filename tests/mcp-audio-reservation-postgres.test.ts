import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { createInitialAudioJobInExecutor } from '../frontend/src/server/audio/audio-generate-jobs';
import { buildAudioRunReservation } from '../frontend/src/server/audio/audio-run-reservation';
import { prepareAudioRun } from '../frontend/src/server/audio/prepare-audio';
import { audioQuoteRepository, anyGenerationQuoteRepository } from '../frontend/src/server/agent-api/audio-quote-repository';
import { normalizeAudioGenerationRequest, hashCanonicalAudioRequest, audioRequestToGenerationBody } from '../frontend/src/server/agent-api/audio-normalization';
import * as videoQuotes from '../frontend/src/server/agent-api/quote-repository';
import { hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { listMcpActivityHistory } from '../frontend/src/server/agent-api/activity-history';
import { createMcpTopupHandoffService } from '../frontend/src/server/agent-api/topup-handoff';
import { createPaidGenerationTestSchema, missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

const userId = '00000000-0000-4000-8000-000000000061';
const oauthClientId = 'audio-client';
const request = normalizeAudioGenerationRequest({ schemaVersion: 1, surface: 'audio', engineId: 'audio-song', mode: 'song',
  prompt: 'Warm acoustic folk', settings: { lyrics: '[Verse]\nThe same words' }, references: [], outputCount: 1 });

test('Audio quotes share real SQL state/ownership and reserve wallet, job and claim in one transaction', { timeout: 60_000 }, async t => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  const pg = await startDisposablePostgres('mcp-audio-reservation');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => { await getDb().end(); if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl; await pg.cleanup(); });
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query('CREATE TABLE profiles(id uuid PRIMARY KEY,preferred_currency text)');
  await pg.pool.query("INSERT INTO profiles VALUES ($1,'usd')", [userId]);
  await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES ($1,'topup',1000,'USD')", [userId]);
  const prepared = await prepareAudioRun(audioRequestToGenerationBody(request), userId, {
    env: { FAL_KEY: 'fixture-not-a-provider-key' },
    pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [], routingRules: [] }) },
  });
  assert.equal(prepared.pricingSnapshot.totalCents, 45);
  const insert = (price = 45) => audioQuoteRepository.insertPreparedQuote({ userId, oauthClientId, request,
    requestHash: hashCanonicalAudioRequest(request), catalogRevision: 'audio-test-v1',
    pricingSnapshot: { ...prepared.pricingSnapshot, totalCents: price }, priceCents: price, currency: 'USD', fundingMode: 'wallet' });
  const owner = (quoteId: string) => ({ quoteId, userId, oauthClientId });

  await t.test('wallet-only Audio funding and canonical amount are checked before SQL', async () => {
    let calls = 0;
    const input = { userId, oauthClientId, request, requestHash: hashCanonicalAudioRequest(request), catalogRevision: 'audio-test-v1',
      pricingSnapshot: { totalCents: 45, currency: 'USD' }, priceCents: 45, currency: 'USD', fundingMode: 'wallet' as const };
    for (const patch of [{ fundingMode: 'trial' }, { pricingSnapshot: { ...input.pricingSnapshot, funding: {} } }, { priceCents: 46 }]) {
      await assert.rejects(audioQuoteRepository.insertPreparedQuote({ ...input, ...patch } as never, { executor: { query: async () => { calls++; return []; } } }));
    }
    assert.equal(calls, 0);
  });
  await t.test('an account without a receipt cannot reserve a positive charge', async () => {
    const emptyUserId = '00000000-0000-4000-8000-000000000064';
    await pg.pool.query("INSERT INTO profiles VALUES ($1,'usd')", [emptyUserId]);
    const reservation = buildAudioRunReservation(prepared, emptyUserId);
    await assert.rejects(
      withDbTransaction(executor => createInitialAudioJobInExecutor(executor, reservation.initialJob)),
      /Insufficient wallet balance/
    );
    assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM app_receipts WHERE user_id=$1', [emptyUserId])).rows[0].n, 0);
    assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM app_jobs WHERE user_id=$1', [emptyUserId])).rows[0].n, 0);
  });
  await t.test('wrong-surface reads and mutations leave Audio and video states intact', async () => {
    const audio = await insert();
    assert.equal(await videoQuotes.getOwnedQuote(owner(audio.quoteId)), null);
    assert.equal(await audioQuoteRepository.getOwnedQuote({ ...owner(audio.quoteId), userId: 'other' }), null);
    assert.equal(await audioQuoteRepository.getOwnedQuote({ ...owner(audio.quoteId), oauthClientId: 'other' }), null);
    await withDbTransaction(async executor => {
      assert.equal(await videoQuotes.lockOwnedQuote(owner(audio.quoteId), { executor }), null);
      assert.equal(await videoQuotes.claimPreparedQuote({ ...owner(audio.quoteId), jobId: 'wrong-surface' }, { executor, claimedAt: new Date() }), null);
      assert.equal(await videoQuotes.invalidatePreparedQuote(owner(audio.quoteId), { executor, expiredAt: new Date() }), null);
    });
    assert.equal((await audioQuoteRepository.getOwnedQuote(owner(audio.quoteId)))!.state, 'prepared');
    const videoRequest = { schemaVersion: 1 as const, surface: 'video' as const, engineId: 'sora-2', mode: 't2v' as const, prompt: 'Video', settings: { durationSec: 5 }, references: [], outputCount: 1 };
    const video = await videoQuotes.insertPreparedQuote({ userId, oauthClientId, request: videoRequest, requestHash: hashCanonicalGenerationRequest(videoRequest), catalogRevision: 'video-test', pricingSnapshot: { totalCents: 25 }, priceCents: 25, currency: 'USD', fundingMode: 'wallet' });
    assert.equal(await audioQuoteRepository.getOwnedQuote(owner(video.quoteId)), null);
    await withDbTransaction(async executor => {
      assert.equal(await audioQuoteRepository.claimPreparedQuote({ ...owner(video.quoteId), jobId: 'wrong-surface' }, { executor, claimedAt: new Date() }), null);
    });
    assert.equal((await videoQuotes.getOwnedQuote(owner(video.quoteId)))!.state, 'prepared');
    assert.equal((await anyGenerationQuoteRepository.getOwnedQuote(owner(audio.quoteId)))!.request.surface, 'audio');
    assert.equal((await anyGenerationQuoteRepository.getOwnedQuote(owner(video.quoteId)))!.request.surface, 'video');
  });
  await t.test('a failed job insertion rolls back the Audio debit and quote claim together', async () => {
    const quote = await insert();
    const reservation = buildAudioRunReservation(prepared, userId);
    await pg.pool.query("ALTER TABLE app_jobs ADD CONSTRAINT reject_fixture_audio CHECK (engine_id <> 'audio-song')");
    await assert.rejects(withDbTransaction(async executor => {
      await audioQuoteRepository.claimPreparedQuote({ ...owner(quote.quoteId), jobId: reservation.initialJob.jobId }, { executor, claimedAt: new Date() });
      await createInitialAudioJobInExecutor(executor, reservation.initialJob);
    }));
    await pg.pool.query('ALTER TABLE app_jobs DROP CONSTRAINT reject_fixture_audio');
    assert.equal((await audioQuoteRepository.getOwnedQuote(owner(quote.quoteId)))!.state, 'prepared');
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n, 0);
    assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM app_jobs')).rows[0].n, 0);
  });
  await t.test('simultaneous reservation callers retain the same durable job and one charge', async () => {
    const quote = await insert();
    const reserve = () => withDbTransaction(async executor => {
      const locked = await audioQuoteRepository.lockOwnedQuote(owner(quote.quoteId), { executor });
      assert.ok(locked);
      if (locked.quote.state !== 'prepared') return locked.quote.jobId;
      const reservation = buildAudioRunReservation(prepared, userId);
      await createInitialAudioJobInExecutor(executor, reservation.initialJob);
      const claimed = await audioQuoteRepository.claimPreparedQuote({ ...owner(quote.quoteId), jobId: reservation.initialJob.jobId }, { executor, claimedAt: locked.databaseNow });
      assert.ok(claimed);
      return claimed.jobId;
    });
    const [first, second] = await Promise.all([reserve(), reserve()]);
    assert.equal(first, second);
    assert.equal(await reserve(), first);
    assert.deepEqual((await pg.pool.query("SELECT amount_cents,surface FROM app_receipts WHERE type='charge'")).rows, [{ amount_cents: 45, surface: 'audio' }]);
    const job = (await pg.pool.query('SELECT user_id,engine_id,status,payment_status,settings_snapshot FROM app_jobs WHERE job_id=$1', [first])).rows[0];
    assert.equal(job.user_id, userId); assert.equal(job.engine_id, 'audio-song'); assert.equal(job.payment_status, 'paid_wallet');
    assert.equal(job.settings_snapshot.lyrics, request.settings.lyrics);
  });
  await t.test('distinct quotes for one 70-cent account serialize before reserving 45 cents', async () => {
    const competingUserId = '00000000-0000-4000-8000-000000000063';
    await pg.pool.query("INSERT INTO profiles VALUES ($1,'usd')", [competingUserId]);
    await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES ($1,'topup',70,'USD')", [competingUserId]);
    const quotes = await Promise.all([0, 1].map(() => audioQuoteRepository.insertPreparedQuote({
      userId: competingUserId,
      oauthClientId,
      request,
      requestHash: hashCanonicalAudioRequest(request),
      catalogRevision: 'audio-wallet-race-v1',
      pricingSnapshot: prepared.pricingSnapshot,
      priceCents: 45,
      currency: 'USD',
      fundingMode: 'wallet',
    })));
    await pg.pool.query(`
      CREATE FUNCTION hold_competing_audio_charge() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.user_id = '${competingUserId}' AND NEW.type = 'charge' THEN
          PERFORM pg_sleep(0.2);
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER hold_competing_audio_charge
      BEFORE INSERT ON app_receipts
      FOR EACH ROW EXECUTE FUNCTION hold_competing_audio_charge();
    `);
    const reserve = (quoteId: string) => withDbTransaction(async executor => {
      const locked = await audioQuoteRepository.lockOwnedQuote({ quoteId, userId: competingUserId, oauthClientId }, { executor });
      assert.ok(locked);
      const reservation = buildAudioRunReservation(prepared, competingUserId);
      await createInitialAudioJobInExecutor(executor, reservation.initialJob);
      const claimed = await audioQuoteRepository.claimPreparedQuote({
        quoteId,
        userId: competingUserId,
        oauthClientId,
        jobId: reservation.initialJob.jobId,
      }, { executor, claimedAt: locked.databaseNow });
      assert.ok(claimed);
      return claimed.jobId;
    });

    const results = await Promise.allSettled(quotes.map(quote => reserve(quote.quoteId)));
    await pg.pool.query('DROP TRIGGER hold_competing_audio_charge ON app_receipts; DROP FUNCTION hold_competing_audio_charge()');
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    assert.match(String((results.find(result => result.status === 'rejected') as PromiseRejectedResult).reason), /Insufficient wallet balance/);

    const ledger = await pg.pool.query(`
      SELECT
        count(*) FILTER (WHERE type='charge')::int AS charges,
        COALESCE(SUM(CASE WHEN type='topup' THEN amount_cents WHEN type='refund' THEN amount_cents WHEN type='charge' THEN -amount_cents ELSE 0 END), 0)::int AS balance
      FROM app_receipts
      WHERE user_id=$1
    `, [competingUserId]);
    assert.deepEqual(ledger.rows[0], { charges: 1, balance: 25 });
    assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM app_jobs WHERE user_id=$1', [competingUserId])).rows[0].n, 1);
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM mcp_generation_quotes WHERE user_id=$1 AND state='claimed'", [competingUserId])).rows[0].n, 1);
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM mcp_generation_quotes WHERE user_id=$1 AND state='prepared'", [competingUserId])).rows[0].n, 1);
  });
  await t.test('mixed history uses the actual tool and Audio top-up requires a fresh Audio quote', async () => {
    const rows = await listMcpActivityHistory({ userId, clientLabels: { [oauthClientId]: 'Test assistant' } });
    assert.ok(rows.some(row => row.tool === 'prepare_audio_generation'));
    assert.ok(rows.some(row => row.tool === 'confirm_audio_generation'));
    assert.ok(rows.some(row => row.tool === 'prepare_generation'));
    const service = createMcpTopupHandoffService({ secret: 'fixture-secret-long-enough-for-hmac', billingBaseUrl: 'https://maxvideoai.com',
      randomUUID, getWalletSummary: async () => ({ balanceCents: 955, currency: 'USD' }) as never });
    const principal = { userId, clientId: oauthClientId, authMethod: 'oauth' as const, emailVerified: true };
    const affordable = await insert();
    const ready = await service({ quoteId: affordable.quoteId }, principal);
    assert.equal(ready.topupRequired, false);
    if (ready.topupRequired) throw new Error('Unexpected funding requirement');
    assert.equal(ready.nextAction.tool, 'confirm_audio_generation');
    const costly = await insert(1500);
    const handoff = await service({ quoteId: costly.quoteId }, principal);
    assert.equal(handoff.topupRequired, true);
    if (!handoff.topupRequired) throw new Error('Missing funding requirement');
    assert.equal(handoff.nextActionAfterFunding.then, 'prepare_audio_generation');
    assert.equal((await audioQuoteRepository.getOwnedQuote(owner(costly.quoteId)))!.state, 'expired');
  });
});
