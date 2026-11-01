import type { AdminTransactionRecord } from '@/server/admin-transactions';

export const MILO_PACK_PRODUCT_KEY = 'studio_assistance_pack';
export const MILO_PACK_JOB_PREFIX = 'studio-sol-pack:';

export function isMiloPackTransaction(row: Pick<AdminTransactionRecord, 'billingProductKey' | 'jobId'>) {
  return row.billingProductKey === MILO_PACK_PRODUCT_KEY || Boolean(row.jobId?.startsWith(MILO_PACK_JOB_PREFIX));
}

export function isMissingJobRecord(row: AdminTransactionRecord) {
  return !isMiloPackTransaction(row) && Boolean(row.jobId && !row.jobStatus && !row.jobPaymentStatus && !row.jobEngineLabel && !row.jobVideoUrl);
}

/** Eligibility for a voluntary refund is not an anomaly. */
export function needsTransactionReview(row: AdminTransactionRecord) {
  return isMissingJobRecord(row) || (row.type === 'charge' && row.amountCents <= 0);
}
