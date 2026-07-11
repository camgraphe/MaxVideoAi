export type AgentApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'ACCOUNT_RESTRICTED'
  | 'TRIAL_NOT_ELIGIBLE'
  | 'ENGINE_UNAVAILABLE'
  | 'MODE_UNSUPPORTED'
  | 'PARAMETER_INVALID'
  | 'REFERENCE_REQUIRED'
  | 'REFERENCE_INVALID'
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
