import assert from 'node:assert/strict';
import test from 'node:test';
import { withDbTransaction } from '../frontend/src/lib/db';
import { loadPricingPolicyOverridesWithExecutor } from '../frontend/src/lib/pricing-rule-store';
import { evaluateManualTariffPrice } from '@maxvideoai/pricing/src/manual-tariff-price';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { loadEffectiveCustomerTariffState } from '../frontend/server/pricing/customer-tariff-store';
import { prepareVideoOperationTariffs, applyVideoOperationTariffs, VIDEO_OPERATION_TARIFF_POLICY, videoOperationInitializationScenarios } from '../frontend/server/pricing/video-operation-tariffs';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { tariffSelectorKey as key, withTariffReaderFixture } from './helpers/customer-tariff-reader-fixture';
import { operationTariffState, operationIdentity } from './helpers/video-operation-tariff-fixture';
import { ensureKnownRejectionRefund } from '../frontend/src/server/generations/paid-provider-execution';
import { reservePaidGenerationInitialJob } from '../frontend/src/server/agent-api/paid-generation-execution';
import { hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import type { McpGenerationQuote } from '../frontend/src/server/agent-api/quote-repository';

test('PG17 VideoOperation initialization rejects stale review, rolls back failures, proves quotes and preserves every existing row', { timeout: 180_000 }, async () => {
  await withTariffReaderFixture(async ({ database }) => {
    const { actorId, candidateCommit } = operationIdentity;
    await database.pool.query(`CREATE TABLE user_roles (user_id uuid, role text);
      CREATE TABLE app_admins (user_id uuid);
      UPDATE app_pricing_rules SET margin_percent=0.3,surcharge_audio_percent=0,surcharge_upscale_percent=0;`);
    await database.pool.query("INSERT INTO user_roles VALUES ($1,'admin')", [actorId]);
    const fixture = operationTariffState();
    const policy = await withDbTransaction(loadPricingPolicyOverridesWithExecutor);
    const rows = fixture.databaseCells.map(cell => ({ id: cell.id, selector_key: key(cell.selector),
      selector_json: cell.selector, price_json: cell.price }));
    await database.pool.query(`INSERT INTO app_customer_tariff_cells
      (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      SELECT id,selector_key,selector_json,price_json,'USD','2026-01-01',1,$2
      FROM jsonb_to_recordset($1::jsonb) AS r(id text,selector_key text,selector_json jsonb,price_json jsonb)`, [JSON.stringify(rows), actorId]);
    await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=1798');
    const beforeRows = (await database.pool.query('SELECT * FROM app_customer_tariff_cells ORDER BY id')).rows;
    const prepare = () => withDbTransaction(async executor => prepareVideoOperationTariffs({ ...operationIdentity,
      state: await loadEffectiveCustomerTariffState(executor), policy: await loadPricingPolicyOverridesWithExecutor(executor) }));
    const prepared = await prepare();
    const input = { ...operationIdentity, authorizedActorId: actorId, authorizedCandidateCommit: candidateCommit,
      fingerprint: prepared.fingerprint, sourceRevision: prepared.sourceRevision, policy: VIDEO_OPERATION_TARIFF_POLICY };
    const assertUnchanged = async () => {
      assert.deepEqual((await database.pool.query('SELECT * FROM app_customer_tariff_cells ORDER BY id')).rows, beforeRows);
      assert.equal((await database.pool.query('SELECT revision FROM app_customer_tariff_state')).rows[0].revision, '1798');
      assert.equal((await database.pool.query('SELECT count(*) FROM app_customer_tariff_cell_versions')).rows[0].count, '0');
      assert.equal((await database.pool.query('SELECT count(*) FROM app_pricing_change_events')).rows[0].count, '0');
    };
    await assertUnchanged();
    await assert.rejects(withDbTransaction(executor => applyVideoOperationTariffs(executor, { ...input, sourceRevision: 1797 })), /changed/i);
    await assert.rejects(withDbTransaction(executor => applyVideoOperationTariffs(executor, { ...input, authorizedActorId: 'other' })), /authorized/i);
    await database.pool.query("UPDATE user_roles SET role='user'");
    await assert.rejects(withDbTransaction(executor => applyVideoOperationTariffs(executor, input)), /administrator/i);
    await database.pool.query("UPDATE user_roles SET role='admin'");
    await database.pool.query("UPDATE app_pricing_rules SET updated_by='changed-policy-binding'");
    await assert.rejects(withDbTransaction(executor => applyVideoOperationTariffs(executor, input)), /changed/i);
    await database.pool.query('UPDATE app_pricing_rules SET updated_by=NULL');
    await database.pool.query(`CREATE FUNCTION reject_operation_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.selector_json->>'engineId'='luma-ray-3-2' AND NEW.selector_json->>'resolution'='720p'
        THEN RAISE EXCEPTION 'injected tariff failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER operation_insert_failure BEFORE INSERT ON app_customer_tariff_cells FOR EACH ROW EXECUTE FUNCTION reject_operation_insert();`);
    await assert.rejects(withDbTransaction(executor => applyVideoOperationTariffs(executor, input)), /injected tariff failure/);
    await assertUnchanged();
    await database.pool.query('DROP TRIGGER operation_insert_failure ON app_customer_tariff_cells');
    await database.pool.query(`CREATE FUNCTION reject_operation_event() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected audit failure'; END $$;
      CREATE TRIGGER operation_event_failure BEFORE INSERT ON app_pricing_change_events FOR EACH ROW EXECUTE FUNCTION reject_operation_event();`);
    await assert.rejects(withDbTransaction(executor => applyVideoOperationTariffs(executor, input)), /injected audit failure/);
    await assertUnchanged();
    await database.pool.query('DROP TRIGGER operation_event_failure ON app_pricing_change_events');
    const result = await withDbTransaction(async executor => {
      const released = await applyVideoOperationTariffs(executor, input);
      const concurrent = await database.pool.connect();
      try {
        await concurrent.query("SET lock_timeout='100ms'");
        await assert.rejects(concurrent.query("UPDATE app_customer_tariff_cells SET currency='USD' WHERE id='veo-existing-720p-false'"), /lock timeout/);
      } finally { concurrent.release(); }
      return released;
    });
    assert.equal(result.insertedCells, 89);
    assert.equal(result.revision, 1887);
    const oldRows = (await database.pool.query('SELECT * FROM app_customer_tariff_cells WHERE id=ANY($1::text[]) ORDER BY id', [beforeRows.map(row => row.id)])).rows;
    assert.deepEqual(oldRows, beforeRows);
    const events = (await database.pool.query('SELECT * FROM app_pricing_change_events')).rows;
    assert.equal(events.length, 1);
    assert.equal(events[0].id, result.eventId);
    assert.equal(events[0].next_state.length, 89);
    assert.equal(events[0].preview_summary.fingerprint, prepared.fingerprint);
    assert.equal(events[0].preview_summary.existingPricesChanged, false);
    for (const scenario of videoOperationInitializationScenarios()) {
      const cell = prepared.cells.find(cell => key(cell.selector) === key(continuousInputTariffSelector(scenario.selector) ?? scenario.selector))!;
      assert.ok(cell);
      const quote = await withDbTransaction(executor => computeCanonicalBillingSnapshot(scenario.context, {
        pricingPolicy: { loadOverrides: async () => policy }, customerTariffExecutor: executor }));
      assert.equal(quote.totalCents, evaluateManualTariffPrice(cell.price, scenario.quantities).customerTotalCents);
      assert.equal(quote.meta?.customerTariffRevision, 1887);
    }
    await database.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES ('operation-owner','topup',1000,'USD')");
    const fast = videoOperationInitializationScenarios().find(s => s.context.operation === 'flux-fast-edit')!;
    for (const [index,seconds] of [5.558333,1.1111111111111113e-9].entries()) {
      const context = { ...fast.context, durationSec: seconds, inputVideoDurationSec: seconds };
      const canonicalPricing = await withDbTransaction(executor => computeCanonicalBillingSnapshot(context, {
        pricingPolicy: { loadOverrides: async () => policy }, customerTariffExecutor: executor }));
      const request = { schemaVersion: 1 as const, surface: 'video' as const, engineId: 'flux-3', mode: 'v2v' as const,
        operation: 'flux-fast-edit' as const, prompt: 'Adjust lighting.', settings: { resolution: '720p' },
        references: [{ kind: 'asset' as const, assetId: 'ma_11111111111111111111111111111111', role: 'source' as const }], outputCount: 1 };
      const snapshot = { canonicalPricing, videoOperation: { ...canonicalPricing.meta?.videoOperation as object,
        sourceDurationSec: seconds, sourceFingerprint: 'b'.repeat(64) } };
      const now = new Date(), quote: McpGenerationQuote = { quoteId: `operation-reservation-${index}`, userId: 'operation-owner',
        oauthClientId: 'operation-client', request, requestHash: hashCanonicalGenerationRequest(request), catalogRevision: 'c'.repeat(64),
        pricingSnapshot: snapshot, priceCents: canonicalPricing.totalCents, currency: 'USD', fundingMode: 'wallet', trialFunding: null,
        state: 'prepared', jobId: null, expiresAt: new Date(now.getTime()+600000), claimedAt: null, createdAt: now, updatedAt: now };
      const input = { quote, candidate: { engine: fast.context.engine, surface: 'video' as const, publicModes: ['v2v' as const],
        modeCaps: { v2v: fast.context.engine.modeCaps!.v2v! } }, pricingSnapshot: snapshot };
      const reservation = await withDbTransaction(executor => reservePaidGenerationInitialJob(input,{ executor }));
      assert.equal(reservation.jobId,quote.quoteId);
      const stored = (await database.pool.query('SELECT duration_sec,pricing_snapshot FROM app_jobs WHERE job_id=$1',[quote.quoteId])).rows[0];
      assert.equal(stored.duration_sec,Math.max(1,Math.round(seconds)));
      assert.equal(stored.pricing_snapshot.base.seconds,seconds);
      const receipts = (await database.pool.query('SELECT amount_cents,pricing_snapshot FROM app_receipts WHERE job_id=$1',[quote.quoteId])).rows;
      assert.equal(receipts.length,1);
      assert.equal(receipts[0].amount_cents,canonicalPricing.totalCents);
      assert.equal(canonicalPricing.meta?.supplierReferenceExactCents,seconds*3);
      assert.equal(canonicalPricing.meta?.effective_supplier_charge_verified,false);
      assert.equal(canonicalPricing.meta?.supplierReferenceSettlementRounding,'nearest');
      if (index === 1) assert.equal(canonicalPricing.totalCents,0);
      await assert.rejects(withDbTransaction(executor => reservePaidGenerationInitialJob({ ...input,
        quote: { ...quote, quoteId: `wrong-operation-${index}`, request: { ...request, operation: 'flux-draft-enhance' } } },{ executor })), /operation|source/i);
      await assert.rejects(withDbTransaction(executor => reservePaidGenerationInitialJob({ ...input,
        quote: { ...quote, quoteId: `wrong-quantity-${index}` }, pricingSnapshot: { ...snapshot,
          videoOperation: { ...snapshot.videoOperation, sourceDurationSec: seconds + 1 } } },{ executor })), /source duration/i);
      // Recovery uses the reserved execution snapshot after a newer grid revision.
      await database.pool.query('UPDATE app_customer_tariff_state SET revision=1888');
      assert.equal(await ensureKnownRejectionRefund(reservation.execution,{code:'provider_rejected',message:'Rejected',status:400}),true);
      assert.equal(await ensureKnownRejectionRefund(reservation.execution,{code:'provider_rejected',message:'Rejected',status:400}),true);
      const refunded = (await database.pool.query("SELECT amount_cents,pricing_snapshot FROM app_receipts WHERE job_id=$1 AND type='refund'",[quote.quoteId])).rows;
      assert.equal(refunded.length,1);
      assert.equal(refunded[0].amount_cents,canonicalPricing.totalCents);
      assert.equal(refunded[0].pricing_snapshot.base.seconds,seconds);
      assert.equal(refunded[0].pricing_snapshot.meta.customerTariffRevision,1887);
      assert.equal((await database.pool.query('SELECT payment_status FROM app_jobs WHERE job_id=$1',[quote.quoteId])).rows[0].payment_status,'refunded_wallet');
      await database.pool.query('UPDATE app_customer_tariff_state SET revision=1887');
      await assert.rejects(withDbTransaction(executor => reservePaidGenerationInitialJob({ ...input,
        quote: { ...quote, quoteId: `tampered-${index}`, request: { ...request, settings: { ...request.settings, durationSec: 5 } } } },{ executor })), /source|duration/i);
    }
    await assert.rejects(withDbTransaction(executor => applyVideoOperationTariffs(executor, input)), /changed/i);
    assert.equal((await database.pool.query('SELECT count(*) FROM app_customer_tariff_cells')).rows[0].count, String(beforeRows.length + 89));
  });
});
