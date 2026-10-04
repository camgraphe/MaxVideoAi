import type { AdminTransactionRecord } from '@/server/admin-transactions/types';
export class TransactionHistoryInputError extends Error {}
export type TransactionFilter = 'all' | 'attention' | AdminTransactionRecord['type'];
export type TransactionPeriod = 'today' | '24h' | 'all';
export type TransactionHistoryQuery = {
  query: string;
  type: TransactionFilter;
  period: TransactionPeriod;
  cursor?: string;
  limit: number;
};
export type TransactionHistoryPage = { transactions: AdminTransactionRecord[]; nextCursor: string | null };
export function parseTransactionHistoryParams(params: URLSearchParams): TransactionHistoryQuery {
  const type = params.get('type') ?? 'all';
  const period = params.get('period') ?? 'all';
  if (
    !['all', 'attention', 'charge', 'topup', 'refund', 'discount', 'tax'].includes(type) ||
    !['today', '24h', 'all'].includes(period)
  )
    throw new TransactionHistoryInputError('Invalid transaction filter');
  const query = (params.get('q') ?? '').trim();
  if (query.length > 200) throw new TransactionHistoryInputError('Search is too long');
  const limit = Number(params.get('limit') ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TransactionHistoryInputError('Invalid page size');
  return {
    query,
    type: type as TransactionFilter,
    period: period as TransactionPeriod,
    limit,
    cursor: params.get('cursor') || undefined,
  };
}
export function transactionHistoryParams(query: TransactionHistoryQuery) {
  const params = new URLSearchParams({
    q: query.query,
    type: query.type,
    period: query.period,
    limit: String(query.limit),
  });
  if (query.cursor) params.set('cursor', query.cursor);
  return params;
}
