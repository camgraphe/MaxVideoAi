import type { AdminJobOutcome } from './types';

const FAILED_STATUSES = new Set(['failed', 'error', 'errored', 'cancelled', 'canceled', 'aborted']);
const COMPLETED_STATUSES = new Set(['completed', 'success', 'succeeded', 'finished']);
const IN_PROGRESS_STATUSES = new Set(['pending', 'queued', 'running', 'processing', 'in_progress']);
const OUTCOME_FILTERS: ReadonlySet<AdminJobOutcome> = new Set([
  'failed_action_required',
  'refunded_failure_resolved',
  'completed',
  'in_progress',
  'unknown',
]);

export function isRefundedJob(params: {
  paymentStatus: string | null;
  totalRefundCents: number;
  refundCount: number;
}): boolean {
  if (params.refundCount > 0 || params.totalRefundCents > 0) return true;
  return (params.paymentStatus ?? '').toLowerCase().includes('refunded');
}

export function deriveOutcome(status: string | null, refunded: boolean): AdminJobOutcome {
  const normalized = (status ?? '').toLowerCase();
  if (FAILED_STATUSES.has(normalized)) {
    return refunded ? 'refunded_failure_resolved' : 'failed_action_required';
  }
  if (COMPLETED_STATUSES.has(normalized)) {
    return 'completed';
  }
  if (IN_PROGRESS_STATUSES.has(normalized)) {
    return 'in_progress';
  }
  return 'unknown';
}

export function normalizeOutcomeFilter(value: string | null | undefined): AdminJobOutcome | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (OUTCOME_FILTERS.has(normalized as AdminJobOutcome)) {
    return normalized as AdminJobOutcome;
  }
  return null;
}

export function buildOutcomeSqlCondition(outcome: AdminJobOutcome): string {
  const failedExpr = `LOWER(COALESCE(j.status, '')) IN ('failed','error','errored','cancelled','canceled','aborted')`;
  const completedExpr = `LOWER(COALESCE(j.status, '')) IN ('completed','success','succeeded','finished')`;
  const inProgressExpr = `LOWER(COALESCE(j.status, '')) IN ('pending','queued','running','processing','in_progress')`;
  const refundedExpr =
    `(COALESCE(refunds.refund_count, 0) > 0 OR COALESCE(refunds.total_refund_cents, 0) > 0 OR COALESCE(j.payment_status, '') ILIKE '%refunded%')`;

  if (outcome === 'failed_action_required') {
    return `(${failedExpr} AND NOT ${refundedExpr})`;
  }
  if (outcome === 'refunded_failure_resolved') {
    return `(${failedExpr} AND ${refundedExpr})`;
  }
  if (outcome === 'completed') {
    return completedExpr;
  }
  if (outcome === 'in_progress') {
    return inProgressExpr;
  }
  return `NOT (${failedExpr} OR ${completedExpr} OR ${inProgressExpr})`;
}
