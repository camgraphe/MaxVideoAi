import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const cleanupPath = 'frontend/src/lib/supabase-auth-cleanup.ts';

const browserSessionCallSites = [
  'frontend/src/lib/authFetch.ts',
  'frontend/src/hooks/useRequireAuth.ts',
  'frontend/components/HeaderBar.tsx',
  'frontend/components/auth/PublicSessionWatchdog.tsx',
  'frontend/components/marketing/MarketingNav.tsx',
  'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGenerationRunner.ts',
  'frontend/app/(core)/(workspace)/app/image/ImageWorkspace.tsx',
] as const;

const marketingAuthSource = readFileSync('frontend/src/server/marketing-auth.ts', 'utf8');

test('browser auth code centralizes stale refresh-token cleanup', () => {
  assert.ok(existsSync(cleanupPath), 'shared browser auth cleanup helper should exist');
  const source = readFileSync(cleanupPath, 'utf8');
  assert.match(source, /export function isInvalidRefreshTokenError\(error: unknown\): boolean/);
  assert.match(source, /export async function clearStaleBrowserAuthState\(\): Promise<void>/);
  assert.match(source, /refresh_token_not_found/);
  assert.match(source, /invalid_refresh_token/);
});

for (const file of browserSessionCallSites) {
  test(`${file} clears stale browser auth before retrying session work`, () => {
    const source = readFileSync(file, 'utf8');
    assert.match(
      source,
      /clearStaleBrowserAuthState|readBrowserSession/,
      `${file} should use the shared stale auth cleanup helper`
    );
  });
}

test('marketing auth snapshot does not refresh stale sessions on public pages', () => {
  assert.doesNotMatch(marketingAuthSource, /supabase\.auth\.getUser\(\)/);
  assert.match(marketingAuthSource, /return \{ email: null, isAdmin: false \};/);
});
