import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const middlewareSource = readFileSync('frontend/middleware.ts', 'utf8');
const publicWatchdogSource = readFileSync('frontend/components/auth/PublicSessionWatchdog.tsx', 'utf8');

test('middleware only refreshes Supabase sessions for protected routes', () => {
  const protectedRouteIndex = middlewareSource.indexOf('const isProtectedRoute = PROTECTED_PREFIXES.some');
  const nonProtectedReturnIndex = middlewareSource.indexOf('if (!isProtectedRoute)', protectedRouteIndex);
  const updateSessionIndex = middlewareSource.indexOf('await updateSession(req, response)');

  assert.ok(protectedRouteIndex > 0);
  assert.ok(nonProtectedReturnIndex > protectedRouteIndex);
  assert.ok(updateSessionIndex > nonProtectedReturnIndex);
});

test('public session watchdog does not manually refresh missing sessions', () => {
  assert.match(publicWatchdogSource, /readBrowserSession\(\)/);
  assert.doesNotMatch(publicWatchdogSource, /supabase\.auth\.refreshSession\(\)/);
});
