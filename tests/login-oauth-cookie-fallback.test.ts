import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const loginPageSource = readFileSync('frontend/app/(core)/login/page.tsx', 'utf8');
const fallbackPath = 'frontend/app/(core)/login/_lib/oauth-cookie-fallback.ts';

test('login keeps OAuth cookie fallback out of page orchestration', () => {
  assert.ok(existsSync(fallbackPath), 'OAuth cookie fallback helper should be route-local');
  assert.match(
    loginPageSource,
    /startOAuthCookieRedirectFallback\(/,
    'login page should delegate stalled OAuth cookie detection to a route-local helper'
  );
  assert.doesNotMatch(
    loginPageSource,
    /window\.location\.replace\(buildAuthFinishUrl/,
    'login should not route through an extra auth finish page'
  );
  assert.doesNotMatch(
    loginPageSource,
    /\/auth\/finish/,
    'login should not add another intermediate auth page'
  );
});

test('OAuth cookie fallback redirects only after a new Supabase auth cookie appears', () => {
  const fallbackSource = readFileSync(fallbackPath, 'utf8');
  assert.match(
    fallbackSource,
    /hasSupabaseAuthCookie\(\)/,
    'fallback should watch browser Supabase auth cookie visibility'
  );
  assert.match(
    fallbackSource,
    /hadAuthCookieBeforeExchange/,
    'fallback should avoid treating a pre-existing cookie as OAuth success'
  );
  assert.match(
    fallbackSource,
    /onAuthenticatedCookie\(\)/,
    'fallback should hand control back to login when a new auth cookie appears'
  );
});

test('login waits for the final next path before starting PKCE exchange', () => {
  assert.match(
    loginPageSource,
    /if \(!nextPathReady\) return;\s+if \(typeof window === 'undefined'\) return;\s+const params = new URLSearchParams\(window\.location\.search\);/,
    'PKCE exchange should not start until nextPath has been resolved'
  );
  assert.match(
    loginPageSource,
    /oauthCodeExchangeStartedRef\.current = true;[\s\S]*const target = sanitizeNextPath\(params\.get\('next'\) \?\? nextPath\);/,
    'the exchange should capture a stable redirect target after nextPathReady'
  );
});
