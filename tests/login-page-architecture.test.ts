import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/login/page.tsx');
const pageClientPath = join(root, 'frontend/app/(core)/login/_components/LoginPageClient.tsx');
const controllerPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginPageController.ts');
const autofillHookPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginAutofillSync.ts');
const browserLocaleHookPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginBrowserLocale.ts');
const routeStatePath = join(root, 'frontend/app/(core)/login/_lib/login-route-state.ts');
const nextTargetHookPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginNextTarget.ts');
const authenticatedRedirectHookPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginAuthenticatedRedirect.ts');
const authHashSessionHookPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginAuthHashSession.ts');
const oauthCodeExchangeHookPath = join(root, 'frontend/app/(core)/login/_hooks/useLoginOAuthCodeExchange.ts');
const copyPath = join(root, 'frontend/app/(core)/login/_lib/login-copy.ts');
const helpersPath = join(root, 'frontend/app/(core)/login/_lib/login-helpers.ts');
const authSurfacePath = join(root, 'frontend/app/(core)/login/_components/LoginAuthSurface.tsx');
const passwordFieldPath = join(root, 'frontend/app/(core)/login/_components/LoginPasswordField.tsx');

const pageSource = readFileSync(pagePath, 'utf8');
const pageClientSource = readFileSync(pageClientPath, 'utf8');
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
  assert.ok(existsSync(pageClientPath), 'login client orchestration should stay in a route-local client component');
  assert.ok(existsSync(routeStatePath), 'login initial route state should stay in a pure route-local module');
  assert.ok(existsSync(nextTargetHookPath), 'login next target state should stay in a route-local hook module');
  assert.ok(existsSync(authenticatedRedirectHookPath), 'login authenticated redirect probes should stay in a route-local hook module');
  assert.ok(existsSync(authHashSessionHookPath), 'login hash session handling should stay in a route-local hook module');
  assert.ok(existsSync(oauthCodeExchangeHookPath), 'login OAuth code exchange should stay in a route-local hook module');
  assert.ok(existsSync(copyPath), 'login localized copy should stay in a route-local copy module');
  assert.ok(existsSync(helpersPath), 'login browser helpers should stay in a route-local helper module');
  assert.ok(existsSync(authSurfacePath), 'login form UI should stay in a route-local component module');
  assert.ok(existsSync(passwordFieldPath), 'password visibility should stay in a focused route-local component');

  assert.match(
    pageSource,
    /from '\.\/_components\/LoginPageClient'/,
    'login page should render the route-local client owner'
  );
  assert.doesNotMatch(pageSource, /'use client'/);
  assert.match(pageSource, /from 'next\/headers'/);
  assert.match(pageSource, /<LoginPageClient/);
  assert.match(pageSource, /resolveInitialAuthMode\(params\.mode\)/);
  assert.match(pageSource, /resolveInitialAuthLocale\(/);
  assert.match(pageClientSource, /'use client'/);
  assert.match(pageClientSource, /from '\.\.\/_hooks\/useLoginPageController'/);
  assert.match(pageClientSource, /from '\.\/LoginAuthSurface'/);
  assert.match(pageClientSource, /useLoginPageController\(\{ initialMode, initialLocale \}\)/);
  const routeStateSource = readFileSync(routeStatePath, 'utf8');
  assert.match(routeStateSource, /export function resolveInitialAuthMode/);
  assert.match(routeStateSource, /export function resolveInitialAuthLocale/);
  assert.match(controllerSource, /from '\.\.\/_lib\/login-copy'/);
  assert.match(controllerSource, /from '\.\.\/_lib\/login-helpers'/);
  assert.match(controllerSource, /from '\.\/useLoginAutofillSync'/);
  assert.match(controllerSource, /from '\.\/useLoginBrowserLocale'/);
  assert.doesNotMatch(controllerSource, /useLoginModeFromQuery/);
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
  assert.doesNotMatch(pageClientSource, /supabase\.auth/, 'client composition should not own Supabase auth');
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
  assert.match(helpersSource, /export function resolveGoogleAuthCompletionEvent\(/);
  assert.match(controllerSource, /markPendingGoogleLogin\(mode === 'signup' \? 'signup' : 'signin'\)/);
  assert.match(oauthCodeExchangeHookSource, /resolveGoogleAuthCompletionEvent\(pendingMode\)/);
  assert.match(authSurfaceSource, /export function LoginAuthSurface/, 'auth surface component should export the login form shell');
  assert.match(authSurfaceSource, /from '\.\/LoginPasswordField'/, 'auth surface should delegate password visibility');
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

test('authenticated redirect resolves the consumed Google auth mode', () => {
  assert.match(authenticatedRedirectHookSource, /resolveGoogleAuthCompletionEvent\(pendingMode\)/);
  assert.doesNotMatch(authenticatedRedirectHookSource, /persistPendingAnalyticsEvent\('login_completed'/);
});

test('hash session resolves the consumed Google auth mode', () => {
  assert.match(authHashSessionHookSource, /resolveGoogleAuthCompletionEvent\(pendingMode\)/);
  assert.doesNotMatch(authHashSessionHookSource, /persistPendingAnalyticsEvent\('login_completed'/);
});
