import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('marketing locale switch uses the locale prefix in the current URL over stale client state', () => {
  const source = readFileSync('frontend/components/marketing/LanguageToggle.tsx', 'utf8');

  assert.match(source, /resolveMarketingLocaleFromPathname\(rawPathname, locale\)/);
  assert.match(source, /return match \? \(match\[1\]\.toLowerCase\(\) as Locale\) : 'en';/);
});

test('marketing locale switch delegates generic page changes to the server locale redirect', () => {
  const source = readFileSync('frontend/components/marketing/LanguageToggle.tsx', 'utf8');

  assert.match(source, /searchParams\.set\('lang', value\)/);
  assert.match(source, /window\.location\.assign\(localeSwitchHref\)/);
});

test('server locale redirects persist the selected locale without a permanent redirect', () => {
  const source = readFileSync('frontend/lib/middleware/routing-locale.ts', 'utf8');

  assert.match(source, /const response = NextResponse\.redirect\(redirectUrl, 307\);/);
  assert.match(source, /resolveSharedLocaleCookieDomain\(req\.nextUrl\.hostname\)/);
  assert.match(source, /setLocaleCookies\(response, targetLocale, sharedCookieDomain\);/);
  assert.match(source, /response\.headers\.append\('set-cookie', serializeHostLocaleCookie/);
});
