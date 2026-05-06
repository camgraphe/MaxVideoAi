import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authCallbackSource = readFileSync('frontend/app/auth/callback/route.ts', 'utf8');
const middlewareSource = readFileSync('frontend/middleware.ts', 'utf8');
const loginPageSource = readFileSync('frontend/app/(core)/login/page.tsx', 'utf8');

test('OAuth callback failure does not reattach a failed code to /login', () => {
  assert.doesNotMatch(
    authCallbackSource,
    /fallbackUrl\.searchParams\.set\(['"]code['"]/,
    'failed OAuth codes must not be redirected back to /login because middleware will retry them forever'
  );
  assert.match(
    authCallbackSource,
    /fallbackUrl\.searchParams\.set\(['"]authError['"],\s*['"]oauth_callback_failed['"]\)/,
    'the login page should receive a stable, non-secret error marker instead'
  );
});

test('login query cleanup preserves OAuth fallback state', () => {
  assert.match(
    middlewareSource,
    /login:\s*new Set\(\[['"]next['"],\s*['"]mode['"],\s*['"]authError['"]\]\)/,
    'middleware must not strip mode/authError from /login fallback URLs'
  );
});

test('login page can consume a PKCE OAuth code directly', () => {
  assert.match(
    middlewareSource,
    /authCode\s*&&\s*req\.nextUrl\.pathname !== ['"]\/auth\/callback['"]\s*&&\s*req\.nextUrl\.pathname !== LOGIN_PATH/,
    'middleware should let /login?code=... reach the login page for browser-side PKCE exchange'
  );
  assert.match(
    loginPageSource,
    /\.exchangeCodeForSession\(oauthCode\)/,
    'the login page should exchange direct OAuth codes with the browser Supabase client'
  );
});
