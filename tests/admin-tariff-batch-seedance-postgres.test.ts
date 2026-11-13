import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ENV } from '../frontend/src/lib/env';
import { prepareSeedance25CommercialTariffs } from '../frontend/server/pricing/seedance25-commercial-tariffs';
import { prepareSeedanceAdminBatches } from '../frontend/server/pricing-admin/tariff-batches/seedance';
import { previewTariffBatch, confirmTariffBatch, refreshTariffBatchPages } from '../frontend/server/pricing-admin/tariff-batches/service';
import { revalidateCustomerTariffChangeSurfaces } from '../frontend/server/pricing-admin/revalidation';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { computeCurrentPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { quotePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { withTariffBatchFixture } from './helpers/tariff-batch-postgres-fixture';
import { tariffSelectorKey } from './helpers/customer-tariff-reader-fixture';

const actor = '11111111-1111-4111-8111-111111111111';

test('all 6,804 Seedance prices use native bounded admin transactions, refresh current displays and preserve paid history', { timeout: 180_000 }, async () => {
  const saved = ENV.SEEDANCE_2_5_EDIT_TRANSPORT;
  ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'modelark';
  try { await withTariffBatchFixture(async ({ db }) => {
    await db.pool.query(readFileSync('neon/migrations/58_customer_tariff_bulk_interval_lock.sql', 'utf8'));
    const standard = prepareSeedance25CommercialTariffs({ modelId: 'seedance-2-5', at: '2026-01-01', standardEditTransport: 'modelark' });
    const beforeRows = standard.cells.map(cell => ({ id: `old-${cell.id}`, selector_key: tariffSelectorKey(cell.selector),
      selector_json: cell.selector, price_json: cell.price.kind === 'fixed' ? { ...cell.price, customerCents: 10000 }
        : { ...cell.price, components: cell.price.kind === 'unit_components' ? cell.price.components.map(c => ({ ...c,
          flatCents: c.flatCents * 1.25, terms: c.terms.map(t => ({ ...t, centsPerUnit: t.centsPerUnit * 1.25 })) })) : [] } }));
    await db.pool.query(`INSERT INTO app_customer_tariff_cells
      (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      SELECT id,selector_key,selector_json,price_json,'USD','2026-01-01',7,$2
      FROM jsonb_to_recordset($1::jsonb) AS r(id text,selector_key text,selector_json jsonb,price_json jsonb)`, [JSON.stringify(beforeRows), actor]);
    await db.pool.query('UPDATE app_customer_tariff_state SET revision=7');
    await db.pool.query("INSERT INTO app_jobs (job_id,user_id,pricing_snapshot,payment_status) VALUES ('seedance-prior-paid','synthetic-user',$1::jsonb,'paid')",
      [JSON.stringify({ totalCents: 289, frozen: 'previous paid Seedance price' })]);
    const paidBefore = (await db.pool.query("SELECT * FROM app_jobs WHERE job_id='seedance-prior-paid'")).rows;
    const context = standard.scenarios.find(s => s.context.mode === 't2v' && s.context.durationSec === 5
      && s.context.resolution === '720p' && s.context.aspectRatio === '16:9' && !s.context.workflowStep)!.context;
    assert.equal((await computeCurrentPublicSnapshot(context)).totalCents, 10000);
    const publicScenario = { modelId: 'seedance-2-5', mode: 't2v' as const, resolution: '720p', durationSec: 5, aspectRatio: '16:9' };
    const publicBefore = await quotePublicModelScenario(publicScenario);
    assert.equal(publicBefore.status, 'exact');
    if (publicBefore.status !== 'exact') throw new Error('Expected current public price');
    assert.equal(publicBefore.amountCents, 10000);
    const refreshed = new Set<string>();
    const refresh = (modelId: string) => revalidateCustomerTariffChangeSurfaces(modelId, path => { refreshed.add(path); });
    let changed = 0, firstOperation: Awaited<ReturnType<typeof confirmTariffBatch>> | undefined;
    for (const modelId of ['seedance-2-5', 'seedance-2-5-flash'] as const) {
      for (const proposal of prepareSeedanceAdminBatches(modelId)) {
        assert.ok(proposal.intent !== 'rollback');
        const preview = await previewTariffBatch(proposal, actor);
        assert.equal(preview.plan.counts.conflict, 0);
        assert.equal(preview.plan.counts[modelId === 'seedance-2-5' ? 'update' : 'create'], proposal.selections.length);
        const committed = await confirmTariffBatch(preview.id, preview.fingerprint, actor,
          changed === 0 ? () => { throw new Error('simulated page refresh failure'); } : refresh);
        assert.equal(committed.status, 'committed', committed.failure ?? undefined);
        assert.equal(committed.receipt!.changes.length, proposal.selections.length);
        assert.ok(committed.receipt!.lockDurationMs < 5000);
        changed += proposal.selections.length;
        assert.equal(committed.receipt!.revisionAfter, changed + 7);
        if (!firstOperation) {
          firstOperation = committed;
          assert.equal(committed.refreshStatus, 'pending');
          const retried = await refreshTariffBatchPages(committed.id, actor, refresh);
          assert.equal(retried.refreshStatus, 'complete');
          assert.deepEqual(retried.receipt, committed.receipt);
          assert.equal((await db.pool.query('SELECT revision FROM app_customer_tariff_state')).rows[0].revision, String(changed + 7));
        }
      }
    }
    assert.equal(changed, 6804);
    assert.equal((await db.pool.query('SELECT count(*) FROM app_customer_tariff_cell_versions')).rows[0].count, '4860');
    assert.equal((await db.pool.query('SELECT count(*) FROM app_pricing_change_events')).rows[0].count, '6804');
    assert.equal((await db.pool.query('SELECT count(*) FROM app_tariff_batch_receipts')).rows[0].count, '31');
    const historical = (await db.pool.query('SELECT tariff_id AS id,selector_key,selector_json,price_json FROM app_customer_tariff_cell_versions ORDER BY tariff_id')).rows;
    assert.deepEqual(historical, beforeRows.sort((a, b) => a.id.localeCompare(b.id)));
    assert.deepEqual((await db.pool.query("SELECT * FROM app_jobs WHERE job_id='seedance-prior-paid'")).rows, paidBefore);
    assert.deepEqual((await confirmTariffBatch(firstOperation!.id, firstOperation!.fingerprint, actor, refresh)).receipt, firstOperation!.receipt);
    assert.equal((await computeCanonicalBillingSnapshot(context)).totalCents, 232);
    assert.equal((await computeCurrentPublicSnapshot(context)).totalCents, 232);
    const publicAfter = await quotePublicModelScenario(publicScenario);
    assert.equal(publicAfter.status, 'exact');
    if (publicAfter.status !== 'exact') throw new Error('Expected refreshed public price');
    assert.equal(publicAfter.amountCents, 232);
    assert.notEqual(publicAfter.revision, publicBefore.revision);
    const flash = prepareSeedance25CommercialTariffs({ modelId: 'seedance-2-5-flash', at: '2026-01-01', standardEditTransport: 'modelark' });
    const flashContext = flash.scenarios.find(s => s.context.mode === 't2v' && s.context.durationSec === 5
      && s.context.resolution === '720p' && s.context.aspectRatio === '16:9')!.context;
    assert.equal((await computeCurrentPublicSnapshot(flashContext)).totalCents, 121);
    for (const path of ['/', '/fr', '/es', '/pricing', '/fr/tarifs', '/es/precios', '/models', '/models/video',
      '/models/seedance-2-5', '/[locale]/models/[slug]', '/examples/[model]', '/[locale]/examples', '/video/[id]',
      '/ai-video-engines/[slug]', '/pay-as-you-go-ai-video-generator']) assert.ok(refreshed.has(path), path);
  }); } finally { ENV.SEEDANCE_2_5_EDIT_TRANSPORT = saved; }
});
