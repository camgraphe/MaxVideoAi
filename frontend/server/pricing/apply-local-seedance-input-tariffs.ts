import { isTransactionQueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { collectSellableManualTariffCoverage, type ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import { insertPricingChangeEvent } from '@/server/pricing-admin/event-store';
import { customerTariffsEnabledByCode, loadEffectiveCustomerTariffState, upsertCustomerTariffCell } from './customer-tariff-store';
import { prepareSeedanceInputTariffSeed } from './seedance-input-tariff-seed';

/** Local initialization only. Existing cells and other model tariffs remain immutable. */
export async function applyLocalSeedanceInputTariffs(executor: TransactionQueryExecutor,
  input: { actorId: string; fingerprint: string },
  scenarios?: readonly ManualTariffCoverageScenario[]) {
  if (!isTransactionQueryExecutor(executor) || !customerTariffsEnabledByCode()
    || process.env.NODE_ENV !== 'development' || process.env.PRICING_SANDBOX !== '1') {
    throw new Error('An isolated local development transaction is required.');
  }
  const address = new URL(process.env.DATABASE_URL!);
  const [connection] = await executor.query<{ address: string | null; sockets: string }>(
    `SELECT inet_server_addr() AS address, current_setting('unix_socket_directories') AS sockets`);
  if (!connection || connection.address !== null
    || !connection.sockets.split(',').map(s => s.trim()).includes(address.searchParams.get('host')!)) {
    throw new Error('Seedance tariff initialization cannot target a remote connection.');
  }
  await executor.query('SELECT revision FROM app_customer_tariff_state WHERE singleton = TRUE FOR UPDATE');
  await executor.query('LOCK TABLE app_customer_tariff_cells, app_pricing_rules IN SHARE ROW EXCLUSIVE MODE');
  const prepared = await prepareSeedanceInputTariffSeed({ scenarios: scenarios ?? collectSellableManualTariffCoverage().scenarios,
    state: await loadEffectiveCustomerTariffState(executor), at: new Date().toISOString() });
  if (!input.fingerprint || prepared.fingerprint !== input.fingerprint) throw new Error('The reviewed Seedance seed changed.');
  const persisted = [];
  for (const cell of prepared.cells) persisted.push(await upsertCustomerTariffCell(executor,cell,input.actorId));
  const [current] = await executor.query<{ revision: string }>('SELECT revision FROM app_customer_tariff_state WHERE singleton = TRUE');
  await insertPricingChangeEvent(executor,{ domain: 'customer_tariff',operation: 'create',
    targetId: 'seedance:proportional-input-seed',actorId: input.actorId,previousState: null,
    nextState: JSON.parse(JSON.stringify(persisted)),previewSummary: {
      environment: 'isolated_local_sandbox',fingerprint: prepared.fingerprint,sourceRevision: prepared.sourceRevision,
      insertedCells: persisted.length,correctedMinimumCount: prepared.correctedMinimumCount,
      marginPolicy: 'preserve_positive_variant_margin',otherPricesChanged: false,
    },affectedScenarioIds: prepared.rows.map(row => row.scenarioId) });
  return { insertedCells: persisted.length,correctedMinimumCount: prepared.correctedMinimumCount,revision: Number(current.revision) };
}
