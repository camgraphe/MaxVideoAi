import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const workspacePath = join(root, 'frontend/src/components/tools/AngleWorkspace.tsx');
const copyPath = join(root, 'frontend/src/components/tools/angle/_lib/angle-workspace-copy.ts');
const typesPath = join(root, 'frontend/src/components/tools/angle/_lib/angle-workspace-types.ts');
const helpersPath = join(root, 'frontend/src/components/tools/angle/_lib/angle-workspace-helpers.ts');

const workspaceSource = readFileSync(workspacePath, 'utf8');

test('angle workspace delegates copy, local types, and helper logic', () => {
  assert.ok(existsSync(copyPath), 'angle workspace copy should live in a route-local copy module');
  assert.ok(existsSync(typesPath), 'angle workspace local contracts should live in a route-local type module');
  assert.ok(existsSync(helpersPath), 'angle workspace helper logic should live in a route-local helper module');

  assert.match(workspaceSource, /from '\.\/angle\/_lib\/angle-workspace-copy'/, 'workspace should import angle copy');
  assert.match(workspaceSource, /from '\.\/angle\/_lib\/angle-workspace-types'/, 'workspace should import angle local types');
  assert.match(workspaceSource, /from '\.\/angle\/_lib\/angle-workspace-helpers'/, 'workspace should import angle helpers');
});

test('angle workspace does not regain extracted ownership', () => {
  assert.doesNotMatch(workspaceSource, /const DEFAULT_ANGLE_COPY =/, 'localized angle copy belongs in _lib/angle-workspace-copy.ts');
  assert.doesNotMatch(workspaceSource, /type UploadedImage =/, 'asset contracts belong in _lib/angle-workspace-types.ts');
  assert.doesNotMatch(workspaceSource, /function sanitizeParams\(/, 'numeric parameter sanitation belongs in _lib/angle-workspace-helpers.ts');
  assert.doesNotMatch(workspaceSource, /function parsePersistedAngleToolState\(/, 'storage parsing belongs in _lib/angle-workspace-helpers.ts');
  assert.doesNotMatch(workspaceSource, /function uploadImage\(/, 'upload helper belongs in _lib/angle-workspace-helpers.ts');

  const lineCount = workspaceSource.split('\n').length;
  assert.ok(lineCount <= 1520, `AngleWorkspace should stay below 1520 lines after helper extraction, got ${lineCount}`);
});

test('angle helper modules expose the expected workspace contract', () => {
  const copySource = readFileSync(copyPath, 'utf8');
  const typesSource = readFileSync(typesPath, 'utf8');
  const helpersSource = readFileSync(helpersPath, 'utf8');

  assert.match(copySource, /export const DEFAULT_ANGLE_COPY =/, 'copy module should export default copy');
  assert.match(copySource, /export type AngleCopy =/, 'copy module should export the copy type');

  for (const typeName of ['UploadedImage', 'LibraryAsset', 'BillingProductResponse', 'AnglePreviewImage', 'RecentAngleJobEntry', 'PersistedAngleToolState']) {
    assert.match(typesSource, new RegExp(`export type ${typeName}`), `${typeName} should be exported`);
  }

  for (const exportName of [
    'ENGINES',
    'DEFAULT_ENGINE_ID',
    'ANGLE_TOOL_STORAGE_KEY',
    'getAngleBillingProductKey',
    'sanitizeParams',
    'cleanupSourcePreview',
    'collectAnglePreviewImages',
    'parsePersistedAngleToolState',
    'uploadImage',
  ]) {
    assert.match(helpersSource, new RegExp(`export (const|function|async function) ${exportName}`), `${exportName} should be exported`);
  }
});
