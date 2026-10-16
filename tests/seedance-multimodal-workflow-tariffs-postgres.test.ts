import assert from 'node:assert/strict';
import test from 'node:test';
import { ENV } from '../frontend/src/lib/env';
import { withDbTransaction } from '../frontend/src/lib/db';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { seedanceInputTariffPriceFromRate } from '../frontend/server/pricing/seedance-input-tariff';
import { loadEffectiveCustomerTariffState } from '../frontend/server/pricing/customer-tariff-store';
import { prepareSeedanceMultimodalWorkflowTariffs, applySeedanceMultimodalWorkflowTariffs,
  SEEDANCE_MULTIMODAL_WORKFLOW_POLICY } from '../frontend/server/pricing/seedance-multimodal-workflow-tariffs';
import { tariffReaderActor as actorId, tariffSelectorKey as key, withTariffReaderFixture } from './helpers/customer-tariff-reader-fixture';

test('PG17 initializes only missing multimodal stages, rejects stale review and rolls back a partial release', { timeout: 180_000 }, async () => {
  const previousTransport = ENV.SEEDANCE_2_5_EDIT_TRANSPORT;
  ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'modelark';
  try { await withTariffReaderFixture(async ({ database }) => {
    const scenarios = collectSellableManualTariffCoverage({ modelId: 'seedance-2-5' }).scenarios.filter(s =>
      ['i2v', 'ref2v', 'v2v', 'extend'].includes(s.context.mode ?? '') && ['480p', '1080p'].includes(s.context.resolution));
    const rows = scenarios.map((scenario, index) => {
      const continuous = continuousInputTariffSelector(scenario.selector);
      const selector = continuous ?? scenario.selector;
      return { id: `source-${index}`, selector_key: key(selector), selector_json: selector,
        price_json: continuous ? seedanceInputTariffPriceFromRate(scenario.context, 1000) : { kind: 'fixed', customerCents: 20000 } };
    });
    assert.equal(rows.length, 1620);
    await database.pool.query(`INSERT INTO app_customer_tariff_cells
      (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      SELECT id,selector_key,selector_json,price_json,'USD','2026-01-01',7,$2
      FROM jsonb_to_recordset($1::jsonb) AS r(id text,selector_key text,selector_json jsonb,price_json jsonb)`, [JSON.stringify(rows), actorId]);
    await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=7');
    const candidateCommit = 'a'.repeat(40);
    const prepared = await withDbTransaction(async executor => prepareSeedanceMultimodalWorkflowTariffs({
      state: await loadEffectiveCustomerTariffState(executor), actorId, candidateCommit }));
    assert.equal(prepared.cells.length, 1620);
    const input = { actorId, candidateCommit, authorizedActorId: actorId, authorizedCandidateCommit: candidateCommit,
      fingerprint: prepared.fingerprint, sourceRevision: prepared.sourceRevision, policy: SEEDANCE_MULTIMODAL_WORKFLOW_POLICY };
    await assert.rejects(withDbTransaction(executor => applySeedanceMultimodalWorkflowTariffs(executor,
      { ...input, authorizedActorId: '22222222-2222-4222-8222-222222222222' })), /authorized/i);
    await assert.rejects(withDbTransaction(executor => applySeedanceMultimodalWorkflowTariffs(executor,
      { ...input, sourceRevision: 6 })), /changed/i);
    await database.pool.query(`CREATE FUNCTION reject_mm_workflow() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.selector_json->>'workflowStep'='final' THEN RAISE EXCEPTION 'injected release failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER mm_release_failure BEFORE INSERT ON app_customer_tariff_cells FOR EACH ROW EXECUTE FUNCTION reject_mm_workflow();`);
    await assert.rejects(withDbTransaction(executor => applySeedanceMultimodalWorkflowTariffs(executor, input)), /injected release failure/);
    assert.equal((await database.pool.query('SELECT COUNT(*) FROM app_customer_tariff_cells')).rows[0].count, '1620');
    assert.equal((await database.pool.query('SELECT revision FROM app_customer_tariff_state')).rows[0].revision, '7');
    await database.pool.query('DROP TRIGGER mm_release_failure ON app_customer_tariff_cells');
    const released = await withDbTransaction(executor => applySeedanceMultimodalWorkflowTariffs(executor, input));
    assert.equal(released.insertedCells, 1620);
    const normalAfter = (await database.pool.query(`SELECT id,selector_key,selector_json,price_json FROM app_customer_tariff_cells
      WHERE selector_json->>'workflowStep' IS NULL ORDER BY id`)).rows;
    assert.deepEqual(normalAfter, [...rows].sort((a, b) => a.id.localeCompare(b.id)));
    assert.equal((await database.pool.query('SELECT COUNT(*) FROM app_pricing_change_events')).rows[0].count, '1');
    await assert.rejects(withDbTransaction(executor => applySeedanceMultimodalWorkflowTariffs(executor, input)), /changed/i);
    assert.equal((await database.pool.query('SELECT COUNT(*) FROM app_customer_tariff_cells')).rows[0].count, '3240');
  }); } finally { ENV.SEEDANCE_2_5_EDIT_TRANSPORT = previousTransport; }
});
