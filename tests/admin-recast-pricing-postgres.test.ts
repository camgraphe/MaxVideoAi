import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';
import { invalidatePricingRulesCache } from '../frontend/src/lib/pricing-rule-store';
import { DEFAULT_POLICY_SERVICE_DEPENDENCIES } from '../frontend/server/pricing-admin/policy-dependencies';
import { previewPricingPolicyChange, confirmPricingPolicyChange, type PricingPolicyChangeProposal } from '../frontend/server/pricing-admin/policy-service';
import { loadAdminProductPricing } from '../frontend/server/pricing-admin/product-pricing-inventory';
import { readRecastPublicPrice } from '../frontend/server/character-studio/recast-public-price';

test('Recast admin preview, concurrent confirmation and rollback preserve scoped database and public parity', async () => {
  const db = await startDisposablePostgres('recast-admin');
  const previousUrl = process.env.DATABASE_URL;
  const actor = '11111111-1111-4111-8111-111111111111';
  try {
    await db.pool.query(`CREATE TABLE app_pricing_rules(id text PRIMARY KEY, engine_id text, mode text, resolution text,
      margin_percent numeric, margin_flat_cents int, surcharge_audio_percent numeric, surcharge_upscale_percent numeric,
      currency text, compatibility_profile text, vendor_account_id text, effective_from timestamptz, updated_at timestamptz, updated_by uuid, created_at timestamptz);
      INSERT INTO app_pricing_rules VALUES ('default',NULL,NULL,NULL,.3,0,0,0,'USD','standard',NULL,NULL,NOW(),NULL,NOW());
      CREATE TABLE app_pricing_change_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), domain text,
      operation text, target_id text, actor_id uuid, previous_state jsonb, next_state jsonb,
      preview_summary jsonb, affected_scenario_ids jsonb, created_at timestamptz DEFAULT NOW());`);
    process.env.DATABASE_URL = db.databaseUrl;
    invalidatePricingRulesCache();
    const dependencies = { ...DEFAULT_POLICY_SERVICE_DEPENDENCIES, loadManualTariffsActive: async () => false, revalidate: () => {} };
    const rule = { id: 'recast-only', engineId: 'character-recast', mode: 'recast', resolution: 'video', marginPercent: 1,
      marginFlatCents: 0, surchargeAudioPercent: 0, surchargeUpscalePercent: 0, currency: 'USD', compatibilityProfile: 'standard' };
    const input = { modelId: 'wan-3-prime', mode: 'ref2v', resolution: '720p', durationSec: 5,
      aspectRatio: '16:9', hasVideoInput: true, inputVideoDurationSec: 3.25 };
    assert.deepEqual(await readRecastPublicPrice(input), { status: 'unavailable' });
    const proposal: PricingPolicyChangeProposal = { operation: 'create', rule };
    const preview = await previewPricingPolicyChange(proposal, dependencies);
    const sample = preview.rows.find(row => row.scenarioId === 'admin-recast:720p:5:3.25')!;
    assert.equal(sample.currentTotalCents, null);
    assert.equal(sample.proposedTotalCents, 232);
    assert.equal((await db.pool.query('SELECT count(*) FROM app_pricing_rules')).rows[0].count, '1');
    assert.equal((await db.pool.query('SELECT count(*) FROM app_pricing_change_events')).rows[0].count, '0');
    const creation = await confirmPricingPolicyChange(proposal, preview.previewFingerprint, actor, dependencies);
    const publicQuote = await readRecastPublicPrice(input);
    assert.ok(publicQuote.status === 'exact');
    assert.equal(publicQuote.amountCents, sample.proposedTotalCents);
    const adminRow = (await loadAdminProductPricing(5)).rows.find(row => row.id === sample.scenarioId)!;
    assert.equal(adminRow.totalCents, publicQuote.amountCents);
    assert.equal(adminRow.supplierCents, 115.5);
    assert.deepEqual(adminRow.policySelector, { engineId: 'character-recast', mode: 'recast', resolution: 'video' });

    const update: PricingPolicyChangeProposal = { operation: 'update', targetId: rule.id, rule: { ...rule, marginPercent: 1.5 } };
    const updatedPreview = await previewPricingPolicyChange(update, dependencies);
    const attempts = await Promise.allSettled([
      confirmPricingPolicyChange(update, updatedPreview.previewFingerprint, actor, dependencies),
      confirmPricingPolicyChange(update, updatedPreview.previewFingerprint, actor, dependencies),
    ]);
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter(result => result.status === 'rejected').length, 1);
    assert.equal((await db.pool.query('SELECT count(*) FROM app_pricing_change_events')).rows[0].count, '2');
    const applied = attempts.find(result => result.status === 'fulfilled');
    assert.ok(applied?.status === 'fulfilled');
    const beforeRollback = (await db.pool.query('SELECT * FROM app_pricing_change_events ORDER BY created_at,id')).rows;
    const rollback = { operation: 'rollback', targetId: rule.id, eventId: applied.value.event.id } as const;
    const restore = await previewPricingPolicyChange(rollback, dependencies);
    await confirmPricingPolicyChange(rollback, restore.previewFingerprint, actor, dependencies);
    const restored = await readRecastPublicPrice(input);
    assert.ok(restored.status === 'exact');
    assert.equal(restored.amountCents, 232);
    for (const old of beforeRollback) assert.deepEqual((await db.pool.query('SELECT * FROM app_pricing_change_events WHERE id=$1', [old.id])).rows[0], old);
    await assert.rejects(previewPricingPolicyChange({ operation: 'rollback', targetId: rule.id, eventId: creation.event.id }, dependencies), /Recast/);

    const failurePreview = await previewPricingPolicyChange(update, dependencies);
    await assert.rejects(confirmPricingPolicyChange(update, failurePreview.previewFingerprint, actor, { ...dependencies,
      insertEvent: async () => { throw new Error('injected audit failure'); } }));
    assert.equal((await db.pool.query("SELECT margin_percent FROM app_pricing_rules WHERE id='recast-only'")).rows[0].margin_percent, '1');
    assert.equal((await db.pool.query('SELECT count(*) FROM app_pricing_change_events')).rows[0].count, '3');
    assert.equal((await db.pool.query("SELECT margin_percent FROM app_pricing_rules WHERE id='default'")).rows[0].margin_percent, '0.3');
  } finally {
    if (process.env.DATABASE_URL === db.databaseUrl) await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    invalidatePricingRulesCache();
    await db.cleanup();
  }
});
