import { isValidManualTariffPrice, type ManualTariffCell, type ManualTariffSelector } from '@maxvideoai/pricing';

import versionedDocument from '@/config/customer-tariffs.json';
import { continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { createQueryExecutor, getDb, isTransactionQueryExecutor, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';

type RawState = { revision: number | string; active: boolean };
type RawCell = {
  id: string;
  selector_json: unknown;
  price_json: unknown;
  currency: string;
  effective_from: Date | string;
  effective_until: Date | string | null;
  revision: number | string;
};

export type EffectiveCustomerTariffState =
  | { status: 'loaded'; revision: number; active: boolean; versionedCells: ManualTariffCell[]; databaseCells: ManualTariffCell[] }
  | { status: 'unavailable' };

export function customerTariffsEnabledByCode(): boolean {
  // The authored release switch selects production readers, including Vercel previews.
  // Local development keeps its separately guarded, explicitly selected socket.
  if (versionedDocument.active === true && process.env.NODE_ENV === 'production') return true;
  if (process.env.PRICING_SANDBOX !== '1' || process.env.NODE_ENV !== 'development') return false;
  try {
    const address = new URL(process.env.DATABASE_URL ?? '');
    const hosts = address.searchParams.getAll('host');
    return ['localhost', '127.0.0.1'].includes(address.hostname) &&
      hosts.length === 1 && Boolean(hosts[0]?.startsWith('/')) &&
      [...address.searchParams.keys()].every((key) => key === 'host');
  } catch { return false; }
}

function dateIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid customer tariff date');
  return date.toISOString();
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return JSON.parse(value);
}

function integer(value: number | string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('Invalid customer tariff revision');
  return parsed;
}

function selectorKey(selector: ManualTariffSelector): string {
  return JSON.stringify(Object.entries(selector).sort(([left], [right]) => left.localeCompare(right)));
}

export function validateCustomerTariffCell(cell: ManualTariffCell): ManualTariffCell {
  if (cell.source !== 'database' || !cell.id?.trim() || !Number.isSafeInteger(cell.version) || cell.version < 1 ||
      !cell.selector || typeof cell.selector !== 'object' || !cell.selector.engineId?.trim() ||
      Object.entries(cell.selector).some(([key, value]) => !key.trim() || typeof value !== 'string' || !value.trim()) ||
      !/^[A-Z]{3}$/.test(cell.currency) ||
      (cell.effectiveUntil && Date.parse(cell.effectiveUntil) <= Date.parse(cell.effectiveFrom))) {
    throw new Error('Invalid customer tariff cell');
  }
  dateIso(cell.effectiveFrom);
  if (cell.effectiveUntil) dateIso(cell.effectiveUntil);
  if (!isValidManualTariffPrice(cell.price)) throw new Error('Invalid customer tariff price');
  return cell;
}

function mapCell(row: RawCell): ManualTariffCell {
  const cell: ManualTariffCell = {
    id: row.id,
    selector: parseJson(row.selector_json) as ManualTariffSelector,
    source: 'database',
    version: integer(row.revision),
    currency: row.currency,
    effectiveFrom: dateIso(row.effective_from),
    ...(row.effective_until ? { effectiveUntil: dateIso(row.effective_until) } : {}),
    price: parseJson(row.price_json) as ManualTariffCell['price'],
  };
  return validateCustomerTariffCell(cell);
}

type IndexedRawCell = { row: RawCell; order: number };
type LockedQuoteReadBatch = {
  keys: Set<string>;
  state: RawState;
  rows: Map<string, IndexedRawCell[]>;
  versions: Map<string, IndexedRawCell[]>;
};
// Reserved before the first await, and scoped to one still-active transaction.
const lockedQuoteReadBatches = new WeakMap<QueryExecutor, LockedQuoteReadBatch | null>();

function quoteSelectors(selector: ManualTariffSelector): ManualTariffSelector[] {
  const continuous = continuousInputTariffSelector(selector);
  return [selector, ...(continuous ? [continuous] : [])];
}

function indexRawCells(rows: (RawCell & { selector_key: string })[]): Map<string, IndexedRawCell[]> {
  const indexed = new Map<string, IndexedRawCell[]>();
  rows.forEach((row, order) => {
    const existing = indexed.get(row.selector_key) ?? [];
    existing.push({ row, order });
    indexed.set(row.selector_key, existing);
  });
  return indexed;
}

function selectBatchRows(index: Map<string, IndexedRawCell[]>, keys: string[]): RawCell[] {
  // Preserve SQL ordering and every historical interval; isolate returned JSON.
  return structuredClone([...new Set(keys)].flatMap(key => index.get(key) ?? [])
    .sort((a, b) => a.order - b.order).map(value => value.row));
}

/** Maintenance acceptance only: read actual SQL rows once under table locks.
 * Ordinary quote readers keep their exact SQL path. The callback must not write
 * tariff state; this scope ends before the maintenance operation records events. */
export async function withLockedCustomerTariffQuoteReadBatch<T>(
  executor: TransactionQueryExecutor, selectors: ManualTariffSelector[], work: () => Promise<T>,
): Promise<T> {
  if (!isTransactionQueryExecutor(executor)) throw new Error('Tariff read batch requires an active transaction');
  if (lockedQuoteReadBatches.has(executor)) throw new Error('Tariff read batch scope is already active');
  lockedQuoteReadBatches.set(executor, null);
  try {
    const keys = new Set(selectors.flatMap(quoteSelectors).map(selectorKey));
    await executor.query(`LOCK TABLE app_customer_tariff_state, app_customer_tariff_cells,
      app_customer_tariff_cell_versions IN SHARE MODE`);
    const [state] = await executor.query<RawState>('SELECT revision, active FROM app_customer_tariff_state WHERE singleton = TRUE');
    if (!state) throw new Error('Customer tariff state is missing');
    const args = [[...keys]];
    const rows = await executor.query<RawCell & { selector_key: string }>(
      `SELECT id, selector_key, selector_json, price_json, currency, effective_from, effective_until, revision
       FROM app_customer_tariff_cells WHERE selector_key = ANY($1::text[]) ORDER BY id`, args);
    const versions = state.active ? await executor.query<RawCell & { selector_key: string }>(
      `SELECT tariff_id AS id, selector_key, selector_json, price_json, currency, effective_from, effective_until, revision
       FROM app_customer_tariff_cell_versions WHERE selector_key = ANY($1::text[]) ORDER BY tariff_id, revision`, args) : [];
    lockedQuoteReadBatches.set(executor, { keys, state, rows: indexRawCells(rows), versions: indexRawCells(versions) });
    return await work();
  } finally {
    lockedQuoteReadBatches.delete(executor);
  }
}

async function readState(executor: QueryExecutor, selector?: ManualTariffSelector): Promise<EffectiveCustomerTariffState> {
  const selectors = selector ? quoteSelectors(selector) : null;
  const keys = selectors?.map(selectorKey);
  const batch = lockedQuoteReadBatches.get(executor);
  let state: RawState | undefined;
  let rows: RawCell[];
  let versions: RawCell[];
  if (batch && keys && keys.every(key => batch.keys.has(key))) {
    if (!isTransactionQueryExecutor(executor)) throw new Error('Tariff read batch transaction is no longer active');
    state = batch.state;
    rows = selectBatchRows(batch.rows, keys);
    versions = selectBatchRows(batch.versions, keys);
  } else {
    const where = keys ? (keys.length > 1 ? 'WHERE selector_key = ANY($1::text[])' : 'WHERE selector_key = $1') : '';
    const args = keys ? [keys.length > 1 ? keys : keys[0]] : [];
    [state] = await executor.query<RawState>('SELECT revision, active FROM app_customer_tariff_state WHERE singleton = TRUE');
    if (!state) return { status: 'unavailable' };
    if (state.active && keys) {
      // One selected read preserves every interval and the historical/current order.
      const selected = await executor.query<RawCell & { row_source: number }>(
        `SELECT 0 AS row_source, tariff_id AS id, selector_json, price_json, currency, effective_from, effective_until, revision
         FROM app_customer_tariff_cell_versions ${where}
         UNION ALL
         SELECT 1 AS row_source, id, selector_json, price_json, currency, effective_from, effective_until, revision
         FROM app_customer_tariff_cells ${where}
         ORDER BY row_source, id, revision`, args);
      versions = selected.filter(row => row.row_source === 0);
      rows = selected.filter(row => row.row_source === 1);
    } else {
      rows = await executor.query<RawCell>(
        `SELECT id, selector_json, price_json, currency, effective_from, effective_until, revision
         FROM app_customer_tariff_cells ${where} ORDER BY id`, args);
      versions = state.active ? await executor.query<RawCell>(
        `SELECT tariff_id AS id, selector_json, price_json, currency, effective_from, effective_until, revision
         FROM app_customer_tariff_cell_versions ${where} ORDER BY tariff_id, revision`, args) : [];
    }
  }
  if (versionedDocument.schemaVersion !== 1 || !Array.isArray(versionedDocument.cells)) return { status: 'unavailable' };
  return {
    status: 'loaded', revision: integer(state.revision), active: state.active && customerTariffsEnabledByCode(),
    versionedCells: (versionedDocument.cells as ManualTariffCell[])
      .filter((cell) => !selectors || keys?.includes(selectorKey(cell.selector))),
    databaseCells: [...versions, ...rows].map(mapCell),
  };
}

/** A failed database read never becomes an empty versioned-only state. */
export async function loadEffectiveCustomerTariffState(executor?: QueryExecutor): Promise<EffectiveCustomerTariffState> {
  return loadState(executor);
}

/** A quote reads only its exact selector; the admin inventory can explicitly read all cells. */
export async function loadCustomerTariffQuoteState(selector: ManualTariffSelector, executor?: QueryExecutor): Promise<EffectiveCustomerTariffState> {
  return loadState(executor, selector);
}

async function loadState(executor?: QueryExecutor, selector?: ManualTariffSelector): Promise<EffectiveCustomerTariffState> {
  try {
    if (executor) return await readState(executor, selector);
    const client = await getDb().connect();
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const loaded = await readState(createQueryExecutor(client), selector);
      await client.query('COMMIT');
      return loaded;
    } catch {
      await client.query('ROLLBACK').catch(() => undefined);
      return { status: 'unavailable' };
    } finally {
      client.release();
    }
  } catch {
    return { status: 'unavailable' };
  }
}

/** Mutations require the branded executor owned by withDbTransaction. */
export async function upsertCustomerTariffCell(
  executor: TransactionQueryExecutor,
  cell: ManualTariffCell,
  actorId: string,
): Promise<ManualTariffCell> {
  if (!isTransactionQueryExecutor(executor)) throw new Error('Customer tariff writes require an active transaction');
  validateCustomerTariffCell(cell);
  if (!/^[0-9a-f-]{36}$/i.test(actorId)) throw new Error('Invalid customer tariff actor');
  const [state] = await executor.query<RawState>(
    'SELECT revision, active FROM app_customer_tariff_state WHERE singleton = TRUE FOR UPDATE'
  );
  if (!state) throw new Error('Customer tariff state is missing');
  if (state.active) return appendActiveCustomerTariffVersion(executor, cell, actorId, integer(state.revision));
  const nextRevision = integer(state.revision) + 1;
  const [row] = await executor.query<RawCell>(
    `INSERT INTO app_customer_tariff_cells
       (id, selector_key, selector_json, price_json, currency, effective_from, effective_until, revision, updated_by)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6::timestamptz, $7::timestamptz, $8, $9::uuid)
     ON CONFLICT (id) DO UPDATE SET
       selector_key = EXCLUDED.selector_key, selector_json = EXCLUDED.selector_json,
       price_json = EXCLUDED.price_json, currency = EXCLUDED.currency,
       effective_from = EXCLUDED.effective_from, effective_until = EXCLUDED.effective_until,
       revision = EXCLUDED.revision, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING id, selector_json, price_json, currency, effective_from, effective_until, revision`,
    [cell.id, selectorKey(cell.selector), JSON.stringify(cell.selector), JSON.stringify(cell.price), cell.currency,
      cell.effectiveFrom, cell.effectiveUntil ?? null, nextRevision, actorId]
  );
  if (!row) throw new Error('Customer tariff cell was not persisted');
  await executor.query('UPDATE app_customer_tariff_state SET revision = $1, updated_at = NOW() WHERE singleton = TRUE', [nextRevision]);
  return mapCell(row);
}

async function appendActiveCustomerTariffVersion(
  executor: TransactionQueryExecutor, cell: ManualTariffCell, actorId: string, revision: number,
): Promise<ManualTariffCell> {
  const [previous] = await executor.query<RawCell>(
    `SELECT id, selector_json, price_json, currency, effective_from, effective_until, revision
     FROM app_customer_tariff_cells WHERE id = $1 FOR UPDATE`, [cell.id]
  );
  if (previous && (selectorKey(mapCell(previous).selector) !== selectorKey(cell.selector) || previous.currency !== cell.currency)) {
    throw new Error('An active tariff selector and currency cannot be changed');
  }
  // Effective instants belong to the server, never to an admin-supplied historical date.
  let effectiveFrom = new Date().toISOString();
  if (previous) {
    const previousFrom = Date.parse(dateIso(previous.effective_from));
    if (previousFrom > Date.now() + 1000 || previous.effective_until) throw new Error('Invalid current tariff interval');
    while (Date.parse(effectiveFrom) <= previousFrom) {
      await new Promise((done) => setTimeout(done, 1));
      effectiveFrom = new Date().toISOString();
    }
    await executor.query(`INSERT INTO app_customer_tariff_cell_versions
      (tariff_id, selector_key, selector_json, price_json, currency, effective_from, effective_until, revision, updated_by)
      SELECT id, selector_key, selector_json, price_json, currency, effective_from, $2::timestamptz, revision, updated_by
      FROM app_customer_tariff_cells WHERE id = $1`, [cell.id, effectiveFrom]);
  }
  const nextRevision = revision + 1;
  const [persisted] = await executor.query<RawCell>(`INSERT INTO app_customer_tariff_cells
    (id, selector_key, selector_json, price_json, currency, effective_from, effective_until, revision, updated_by)
    VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6::timestamptz, NULL, $7, $8::uuid)
    ON CONFLICT (id) DO UPDATE SET price_json = EXCLUDED.price_json,
      effective_from = EXCLUDED.effective_from, effective_until = NULL,
      revision = EXCLUDED.revision, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    RETURNING id, selector_json, price_json, currency, effective_from, effective_until, revision`,
  [cell.id, selectorKey(cell.selector), JSON.stringify(cell.selector), JSON.stringify(cell.price), cell.currency,
    effectiveFrom, nextRevision, actorId]);
  if (!persisted) throw new Error('Customer tariff version was not persisted');
  await executor.query('UPDATE app_customer_tariff_state SET revision = $1, updated_at = NOW() WHERE singleton = TRUE', [nextRevision]);
  return mapCell(persisted);
}

/** Remove a staged database cell; an active tariff may never silently fall through. */
export async function deleteStagedCustomerTariffCell(
  executor: TransactionQueryExecutor, id: string,
): Promise<number> {
  if (!isTransactionQueryExecutor(executor)) throw new Error('Customer tariff writes require an active transaction');
  const [state] = await executor.query<RawState>(
    'SELECT revision, active FROM app_customer_tariff_state WHERE singleton = TRUE FOR UPDATE'
  );
  if (!state || state.active) throw new Error('Active customer tariffs cannot be deleted');
  const deleted = await executor.query<{ id: string }>('DELETE FROM app_customer_tariff_cells WHERE id = $1 RETURNING id', [id]);
  if (deleted.length !== 1) throw new Error('Customer tariff cell does not exist');
  const revision = integer(state.revision) + 1;
  await executor.query('UPDATE app_customer_tariff_state SET revision = $1, updated_at = NOW() WHERE singleton = TRUE', [revision]);
  return revision;
}
