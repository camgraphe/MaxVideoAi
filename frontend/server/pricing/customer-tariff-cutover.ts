import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import versionedDocument from '@/config/customer-tariffs.json';
import { isTransactionQueryExecutor, withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { loadPricingPolicyOverridesWithExecutor } from '@/lib/pricing-rule-store';
import { continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { getReadOnlyConfiguredEngineIncludingRuntimePrivate } from '@/server/agent-api/read-only-engine-catalog';
import { fetchEngineSettingsReadOnlyWithExecutor,fetchEngineOverridesReadOnlyWithExecutor } from '@/server/engine-configuration-read';
import { insertPricingChangeEvent } from '@/server/pricing-admin/event-store';
import { customerTariffsEnabledByCode, validateCustomerTariffCell } from './customer-tariff-store';
import { computeCanonicalBillingSnapshot } from './quote-billing';
import { validateCurrentContinuousTariffDomain } from './compile-current-continuous-tariff';
import { assertCustomerTariffCutoverRelease, collectCustomerTariffCutoverCheckpoints, cutoverDigest,
  type CustomerTariffCutoverRelease } from './customer-tariff-cutover-evidence';
import { captureCustomerTariffCutoverBindings, customerTariffCommercialHash, customerTariffCurrentGridHash } from './customer-tariff-cutover-state';
import { pricingCutoverTarget } from './cutover-target';
import { assertReviewedCustomerTariffCutoverPolicy } from './customer-tariff-cutover-policy';
export { captureCustomerTariffCutoverBindings } from './customer-tariff-cutover-state';

type Mode = 'rehearsal' | 'production';
type Target = ReturnType<typeof pricingCutoverTarget>;
const selectedTransactions = new WeakMap<object, { target: Target; mode: Mode }>();
const selectorKey = (value: object) => JSON.stringify(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)));

/** Explicit maintenance connection only. There is no route or command that calls
 * this writer in production. The authored flag remains false on this branch. */
export async function withPricingCutoverTransaction<T>(env: Record<string,string | undefined>,mode: Mode,
  work: (executor: TransactionQueryExecutor) => Promise<T>) {
  const target = pricingCutoverTarget(env);
  if (mode === 'production') {
    if (target.config.host.startsWith('/') || versionedDocument.active !== true || process.env.NODE_ENV !== 'production') {
      throw new Error('Production cutover is disabled by the authored release flag.');
    }
    if (execFileSync('git',['status','--porcelain'],{ encoding: 'utf8' }).trim()) throw new Error('Production cutover requires a clean reviewed Git source.');
  } else if (mode !== 'rehearsal' || !target.config.host.startsWith('/')
    || process.env.NODE_ENV !== 'development' || process.env.PRICING_SANDBOX !== '1'
    || !customerTariffsEnabledByCode()
    || pricingCutoverTarget({ DATABASE_URL: process.env.DATABASE_URL }).databaseIdentity !== target.databaseIdentity) {
    throw new Error('Cutover rehearsal requires the matching isolated development socket.');
  }
  const pool = new Pool({ ...target.config,options: '-c statement_timeout=120000 -c lock_timeout=5000',max: 1 });
  let lost = false;
  const onError = () => { lost = true; };
  pool.on('error',onError);
  try {
    return await withDbTransaction(async (executor,client) => {
      client.on('error',onError);
      selectedTransactions.set(executor,{ target,mode });
      try {
        const result = await work(executor);
        if (lost) throw new Error('Cutover connection lost; inspect immutable events before retrying.');
        return result;
      } finally { selectedTransactions.delete(executor); }
    },{ pool });
  } finally { await pool.end().catch(() => undefined); }
}

async function lockCutover(executor: TransactionQueryExecutor,input: { target: Target; actorId: string; mode: Mode }) {
  const selected = selectedTransactions.get(executor);
  if (!isTransactionQueryExecutor(executor) || !selected || selected.mode !== input.mode
    || selected.target.databaseIdentity !== input.target.databaseIdentity) throw new Error('Cutover requires its explicitly selected transaction.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.actorId)) throw new Error('Invalid cutover actor.');
  const [connection] = await executor.query<{ db: string; user: string; remote: boolean; sockets: string; listeners: string; ssl: boolean }>(
    `SELECT current_database() AS db,current_user AS "user",inet_server_addr() IS NOT NULL AS remote,
      current_setting('unix_socket_directories') AS sockets,current_setting('listen_addresses') AS listeners,
      COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false) AS ssl`);
  if (!connection || connection.db !== selected.target.config.database || connection.user !== selected.target.config.user
    || (input.mode === 'rehearsal' ? connection.remote || connection.listeners !== ''
      || !connection.sockets.split(',').map(s => s.trim()).includes(selected.target.config.host) : !connection.remote || !connection.ssl)) {
    throw new Error('Actual database transport or identity changed.');
  }
  const admins = await executor.query(`SELECT user_id FROM user_roles WHERE user_id=$1::uuid AND role='admin' FOR SHARE`,[input.actorId]);
  if (admins.length !== 1) throw new Error('Cutover actor is not an administrator.');
  const [state] = await executor.query<{ revision: string; active: boolean }>('SELECT revision,active FROM app_customer_tariff_state WHERE singleton=TRUE FOR UPDATE');
  if (!state) throw new Error('Explicit cutover migrations are missing.');
  await executor.query(`LOCK TABLE app_customer_tariff_cells,app_customer_tariff_cell_versions,app_customer_tariff_cutover_events,
    app_pricing_rules,engine_settings,engine_overrides,app_billing_products IN SHARE ROW EXCLUSIVE MODE`);
  return state;
}

/** Initial empty database only. No import of a sandbox revision/history and no
 * deletion of existing prices. All canonical reader checks happen before commit. */
export async function activateInitialCustomerTariffGrid(executor: TransactionQueryExecutor,input: {
  release: CustomerTariffCutoverRelease; fingerprint: string; target: Target; actorId: string; mode: Mode;
}) {
  assertCustomerTariffCutoverRelease(input.release,input.fingerprint,input.mode);
  const state = await lockCutover(executor,input);
  const [counts] = await executor.query<{ cells: number; versions: number; events: number }>(`SELECT
    (SELECT count(*)::int FROM app_customer_tariff_cells) AS cells,
    (SELECT count(*)::int FROM app_customer_tariff_cell_versions) AS versions,
    (SELECT count(*)::int FROM app_customer_tariff_cutover_events) AS events`);
  if (state.active || Number(state.revision) !== 0 || !counts || counts.cells || counts.versions || counts.events) throw new Error('Initial cutover requires empty inactive revision zero.');
  const current = await captureCustomerTariffCutoverBindings(executor,input.target.databaseIdentity);
  if (current.commercialHash !== input.release.bindings.commercialHash) throw new Error('Commercial price inputs changed.');
  if (cutoverDigest(current) !== cutoverDigest(input.release.bindings)) throw new Error('Database, registry, code or factual environment changed.');
  const policy = await loadPricingPolicyOverridesWithExecutor(executor);
  if (policy.status !== 'loaded') throw new Error('Effective database policy unavailable.');
  const effectiveFrom = new Date().toISOString();
  const cells = input.release.cells.map(cell => validateCustomerTariffCell({ ...cell,source: 'database',version: 1,effectiveFrom }));
  const indexed = new Map(cells.map(cell => [selectorKey(cell.selector),cell]));
  if (indexed.size !== cells.length || new Set(cells.map(cell => cell.id)).size !== cells.length) throw new Error('Duplicate candidate identity.');
  const [settings,overrides] = await Promise.all([fetchEngineSettingsReadOnlyWithExecutor(executor),fetchEngineOverridesReadOnlyWithExecutor(executor)]);
  const cases = collectCustomerTariffCutoverCheckpoints();
  const engines = new Map<string,typeof cases[number]['scenario']['context']['engine']>();
  for (const point of cases) {
    if (!engines.has(point.scenario.modelId)) {
      const engine = await getReadOnlyConfiguredEngineIncludingRuntimePrivate(point.scenario.modelId,true,{
        databaseConfigured: () => true,fetchSettings: async () => settings,fetchOverrides: async () => overrides,
      });
      if (!engine) throw new Error('Effective cutover engine configuration is unavailable.');
      engines.set(point.scenario.modelId,engine);
    }
    point.scenario = { ...point.scenario,context: { ...point.scenario.context,engine: engines.get(point.scenario.modelId)! } };
  }
  await assertReviewedCustomerTariffCutoverPolicy({ release: input.release,policy,
    scenarios: cases.filter(row => row.kind === 'ordinary').map(row => row.scenario) });
  const validatedDomains = new Set<string>();
  for (const { scenario } of cases) {
    const continuous = continuousInputTariffSelector(scenario.selector);
    if (!continuous) continue;
    const cell = indexed.get(selectorKey(continuous));
    if (!cell || cell.price.kind === 'fixed') throw new Error('Continuous input domain has no authored rate.');
    if (!validatedDomains.has(cell.id)) {
      validateCurrentContinuousTariffDomain({ context: scenario.context,price: cell.price });
      validatedDomains.add(cell.id);
    }
  }
  await executor.query(`INSERT INTO app_customer_tariff_cells
    (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
    SELECT x.id,x.selector_key,x.selector_json,x.price_json,x.currency,$2::timestamptz,1,$3::uuid
    FROM jsonb_to_recordset($1::jsonb) AS x(id text,selector_key text,selector_json jsonb,price_json jsonb,currency text)`,
  [JSON.stringify(cells.map(cell => ({ id: cell.id,selector_key: selectorKey(cell.selector),selector_json: cell.selector,price_json: cell.price,currency: cell.currency }))),effectiveFrom,input.actorId]);
  await executor.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=1,updated_at=NOW() WHERE singleton=TRUE');
  const expected = new Map(input.release.checkpoints.map(row => [row.key,row]));
  const used = new Set<string>();
  for (const point of cases) {
    const quote = await computeCanonicalBillingSnapshot(point.scenario.context,{ pricingPolicy: { loadOverrides: async () => policy },customerTariffExecutor: executor });
    const row = expected.get(point.key)!;
    if (quote.meta?.pricingMode !== 'manual_tariff' || quote.meta?.customerTariffRevision !== 1
      || quote.totalCents !== row.customerCents || quote.currency !== row.currency) throw new Error(`Canonical cutover quote changed: ${point.key}`);
    used.add(String(quote.meta.customerTariffCellId));
  }
  if (used.size !== cells.length || cells.some(cell => !used.has(cell.id))) throw new Error('Unreviewed extra candidate cell.');
  if (cutoverDigest(await captureCustomerTariffCutoverBindings(executor,input.target.databaseIdentity)) !== cutoverDigest(current)
    || (input.mode === 'production' && execFileSync('git',['status','--porcelain'],{ encoding: 'utf8' }).trim())) {
    throw new Error('Cutover source or environment changed during validation.');
  }
  const gridHash = await customerTariffCurrentGridHash(executor);
  const [event] = await executor.query<{ id: string }>(`INSERT INTO app_customer_tariff_cutover_events
    (operation,actor_id,source_revision,target_revision,fingerprint,certificate,grid_hash)
    VALUES ('activate',$1::uuid,0,1,$2,$3::jsonb,$4) RETURNING id`,[input.actorId,input.fingerprint,JSON.stringify(input.release),gridHash]);
  if (!event) throw new Error('Immutable activation evidence missing.');
  await insertPricingChangeEvent(executor,{ domain: 'customer_tariff',operation: 'update',targetId: 'initial-all-model-cutover',actorId: input.actorId,
    previousState: { active: false,revision: 0 },nextState: { active: true,revision: 1,eventId: event.id,gridHash },
    previewSummary: { fingerprint: input.fingerprint,mode: input.mode,candidateCells: cells.length,checkedQuotes: cases.length },affectedScenarioIds: cases.map(row => row.key) });
  return { revision: 1,eventId: event.id,effectiveFrom,candidateCells: cells.length,checkedQuotes: cases.length };
}

/** Compensating database deactivation, preserving every cell, version, receipt
 * and event. Complete release recovery also restores recorded code/config. */
export async function rollbackInitialCustomerTariffGrid(executor: TransactionQueryExecutor,input: {
  eventId: string; fingerprint: string; target: Target; actorId: string; mode: Mode;
}) {
  const state = await lockCutover(executor,input);
  const [event] = await executor.query<{ id: string; target_revision: string; fingerprint: string; certificate: CustomerTariffCutoverRelease; grid_hash: string }>(
    `SELECT id,target_revision,fingerprint,certificate,grid_hash FROM app_customer_tariff_cutover_events WHERE id=$1::uuid AND operation='activate'`,[input.eventId]);
  if (!event || event.fingerprint !== input.fingerprint) throw new Error('Rollback activation evidence does not match.');
  if (!state.active || Number(state.revision) !== Number(event.target_revision)
    || event.grid_hash !== await customerTariffCurrentGridHash(executor)) throw new Error('Tariffs were edited; rollback cannot overwrite the current revision.');
  if (event.certificate.bindings.databaseIdentity !== input.target.databaseIdentity
    || (input.mode === 'production' && event.certificate.evidenceKind !== 'deployed_production')
    || event.certificate.bindings.commercialHash !== await customerTariffCommercialHash(executor)) throw new Error('Rollback database or commercial inputs changed.');
  const revision = Number(state.revision) + 1;
  const fingerprint = cutoverDigest({ operation: 'rollback',eventId: event.id,revision,activationFingerprint: input.fingerprint });
  const [recovery] = await executor.query<{ id: string }>(`INSERT INTO app_customer_tariff_cutover_events
    (operation,activation_event_id,actor_id,source_revision,target_revision,fingerprint,certificate,grid_hash)
    VALUES ('rollback',$1::uuid,$2::uuid,$3,$4,$5,$6::jsonb,$7) RETURNING id`,[event.id,input.actorId,state.revision,revision,fingerprint,
      JSON.stringify({ activationFingerprint: input.fingerprint,bindings: event.certificate.bindings,deployedSource: event.certificate.deployedSource }),event.grid_hash]);
  if (!recovery) throw new Error('Immutable recovery evidence missing.');
  await executor.query('UPDATE app_customer_tariff_state SET active=FALSE,revision=$1,updated_at=NOW() WHERE singleton=TRUE',[revision]);
  await insertPricingChangeEvent(executor,{ domain: 'customer_tariff',operation: 'rollback',targetId: 'initial-all-model-cutover',actorId: input.actorId,
    previousState: { active: true,revision: Number(state.revision),eventId: event.id },nextState: { active: false,revision,eventId: recovery.id },
    previewSummary: { fingerprint,mode: input.mode,codeRecoveryRequired: true },affectedScenarioIds: [] });
  return { revision,eventId: recovery.id,codeRecoveryRequired: true,deployedSource: event.certificate.deployedSource };
}
