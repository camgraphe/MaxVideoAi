import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const locales = ['en', 'fr', 'es'] as const;
const requiredPaths = [
  'workspace.studio.projects.title',
  'workspace.studio.projects.createProject',
  'workspace.studio.projects.rename',
  'workspace.studio.projects.duplicate',
  'workspace.studio.projects.delete',
  'workspace.studio.topbar.canvas',
  'workspace.studio.topbar.viewer',
  'workspace.studio.topbar.switchToLight',
  'workspace.studio.topbar.switchToDark',
  'workspace.studio.notices.unlockBeforeMoving',
];

function readPath(source: unknown, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

test('Studio localization dictionaries expose required copy in every locale', () => {
  locales.forEach((locale) => {
    const dictionary = JSON.parse(fs.readFileSync(path.join(root, `frontend/messages/${locale}.json`), 'utf8'));
    requiredPaths.forEach((keyPath) => {
      const value = readPath(dictionary, keyPath);
      assert.equal(typeof value, 'string', `${locale} ${keyPath} should be a string`);
      assert.ok(String(value).trim().length > 0, `${locale} ${keyPath} should not be empty`);
    });
  });
});
