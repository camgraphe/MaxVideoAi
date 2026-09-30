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

test('decimal Wan tariff preview, immutable confirmation and active billing use the same exact source duration', async () => {
  const db = await startDisposablePostgres('wan-fractional-tariff');
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
    const selected = await loadCustomerTariffScenarioDetail('wan-3', { mode: 'v2v', resolution: '720p',
      durationSec: '5', aspectRatio: '16:9', inputVideoDurationSec: '3.25' });
    assert.equal(selected.currentCents, 108);
    assert.equal(selected.supplierComparison.supplierList.amountUsd, 0.825);
    assert.equal((selected.supplierComparison as unknown as { inputVideoDurationSec: number }).inputVideoDurationSec, 3.25);
    const proposal = { operation: 'create' as const, scenarioId: selected.scenarioId, customerCents: 129 };
    const preview = await previewCustomerTariffChange(proposal);
    assert.equal(preview.selector.inputVideoDurationSec, '3.25');
    assert.equal(preview.currentCents, 108);
    assert.equal(preview.proposedCents, 129);
    for (const scenarioId of [selected.scenarioId + '|untrusted=1', selected.scenarioId + '|inputVideoDurationSec=3.25',
      selected.scenarioId.replace('3.25', '15.1'), selected.scenarioId.replace('16%3A9', 'bogus'),
      selected.scenarioId.replace('3.25', '03.25'), selected.scenarioId.replace('v2v', 'ref2v')]) {
      await assert.rejects(previewCustomerTariffChange({ ...proposal, scenarioId }), /unsupported|Unknown/i);
    }
    await assert.rejects(confirmCustomerTariffChange({ ...proposal, scenarioId: selected.scenarioId.replace('3.25', '3.5') },
      preview.fingerprint, actor), /preview changed/i);
    assert.equal((await loadCustomerTariffHistory()).length, 0);
    const committed = await confirmCustomerTariffChange(proposal, preview.fingerprint, actor);
    assert.equal(committed.revision, 1);
    const staged = await loadCustomerTariffScenarioDetail('wan-3', selected.selector);
    assert.equal(staged.currentCents, 108, 'preparing a decimal tariff never reprices live quotes');
    assert.equal(staged.stagedCents, 129);
    await db.pool.query('UPDATE app_customer_tariff_state SET active = TRUE WHERE singleton = TRUE');
    const active = await loadCustomerTariffScenarioDetail('wan-3', selected.selector);
    assert.equal(active.currentCents, 129);
    const scenario = resolvePublicModelScenario({ modelId: 'wan-3', mode: 'v2v', durationSec: 5,
      resolution: '720p', aspectRatio: '16:9', inputVideoDurationSec: 3.25 });
    assert.ok(scenario);
    const state = { status: 'loaded' as const, active: true, revision: 1,
      versionedCells: [], databaseCells: [committed.event.nextState as never] };
    const dependencies = { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded' as const, rules: [] }) },
      loadCustomerTariffState: async () => state };
    const billed = await computeCanonicalBillingSnapshot(scenario.context, dependencies);
    const publicQuote = await computeCanonicalPublicSnapshot(scenario.context, dependencies);
    assert.equal(billed.totalCents, 129);
    assert.equal(publicQuote.totalCents, billed.totalCents);
    const display = await quotePublicModelScenario({ modelId: 'wan-3', mode: 'v2v', durationSec: 5,
      resolution: '720p', inputVideoDurationSec: 3.25 }, async () => publicQuote);
    assert.equal(display.status, 'exact');
    if (display.status === 'exact') assert.match(display.scenarioLabel, /5s output \+ 3\.25s input/);
    await assert.rejects(computeCanonicalBillingSnapshot({ ...scenario.context, inputVideoDurationSec: 3.5 }, dependencies), /No active manual tariff/);
    const update = { operation: 'update' as const, scenarioId: selected.scenarioId, customerCents: 139 };
    const updatePreview = await previewCustomerTariffChange(update);
    const updated = await confirmCustomerTariffChange(update, updatePreview.fingerprint, actor, () => {});
    const rollback = { operation: 'rollback' as const, scenarioId: selected.scenarioId, eventId: updated.event.id };
    const rollbackPreview = await previewCustomerTariffChange(rollback);
    assert.equal(rollbackPreview.proposedCents, 129);
    await confirmCustomerTariffChange(rollback, rollbackPreview.fingerprint, actor, () => {});
    assert.equal((await loadCustomerTariffScenarioDetail('wan-3', selected.selector)).currentCents, 129);
    assert.equal((await loadCustomerTariffHistory()).length, 3);
    assert.equal(billed.totalCents, 129, 'a stored quote remains unchanged by later edits');
    assert.equal((await db.pool.query('SELECT count(*)::integer AS n FROM app_customer_tariff_cell_versions')).rows[0].n, 2);
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
