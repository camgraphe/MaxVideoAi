import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const headerPath = join(root, 'frontend/components/HeaderBar.tsx');
const accountHookPath = join(root, 'frontend/components/header/useHeaderAccountState.ts');
const logoPath = join(root, 'frontend/components/header/HeaderLogoMark.tsx');

const headerSource = readFileSync(headerPath, 'utf8');
const accountHookSource = readFileSync(accountHookPath, 'utf8');
const logoSource = readFileSync(logoPath, 'utf8');

test('header bar delegates account state and logo rendering', () => {
  assert.ok(existsSync(accountHookPath), 'header account state should live in a focused hook');
  assert.ok(existsSync(logoPath), 'header logo mark should live in a focused component');
  assert.match(headerSource, /from '@\/components\/header\/useHeaderAccountState'/);
  assert.match(headerSource, /from '@\/components\/header\/HeaderLogoMark'/);
  assert.match(accountHookSource, /export function useHeaderAccountState/);
  assert.match(logoSource, /export function HeaderLogoMark/);
});

test('header bar does not regain auth session ownership', () => {
  assert.doesNotMatch(headerSource, /function getSupabaseClient\(/, 'Supabase client loading belongs in useHeaderAccountState.ts');
  assert.doesNotMatch(headerSource, /readBrowserSession/, 'browser session reads belong in useHeaderAccountState.ts');
  assert.doesNotMatch(headerSource, /hasSupabaseAuthCookie/, 'auth cookie probing belongs in useHeaderAccountState.ts');
  assert.doesNotMatch(headerSource, /writeLastKnownWallet/, 'last-known wallet writes belong in useHeaderAccountState.ts');
  assert.doesNotMatch(headerSource, /clearLastKnownAccount/, 'account cleanup belongs in useHeaderAccountState.ts');
  assert.doesNotMatch(headerSource, /setLogoutIntent/, 'logout intent belongs in useHeaderAccountState.ts');
  assert.doesNotMatch(headerSource, /function LogoMark\(/, 'logo rendering belongs in HeaderLogoMark.tsx');

  const lineCount = headerSource.split('\n').length;
  assert.ok(lineCount <= 830, `HeaderBar.tsx should stay below 830 lines after account hook extraction, got ${lineCount}`);
});
