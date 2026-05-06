import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authCallbackSource = readFileSync('frontend/app/auth/callback/route.ts', 'utf8');
const middlewareSource = readFileSync('frontend/middleware.ts', 'utf8');
const loginPageSource = readFileSync('frontend/app/(core)/login/page.tsx', 'utf8');

test('OAuth callback failure does not reattach a failed code to /login', () => {
  assert.doesNotMatch(
    authCallbackSource,
    /\.exchangeCodeForSession\(code\)/,
    'the server callback should not exchange PKCE codes because Safari may not send the browser code verifier cookie'
  );
  assert.match(
    authCallbackSource,
    /loginUrl\.searchParams\.set\(['"]code['"],\s*code\)/,
    'the callback should forward OAuth codes to /login for browser-side exchange'
  );
});

test('login query cleanup preserves OAuth fallback state', () => {
  assert.match(
    middlewareSource,
    /login:\s*new Set\(\[['"]next['"],\s*['"]mode['"],\s*['"]authError['"],\s*['"]code['"],\s*['"]state['"]\]\)/,
    'middleware must not strip OAuth state from /login callback URLs'
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
  assert.match(
    loginPageSource,
    /return `\$\{base\}\/auth\/callback\?next=\$\{encodeURIComponent\(safeNextPath\)\}`/,
    'Google OAuth should use the existing allowlisted callback before forwarding the code to browser-side exchange'
  );
});

test('login auth success records a session hint before leaving the auth page', () => {
  assert.match(
    loginPageSource,
    /import \{[^}]*writeLastKnownUserId[^}]*\} from ['"]@\/lib\/last-known['"]/,
    'successful login flows should prime the protected app auth hook with a last-known user id'
  );
  assert.match(
    loginPageSource,
    /writeLastKnownUserId\(userId\)/,
    'the login page should store the authenticated user id before redirecting'
  );
  assert.match(
    loginPageSource,
    /window\.location\.assign\(safeTarget\)/,
    'auth redirects should use a document navigation so Safari sends freshly written auth cookies'
  );
});

test('login page does not probe stale sessions while exchanging an OAuth code', () => {
  const guardMatches = loginPageSource.match(/if \(oauthCodeExchangeStartedRef\.current\) return;/g) ?? [];

  assert.ok(
    guardMatches.length >= 2,
    'login page should not call getUser/getSession while an OAuth code exchange is already in progress'
  );
  assert.match(
    loginPageSource,
    /clearStaleBrowserAuthState\(\)/,
    'login page should clear stale browser auth state after invalid refresh token errors'
  );
});
