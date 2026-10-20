import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { tariffReaderActor, tariffSelectorKey, withTariffReaderFixture } from './helpers/customer-tariff-reader-fixture';
import { ensureMediaLibrarySchema } from '../frontend/src/lib/schema/media-library-schema';
import { ensureAssetSchema } from '../frontend/src/lib/schema/asset-schema';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';

test('real PG17 adaptive quotes follow current reordered tariffs and refuse a missing reachable ratio', async () => {
  await withTariffReaderFixture(async ({ database }) => {
    const engine = getFalEngineById('seedance-2-0')!.engine;
    for (const [index, aspectRatio] of ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'].entries()) {
      const selector = { engineId: engine.id, mode: 't2v', resolution: '480p', durationSec: '15', aspectRatio, billingInputType: 'no_video_input' };
      await database.pool.query(`INSERT INTO app_customer_tariff_cells
        (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
        VALUES ($1,$2,$3,$4,'USD','2026-01-01',17,$5)`,
      [`aspect-${index}`, tariffSelectorKey(selector), selector, { kind: 'fixed', customerCents: 5000 + index }, tariffReaderActor]);
    }
    await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=17');
    const context = { engine, mode: 't2v' as const, durationSec: 4, durationOption: 'auto', resolution: '480p', aspectRatio: 'auto', hasVideoInput: false };
    const dependencies = { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded' as const, rules: [] }) } };
    assert.equal((await computeCanonicalBillingSnapshot(context, dependencies)).totalCents, 5005);
    await database.pool.query(`UPDATE app_customer_tariff_cells SET price_json='{"kind":"fixed","customerCents":5500}' WHERE id='aspect-3'`);
    await database.pool.query('UPDATE app_customer_tariff_state SET revision=18');
    const quote = await computeCanonicalBillingSnapshot(context, dependencies);
    assert.equal(quote.totalCents, 5500);
    assert.equal(quote.meta?.customerTariffRevision, 18);
    assert.equal(quote.meta?.customerTariffCellId, 'aspect-3');
    await database.pool.query(`DELETE FROM app_customer_tariff_cells WHERE id='aspect-0'`);
    await assert.rejects(computeCanonicalBillingSnapshot(context, dependencies), error => (error as { code?: string }).code === 'missing_cell');
  });
});

test('real owned media metadata supplies adaptive framing while another owner and arbitrary framing cannot quote', async () => {
  await withTariffReaderFixture(async ({ database }) => {
    await ensureMediaLibrarySchema();
    await ensureAssetSchema();
    const engine = getFalEngineById('seedance-2-0')!.engine;
    const sourceUrl = 'https://cdn.maxvideoai.com/owned/first-frame.jpg';
    await database.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,source,status,metadata)
      VALUES ('first-internal','ma_11111111111111111111111111111111','source-owner','image',$1,'image/jpeg',1000,1080,1920,'upload','ready',
      '{"originalName":"first-frame.jpg"}')`, [sourceUrl]);
    const selector = { engineId: engine.id, mode: 'i2v', resolution: '480p', durationSec: '15', aspectRatio: '9:16', billingInputType: 'no_video_input' };
    await database.pool.query(`INSERT INTO app_customer_tariff_cells
      (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      VALUES ('owned-framing',$1,$2,'{"kind":"fixed","customerCents":5000}','USD','2026-01-01',17,$3)`,
    [tariffSelectorKey(selector), selector, tariffReaderActor]);
    await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=17');
    const request = { engine: engine.id, mode: 'i2v' as const, durationSec: 4, durationOption: 'auto', resolution: '480p' as const,
      aspectRatio: 'auto' as const, fps: 24, inputs: [{ kind: 'image' as const, assetId: 'first-internal', slotId: 'image_url', url: sourceUrl }] };
    const dependencies = { getConfiguredEngineFn: async () => engine };
    const allowed = await resolveMediaAwarePreflight({ request, userId: 'source-owner' }, dependencies);
    assert.equal(allowed.ok, true, JSON.stringify(allowed));
    assert.equal(allowed.pricing?.totalCents, 5000);
    assert.equal(allowed.pricing?.meta?.billed_aspect_ratio, '9:16');
    assert.equal(allowed.pricing?.meta?.seedanceAutomaticPricing !== undefined, true);
    assert.equal((await resolveMediaAwarePreflight({ request, userId: 'another-owner' }, dependencies)).ok, false);
    await database.pool.query(`UPDATE media_assets SET width=1200,height=1000 WHERE id='first-internal'`);
    assert.equal((await resolveMediaAwarePreflight({ request, userId: 'source-owner' }, dependencies)).ok, false);
  });
});
