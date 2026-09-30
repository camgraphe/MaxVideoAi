import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadCustomerTariffScenarioDetail, previewCustomerTariffChange, confirmCustomerTariffChange,
  loadCustomerTariffHistory } from '../frontend/server/pricing-admin/customer-tariff-service';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { getDb } from '../frontend/src/lib/db';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('Omni preserved token bands and editable output/source prices share active billing/public history and rollback', async () => {
  const db = await startDisposablePostgres('omni-tariff');
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
    const input = { modelId: 'gemini-omni-flash', mode: 'v2v', resolution: '720p', durationSec: 5,
      inputVideoDurationSec: 3.25 };
    const selected = await loadCustomerTariffScenarioDetail(input.modelId, { mode: input.mode, resolution: input.resolution,
      durationSec: '5', inputVideoDurationSec: '3.25' });
    assert.equal(selected.continuousInputTariff!.outputVaries, true);
    const preserve = { operation: 'create' as const, scope: 'continuous_input' as const,
      scenarioId: selected.scenarioId, price: { kind: 'preserve_current' as const } };
    const initial = await previewCustomerTariffChange(preserve);
    assert.equal(initial.proposedCents, 47);
    assert.equal(initial.selector.durationSec, 'continuous');
    assert.ok(initial.continuousInputRange!.minimumGrossCents >= 0);
    const staged = await confirmCustomerTariffChange(preserve, initial.fingerprint, actor, () => {});
    const originals = [];
    for (const seconds of [3, 3.25, 4.75, 9.999999, 10]) {
      const scenario = resolvePublicModelScenario({ ...input, inputVideoDurationSec: seconds })!;
      originals.push({ scenario, cents: (await computeCanonicalBillingSnapshot(scenario.context)).totalCents });
    }
    await db.pool.query('UPDATE app_customer_tariff_state SET active = TRUE');
    for (const original of originals) {
      const billed = await computeCanonicalBillingSnapshot(original.scenario.context);
      const published = await computeCanonicalPublicSnapshot(original.scenario.context);
      assert.equal(billed.totalCents, original.cents);
      assert.equal(published.totalCents, billed.totalCents);
      assert.equal(published.meta?.customerTariffRevision, 1);
    }
    const update = { ...preserve, operation: 'update' as const,
      price: { kind: 'linear_video' as const, outputCentsPerSecond: 15, inputCentsPerSecond: 2 } };
    const next = await previewCustomerTariffChange(update);
    assert.equal(next.proposedCents, 55);
    const neighbor = resolvePublicModelScenario({ ...input, inputVideoDurationSec: 4.75 })!;
    await assert.rejects(confirmCustomerTariffChange({ ...update, scenarioId: neighbor.id }, next.fingerprint, actor), /preview changed/i);
    assert.equal((await loadCustomerTariffHistory()).length, 1);
    const changed = await confirmCustomerTariffChange(update, next.fingerprint, actor, () => {});
    const paid = await computeCanonicalBillingSnapshot(resolvePublicModelScenario(input)!.context);
    assert.equal(paid.totalCents, 55);
    assert.equal((await computeCanonicalPublicSnapshot(neighbor.context)).totalCents, 81);
    const rollback = { operation: 'rollback' as const, scope: 'continuous_input' as const,
      scenarioId: neighbor.id, eventId: changed.event.id };
    const back = await previewCustomerTariffChange(rollback);
    assert.equal(back.proposedCents, originals.find(row => row.scenario.id === neighbor.id)!.cents);
    await confirmCustomerTariffChange(rollback, back.fingerprint, actor, () => {});
    assert.equal((await computeCanonicalPublicSnapshot(resolvePublicModelScenario(input)!.context)).totalCents, 47);
    assert.equal(paid.totalCents, 55, 'a stored paid quote is immutable');
    assert.equal((await loadCustomerTariffHistory(staged.event.targetId)).length, 3);
    assert.equal((await db.pool.query('SELECT count(*)::integer AS n FROM app_customer_tariff_cell_versions')).rows[0].n, 2);
    await assert.rejects(previewCustomerTariffChange({ ...update, price: { ...update.price, outputCentsPerSecond: 1 } }), /cost/i);
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
