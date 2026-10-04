import { createHash } from 'node:crypto';
import { query } from '@/lib/db';
import { adminReportingWindow } from '@/lib/admin/reporting-window';
import {
  TransactionHistoryInputError,
  parseTransactionHistoryParams,
  transactionHistoryParams,
  type TransactionHistoryQuery,
  type TransactionHistoryPage,
} from '@/lib/admin/transaction-history';
import { transactionSelectForCurrentSchema } from './projection';
import { hydrateTransactionRows } from './read-model';
import type { RawTransactionRow } from './types';

type Cursor = { at: string; id: string; scope: string; from: string | null; to: string };
const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= BigInt('9223372036854775807');
const validDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3,6}Z$/.test(value) &&
  Number.isFinite(Date.parse(value));
function historyScope(input: TransactionHistoryQuery) {
  return createHash('sha256')
    .update(JSON.stringify([input.period, input.type, input.query]))
    .digest('hex');
}
function decodeCursor(value: string, scope: string): Cursor {
  try {
    if (value.length > 1500) throw Error();
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (
      cursor.scope !== scope ||
      !validId(cursor.id) ||
      !validDate(cursor.at) ||
      !validDate(cursor.to) ||
      (cursor.from !== null && !validDate(cursor.from))
    )
      throw Error();
    return cursor;
  } catch {
    throw new TransactionHistoryInputError('Invalid history cursor. Start from the first page.');
  }
}
export async function fetchTransactionHistory(
  input: TransactionHistoryQuery,
  now = new Date(),
): Promise<TransactionHistoryPage> {
  const filters = parseTransactionHistoryParams(transactionHistoryParams(input));
  const scope = historyScope(filters);
  const cursor = filters.cursor ? decodeCursor(filters.cursor, scope) : null;
  const window = adminReportingWindow(filters.period, now);
  const from = cursor ? cursor.from : filters.period === 'all' ? null : window.from;
  const to = cursor?.to ?? window.to;
  const values: unknown[] = [];
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  const where = [`r.created_at<=${bind(to)}::timestamptz`];
  if (from) where.push(`r.created_at>=${bind(from)}::timestamptz`);
  if (filters.type === 'attention')
    where.push(
      `((r.job_id IS NOT NULL AND j.status IS NULL AND j.payment_status IS NULL AND j.engine_label IS NULL AND j.video_url IS NULL) OR (r.type='charge' AND r.amount_cents<=0))`,
    );
  else if (filters.type !== 'all') where.push(`r.type=${bind(filters.type)}`);
  if (filters.query) {
    const pattern = bind('%' + filters.query.replace(/[\\%_]/g, '\\$&') + '%');
    where.push(
      `concat_ws(' ',r.id::text,r.user_id::text,r.job_id,r.description,j.engine_label,j.status,j.payment_status,r.type) ILIKE ${pattern} ESCAPE '\\'`,
    );
  }
  if (cursor) where.push(`(r.created_at,r.id)<(${bind(cursor.at)}::timestamptz,${bind(cursor.id)}::bigint)`);
  const transactionSelect = await transactionSelectForCurrentSchema();
  const rows = await query<RawTransactionRow & { cursor_at: string }>(
    `${transactionSelect.replace('r.id AS receipt_id,', `r.id AS receipt_id, to_char(r.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at,`)}
  WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC,r.id DESC LIMIT ${bind(filters.limit + 1)}`,
    values,
  );
  const page = rows.slice(0, filters.limit);
  const last = page.at(-1);
  const nextCursor =
    rows.length > filters.limit && last
      ? Buffer.from(JSON.stringify({ at: last.cursor_at, id: String(last.receipt_id), scope, from, to })).toString(
          'base64url',
        )
      : null;
  return { transactions: await hydrateTransactionRows(page), nextCursor };
}
export async function fetchTransactionReceipt(id: string) {
  if (!validId(id)) throw new TransactionHistoryInputError('Invalid receipt ID');
  const transactionSelect = await transactionSelectForCurrentSchema();
  const rows = await query<RawTransactionRow>(`${transactionSelect} WHERE r.id=$1::bigint`, [id]);
  return (await hydrateTransactionRows(rows))[0] ?? null;
}
