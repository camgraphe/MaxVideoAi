import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/login/page.tsx');
const copyPath = join(root, 'frontend/app/(core)/login/_lib/login-copy.ts');
const helpersPath = join(root, 'frontend/app/(core)/login/_lib/login-helpers.ts');

const pageSource = readFileSync(pagePath, 'utf8');

test('login page delegates localized copy and browser helpers to route-local modules', () => {
  assert.ok(existsSync(copyPath), 'login localized copy should stay in a route-local copy module');
  assert.ok(existsSync(helpersPath), 'login browser helpers should stay in a route-local helper module');

  assert.match(
    pageSource,
    /from '\.\/_lib\/login-copy'/,
    'login page should import auth copy and auth mode types from the route-local copy module'
  );
  assert.match(
    pageSource,
    /from '\.\/_lib\/login-helpers'/,
    'login page should import auth path and OAuth helpers from the route-local helper module'
  );
});

test('login page does not regain auth copy or browser helper ownership', () => {
  assert.doesNotMatch(pageSource, /const AUTH_COPY =/, 'localized auth copy belongs in _lib/login-copy.ts');
  assert.doesNotMatch(pageSource, /function sanitizeNextPath\(/, 'next path validation belongs in _lib/login-helpers.ts');
  assert.doesNotMatch(
    pageSource,
    /PENDING_GOOGLE_LOGIN_STORAGE_KEY/,
    'pending Google OAuth storage details belong in _lib/login-helpers.ts'
  );

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 1060, `login page should stay below 1060 lines after helper extraction, got ${lineCount}`);
});

test('login helper modules expose the expected route contract', () => {
  const copySource = readFileSync(copyPath, 'utf8');
  const helpersSource = readFileSync(helpersPath, 'utf8');

  assert.match(copySource, /export const AUTH_COPY =/, 'copy module should export the auth copy dictionary');
  assert.match(copySource, /export type AuthMode =/, 'copy module should export the auth mode type');
  assert.match(copySource, /export type Locale =/, 'copy module should export the locale type derived from auth copy');

  for (const helperName of [
    'detectLocale',
    'formatTemplate',
    'sanitizeNextPath',
    'getBrowserAuthRedirectOrigin',
    'buildAuthCallbackRedirect',
    'markPendingGoogleLogin',
    'clearPendingGoogleLogin',
    'consumePendingGoogleLogin',
  ]) {
    assert.match(helpersSource, new RegExp(`export function ${helperName}\\(`), `${helperName} should be exported`);
  }
});
