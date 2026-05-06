import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authCallbackSource = readFileSync('frontend/app/auth/callback/route.ts', 'utf8');
const middlewareSource = readFileSync('frontend/middleware.ts', 'utf8');
const loginPageSource = readFileSync('frontend/app/(core)/login/page.tsx', 'utf8');
const siteOriginSource = readFileSync('frontend/lib/siteOrigin.ts', 'utf8');

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
    /return `\$\{base\}\/auth\/callback\?next=\$\{encodeURIComponent\(sanitizeNextPath\(nextPath\)\)\}`/,
    'Google OAuth should use the existing allowlisted callback before forwarding the code to browser-side exchange'
  );
  assert.match(
    loginPageSource,
    /redirectTo:\s*oauthRedirectTo/,
    'Google OAuth should pass the allowlisted callback URL to Supabase'
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
    /window\.location\.replace\(finishUrl\)/,
    'auth redirects should use a document navigation through the finish route so Safari sends freshly written auth cookies'
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

test('login page redirects if OAuth exchange reports an error after a session was stored', () => {
  assert.match(
    loginPageSource,
    /async function redirectFromExistingBrowserSession\(target: string\): Promise<boolean>/,
    'login page should have a fallback redirect for Safari when the session exists but the OAuth exchange response errors'
  );
  assert.match(
    loginPageSource,
    /const fallbackRedirected = await redirectFromExistingBrowserSession\(target\);/,
    'OAuth error handling should check the browser session before showing the login error'
  );
  assert.match(
    loginPageSource,
    /oauthCodeExchangeStartedRef\.current = false;/,
    'OAuth error handling should release the exchange guard when no session exists'
  );
});

test('login page protects Google PKCE from duplicate starts and host drift', () => {
  assert.match(
    loginPageSource,
    /import \{ canonicalizeBrowserAuthOrigin \} from ['"]@\/lib\/siteOrigin['"]/,
    'login page should use the shared site origin helper before creating a PKCE verifier'
  );
  assert.match(
    siteOriginSource,
    /export function canonicalizeBrowserAuthOrigin\(\): boolean/,
    'auth host canonicalization should live with shared site origin helpers'
  );
  assert.match(
    loginPageSource,
    /if \(googleOAuthStartedRef\.current\) return;/,
    'Google OAuth should ignore repeated clicks once a PKCE flow has started'
  );
  assert.match(
    loginPageSource,
    /disabled=\{isGoogleOAuthStarting\}/,
    'the Google button should be disabled while the OAuth URL is being created'
  );
  assert.match(
    loginPageSource,
    /isPkceCodeVerifierError\(error\)/,
    'PKCE verifier mismatches should trigger stale auth cleanup before the next retry'
  );
});
