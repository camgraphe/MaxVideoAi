const DEFAULT_FAILURE_MESSAGE =
  'MaxVideoAI could not complete this render. Please retry in a few moments. If this keeps happening, contact support with your request ID.';
const DEFAULT_REFUND_REASON = 'Render could not be completed.';
const SEEDANCE_REFERENCE_FAILURE_MESSAGE =
  'Seedance blocked a reference image because it may contain a recognizable person or private content. Use a non-identifiable, stylized, or generated reference image and try again.';
const SEEDANCE_REFERENCE_REFUND_REASON = 'Reference image was blocked by Seedance safety checks.';
const SEEDANCE_START_FAILURE_MESSAGE =
  'Seedance could not start this render. Remove recognizable people from reference images, reduce media complexity, or retry in a few moments.';
const SEEDANCE_START_REFUND_REASON = 'Seedance render could not start.';

type FailureCategory = 'busy' | 'no_output' | 'safety' | 'start' | 'storage' | 'timeout' | 'unsupported';
type SeedanceSpecificFailure = 'reference_safety' | 'start';

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
      'copyright',
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

  if (
    /\b(?:copy|copied|copying)\b/.test(lower) ||
    containsAny(lower, ['storage', 'download', 'fast-start', 'faststart'])
  ) {
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

function classifySeedanceSpecificFailure(message: string | null): SeedanceSpecificFailure | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (!lower.includes('seedance')) return null;
  if (containsAny(lower, ['could not start', 'start failed', 'request failed', 'sync failed'])) {
    return 'start';
  }
  const hasRecognizablePersonSignal = containsAny(lower, [
    'recognizable person',
    'recognisable person',
    'identifiable people',
    'private content',
    'private information',
    'real person',
  ]);
  const hasBlockedImageSignal =
    containsAny(lower, ['reference image', 'input image']) &&
    containsAny(lower, ['blocked', 'safety', 'policy', 'sensitive']);
  if (hasRecognizablePersonSignal || hasBlockedImageSignal) {
    return 'reference_safety';
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
  const seedanceFailure = classifySeedanceSpecificFailure(normalized);
  if (seedanceFailure === 'reference_safety') return SEEDANCE_REFERENCE_FAILURE_MESSAGE;
  if (seedanceFailure === 'start') return SEEDANCE_START_FAILURE_MESSAGE;
  const category = classifyFailure(normalized);
  if (category) return messageForCategory(category);
  if (normalized && canReuseMessage(normalized)) return normalized;
  return DEFAULT_FAILURE_MESSAGE;
}

export function toUserFacingRefundReason(message: string | null | undefined): string {
  const normalized = normalizeMessage(message);
  const seedanceFailure = classifySeedanceSpecificFailure(normalized);
  if (seedanceFailure === 'reference_safety') return SEEDANCE_REFERENCE_REFUND_REASON;
  if (seedanceFailure === 'start') return SEEDANCE_START_REFUND_REASON;
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
