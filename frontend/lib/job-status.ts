const COMPLETED_STATUSES = new Set(['completed', 'success', 'succeeded', 'finished']);
const FAILED_STATUSES = new Set([
  'failed',
  'error',
  'errored',
  'cancelled',
  'canceled',
  'aborted',
  'timeout',
  'timed_out',
  'not_found',
  'missing',
  'expired',
  'unknown',
]);
const PENDING_STATUSES = new Set([
  'pending',
  'running',
  'queued',
  'processing',
  'in_progress',
  'created',
  'waiting',
]);

export function normalizeJobStatus(
  rawStatus: string | null | undefined,
  hasMedia: boolean
): 'pending' | 'completed' | 'failed' | undefined {
  if (!rawStatus) {
    return hasMedia ? 'completed' : undefined;
  }
  const status = rawStatus.toLowerCase();
  if (COMPLETED_STATUSES.has(status)) {
    return hasMedia ? 'completed' : 'pending';
  }
  if (hasMedia && !FAILED_STATUSES.has(status)) {
    return 'completed';
  }
  if (FAILED_STATUSES.has(status)) {
    return 'failed';
  }
  if (PENDING_STATUSES.has(status) || !hasMedia) {
    return 'pending';
  }
  return undefined;
}

export function normalizeJobProgress(
  rawProgress: unknown,
  status: 'pending' | 'completed' | 'failed' | undefined,
  hasMedia: boolean
): number | undefined {
  if (typeof rawProgress === 'number' && Number.isFinite(rawProgress) && rawProgress > 0) {
    const clamped = Math.max(0, Math.min(100, Math.round(rawProgress)));
    return clamped;
  }
  if (status === 'completed' && hasMedia) {
    return 100;
  }
  return undefined;
}

export function normalizeJobMessage(message: unknown): string | undefined {
  if (typeof message !== 'string') return undefined;
  const trimmed = message.trim();
  if (!trimmed.length) return undefined;
  const normalized = trimmed.toLowerCase();
  if (
    normalized.includes('prompt could not be submitted') &&
    (normalized.includes('responsible ai') || normalized.includes('sensitive words') || normalized.includes('safety'))
  ) {
    return 'The provider refused this prompt for safety reasons. Try rephrasing it with safer, more neutral wording.';
  }
  return trimmed;
}

export const JOB_STATUS_SETS = {
  completed: COMPLETED_STATUSES,
  failed: FAILED_STATUSES,
  pending: PENDING_STATUSES,
};
