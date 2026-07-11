import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const controller = readFileSync(
  'frontend/app/(core)/login/_hooks/useLoginPageController.ts',
  'utf8'
);
const hashSession = readFileSync(
  'frontend/app/(core)/login/_hooks/useLoginAuthHashSession.ts',
  'utf8'
);
const oauthExchange = readFileSync(
  'frontend/app/(core)/login/_hooks/useLoginOAuthCodeExchange.ts',
  'utf8'
);

test('controller validates before auth calls and focuses the first invalid field', () => {
  assert.match(controller, /validateAuthForm\(/);
  assert.match(controller, /setFieldErrors\(result\.errors\)/);
  assert.match(controller, /firstInvalidField/);
  assert.match(controller, /fieldRefs\[result\.firstInvalidField\]/);
  const validationIndex = controller.indexOf('validateAuthForm(');
  const signupRequestIndex = controller.indexOf('supabase.auth.signUp');
  assert.ok(validationIndex >= 0 && validationIndex < signupRequestIndex);
});

test('controller localizes application feedback without changing provider errors', () => {
  for (const key of [
    'signingIn',
    'signinRedirecting',
    'signinSuggestion',
    'signupSuggestionReady',
    'creatingAccount',
    'accountRedirecting',
    'confirmEmail',
    'sendingReset',
    'resetSent',
    'googleUnavailable',
    'googleRedirecting',
    'consentSaveError',
  ]) {
    assert.match(controller, new RegExp(`authCopy\\.feedback\\.${key}`));
  }
  assert.match(controller, /setError\(error\.message\)/);
  assert.match(hashSession, /authCopy\.feedback\.completingSignIn/);
  assert.match(oauthExchange, /authCopy\.feedback\.completingSignIn/);
});

test('local validation failures occur before signup analytics', () => {
  const signupStart = controller.indexOf("dispatchAnalyticsEvent('sign_up_started'");
  const validation = controller.indexOf("validateCurrentForm('signup')");
  assert.ok(validation >= 0 && validation < signupStart);
});
