import {
  withDbTransaction,
  type TransactionQueryExecutor,
} from '../../frontend/src/lib/db';

void withDbTransaction(async (executor) => {
  const transactionExecutor: TransactionQueryExecutor = executor;
  await transactionExecutor.query('SELECT 1');
});
