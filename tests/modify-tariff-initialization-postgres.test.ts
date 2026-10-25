import assert from 'node:assert/strict';
import test from 'node:test';
import { withDbTransaction } from '../frontend/src/lib/db';
import { loadPricingPolicyOverridesWithExecutor } from '../frontend/src/lib/pricing-rule-store';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { loadEffectiveCustomerTariffState } from '../frontend/server/pricing/customer-tariff-store';
import { prepareModifyTariffs, applyModifyTariffs, MODIFY_TARIFF_POLICY } from '../frontend/server/pricing/modify-tariffs';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { tariffSelectorKey as key, withTariffReaderFixture } from './helpers/customer-tariff-reader-fixture';
import { modifyTariffFixture, modifyReleaseIdentity } from './helpers/modify-tariff-fixture';

test('PG17 Modify initialization rejects stale review, rolls back failures, proves quotes and preserves every existing row', { timeout: 180_000 }, async () => {
  await withTariffReaderFixture(async ({ database }) => {
    const { actorId, candidateCommit } = modifyReleaseIdentity;
    await database.pool.query(`CREATE TABLE user_roles (user_id uuid, role text);
      CREATE TABLE app_admins (user_id uuid);
      UPDATE app_pricing_rules SET margin_percent=0.3;`);
    await database.pool.query("INSERT INTO user_roles VALUES ($1,'admin')", [actorId]);
    const fixture = modifyTariffFixture();
    const policy = await withDbTransaction(loadPricingPolicyOverridesWithExecutor);
    const hdrScenarios = collectSellableManualTariffCoverage({ modelId: 'luma-ray-3-2', mode: 'v2v' }).scenarios
      .filter(scenario => scenario.context.addons?.hdr);
    assert.equal(hdrScenarios.length, 4);
    for (const [index, scenario] of hdrScenarios.entries()) {
      const quote = await computeCanonicalBillingSnapshot(scenario.context, { pricingPolicy: { loadOverrides: async () => policy },
        loadCustomerTariffState: async () => ({ ...fixture, active: false }) });
      fixture.databaseCells.push({ id: `existing-hdr-${index}`, source: 'database', version: 1, currency: 'USD',
        effectiveFrom: '2026-01-01T00:00:00.000Z', selector: scenario.selector,
        price: { kind: 'fixed', customerCents: quote.totalCents } });
    }
    const rows = fixture.databaseCells.map(cell => ({ id: cell.id, selector_key: key(cell.selector),
      selector_json: cell.selector, price_json: cell.price }));
    await database.pool.query(`INSERT INTO app_customer_tariff_cells
      (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      SELECT id,selector_key,selector_json,price_json,'USD','2026-01-01',1,$2
      FROM jsonb_to_recordset($1::jsonb) AS r(id text,selector_key text,selector_json jsonb,price_json jsonb)`, [JSON.stringify(rows), actorId]);
    await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=1749');
    const beforeRows = (await database.pool.query('SELECT * FROM app_customer_tariff_cells ORDER BY id')).rows;
    const prepare = () => withDbTransaction(async executor => prepareModifyTariffs({ ...modifyReleaseIdentity,
      state: await loadEffectiveCustomerTariffState(executor), policy: await loadPricingPolicyOverridesWithExecutor(executor) }));
    const prepared = await prepare();
    const input = { ...modifyReleaseIdentity, authorizedActorId: actorId, authorizedCandidateCommit: candidateCommit,
      fingerprint: prepared.fingerprint, sourceRevision: prepared.sourceRevision, policy: MODIFY_TARIFF_POLICY };
    const assertUnchanged = async () => {
      assert.deepEqual((await database.pool.query('SELECT * FROM app_customer_tariff_cells ORDER BY id')).rows, beforeRows);
      assert.equal((await database.pool.query('SELECT revision FROM app_customer_tariff_state')).rows[0].revision, '1749');
      assert.equal((await database.pool.query('SELECT count(*) FROM app_customer_tariff_cell_versions')).rows[0].count, '0');
      assert.equal((await database.pool.query('SELECT count(*) FROM app_pricing_change_events')).rows[0].count, '0');
    };
    await assertUnchanged();
    await assert.rejects(withDbTransaction(executor => applyModifyTariffs(executor, { ...input, sourceRevision: 1748 })), /changed/i);
    await assert.rejects(withDbTransaction(executor => applyModifyTariffs(executor, { ...input, authorizedActorId: 'other' })), /authorized/i);
    await database.pool.query("UPDATE user_roles SET role='user'");
    await assert.rejects(withDbTransaction(executor => applyModifyTariffs(executor, input)), /administrator/i);
    await database.pool.query("UPDATE user_roles SET role='admin'");
    await database.pool.query("UPDATE app_pricing_rules SET updated_by='changed-policy-binding'");
    await assert.rejects(withDbTransaction(executor => applyModifyTariffs(executor, input)), /changed/i);
    await database.pool.query('UPDATE app_pricing_rules SET updated_by=NULL');
    await database.pool.query(`CREATE FUNCTION reject_modify_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.selector_json->>'engineId'='luma-ray-3-2' AND NEW.selector_json->>'resolution'='720p'
        THEN RAISE EXCEPTION 'injected tariff failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER modify_insert_failure BEFORE INSERT ON app_customer_tariff_cells FOR EACH ROW EXECUTE FUNCTION reject_modify_insert();`);
    await assert.rejects(withDbTransaction(executor => applyModifyTariffs(executor, input)), /injected tariff failure/);
    await assertUnchanged();
    await database.pool.query('DROP TRIGGER modify_insert_failure ON app_customer_tariff_cells');
    await database.pool.query(`CREATE FUNCTION reject_modify_event() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected audit failure'; END $$;
      CREATE TRIGGER modify_event_failure BEFORE INSERT ON app_pricing_change_events FOR EACH ROW EXECUTE FUNCTION reject_modify_event();`);
    await assert.rejects(withDbTransaction(executor => applyModifyTariffs(executor, input)), /injected audit failure/);
    await assertUnchanged();
    await database.pool.query('DROP TRIGGER modify_event_failure ON app_pricing_change_events');
    const result = await withDbTransaction(async executor => {
      const released = await applyModifyTariffs(executor, input);
      const concurrent = await database.pool.connect();
      try {
        await concurrent.query("SET lock_timeout='100ms'");
        await assert.rejects(concurrent.query("UPDATE app_customer_tariff_cells SET currency='USD' WHERE id='kling-original-0'"), /lock timeout/);
      } finally { concurrent.release(); }
      return released;
    });
    assert.equal(result.insertedCells, 49);
    assert.equal(result.revision, 1798);
    const oldRows = (await database.pool.query('SELECT * FROM app_customer_tariff_cells WHERE id=ANY($1::text[]) ORDER BY id', [beforeRows.map(row => row.id)])).rows;
    assert.deepEqual(oldRows, beforeRows);
    const events = (await database.pool.query('SELECT * FROM app_pricing_change_events')).rows;
    assert.equal(events.length, 1);
    assert.equal(events[0].id, result.eventId);
    assert.equal(events[0].next_state.length, 49);
    assert.equal(events[0].preview_summary.fingerprint, prepared.fingerprint);
    assert.equal(events[0].preview_summary.existingPricesChanged, false);
    for (const scenario of collectSellableManualTariffCoverage({ modelId: 'luma-ray-3-2', mode: 'v2v' }).scenarios) {
      const expected = [...fixture.databaseCells, ...prepared.cells].find(cell => key(cell.selector) === key(scenario.selector));
      assert.ok(expected && expected.price.kind === 'fixed');
      const quote = await withDbTransaction(executor => computeCanonicalBillingSnapshot(scenario.context, {
        pricingPolicy: { loadOverrides: async () => policy }, customerTariffExecutor: executor,
      }));
      assert.equal(quote.totalCents, expected.price.customerCents);
      assert.equal(quote.meta?.customerTariffRevision, 1798);
    }
    await assert.rejects(withDbTransaction(executor => applyModifyTariffs(executor, input)), /changed/i);
    assert.equal((await database.pool.query('SELECT count(*) FROM app_customer_tariff_cells')).rows[0].count, String(beforeRows.length + 49));
  });
});
