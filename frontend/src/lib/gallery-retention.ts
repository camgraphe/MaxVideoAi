import { normalizeJobStatus } from '@/lib/job-status';

export const REFUNDED_FAILED_GALLERY_RETENTION_MS = 60_000;

type GalleryRetentionCandidate = {
  status?: string | null;
  paymentStatus?: string | null;
  createdAt?: string | null;
  failedAt?: number | null;
  videoUrl?: string | null;
  readyVideoUrl?: string | null;
  audioUrl?: string | null;
};

export function isRefundedPaymentStatus(paymentStatus?: string | null): boolean {
  return typeof paymentStatus === 'string' && paymentStatus.toLowerCase().includes('refunded');
}

function resolveFailureTimestamp(candidate: GalleryRetentionCandidate): number | null {
  if (typeof candidate.failedAt === 'number' && Number.isFinite(candidate.failedAt) && candidate.failedAt > 0) {
    return Math.trunc(candidate.failedAt);
  }
  if (typeof candidate.createdAt === 'string' && candidate.createdAt.length > 0) {
    const parsed = Date.parse(candidate.createdAt);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function isExpiredRefundedFailedGalleryItem(
  candidate: GalleryRetentionCandidate,
  now: number = Date.now()
): boolean {
  const hasMedia = Boolean(candidate.videoUrl || candidate.readyVideoUrl || candidate.audioUrl);
  const normalizedStatus = normalizeJobStatus(candidate.status ?? null, hasMedia);
  if (normalizedStatus !== 'failed') return false;
  if (!isRefundedPaymentStatus(candidate.paymentStatus)) return false;
  const failedAt = resolveFailureTimestamp(candidate);
  if (!failedAt) return false;
  return now - failedAt >= REFUNDED_FAILED_GALLERY_RETENTION_MS;
}
