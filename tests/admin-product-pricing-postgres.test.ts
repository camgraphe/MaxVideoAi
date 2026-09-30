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
      INSERT INTO app_billing_products VALUES
        ('character-final','character','Character Final','USD','image',15,true,NULL),
        ('angle-flux-single','angle','Angle FLUX Single','USD','run',4,true,NULL),
        ('angle-flux-multi','angle','Angle FLUX Multi','USD','run',24,true,NULL),
        ('angle-qwen-single','angle','Angle Qwen Single','USD','run',7,true,NULL),
        ('angle-qwen-multi','angle','Angle Qwen Multi','USD','run',40,true,NULL);
      ALTER ROLE postgres SET default_transaction_read_only = on;`);
    process.env.DATABASE_URL = database.databaseUrl;
    invalidateBillingProductsCache();
    const before = await loadAdminProductPricing(10);
    assert.equal(before.rows.find((row) => row.id === 'character-draft')?.totalCents, 8);
    assert.equal(before.rows.find((row) => row.id === 'audio:voice_only:0')?.totalCents, 5);
    // Catalogue costs are independent of fixed retail prices, including multi-angle provider calls.
    for (const [id, supplierCents, totalCents] of [
      ['character-draft', 8, 8], ['character-final', 15, 15],
      ['angle-flux-single', 2.1, 4], ['angle-flux-multi', 8.4, 24],
      ['angle-qwen-single', 3.5, 7], ['angle-qwen-multi', 14, 40],
    ] as const) {
      const row = before.rows.find((item) => item.id === id)!;
      assert.equal(row.supplierCents, supplierCents, id);
      assert.equal(row.totalCents, totalCents, id);
      assert.equal(row.supplierBasis, 'catalogue', id);
      assert.ok(row.notes.some((note) => /contract and invoice unconfirmed/i.test(note)), id);
    }
    assert.match(before.rows.find((row) => row.id === 'character-final')!.scenario, /2K/);
    assert.match(before.rows.find((row) => row.id === 'character-draft')!.notes.join(' '), /Nano Banana 2.*Google Vertex/);
    assert.match(before.rows.find((row) => row.id === 'angle-flux-multi')!.scenario, /4 images.*1 MP/);
    assert.match(before.rows.find((row) => row.id === 'angle-qwen-single')!.notes.join(' '), /Qwen.*Fal/);
    for (const [id, cents] of [['storyboard:hd', 4], ['storyboard:4k', 11], ['storyboard:ultra', 41],
      ['storyboard_edit:hd', 4], ['storyboard_edit:4k', 11], ['storyboard_edit:ultra', 41]] as const) {
      const row = before.rows.find((item) => item.id === id)!;
      assert.equal(row.supplierCents, cents);
      assert.match(row.notes.join(' '), /GPT Image 2.*Fal/);
    }
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
    assert.equal(after.rows.find((row) => row.id === 'character-draft')?.supplierCents, 8, 'retail edits never reprice supplier evidence');
    const audio = await computeCurrentAudioSnapshot({ pack: 'voice_only', durationSec: 10 });
    assert.equal(after.rows.find((row) => row.id === 'audio:voice_only:0')?.totalCents, audio.totalCents);
    assert.equal(audio.totalCents, 305);
    const publicRows = await buildCurrentOtherPricing(buildPricingHubData('en').otherSurfaces, 'en');
    assert.match(publicRows.toolRows.find((row) => row.id === 'character-builder-draft')!.standardOutput, /\$0\.48/);
    assert.match(publicRows.toolRows.find((row) => row.id === 'character-builder-draft')!.proOutput, /\$1\.44/);
    assert.equal(publicRows.audioRows.find((row) => row.id === 'audio-voice-only')!.thirtySeconds, '$3.10');
    const tables = (await database.pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((row) => row.tablename);
    assert.deepEqual(tables, ['app_billing_products', 'app_pricing_rules']);
    await database.pool.query("UPDATE app_billing_products SET currency='EUR' WHERE product_key='character-final'");
    invalidateBillingProductsCache();
    const foreignCurrency = (await loadAdminProductPricing(10)).rows.find((row) => row.id === 'character-final')!;
    assert.equal(foreignCurrency.currency, 'EUR');
    assert.equal(foreignCurrency.totalCents, null, 'the existing USD policy rejects an incompatible currency');
    assert.equal(foreignCurrency.supplierCents, null, 'USD evidence cannot be compared as EUR');
    await database.pool.query('DROP TABLE app_pricing_rules');
    const policyOutage = await loadAdminProductPricing(10);
    const board = policyOutage.rows.find((row) => row.id === 'storyboard:4k')!;
    assert.equal(board.totalCents, null, 'current customer quote requires effective policy');
    assert.equal(board.supplierCents, 11, 'known supplier facts do not depend on the commercial policy read');
  } finally {
    if (process.env.DATABASE_URL === database.databaseUrl) await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    invalidateBillingProductsCache(); await database.cleanup();
  }
});
