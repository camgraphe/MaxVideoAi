import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';
import { computeCanonicalFinishingBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { previewPricingPolicyChange, confirmPricingPolicyChange, type PricingPolicyChangeProposal } from '../frontend/server/pricing-admin/policy-service';
import { DEFAULT_POLICY_SERVICE_DEPENDENCIES } from '../frontend/server/pricing-admin/policy-dependencies';

test('a finishing price preview, stale rejection, confirmation and rollback share the billed scoped policy on PostgreSQL', async () => {
  const database = await startDisposablePostgres('finishing-prices');
  const previousUrl = process.env.DATABASE_URL;
  const actor = '11111111-1111-4111-8111-111111111111';
  const dependencies = { ...DEFAULT_POLICY_SERVICE_DEPENDENCIES, revalidate: () => undefined };
  const quote = (toolId: string) => computeCanonicalFinishingBillingSnapshot({ toolId, quality: 'standard',
    vendorBudgetUsd: 0.1, durationSec: 10, profileId: 'fixture-profile', pricingSource: 'fixture-budget' });
  try {
    await database.pool.query(`CREATE TABLE app_pricing_rules (id text PRIMARY KEY, engine_id text, resolution text,
      margin_percent numeric, margin_flat_cents integer, surcharge_audio_percent numeric, surcharge_upscale_percent numeric,
      currency text, vendor_account_id text, effective_from timestamptz, created_at timestamptz DEFAULT now());
      INSERT INTO app_pricing_rules (id,margin_percent,margin_flat_cents,currency) VALUES ('default',0.3,0,'USD')`);
    for (const migration of ['27_pricing_admin_cockpit.sql', '42_toolbox_finishing_pricing.sql']) {
      await database.pool.query(readFileSync(`neon/migrations/${migration}`, 'utf8'));
    }
    process.env.DATABASE_URL = database.databaseUrl;
    const proposal: PricingPolicyChangeProposal = { operation: 'create', rule: { id: 'admin-denoise-standard',
      engineId: 'toolbox-finishing', mode: 'denoise:standard', resolution: 'video', marginPercent: 1.5,
      marginFlatCents: 10, surchargeAudioPercent: 0, surchargeUpscalePercent: 0, currency: 'USD', compatibilityProfile: 'standard' } };
    const preview = await previewPricingPolicyChange(proposal, dependencies);
    assert.ok(preview.rows.length > 0);
    assert.ok(preview.rows.every(row => row.scenarioId.startsWith('admin-finishing:denoise:standard:')));
    assert.equal((await quote('denoise')).totalCents, 25, 'preview alone does not write a price');
    await database.pool.query("UPDATE app_pricing_rules SET margin_flat_cents=1 WHERE id='toolbox-finishing'");
    await assert.rejects(confirmPricingPolicyChange(proposal, preview.previewFingerprint, actor, dependencies),
      (error: unknown) => (error as { code: string }).code === 'preview_stale');
    assert.equal((await database.pool.query('SELECT count(*) FROM app_pricing_change_events')).rows[0].count, '0');
    await database.pool.query("UPDATE app_pricing_rules SET margin_flat_cents=0 WHERE id='toolbox-finishing'");
    const fresh = await previewPricingPolicyChange(proposal, dependencies);
    const confirmed = await confirmPricingPolicyChange(proposal, fresh.previewFingerprint, actor, dependencies);
    assert.equal((await quote('denoise')).totalCents, 35);
    assert.equal((await quote('fix-blur')).totalCents, 25, 'another tool retains its inherited price');
    const rollback: PricingPolicyChangeProposal = { operation: 'rollback', targetId: 'admin-denoise-standard', eventId: confirmed.event.id };
    const rollbackPreview = await previewPricingPolicyChange(rollback, dependencies);
    await confirmPricingPolicyChange(rollback, rollbackPreview.previewFingerprint, actor, dependencies);
    assert.equal((await quote('denoise')).totalCents, 25);
    assert.equal((await database.pool.query('SELECT count(*) FROM app_pricing_change_events')).rows[0].count, '2');
    assert.equal((await database.pool.query("SELECT margin_percent FROM app_pricing_rules WHERE id='default'")).rows[0].margin_percent, '0.3');
  } finally {
    if (process.env.DATABASE_URL === database.databaseUrl) await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    await database.cleanup();
  }
});
