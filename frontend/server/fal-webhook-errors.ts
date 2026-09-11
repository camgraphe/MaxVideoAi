import type { FalWebhookPayload } from './fal-webhook-mapping-types';

const ERROR_MESSAGE_KEYS = [
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

function normalizeErrorText(value: unknown): string | null {
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
    return normalizeErrorText(value.message);
  }
  return null;
}

function findFirstErrorMessage(payload: unknown): string | null {
  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];
  let transportFallback: string | null = null;

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') {
      const text = normalizeErrorText(current);
      if (text) {
        if (isTransportError(text)) transportFallback ??= text;
        else return text;
      }
      continue;
    }
    if (visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      stack.push(...current.slice(0, 50).reverse());
      continue;
    }
    const record = current as Record<string, unknown>;
    if (record.type === 'content_policy_violation') {
      return 'The request content was blocked by safety checks. Review the prompt and reference media before trying again.';
    }
    // Traverse diagnostic containers only. Never treat echoed input, media URLs,
    // request IDs, status values, metrics or seeds as a failure explanation.
    const keys = ['payload', 'body', ...ERROR_MESSAGE_KEYS, 'result', 'response', 'data'];
    for (const key of keys.reverse()) {
      if (record[key] != null) stack.push(record[key]);
    }
  }
  return transportFallback;
}

function isTransportError(message: string): boolean {
  return /^(?:(?:unexpected|invalid)\s+)?(?:http\s+)?status(?:\s+code)?\s*:?\s*\d{3}\b|^unprocessable entity$/i.test(message);
}

export function extractFalErrorMessage(payload: FalWebhookPayload, additionalContext?: unknown): string | null {
  let fallback: string | null = null;
  for (const source of [payload.payload, additionalContext, payload.error, payload.result, payload.response, payload.data, payload]) {
    const candidate = findFirstErrorMessage(source);
    if (!candidate) continue;
    if (!isTransportError(candidate)) return candidate;
    fallback ??= candidate;
  }
  return fallback;
}
