import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getDb } from '../frontend/src/lib/db';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { listBuildOnlyPrivateFalEngines } from '../scripts/lib/private-engine-catalog-projection';
import { nano21ManualTariffContexts, buildManualTariffCoverageScenario, collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { buildAllModelComparisonScenarios, selectRepresentativeTariffScenario } from '../frontend/server/pricing-admin/policy-read-model';
import { chooseCustomerTariffScenario, loadCustomerTariffInventory, loadCustomerTariffScenarioDetail, previewCustomerTariffChange, confirmCustomerTariffChange, loadCustomerTariffHistory } from '../frontend/server/pricing-admin/customer-tariff-service';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const entry = listBuildOnlyPrivateFalEngines().find(item => item.id === 'nano-banana-2-1')!;
const scenarios = nano21ManualTariffContexts(entry.engine, 't2i').map(context => buildManualTariffCoverageScenario(context, 'offline-admin-candidate'));
const actor = '11111111-1111-4111-8111-111111111111';

test('private admin inventory includes Nano21 without changing executable/public admission', () => {
  const comparison = buildAllModelComparisonScenarios().find(row => row.entry.id === entry.id);
  assert.ok(comparison, 'admin preparation must not require publishing the candidate');
  assert.equal(comparison.scenario.mode, 't2i');
  const representative = selectRepresentativeTariffScenario(comparison.entry, comparison.scenario, scenarios);
  assert.equal(representative?.selector.thinkingLevel, 'MEDIUM');
  assert.equal(representative?.selector.maxOutputTokens, '32768');
  assert.equal(getFalEngineById(entry.id), undefined);
  assert.equal(collectSellableManualTariffCoverage({ modelId: entry.id }).scenarios.length, 0);
});

test('canonical admin controls disambiguate all three exact Nano thinking selectors', () => {
  const ids = new Set<string>();
  for (const thinkingLevel of ['MINIMAL', 'MEDIUM', 'HIGH']) {
    const selected = chooseCustomerTariffScenario(scenarios, { mode: 't2i', resolution: '1K', aspectRatio: '1:1', thinkingLevel });
    assert.equal(selected.scenario.selector.thinkingLevel, thinkingLevel);
    assert.equal(selected.scenario.selector.maxOutputTokens, '32768');
    assert.equal(selected.choices.find(choice => choice.key === 'thinkingLevel')!.value, thinkingLevel);
    ids.add(selected.scenario.id);
  }
  assert.equal(ids.size, 3);
});

test('PG17 canonical Nano admin previews/confirms first exact cells, rejects stale approvals and retains audit/paid history', async () => {
  const db = await startDisposablePostgres('nano21-admin-authority');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  try {
    await createPaidGenerationTestSchema(db.pool);
    for (const file of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) await db.pool.query(readFileSync('neon/migrations/' + file, 'utf8'));
    assert.equal((await db.pool.query('SHOW server_version_num')).rows[0].server_version_num.slice(0, 2), '17');
    await db.pool.query(`INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id,surface,pricing_snapshot) VALUES ('offline-owner','charge',41,'USD','historical-nano2','image',$1::jsonb)`, [JSON.stringify({ totalCents: 41, engineId: 'nano-banana-2', immutable: true })]);
    const paidBefore = (await db.pool.query('SELECT * FROM app_receipts ORDER BY id')).rows;
    const count = async () => Number((await db.pool.query('SELECT count(*) AS n FROM app_customer_tariff_cells')).rows[0].n);
    const selected = (thinkingLevel: string) => scenarios.find(s => s.selector.thinkingLevel === thinkingLevel && s.selector.resolution === '1K' && s.selector.aspectRatio === '1:1')!;
    const proposal = (thinkingLevel: string, customerCents = 913) => ({ operation: 'create' as const, scenarioId: selected(thinkingLevel).id, customerCents });
    // This first preview crosses scenarioById and canonical exact billing; no direct tariff insert is allowed.
    const first = await previewCustomerTariffChange(proposal('MINIMAL'));
    assert.equal(first.currentCents, null);
    assert.equal(first.active, false);
    assert.equal(first.previousCell, null);
    assert.equal(first.proposedCell!.selector.maxOutputTokens, '32768');
    assert.equal(first.proposedCell!.selector.thinkingLevel, 'MINIMAL');
    assert.equal(await count(), 0, 'preview writes no cell');
    const inventory = await loadCustomerTariffInventory();
    assert.ok(inventory.rows.some(row => row.modelId === entry.id && row.currentCents === null));
    assert.ok(inventory.rows.some(row => row.modelId === 'kling-v4'));
    assert.ok(inventory.rows.some(row => row.modelId === 'nano-banana-2'));
    await assert.rejects(confirmCustomerTariffChange(proposal('MINIMAL', 914), first.fingerprint, actor, () => {}), { code: 'preview_stale' });
    const minimal = await confirmCustomerTariffChange(proposal('MINIMAL'), first.fingerprint, actor, () => {});
    assert.equal(minimal.revision, 1);
    await assert.rejects(computeCanonicalBillingSnapshot(selected('MINIMAL').context), /active reviewed Nano/);
    const waitingMedium = await previewCustomerTariffChange(proposal('MEDIUM'));
    const highPreview = await previewCustomerTariffChange(proposal('HIGH'));
    await confirmCustomerTariffChange(proposal('HIGH'), highPreview.fingerprint, actor, () => {});
    await assert.rejects(confirmCustomerTariffChange(proposal('MEDIUM'), waitingMedium.fingerprint, actor, () => {}), { code: 'preview_stale' });
    const freshMedium = await previewCustomerTariffChange(proposal('MEDIUM'));
    await confirmCustomerTariffChange(proposal('MEDIUM'), freshMedium.fingerprint, actor, () => {});
    assert.equal(await count(), 3);
    for (const thinkingLevel of ['MINIMAL', 'MEDIUM', 'HIGH']) {
      const detail = await loadCustomerTariffScenarioDetail(entry.id, { mode: 't2i', resolution: '1K', aspectRatio: '1:1', thinkingLevel });
      assert.equal(detail.selector.thinkingLevel, thinkingLevel);
      assert.equal(detail.currentCents, null);
      assert.equal(detail.stagedCents, 913);
    }
    const update = { operation: 'update' as const, scenarioId: selected('MEDIUM').id, customerCents: 915 };
    const changed = await confirmCustomerTariffChange(update, (await previewCustomerTariffChange(update)).fingerprint, actor, () => {});
    const rollback = { operation: 'rollback' as const, scenarioId: selected('MEDIUM').id, eventId: changed.event.id };
    await confirmCustomerTariffChange(rollback, (await previewCustomerTariffChange(rollback)).fingerprint, actor, () => {});
    assert.equal((await loadCustomerTariffScenarioDetail(entry.id, { mode: 't2i', thinkingLevel: 'MEDIUM', resolution: '1K', aspectRatio: '1:1' })).stagedCents, 913);
    const remove = { operation: 'rollback' as const, scenarioId: selected('MINIMAL').id, eventId: minimal.event.id };
    await confirmCustomerTariffChange(remove, (await previewCustomerTariffChange(remove)).fingerprint, actor, () => {});
    assert.equal(await count(), 2, 'rollback appends history then removes only its staged exact target');
    const events = await loadCustomerTariffHistory();
    assert.equal(events.length, 6);
    assert.ok(events.every(event => event.actorId === actor));
    assert.equal(events.filter(event => event.operation === 'rollback').length, 2);
    // Active-but-missing is a distinct fixture state; first-cell creation still uses the admin owner.
    await db.pool.query('UPDATE app_customer_tariff_state SET active=TRUE WHERE singleton=TRUE');
    const missing = await loadCustomerTariffScenarioDetail(entry.id, { mode: 'i2i', thinkingLevel: 'HIGH', resolution: '1K', aspectRatio: '16:9' });
    assert.equal(missing.currentCents, null);
    const missingProposal = { operation: 'create' as const, scenarioId: missing.scenarioId, customerCents: 917 };
    const missingPreview = await previewCustomerTariffChange(missingProposal);
    assert.equal(missingPreview.currentCents, null);
    await confirmCustomerTariffChange(missingProposal, missingPreview.fingerprint, actor, () => {});
    assert.equal((await loadCustomerTariffScenarioDetail(entry.id, missing.selector)).currentCents, 917);
    await assert.rejects(computeCanonicalBillingSnapshot({ ...selected('HIGH').context, maxOutputTokens: 4096 }));
    assert.deepEqual((await db.pool.query('SELECT * FROM app_receipts ORDER BY id')).rows, paidBefore);
    assert.equal(getFalEngineById(entry.id), undefined);
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
