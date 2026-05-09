import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const cleanupPath = 'frontend/src/lib/supabase-auth-cleanup.ts';

const directBrowserSessionCallSites = [
  'frontend/src/lib/authFetch.ts',
  'frontend/src/hooks/useRequireAuth.ts',
  'frontend/components/header/useHeaderAccountState.ts',
  'frontend/components/auth/PublicSessionWatchdog.tsx',
  'frontend/components/marketing/MarketingNav.tsx',
  'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGenerationRunner.ts',
  'frontend/app/(core)/(workspace)/app/image/_hooks/useImageGenerationRunner.ts',
] as const;

const marketingAuthSource = readFileSync('frontend/src/server/marketing-auth.ts', 'utf8');

test('browser auth code centralizes stale refresh-token cleanup', () => {
  assert.ok(existsSync(cleanupPath), 'shared browser auth cleanup helper should exist');
  const source = readFileSync(cleanupPath, 'utf8');
  assert.match(source, /export function isInvalidRefreshTokenError\(error: unknown\): boolean/);
  assert.match(source, /export function isPkceCodeVerifierError\(error: unknown\): boolean/);
  assert.match(source, /export async function clearStaleBrowserAuthState\(\): Promise<void>/);
  assert.match(source, /refresh_token_not_found/);
  assert.match(source, /invalid_refresh_token/);
  assert.match(source, /bad_code_verifier/);
});

for (const file of directBrowserSessionCallSites) {
  test(`${file} uses the browser Supabase session directly`, () => {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      source,
      /readBrowserSession/,
      `${file} should not depend on the stale auth cleanup wrapper for routine session reads`
    );
    assert.match(
      source,
      /supabase\.auth\.getSession\(\)|authFetch/,
      `${file} should keep using the browser Supabase session or authenticated API facade`
    );
  });
}

test('marketing auth snapshot reads the cookie session on the server', () => {
  assert.match(marketingAuthSource, /createSupabaseServerClient/);
  assert.match(marketingAuthSource, /supabase\.auth\.getUser\(\)/);
  assert.match(marketingAuthSource, /isUserAdmin\(userId\)/);
});
