import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const workspacePath = join(root, 'frontend/src/components/tools/UpscaleWorkspace.tsx');
const copyPath = join(root, 'frontend/src/components/tools/upscale/_lib/upscale-workspace-copy.ts');
const typesPath = join(root, 'frontend/src/components/tools/upscale/_lib/upscale-workspace-types.ts');
const helpersPath = join(root, 'frontend/src/components/tools/upscale/_lib/upscale-workspace-helpers.ts');

const workspaceSource = readFileSync(workspacePath, 'utf8');

test('upscale workspace delegates copy, local types, and helper logic', () => {
  assert.ok(existsSync(copyPath), 'upscale workspace copy should live in a colocated copy module');
  assert.ok(existsSync(typesPath), 'upscale workspace local contracts should live in a colocated type module');
  assert.ok(existsSync(helpersPath), 'upscale workspace helper logic should live in a colocated helper module');

  assert.match(workspaceSource, /from '\.\/upscale\/_lib\/upscale-workspace-copy'/, 'workspace should import upscale copy');
  assert.match(workspaceSource, /from '\.\/upscale\/_lib\/upscale-workspace-types'/, 'workspace should import upscale local types');
  assert.match(workspaceSource, /from '\.\/upscale\/_lib\/upscale-workspace-helpers'/, 'workspace should import upscale helpers');
});

test('upscale workspace does not regain extracted ownership', () => {
  assert.doesNotMatch(workspaceSource, /const DEFAULT_COPY =/, 'workspace copy belongs in _lib/upscale-workspace-copy.ts');
  assert.doesNotMatch(workspaceSource, /type UploadedAsset =/, 'local asset contracts belong in _lib/upscale-workspace-types.ts');
  assert.doesNotMatch(workspaceSource, /function resolveRecentUpscaleMedia\(/, 'recent media resolution belongs in _lib/upscale-workspace-helpers.ts');
  assert.doesNotMatch(workspaceSource, /function uploadSourceFile\(/, 'upload helper belongs in _lib/upscale-workspace-helpers.ts');
  assert.doesNotMatch(workspaceSource, /function readVideoPricingMetadata\(/, 'video metadata reader belongs in _lib/upscale-workspace-helpers.ts');

  const lineCount = workspaceSource.split('\n').length;
  assert.ok(lineCount <= 1520, `UpscaleWorkspace should stay below 1520 lines after helper extraction, got ${lineCount}`);
});

test('upscale helper modules expose the expected workspace contract', () => {
  const copySource = readFileSync(copyPath, 'utf8');
  const typesSource = readFileSync(typesPath, 'utf8');
  const helpersSource = readFileSync(helpersPath, 'utf8');

  assert.match(copySource, /export const DEFAULT_UPSCALE_COPY =/, 'copy module should export default copy');

  for (const typeName of ['UploadedAsset', 'PreviewMode', 'PreviewZoom', 'RecentUpscaleMedia', 'BillingProductResponse', 'UserAssetsResponse', 'JobDetailResponse', 'JobsLibraryResponse']) {
    assert.match(typesSource, new RegExp(`export type ${typeName}`), `${typeName} should be exported`);
  }

  for (const exportName of [
    'SAMPLE_IMAGE_URL',
    'PREVIEW_ZOOM_OPTIONS',
    'isOutputVideo',
    'firstUsableUrl',
    'inferMimeType',
    'resolveRecentUpscaleMedia',
    'resolveGeneratedImageSource',
    'hasRenderableUpscaleJobMedia',
    'resolveUpscaleEngineId',
    'mediaTypeFromMime',
    'uploadSourceFile',
    'formatCurrency',
    'readVideoPricingMetadata',
    'clampComparePosition',
    'buildLibraryCacheKey',
  ]) {
    assert.match(helpersSource, new RegExp(`export (const|function|async function) ${exportName}`), `${exportName} should be exported`);
  }
});
