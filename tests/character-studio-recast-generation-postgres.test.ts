import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres, createPaidGenerationTestSchema } from './helpers/disposable-postgres';
import { addTopup, ProviderHarness } from './helpers/mcp-paid-e2e-harness';
import { getDb } from '../frontend/src/lib/db';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { prepareRecast, confirmRecast } from '../frontend/server/character-studio/recast';
import { createCreatorGenerationService } from '../frontend/src/server/tools/creator-generation-service';
import { seedRecastPricingPolicy } from './helpers/character-recast-harness';

test('Recast binds both independently trimmed asset IDs and output format to one exact confirmed wallet charge', async (t) => {
  const pg = await startDisposablePostgres('character-recast');
  const old = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (old) process.env.DATABASE_URL = old;
    else delete process.env.DATABASE_URL;
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  await seedRecastPricingPolicy(pg.pool);
  for (const file of [
    '53_studio_media_generation_scope.sql',
    '69_toolbox_generation_scope.sql',
    '95_character_studio_recast_quotes.sql',
  ]) {
    await pg.pool.query(readFileSync('neon/migrations/' + file, 'utf8'));
  }
  const actor = { userId: 'recast-test', authMethod: 'toolbox-session' as const, clientId: null };
  await addTopup(pg.pool, actor.userId, 10000);
  await pg.pool.query(
    'CREATE TABLE job_outputs (id text PRIMARY KEY,job_id text,user_id text,status text,kind text,url text)',
  );
  await pg.pool.query(
    `CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text)`,
  );
  const id = (n: number) => 'ma_' + String(n).padStart(32, '0');
  for (const [n, kind, mime, duration] of [
    [1, 'image', 'image/png', null],
    [2, 'video', 'video/mp4', 25.6],
    [3, 'audio', 'audio/wav', 22],
    [4, 'video', 'video/mp4', 7.5],
    [5, 'audio', 'audio/wav', 5.25],
  ] as const) {
    await pg.pool.query(
      `INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
      VALUES($1,$1,$2,$3,$4,$5,4096,$6,$7,'ready',$8)`,
      [
        id(n),
        actor.userId,
        kind,
        'https://cdn.maxvideoai.com/' + n + { video: '.mp4', audio: '.wav', image: '.png' }[kind],
        mime,
        kind === 'audio' ? null : 720,
        kind === 'audio' ? null : 1280,
        JSON.stringify(duration ? { durationSec: duration } : {}),
      ],
    );
  }
  const provider = new ProviderHarness(pg.pool);
  const model = getFalEngineById('wan-3-prime')!;
  const runtime = {
    listPublicEngines: async () => [
      {
        engine: model.engine,
        surface: 'video' as const,
        publicModes: model.engine.modes,
        modeCaps: model.engine.modeCaps!,
      },
    ],
    resolveRequestExecutability: () => ({ executable: true, reason: 'available' as const }),
  };
  const generation: typeof createCreatorGenerationService = (actor, options) =>
    createCreatorGenerationService(actor, {
      ...options,
      prepareDependencies: { ...options.prepareDependencies, ...runtime },
      confirmDependencies: {
        ...options.confirmDependencies,
        ...runtime,
        submitPaidGeneration: provider.submit,
      },
    });
  const input = {
    portrait: { assetId: id(1) },
    direction: 'Dance',
    dialogue: 'Bonjour',
    seconds: 8,
    resolution: '1080p',
    aspectRatio: '9:16',
    video: { assetId: id(2), range: { startSec: 18, endSec: 25.5 } },
    audio: { assetId: id(3), range: { startSec: 8.25, endSec: 13.5 } },
  };
  // The real FFmpeg workers have separate byte-level tests. Substitute only their storage/encoding boundary here.
  const worker =
    (kind: 'video' | 'audio', n: number, durationSec: number) => async (owner: string, request: any) => {
      assert.equal(owner, actor.userId);
      assert.equal(request.source.assetId, input[kind].assetId);
      assert.deepEqual(request.range, input[kind].range);
      return { asset: { assetId: id(n), durationSec } } as never;
    };
  const quote = await prepareRecast(actor, input, {
    generation,
    prepareVideo: worker('video', 4, 7.5),
    prepareAudio: worker('audio', 5, 5.25),
  });
  assert.equal(quote.amountCents, 868); // 28 cents per supplier second × (7.5 input + 8 output) × 2.
  assert.equal(quote.sourceSeconds, 7.5);
  assert.equal(quote.audioSeconds, 5.25);
  assert.equal(
    (await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n,
    0,
  );
  const approval = {
    quoteId: quote.quoteId,
    confirmed: true,
    amountCents: quote.amountCents,
    currency: quote.currency,
  };
  await assert.rejects(confirmRecast(actor, { ...approval, amountCents: quote.amountCents + 1 }, generation));
  await assert.rejects(confirmRecast({ ...actor, userId: 'another' }, approval, generation));
  await assert.rejects(confirmRecast(actor, { ...approval, confirmed: false }, generation));
  const jobs = await Promise.all([
    confirmRecast(actor, approval, generation),
    confirmRecast(actor, approval, generation),
  ]);
  assert.ok(jobs.every((j) => j.jobId === quote.quoteId));
  assert.equal(provider.captures.length, 1);
  const payload = provider.captures[0].body;
  assert.equal(payload.resolution, '1080p');
  assert.equal(payload.aspectRatio, '9:16');
  assert.equal(JSON.stringify(payload).includes('https://cdn.maxvideoai.com/2.mp4'), false);
  assert.equal(JSON.stringify(payload).includes('https://cdn.maxvideoai.com/3.wav'), false);
  assert.ok(JSON.stringify(payload).includes('https://cdn.maxvideoai.com/4.mp4'));
  assert.ok(JSON.stringify(payload).includes('https://cdn.maxvideoai.com/5.wav'));
  const charges = await pg.pool.query(
    "SELECT description,amount_cents FROM app_receipts WHERE type='charge' AND job_id=$1",
    [quote.quoteId],
  );
  assert.equal(charges.rowCount, 1);
  assert.match(charges.rows[0].description, /MaxVideoAI Recast/);
  assert.equal(Number(charges.rows[0].amount_cents), quote.amountCents);
});
