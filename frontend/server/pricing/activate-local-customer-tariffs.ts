import { createHash } from 'node:crypto';
import { isTransactionQueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { loadPricingPolicyOverridesWithExecutor } from '@/lib/pricing-rule-store';
import { collectSellableManualTariffCoverage, collectEffectiveCustomerTariffBaseline } from '@/lib/pricing-audit/manual-tariff-coverage';
import { insertPricingChangeEvent } from '@/server/pricing-admin/event-store';
import { customerTariffsEnabledByCode, validateCustomerTariffCell } from './customer-tariff-store';
import { assertLocalCustomerTariffReleaseReady, customerTariffScenarioHash, localTariffSourceStateHash,
  prepareLocalCustomerTariffRelease, localCustomerTariffBaseline, type LocalCustomerTariffRelease, type LocalTariffReleaseBindings } from './customer-tariff-release-evidence';
import { computeCanonicalBillingSnapshot } from './quote-billing';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Explicit Unix-socket development operation. Local evidence never authorizes production. */
export async function activateLocalCustomerTariffs(executor: TransactionQueryExecutor, input: {
  release: LocalCustomerTariffRelease; fingerprint: string; currentBindings: LocalTariffReleaseBindings; actorId: string;
}) {
  if (!isTransactionQueryExecutor(executor) || !customerTariffsEnabledByCode()
    || process.env.NODE_ENV !== 'development' || process.env.PRICING_SANDBOX !== '1') throw new Error('Local cutover requires an isolated development transaction.');
  if (!/^[0-9a-f-]{36}$/i.test(input.actorId)) throw new Error('Invalid local cutover actor.');
  const address = new URL(process.env.DATABASE_URL!);
  const [connection] = await executor.query<{ address: string | null; sockets: string }>(
    `SELECT inet_server_addr() AS address, current_setting('unix_socket_directories') AS sockets`);
  if (!connection || connection.address !== null || !connection.sockets.split(',').map(s => s.trim()).includes(address.searchParams.get('host')!)) {
    throw new Error('Local cutover cannot target a remote connection.');
  }
  if (!input.fingerprint || input.fingerprint !== input.release.report.fingerprint) throw new Error('Local cutover confirmation is stale.');
  assertLocalCustomerTariffReleaseReady(input.release, input.currentBindings);
  const coverage = collectSellableManualTariffCoverage();
  if (input.release.report.scenarioHash !== customerTariffScenarioHash(coverage.scenarios)
    || input.release.report.checkedScenarios !== coverage.scenarios.length) throw new Error('Complete current model coverage changed.');
  const [state] = await executor.query<{ revision: string; active: boolean }>(
    'SELECT revision, active FROM app_customer_tariff_state WHERE singleton = TRUE FOR UPDATE');
  if (!state || state.active || Number(state.revision) !== input.currentBindings.sourceTariffRevision) throw new Error('Local tariff state or revision changed.');
  await executor.query('LOCK TABLE app_customer_tariff_cells, app_pricing_rules IN SHARE ROW EXCLUSIVE MODE');
  const staged = await executor.query(`SELECT id, selector_json, price_json, currency, effective_from, effective_until, revision
    FROM app_customer_tariff_cells ORDER BY id`);
  if (localTariffSourceStateHash(state, staged, process.env.DATABASE_URL!) !== input.currentBindings.sourceTariffStateHash) throw new Error('Local staged tariff state changed.');
  const policy = await loadPricingPolicyOverridesWithExecutor(executor);
  if (policy.status !== 'loaded' || hash(JSON.stringify([...policy.rules].sort((a,b) => a.id.localeCompare(b.id)))) !== input.currentBindings.databaseRulesHash) {
    throw new Error('Effective pricing policy changed.');
  }
  // Hashes alone are not proof: reproduce all effective quotes and the complete
  // candidate under the write locks, including each separately approved floor.
  const baseline = await collectEffectiveCustomerTariffBaseline({ at: input.release.report.capturedAt,
    registryHash: input.currentBindings.registryHash, databaseIdentity: input.currentBindings.databaseIdentity,
    scenarios: coverage.scenarios, quote: s => computeCanonicalBillingSnapshot(s.context, {
      pricingPolicy: { loadOverrides: async () => policy }, loadCustomerTariffState: async () => ({ status: 'loaded',
        active: false, revision: Number(state.revision), databaseCells: [], versionedCells: [] }) }) });
  const reproduced = await prepareLocalCustomerTariffRelease({ baseline: localCustomerTariffBaseline(baseline, input.currentBindings.databaseRulesHash, coverage.gaps),
    scenarios: coverage.scenarios, coverageGaps: coverage.gaps, policy,
    ...input.currentBindings, ...(input.release.report.approvedPriceChanges.length ? { approvedGptImage25ReferenceFloor: { capturedAt: baseline.at, registryHash: baseline.registryHash,
      databaseRulesHash: input.currentBindings.databaseRulesHash, databaseIdentity: input.currentBindings.databaseIdentity,
      changes: input.release.report.approvedPriceChanges } } : {}) });
  assertLocalCustomerTariffReleaseReady(reproduced, input.currentBindings);
  if (reproduced.report.fingerprint !== input.fingerprint) throw new Error('Local locked parity certificate changed.');
  const revision = Number(state.revision) + 1;
  const effectiveFrom = new Date().toISOString();
  const cells = input.release.seed.cells.map(cell => validateCustomerTariffCell({ ...cell, source: 'database',
    version: revision, effectiveFrom, effectiveUntil: undefined }));
  const ids = new Set(cells.map(cell => cell.id));
  const key = (selector: object) => JSON.stringify(Object.entries(selector).sort(([a],[b]) => a.localeCompare(b)));
  if (ids.size !== cells.length || new Set(cells.map(cell => key(cell.selector))).size !== cells.length) throw new Error('Duplicate candidate tariff identity.');
  // Archive the entire previously staged grid before replacing it. Failure of any
  // insert, event or activation rolls the transaction back to the original grid.
  const [event] = await executor.query<{ id: string }>(`INSERT INTO app_customer_tariff_local_activation_events
    (actor_id, source_revision, activated_revision, fingerprint, certificate, previous_staged_cells)
    VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb) RETURNING id`,
  [input.actorId, state.revision, revision, input.fingerprint, JSON.stringify(input.release.report), JSON.stringify(staged)]);
  if (!event) throw new Error('Local activation evidence was not persisted.');
  await executor.query('DELETE FROM app_customer_tariff_cells');
  await executor.query(`INSERT INTO app_customer_tariff_cells
    (id, selector_key, selector_json, price_json, currency, effective_from, revision, updated_by)
    SELECT x.id, x.selector_key, x.selector_json, x.price_json, x.currency, $2::timestamptz, $3, $4::uuid
    FROM jsonb_to_recordset($1::jsonb) AS x(id TEXT, selector_key TEXT, selector_json JSONB, price_json JSONB, currency TEXT)`,
  [JSON.stringify(cells.map(cell => ({ id: cell.id, selector_key: key(cell.selector), selector_json: cell.selector, price_json: cell.price, currency: cell.currency }))),
    effectiveFrom, revision, input.actorId]);
  await executor.query('UPDATE app_customer_tariff_state SET active = TRUE, revision = $1, updated_at = NOW() WHERE singleton = TRUE', [revision]);
  await insertPricingChangeEvent(executor, { domain: 'customer_tariff', operation: 'update', targetId: 'local-all-model-cutover', actorId: input.actorId,
    previousState: { active: false, revision: Number(state.revision), archiveEventId: event.id },
    nextState: { active: true, revision, archiveEventId: event.id, candidateHash: input.release.report.candidateHash },
    previewSummary: { fingerprint: input.fingerprint, environment: 'isolated_local_sandbox', approvedPriceChangeCount: input.release.report.approvedPriceChanges.length,
      checkedScenarios: coverage.scenarios.length, candidateCells: cells.length }, affectedScenarioIds: coverage.scenarios.map(row => row.id) });
  return { revision, eventId: event.id, effectiveFrom, candidateCells: cells.length };
}
