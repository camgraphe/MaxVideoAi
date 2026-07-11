import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAuthForm } from '../frontend/app/(core)/login/_lib/login-validation';

const valid = {
  email: 'creator@example.com',
  password: 'secret1',
  confirm: 'secret1',
  acceptTerms: true,
  ageConfirmed: true,
};

test('signup validation reports deterministic field errors', () => {
  assert.deepEqual(
    validateAuthForm({
      mode: 'signup',
      email: '',
      password: '',
      confirm: '',
      acceptTerms: false,
      ageConfirmed: false,
    }),
    {
      errors: {
        email: 'emailRequired',
        password: 'passwordRequired',
        confirm: 'confirmRequired',
        acceptTerms: 'termsRequired',
        ageConfirmed: 'ageRequired',
      },
      firstInvalidField: 'email',
    }
  );
});

test('signup validation distinguishes email, length, and mismatch failures', () => {
  assert.equal(
    validateAuthForm({ ...valid, mode: 'signup', email: 'invalid' }).errors.email,
    'emailInvalid'
  );
  assert.equal(
    validateAuthForm({ ...valid, mode: 'signup', password: '123', confirm: '123' }).errors.password,
    'passwordTooShort'
  );
  assert.equal(
    validateAuthForm({ ...valid, mode: 'signup', confirm: 'other12' }).errors.confirm,
    'passwordMismatch'
  );
});

test('signin and reset validate only fields present in their modes', () => {
  assert.deepEqual(validateAuthForm({ ...valid, mode: 'signin', password: '' }), {
    errors: { password: 'passwordRequired' },
    firstInvalidField: 'password',
  });
  assert.deepEqual(validateAuthForm({ ...valid, mode: 'reset', email: '' }), {
    errors: { email: 'emailRequired' },
    firstInvalidField: 'email',
  });
});

test('valid values produce no errors', () => {
  assert.deepEqual(validateAuthForm({ ...valid, mode: 'signup' }), {
    errors: {},
    firstInvalidField: null,
  });
});
