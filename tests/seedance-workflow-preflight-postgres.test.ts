import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { NextRequest } from 'next/server';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import document from '../frontend/config/customer-tariffs.json';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getDb } from '../frontend/src/lib/db';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { seedanceWorkflowScenarios } from '../frontend/lib/pricing-audit/seedance-workflow-scenarios';
import { createPreflightPostHandler } from '../frontend/app/api/preflight/_lib/preflight-handler';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

test('owned Draft and final HTTP preflight select independent tariffs rather than ordinary 480p/1080p prices', async () => {
  const db = await startDisposablePostgres('sdpre');
  const keys = ['DATABASE_URL', 'NODE_ENV', 'PRICING_SANDBOX', 'SEEDANCE_2_5_DRAFT_ENABLED'] as const;
  const previous = keys.map(key => process.env[key]);
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1', SEEDANCE_2_5_DRAFT_ENABLED: '1' });
  const cells = document.cells as ManualTariffCell[];
  const original = [...cells];
  try {
    await createPaidGenerationTestSchema(db.pool);
    for (const migration of ['27_pricing_admin_cockpit.sql', '53_seedance_draft_links.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql', '59_seedance_draft_final_state.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${migration}`, 'utf8'));
    }
    const engine = getFalEngineById('seedance-2-5')!.engine;
    const normal = ['480p', '1080p'].map(resolution => buildManualTariffCoverageScenario({ engine, mode: 't2v',
      durationSec: 4, resolution, aspectRatio: '16:9', addons: { audio: false }, membershipTier: 'member' }, 'workflow-preflight'));
    cells.push(...[...normal, ...seedanceWorkflowScenarios(normal)].map((s, index) => ({
      id: `preflight-${index}`, source: 'versioned' as const, version: 1, currency: 'USD',
      effectiveFrom: '2026-09-01T00:00:00Z', selector: s.selector,
      price: { kind: 'fixed' as const, customerCents: s.context.workflowStep === 'draft' ? 77 : s.context.workflowStep === 'final' ? 777 : 9999 },
    })));
    await db.pool.query('UPDATE app_customer_tariff_state SET active = TRUE, revision = 1');
    await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,provider_job_id,status,final_price_cents,currency,duration_sec,aspect_ratio,has_audio,prompt,settings_snapshot)
      VALUES('owned-draft','owner','seedance-2-5','byteplus_modelark','fixture-task','completed',52,'USD',4,'16:9',false,'Local workflow test',
      '{"seedanceWorkflow":{"step":"draft"},"inputMode":"t2v","core":{"resolution":"480p","iterationCount":1}}');
      INSERT INTO seedance_draft_links(draft_job_id,user_id,provider_task_id,provider_model_id,validity_started_at,validity_start_source,expires_at,draft_state)
      VALUES('owned-draft','owner','fixture-task','fixture-model',now(),'server_request_started',now()+interval '1 day','ready')`);
    const handler = createPreflightPostHandler({ getRouteAuthContextFn: async () => ({ userId: 'owner' } as never),
      mediaAwarePreflightDependencies: { getConfiguredEngineFn: async () => engine } });
    const send = (seedanceWorkflow?: { step: 'draft' } | { step: 'final'; draftJobId: string }, resolution = '480p') => handler(new NextRequest('http://localhost/api/preflight', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine: 'seedance-2-5', mode: 't2v', durationSec: 4, resolution, aspectRatio: '16:9', fps: 24, audio: false, ...(seedanceWorkflow ? { seedanceWorkflow } : {}) }),
    }));
    for (const step of ['draft', 'final'] as const) {
      const response = await send(step === 'draft' ? { step } : { step, draftJobId: 'owned-draft' }, step === 'draft' ? '480p' : '1080p');
      const result = await response.json();
      assert.equal(response.status, 200);
      assert.equal(result.pricing.meta.workflowStep, step);
      assert.equal(result.pricing.meta.customerTariffRevision, 1);
      assert.equal(result.pricing.totalCents, step === 'draft' ? 77 : 777);
    }
    assert.equal((await (await send()).json()).pricing.totalCents, 9999, 'ordinary 480p remains a separate offer');
    assert.equal((await send({ step: 'final', draftJobId: 'someone-elses-draft' }, '1080p')).status, 409);
    await db.pool.query('UPDATE app_customer_tariff_state SET active = FALSE');
    const unavailable = await send({ step: 'draft' });
    assert.equal(unavailable.status, 400, 'an unavailable workflow tariff cannot fall back to ordinary pricing');
    assert.equal((await unavailable.json()).ok, false);
    assert.equal((await db.pool.query('SELECT count(*) FROM app_receipts')).rows[0].count, '0', 'preflight never charges');
  } finally {
    cells.splice(0, cells.length, ...original);
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
});
