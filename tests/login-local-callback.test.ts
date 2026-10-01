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
