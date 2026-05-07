import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const workspacePath = join(root, 'frontend/src/components/tools/UpscaleWorkspace.tsx');
const copyPath = join(root, 'frontend/src/components/tools/upscale/_lib/upscale-workspace-copy.ts');
const typesPath = join(root, 'frontend/src/components/tools/upscale/_lib/upscale-workspace-types.ts');
const helpersPath = join(root, 'frontend/src/components/tools/upscale/_lib/upscale-workspace-helpers.ts');
const libraryHookPath = join(root, 'frontend/src/components/tools/upscale/_hooks/useUpscaleLibraryAssets.ts');
const pricingHookPath = join(root, 'frontend/src/components/tools/upscale/_hooks/useUpscalePricingPreview.ts');
const recentJobsHookPath = join(root, 'frontend/src/components/tools/upscale/_hooks/useUpscaleRecentJobs.ts');

const workspaceSource = readFileSync(workspacePath, 'utf8');

test('upscale workspace delegates copy, local types, and helper logic', () => {
  assert.ok(existsSync(copyPath), 'upscale workspace copy should live in a colocated copy module');
  assert.ok(existsSync(typesPath), 'upscale workspace local contracts should live in a colocated type module');
  assert.ok(existsSync(helpersPath), 'upscale workspace helper logic should live in a colocated helper module');
  assert.ok(existsSync(libraryHookPath), 'upscale library asset loading should live in a colocated hook');
  assert.ok(existsSync(pricingHookPath), 'upscale pricing preview should live in a colocated hook');
  assert.ok(existsSync(recentJobsHookPath), 'upscale recent jobs orchestration should live in a colocated hook');

  assert.match(workspaceSource, /from '\.\/upscale\/_lib\/upscale-workspace-copy'/, 'workspace should import upscale copy');
  assert.match(workspaceSource, /from '\.\/upscale\/_lib\/upscale-workspace-types'/, 'workspace should import upscale local types');
  assert.match(workspaceSource, /from '\.\/upscale\/_lib\/upscale-workspace-helpers'/, 'workspace should import upscale helpers');
  assert.match(workspaceSource, /from '\.\/upscale\/_hooks\/useUpscaleLibraryAssets'/, 'workspace should import library hook');
  assert.match(workspaceSource, /from '\.\/upscale\/_hooks\/useUpscalePricingPreview'/, 'workspace should import pricing hook');
  assert.match(workspaceSource, /from '\.\/upscale\/_hooks\/useUpscaleRecentJobs'/, 'workspace should import recent jobs hook');
});

test('upscale workspace does not regain extracted ownership', () => {
  assert.doesNotMatch(workspaceSource, /const DEFAULT_COPY =/, 'workspace copy belongs in _lib/upscale-workspace-copy.ts');
  assert.doesNotMatch(workspaceSource, /type UploadedAsset =/, 'local asset contracts belong in _lib/upscale-workspace-types.ts');
  assert.doesNotMatch(workspaceSource, /function resolveRecentUpscaleMedia\(/, 'recent media resolution belongs in _lib/upscale-workspace-helpers.ts');
  assert.doesNotMatch(workspaceSource, /function uploadSourceFile\(/, 'upload helper belongs in _lib/upscale-workspace-helpers.ts');
  assert.doesNotMatch(workspaceSource, /function readVideoPricingMetadata\(/, 'video metadata reader belongs in _lib/upscale-workspace-helpers.ts');
  assert.doesNotMatch(workspaceSource, /UserAssetsResponse/, 'library asset response parsing belongs in useUpscaleLibraryAssets');
  assert.doesNotMatch(workspaceSource, /JobsLibraryResponse/, 'generated video library merging belongs in useUpscaleLibraryAssets');
  assert.doesNotMatch(workspaceSource, /buildLibraryCacheKey/, 'library cache key orchestration belongs in useUpscaleLibraryAssets');
  assert.doesNotMatch(workspaceSource, /buildUpscalePricingPreview/, 'pricing preview orchestration belongs in useUpscalePricingPreview');
  assert.doesNotMatch(workspaceSource, /readVideoPricingMetadata/, 'video pricing metadata loading belongs in useUpscalePricingPreview');
  assert.doesNotMatch(workspaceSource, /BillingProductResponse/, 'billing product parsing belongs in useUpscalePricingPreview');
  assert.doesNotMatch(workspaceSource, /useInfiniteJobs\(12, \{ surface: 'upscale' \}\)/, 'recent upscale feed belongs in useUpscaleRecentJobs');
  assert.doesNotMatch(workspaceSource, /getJobStatus/, 'recent job polling belongs in useUpscaleRecentJobs');
  assert.doesNotMatch(workspaceSource, /defaultGeneratedImageAppliedRef/, 'default generated image hydration belongs in useUpscaleRecentJobs');

  const lineCount = workspaceSource.split('\n').length;
  assert.ok(lineCount <= 1130, `UpscaleWorkspace should stay below 1130 lines after recent jobs hook extraction, got ${lineCount}`);
});

test('upscale helper modules expose the expected workspace contract', () => {
  const copySource = readFileSync(copyPath, 'utf8');
  const typesSource = readFileSync(typesPath, 'utf8');
  const helpersSource = readFileSync(helpersPath, 'utf8');
  const libraryHookSource = readFileSync(libraryHookPath, 'utf8');
  const pricingHookSource = readFileSync(pricingHookPath, 'utf8');
  const recentJobsHookSource = readFileSync(recentJobsHookPath, 'utf8');

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

  assert.match(libraryHookSource, /export function useUpscaleLibraryAssets/, 'library hook should be exported');
  assert.match(libraryHookSource, /buildLibraryCacheKey/, 'library hook should own cache key usage');
  assert.match(libraryHookSource, /UserAssetsResponse/, 'library hook should parse saved asset responses');
  assert.match(libraryHookSource, /JobsLibraryResponse/, 'library hook should merge generated video jobs');
  assert.match(pricingHookSource, /export function useUpscalePricingPreview/, 'pricing hook should be exported');
  assert.match(pricingHookSource, /buildUpscalePricingPreview/, 'pricing hook should build the preview');
  assert.match(pricingHookSource, /readVideoPricingMetadata/, 'pricing hook should load video metadata');
  assert.match(pricingHookSource, /BillingProductResponse/, 'pricing hook should parse billing products');
  assert.match(recentJobsHookSource, /export function useUpscaleRecentJobs/, 'recent jobs hook should be exported');
  assert.match(recentJobsHookSource, /useInfiniteJobs\(12, \{ surface: 'upscale' \}\)/, 'recent jobs hook should own the upscale feed');
  assert.match(recentJobsHookSource, /getJobStatus/, 'recent jobs hook should poll pending jobs');
  assert.match(recentJobsHookSource, /resolveGeneratedImageSource/, 'recent jobs hook should hydrate the default generated image source');
});
