import { FalGenerationError } from '@/lib/fal-error';
import { FalQueueHttpError } from '@/lib/fal-queue-submit';
import { extractFalErrorMessage } from '@/server/fal-webhook-errors';

type FalTransportEvidence = {
  acceptedRequestId?: string;
  resultReadQualified: boolean;
  singlePost: boolean;
};

/** Normalize one transport failure using only evidence collected by its orchestrator. */
export function createFalTransportError(
  error: unknown,
  { acceptedRequestId, resultReadQualified, singlePost }: FalTransportEvidence,
): FalGenerationError {
  const metadataStatus =
    typeof (error as { $metadata?: { httpStatusCode?: number } } | undefined)?.$metadata?.httpStatusCode === 'number'
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata!.httpStatusCode
      : undefined;
  const statusCandidate =
    typeof (error as { status?: number } | undefined)?.status === 'number'
      ? (error as { status?: number }).status
      : metadataStatus;
  const bodyCandidate =
    (error as { body?: unknown } | undefined)?.body ??
    (error as { response?: unknown } | undefined)?.response ??
    (error as { data?: unknown } | undefined)?.data ??
    null;
  const message = error instanceof Error ? error.message : 'Render request failed';
  const detail = bodyCandidate && typeof bodyCandidate === 'object' && 'detail' in bodyCandidate
    ? bodyCandidate.detail : null;
  const diagnostic = extractFalErrorMessage({ response: bodyCandidate });
  const terminalResult = resultReadQualified && statusCandidate === 422
    && ((typeof detail === 'string' && detail.trim().length > 0) || (Array.isArray(detail) && detail.length > 0))
    && Boolean(diagnostic) && !/timeout|timed out|try again|queued|in progress|pending|not ready|still processing|rate limit|temporar|unavailable/i.test(diagnostic!);
  const falError = new FalGenerationError(message, {
    status: statusCandidate,
    body: bodyCandidate,
    providerJobId: acceptedRequestId,
    cause: error,
    phase: acceptedRequestId
      ? terminalResult ? 'provider_terminal' : 'accepted'
      : singlePost && error instanceof FalQueueHttpError
        && typeof statusCandidate === 'number' && statusCandidate >= 400 && statusCandidate < 500 && statusCandidate !== 408
        ? 'submission_rejected' : 'submission_unknown',
  });
  if ((error as { $metadata?: unknown } | undefined)?.$metadata) {
    (falError as { $metadata?: unknown }).$metadata = (error as { $metadata?: unknown }).$metadata;
  }
  (falError as { originalError?: unknown }).originalError = error;
  return falError;
}
