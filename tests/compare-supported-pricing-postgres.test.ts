import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getDb } from '../frontend/src/lib/db';
import { computeCurrentPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { quotePublicModelScenario, resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { CATALOG_BY_SLUG, PRICING_ENGINES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-config';
import { resolvePricingDisplay } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-pricing';
import { confirmCustomerTariffChange, previewCustomerTariffChange } from '../frontend/server/pricing-admin/customer-tariff-service';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('comparisons quote admitted Veo durations against active tariffs without a legacy price fallback', async () => {
  const db = await startDisposablePostgres('compare-pricing');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  try {
    await db.pool.query(`CREATE TABLE app_pricing_rules (id TEXT PRIMARY KEY, engine_id TEXT, resolution TEXT, mode TEXT,
      margin_percent NUMERIC, margin_flat_cents INTEGER, surcharge_audio_percent NUMERIC, surcharge_upscale_percent NUMERIC,
      currency TEXT, compatibility_profile TEXT, vendor_account_id TEXT, effective_from TIMESTAMPTZ, updated_at TIMESTAMPTZ, updated_by UUID);
      INSERT INTO app_pricing_rules (id, margin_percent, margin_flat_cents, surcharge_audio_percent, surcharge_upscale_percent, currency)
      VALUES ('default', 0.3, 0, 0.2, 0.5, 'USD');`);
    for (const migration of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${migration}`, 'utf8'));
    }
    const amounts = { 'veo-3-1-fast': 52, 'veo-3-1-lite': 26, 'veo-3-1': 208 };
    for (const [id, amountCents] of Object.entries(amounts)) {
      const input = { modelId: id, mode: 't2v', durationSec: 4, resolution: '720p', audio: true, aspectRatio: '16:9' };
      const scenario = resolvePublicModelScenario(input)!;
      assert.ok(scenario);
      assert.equal(resolvePublicModelScenario({ ...input, durationSec: 5 }), null, 'the old five-second scenario is unsupported');
      const proposal = { operation: 'create' as const, scenarioId: scenario.id, customerCents: amountCents };
      await confirmCustomerTariffChange(proposal, (await previewCustomerTariffChange(proposal)).fingerprint,
        '11111111-1111-4111-8111-111111111111', () => {});
    }
    await db.pool.query('UPDATE app_customer_tariff_state SET active = TRUE');
    for (const [id, amountCents] of Object.entries(amounts)) {
      const engine = PRICING_ENGINES.get(id)!;
      await assert.rejects(computeCurrentPublicSnapshot({ engine, durationSec: 5, resolution: '720p' }));
      const exact = await quotePublicModelScenario({ modelId: id, mode: 't2v', durationSec: 4, resolution: '720p', audio: true, aspectRatio: '16:9' });
      assert.equal(exact.status, 'exact');
      if (exact.status !== 'exact') throw new Error('Fixture quote unavailable');
      assert.equal(exact.amountCents, amountCents);
      const display = await resolvePricingDisplay(CATALOG_BY_SLUG.get(id)!, 'en', engine);
      assert.equal(display.prices[0], amountCents / 400, id);
      assert.equal(display.scenario?.durationSec, 4);
      assert.equal(display.scenario?.audio, true);
      assert.equal(display.scenario?.aspectRatio, '16:9');
      assert.equal(display.scenario?.mode, 't2v');
      assert.equal(display.scenario?.amountCents, exact.amountCents);
      assert.deepEqual(display.priceRows, [{ resolution: '720p', unitPrice: display.headline.split(': ')[1], totalPrice: `$${(amountCents / 100).toFixed(2)}` }]);
      assert.ok(!display.secondaryLines?.length, 'missing resolution cells cannot be replaced with catalogue prices');
    }
    await db.pool.query('DELETE FROM app_customer_tariff_cell_versions; DELETE FROM app_customer_tariff_cells');
    const missing = await resolvePricingDisplay(CATALOG_BY_SLUG.get('veo-3-1-fast')!, 'fr', PRICING_ENGINES.get('veo-3-1-fast'));
    assert.equal(missing.headline, 'Prix actuel indisponible');
    assert.equal(missing.quoteUnavailable, true);
    assert.deepEqual(missing.prices, []);
    assert.equal(missing.scenario, undefined);
  } finally {
    await getDb()?.end();
    for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value;
    await db.cleanup();
  }
});
