import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAuthCallbackRedirect } from '../frontend/app/(core)/login/_lib/login-helpers';

test('local Google login returns to the one-level login route and preserves Studio', () => {
  assert.equal(
    buildAuthCallbackRedirect('http://localhost:3000', '/app/studio/conversation/qa-client-session-local'),
    'http://localhost:3000/login?mode=signin&next=%2Fapp%2Fstudio%2Fconversation%2Fqa-client-session-local',
  );
});

test('IPv4 and IPv6 loopback login use the local PKCE exchange route', () => {
  assert.equal(buildAuthCallbackRedirect('http://127.0.0.1:3000/', '/app'),
    'http://127.0.0.1:3000/login?mode=signin&next=%2Fapp');
  assert.equal(buildAuthCallbackRedirect('http://[::1]:3000', '/app'),
    'http://[::1]:3000/login?mode=signin&next=%2Fapp');
});

test('production and preview keep the server callback', () => {
  assert.equal(buildAuthCallbackRedirect('https://maxvideoai.com', '/app'),
    'https://maxvideoai.com/auth/callback?next=%2Fapp');
  assert.equal(buildAuthCallbackRedirect('https://preview.example.com', '/app'),
    'https://preview.example.com/auth/callback?next=%2Fapp');
  assert.equal(buildAuthCallbackRedirect('https://localhost.evil.example', '/app'),
    'https://localhost.evil.example/auth/callback?next=%2Fapp');
});

test('local callback keeps rejecting external continuation targets', () => {
  assert.equal(buildAuthCallbackRedirect('http://localhost:3000', '//evil.example/app'),
    'http://localhost:3000/login?mode=signin&next=%2Fgenerate');
});


test('localized Studio login retains its language through local and hosted callbacks', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    for (const origin of ['http://localhost:3000', 'https://maxvideoai.com']) {
      const redirect = new URL(buildAuthCallbackRedirect(origin, '/app/studio', locale)!);
      assert.equal(redirect.searchParams.get('lang'), locale);
      assert.equal(redirect.searchParams.get('next'), '/app/studio');
    }
  }
});

test('signup confirmation carries an explicit flow marker without changing Google callbacks', () => {
  for (const origin of ['http://localhost:3000', 'https://maxvideoai.com']) {
    const signup = new URL(buildAuthCallbackRedirect(origin, '/app/studio', 'fr', 'signup')!);
    assert.equal(signup.pathname, '/auth/callback');
    assert.equal(signup.searchParams.get('flow'), 'signup');
    assert.equal(signup.searchParams.get('next'), '/app/studio');
    assert.equal(signup.searchParams.get('lang'), 'fr');
  }
  assert.equal(new URL(buildAuthCallbackRedirect('https://maxvideoai.com', '/app')!).searchParams.has('flow'), false);
});

test('local password recovery returns through the callback instead of exchanging on the login page', () => {
  const redirect = new URL(buildAuthCallbackRedirect('http://localhost:3000', '/app/studio', 'es', 'recovery')!);
  assert.equal(redirect.pathname, '/auth/callback');
  assert.equal(redirect.searchParams.get('flow'), 'recovery');
  assert.equal(redirect.searchParams.get('next'), '/app/studio');
  assert.equal(redirect.searchParams.get('lang'), 'es');
});
