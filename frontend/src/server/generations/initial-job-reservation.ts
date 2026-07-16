import { type TransactionQueryExecutor, withDbTransaction } from '@/lib/db';
import type { PricingSnapshot } from '@/types/engines';

export type WalletReservation = 'reserve' | 'already_reserved';

export type TrustedQuotedBilling = {
  pricing: PricingSnapshot;
  membershipTier: 'member' | 'plus' | 'pro';
};

export async function lockInitialJobReservation(executor: TransactionQueryExecutor, jobId: string): Promise<void> {
  await executor.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [jobId]);
}

export async function runInitialJobTransaction<TResult>(
  callback: (executor: TransactionQueryExecutor) => Promise<TResult>
): Promise<TResult> {
  return withDbTransaction((executor) => callback(executor));
}

export async function executeAfterInitialJobReservation<
  TJob,
  TCreated extends { kind: 'created' },
  TExistingResult,
  TSubmittedResult,
>(params: {
  trustedInitialState?: TCreated;
  reserveInitialState: () => Promise<{ kind: 'existing_job'; job: TJob } | TCreated>;
  mapExisting: (job: TJob) => TExistingResult | Promise<TExistingResult>;
  submitProvider: (created: TCreated) => Promise<TSubmittedResult>;
}): Promise<TExistingResult | TSubmittedResult> {
  const initialState = params.trustedInitialState ?? (await params.reserveInitialState());
  if (initialState.kind === 'existing_job') {
    return params.mapExisting(initialState.job);
  }
  return params.submitProvider(initialState);
}
