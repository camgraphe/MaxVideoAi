import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage.ts';
import { confirmCustomerTariffChange, loadCustomerTariffScenarioDetail,
  previewCustomerTariffChange } from '../frontend/server/pricing-admin/customer-tariff-service.ts';
import { getDb } from '../frontend/src/lib/db.ts';
import { startDisposablePostgres } from './helpers/disposable-postgres.ts';

test('live admin edits, stale preview rejection and rollback keep append-only tariff history', async () => {
  const db = await startDisposablePostgres('active-admin-tariff');
  const old = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  const actor = '11111111-1111-4111-8111-111111111111';
  try {
    await db.pool.query(`CREATE TABLE app_pricing_rules (
      id TEXT PRIMARY KEY, engine_id TEXT, resolution TEXT, mode TEXT,
      margin_percent NUMERIC, margin_flat_cents INTEGER, surcharge_audio_percent NUMERIC,
      surcharge_upscale_percent NUMERIC, currency TEXT, compatibility_profile TEXT,
      vendor_account_id TEXT, effective_from TIMESTAMPTZ, updated_at TIMESTAMPTZ, updated_by UUID);
      INSERT INTO app_pricing_rules (id, margin_percent, margin_flat_cents, surcharge_audio_percent,
        surcharge_upscale_percent, currency) VALUES ('default', 0.3, 0, 0.2, 0.5, 'USD');`);
    for (const migration of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${migration}`, 'utf8'));
    }
    const scenario = collectSellableManualTariffCoverage().scenarios.find((row) => row.modelId === 'pika-text-to-video' &&
      row.selector.mode === 't2v' && row.selector.durationSec === '5' && row.selector.resolution === '720p')!;
    assert.ok(scenario);
    const seed = { operation: 'create' as const, scenarioId: scenario.id, customerCents: 26 };
    await confirmCustomerTariffChange(seed, (await previewCustomerTariffChange(seed)).fingerprint, actor);
    await db.pool.query('UPDATE app_customer_tariff_state SET active = TRUE');
    const update = { operation: 'update' as const, scenarioId: scenario.id, customerCents: 31 };
    const preview = await previewCustomerTariffChange(update);
    assert.equal(preview.active, true);
    assert.equal(preview.currentCents, 26);
    const result = await confirmCustomerTariffChange(update, preview.fingerprint, actor);
    const current = await loadCustomerTariffScenarioDetail(scenario.modelId, { ...scenario.selector });
    assert.equal(current.currentCents, 31);
    assert.equal(current.stagedCents, 31);
    await assert.rejects(confirmCustomerTariffChange(update, preview.fingerprint, actor), /preview changed/i);
    const rollback = { operation: 'rollback' as const, scenarioId: scenario.id, eventId: result.event.id };
    const restore = await previewCustomerTariffChange(rollback);
    assert.equal(restore.proposedCents, 26);
    await confirmCustomerTariffChange(rollback, restore.fingerprint, actor);
    assert.equal((await loadCustomerTariffScenarioDetail(scenario.modelId, { ...scenario.selector })).currentCents, 26);
    assert.equal((await db.pool.query('SELECT count(*) FROM app_customer_tariff_cell_versions')).rows[0].count, '2');
    await assert.rejects(db.pool.query('DELETE FROM app_customer_tariff_cell_versions'), /immutable/i);
    await assert.rejects(previewCustomerTariffChange({ operation: 'delete', scenarioId: scenario.id }), /cannot be deleted/i);
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
