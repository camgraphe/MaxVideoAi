import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/login/page.tsx');
const controllerPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginPageController.ts');
const autofillHookPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginAutofillSync.ts');
const browserLocaleHookPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginBrowserLocale.ts');
const modeQueryHookPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginModeFromQuery.ts');
const nextTargetHookPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginNextTarget.ts');
const authenticatedRedirectHookPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginAuthenticatedRedirect.ts');
const authHashSessionHookPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginAuthHashSession.ts');
const oauthCodeExchangeHookPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginOAuthCodeExchange.ts');
const copyPath = join(root, 'frontend/app/(core)/login/_lib/login-copy.ts');
const helpersPath = join(root, 'frontend/app/(core)/login/_lib/login-helpers.ts');
const authSurfacePath = join(root, 'frontend/app/(core)/login/_components/LoginAuthSurface.tsx');

const pageSource = readFileSync(pagePath, 'utf8');
const controllerSource = readFileSync(controllerPath, 'utf8');
const autofillHookSource = readFileSync(autofillHookPath, 'utf8');
const nextTargetHookSource = readFileSync(nextTargetHookPath, 'utf8');
const authenticatedRedirectHookSource = readFileSync(authenticatedRedirectHookPath, 'utf8');
const authHashSessionHookSource = readFileSync(authHashSessionHookPath, 'utf8');
const oauthCodeExchangeHookSource = readFileSync(oauthCodeExchangeHookPath, 'utf8');

test('login page delegates localized copy and browser helpers to route-local modules', () => {
  assert.ok(existsSync(controllerPath), 'login controller hook should stay in a route-local hook module');
  assert.ok(existsSync(autofillHookPath), 'login autofill sync should stay in a route-local hook module');
  assert.ok(existsSync(browserLocaleHookPath), 'login browser locale should stay in a route-local hook module');
  assert.ok(existsSync(modeQueryHookPath), 'login mode query sync should stay in a route-local hook module');
  assert.ok(existsSync(nextTargetHookPath), 'login next target state should stay in a route-local hook module');
  assert.ok(existsSync(authenticatedRedirectHookPath), 'login authenticated redirect probes should stay in a route-local hook module');
  assert.ok(existsSync(authHashSessionHookPath), 'login hash session handling should stay in a route-local hook module');
  assert.ok(existsSync(oauthCodeExchangeHookPath), 'login OAuth code exchange should stay in a route-local hook module');
  assert.ok(existsSync(copyPath), 'login localized copy should stay in a route-local copy module');
  assert.ok(existsSync(helpersPath), 'login browser helpers should stay in a route-local helper module');
  assert.ok(existsSync(authSurfacePath), 'login form UI should stay in a route-local component module');

  assert.match(
    pageSource,
    /from '\.\/_hooks\/useLoginPageController'/,
    'login page should import the route-local controller hook'
  );
  assert.match(
    pageSource,
    /from '\.\/_components\/LoginAuthSurface'/,
    'login page should render the route-local auth surface component'
  );
  assert.match(controllerSource, /from '\.\.\/_lib\/login-copy'/);
  assert.match(controllerSource, /from '\.\.\/_lib\/login-helpers'/);
  assert.match(controllerSource, /from '\.\/useLoginAutofillSync'/);
  assert.match(controllerSource, /from '\.\/useLoginBrowserLocale'/);
  assert.match(controllerSource, /from '\.\/useLoginModeFromQuery'/);
  assert.match(controllerSource, /from '\.\/useLoginNextTarget'/);
  assert.match(controllerSource, /from '\.\/useLoginAuthenticatedRedirect'/);
  assert.match(controllerSource, /from '\.\/useLoginAuthHashSession'/);
  assert.match(controllerSource, /from '\.\/useLoginOAuthCodeExchange'/);
});

test('login page does not regain auth copy or browser helper ownership', () => {
  assert.doesNotMatch(pageSource, /const AUTH_COPY =/, 'localized auth copy belongs in _lib/login-copy.ts');
  assert.doesNotMatch(pageSource, /function sanitizeNextPath\(/, 'next path validation belongs in _lib/login-helpers.ts');
  assert.doesNotMatch(
    pageSource,
    /PENDING_GOOGLE_LOGIN_STORAGE_KEY/,
    'pending Google OAuth storage details belong in _lib/login-helpers.ts'
  );
  assert.doesNotMatch(pageSource, /supabase\.auth/, 'Supabase auth orchestration belongs in useLoginPageController');
  assert.doesNotMatch(pageSource, /LOGIN_NEXT_STORAGE_KEY/, 'login storage orchestration belongs in useLoginPageController');
  assert.doesNotMatch(pageSource, /oauthCodeExchangeStartedRef/, 'OAuth exchange guards belong in useLoginPageController');

  const lineCount = pageSource.split('\n').length;
  const controllerLineCount = controllerSource.split('\n').length;
  assert.ok(lineCount <= 40, `login page should stay below 40 lines after controller extraction, got ${lineCount}`);
  assert.ok(
    controllerLineCount <= 700,
    `login controller should keep shrinking as browser helpers move out, got ${controllerLineCount}`
  );
  assert.doesNotMatch(pageSource, /<main className=/, 'login page should not own the full form surface JSX');
});

test('login helper modules expose the expected route contract', () => {
  const copySource = readFileSync(copyPath, 'utf8');
  const helpersSource = readFileSync(helpersPath, 'utf8');
  const authSurfaceSource = readFileSync(authSurfacePath, 'utf8');

  assert.match(controllerSource, /export function useLoginPageController/, 'controller hook should export the login page state machine');
  assert.match(autofillHookSource, /export function useLoginAutofillSync/, 'autofill sync should live in its own hook');
  assert.match(nextTargetHookSource, /export function useLoginNextTarget/, 'next target resolution should live in its own hook');
  assert.match(nextTargetHookSource, /LOGIN_NEXT_STORAGE_KEY/, 'next target hook should own login target storage');
  assert.match(nextTargetHookSource, /LOGIN_LAST_TARGET_KEY/, 'next target hook should own last target storage');
  assert.doesNotMatch(controllerSource, /exchangeCodeForSession\(oauthCode\)/, 'OAuth PKCE exchange belongs in useLoginOAuthCodeExchange');
  assert.doesNotMatch(controllerSource, /startOAuthCookieRedirectFallback/, 'OAuth cookie fallback wiring belongs in useLoginOAuthCodeExchange');
  assert.match(oauthCodeExchangeHookSource, /exchangeCodeForSession\(oauthCode\)/, 'OAuth code exchange hook should own browser-side PKCE exchange');
  assert.match(oauthCodeExchangeHookSource, /startOAuthCookieRedirectFallback/, 'OAuth code exchange hook should own OAuth cookie fallback wiring');
  assert.match(authenticatedRedirectHookSource, /export function useLoginAuthenticatedRedirect/, 'authenticated redirect hook should be exported');
  assert.match(authenticatedRedirectHookSource, /async function redirectFromExistingBrowserSession\(target: string\): Promise<boolean>/, 'authenticated redirect hook should expose the Safari fallback redirect');
  assert.match(authHashSessionHookSource, /export function useLoginAuthHashSession/, 'auth hash session hook should be exported');
  assert.match(authHashSessionHookSource, /setSession\(\{/, 'auth hash session hook should own Supabase hash session hydration');
  assert.match(controllerSource, /signInWithOAuth/, 'controller hook should own Google OAuth submission');
  assert.match(copySource, /export const AUTH_COPY =/, 'copy module should export the auth copy dictionary');
  assert.match(copySource, /export type AuthMode =/, 'copy module should export the auth mode type');
  assert.match(copySource, /export type Locale =/, 'copy module should export the locale type derived from auth copy');
  assert.match(copySource, /export type AuthCopy =/, 'copy module should export the auth copy shape for UI props');
  assert.match(authSurfaceSource, /export function LoginAuthSurface/, 'auth surface component should export the login form shell');
  assert.match(authSurfaceSource, /function GoogleIcon\(/, 'auth surface component should own the inline Google icon');
  assert.match(authSurfaceSource, /formatTemplate\(authCopy\.terms\.age/, 'auth surface component should own localized legal text rendering');

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
