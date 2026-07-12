import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('marketing locale switch uses the locale prefix in the current URL over stale client state', () => {
  const source = readFileSync('frontend/lib/i18n/marketing-locale-switch.ts', 'utf8');

  assert.match(source, /resolveMarketingLocaleFromPathname/);
  assert.match(source, /return match \? \(match\[1\]\.toLowerCase\(\) as Locale\) : 'en';/);
});

test('marketing locale switch delegates every localized page to the shared server redirect href', () => {
  const source = readFileSync('frontend/components/marketing/LanguageToggle.tsx', 'utf8');
  const helperSource = readFileSync('frontend/lib/i18n/marketing-locale-switch.ts', 'utf8');

  assert.match(source, /buildMarketingLocaleSwitchHref/);
  assert.match(source, /window\.location\.assign/);
  assert.doesNotMatch(source, /router\.replace/);
  assert.match(helperSource, /searchParams\.set\('lang', targetLocale\)/);
  assert.doesNotMatch(helperSource, /searchParams\.set\('nolocale'/);
});

test('server locale redirects persist the selected locale without a permanent redirect', () => {
  const source = readFileSync('frontend/lib/middleware/routing-locale.ts', 'utf8');

  assert.match(source, /const response = NextResponse\.redirect\(redirectUrl, 307\);/);
  assert.match(source, /resolveSharedLocaleCookieDomain\(req\.nextUrl\.hostname\)/);
  assert.match(source, /setLocaleCookies\(response, targetLocale, sharedCookieDomain\);/);
  assert.match(source, /response\.headers\.append\('set-cookie', serializeHostLocaleCookie/);
});

test('middleware lets the public URL determine locale instead of browser state', () => {
  const middlewareSource = readFileSync('frontend/middleware.ts', 'utf8');
  const localeSource = readFileSync('frontend/lib/middleware/routing-locale.ts', 'utf8');

  assert.match(localeSource, /localeDetection:\s*false/);
  assert.doesNotMatch(middlewareSource, /getPreferredLocale\(req\)/);
});
