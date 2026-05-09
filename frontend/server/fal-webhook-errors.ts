import type { FalWebhookPayload } from './fal-webhook-mapping-types';

const ERROR_MESSAGE_KEYS = [
  'error_message',
  'errorMessage',
  'message',
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
  if (!payload || typeof payload !== 'object') {
    return normalizeErrorText(payload);
  }

  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') {
      const text = normalizeErrorText(current);
      if (text) return text;
      continue;
    }
    if (visited.has(current)) continue;
    visited.add(current);

    const record = current as Record<string, unknown>;
    for (const key of ERROR_MESSAGE_KEYS) {
      if (key in record) {
        const candidate = normalizeErrorText(record[key]);
        if (candidate) return candidate;
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      } else {
        const text = normalizeErrorText(value);
        if (text) return text;
      }
    }
  }

  return null;
}

export function extractFalErrorMessage(payload: FalWebhookPayload, additionalContext?: unknown): string | null {
  const direct = normalizeErrorText(payload.error);
  if (direct) return direct;

  const nestedSources: unknown[] = [];
  if (payload.error && typeof payload.error === 'object') {
    nestedSources.push(payload.error);
  }
  if (payload.result) nestedSources.push(payload.result);
  if (payload.response) nestedSources.push(payload.response);
  if (payload.data) nestedSources.push(payload.data);
  if (additionalContext && typeof additionalContext === 'object') {
    nestedSources.push(additionalContext);
  }

  for (const source of nestedSources) {
    const candidate = findFirstErrorMessage(source);
    if (candidate) return candidate;
  }

  const fallback = findFirstErrorMessage(payload);
  if (fallback) return fallback;

  return null;
}
