import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const coreLayoutSource = readFileSync('frontend/app/(core)/layout.tsx', 'utf8');
const appRuntimeSource = readFileSync('frontend/app/_components/AppRuntime.tsx', 'utf8');
const requestConfigSource = readFileSync('frontend/i18n/request.ts', 'utf8');

test('core routes resolve their dictionary from the workspace locale cookie', () => {
  assert.match(coreLayoutSource, /<AppRuntime>\{children\}<\/AppRuntime>/);
  assert.match(appRuntimeSource, /import \{ cookies \} from 'next\/headers';/);
  assert.match(appRuntimeSource, /import \{ LOCALE_COOKIE \} from '@\/lib\/i18n\/constants';/);
  assert.match(appRuntimeSource, /cookieStore\.get\(LOCALE_COOKIE\)\?\.value/);
  assert.match(appRuntimeSource, /cookieStore\.get\('NEXT_LOCALE'\)\?\.value/);
  assert.match(appRuntimeSource, /resolveDictionary\(\{ locale \}\)/);
});

test('workspace cookie support stays scoped away from the global marketing request config', () => {
  assert.doesNotMatch(requestConfigSource, /next\/headers/);
  assert.doesNotMatch(requestConfigSource, /LOCALE_COOKIE/);
  assert.doesNotMatch(requestConfigSource, /cookieLocale/);
});
