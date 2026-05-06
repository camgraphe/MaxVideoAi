import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('frontend/src/lib/supabase-ssr.ts', 'utf8');

test('server auth resolves cookie session before verifying claims', () => {
  const updateSessionBlock = source.slice(
    source.indexOf('export async function updateSession'),
    source.indexOf('export async function getRouteAuthContext')
  );

  assert.match(updateSessionBlock, /supabase\.auth\.getSession\(\)/);
  assert.match(updateSessionBlock, /const accessToken = sessionData\.session\?\.access_token \?\? null;/);
  assert.match(updateSessionBlock, /supabase\.auth\.getClaims\(accessToken\)/);
});

test('route auth avoids parallel session refreshes', () => {
  const routeAuthBlock = source.slice(source.indexOf('export async function getRouteAuthContext'));

  assert.doesNotMatch(routeAuthBlock, /Promise\.all\(\s*\[/);
  assert.match(routeAuthBlock, /const \{ data: sessionData, error: sessionError \} = await supabase\.auth\.getSession\(\);/);
  assert.match(routeAuthBlock, /supabase\.auth\.getClaims\(session\.access_token\)/);
});

test('server auth clears invalid Supabase refresh cookies', () => {
  assert.match(source, /function isInvalidRefreshTokenError\(error: unknown\): boolean/);
  assert.match(source, /function clearSupabaseAuthCookies\(req: NextRequest, res: NextResponse\)/);
  assert.match(source, /if \(isInvalidRefreshTokenError\(sessionError\)\) \{/);
  assert.match(source, /clearSupabaseAuthCookies\(req, res\);/);
});
