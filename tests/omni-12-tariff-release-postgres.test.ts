import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { prepareOmni12TariffRelease, applyOmni12TariffRelease, OMNI_12_TARIFF_EVENT } from '../frontend/server/pricing/omni-12-tariff-release';
import { loadEffectiveCustomerTariffState } from '../frontend/server/pricing/customer-tariff-store';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { omniPreviousTariffState, omniReleaseIdentity, omniSelectorKey } from './helpers/omni-12-tariff-fixture';

test('Omni release appends 456 prices atomically, refuses stale/repeated apply and keeps original quotes', async () => {
  const db = await startDisposablePostgres('omni-12-tariff-release');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  try {
    await db.pool.query(`CREATE TABLE app_pricing_change_events(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),domain TEXT NOT NULL,
      operation TEXT NOT NULL,target_id TEXT NOT NULL,actor_id UUID NOT NULL,previous_state JSONB,next_state JSONB,
      preview_summary JSONB NOT NULL,affected_scenario_ids JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE app_pricing_rules(id TEXT PRIMARY KEY,engine_id TEXT,resolution TEXT,mode TEXT,margin_percent NUMERIC,
      margin_flat_cents INTEGER,surcharge_audio_percent NUMERIC,surcharge_upscale_percent NUMERIC,currency TEXT,
      compatibility_profile TEXT,vendor_account_id TEXT,effective_from TIMESTAMPTZ,updated_at TIMESTAMPTZ,updated_by UUID);`);
    for (const file of ['54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) await db.pool.query(readFileSync(`neon/migrations/${file}`, 'utf8'));
    const fixture = omniPreviousTariffState();
    for (const cell of fixture.databaseCells) await db.pool.query(`INSERT INTO app_customer_tariff_cells
      (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      VALUES($1,$2,$3,$4,'USD',$5,1,$6)`, [cell.id, omniSelectorKey(cell.selector), cell.selector, cell.price, cell.effectiveFrom, omniReleaseIdentity.actorId]);
    await db.pool.query(`INSERT INTO app_customer_tariff_cells(id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      VALUES('untouched','untouched','{"engineId":"veo-3-1","mode":"t2v"}','{"kind":"fixed","customerCents":77}','USD','2026-10-02',1,$1)`, [omniReleaseIdentity.actorId]);
    await db.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=500');
    const before = await loadEffectiveCustomerTariffState();
    const prepared = await prepareOmni12TariffRelease({ ...omniReleaseIdentity, state: before });
    const request = { ...omniReleaseIdentity, authorizedActorId: omniReleaseIdentity.actorId,
      authorizedCandidateCommit: omniReleaseIdentity.candidateCommit, policy: prepared.policy,
      fingerprint: prepared.fingerprint, sourceRevision: prepared.sourceRevision };
    const apply = (patch = {}) => withDbTransaction(executor => applyOmni12TariffRelease(executor, { ...request, ...patch }));
    const context = { engine: getFalEngineById('gemini-omni-flash')!.engine, mode: 't2v' as const, durationSec: 5, resolution: '720p' };
    const originalPaidQuote = await computeCanonicalBillingSnapshot(context);
    assert.equal(originalPaidQuote.totalCents, 67);
    await assert.rejects(apply({ fingerprint: '0'.repeat(64) }), /changed/i);
    await assert.rejects(apply({ sourceRevision: 499 }), /revision/i);
    assert.deepEqual(await loadEffectiveCustomerTariffState(), before);
    await db.pool.query(`CREATE FUNCTION reject_omni_price() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.selector_json->>'resolution'='720p' THEN RAISE EXCEPTION 'injected persistence failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_omni_price BEFORE UPDATE ON app_customer_tariff_cells FOR EACH ROW EXECUTE FUNCTION reject_omni_price();`);
    await assert.rejects(apply(), /injected/);
    assert.deepEqual(await loadEffectiveCustomerTariffState(), before);
    assert.equal((await db.pool.query('SELECT COUNT(*) FROM app_customer_tariff_cell_versions')).rows[0].count, '0');
    assert.equal((await db.pool.query('SELECT COUNT(*) FROM app_pricing_change_events')).rows[0].count, '0');
    await db.pool.query('DROP TRIGGER reject_omni_price ON app_customer_tariff_cells');
    const result = await apply();
    assert.equal(result.updatedCells, 456);
    assert.equal(result.revision, 956);
    assert.equal((await db.pool.query('SELECT COUNT(*) FROM app_customer_tariff_cell_versions')).rows[0].count, '456');
    const event = (await db.pool.query('SELECT previous_state,next_state,preview_summary FROM app_pricing_change_events WHERE target_id=$1', [OMNI_12_TARIFF_EVENT])).rows[0];
    assert.equal(event.previous_state.length, 456);
    assert.equal(event.next_state.length, 456);
    assert.equal(event.preview_summary.historicalChargesChanged, false);
    assert.deepEqual((await db.pool.query("SELECT price_json FROM app_customer_tariff_cells WHERE id='untouched'")).rows[0].price_json, { kind: 'fixed', customerCents: 77 });
    assert.equal((await computeCanonicalBillingSnapshot(context)).totalCents, 101);
    assert.equal((await computeCanonicalPublicSnapshot(context)).totalCents, 101);
    assert.equal(originalPaidQuote.totalCents, 67);
    assert.equal(originalPaidQuote.meta?.customerTariffRevision, 500);
    // Even a fresh preview of the now-higher prices cannot apply this launch a second time.
    const repeated = await prepareOmni12TariffRelease({ ...omniReleaseIdentity, state: await loadEffectiveCustomerTariffState() });
    await assert.rejects(apply({ fingerprint: repeated.fingerprint, sourceRevision: repeated.sourceRevision }), /already applied/i);
    assert.equal((await db.pool.query('SELECT revision FROM app_customer_tariff_state')).rows[0].revision, '956');
    const historic = (await db.pool.query("SELECT price_json FROM app_customer_tariff_cell_versions WHERE selector_json->>'mode'='t2v' AND selector_json->>'resolution'='720p' AND selector_json->>'durationSec'='5'")).rows[0];
    assert.deepEqual(historic.price_json, { kind: 'fixed', customerCents: 67 });
  } finally {
    await getDb().end().catch(() => undefined); await db.cleanup();
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
