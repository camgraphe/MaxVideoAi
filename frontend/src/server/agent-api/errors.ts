export const REFERENCE_ERROR_CODES = [
  'REFERENCE_REQUIRED',
  'REFERENCE_INVALID',
  'REFERENCE_NOT_FOUND',
  'REFERENCE_FORBIDDEN',
  'UPLOAD_EXPIRED',
  'UPLOAD_ALREADY_USED',
] as const;

export type ReferenceErrorCode = (typeof REFERENCE_ERROR_CODES)[number];

export type AgentApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'ACCOUNT_RESTRICTED'
  | 'TRIAL_NOT_ELIGIBLE'
  | 'ENGINE_UNAVAILABLE'
  | 'MODE_UNSUPPORTED'
  | 'PARAMETER_INVALID'
  | ReferenceErrorCode
  | 'QUOTE_EXPIRED'
  | 'QUOTE_ALREADY_CLAIMED'
  | 'CONFIRMATION_REQUIRED'
  | 'SPENDING_LIMIT_EXCEEDED'
  | 'INSUFFICIENT_FUNDS'
  | 'RATE_LIMITED'
  | 'PROVIDER_REJECTED'
  | 'JOB_FAILED'
  | 'INTERNAL_ERROR';

export type AgentApiFailure = {
  ok: false;
  error: {
    code: AgentApiErrorCode;
    message: string;
    retryable: boolean;
    nextAction: Record<string, unknown> | null;
  };
};

export class AgentApiError extends Error {
  constructor(
    readonly code: AgentApiErrorCode,
    message: string,
    readonly retryable = false,
    readonly nextAction: Record<string, unknown> | null = null
  ) {
    super(message);
    this.name = 'AgentApiError';
  }
}

const [,
  REFERENCE_INVALID_CODE,
  REFERENCE_NOT_FOUND_CODE,
  REFERENCE_FORBIDDEN_CODE,
] = REFERENCE_ERROR_CODES;

const MEDIA_NEUTRAL_REFERENCE_MESSAGES: Partial<Record<AgentApiErrorCode, string>> = {
  [REFERENCE_INVALID_CODE]: 'Reference media is not usable.',
  [REFERENCE_NOT_FOUND_CODE]: 'Reference media not found.',
  [REFERENCE_FORBIDDEN_CODE]: 'Reference media is not available.',
};

export function withMediaNeutralReferenceMessage(error: AgentApiError): AgentApiError {
  const message = MEDIA_NEUTRAL_REFERENCE_MESSAGES[error.code];
  return message
    ? new AgentApiError(error.code, message, error.retryable, error.nextAction)
    : error;
}

export function toAgentApiFailure(error: AgentApiError): AgentApiFailure {
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      nextAction: error.nextAction,
    },
  };
}
