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
const outputPanelPath = join(componentsDir, 'angle-output-panel.tsx');
const recentJobModalPath = join(componentsDir, 'angle-recent-job-modal.tsx');
const authGateModalPath = join(componentsDir, 'angle-auth-gate-modal.tsx');
const generationRunnerHookPath = join(root, 'frontend/src/components/tools/angle/_hooks/useAngleGenerationRunner.ts');
const copyPath = join(root, 'frontend/src/components/tools/angle/_lib/angle-workspace-copy.ts');
const typesPath = join(root, 'frontend/src/components/tools/angle/_lib/angle-workspace-types.ts');
const helpersPath = join(root, 'frontend/src/components/tools/angle/_lib/angle-workspace-helpers.ts');

const workspaceSource = readFileSync(workspacePath, 'utf8');

test('angle workspace delegates copy, local types, and helper logic', () => {
  assert.ok(existsSync(libraryModalPath), 'angle library modal should live in a colocated component module');
  assert.ok(existsSync(orbitSelectorPath), 'angle orbit selector should live in a colocated component module');
  assert.ok(existsSync(outputMosaicPath), 'angle output mosaic should live in a colocated component module');
  assert.ok(existsSync(outputPanelPath), 'angle output panel should live in a colocated component module');
  assert.ok(existsSync(recentJobModalPath), 'angle recent job modal should live in a colocated component module');
  assert.ok(existsSync(authGateModalPath), 'angle auth gate modal should live in a colocated component module');
  assert.ok(existsSync(generationRunnerHookPath), 'angle generation runner should live in a colocated hook');
  assert.ok(existsSync(copyPath), 'angle workspace copy should live in a route-local copy module');
  assert.ok(existsSync(typesPath), 'angle workspace local contracts should live in a route-local type module');
  assert.ok(existsSync(helpersPath), 'angle workspace helper logic should live in a route-local helper module');

  assert.match(workspaceSource, /from '\.\/angle\/_components\/angle-image-library-modal'/, 'workspace should import angle library modal');
  assert.match(workspaceSource, /from '\.\/angle\/_components\/angle-orbit-selector'/, 'workspace should import angle orbit selector');
  assert.match(workspaceSource, /from '\.\/angle\/_components\/angle-output-panel'/, 'workspace should import angle output panel');
  assert.match(workspaceSource, /from '\.\/angle\/_components\/angle-recent-job-modal'/, 'workspace should import angle recent job modal');
  assert.match(workspaceSource, /from '\.\/angle\/_components\/angle-auth-gate-modal'/, 'workspace should import angle auth gate modal');
  assert.match(workspaceSource, /from '\.\/angle\/_hooks\/useAngleGenerationRunner'/, 'workspace should import angle generation runner');
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
  assert.doesNotMatch(workspaceSource, /runAngleTool/, 'angle generation submission belongs in useAngleGenerationRunner');
  assert.doesNotMatch(workspaceSource, /emitClientMetric\('tool_start'/, 'generation analytics belongs in useAngleGenerationRunner');
  assert.doesNotMatch(workspaceSource, /z-\[10040\]/, 'recent job dialog JSX belongs in angle-recent-job-modal.tsx');
  assert.doesNotMatch(workspaceSource, /z-\[10050\]/, 'auth gate dialog JSX belongs in angle-auth-gate-modal.tsx');
  assert.doesNotMatch(workspaceSource, /ANGLE_GUEST_EXAMPLE_OUTPUT_URL/, 'guest output preview belongs in angle-output-panel.tsx');
  assert.doesNotMatch(workspaceSource, /copy\.previousJobs/, 'recent output rail belongs in angle-output-panel.tsx');
  assert.doesNotMatch(workspaceSource, /angle-preview-/, 'output download wiring belongs in angle-output-panel.tsx');

  const lineCount = workspaceSource.split('\n').length;
  assert.ok(lineCount <= 820, `AngleWorkspace should stay below 820 lines after output panel extraction, got ${lineCount}`);
});

test('angle helper modules expose the expected workspace contract', () => {
  const libraryModalSource = readFileSync(libraryModalPath, 'utf8');
  const orbitSelectorSource = readFileSync(orbitSelectorPath, 'utf8');
  const outputMosaicSource = readFileSync(outputMosaicPath, 'utf8');
  const outputPanelSource = readFileSync(outputPanelPath, 'utf8');
  const recentJobModalSource = readFileSync(recentJobModalPath, 'utf8');
  const authGateModalSource = readFileSync(authGateModalPath, 'utf8');
  const generationRunnerHookSource = readFileSync(generationRunnerHookPath, 'utf8');
  const copySource = readFileSync(copyPath, 'utf8');
  const typesSource = readFileSync(typesPath, 'utf8');
  const helpersSource = readFileSync(helpersPath, 'utf8');

  assert.match(libraryModalSource, /export function AngleImageLibraryModal/, 'library modal module should export AngleImageLibraryModal');
  assert.match(orbitSelectorSource, /export function AngleOrbitSelector/, 'orbit selector module should export AngleOrbitSelector');
  assert.match(orbitSelectorSource, /dynamic\(\(\) => import\('@\/components\/tools\/AngleOrbitCanvas'\)/, 'orbit selector should own the dynamic canvas import');
  assert.match(outputMosaicSource, /export function AngleOutputMosaic/, 'output mosaic module should export AngleOutputMosaic');
  assert.match(outputPanelSource, /export function AngleOutputPanel/, 'output panel module should export AngleOutputPanel');
  assert.match(outputPanelSource, /ANGLE_GUEST_EXAMPLE_OUTPUT_URL/, 'output panel should own guest output preview');
  assert.match(outputPanelSource, /AngleOutputMosaic/, 'output panel should own output mosaic composition');
  assert.match(outputPanelSource, /triggerAppDownload/, 'output panel should own output downloads');
  assert.match(recentJobModalSource, /export function AngleRecentJobModal/, 'recent job modal module should export AngleRecentJobModal');
  assert.match(recentJobModalSource, /AngleOutputMosaic/, 'recent job modal should own recent output mosaic composition');
  assert.match(authGateModalSource, /export function AngleAuthGateModal/, 'auth gate modal module should export AngleAuthGateModal');
  assert.match(authGateModalSource, /encodeURIComponent\(loginRedirectTarget\)/, 'auth gate modal should own login redirect links');
  assert.match(generationRunnerHookSource, /export function useAngleGenerationRunner/, 'generation runner hook should be exported');
  assert.match(generationRunnerHookSource, /runAngleTool/, 'generation runner hook should submit angle requests');
  assert.match(generationRunnerHookSource, /emitClientMetric\('tool_start'/, 'generation runner hook should own generation analytics');

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
