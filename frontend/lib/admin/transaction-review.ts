import type { AdminTransactionRecord } from '@/server/admin-transactions';

export function isMissingJobRecord(row: AdminTransactionRecord) {
  return Boolean(row.jobId && !row.jobStatus && !row.jobPaymentStatus && !row.jobEngineLabel && !row.jobVideoUrl);
}

/** Eligibility for a voluntary refund is not an anomaly. */
export function needsTransactionReview(row: AdminTransactionRecord) {
  return isMissingJobRecord(row) || (row.type === 'charge' && row.amountCents <= 0);
}
