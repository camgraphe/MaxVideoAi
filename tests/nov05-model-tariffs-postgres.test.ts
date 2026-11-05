import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { loadCustomerTariffScenarioDetail, previewCustomerTariffChange, confirmCustomerTariffChange } from '../frontend/server/pricing-admin/customer-tariff-service';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { isKlingV4ReleaseBlocked } from '../frontend/src/server/video-generation/kling-v4-release-policy';
import { getRuntimeModelById } from '../frontend/config/model-runtime';

test('new model tariff previews are concrete, revisioned and inactive until approval, without publishing any model', async () => {
  const db = await startDisposablePostgres('nov05-model-tariffs');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  const publicationFixtures = ['kling-v4-flash', 'gpt-image-2-6-flare', 'gpt-image-2-6-sunburst'].map(id => {
    const app = getRuntimeModelById(id)!.publication.app;
    return { app, published: app.published };
  });
  try {
    for (const { app } of publicationFixtures) app.published = false;
    await db.pool.query(`CREATE TABLE app_pricing_rules(id TEXT PRIMARY KEY,engine_id TEXT,resolution TEXT,mode TEXT,margin_percent NUMERIC,margin_flat_cents INTEGER,surcharge_audio_percent NUMERIC,surcharge_upscale_percent NUMERIC,currency TEXT,compatibility_profile TEXT,vendor_account_id TEXT,effective_from TIMESTAMPTZ,updated_at TIMESTAMPTZ,updated_by UUID);
      CREATE TABLE app_pricing_change_events(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),domain TEXT NOT NULL CHECK(domain IN('policy_rule','membership','billing_product')),operation TEXT NOT NULL CHECK(operation IN('create','update','delete','rollback')),target_id TEXT NOT NULL,actor_id UUID NOT NULL,previous_state JSONB,next_state JSONB,preview_summary JSONB NOT NULL,affected_scenario_ids JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
    for (const file of ['54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) await db.pool.query(readFileSync(`neon/migrations/${file}`, 'utf8'));
    const actor = '11111111-1111-4111-8111-111111111111';
    for (const id of ['kling-v4-flash', 'gpt-image-2-6-flare', 'gpt-image-2-6-sunburst']) {
      const image = id !== 'kling-v4-flash';
      const request = image ? { mode: 't2i', resolution: '1024x1024', durationSec: '1', quality: 'high' }
        : { mode: 'ref2v', resolution: '720p', durationSec: '5', billingInputType: 'video_input', inputVideoDurationSec: '10.2501' };
      const detail = await loadCustomerTariffScenarioDetail(id, request);
      assert.equal(detail.currentCents, null);
      if (!image) assert.equal(detail.choices.find(choice => choice.key === 'inputVideoDurationSec')?.range?.max, 20);
      const proposal = image ? { operation: 'create' as const, scenarioId: detail.scenarioId, customerCents: 100 }
        : { operation: 'create' as const, scenarioId: detail.scenarioId, scope: 'continuous_input' as const, price: { kind: 'kling_v4_billable' as const, customerCentsPerBillableSecond: 12 } };
      const preview = await previewCustomerTariffChange(proposal);
      assert.equal(preview.active, false); assert.equal(preview.currentCents, null); assert.equal(preview.proposedCents, image ? 100 : 184);
      const changed = image ? { ...proposal, customerCents: 101 } : { ...proposal, price: { kind: 'kling_v4_billable' as const, customerCentsPerBillableSecond: 13 } };
      await assert.rejects(confirmCustomerTariffChange(changed, preview.fingerprint, actor, () => undefined), /preview changed/i);
      await confirmCustomerTariffChange(proposal, preview.fingerprint, actor, () => undefined);
      assert.equal((await loadCustomerTariffScenarioDetail(id, detail.selector)).currentCents, null);
      assert.equal(getRuntimeModelById(id)?.publication.app.published, false);
    }
    // Activate only this disposable database to verify canonical price parity.
    await db.pool.query('UPDATE app_customer_tariff_state SET active=TRUE');
    for (const id of ['gpt-image-2-6-flare', 'gpt-image-2-6-sunburst']) {
      const context = { engine: getFalEngineById(id)!.engine, mode: 't2i' as const, resolution: '1024x1024', durationSec: 1, quality: 'high' };
      const billing = await computeCanonicalBillingSnapshot(context);
      const visible = await computeCanonicalPublicSnapshot(context);
      assert.equal(billing.totalCents, 100); assert.equal(visible.totalCents, billing.totalCents);
      assert.equal(visible.meta?.customerTariffRevision, billing.meta?.customerTariffRevision);
      await assert.rejects(computeCanonicalBillingSnapshot({ ...context, quality: 'low' }));
    }
    assert.equal(isKlingV4ReleaseBlocked('kling-v4-flash'), true);
  } finally {
    for (const { app, published } of publicationFixtures) app.published = published;
    await getDb().end().catch(() => undefined); await db.cleanup();
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
