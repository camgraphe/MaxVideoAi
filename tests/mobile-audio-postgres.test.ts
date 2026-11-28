import { ensureMediaLibraryOrganizationSchema } from '../frontend/src/lib/schema/media-library-organization-schema';
import { mutateLibraryOrganization } from '../frontend/server/media-library/organization';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ensureMediaLibrarySchema } from '../frontend/src/lib/schema/media-library-schema';
import { ensureAssetSchema } from '../frontend/src/lib/schema/asset-schema';
import { getDb } from '../frontend/src/lib/db';
import { loadPricingPolicyOverridesWithExecutor } from '../frontend/src/lib/pricing-rule-store';
import { listAudioCapabilities } from '../frontend/src/server/agent-api/audio-capabilities';
import { createConfirmAudioGenerationService } from '../frontend/src/server/agent-api/confirm-audio-generation';
import { prepareAudioRun } from '../frontend/src/server/audio/prepare-audio';
import type { ReservedAudioRun } from '../frontend/src/server/audio/audio-run-reservation';
import { NextRequest } from 'next/server';
import { POST as prepareRoute } from '../frontend/app/api/mobile/audio/quotes/route';
import { POST as confirmRoute } from '../frontend/app/api/mobile/audio/confirm/route';
import { GET as recoverRoute } from '../frontend/app/api/mobile/audio/quotes/[quoteId]/route';
import { refundAudioCharge } from '../frontend/src/server/audio/audio-generate-receipts';
import { completeAudioJob, failAudioJob } from '../frontend/src/server/audio/audio-generate-jobs';
import { readMobileAudioCatalog } from '../frontend/src/server/mobile/audio-catalog';
import {
  confirmMobileAudioQuote,
  prepareMobileAudioQuote,
  recoverMobileAudioQuote,
} from '../frontend/src/server/mobile/audio-quotes';
import { listMobileJobs } from '../frontend/src/server/mobile/generations';
import { confirmMobileQuote, recoverMobileQuote } from '../frontend/src/server/mobile/quotes';
import {
  createPaidGenerationTestSchema,
  startDisposablePostgres,
} from './helpers/disposable-postgres';

test('offline discovery lists standalone packs, selectable stock voices and exact Studio controls with no live offers', () => {
  const offline = readMobileAudioCatalog(listAudioCapabilities({}));
  const current = readMobileAudioCatalog(listAudioCapabilities({}), true);
  assert.equal(current.modes.length, 7);
  assert.equal(current.modes.find(m => m.mode === 'cinematic')?.references?.sourceVideo, 'required');
  assert.equal(current.modes.find(m => m.mode === 'music_only')?.references?.sourceVideo, 'optional');
  assert.deepEqual(offline.modes.map((item) => item.mode).sort(), [
    'ambience_only',
    'music_only',
    'sfx_only',
    'song',
    'voice_only',
  ]);
  assert.ok(
    offline.modes.every(
      (item) => !item.available && item.variants.every((variant) => !variant.available),
    ),
  );
  const voice = offline.modes.find((item) => item.mode === 'voice_only')!;
  const eleven = voice.variants.find((item) => item.settings.voiceModel === 'eleven-v4')!;
  assert.deepEqual(
    eleven.controls.find((item) => item.key === 'elevenVoiceId')?.values,
    offline.options.elevenVoices.map((item) => item.id),
  );
  assert.ok(voice.narration?.required);
  assert.equal(voice.prompt.required, false);
  assert.ok(offline.modes.find((item) => item.mode === 'song')?.lyrics?.required);
  assert.ok(!JSON.stringify(offline).includes('unavailableReason'));
  assert.ok(!JSON.stringify(offline).includes('models":'));
});

test('audio mutations and recovery require explicit bearer sessions', async () => {
  const unauthenticated = new NextRequest('https://app.test/api/mobile/audio', {
    headers: { cookie: 'session=fixture' },
  });
  for (const response of [
    await prepareRoute(unauthenticated),
    await confirmRoute(unauthenticated),
    await recoverRoute(unauthenticated, { params: Promise.resolve({ quoteId: 'invalid' }) }),
  ]) {
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'AUTH_REQUIRED');
  }
});

test('mobile standalone audio has scoped quotes, canonical wallet and idempotent submit/recovery', async (t) => {
  const db = await startDisposablePostgres('mobile-audio-wallet');
  const old = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (old === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = old;
    await db.cleanup();
  });
  await createPaidGenerationTestSchema(db.pool);
  await db.pool.query(readFileSync('neon/migrations/106_generation_confirmation_platform.sql', 'utf8'));
  await ensureMediaLibrarySchema();
  await ensureAssetSchema();
  await ensureMediaLibraryOrganizationSchema();
  await db.pool.query(readFileSync('neon/migrations/107_mobile_create_quote_scope.sql', 'utf8'));
  const owner = '00000000-0000-4000-8000-000000000084';
  const other = '00000000-0000-4000-8000-000000000085';
  await db.pool.query('CREATE TABLE profiles(id uuid PRIMARY KEY,preferred_currency text)');
  await db.pool.query("INSERT INTO profiles VALUES ($1,'usd')", [owner]);
  await db.pool.query(
    "INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES ($1,'topup',5000,'USD')",
    [owner],
  );
  const env = {
    FAL_KEY: 'fixture-no-network',
    GOOGLE_VERTEX_PROJECT_ID: 'test-project',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: 'test-offline',
  };
  const caps = () => listAudioCapabilities(env);
  const executor = {
    query: async <TRecord = unknown>(sql: string, params?: ReadonlyArray<unknown>) =>
      (await db.pool.query<TRecord>(sql, params)).rows,
  };
  const prepare = {
    listCapabilities: caps,
    prepareRun: (body: Parameters<typeof prepareAudioRun>[0], userId: string) =>
      prepareAudioRun(body, userId, {
        env,
        pricingPolicy: { loadOverrides: () => loadPricingPolicyOverridesWithExecutor(executor) },
      }),
  };
  const movieId = 'ma_' + 'a'.repeat(32);
  await db.pool.query(`INSERT INTO media_assets
    (id,public_id,user_id,kind,url,mime_type,size_bytes,status,source,metadata)
    VALUES ('clip-for-audio',$1,$2,'video','https://media.maxvideoai.com/rehearsal.mp4','video/mp4',2048,'ready','upload',$3::jsonb)`,
    [movieId, owner, JSON.stringify({ durationSec: 8, width: 640, height: 480 })]);
  const original = 'https://media.maxvideoai.com/rehearsal-original.mp4';
  await db.pool.query("INSERT INTO app_jobs(job_id,user_id,status) VALUES ('audio-source-parent',$1,'completed')", [owner]);
  await db.pool.query("INSERT INTO job_outputs(id,job_id,user_id,kind,url) VALUES ('audio-original-output','audio-source-parent',$1,'video',$2)", [owner, original]);
  await db.pool.query("UPDATE media_assets SET source='saved_job_output',source_job_id='audio-source-parent',source_output_id='output:audio-original-output',metadata=metadata || jsonb_build_object('originUrl',$2::text) WHERE public_id=$1", [movieId, original]);
  await db.pool.query("INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata) VALUES ('legacy-source',$1,$2,'video/mp4','upload',$3)", [owner, original, JSON.stringify({jobId:'audio-source-parent',sourceOutputId:'audio-original-output'})]);
  const audioWithSource = readMobileAudioCatalog(caps(), true);
  for (const mode of audioWithSource.modes.filter(m => m.references?.sourceVideo === 'required')) {
    const variant = mode.variants.find(v => v.available)!;
    const project = {surface:'audio',engineId:mode.engineId,mode:mode.mode,prompt:'Add a quiet soundscape to the shot.',
      settings:{...Object.fromEntries(variant.controls.filter(c=>c.default!=null).map(c=>[c.key,c.default])),...variant.settings,...(mode.narration?{script:'Look at the birds over the river.'}:{})},
      references:[{role:'source_video',asset:{type:'asset',kind:'video',assetId:movieId}}]};
    await assert.rejects(prepareMobileAudioQuote(owner,{...project,references:[]},prepare),{code:'REFERENCE_INVALID'});
    const withProbe = { ...prepare, prepareRun: (body: Parameters<typeof prepareAudioRun>[0], user: string) =>
      prepareAudioRun(body, user, { env, pricingPolicy: { loadOverrides: () => loadPricingPolicyOverridesWithExecutor(executor) },
        inspectSourceVideo: async () => ({ durationSec: 8, width: 640, height: 480, hasAudio: true }) }) };
    await assert.rejects(prepareMobileAudioQuote(other, project, withProbe), {code:'REFERENCE_NOT_FOUND'});
    const quote = await prepareMobileAudioQuote(owner, project, withProbe);
    assert.ok(quote.price.amountCents > 0);
    const approval = {quoteId:quote.quoteId, confirmed:true};
    const excluded = {listCapabilities:caps, executeRun:async()=>assert.fail('Source check must precede submit')};
    const output = {type:'job-output' as const,jobId:'audio-source-parent',outputId:'audio-original-output',kind:'video' as const};
    await mutateLibraryOrganization({userId:owner, operation:'trash',references:[output]});
    await assert.rejects(prepareMobileAudioQuote(owner, project, withProbe), {code:'REFERENCE_INVALID'});
    await assert.rejects(confirmMobileAudioQuote(owner, approval, excluded), {code:'REFERENCE_INVALID'});
    await mutateLibraryOrganization({userId:owner,operation:'restore',references:[output]});
    await db.pool.query("UPDATE job_outputs SET url='https://media.maxvideoai.com/replaced.mp4' WHERE id='audio-original-output'");
    await assert.rejects(confirmMobileAudioQuote(owner, approval, excluded), {code:'REFERENCE_INVALID'});
    await assert.rejects(prepareMobileAudioQuote(owner, project, withProbe), {code:'REFERENCE_INVALID'});
    await db.pool.query("UPDATE job_outputs SET url=$1 WHERE id='audio-original-output'",[original]);
    await db.pool.query("UPDATE user_assets SET url='https://media.maxvideoai.com/replaced.mov' WHERE asset_id='legacy-source'");
    await assert.rejects(confirmMobileAudioQuote(owner, approval, excluded), {code:'REFERENCE_INVALID'});
    await db.pool.query("UPDATE user_assets SET url=$1 WHERE asset_id='legacy-source'",[original]);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM app_receipts WHERE job_id=$1',[quote.quoteId])).rows[0].n, 0);
  }
  let runs = 0;
  const confirm = {
    listCapabilities: caps,
    executeRun: async (run: ReservedAudioRun) => {
      runs++;
      await completeAudioJob(run.jobId, {
        progress: 100,
        message: 'Ready',
        audioUrl: 'https://media.maxvideoai.com/audio/test.mp3',
      });
    },
  };
  const requests = [
    {
      mode: 'voice_only',
      engineId: 'audio-voice-only',
      prompt: '',
      settings: {
        script: 'Une voix raconte une histoire.',
        voiceModel: 'eleven-v4',
        elevenVoiceId: 'CwhRBWXzGAHq8TQ4Fs17',
      },
    },
    {
      mode: 'music_only',
      engineId: 'audio-music-only',
      prompt: 'An instrumental nocturne for piano.',
      settings: { musicModel: 'clip', mood: 'dreamy', durationSec: 30 },
    },
    {
      mode: 'sfx_only',
      engineId: 'audio-sfx-only',
      prompt: 'A clock strikes, softly.',
      settings: { durationSec: 8 },
    },
    {
      mode: 'ambience_only',
      engineId: 'audio-ambience',
      prompt: 'The sounds of a riverbank.',
      settings: { durationSec: 15 },
    },
    {
      mode: 'song',
      engineId: 'audio-song',
      prompt: 'A gentle folk song about a river.',
      settings: { lyrics: 'Flow softly toward home, carry us over the stone.' },
    },
  ].map((item) => ({ ...item, surface: 'audio' }));
  for (const invalid of [
    { ...requests[0], userId: other },
    { ...requests[0], references: [{ role: 'source_video', asset: { url: 'https://example.invalid/source' } }] },
    { ...requests[0], mode: 'cinematic' },
    { ...requests[0], settings: { ...requests[0].settings, durationSec: 10 } },
  ])
    await assert.rejects(prepareMobileAudioQuote(owner, invalid, prepare), {
      code: 'PARAMETER_INVALID',
    });
  await assert.rejects(
    prepareMobileAudioQuote(owner, requests[0], {
      listCapabilities: () => listAudioCapabilities({}),
    }),
    { code: 'ENGINE_UNAVAILABLE' },
  );
  for (const draft of requests) {
    const before = runs;
    const quote = await prepareMobileAudioQuote(owner, draft, prepare);
    assert.equal(quote.topupRequired, false);
    assert.ok(quote.price.amountCents > 0);
    assert.equal(quote.balance.beforeCents - quote.balance.afterCents, quote.price.amountCents);
    assert.equal(runs, before);
    const approve = { quoteId: quote.quoteId, confirmed: true };
    const restored = await recoverMobileAudioQuote(owner, quote.quoteId);
    assert.equal(restored.canConfirm, true);
    assert.equal(restored.job, null);
    assert.deepEqual(restored.quote.price, quote.price);
    await assert.rejects(recoverMobileAudioQuote(other, quote.quoteId), {
      code: 'QUOTE_NOT_FOUND',
    });
    await assert.rejects(recoverMobileQuote(owner, quote.quoteId), { code: 'QUOTE_NOT_FOUND' });
    await assert.rejects(
      confirmMobileAudioQuote(owner, { ...approve, confirmed: false }, confirm),
      { code: 'CONFIRMATION_REQUIRED' },
    );
    await assert.rejects(confirmMobileAudioQuote(other, approve, confirm), {
      code: 'QUOTE_EXPIRED',
    });
    await assert.rejects(confirmMobileQuote(owner, approve), { code: 'QUOTE_EXPIRED' });
    await assert.rejects(
      createConfirmAudioGenerationService('https://maxvideoai.com', confirm)(
        { quoteId: quote.quoteId, confirmed: true },
        { authMethod: 'oauth', userId: owner, clientId: 'test-client', emailVerified: true },
      ),
      { code: 'QUOTE_EXPIRED' },
    );
    const [first, replay] = await Promise.all([
      confirmMobileAudioQuote(owner, approve, confirm, new Headers({'x-maxvideoai-client-platform':'ios'})),
      confirmMobileAudioQuote(owner, approve, confirm, new Headers({'x-maxvideoai-client-platform':'ios'})),
    ]);
    assert.equal(runs, before + 1);
    assert.equal(first.jobId, replay.jobId);
    assert.deepEqual((await db.pool.query('SELECT confirmation_platform FROM mcp_generation_quotes WHERE job_id=$1 AND user_id=$2',[first.jobId,owner])).rows, [{confirmation_platform:'ios'}]);
    const completed = await recoverMobileAudioQuote(owner, quote.quoteId);
    assert.equal(completed.canConfirm, false);
    assert.equal(completed.terminal, true);
    assert.equal(completed.job?.surface, 'audio');
    assert.equal(completed.job?.status, 'completed');
    assert.match(completed.job?.url ?? '', /test\.mp3/);
    const charges = await db.pool.query(
      "SELECT amount_cents FROM app_receipts WHERE job_id=$1 AND type='charge'",
      [first.jobId],
    );
    assert.deepEqual(
      charges.rows.map((r) => r.amount_cents),
      [quote.price.amountCents],
    );
  }
  assert.equal((await listMobileJobs(owner, null, 'audio')).items.length, requests.length);
  assert.equal((await listMobileJobs(other, null, 'audio')).items.length, 0);
  const denied = await prepareMobileAudioQuote(other, requests[0], prepare);
  assert.equal(denied.topupRequired, true);
  const submit = (user: string, id: string) =>
    confirmMobileAudioQuote(user, { quoteId: id, confirmed: true }, confirm);
  const before = runs;
  await assert.rejects(submit(other, denied.quoteId), { code: 'INSUFFICIENT_FUNDS' });
  const oldQuote = await prepareMobileAudioQuote(owner, requests[0], {
    ...prepare,
    now: () => new Date(Date.now() - 3_600_000),
  });
  assert.equal((await recoverMobileAudioQuote(owner, oldQuote.quoteId)).terminal, true);
  await assert.rejects(submit(owner, oldQuote.quoteId), { code: 'QUOTE_EXPIRED' });
  const failed = await prepareMobileAudioQuote(owner, requests[0], prepare);
  const failedJob = await confirmMobileAudioQuote(
    owner,
    { quoteId: failed.quoteId, confirmed: true },
    {
      ...confirm,
      executeRun: async (run) => {
        await failAudioJob(run.jobId, { progress: 0, message: 'Offline provider failure' });
        await refundAudioCharge({ jobId: run.jobId, userId: owner });
        throw Error('Fixture');
      },
    },
  );
  assert.equal(failedJob.status, 'failed');
  assert.equal((await submit(owner, failed.quoteId)).status, 'failed');
  const amounts = await db.pool.query(
    'SELECT type,amount_cents FROM app_receipts WHERE job_id=$1 ORDER BY type',
    [failedJob.jobId],
  );
  assert.deepEqual(amounts.rows, [
    { type: 'charge', amount_cents: failed.price.amountCents },
    { type: 'refund', amount_cents: failed.price.amountCents },
  ]);
  await db.pool.query("INSERT INTO user_account_restrictions (user_id,reason) VALUES ($1,'test')", [
    owner,
  ]);
  await assert.rejects(prepareMobileAudioQuote(owner, requests[0], prepare), {
    code: 'ACCOUNT_RESTRICTED',
  });
  assert.equal(runs, before);
});
