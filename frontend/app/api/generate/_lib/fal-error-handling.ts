import { FalGenerationError } from '@/lib/fal';

const TRANSIENT_FAL_STATUS_CODES = new Set([404, 408, 409, 410, 412, 425, 500, 502, 503, 504, 522, 524, 598]);
const CONSTRAINT_ERROR_CODES = new Set([
  'engine_constraint',
  'invalid_input',
  'input_invalid',
  'validation_error',
  'unsupported',
  'payload_invalid',
  'flagged_content',
  'content_flagged',
  'policy_violation',
  'policy_denied',
  'safety_violation',
  'safety',
]);

const FAL_ERROR_FIELDS = [
  'error_message',
  'errorMessage',
  'message',
  'msg',
  'detail',
  'error',
  'reason',
  'status_message',
  'statusMessage',
  'status_reason',
  'statusReason',
  'status_detail',
  'statusDetail',
  'status_description',
  'statusDescription',
  'description',
  'failure',
  'failureReason',
  'cause',
];

export class FalTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FalTimeoutError';
  }
}

export function withFalTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new FalTimeoutError(`Fal request timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }) as Promise<T>;
}

function normalizeFalErrorValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) return null;
    if (/^(error|failed|null|undefined)$/i.test(trimmed)) return null;
    return trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Error) {
    return normalizeFalErrorValue(value.message);
  }
  return null;
}

export function extractFalProviderMessage(payload: unknown): string | null {
  if (!payload || (typeof payload !== 'object' && typeof payload !== 'string')) {
    return normalizeFalErrorValue(payload);
  }

  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length) {
    const current = stack.pop();
    const directText = normalizeFalErrorValue(current);
    if (directText) return directText;
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const record = current as Record<string, unknown>;
    for (const key of FAL_ERROR_FIELDS) {
      if (key in record) {
        const candidate = normalizeFalErrorValue(record[key]);
        if (candidate) return candidate;
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      } else {
        const candidate = normalizeFalErrorValue(value);
        if (candidate) return candidate;
      }
    }
  }

  return null;
}

export function condenseFalErrorMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  const condensed = message.replace(/\s+/g, ' ').trim();
  if (!condensed.length) return null;
  return condensed.length > 400 ? `${condensed.slice(0, 400)}...` : condensed;
}

function isConstraintDetail(detail: unknown): boolean {
  if (!detail) return false;
  if (typeof detail === 'string') {
    const normalized = detail.trim().toLowerCase();
    if (!normalized.length) return false;
    return /support|only|must|should|allowed|invalid|exceed|limit|policy|prohibit|safety|flagged|duration/.test(normalized);
  }
  if (Array.isArray(detail)) {
    return (detail as unknown[]).some((entry) => isConstraintDetail(entry));
  }
  if (typeof detail !== 'object') return false;
  const record = detail as Record<string, unknown>;
  const codes: Array<unknown> = [
    record.code,
    record.error_code,
    record.errorCode,
    record.status_code,
    record.statusCode,
  ];
  for (const candidate of codes) {
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.trim().toLowerCase();
    if (CONSTRAINT_ERROR_CODES.has(normalized)) {
      return true;
    }
  }
  if (Array.isArray(record.errors) && record.errors.length) return true;
  if ('field' in record || 'allowed' in record || 'allowed_values' in record) return true;
  return false;
}

function isSafetyMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('content could not be processed') ||
    normalized.includes('flagged by a content checker') ||
    normalized.includes('policy violation') ||
    normalized.includes('safety system') ||
    normalized.includes('not allowed') ||
    normalized.includes('violates') ||
    normalized.includes('prohibited')
  );
}

function isConstraintMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  if (!normalized.length) return false;
  return (
    normalized.includes('not supported') ||
    normalized.includes('unsupported') ||
    normalized.includes('only supported') ||
    normalized.includes('only support') ||
    normalized.includes('must be') ||
    normalized.includes('should be') ||
    normalized.includes('must provide') ||
    normalized.includes('allowed values') ||
    normalized.includes('invalid value') ||
    normalized.includes('duration') ||
    normalized.includes('exceeds')
  );
}

type FalErrorMetadata = {
  error: unknown;
  status?: number | null;
  detail?: unknown;
  providerMessage?: string | null;
  providerJobId?: string | null;
  attempt?: number;
  maxAttempts?: number;
};

export function shouldDeferFalError(meta: FalErrorMetadata): boolean {
  if (!(meta.error instanceof FalGenerationError)) {
    return false;
  }

  const providerJobId = meta.providerJobId ?? meta.error.providerJobId ?? null;
  if (!providerJobId) return false;

  const status = typeof meta.status === 'number' ? meta.status : meta.error.status;
  if (status === 429 || status === 401 || status === 403) {
    return false;
  }

  const fallbackProviderMessage =
    meta.providerMessage ?? (meta.error instanceof Error ? meta.error.message : null);
  const message = condenseFalErrorMessage(normalizeFalErrorValue(fallbackProviderMessage));
  if (isSafetyMessage(message)) {
    return false;
  }

  if (status === 422) {
    if (isConstraintDetail(meta.detail) || isConstraintMessage(message)) {
      return false;
    }
    if (message && /timeout|timed out|try again|queued|in progress|pending|not ready|still processing|rate limited/i.test(message)) {
      return true;
    }
    return false;
  }

  if (typeof status === 'number' && (TRANSIENT_FAL_STATUS_CODES.has(status) || status === 422 || status === 404)) {
    return true;
  }

  if (message) {
    return /timeout|timed out|try again|queued|in progress|pending|not ready|still processing|rate limited/i.test(
      message
    );
  }

  return false;
}
