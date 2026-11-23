import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getFalEngineById } from '@/config/falEngines';
import { enqueueKlingImageV4 } from '@/server/images/kling-image-v4-queue';
import { submitFalQueueOnce } from '@/lib/fal-queue-submit';
import { resolveFalJobQueue } from '@/server/fal-job-queue';
import { getDb, withDbTransaction } from '@/lib/db';
import { KLING_IMAGE_V4_ID, KLING_IMAGE_V4_RESOLUTIONS } from '@/lib/image/kling-image-v4';
import { klingImageV4QuantityTariffSelector } from '@/lib/image/kling-image-v4-pricing';
import { collectSellableManualTariffCoverage } from '@/lib/pricing-audit/manual-tariff-coverage';
import { estimateImageGeneration } from '@/server/images/estimate-image-generation';
import { resolveImageGenerationPricingSnapshot } from '@/server/images/image-generation-pricing';
import { priceCanonicalGenerationInExecutor } from '@/server/agent-api/generation-pricing';
import { quotePublicModelScenario, resolvePublicModelScenario } from '@/server/pricing/quote-public-model-scenario';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

test('Kling Image prices count the same outputs and owned references in all readers', async () => {
  const engine = getFalEngineById(KLING_IMAGE_V4_ID)!.engine;
  const { scenarios } = collectSellableManualTariffCoverage({modelId: engine.id});
  assert.equal(scenarios.length, 330);
  const classes = new Map(scenarios.map(({selector}) => {
    const tier = klingImageV4QuantityTariffSelector(selector);
    return [JSON.stringify(Object.entries(tier).sort(([a], [b]) => a.localeCompare(b))), tier];
  }));
  assert.equal(classes.size, 6);

  const db = await startDisposablePostgres('kimgv4');
  const original = {DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX};
  Object.assign(process.env, {DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1'});
  try {
    await createPaidGenerationTestSchema(db.pool);
    for (const migration of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${migration}`, 'utf8'));
    }
    await db.pool.query('UPDATE app_customer_tariff_state SET active = TRUE, revision = 1');

    for (const [index, resolution] of KLING_IMAGE_V4_RESOLUTIONS.entries()) {
      const outputListMilliUsd = [63, 94, 157][index]!;
      for (const mode of ['t2i', 'i2i'] as const) {
        for (const [outputCount, references] of [[1, 1], [3, 1], [1, 10], [10, 10]] as const) {
          const inputCount = mode === 'i2i' ? references : 0;
          const listMilliUsd = outputListMilliUsd * outputCount + 3 * inputCount;
          const expected = Math.ceil(listMilliUsd * 3 / 20);
          const estimated = await estimateImageGeneration({
            engineId: engine.id, mode, resolution, aspectRatio: '21:9', numImages: outputCount,
            referenceImageCount: inputCount,
          });
          const generated = await resolveImageGenerationPricingSnapshot({
            engine, mode, durationSec: outputCount, resolution,
            customImageSize: null, quality: null, combinedImageCount: inputCount, enableWebSearch: false,
            numImages: outputCount, billingProductKey: null, billingQuantityMultiplier: 1,
            jobSurface: 'image', source: undefined, metadata: null, includedKlingFirstFrameParentJobId: null,
            resolvedAspectRatio: '21:9', trustedQuotedBilling: undefined,
            customerTariffRevision: String(estimated.pricing.meta?.customerTariffRevision),
          });
          const settled = await withDbTransaction(executor => priceCanonicalGenerationInExecutor({
            schemaVersion: 1, surface: 'image', engineId: engine.id, mode, prompt: 'Catalog photos of the same lamp',
            outputCount, settings: {resolution, aspectRatio: '21:9'},
            references: Array.from({length: inputCount}, (_, slot) => ({
              kind: 'asset' as const, assetId: `local-${slot}`, role: 'reference' as const, slot,
            })),
          }, 'member', {executor, candidate: {engine, surface: 'image'} as never}));
          const publicQuote = await quotePublicModelScenario({
            modelId: engine.id, mode, resolution, durationSec: outputCount, referenceImageCount: inputCount,
          });
          assert.equal(publicQuote.status, 'exact');
          assert.equal(publicQuote.status === 'exact' && publicQuote.amountCents, expected);
          for (const snapshot of [estimated.pricing, generated.pricing, settled.pricingSnapshot]) {
            assert.equal(snapshot.totalCents, expected, `${mode}/${resolution}/${outputCount}`);
            assert.equal(snapshot.meta?.customerTariffRevision, 1);
            assert.equal(snapshot.meta?.input_image_count, inputCount);
            assert.equal(snapshot.meta?.output_image_count, outputCount);
            assert.equal(snapshot.meta?.image_result_type, outputCount === 1 ? 'single' : 'series');
            assert.equal(snapshot.meta?.providerCostListUsd, listMilliUsd / 1000);
            assert.equal(snapshot.meta?.providerCostKind, 'published_list_estimate');
            assert.equal(snapshot.meta?.effective_supplier_charge_verified, false);
          }
        }
      }
    }
    const invalid = {modelId: engine.id, mode: 'i2i', resolution: '8K', durationSec: 1};
    assert.equal(resolvePublicModelScenario({...invalid, referenceImageCount: 11}), null);
    assert.equal(resolvePublicModelScenario({...invalid, durationSec: 11}), null);
    assert.equal(resolvePublicModelScenario({...invalid, resolution: '1080p'}), null);
    await assert.rejects(estimateImageGeneration({engineId: engine.id, mode: 't2i', resolution: '8K', numImages: 2.5}), /invalid_parameter/iu);
    await db.pool.query(`CREATE TABLE fal_queue_log (id bigserial PRIMARY KEY, job_id text, provider text,
      provider_job_id text, engine_id text, status text, payload jsonb, created_at timestamptz DEFAULT NOW())`);
    await db.pool.query(`INSERT INTO app_jobs (job_id,user_id,engine_id,status,settings_snapshot,provisional)
      VALUES ('img_kling_queue','owner',$1,'queued','{"core":{"numImages":2}}',TRUE)`, [engine.id]);
    const queueRoot = 'https://queue.fal.run/kling/v4/requests/local-request-id';
    let submits = 0;
    const observedIds: string[] = [];
    await enqueueKlingImageV4({
      jobId: 'img_kling_queue', userId: 'owner', endpoint: 'kling/v4/image-to-image',
      input: {resolution: '8K', result_type: 'series', series_amount: 2},
      onRequestId: requestId => { observedIds.push(requestId); },
    }, {submit: (endpoint, input, jobId, _fetch, accept) => submitFalQueueOnce(endpoint, input, jobId, async (url, options) => {
      submits += 1;
      assert.equal(new URL(url).pathname, '/kling/v4/image-to-image');
      assert.equal(options?.method, 'POST');
      return Response.json({
        request_id: 'local-request-id', status_url: queueRoot + '/status', response_url: queueRoot, cancel_url: queueRoot + '/cancel',
      });
    }, accept)});
    assert.equal(submits, 1);
    assert.deepEqual(observedIds, ['local-request-id']);
    const {rows: acceptedJobs} = await db.pool.query(`SELECT provider_job_id, provisional, settings_snapshot
      FROM app_jobs WHERE job_id = 'img_kling_queue'`);
    assert.equal(acceptedJobs[0].provider_job_id, 'local-request-id');
    assert.equal(acceptedJobs[0].provisional, false);
    const queue = await resolveFalJobQueue({jobId: 'img_kling_queue', engineId: engine.id,
      requestId: acceptedJobs[0].provider_job_id, legacyModel: 'unused'}, {
      client: {} as never,
      fetchFn: async (url, options) => {
        assert.equal(url, queueRoot);
        assert.equal(options?.method, 'GET');
        return Response.json({images: [{url: 'https://example.invalid/output-1.png'}, {url: 'https://example.invalid/output-2.png'}]});
      },
    });
    assert.deepEqual(await queue.result(), {requestId: 'local-request-id', data: {images: [
      {url: 'https://example.invalid/output-1.png'}, {url: 'https://example.invalid/output-2.png'},
    ]}});

    await db.pool.query('UPDATE app_customer_tariff_state SET active = FALSE');
    await assert.rejects(estimateImageGeneration({engineId: engine.id, mode: 'i2i', resolution: '8K', referenceImageCount: 1}), /tariff/iu);
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
