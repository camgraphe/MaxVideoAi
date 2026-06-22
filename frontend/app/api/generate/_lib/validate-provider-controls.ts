import type { ValidationResult } from './validate-types';

export function validateProviderControls(payload: Record<string, unknown>): ValidationResult {
  const seed = payload['seed'];
  if (seed !== undefined) {
    if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 2147483647) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'seed',
          message: 'Seed must be an integer between 0 and 2147483647',
          allowed: [0, 2147483647],
          value: seed,
        },
      };
    }
  }

  const safetyChecker = payload['enable_safety_checker'];
  if (safetyChecker !== undefined && typeof safetyChecker !== 'boolean') {
    return {
      ok: false,
      error: {
        code: 'ENGINE_CONSTRAINT',
        field: 'enable_safety_checker',
        message: 'Safety checker must be true or false',
        value: safetyChecker,
      },
    };
  }

  return { ok: true };
}
