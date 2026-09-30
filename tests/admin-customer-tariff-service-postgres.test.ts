import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage.ts';
import { confirmCustomerTariffChange, loadCustomerTariffHistory,
  previewCustomerTariffChange, loadCustomerTariffScenarioDetail } from '../frontend/server/pricing-admin/customer-tariff-service.ts';
import { getDb } from '../frontend/src/lib/db.ts';
import { startDisposablePostgres } from './helpers/disposable-postgres.ts';

test('admin tariff preview, stale rejection and confirmation are atomic on disposable PostgreSQL', async () => {
  const db = await startDisposablePostgres('admin-customer-tariff');
  const oldUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  try {
    await db.pool.query(`
      CREATE TABLE app_pricing_rules (
        id TEXT PRIMARY KEY, engine_id TEXT, resolution TEXT, mode TEXT,
        margin_percent NUMERIC, margin_flat_cents INTEGER,
        surcharge_audio_percent NUMERIC, surcharge_upscale_percent NUMERIC,
        currency TEXT, compatibility_profile TEXT, vendor_account_id TEXT,
        effective_from TIMESTAMPTZ, updated_at TIMESTAMPTZ, updated_by UUID
      );
      INSERT INTO app_pricing_rules (id, margin_percent, margin_flat_cents,
        surcharge_audio_percent, surcharge_upscale_percent, currency)
      VALUES ('default', 0.3, 0, 0.2, 0.5, 'USD');
      CREATE TABLE app_pricing_change_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        domain TEXT NOT NULL CHECK (domain IN ('policy_rule', 'membership', 'billing_product')),
        operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'rollback')),
        target_id TEXT NOT NULL, actor_id UUID NOT NULL, previous_state JSONB, next_state JSONB,
        preview_summary JSONB NOT NULL, affected_scenario_ids JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db.pool.query(readFileSync('neon/migrations/54_customer_tariff_cells.sql', 'utf8'));
    const scenario = collectSellableManualTariffCoverage().scenarios.find((row) =>
      row.modelId === 'seedance-2-0-mini' && row.selector.mode === 't2v' &&
      row.selector.resolution === '720p' && row.selector.durationSec === '5' && row.selector.aspectRatio === '16:9');
    assert.ok(scenario);
    const selected = await loadCustomerTariffScenarioDetail(scenario.modelId, scenario.selector);
    const longer = await loadCustomerTariffScenarioDetail(scenario.modelId, { ...scenario.selector, durationSec: '10' });
    assert.equal(selected.supplierComparison.supplierList.amountUsd, 0.378);
    assert.equal(longer.supplierComparison.supplierList.amountUsd, 0.756);
    assert.equal(longer.supplierComparison.scenarioId, longer.scenarioId);
    assert.ok(longer.currentCents! > selected.currentCents!);
    assert.equal(longer.supplierComparison.customerQuote?.totalCents, longer.currentCents,
      'the selected variant carries its own canonical customer quote');
    assert.equal(longer.supplierComparison.customerQuote?.ruleId, 'default');
    assert.equal(longer.supplierComparison.customerQuote?.source, 'database');
    const firstReference = await loadCustomerTariffScenarioDetail('gpt-image-2-5-flare', {
      mode: 'i2i', quality: 'low', resolution: '1024x768', referenceImageCount: '1',
    });
    const secondReference = await loadCustomerTariffScenarioDetail('gpt-image-2-5-flare', {
      ...firstReference.selector, referenceImageCount: '2',
    });
    assert.equal(secondReference.selector.referenceImageCount, '2');
    assert.ok(secondReference.currentCents! > firstReference.currentCents!);
    assert.ok(secondReference.supplierComparison.supplierList.amountUsd! > firstReference.supplierComparison.supplierList.amountUsd!);
    const extraPreview = await previewCustomerTariffChange({ operation: 'create', scenarioId: secondReference.scenarioId,
      customerCents: secondReference.currentCents! });
    assert.equal(extraPreview.currentCents, secondReference.currentCents);
    assert.equal(extraPreview.selector.referenceImageCount, '2');
    const proposal = { operation: 'create' as const, scenarioId: scenario.id, customerCents: 95 };
    const preview = await previewCustomerTariffChange(proposal);
    assert.equal(preview.proposedCents, 95);
    assert.equal(preview.active, false);
    assert.ok(preview.currentCents >= 0);
    await assert.rejects(confirmCustomerTariffChange(proposal, 'stale', '11111111-1111-4111-8111-111111111111'),
      /preview changed/i);
    const confirmation = await confirmCustomerTariffChange(proposal, preview.fingerprint,
      '11111111-1111-4111-8111-111111111111');
    assert.equal(confirmation.revision, 1);
    assert.equal((await loadCustomerTariffHistory()).length, 1);
    await assert.rejects(confirmCustomerTariffChange(proposal, preview.fingerprint,
      '11111111-1111-4111-8111-111111111111'), /does not match|preview changed/i);
    const update = { operation: 'update' as const, scenarioId: scenario.id, customerCents: 99 };
    const updatePreview = await previewCustomerTariffChange(update);
    const updated = await confirmCustomerTariffChange(update, updatePreview.fingerprint,
      '11111111-1111-4111-8111-111111111111');
    assert.equal(updated.revision, 2);
    const rollback = { operation: 'rollback' as const, scenarioId: scenario.id, eventId: updated.event.id };
    const rollbackPreview = await previewCustomerTariffChange(rollback);
    assert.equal(rollbackPreview.proposedCents, 95);
    const restored = await confirmCustomerTariffChange(rollback, rollbackPreview.fingerprint,
      '11111111-1111-4111-8111-111111111111');
    assert.equal(restored.revision, 3);
    const afterEdit = await loadCustomerTariffScenarioDetail(scenario.modelId, scenario.selector);
    assert.equal(afterEdit.currentCents, selected.currentCents);
    assert.equal(afterEdit.supplierComparison.supplierList.amountUsd, selected.supplierComparison.supplierList.amountUsd);
    const remove = { operation: 'rollback' as const, scenarioId: scenario.id, eventId: confirmation.event.id };
    const removePreview = await previewCustomerTariffChange(remove);
    assert.equal(removePreview.proposedCents, null);
    const removed = await confirmCustomerTariffChange(remove, removePreview.fingerprint,
      '11111111-1111-4111-8111-111111111111');
    assert.equal(removed.revision, 4);
    assert.equal((await loadCustomerTariffHistory()).length, 4);
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    if (oldUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldUrl;
  }
});
