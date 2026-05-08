import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const headerPath = join(root, 'frontend/components/HeaderBar.tsx');
const accountHookPath = join(root, 'frontend/components/header/useHeaderAccountState.ts');
const logoPath = join(root, 'frontend/components/header/HeaderLogoMark.tsx');
const navHelpersPath = join(root, 'frontend/components/header/header-nav-helpers.ts');

const headerSource = readFileSync(headerPath, 'utf8');
const accountHookSource = readFileSync(accountHookPath, 'utf8');
const logoSource = readFileSync(logoPath, 'utf8');
const navHelpersSource = readFileSync(navHelpersPath, 'utf8');

test('header bar delegates account, logo, and nav helper responsibilities', () => {
  assert.ok(existsSync(accountHookPath), 'header account state should live in a focused hook');
  assert.ok(existsSync(logoPath), 'header logo mark should live in a focused component');
  assert.ok(existsSync(navHelpersPath), 'header nav normalization should live in a focused helper');
  assert.match(headerSource, /from '@\/components\/header\/useHeaderAccountState'/);
  assert.match(headerSource, /from '@\/components\/header\/HeaderLogoMark'/);
  assert.match(headerSource, /from '@\/components\/header\/header-nav-helpers'/);
  assert.match(accountHookSource, /export function useHeaderAccountState/);
  assert.match(logoSource, /export function HeaderLogoMark/);
  assert.match(navHelpersSource, /export function resolveLocalizedHref/);
  assert.match(navHelpersSource, /export function normalizeMarketingLinks/);
  assert.match(navHelpersSource, /export function getGuestMobileNavItems/);
});

test('header bar does not regain auth session ownership', () => {
  assert.doesNotMatch(headerSource, /function getSupabaseClient\(/, 'Supabase client loading belongs in useHeaderAccountState.ts');
  assert.doesNotMatch(headerSource, /readBrowserSession/, 'browser session reads belong in useHeaderAccountState.ts');
  assert.doesNotMatch(headerSource, /hasSupabaseAuthCookie/, 'auth cookie probing belongs in useHeaderAccountState.ts');
  assert.doesNotMatch(headerSource, /writeLastKnownWallet/, 'last-known wallet writes belong in useHeaderAccountState.ts');
  assert.doesNotMatch(headerSource, /clearLastKnownAccount/, 'account cleanup belongs in useHeaderAccountState.ts');
  assert.doesNotMatch(headerSource, /setLogoutIntent/, 'logout intent belongs in useHeaderAccountState.ts');
  assert.doesNotMatch(headerSource, /function LogoMark\(/, 'logo rendering belongs in HeaderLogoMark.tsx');
  assert.doesNotMatch(headerSource, /function resolveLocalizedHref\(/, 'localized href resolution belongs in header-nav-helpers.ts');
  assert.doesNotMatch(headerSource, /MARKETING_TOP_NAV_HREF_BY_KEY/, 'marketing link allowlisting belongs in header-nav-helpers.ts');

  const lineCount = headerSource.split('\n').length;
  assert.ok(lineCount <= 780, `HeaderBar.tsx should stay below 780 lines after nav helper extraction, got ${lineCount}`);
});
