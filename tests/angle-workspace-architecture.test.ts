import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const workspacePath = join(root, 'frontend/src/components/tools/AngleWorkspace.tsx');
const componentsDir = join(root, 'frontend/src/components/tools/angle/_components');
const libraryModalPath = join(componentsDir, 'angle-image-library-modal.tsx');
const orbitSelectorPath = join(componentsDir, 'angle-orbit-selector.tsx');
const outputMosaicPath = join(componentsDir, 'angle-output-mosaic.tsx');
const copyPath = join(root, 'frontend/src/components/tools/angle/_lib/angle-workspace-copy.ts');
const typesPath = join(root, 'frontend/src/components/tools/angle/_lib/angle-workspace-types.ts');
const helpersPath = join(root, 'frontend/src/components/tools/angle/_lib/angle-workspace-helpers.ts');

const workspaceSource = readFileSync(workspacePath, 'utf8');

test('angle workspace delegates copy, local types, and helper logic', () => {
  assert.ok(existsSync(libraryModalPath), 'angle library modal should live in a colocated component module');
  assert.ok(existsSync(orbitSelectorPath), 'angle orbit selector should live in a colocated component module');
  assert.ok(existsSync(outputMosaicPath), 'angle output mosaic should live in a colocated component module');
  assert.ok(existsSync(copyPath), 'angle workspace copy should live in a route-local copy module');
  assert.ok(existsSync(typesPath), 'angle workspace local contracts should live in a route-local type module');
  assert.ok(existsSync(helpersPath), 'angle workspace helper logic should live in a route-local helper module');

  assert.match(workspaceSource, /from '\.\/angle\/_components\/angle-image-library-modal'/, 'workspace should import angle library modal');
  assert.match(workspaceSource, /from '\.\/angle\/_components\/angle-orbit-selector'/, 'workspace should import angle orbit selector');
  assert.match(workspaceSource, /from '\.\/angle\/_components\/angle-output-mosaic'/, 'workspace should import angle output mosaic');
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
  assert.doesNotMatch(workspaceSource, /function AngleImageLibraryModal\(/, 'library modal JSX belongs in _components/angle-image-library-modal.tsx');
  assert.doesNotMatch(workspaceSource, /function AngleOrbitSelector\(/, 'orbit selector JSX belongs in _components/angle-orbit-selector.tsx');
  assert.doesNotMatch(workspaceSource, /function AngleOutputMosaic\(/, 'output mosaic JSX belongs in _components/angle-output-mosaic.tsx');
  assert.doesNotMatch(workspaceSource, /import dynamic from 'next\/dynamic'/, 'orbit canvas dynamic import belongs in angle orbit selector component');

  const lineCount = workspaceSource.split('\n').length;
  assert.ok(lineCount <= 1100, `AngleWorkspace should stay below 1100 lines after UI extraction, got ${lineCount}`);
});

test('angle helper modules expose the expected workspace contract', () => {
  const libraryModalSource = readFileSync(libraryModalPath, 'utf8');
  const orbitSelectorSource = readFileSync(orbitSelectorPath, 'utf8');
  const outputMosaicSource = readFileSync(outputMosaicPath, 'utf8');
  const copySource = readFileSync(copyPath, 'utf8');
  const typesSource = readFileSync(typesPath, 'utf8');
  const helpersSource = readFileSync(helpersPath, 'utf8');

  assert.match(libraryModalSource, /export function AngleImageLibraryModal/, 'library modal module should export AngleImageLibraryModal');
  assert.match(orbitSelectorSource, /export function AngleOrbitSelector/, 'orbit selector module should export AngleOrbitSelector');
  assert.match(orbitSelectorSource, /dynamic\(\(\) => import\('@\/components\/tools\/AngleOrbitCanvas'\)/, 'orbit selector should own the dynamic canvas import');
  assert.match(outputMosaicSource, /export function AngleOutputMosaic/, 'output mosaic module should export AngleOutputMosaic');

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
