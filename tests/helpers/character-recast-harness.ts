import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { TestContext } from 'node:test';
import type { Pool } from 'pg';
import { startDisposablePostgres, createPaidGenerationTestSchema } from './disposable-postgres';
import { addTopup, ProviderHarness } from './mcp-paid-e2e-harness';
import { resolvePublicModelScenario } from '../../frontend/server/pricing/quote-public-model-scenario';
import { computeCanonicalBillingSnapshot } from '../../frontend/server/pricing/quote-billing';
import { upsertCustomerTariffCell } from '../../frontend/server/pricing/customer-tariff-store';
import { getDb, withDbTransaction } from '../../frontend/src/lib/db';
import { getFalEngineById } from '../../frontend/src/config/falEngines';
import { prepareRecast, confirmRecast } from '../../frontend/server/character-studio/recast';
import { createCreatorGenerationService } from '../../frontend/src/server/tools/creator-generation-service';
import { reservePaidGenerationInitialJob } from '../../frontend/src/server/agent-api/paid-generation-execution';

export async function seedRecastPricingPolicy(pool: Pool, marginPercent = 1) {
  await pool.query(`INSERT INTO app_pricing_rules
    (id, engine_id, mode, resolution, margin_percent, margin_flat_cents,
      surcharge_audio_percent, surcharge_upscale_percent, currency, compatibility_profile, effective_from)
    VALUES ('recast-test-policy', 'character-recast', 'recast', 'video', $1, 0, 0, 0, 'USD', 'standard', '2026-01-01')
    ON CONFLICT (id) DO UPDATE SET margin_percent=EXCLUDED.margin_percent, updated_at=clock_timestamp()`, [marginPercent]);
}

export async function recastHarness(t: TestContext, options: {userId?:string} = {}) {
  const pg = await startDisposablePostgres('character-recast');
  const old = {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    PRICING_SANDBOX: process.env.PRICING_SANDBOX,
  };
  Object.assign(process.env, { NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
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
  await pg.pool.query(readFileSync('neon/migrations/27_pricing_admin_cockpit.sql', 'utf8'));
  for (const file of ['54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql'])
    await pg.pool.query(readFileSync('neon/migrations/' + file, 'utf8'));
  // Seed a deterministic reviewed test grid through the real append-only tariff owner.
  // No live tariff, account, or provider is read or modified.
  let cell = 0;
  for (const mode of ['i2v', 'ref2v', 'v2v'])
    for (const resolution of ['480p', '720p', '1080p']) {
      for (const seconds of [2, 8, 15])
        for (const source of mode === 'v2v' ? [7.5, 15] : [0]) {
          const scenario = resolvePublicModelScenario({
            modelId: 'wan-3-prime',
            mode,
            resolution,
            durationSec: seconds,
            aspectRatio: '9:16',
            ...(mode !== 'i2v' ? { inputVideoDurationSec: source } : {}),
          });
          assert.ok(scenario);
          const baseline = await computeCanonicalBillingSnapshot(scenario.context);
          await withDbTransaction((tx) =>
            upsertCustomerTariffCell(
              tx,
              {
                id: 'recast-test-' + ++cell,
                selector: scenario.selector,
                currency: 'USD',
                source: 'database',
                version: 1,
                effectiveFrom: '2026-01-01T00:00:00Z',
                price: { kind: 'fixed', customerCents: baseline.totalCents },
              },
              '11111111-1111-4111-8111-111111111111',
            ),
          );
        }
    }
  await pg.pool.query('UPDATE app_customer_tariff_state SET active=TRUE');
  const actor = {
    userId: options.userId ?? 'recast-test',
    authMethod: 'toolbox-session' as const,
    clientId: null,
  };
  await addTopup(pg.pool, actor.userId, 100000);
  await pg.pool.query(
    'CREATE TABLE job_outputs (id text PRIMARY KEY,job_id text,user_id text,status text,kind text,url text)',
  );
  await pg.pool.query(
    `CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text)`,
  );
  const id = (n: number) => 'ma_' + String(n).padStart(32, '0');
  for (const [n, kind, mime, duration] of [
    [9, 'image', 'image/png', null],
    [1, 'image', 'image/png', null],
    [6, 'video', 'video/mp4', 15],
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
    resolveRequestExecutability: () => ({
      executable: true,
      reason: 'available' as const,
    }),
  };
  let prepareNow: (() => Date) | undefined;
  let legacyModelPricing = false;
  const generation: typeof createCreatorGenerationService = (actor, options) =>
    createCreatorGenerationService(actor, {
      ...options,
      // Reproduce the pre-product adapter with the real model tariff owner for historical quotes.
      ...(legacyModelPricing ? { billingProduct: undefined } : {}),
      prepareDependencies: {
        ...options.prepareDependencies,
        ...runtime,
        ...(prepareNow ? { now: prepareNow } : {}),
      },
      confirmDependencies: {
        ...options.confirmDependencies,
        ...runtime,
        submitPaidGeneration: provider.submit,
        ...(legacyModelPricing ? { reserveInitialJob: (input, dependencies) =>
          reservePaidGenerationInitialJob({ ...input, customerProductLabel: 'MaxVideoAI Recast' }, dependencies) } : {}),
      },
    });

  const input = {
    portrait: { assetId: id(9) },
    direction: 'Dance',
    dialogue: '',
    seconds: 8,
    resolution: '720p',
    aspectRatio: '9:16',
  };
  const video = { assetId: id(2), range: { startSec: 18, endSec: 25.5 } };
  const audio = { assetId: id(3), range: { startSec: 8.25, endSec: 13.5 } };
  const deps = {
    generation,
    prepareVideo: async (_owner: string, request: any) => {
      assert.equal(request.source.assetId, id(2));
      const durationSec = request.range.endSec - request.range.startSec;
      assert.ok(durationSec === 7.5 || durationSec === 15);
      return {
        asset: { assetId: id(durationSec === 15 ? 6 : 4), durationSec },
      } as never;
    },
    prepareAudio: async (_owner: string, request: any) => {
      assert.equal(request.source.assetId, id(3));
      assert.deepEqual(request.range, audio.range);
      return { asset: { assetId: id(5), durationSec: 5.25 } } as never;
    },
  };
  const prepare = (changes: Record<string, unknown> = {}) =>
    prepareRecast(actor, { ...input, ...changes }, deps);
  const approval = (quote: Awaited<ReturnType<typeof prepare>>) => ({
    quoteId: quote.quoteId,
    amountCents: quote.amountCents,
    currency: quote.currency,
    confirmed: true,
  });
  const confirm = (quote: Awaited<ReturnType<typeof prepare>>) =>
    confirmRecast(actor, approval(quote), generation);
  const receipts = async (jobId: string) =>
    (
      await pg.pool.query(
        'SELECT type, amount_cents, description, pricing_snapshot FROM app_receipts WHERE job_id=$1 ORDER BY type',
        [jobId],
      )
    ).rows;
  return {
    setPrepareNow: (now?: () => Date) => {
      prepareNow = now;
    },
    setLegacyModelPricing: (legacy: boolean) => { legacyModelPricing = legacy; },
    setRecastMargin: (marginPercent: number) => seedRecastPricingPolicy(pg.pool, marginPercent),
    runtime,
    pg,
    actor,
    provider,
    generation,
    input,
    video,
    audio,
    id,
    deps,
    prepare,
    confirm,
    approval,
    receipts,
  };
}
