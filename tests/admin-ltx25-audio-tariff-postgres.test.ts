import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadCustomerTariffScenarioDetail, previewCustomerTariffChange, confirmCustomerTariffChange,
  loadCustomerTariffHistory } from '../frontend/server/pricing-admin/customer-tariff-service';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { resolvePublicModelScenario, quotePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { getDb } from '../frontend/src/lib/db';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('continuous LTX audio price edits cover the full source range, refresh public quotes and append rollback history', async () => {
  const db = await startDisposablePostgres('ltx-audio-tariff');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  const actor = '11111111-1111-4111-8111-111111111111';
  try {
    await db.pool.query(`
      CREATE TABLE app_pricing_rules (id TEXT PRIMARY KEY, engine_id TEXT, resolution TEXT, mode TEXT,
        margin_percent NUMERIC, margin_flat_cents INTEGER, surcharge_audio_percent NUMERIC,
        surcharge_upscale_percent NUMERIC, currency TEXT, compatibility_profile TEXT, vendor_account_id TEXT,
        effective_from TIMESTAMPTZ, updated_at TIMESTAMPTZ, updated_by UUID);
      INSERT INTO app_pricing_rules (id, margin_percent, margin_flat_cents, surcharge_audio_percent,
        surcharge_upscale_percent, currency) VALUES ('default', 0.3, 0, 0.2, 0.5, 'USD');
      CREATE TABLE app_pricing_change_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        domain TEXT NOT NULL CHECK (domain IN ('policy_rule', 'membership', 'billing_product')),
        operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'rollback')),
        target_id TEXT NOT NULL, actor_id UUID NOT NULL, previous_state JSONB, next_state JSONB,
        preview_summary JSONB NOT NULL, affected_scenario_ids JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    `);
    await db.pool.query(readFileSync('neon/migrations/54_customer_tariff_cells.sql', 'utf8'));
    await db.pool.query(readFileSync('neon/migrations/55_customer_tariff_versions.sql', 'utf8'));
    const selected = await loadCustomerTariffScenarioDetail('ltx-2-5-fast', { mode: 'a2v', resolution: '1080p',
      durationSec: '9', aspectRatio: '16:9', inputAudioDurationSec: '9.25' });
    assert.ok(selected.continuousInputTariff);
    assert.equal(selected.continuousInputTariff.maxInputSeconds, 20);
    const preserve = { operation: 'create' as const, scenarioId: selected.scenarioId,
      scope: 'continuous_input' as const, price: { kind: 'preserve_current' as const } };
    const preview = await previewCustomerTariffChange(preserve);
    assert.equal(preview.proposedCents, 157);
    assert.equal(preview.selector.inputAudioDurationSec, 'continuous');
    assert.ok(preview.continuousInputRange!.checkedBoundaries > 200);
    const staged = await confirmCustomerTariffChange(preserve, preview.fingerprint, actor);
    assert.equal((await loadCustomerTariffScenarioDetail('ltx-2-5-fast', selected.selector)).currentCents, 157);
    await db.pool.query('UPDATE app_customer_tariff_state SET active = TRUE');
    const input = { modelId: 'ltx-2-5-fast', mode: 'a2v', durationSec: 5, resolution: '1080p', aspectRatio: '16:9', inputAudioDurationSec: 9.25 };
    for (const seconds of [2, 2.00005, 9.25, 9.2501, 20]) {
      const scenario = resolvePublicModelScenario({ ...input, inputAudioDurationSec: seconds })!;
      const billed = await computeCanonicalBillingSnapshot(scenario.context);
      const publicPrice = await computeCanonicalPublicSnapshot(scenario.context);
      assert.equal(publicPrice.totalCents, billed.totalCents);
      assert.equal(publicPrice.meta?.customerTariffRevision, 1);
    }
    const update = { operation: 'update' as const, scenarioId: selected.scenarioId,
      scope: 'continuous_input' as const, price: { kind: 'linear_input' as const, outputCents: 0, inputCentsPerSecond: 30 } };
    const next = await previewCustomerTariffChange(update);
    assert.equal(next.proposedCents, 278);
    await assert.rejects(confirmCustomerTariffChange({ ...update, scenarioId: selected.scenarioId.replaceAll('9.25', '9.5') }, next.fingerprint, actor), /preview changed/i);
    assert.equal((await loadCustomerTariffHistory()).length, 1);
    const updated = await confirmCustomerTariffChange(update, next.fingerprint, actor, () => {});
    const scenario = resolvePublicModelScenario(input)!;
    const paid = await computeCanonicalBillingSnapshot(scenario.context);
    assert.equal(paid.totalCents, 278);
    const neighbor = resolvePublicModelScenario({ ...input, inputAudioDurationSec: 9.5 })!;
    assert.equal((await computeCanonicalPublicSnapshot(neighbor.context)).totalCents, 285);
    const rollback = { operation: 'rollback' as const, scope: 'continuous_input' as const,
      scenarioId: neighbor.id, eventId: updated.event.id };
    const rollbackPreview = await previewCustomerTariffChange(rollback);
    assert.equal(rollbackPreview.proposedCents, 162);
    await confirmCustomerTariffChange(rollback, rollbackPreview.fingerprint, actor, () => {});
    assert.equal((await computeCanonicalPublicSnapshot(scenario.context)).totalCents, 157);
    assert.equal(paid.totalCents, 278);
    assert.equal((await loadCustomerTariffHistory(staged.event.targetId)).length, 3);
    assert.equal((await db.pool.query('SELECT count(*)::integer AS n FROM app_customer_tariff_cell_versions')).rows[0].n, 2);
    const unsafe = { ...update, price: { kind: 'linear_input' as const, outputCents: 0, inputCentsPerSecond: 13 } };
    await assert.rejects(previewCustomerTariffChange(unsafe), /below.cost/i);
    await assert.rejects(previewCustomerTariffChange({ ...update, price: { kind: 'linear_input' as const, outputCents: 0, inputCentsPerSecond: -1 } }), /invalid/i);
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
