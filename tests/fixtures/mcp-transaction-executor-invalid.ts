import type {
  QueryExecutor,
  TransactionQueryExecutor,
} from '../../frontend/src/lib/db';

declare const ordinaryExecutor: QueryExecutor;
const invalidTransactionExecutor: TransactionQueryExecutor = ordinaryExecutor;
void invalidTransactionExecutor;
