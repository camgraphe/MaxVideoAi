const DEFAULT_FAILURE_MESSAGE =
  'MaxVideoAI could not complete this render. Please retry in a few moments. If this keeps happening, contact support with your request ID.';
const DEFAULT_REFUND_REASON = 'Render could not be completed.';

type FailureCategory = 'busy' | 'no_output' | 'safety' | 'start' | 'storage' | 'timeout' | 'unsupported';

const PROVIDER_OR_INTERNAL_PATTERN =
  /\b(?:fal(?:\.ai)?|fail\.ai|byteplus|modelark|google\s+vertex|vertex\s+veo|google\s+veo\s+direct|kling\s+direct|provider|providers|provider_job_id|request_id|webhook|polling|api\s*key)\b/i;
const URL_OR_PAYLOAD_PATTERN = /https?:\/\/|\/v\d+\/|{.*}|^\[[\s\S]*\]$/i;

function normalizeMessage(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized?.length ? normalized : null;
}

function containsAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function classifyFailure(message: string | null): FailureCategory | null {
  if (!message) return null;
  const lower = message.toLowerCase();

  if (
    containsAny(lower, [
      'responsible ai',
      'sensitive words',
      'content policy',
      'policy violation',
      'safety',
      'moderation',
      'prohibited content',
      'flagged',
      'refused this prompt',
      'blocked',
    ])
  ) {
    return 'safety';
  }

  if (
    containsAny(lower, [
      'unsupported',
      'not supported',
      'invalid request',
      'invalid_request',
      'unprocessable',
      'cannot be processed for this engine',
      'selected inputs',
      'does not support',
    ])
  ) {
    return 'unsupported';
  }

  if (
    containsAny(lower, [
      'no result',
      'no video',
      'no video url',
      'no video output',
      'no usable output',
      'returned no',
      'without a usable output',
    ])
  ) {
    return 'no_output';
  }

  if (containsAny(lower, ['copy', 'copied', 'storage', 'download', 'fast-start', 'faststart'])) {
    return 'storage';
  }

  if (
    containsAny(lower, [
      'timeout',
      'timed out',
      'processing window',
      'expected window',
      'grace period',
      'non-terminal',
      'not ready',
      'exceeded',
    ])
  ) {
    return 'timeout';
  }

  if (
    containsAny(lower, [
      'rate limiting',
      'rate limit',
      'temporarily unavailable',
      'temporarily busy',
      'quota',
      'provider credits',
      'credits exhausted',
      'too many requests',
      'queue is',
    ])
  ) {
    return 'busy';
  }

  if (
    containsAny(lower, [
      'could not start',
      'start failed',
      'request failed',
      'sync failed',
      'missing provider_job_id',
      'provider job',
      'unable to determine',
      'status unavailable',
      'not found',
      'expired',
    ])
  ) {
    return 'start';
  }

  return null;
}

function messageForCategory(category: FailureCategory): string {
  switch (category) {
    case 'busy':
      return 'The render queue is temporarily busy. Please retry in a few moments.';
    case 'no_output':
      return 'The render finished without a usable output. Please retry or contact support with your request ID if it happens again.';
    case 'safety':
      return 'This request was blocked by safety checks. Try rephrasing it with safer, more neutral wording.';
    case 'start':
      return 'MaxVideoAI could not start this render. Please retry in a few moments.';
    case 'storage':
      return 'The render finished, but MaxVideoAI could not prepare the output for download. Please retry.';
    case 'timeout':
      return 'This render exceeded the expected processing window. Please retry in a few moments.';
    case 'unsupported':
      return 'This request is not supported with the selected inputs. Adjust the prompt, media, or settings and try again.';
  }
}

function refundReasonForCategory(category: FailureCategory): string {
  switch (category) {
    case 'busy':
      return 'Render queue was temporarily busy.';
    case 'no_output':
      return 'Render finished without a usable output.';
    case 'safety':
      return 'Request was blocked by safety checks.';
    case 'start':
      return 'Render could not start.';
    case 'storage':
      return 'Output could not be prepared for download.';
    case 'timeout':
      return 'Render exceeded the expected processing window.';
    case 'unsupported':
      return 'Request was not supported with the selected inputs.';
  }
}

function canReuseMessage(message: string): boolean {
  return (
    message.length <= 260 &&
    !PROVIDER_OR_INTERNAL_PATTERN.test(message) &&
    !URL_OR_PAYLOAD_PATTERN.test(message)
  );
}

function sanitizeEngineLabel(value: string | null | undefined): string {
  const normalized = normalizeMessage(value) ?? 'Render';
  return normalized
    .replace(/\s+direct\b/gi, '')
    .replace(PROVIDER_OR_INTERNAL_PATTERN, 'Render')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDurationSec(value: number | string | null | undefined): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

export function toUserFacingFailureMessage(message: string | null | undefined): string {
  const normalized = normalizeMessage(message);
  const category = classifyFailure(normalized);
  if (category) return messageForCategory(category);
  if (normalized && canReuseMessage(normalized)) return normalized;
  return DEFAULT_FAILURE_MESSAGE;
}

export function toUserFacingRefundReason(message: string | null | undefined): string {
  const normalized = normalizeMessage(message);
  const category = classifyFailure(normalized);
  if (category) return refundReasonForCategory(category);
  if (normalized && canReuseMessage(normalized)) return normalized;
  return DEFAULT_REFUND_REASON;
}

export function buildUserFacingRefundDescription(params: {
  engineLabel?: string | null;
  durationSec?: number | string | null;
  reason?: string | null;
}): string {
  const pieces = [`Refund ${sanitizeEngineLabel(params.engineLabel)}`];
  const durationSec = normalizeDurationSec(params.durationSec);
  if (durationSec) pieces.push(`${durationSec}s`);
  pieces.push(toUserFacingRefundReason(params.reason));
  return pieces.join(' - ');
}
