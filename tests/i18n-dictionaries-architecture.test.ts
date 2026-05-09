import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const facadePath = join(root, 'frontend/lib/i18n/dictionaries.ts');
const typesPath = join(root, 'frontend/lib/i18n/dictionary-types.ts');
const dataDir = join(root, 'frontend/lib/i18n/dictionary-data');
const dataModules = [
  'en.ts',
  'en-layout.ts',
  'en-home.ts',
  'en-pricing.ts',
  'en-workflows-models.ts',
  'en-content.ts',
  'en-legal-status.ts',
  'fr.ts',
];

const facadeSource = readFileSync(facadePath, 'utf8');

test('i18n dictionary facade stays focused on locale lookup', () => {
  assert.match(facadeSource, /from '\.\/dictionary-data\/en'/);
  assert.match(facadeSource, /from '\.\/dictionary-data\/fr'/);
  assert.match(facadeSource, /export function getDictionary/);
  assert.match(facadeSource, /export type \{ Dictionary, Locale \}/);

  assert.doesNotMatch(facadeSource, /export const en/, 'English copy belongs in dictionary-data modules');
  assert.doesNotMatch(facadeSource, /type Dictionary =/, 'Dictionary shape belongs in dictionary-types.ts');

  const lineCount = facadeSource.split('\n').length;
  assert.ok(lineCount <= 40, `dictionaries.ts should stay a thin lookup facade, got ${lineCount} lines`);
});

test('i18n dictionary types and locale data are split into focused modules', () => {
  assert.ok(existsSync(typesPath), 'dictionary-types.ts should own the shared dictionary contract');
  const typesSource = readFileSync(typesPath, 'utf8');
  assert.match(typesSource, /export type Locale = 'en' \| 'fr'/);
  assert.match(typesSource, /export type Dictionary =/);

  dataModules.forEach((moduleName) => {
    const modulePath = join(dataDir, moduleName);
    assert.ok(existsSync(modulePath), `${moduleName} should exist under dictionary-data`);
    const lineCount = readFileSync(modulePath, 'utf8').split('\n').length;
    assert.ok(lineCount <= 300, `${moduleName} should stay below 300 lines, got ${lineCount}`);
  });
});

test('French dictionary keeps the current fallback behavior explicitly', () => {
  const frSource = readFileSync(join(dataDir, 'fr.ts'), 'utf8');
  assert.match(frSource, /import \{ en \} from '\.\/en'/);
  assert.match(frSource, /export const fr: Dictionary = en/);
});
