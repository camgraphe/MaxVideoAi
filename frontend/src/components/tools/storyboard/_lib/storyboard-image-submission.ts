import { authFetch } from '@/lib/authFetch';
import type { JobStatusResult } from '@/lib/api-job-status';
import type { ImageGenerationResponse } from '@/types/image-generation';
import type { CaptureStoryboardAccountRequest } from '../_hooks/useStoryboardAccountScope';

const MAX_STATUS_READS = 6;
const STATUS_INTERVAL_MS = 15_000;

function waitForStatusInterval(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => {
      window.clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = window.setTimeout(finish, STATUS_INTERVAL_MS);
    signal.addEventListener('abort', finish, { once: true });
  });
}

export async function resolveStoryboardImageSubmission(
  submission: Promise<ImageGenerationResponse>,
  jobId: string,
  captureRequest: CaptureStoryboardAccountRequest,
  fallbackMessage: string,
): Promise<ImageGenerationResponse> {
  let pendingError = new Error(fallbackMessage);
  try {
    const result = await submission;
    if (!result.pending) return result;
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'provider_outcome_ambiguous') throw error;
    pendingError = error;
  }

  for (let attempt = 0; attempt < MAX_STATUS_READS; attempt++) {
    const request = captureRequest();
    if (!request) break;
    const status = await authFetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${request.accessToken}` },
      signal: request.signal,
    }).then(async response => response.ok ? await response.json() as JobStatusResult : null).catch(() => null);
    if (!request.isCurrent()) break;
    if (status?.jobId === jobId && status.status === 'completed') {
      const images = status.imageRenders ?? status.renderIds?.map(url => ({ url })) ?? [];
      if (!images.length) break;
      return { ok: true, jobId, mode: 'i2i', images, pricing: status.pricing, paymentStatus: status.paymentStatus,
        thumbUrl: status.thumbUrl, aspectRatio: status.aspectRatio };
    }
    if (status?.status === 'failed') throw new Error(status.message ?? fallbackMessage);
    if (status?.outputPreparationState === 'manual_review') break;
    if (attempt + 1 < MAX_STATUS_READS) await waitForStatusInterval(request.signal);
  }
  throw pendingError;
}
