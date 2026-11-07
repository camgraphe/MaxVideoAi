import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { loadCustomerTariffScenarioDetail, previewCustomerTariffChange, confirmCustomerTariffChange } from '../frontend/server/pricing-admin/customer-tariff-service';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import type { CustomerTariffChangeProposal } from '../frontend/server/pricing-admin/customer-tariff-contract';

test('Flash Modify requires its own reviewed tariff and preserves creation rows through disposable PG admin confirmation', async () => {
  const db = await startDisposablePostgres('flash-modify-pricing');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  try {
    await db.pool.query(`
      CREATE TABLE app_pricing_rules(id TEXT PRIMARY KEY,engine_id TEXT,resolution TEXT,mode TEXT,margin_percent NUMERIC,margin_flat_cents INTEGER,surcharge_audio_percent NUMERIC,surcharge_upscale_percent NUMERIC,currency TEXT,compatibility_profile TEXT,vendor_account_id TEXT,effective_from TIMESTAMPTZ,updated_at TIMESTAMPTZ,updated_by UUID);
      CREATE TABLE app_pricing_change_events(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),domain TEXT NOT NULL CHECK(domain IN('policy_rule','membership','billing_product')),operation TEXT NOT NULL CHECK(operation IN('create','update','delete','rollback')),target_id TEXT NOT NULL,actor_id UUID NOT NULL,previous_state JSONB,next_state JSONB,preview_summary JSONB NOT NULL,affected_scenario_ids JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    `);
    for (const file of ['54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${file}`, 'utf8'));
    }
    const actor = '11111111-1111-4111-8111-111111111111';
    async function stage(proposal: CustomerTariffChangeProposal) {
      const preview = await previewCustomerTariffChange(proposal);
      await confirmCustomerTariffChange(proposal, preview.fingerprint, actor, () => undefined);
      return preview;
    }
    for (const [mode, customerCents] of [['t2v', 100], ['i2v', 110], ['ref2v', 120]] as const) {
      const detail = await loadCustomerTariffScenarioDetail('kling-v4-flash', {
        mode, resolution: '720p', durationSec: '5', billingInputType: 'no_video_input',
      });
      await stage({ operation: 'create', scenarioId: detail.scenarioId, customerCents });
    }
    for (const modelId of ['kling-v4', 'kling-v4-flash']) {
      const detail = await loadCustomerTariffScenarioDetail(modelId, {
        mode: 'ref2v', resolution: '720p', durationSec: '5',
        billingInputType: 'video_input', inputVideoDurationSec: '12.75',
      });
      await stage({ operation: 'create', scenarioId: detail.scenarioId, scope: 'continuous_input',
        price: { kind: 'kling_v4_billable', customerCentsPerBillableSecond: modelId === 'kling-v4' ? 20 : 12 } });
    }
    const originalRows = (await db.pool.query('SELECT * FROM app_customer_tariff_cells ORDER BY id')).rows;
    assert.equal(originalRows.length, 5);
    // Only the private Unix-socket fixture is activated. No operational DB is read or written.
    await db.pool.query('UPDATE app_customer_tariff_state SET active=TRUE');
    const engine = getFalEngineById('kling-v4-flash')!.engine;
    const context = { engine, mode: 'v2v' as const, resolution: '720p', durationSec: 4.25,
      hasVideoInput: true, inputVideoDurationSec: 12.75, inheritedDurationSec: 4.25 };
    await assert.rejects(computeCanonicalBillingSnapshot(context), { code: 'missing_cell' });
    const creation = { engine, mode: 'ref2v' as const, resolution: '720p', durationSec: 5,
      hasVideoInput: true, inputVideoDurationSec: 12.75 };
    assert.equal((await computeCanonicalBillingSnapshot(creation)).totalCents, 213);

    const detail = await loadCustomerTariffScenarioDetail('kling-v4-flash', {
      mode: 'v2v', resolution: '720p', durationSec: '5',
      billingInputType: 'video_input', inputVideoDurationSec: '12.75',
    });
    assert.equal(detail.selector.mode, 'v2v');
    assert.equal(detail.currentCents, null);
    assert.equal(detail.continuousInputTariff?.price, null);
    const proposal = { operation: 'create' as const, scenarioId: detail.scenarioId, scope: 'continuous_input' as const,
      price: { kind: 'kling_v4_billable' as const, customerCentsPerBillableSecond: 15 } };
    const preview = await previewCustomerTariffChange(proposal);
    assert.equal(preview.currentCents, null);
    assert.equal(preview.proposedCents, 267);
    assert.equal((await db.pool.query('SELECT count(*)::integer AS count FROM app_customer_tariff_cells')).rows[0].count, 5);
    await assert.rejects(confirmCustomerTariffChange({ ...proposal,
      price: { ...proposal.price, customerCentsPerBillableSecond: 16 } }, preview.fingerprint, actor, () => undefined), /preview changed/i);
    await confirmCustomerTariffChange(proposal, preview.fingerprint, actor, () => undefined);

    const billing = await computeCanonicalBillingSnapshot(context);
    const visible = await computeCanonicalPublicSnapshot(context);
    assert.equal(billing.totalCents, 255, '4.25 output + 12.75 aggregate input = 17 billable seconds at 15 cents.');
    assert.equal(visible.totalCents, 255);
    assert.equal(billing.base.seconds, 4.25);
    assert.equal(billing.meta?.billable_seconds, 17);
    assert.equal(billing.meta?.input_video_duration_sec, 12.75);
    assert.equal(visible.meta?.customerTariffRevision, billing.meta?.customerTariffRevision);
    assert.equal((await computeCanonicalBillingSnapshot({ ...context, durationSec: 5, inheritedDurationSec: undefined })).totalCents, 267);
    await assert.rejects(computeCanonicalBillingSnapshot({ ...context, hasVideoInput: undefined }));
    await assert.rejects(computeCanonicalBillingSnapshot({ ...context, inputVideoDurationSec: 20.001 }));
    assert.equal((await computeCanonicalBillingSnapshot(creation)).totalCents, 213);
    assert.equal((await computeCanonicalBillingSnapshot({ ...creation, engine: getFalEngineById('kling-v4')!.engine })).totalCents, 355);
    for (const [mode, totalCents] of [['t2v', 100], ['i2v', 110], ['ref2v', 120]] as const) {
      assert.equal((await computeCanonicalBillingSnapshot({ engine, mode, resolution: '720p', durationSec: 5, hasVideoInput: false })).totalCents, totalCents);
    }
    const preservedRows = (await db.pool.query('SELECT * FROM app_customer_tariff_cells WHERE id=ANY($1::text[]) ORDER BY id', [originalRows.map(row => row.id)])).rows;
    assert.deepEqual(preservedRows, originalRows);
    assert.equal((await db.pool.query('SELECT count(*)::integer AS count FROM app_customer_tariff_cells')).rows[0].count, 6);
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
