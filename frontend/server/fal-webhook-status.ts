const COMPLETED_STATUSES = new Set(['COMPLETED', 'FINISHED', 'SUCCESS']);
const FAILED_STATUSES = new Set(['FAILED', 'ERROR', 'CANCELLED', 'CANCELED', 'ABORTED']);
const RUNNING_STATUSES = new Set(['RUNNING', 'IN_PROGRESS', 'PROCESSING']);
const QUEUED_STATUSES = new Set(['QUEUED', 'IN_QUEUE', 'PENDING']);

export function normalizeStatus(
  status: string | undefined,
  previousStatus: string,
  previousProgress: number
): { status: string; progress: number } {
  if (!status) {
    return { status: previousStatus, progress: previousProgress };
  }
  const normalized = status.toUpperCase();
  if (COMPLETED_STATUSES.has(normalized)) {
    return { status: 'completed', progress: 100 };
  }
  if (FAILED_STATUSES.has(normalized)) {
    return { status: 'failed', progress: previousProgress };
  }
  if (RUNNING_STATUSES.has(normalized)) {
    return {
      status: 'running',
      progress: Math.max(previousProgress, 25),
    };
  }
  if (QUEUED_STATUSES.has(normalized)) {
    return { status: 'queued', progress: Math.max(previousProgress, 5) };
  }
  return { status: previousStatus, progress: previousProgress };
}

export function isCompletedFalStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return COMPLETED_STATUSES.has(status.toUpperCase());
}

export function isFailedFalStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return FAILED_STATUSES.has(status.toUpperCase());
}
