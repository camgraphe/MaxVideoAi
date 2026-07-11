import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveInitialAuthLocale,
  resolveInitialAuthMode,
} from '../frontend/app/(core)/login/_lib/login-route-state';

test('login mode accepts only the supported scalar query values', () => {
  assert.equal(resolveInitialAuthMode('signup'), 'signup');
  assert.equal(resolveInitialAuthMode('signin'), 'signin');
  assert.equal(resolveInitialAuthMode('reset'), 'reset');
  assert.equal(resolveInitialAuthMode(undefined), 'signup');
  assert.equal(resolveInitialAuthMode('other'), 'signup');
  assert.equal(resolveInitialAuthMode(['signin', 'signup']), 'signin');
});

test('login locale accepts the first supported cookie value', () => {
  assert.equal(resolveInitialAuthLocale('fr', 'en'), 'fr');
  assert.equal(resolveInitialAuthLocale('de', 'es'), 'es');
  assert.equal(resolveInitialAuthLocale(undefined, 'EN'), 'en');
  assert.equal(resolveInitialAuthLocale('pt', undefined), 'en');
});
