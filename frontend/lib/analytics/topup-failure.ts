export type TopupFailureCategory = 'authentication' | 'validation' | 'network' | 'stripe' | 'unknown';

const TOPUP_FAILURE_CATEGORIES = new Set<TopupFailureCategory>([
  'authentication',
  'validation',
  'network',
  'stripe',
  'unknown',
]);

export function classifyTopupFailure(reason: unknown): TopupFailureCategory {
  if (typeof reason !== 'string') return 'unknown';
  const normalized = reason.trim().toLowerCase();
  if (!normalized) return 'unknown';
  if (TOPUP_FAILURE_CATEGORIES.has(normalized as TopupFailureCategory)) {
    return normalized as TopupFailureCategory;
  }
  if (/\b(?:401|unauthori[sz]ed|unauthenticated|authentication|sign[ -]?in|log[ -]?in)\b/.test(normalized)) {
    return 'authentication';
  }
  if (/\b(?:invalid|validation|malformed|required|missing|captcha|amount|currency)\b/.test(normalized)) {
    return 'validation';
  }
  if (/\b(?:network|fetch|offline|timeout|timed out|connection)\b/.test(normalized)) {
    return 'network';
  }
  if (/\b(?:stripe|checkout|payment|card|client[_ -]?secret)\b/.test(normalized)) {
    return 'stripe';
  }
  return 'unknown';
}
