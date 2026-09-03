import { toUserFacingFailureMessage } from '@/server/user-facing-failure-messages';
import type { ProviderClientErrorPolicy } from '@/types/engines';

const PUBLIC_SEMANTIC_ERROR_CODES = new Set([
  'CONTENT_FLAGGED',
  'CONTENT_POLICY_VIOLATION',
  'POLICY_VIOLATION',
  'PROVIDER_BUSY',
  'RATE_LIMITED',
  'SAFETY',
]);

export function projectProviderErrorResponse(input: {
  policy?: ProviderClientErrorPolicy;
  body: Record<string, unknown>;
}): Record<string, unknown> {
  if (input.policy !== 'opaque') return input.body;
  const rawCode = typeof input.body.error === 'string'
    ? input.body.error.trim().toUpperCase()
    : '';
  const error = PUBLIC_SEMANTIC_ERROR_CODES.has(rawCode)
    ? rawCode
    : 'PROVIDER_REQUEST_FAILED';
  const rawMessage = typeof input.body.message === 'string' ? input.body.message : null;
  return {
    ok: false,
    error,
    message: toUserFacingFailureMessage(rawMessage),
    providerMessage: null,
    detail: null,
  };
}
