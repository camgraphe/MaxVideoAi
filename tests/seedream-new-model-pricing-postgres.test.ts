import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { resolveImageGenerationPricingSnapshot } from '../frontend/src/server/images/image-generation-pricing';
import { estimateImageGeneration } from '../frontend/src/server/images/estimate-image-generation';
import { priceCanonicalGenerationInExecutor } from '../frontend/src/server/agent-api/generation-pricing';
import { quotePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { previewCustomerTariffChange } from '../frontend/server/pricing-admin/customer-tariff-service';
import { startDisposablePostgres, createPaidGenerationTestSchema } from './helpers/disposable-postgres';

test('new Seedream web billing, image estimates, MCP settlement and current public quotes agree on PostgreSQL', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-13T12:00:00Z') });
  const db = await startDisposablePostgres('srnew');
  const original = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV,
    PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  try {
    await createPaidGenerationTestSchema(db.pool);
    for (const migration of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${migration}`, 'utf8'));
    }
    await db.pool.query('UPDATE app_customer_tariff_state SET active = TRUE, revision = 1');
    for (const id of ['seedream-5-5', 'seedream-5-0-flash'] as const) {
      const engine = getFalEngineById(id)!.engine;
      for (const resolution of ['1K', '1.5K', '2K']) for (const count of [1, 10]) {
        const expected = id === 'seedream-5-0-flash' ? 3 : resolution === '2K' ? count === 1 ? 6 : 16 : count === 1 ? 4 : 13;
        const estimated = await estimateImageGeneration({ engineId: id, mode: 'i2i', numImages: 1,
          resolution, aspectRatio: '16:9', referenceImageCount: count });
        const generated = await resolveImageGenerationPricingSnapshot({ engine, mode: 'i2i', durationSec: 1, resolution,
          customImageSize: null, quality: null, combinedImageCount: count, enableWebSearch: false, numImages: 1,
          billingProductKey: null, billingQuantityMultiplier: 1, jobSurface: 'image', source: undefined, metadata: null,
          includedKlingFirstFrameParentJobId: null, resolvedAspectRatio: '16:9', trustedQuotedBilling: undefined,
          customerTariffRevision: String(estimated.pricing.meta?.customerTariffRevision) });
        const settled = await withDbTransaction(executor => priceCanonicalGenerationInExecutor({ schemaVersion: 1,
          surface: 'image', engineId: id, mode: 'i2i', prompt: 'Disposable source-count parity check', outputCount: 1,
          settings: { resolution, aspectRatio: '16:9' }, references: Array.from({ length: count }, (_, slot) => ({
            kind: 'asset' as const, assetId: `local-${slot}`, role: 'reference' as const, slot,
          })) }, 'member', { executor, candidate: { engine, surface: 'image' } as never }));
        const publicQuote = await quotePublicModelScenario({ modelId: id, mode: 'i2i', durationSec: 1,
          resolution, aspectRatio: '16:9', referenceImageCount: count - 1 });
        assert.equal(publicQuote.status, 'exact');
        assert.equal(publicQuote.status === 'exact' ? publicQuote.amountCents : null, expected);
        for (const snapshot of [generated.pricing, estimated.pricing, settled.pricingSnapshot]) {
          assert.equal(snapshot.totalCents, expected, `${id}:${resolution}:${count}`);
          assert.equal(snapshot.meta?.providerCostKind, 'published_list_estimate');
          assert.equal(snapshot.meta?.providerCostContract, undefined);
          assert.equal((snapshot.meta?.providerCostUsage as { inputImages: number }).inputImages, count);
          assert.equal(snapshot.meta?.customerTariffRevision, 1);
          const sourceUsd = id === 'seedream-5-0-flash' ? 0.018 : Number(((resolution === '2K' ? 0.035 : 0.020) + count * 0.008).toFixed(6));
          assert.equal(snapshot.meta?.providerCostListUsd, sourceUsd);
        }
      }
    }
    const tenSourceScenario = collectSellableManualTariffCoverage({ modelId: 'seedream-5-5', mode: 'i2i' })
      .scenarios.find(row => row.selector.resolution === '2K' && row.selector.inputImageCount === '10')!;
    await assert.rejects(previewCustomerTariffChange({ operation: 'create', scenarioId: tenSourceScenario.id,
      customerCents: 11 }), /below|supplier|cost/i);
    assert.equal((await db.pool.query('SELECT count(*) FROM app_pricing_change_events')).rows[0].count, '0');
    assert.equal((await db.pool.query('SELECT count(*) FROM app_jobs')).rows[0].count, '0');

    await db.pool.query('UPDATE app_customer_tariff_state SET active = FALSE');
    for (const id of ['seedream-5-5', 'seedream-5-0-flash'] as const) {
      await assert.rejects(estimateImageGeneration({ engineId: id, mode: 't2i', numImages: 1,
        resolution: '2K', aspectRatio: '1:1' }), /tariff/i);
      assert.equal((await quotePublicModelScenario({ modelId: id, mode: 't2i', durationSec: 1, resolution: '2K' })).status,
        'unavailable');
    }
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
