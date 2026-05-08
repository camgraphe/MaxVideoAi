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
const previewScrollerHookPath = join(root, 'frontend/src/components/tools/upscale/_hooks/useUpscalePreviewScroller.ts');
const previewStateHookPath = join(root, 'frontend/src/components/tools/upscale/_hooks/useUpscalePreviewState.ts');
const recentJobsHookPath = join(root, 'frontend/src/components/tools/upscale/_hooks/useUpscaleRecentJobs.ts');
const sourceMediaHookPath = join(root, 'frontend/src/components/tools/upscale/_hooks/useUpscaleSourceMedia.ts');
const controlsPath = join(root, 'frontend/src/components/tools/upscale/_components/upscale-workspace-controls.tsx');
const inputPanelsPath = join(root, 'frontend/src/components/tools/upscale/_components/UpscaleInputPanels.tsx');
const heroSummaryCardPath = join(root, 'frontend/src/components/tools/upscale/_components/UpscaleHeroSummaryCard.tsx');
const libraryModalPath = join(root, 'frontend/src/components/tools/upscale/_components/UpscaleLibraryModal.tsx');
const previewCardPath = join(root, 'frontend/src/components/tools/upscale/_components/UpscalePreviewCard.tsx');
const recentRailPath = join(root, 'frontend/src/components/tools/upscale/_components/UpscaleRecentRail.tsx');

const workspaceSource = readFileSync(workspacePath, 'utf8');

test('upscale workspace delegates copy, local types, and helper logic', () => {
  assert.ok(existsSync(copyPath), 'upscale workspace copy should live in a colocated copy module');
  assert.ok(existsSync(typesPath), 'upscale workspace local contracts should live in a colocated type module');
  assert.ok(existsSync(helpersPath), 'upscale workspace helper logic should live in a colocated helper module');
  assert.ok(existsSync(libraryHookPath), 'upscale library asset loading should live in a colocated hook');
  assert.ok(existsSync(pricingHookPath), 'upscale pricing preview should live in a colocated hook');
  assert.ok(existsSync(previewScrollerHookPath), 'upscale preview scroller should live in a colocated hook');
  assert.ok(existsSync(previewStateHookPath), 'upscale preview state should live in a colocated hook');
  assert.ok(existsSync(recentJobsHookPath), 'upscale recent jobs orchestration should live in a colocated hook');
  assert.ok(existsSync(sourceMediaHookPath), 'upscale source media orchestration should live in a colocated hook');
  assert.ok(existsSync(controlsPath), 'upscale workspace controls should live in colocated components');
  assert.ok(existsSync(inputPanelsPath), 'upscale input panels should live in colocated components');
  assert.ok(existsSync(heroSummaryCardPath), 'upscale hero summary should live in a colocated component');
  assert.ok(existsSync(libraryModalPath), 'upscale library modal should live in a colocated component');
  assert.ok(existsSync(previewCardPath), 'upscale preview card should live in a colocated component');
  assert.ok(existsSync(recentRailPath), 'upscale recent rail should live in a colocated component');

  assert.match(workspaceSource, /from '\.\/upscale\/_lib\/upscale-workspace-copy'/, 'workspace should import upscale copy');
  assert.match(workspaceSource, /from '\.\/upscale\/_lib\/upscale-workspace-types'/, 'workspace should import upscale local types');
  assert.match(workspaceSource, /from '\.\/upscale\/_lib\/upscale-workspace-helpers'/, 'workspace should import upscale helpers');
  assert.match(workspaceSource, /from '\.\/upscale\/_hooks\/useUpscaleLibraryAssets'/, 'workspace should import library hook');
  assert.match(workspaceSource, /from '\.\/upscale\/_hooks\/useUpscalePricingPreview'/, 'workspace should import pricing hook');
  assert.match(workspaceSource, /from '\.\/upscale\/_hooks\/useUpscalePreviewScroller'/, 'workspace should import preview scroller hook');
  assert.match(workspaceSource, /from '\.\/upscale\/_hooks\/useUpscalePreviewState'/, 'workspace should import preview state hook');
  assert.match(workspaceSource, /from '\.\/upscale\/_hooks\/useUpscaleRecentJobs'/, 'workspace should import recent jobs hook');
  assert.match(workspaceSource, /from '\.\/upscale\/_hooks\/useUpscaleSourceMedia'/, 'workspace should import source media hook');
  assert.match(workspaceSource, /from '\.\/upscale\/_components\/UpscaleInputPanels'/, 'workspace should import input panels');
  assert.match(workspaceSource, /from '\.\/upscale\/_components\/UpscaleHeroSummaryCard'/, 'workspace should import hero summary card');
  assert.match(workspaceSource, /from '\.\/upscale\/_components\/UpscaleLibraryModal'/, 'workspace should import library modal');
  assert.match(workspaceSource, /from '\.\/upscale\/_components\/UpscalePreviewCard'/, 'workspace should import preview card');
  assert.match(workspaceSource, /from '\.\/upscale\/_components\/UpscaleRecentRail'/, 'workspace should import recent rail');
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
  assert.doesNotMatch(workspaceSource, /mediaTypeFromMime/, 'source media MIME detection belongs in useUpscaleSourceMedia');
  assert.doesNotMatch(workspaceSource, /new window\.Image/, 'source image dimension hydration belongs in useUpscaleSourceMedia');
  assert.doesNotMatch(workspaceSource, /function selectLibraryAsset\(/, 'library source selection belongs in useUpscaleSourceMedia');
  assert.doesNotMatch(workspaceSource, /function Label\(/, 'workspace labels belong in upscale workspace controls');
  assert.doesNotMatch(workspaceSource, /function SegmentButton\(/, 'workspace segment buttons belong in upscale workspace controls');
  assert.doesNotMatch(workspaceSource, /requestAnimationFrame/, 'preview centering belongs in useUpscalePreviewScroller');
  assert.doesNotMatch(workspaceSource, /scrollLeft/, 'preview scroll position belongs in useUpscalePreviewScroller');
  assert.doesNotMatch(workspaceSource, /rounded-\[20px\] border border-border bg-surface-glass-90/, 'hero summary card belongs in UpscaleHeroSummaryCard');
  assert.doesNotMatch(workspaceSource, /const sourcePreviewUrl =/, 'preview URL derivation belongs in useUpscalePreviewState');
  assert.doesNotMatch(workspaceSource, /const zoomCanvasWidth =/, 'preview canvas sizing belongs in useUpscalePreviewState');
  assert.doesNotMatch(workspaceSource, /function updateComparePosition\(/, 'compare slider updates belong in useUpscalePreviewState');
  assert.doesNotMatch(workspaceSource, /setComparePosition/, 'compare keyboard updates belong in useUpscalePreviewState');
  assert.doesNotMatch(workspaceSource, /Before \/ after preview/, 'preview JSX belongs in UpscalePreviewCard');
  assert.doesNotMatch(workspaceSource, /PREVIEW_ZOOM_OPTIONS/, 'preview zoom controls belong in UpscalePreviewCard');
  assert.doesNotMatch(workspaceSource, /recentGroups\.slice/, 'recent rail rendering belongs in UpscaleRecentRail');
  assert.doesNotMatch(workspaceSource, /Reuse finished assets/, 'recent rail copy belongs in UpscaleRecentRail');
  assert.doesNotMatch(workspaceSource, /<GroupedJobCard/, 'recent job cards belong in UpscaleRecentRail');
  assert.doesNotMatch(workspaceSource, /Source asset/, 'source panel JSX belongs in UpscaleInputPanels');
  assert.doesNotMatch(workspaceSource, /Drop file here/, 'upload dropzone JSX belongs in UpscaleInputPanels');
  assert.doesNotMatch(workspaceSource, /Choose how you want to enhance/, 'recipe panel JSX belongs in UpscaleInputPanels');
  assert.doesNotMatch(workspaceSource, /<SelectMenu/, 'recipe selectors belong in UpscaleInputPanels');
  assert.doesNotMatch(workspaceSource, /<AssetLibraryBrowser/, 'library browser JSX belongs in UpscaleLibraryModal');
  assert.doesNotMatch(workspaceSource, /RefreshCw/, 'library refresh action belongs in UpscaleLibraryModal');
  assert.doesNotMatch(workspaceSource, /copy\.libraryRefresh/, 'library refresh copy belongs in UpscaleLibraryModal');
  assert.doesNotMatch(workspaceSource, /copy\.libraryUse/, 'library asset actions belong in UpscaleLibraryModal');

  const lineCount = workspaceSource.split('\n').length;
  assert.ok(lineCount <= 620, `UpscaleWorkspace should stay below 620 lines after library modal extraction, got ${lineCount}`);
});

test('upscale helper modules expose the expected workspace contract', () => {
  const copySource = readFileSync(copyPath, 'utf8');
  const typesSource = readFileSync(typesPath, 'utf8');
  const helpersSource = readFileSync(helpersPath, 'utf8');
  const libraryHookSource = readFileSync(libraryHookPath, 'utf8');
  const pricingHookSource = readFileSync(pricingHookPath, 'utf8');
  const previewScrollerHookSource = readFileSync(previewScrollerHookPath, 'utf8');
  const previewStateHookSource = readFileSync(previewStateHookPath, 'utf8');
  const recentJobsHookSource = readFileSync(recentJobsHookPath, 'utf8');
  const sourceMediaHookSource = readFileSync(sourceMediaHookPath, 'utf8');
  const controlsSource = readFileSync(controlsPath, 'utf8');
  const inputPanelsSource = readFileSync(inputPanelsPath, 'utf8');
  const heroSummaryCardSource = readFileSync(heroSummaryCardPath, 'utf8');
  const libraryModalSource = readFileSync(libraryModalPath, 'utf8');
  const previewCardSource = readFileSync(previewCardPath, 'utf8');
  const recentRailSource = readFileSync(recentRailPath, 'utf8');

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
  assert.match(previewScrollerHookSource, /export function useUpscalePreviewScroller/, 'preview scroller hook should be exported');
  assert.match(previewScrollerHookSource, /requestAnimationFrame/, 'preview scroller hook should center zoomed previews');
  assert.match(previewScrollerHookSource, /scrollLeft/, 'preview scroller hook should own horizontal scroll positioning');
  assert.match(previewStateHookSource, /export function useUpscalePreviewState/, 'preview state hook should be exported');
  assert.match(previewStateHookSource, /clampComparePosition/, 'preview state hook should clamp compare slider positions');
  assert.match(previewStateHookSource, /isOutputVideo/, 'preview state hook should resolve output media kind');
  assert.match(previewStateHookSource, /SOURCE_FALLBACK_WIDTH/, 'preview state hook should own fallback preview sizing');
  assert.match(previewStateHookSource, /handleCompareKeyDown/, 'preview state hook should own compare keyboard handling');
  assert.match(recentJobsHookSource, /export function useUpscaleRecentJobs/, 'recent jobs hook should be exported');
  assert.match(recentJobsHookSource, /useInfiniteJobs\(12, \{ surface: 'upscale' \}\)/, 'recent jobs hook should own the upscale feed');
  assert.match(recentJobsHookSource, /getJobStatus/, 'recent jobs hook should poll pending jobs');
  assert.match(recentJobsHookSource, /resolveGeneratedImageSource/, 'recent jobs hook should hydrate the default generated image source');
  assert.match(sourceMediaHookSource, /export function useUpscaleSourceMedia/, 'source media hook should be exported');
  assert.match(sourceMediaHookSource, /uploadSourceFile/, 'source media hook should own source uploads');
  assert.match(sourceMediaHookSource, /mediaTypeFromMime/, 'source media hook should own MIME detection');
  assert.match(sourceMediaHookSource, /new window\.Image/, 'source media hook should hydrate image dimensions');
  assert.match(controlsSource, /export function Label/, 'workspace label component should be exported');
  assert.match(controlsSource, /export function SegmentButton/, 'workspace segment button should be exported');
  assert.match(inputPanelsSource, /export function UpscaleSourcePanel/, 'source panel should be exported');
  assert.match(inputPanelsSource, /export function UpscaleRecipePanel/, 'recipe panel should be exported');
  assert.match(inputPanelsSource, /SegmentButton/, 'input panels should own media type controls');
  assert.match(inputPanelsSource, /SelectMenu/, 'input panels should own recipe selectors');
  assert.match(heroSummaryCardSource, /export function UpscaleHeroSummaryCard/, 'hero summary card should be exported');
  assert.match(heroSummaryCardSource, /WandSparkles/, 'hero summary card should own its action icon');
  assert.match(libraryModalSource, /export function UpscaleLibraryModal/, 'library modal should be exported');
  assert.match(libraryModalSource, /AssetLibraryBrowser/, 'library modal should own the shared library browser');
  assert.match(libraryModalSource, /RefreshCw/, 'library modal should own refresh action rendering');
  assert.match(libraryModalSource, /copy\.libraryUse/, 'library modal should own asset action copy');
  assert.match(previewCardSource, /export function UpscalePreviewCard/, 'preview card should be exported');
  assert.match(previewCardSource, /PREVIEW_ZOOM_OPTIONS/, 'preview card should own zoom controls');
  assert.match(previewCardSource, /ChevronsLeftRight/, 'preview card should own compare affordance');
  assert.match(recentRailSource, /export function UpscaleRecentRail/, 'recent rail should be exported');
  assert.match(recentRailSource, /GroupedJobCard/, 'recent rail should own grouped card rendering');
  assert.match(recentRailSource, /\/app\/library/, 'recent rail should own its library link');
});
