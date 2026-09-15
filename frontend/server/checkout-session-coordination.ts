import { withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';

type CheckoutSessionLockScope = {
  userId: string;
  ipHash: string;
};

const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 10_000;

type LockAttempt<TResult> =
  | { acquired: false }
  | { acquired: true; value: TResult };

export async function withCheckoutSessionPreparationLock<TResult>(
  { userId, ipHash }: CheckoutSessionLockScope,
  callback: (executor: TransactionQueryExecutor) => Promise<TResult>,
): Promise<TResult> {
  const lockKeys = [...new Set([
    `wallet-checkout-ip:${ipHash}`,
    `wallet-checkout-user:${userId}`,
  ])].sort();
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    const attempt = await withDbTransaction<LockAttempt<TResult>>(async (executor) => {
      for (const lockKey of lockKeys) {
        const rows = await executor.query<{ acquired: boolean }>(
          'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired',
          [lockKey],
        );
        if (!rows[0]?.acquired) return { acquired: false };
      }
      return { acquired: true, value: await callback(executor) };
    });
    if (attempt.acquired) return attempt.value;
    if (Date.now() >= deadline) {
      throw new Error('checkout_session_preparation_lock_timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
  }
}
