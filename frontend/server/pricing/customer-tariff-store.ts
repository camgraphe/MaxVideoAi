import type { ManualTariffCell, ManualTariffSelector } from '@maxvideoai/pricing';

import versionedDocument from '@/config/customer-tariffs.json';
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
  if (cell.price.kind === 'fixed') {
    if (!Number.isSafeInteger(cell.price.customerCents) || cell.price.customerCents < 0) throw new Error('Invalid customer cents');
  } else if (cell.price.kind === 'unit_terms') {
    const units = cell.price.terms.map((term) => term.unit);
    if (!['up', 'nearest'].includes(cell.price.rounding) || !units.length || new Set(units).size !== units.length ||
        cell.price.terms.some((term) => !term.unit.trim() || !Number.isFinite(term.centsPerUnit) || term.centsPerUnit < 0)) {
      throw new Error('Invalid customer tariff units');
    }
  } else {
    throw new Error('Unknown customer tariff price kind');
  }
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

async function readState(executor: QueryExecutor): Promise<EffectiveCustomerTariffState> {
  const [state] = await executor.query<RawState>('SELECT revision, active FROM app_customer_tariff_state WHERE singleton = TRUE');
  if (!state) return { status: 'unavailable' };
  const rows = await executor.query<RawCell>(
    'SELECT id, selector_json, price_json, currency, effective_from, effective_until, revision FROM app_customer_tariff_cells ORDER BY id'
  );
  if (versionedDocument.schemaVersion !== 1 || !Array.isArray(versionedDocument.cells)) return { status: 'unavailable' };
  return {
    status: 'loaded', revision: integer(state.revision), active: state.active && versionedDocument.active,
    versionedCells: versionedDocument.cells as ManualTariffCell[], databaseCells: rows.map(mapCell),
  };
}

/** A failed database read never becomes an empty versioned-only state. */
export async function loadEffectiveCustomerTariffState(executor?: QueryExecutor): Promise<EffectiveCustomerTariffState> {
  try {
    if (executor) return await readState(executor);
    const client = await getDb().connect();
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const loaded = await readState(createQueryExecutor(client));
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
