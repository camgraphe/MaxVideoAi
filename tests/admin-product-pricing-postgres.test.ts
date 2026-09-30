import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';
import { invalidateBillingProductsCache } from '../frontend/src/lib/billing-products';
import { loadAdminProductPricing } from '../frontend/server/pricing-admin/product-pricing-inventory';
import { buildCurrentOtherPricing } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/current-other-pricing';
import { buildPricingHubData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData';
import { computeCurrentAudioSnapshot } from '../frontend/server/pricing/quote-public';

test('central admin and public rows read changed product/audio prices without any request-time schema writes', async () => {
  const database = await startDisposablePostgres('prices');
  const previousUrl = process.env.DATABASE_URL;
  try {
    const facts = (await database.pool.query("SELECT current_setting('listen_addresses') AS listeners, current_setting('unix_socket_directories') AS socket")).rows[0];
    assert.equal(facts.listeners, '');
    assert.ok(facts.socket.includes('/prices-'));
    await database.pool.query(`CREATE TABLE app_pricing_rules (id text PRIMARY KEY, engine_id text, mode text, resolution text,
      margin_percent numeric, margin_flat_cents int, surcharge_audio_percent numeric, surcharge_upscale_percent numeric,
      currency text, compatibility_profile text, vendor_account_id text, effective_from timestamptz, updated_at timestamptz, updated_by uuid);
      INSERT INTO app_pricing_rules (id, margin_percent, margin_flat_cents, currency) VALUES ('default',0.3,0,'USD');
      CREATE TABLE app_billing_products(product_key text PRIMARY KEY, surface text, label text, currency text, unit_kind text,
      unit_price_cents int, active boolean, metadata jsonb);
      INSERT INTO app_billing_products VALUES ('character-draft','character','Character Draft','USD','image',8,true,NULL);
      ALTER ROLE postgres SET default_transaction_read_only = on;`);
    process.env.DATABASE_URL = database.databaseUrl;
    invalidateBillingProductsCache();
    const before = await loadAdminProductPricing(10);
    assert.equal(before.rows.find((row) => row.id === 'character-draft')?.totalCents, 8);
    assert.equal(before.rows.find((row) => row.id === 'audio:voice_only:0')?.totalCents, 5);
    assert.equal(before.rows.find((row) => row.id === 'character-draft')?.supplierCents, null);
    assert.equal(before.rows.find((row) => row.id === 'audio:song:0')?.unit, 'song');
    assert.deepEqual(before.rows.find((row) => row.id === 'audio:voice_only:0')?.policySelector,
      { engineId: 'audio-generation', mode: 'voice_only', resolution: 'audio' });
    // Fixture changes are confined to this disposable socket-only database.
    await database.pool.query(`UPDATE app_billing_products SET unit_price_cents=48 WHERE product_key='character-draft';
      INSERT INTO app_pricing_rules (id,engine_id,mode,margin_percent,margin_flat_cents,currency)
      VALUES ('voice-price','audio-generation','voice_only',0,300,'USD');`);
    invalidateBillingProductsCache();
    const after = await loadAdminProductPricing(10);
    assert.equal(after.rows.find((row) => row.id === 'character-draft')?.totalCents, 48);
    const audio = await computeCurrentAudioSnapshot({ pack: 'voice_only', durationSec: 10 });
    assert.equal(after.rows.find((row) => row.id === 'audio:voice_only:0')?.totalCents, audio.totalCents);
    assert.equal(audio.totalCents, 305);
    const publicRows = await buildCurrentOtherPricing(buildPricingHubData('en').otherSurfaces, 'en');
    assert.match(publicRows.toolRows.find((row) => row.id === 'character-builder-draft')!.standardOutput, /\$0\.48/);
    assert.match(publicRows.toolRows.find((row) => row.id === 'character-builder-draft')!.proOutput, /\$1\.44/);
    assert.equal(publicRows.audioRows.find((row) => row.id === 'audio-voice-only')!.thirtySeconds, '$3.10');
    const tables = (await database.pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((row) => row.tablename);
    assert.deepEqual(tables, ['app_billing_products', 'app_pricing_rules']);
  } finally {
    if (process.env.DATABASE_URL === database.databaseUrl) await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    invalidateBillingProductsCache(); await database.cleanup();
  }
});
