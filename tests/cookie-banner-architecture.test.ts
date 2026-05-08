import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const bannerPath = join(root, 'frontend/components/legal/CookieBanner.tsx');
const preferencesPanelPath = join(root, 'frontend/components/legal/CookiePreferencesPanel.tsx');
const copyPath = join(root, 'frontend/components/legal/cookie-banner-copy.ts');
const clientPath = join(root, 'frontend/components/legal/cookie-banner-client.ts');

const readSource = (path: string) => readFileSync(path, 'utf8');
const lineCount = (source: string) => source.split('\n').length;

test('cookie banner delegates copy, browser effects, and preferences rendering', () => {
  for (const path of [bannerPath, preferencesPanelPath, copyPath, clientPath]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  const bannerSource = readSource(bannerPath);
  const preferencesSource = readSource(preferencesPanelPath);
  const copySource = readSource(copyPath);
  const clientSource = readSource(clientPath);

  assert.match(bannerSource, /<CookiePreferencesPanel/, 'CookieBanner should compose the preferences panel');
  assert.match(bannerSource, /COOKIE_BANNER_COPY|resolveCookieBannerLocale/, 'CookieBanner should read localized copy from a focused module');
  assert.match(bannerSource, /applyStoredConsentEffects|readConsentCookie|writeConsentCookie/, 'CookieBanner should delegate browser consent effects');
  assert.doesNotMatch(bannerSource, /gtagConsentUpdate|dataLayer|document\.cookie|COOKIE_MAX_AGE_SECONDS|Cookies & Privacy/, 'CookieBanner should not own browser effect internals or copy tables');
  assert.match(preferencesSource, /export function CookiePreferencesPanel|function PreferenceSwitch/, 'CookiePreferencesPanel should own preference controls');
  assert.match(copySource, /export const COOKIE_BANNER_COPY|export function resolveCookieBannerLocale/, 'cookie banner copy module should own copy and locale resolution');
  assert.match(clientSource, /export function readConsentCookie|export function writeConsentCookie|function updateGoogleConsent/, 'cookie banner client module should own browser side effects');
});

test('cookie banner modules stay focused', () => {
  const bannerSource = readSource(bannerPath);
  const preferencesSource = readSource(preferencesPanelPath);
  const copySource = readSource(copyPath);
  const clientSource = readSource(clientPath);

  assert.ok(lineCount(bannerSource) <= 280, `CookieBanner should stay below 280 lines, got ${lineCount(bannerSource)}`);
  assert.ok(lineCount(preferencesSource) <= 120, `CookiePreferencesPanel should stay below 120 lines, got ${lineCount(preferencesSource)}`);
  assert.ok(lineCount(copySource) <= 160, `cookie banner copy should stay below 160 lines, got ${lineCount(copySource)}`);
  assert.ok(lineCount(clientSource) <= 170, `cookie banner client helpers should stay below 170 lines, got ${lineCount(clientSource)}`);
});
