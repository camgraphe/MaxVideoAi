export type PricingAdminErrorCode =
  | 'invalid_payload'
  | 'unknown_engine'
  | 'unknown_mode'
  | 'unknown_resolution'
  | 'unsupported_currency'
  | 'unknown_compatibility_profile'
  | 'ambiguous_selector'
  | 'invalid_number'
  | 'missing_target'
  | 'default_rule_delete_forbidden'
  | 'preview_stale'
  | 'database_unavailable'
  | 'persistence_failed';

const STATUS_BY_CODE: Record<PricingAdminErrorCode, number> = {
  invalid_payload: 400,
  unknown_engine: 400,
  unknown_mode: 400,
  unknown_resolution: 400,
  unsupported_currency: 400,
  unknown_compatibility_profile: 400,
  ambiguous_selector: 400,
  invalid_number: 400,
  missing_target: 404,
  default_rule_delete_forbidden: 400,
  preview_stale: 409,
  database_unavailable: 503,
  persistence_failed: 500,
};

export class PricingAdminError extends Error {
  readonly code: PricingAdminErrorCode;
  readonly status: number;

  constructor(code: PricingAdminErrorCode, message: string) {
    super(message);
    this.name = 'PricingAdminError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}
