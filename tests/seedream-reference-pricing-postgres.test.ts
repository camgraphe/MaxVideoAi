import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import document from '../frontend/config/customer-tariffs.json';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { resolveImageGenerationPricingSnapshot } from '../frontend/src/server/images/image-generation-pricing';
import { estimateImageGeneration } from '../frontend/src/server/images/estimate-image-generation';
import { priceCanonicalGenerationInExecutor } from '../frontend/src/server/agent-api/generation-pricing';
import { previewCustomerTariffChange } from '../frontend/server/pricing-admin/customer-tariff-service';
import { startDisposablePostgres, createPaidGenerationTestSchema } from './helpers/disposable-postgres';

test('Seedream actual billing, image estimates, MCP settlement and admin guards use all submitted sources', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-02T12:00:00Z') });
  const db = await startDisposablePostgres('srref');
  const old = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  const cells = document.cells as ManualTariffCell[];
  const original = [...cells];
  try {
    await createPaidGenerationTestSchema(db.pool);
    for (const migration of ['27_pricing_admin_cockpit.sql','54_customer_tariff_cells.sql','55_customer_tariff_versions.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${migration}`, 'utf8'));
    }
    const rows = collectSellableManualTariffCoverage().scenarios.filter(row => row.modelId === 'seedream-5-0-pro' && row.context.mode === 'i2i');
    cells.push(...rows.map((row, index) => ({ id: `seedream-ref-${index}`, source:'versioned' as const, version:1,
      currency:'USD', effectiveFrom:'2026-10-01T00:00:00Z', selector:row.selector, price:{kind:'fixed' as const, customerCents:16} })));
    await db.pool.query('UPDATE app_customer_tariff_state SET active = TRUE, revision = 1');
    const engine = getFalEngineById('seedream-5-0-pro')!.engine;
    for (const count of [1,10]) {
      const estimated = await estimateImageGeneration({ engineId:engine.id, mode:'i2i', numImages:1,
        resolution:'2K', aspectRatio:'16:9', referenceImageCount:count });
      const generated = await resolveImageGenerationPricingSnapshot({ engine, mode:'i2i', durationSec:1, resolution:'2K',
        customImageSize:null, quality:null, combinedImageCount:count, enableWebSearch:false, numImages:1,
        billingProductKey:null, billingQuantityMultiplier:1, jobSurface:'image', source:undefined, metadata:null,
        includedKlingFirstFrameParentJobId:null, resolvedAspectRatio:'16:9', trustedQuotedBilling:undefined,
        customerTariffRevision:String(estimated.pricing.meta?.customerTariffRevision) });
      const agent = await withDbTransaction(executor => priceCanonicalGenerationInExecutor({schemaVersion:1, surface:'image',
        engineId:engine.id, mode:'i2i', prompt:'local reference pricing test', outputCount:1,
        settings:{resolution:'2K', aspectRatio:'16:9'}, references:Array.from({length:count}, (_,slot) => ({kind:'asset' as const,
          assetId:`local-${slot}`, role:'reference' as const, slot})) }, 'member', { executor, candidate:{engine,surface:'image'} as never }));
      for (const snapshot of [generated.pricing, estimated.pricing, agent.pricingSnapshot]) {
        assert.equal(snapshot.totalCents, 16);
        assert.equal((snapshot.meta as { providerCostUsage: {inputImages:number} }).providerCostUsage.inputImages, count);
        assert.equal((snapshot.base as {amountCents:number}).amountCents, count === 1 ? 8.1 : 10.53);
      }
    }
    const ten = rows.find(row => row.context.referenceImageCount === 9)!;
    await assert.rejects(previewCustomerTariffChange({operation:'create', scenarioId:ten.id, customerCents:9}), /below|supplier|cost/i);
    assert.equal((await db.pool.query('SELECT count(*) FROM app_pricing_change_events')).rows[0].count, '0');
  } finally {
    cells.splice(0,cells.length,...original);
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    for (const [key,value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
