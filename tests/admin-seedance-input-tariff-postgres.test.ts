import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { prepareSeedanceInputTariffPrice } from '../frontend/server/pricing/seedance-input-tariff';
import { customerTariffCellId } from '../frontend/server/pricing/customer-tariff-seed';
import { loadCustomerTariffScenarioDetail, previewCustomerTariffChange, confirmCustomerTariffChange,
  loadCustomerTariffHistory } from '../frontend/server/pricing-admin/customer-tariff-service';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { ENV } from '../frontend/src/lib/env';
import { priceCanonicalGenerationInExecutor } from '../frontend/src/server/agent-api/generation-pricing';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';

test('Seedance unit editing preserves proportional source pricing, stale checks and immutable rollback history', async () => {
  const db = await startDisposablePostgres('seedance-input-tariff');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  const previousProvider = ENV.SEEDANCE_2_PROVIDER;
  ENV.SEEDANCE_2_PROVIDER = 'byteplus_modelark';
  try {
    await db.pool.query(`CREATE TABLE app_pricing_rules (id TEXT PRIMARY KEY, engine_id TEXT, resolution TEXT, mode TEXT,
      margin_percent NUMERIC, margin_flat_cents INTEGER, surcharge_audio_percent NUMERIC, surcharge_upscale_percent NUMERIC,
      currency TEXT, compatibility_profile TEXT, vendor_account_id TEXT, effective_from TIMESTAMPTZ, updated_at TIMESTAMPTZ, updated_by UUID);
      INSERT INTO app_pricing_rules (id,margin_percent,margin_flat_cents,surcharge_audio_percent,surcharge_upscale_percent,currency)
      VALUES ('default',0.3,0,0.2,0.5,'USD');
      CREATE TABLE app_pricing_change_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), domain TEXT NOT NULL,
      operation TEXT NOT NULL, target_id TEXT NOT NULL, actor_id UUID NOT NULL, previous_state JSONB, next_state JSONB,
      preview_summary JSONB NOT NULL, affected_scenario_ids JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
    await db.pool.query(readFileSync('neon/migrations/54_customer_tariff_cells.sql', 'utf8'));
    await db.pool.query(readFileSync('neon/migrations/55_customer_tariff_versions.sql', 'utf8'));
    const scenario = collectSellableManualTariffCoverage().scenarios.find(s => s.modelId === 'seedance-2-0'
      && s.selector.mode === 'ref2v' && s.selector.billingInputType === 'video_input' && s.selector.durationSec === '4'
      && s.selector.resolution === '480p' && s.selector.aspectRatio === '16:9')!;
    const selector = continuousInputTariffSelector(scenario.selector)!;
    const price = prepareSeedanceInputTariffPrice({ context: scenario.context, currentCustomerCents: 68,
      at: new Date().toISOString() }).price;
    const id = customerTariffCellId(Object.entries(selector).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('|'));
    await db.pool.query(`INSERT INTO app_customer_tariff_cells (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      VALUES ($1,$2,$3::jsonb,$4::jsonb,'USD','2026-10-01T00:00:00Z',1,'11111111-1111-4111-8111-111111111111')`,
      [id,JSON.stringify(Object.entries(selector).sort(([a],[b]) => a.localeCompare(b))),JSON.stringify(selector),JSON.stringify(price)]);
    await db.pool.query('UPDATE app_customer_tariff_state SET active=TRUE, revision=1');
    const detail = await loadCustomerTariffScenarioDetail('seedance-2-0', { ...scenario.selector, inputVideoDurationSec: '15' });
    assert.equal(detail.currentCents, 185);
    assert.equal(detail.continuousInputTariff?.seedanceMinimum?.includedInputSeconds, 3);
    const proposal = { operation: 'update' as const, scope: 'continuous_input' as const, scenarioId: detail.scenarioId,
      price: { kind: 'seedance_billable' as const, customerCentsPerBillableSecond: 10 } };
    const preview = await previewCustomerTariffChange(proposal);
    assert.equal(preview.proposedCents, 190);
    const actor = '11111111-1111-4111-8111-111111111111';
    await assert.rejects(confirmCustomerTariffChange({ ...proposal, scenarioId: detail.scenarioId.replace('=15|', '=14|') }, preview.fingerprint, actor), /preview changed/i);
    const changed = await confirmCustomerTariffChange(proposal, preview.fingerprint, actor, () => {});
    for (const [seconds, expected] of [[2,70],[3.25,73],[15,190]] as const) {
      const publicScenario = resolvePublicModelScenario({ modelId: 'seedance-2-0', mode: 'ref2v', resolution: '480p',
        durationSec: 4, aspectRatio: '16:9', hasVideoInput: true, inputVideoDurationSec: seconds })!;
      assert.equal((await computeCanonicalBillingSnapshot(publicScenario.context)).totalCents, expected);
      assert.equal((await computeCanonicalPublicSnapshot(publicScenario.context)).totalCents, expected);
      const request: CanonicalGenerationRequest = { schemaVersion: 1,surface: 'video',engineId: 'seedance-2-0',mode: 'ref2v',
        prompt: 'Keep the scene.',settings: { durationSec:4,resolution:'480p',aspectRatio:'16:9' },outputCount:1,
        references:[{ kind:'asset',assetId:'owned-source',role:'reference',slot:0 }] };
      const candidate = { engine:publicScenario.context.engine,surface:'video' as const,publicModes:['ref2v' as const],modeCaps:{} };
      const mcp = await withDbTransaction(executor => priceCanonicalGenerationInExecutor(request,'member',{ executor,candidate,
        resolvedReferences:[{ assetId:'owned-source',role:'reference',slot:0,mediaKind:'video',
          storageUrl:'https://owned.invalid/source.mp4',durationSec:seconds,width:854,height:480,mimeType:'video/mp4' }] }));
      assert.equal(mcp.priceCents,expected);
      await assert.rejects(withDbTransaction(executor => priceCanonicalGenerationInExecutor({ ...request,
        settings:{ ...request.settings,inputVideoDurationSec:1 } },'member',{ executor,candidate })),/duration/i);
    }
    const rollback = { operation: 'rollback' as const, scope: 'continuous_input' as const,
      scenarioId: detail.scenarioId, eventId: changed.event.id };
    const undo = await previewCustomerTariffChange(rollback);
    await confirmCustomerTariffChange(rollback, undo.fingerprint, actor, () => {});
    assert.equal((await loadCustomerTariffScenarioDetail('seedance-2-0', detail.selector)).currentCents, 185);
    assert.equal((await loadCustomerTariffHistory(id)).length, 2);
    await assert.rejects(previewCustomerTariffChange({ ...proposal, price: { kind: 'seedance_billable', customerCentsPerBillableSecond: 1 } }), /below.cost/i);
    await assert.rejects(previewCustomerTariffChange({ ...proposal, price: { kind: 'linear_input', outputCents: 68, inputCentsPerSecond: 10 } }), /proportional/i);
  } finally {
    await getDb().end().catch(() => undefined); await db.cleanup();
    ENV.SEEDANCE_2_PROVIDER = previousProvider;
    for (const [key,value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key]=value; }
  }
});
