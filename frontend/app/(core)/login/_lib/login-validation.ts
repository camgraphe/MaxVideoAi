import type { AuthMode } from './login-copy';

export type AuthFieldName =
  | 'email'
  | 'password'
  | 'confirm'
  | 'acceptTerms'
  | 'ageConfirmed';

export type AuthValidationErrorCode =
  | 'emailRequired'
  | 'emailInvalid'
  | 'passwordRequired'
  | 'passwordTooShort'
  | 'confirmRequired'
  | 'passwordMismatch'
  | 'termsRequired'
  | 'ageRequired';

export type AuthFieldErrors = Partial<Record<AuthFieldName, AuthValidationErrorCode>>;

export type AuthValidationInput = {
  mode: AuthMode;
  email: string;
  password: string;
  confirm: string;
  acceptTerms: boolean;
  ageConfirmed: boolean;
};

export type AuthValidationResult = {
  errors: AuthFieldErrors;
  firstInvalidField: AuthFieldName | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;
const SIGNUP_FIELD_ORDER: AuthFieldName[] = [
  'email',
  'password',
  'confirm',
  'acceptTerms',
  'ageConfirmed',
];

export function validateAuthForm(input: AuthValidationInput): AuthValidationResult {
  const errors: AuthFieldErrors = {};
  const email = input.email.trim();

  if (!email) errors.email = 'emailRequired';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'emailInvalid';

  if (input.mode !== 'reset') {
    if (!input.password) errors.password = 'passwordRequired';
    else if (input.mode === 'signup' && input.password.length < 6) {
      errors.password = 'passwordTooShort';
    }
  }

  if (input.mode === 'signup') {
    if (!input.confirm) errors.confirm = 'confirmRequired';
    else if (input.password !== input.confirm) errors.confirm = 'passwordMismatch';
    if (!input.acceptTerms) errors.acceptTerms = 'termsRequired';
    if (!input.ageConfirmed) errors.ageConfirmed = 'ageRequired';
  }

  const order: AuthFieldName[] =
    input.mode === 'reset'
      ? ['email']
      : input.mode === 'signin'
        ? ['email', 'password']
        : SIGNUP_FIELD_ORDER;

  return {
    errors,
    firstInvalidField: order.find((field) => errors[field]) ?? null,
  };
}
