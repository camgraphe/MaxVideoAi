import { isTransactionQueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { collectSellableManualTariffCoverage } from '@/lib/pricing-audit/manual-tariff-coverage';
import { loadPricingPolicyOverridesWithExecutor } from '@/lib/pricing-rule-store';
import { insertPricingChangeEvent } from '@/server/pricing-admin/event-store';
import { customerTariffsEnabledByCode, loadEffectiveCustomerTariffState, upsertCustomerTariffCell } from './customer-tariff-store';
import { prepareSeedanceWorkflowTariffSeed } from './seedance-workflow-tariffs';

/** A bounded local initialization, with locked reproduction of the reviewed normal cents. */
export async function applyLocalSeedanceWorkflowTariffs(executor: TransactionQueryExecutor, input: { actorId: string; fingerprint: string }) {
  if (!isTransactionQueryExecutor(executor) || !customerTariffsEnabledByCode()
    || process.env.NODE_ENV !== 'development' || process.env.PRICING_SANDBOX !== '1') throw new Error('An isolated local development transaction is required.');
  const address = new URL(process.env.DATABASE_URL!);
  const [connection] = await executor.query<{ address: string | null; sockets: string }>(
    `SELECT inet_server_addr() AS address, current_setting('unix_socket_directories') AS sockets`);
  if (!connection || connection.address !== null || !connection.sockets.split(',').map(s => s.trim()).includes(address.searchParams.get('host')!)) {
    throw new Error('Workflow tariff initialization cannot target a remote connection.');
  }
  await executor.query('SELECT revision FROM app_customer_tariff_state WHERE singleton = TRUE FOR UPDATE');
  await executor.query('LOCK TABLE app_customer_tariff_cells, app_pricing_rules IN SHARE ROW EXCLUSIVE MODE');
  const state = await loadEffectiveCustomerTariffState(executor);
  const policy = await loadPricingPolicyOverridesWithExecutor(executor);
  const prepared = await prepareSeedanceWorkflowTariffSeed({ normalScenarios: collectSellableManualTariffCoverage().scenarios, state, policy });
  if (!input.fingerprint || prepared.fingerprint !== input.fingerprint) throw new Error('The reviewed workflow seed changed.');
  if (state.status !== 'loaded' || state.databaseCells.some(cell => prepared.cells.some(candidate => candidate.id === cell.id))) {
    throw new Error('Workflow prices already exist; use their admin preview and confirmation.');
  }
  const persisted = [];
  for (const cell of prepared.cells) persisted.push(await upsertCustomerTariffCell(executor, cell, input.actorId));
  const [current] = await executor.query<{ revision: string }>('SELECT revision FROM app_customer_tariff_state WHERE singleton = TRUE');
  await insertPricingChangeEvent(executor, { domain: 'customer_tariff', operation: 'create', targetId: 'seedance-2-5:workflow-seed',
    actorId: input.actorId, previousState: null, nextState: JSON.parse(JSON.stringify(persisted)),
    previewSummary: { environment: 'isolated_local_sandbox', fingerprint: prepared.fingerprint, sourceRevision: prepared.sourceRevision,
      insertedCells: persisted.length, normalPricesChanged: false },
    affectedScenarioIds: prepared.cells.map(cell => Object.entries(cell.selector).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('|')) });
  return { insertedCells: persisted.length, revision: Number(current.revision) };
}
