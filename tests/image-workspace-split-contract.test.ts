import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

const root = process.cwd();
const imageDir = path.join(root, 'frontend/app/(core)/(workspace)/app/image');
const workspacePath = path.join(imageDir, 'ImageWorkspace.tsx');
const composerPersistenceHookPath = path.join(imageDir, '_hooks/useImageComposerPersistence.ts');
const queryHydrationHookPath = path.join(imageDir, '_hooks/useImageWorkspaceQueryHydration.ts');
const generationRunnerHookPath = path.join(imageDir, '_hooks/useImageGenerationRunner.ts');
const gallerySelectionHookPath = path.join(imageDir, '_hooks/useImageGallerySelection.ts');
const historyHookPath = path.join(imageDir, '_hooks/useImageWorkspaceHistory.ts');
const displayStateHookPath = path.join(imageDir, '_hooks/useImageWorkspaceDisplayState.ts');
const referenceAssetsHookPath = path.join(imageDir, '_hooks/useImageWorkspaceReferenceAssets.tsx');
const viewerHookPath = path.join(imageDir, '_hooks/useImageWorkspaceViewer.ts');
const composerSurfacePath = path.join(imageDir, '_components/ImageWorkspaceComposerSurface.tsx');
const galleryRailPath = path.join(imageDir, '_components/ImageWorkspaceGalleryRail.tsx');
const runtimeModalsPath = path.join(imageDir, '_components/ImageWorkspaceRuntimeModals.tsx');
const shellPath = path.join(imageDir, '_components/ImageWorkspaceShell.tsx');
const emptyStatePath = path.join(imageDir, '_components/ImageWorkspaceEmptyState.tsx');
const routeContextHookPath = path.join(imageDir, '_hooks/useImageWorkspaceRouteContext.ts');
const referenceAwareCountsHookPath = path.join(imageDir, '_hooks/useImageReferenceAwareImageCounts.ts');

const splitFiles = [
  '_components/ImageAuthGateModal.tsx',
  '_components/ImageLibraryModal.tsx',
  '_components/ImageWorkspaceRuntimeModals.tsx',
  '_components/ImageWorkspaceShell.tsx',
  '_components/ImageWorkspaceEmptyState.tsx',
  '_components/ImageWorkspaceGalleryRail.tsx',
  '_components/ImageWorkspaceComposerSurface.tsx',
  '_hooks/useImageComposerPersistence.ts',
  '_hooks/useImageWorkspaceDisplayState.ts',
  '_hooks/useImageWorkspaceReferenceAssets.tsx',
  '_hooks/useImageWorkspaceViewer.ts',
  '_hooks/useImageWorkspaceHistory.ts',
  '_hooks/useImageWorkspacePricing.ts',
  '_hooks/useImageWorkspaceDesktopLayout.ts',
  '_hooks/useImageWorkspaceQueryHydration.ts',
  '_hooks/useImageWorkspaceRouteContext.ts',
  '_hooks/useImageWorkspaceModeSync.ts',
  '_hooks/useImageWorkspacePresetHandlers.ts',
  '_hooks/useImageWorkspaceSelectedEngine.ts',
  '_hooks/useImageReferenceAwareImageCounts.ts',
  '_hooks/useImageGenerationRunner.ts',
  '_hooks/useImageGallerySelection.ts',
  '_lib/image-workspace-character-references.ts',
  '_lib/image-workspace-copy.ts',
  '_lib/image-workspace-history.ts',
  '_lib/image-workspace-persistence.ts',
  '_lib/image-workspace-types.ts',
  '_lib/image-workspace-utils.ts',
] as const;

function readImageWorkspace() {
  return readFileSync(workspacePath, 'utf8');
}

test('image workspace foundations are split from the route orchestrator', () => {
  const source = readImageWorkspace();
  const composerPersistenceHookSource = readFileSync(composerPersistenceHookPath, 'utf8');
  const queryHydrationHookSource = readFileSync(queryHydrationHookPath, 'utf8');
  const generationRunnerHookSource = readFileSync(generationRunnerHookPath, 'utf8');
  const gallerySelectionHookSource = readFileSync(gallerySelectionHookPath, 'utf8');
  const historyHookSource = readFileSync(historyHookPath, 'utf8');
  const displayStateHookSource = readFileSync(displayStateHookPath, 'utf8');
  const referenceAssetsHookSource = readFileSync(referenceAssetsHookPath, 'utf8');
  const viewerHookSource = readFileSync(viewerHookPath, 'utf8');
  const composerSurfaceSource = readFileSync(composerSurfacePath, 'utf8');
  const galleryRailSource = readFileSync(galleryRailPath, 'utf8');
  const runtimeModalsSource = readFileSync(runtimeModalsPath, 'utf8');
  const shellSource = readFileSync(shellPath, 'utf8');
  const emptyStateSource = readFileSync(emptyStatePath, 'utf8');
  const routeContextHookSource = readFileSync(routeContextHookPath, 'utf8');
  const referenceAwareCountsHookSource = readFileSync(referenceAwareCountsHookPath, 'utf8');

  for (const file of splitFiles) {
    statSync(path.join(imageDir, file));
  }

  assert.match(source, /from '\.\/_components\/ImageWorkspaceComposerSurface'/);
  assert.match(source, /from '\.\/_components\/ImageWorkspaceRuntimeModals'/);
  assert.match(source, /from '\.\/_components\/ImageWorkspaceShell'/);
  assert.match(source, /from '\.\/_components\/ImageWorkspaceEmptyState'/);
  assert.match(source, /from '\.\/_hooks\/useImageComposerPersistence'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceDisplayState'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceReferenceAssets'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceViewer'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceHistory'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspacePricing'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceDesktopLayout'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceQueryHydration'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceRouteContext'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceModeSync'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspacePresetHandlers'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceSelectedEngine'/);
  assert.match(source, /from '\.\/_hooks\/useImageReferenceAwareImageCounts'/);
  assert.match(source, /from '\.\/_hooks\/useImageGenerationRunner'/);
  assert.match(source, /from '\.\/_hooks\/useImageGallerySelection'/);
  assert.match(
    source,
    /onOpenHistoryEntry:\s*handleOpenHistoryEntry/,
    'gallery rail open action should reuse the image viewer modal opener'
  );

  assert.doesNotMatch(source, /const DEFAULT_COPY: ImageWorkspaceCopy =/);
  assert.doesNotMatch(source, /function ImageLibraryModal\(/);
  assert.doesNotMatch(source, /function ImageAuthGateModal\(/);
  assert.doesNotMatch(source, /resolvedCopy\.authGate\.primary/, 'auth gate modal UI belongs in ImageAuthGateModal');
  assert.doesNotMatch(source, /function parsePersistedImageComposerState\(/);
  assert.doesNotMatch(source, /function mapJobToHistoryEntry\(/);
  assert.doesNotMatch(source, /function buildPendingGroup\(/);
  assert.doesNotMatch(source, /function buildCompletedGroup\(/);
  assert.doesNotMatch(source, /useSWR\(/, 'pricing SWR orchestration belongs in useImageWorkspacePricing');
  assert.doesNotMatch(source, /useInfiniteJobs\(24, \{ surface: 'image' \}\)/, 'image job feed orchestration belongs in useImageWorkspaceHistory');
  assert.doesNotMatch(source, /const remoteImageJobs =/, 'remote image history derivation belongs in useImageWorkspaceHistory');
  assert.doesNotMatch(source, /parsePersistedImageComposerState/, 'composer storage parsing belongs in useImageComposerPersistence');
  assert.doesNotMatch(source, /IMAGE_COMPOSER_STORAGE_KEY/, 'composer storage constants belong in useImageComposerPersistence');
  assert.doesNotMatch(source, /const requestedJobId = useMemo/, 'query job hydration belongs in useImageWorkspaceQueryHydration');
  assert.doesNotMatch(source, /const requestedEngineId = useMemo/, 'query engine hydration belongs in useImageWorkspaceQueryHydration');
  assert.doesNotMatch(source, /Job settings snapshot missing/, 'snapshot application belongs in useImageWorkspaceQueryHydration');
  assert.doesNotMatch(source, /runImageGeneration/, 'generation submission belongs in useImageGenerationRunner');
  assert.doesNotMatch(source, /readBrowserSession/, 'auth preflight belongs in useImageGenerationRunner');
  assert.doesNotMatch(source, /validateGptImage2CustomImageSize/, 'custom size validation belongs in useImageGenerationRunner');
  assert.doesNotMatch(source, /const fetchSnapshot =/, 'gallery snapshot hydration belongs in useImageGallerySelection');
  assert.doesNotMatch(source, /const previewUrls =/, 'fallback gallery image derivation belongs in useImageGallerySelection');
  assert.doesNotMatch(source, /findImageEngine/, 'gallery engine default selection belongs in useImageGallerySelection');
  assert.doesNotMatch(source, /authFetch/, 'gallery API snapshot lookup belongs in useImageGallerySelection');
  assert.doesNotMatch(source, /buildVideoGroupFromImageRun/, 'history entry viewer grouping belongs in useImageWorkspaceViewer');
  assert.doesNotMatch(source, /saveImageToLibrary/, 'viewer save actions belong in useImageWorkspaceViewer');
  assert.doesNotMatch(source, /reference_images: displayedReferenceSlots/, 'composer reference asset mapping belongs in useImageWorkspaceReferenceAssets');
  assert.doesNotMatch(source, /resolvedCopy\.composer\.characterButton/, 'character reference header action belongs in useImageWorkspaceReferenceAssets');
  assert.doesNotMatch(source, /<GalleryRail\b/, 'gallery rail wrappers belong in ImageWorkspaceGalleryRail');
  assert.doesNotMatch(source, /<Composer\b/, 'composer JSX belongs in ImageWorkspaceComposerSurface');
  assert.doesNotMatch(source, /<ImageCompositePreviewDock\b/, 'preview dock JSX belongs in ImageWorkspaceComposerSurface');
  assert.doesNotMatch(source, /<ImageSettingsBar\b/, 'settings bar JSX belongs in ImageWorkspaceComposerSurface');
  assert.doesNotMatch(source, /<ImageAdvancedSettings\b/, 'advanced settings JSX belongs in ImageWorkspaceComposerSurface');
  assert.doesNotMatch(source, /<EngineSelect\b/, 'image engine selector JSX belongs in ImageWorkspaceComposerSurface');

  assert.match(composerSurfaceSource, /export function ImageWorkspaceComposerSurface/);
  assert.match(composerSurfaceSource, /<ImageCompositePreviewDock\b/);
  assert.match(composerSurfaceSource, /<Composer\b/);
  assert.match(composerSurfaceSource, /<ImageSettingsBar\b/);
  assert.match(composerSurfaceSource, /<ImageAdvancedSettings\b/);
  assert.match(composerSurfaceSource, /<EngineSelect\b/);

  assert.match(composerPersistenceHookSource, /export function useImageComposerPersistence/);
  assert.match(composerPersistenceHookSource, /parsePersistedImageComposerState/);
  assert.match(composerPersistenceHookSource, /IMAGE_COMPOSER_STORAGE_DEBOUNCE_MS/);
  assert.match(composerPersistenceHookSource, /localStorage\.getItem\(IMAGE_COMPOSER_STORAGE_KEY\)/);
  assert.match(composerPersistenceHookSource, /localStorage\.setItem\(IMAGE_COMPOSER_STORAGE_KEY, serialized\)/);
  assert.match(queryHydrationHookSource, /export function useImageWorkspaceQueryHydration/);
  assert.match(queryHydrationHookSource, /const requestedJobId = useMemo/);
  assert.match(queryHydrationHookSource, /const requestedEngineId = useMemo/);
  assert.match(queryHydrationHookSource, /applyImageSettingsSnapshot/);
  assert.match(generationRunnerHookSource, /export function useImageGenerationRunner/);
  assert.match(generationRunnerHookSource, /runImageGeneration/);
  assert.match(generationRunnerHookSource, /supabase\.auth\.getSession\(\)/);
  assert.match(generationRunnerHookSource, /from '\.\.\/_lib\/image-workspace-history'/);
  assert.match(generationRunnerHookSource, /buildPendingGroup/);
  assert.match(generationRunnerHookSource, /buildCompletedGroup/);
  assert.match(gallerySelectionHookSource, /export function useImageGallerySelection/);
  assert.match(gallerySelectionHookSource, /findImageEngine/);
  assert.match(gallerySelectionHookSource, /getAspectRatioOptions/);
  assert.match(gallerySelectionHookSource, /authFetch/);
  assert.match(gallerySelectionHookSource, /const previewUrls =/);
  assert.match(gallerySelectionHookSource, /onOpenHistoryEntry\?\.\(/);
  assert.match(historyHookSource, /hasUnresolvedPendingGroups/);
  assert.doesNotMatch(
    historyHookSource,
    /setTimeout\(\(\) => \{\s*window\.clearInterval\(intervalId\);\s*\},\s*30000\)/,
    'image workspace pending polling must not stop before long-running Seedream batches finish'
  );
  assert.match(displayStateHookSource, /export function useImageWorkspaceDisplayState/);
  assert.match(displayStateHookSource, /compositePreviewEntry/);
  assert.match(displayStateHookSource, /estimatedCostAmount/);
  assert.match(referenceAssetsHookSource, /export function useImageWorkspaceReferenceAssets/);
  assert.match(referenceAssetsHookSource, /reference_images/);
  assert.match(referenceAssetsHookSource, /openCharacterLibrary/);
  assert.match(viewerHookSource, /export function useImageWorkspaceViewer/);
  assert.match(viewerHookSource, /buildVideoGroupFromImageRun/);
  assert.match(viewerHookSource, /saveImageToLibrary/);
  assert.match(galleryRailSource, /export function ImageWorkspaceGalleryRail/);
  assert.match(galleryRailSource, /<GalleryRail\b/);
  assert.match(runtimeModalsSource, /export function ImageWorkspaceRuntimeModals/);
  assert.match(runtimeModalsSource, /<ImageAuthGateModal\b/);
  assert.match(runtimeModalsSource, /<ImageLibraryModal\b/);
  assert.match(runtimeModalsSource, /GroupViewerModal/);
  assert.match(shellSource, /export function ImageWorkspaceShell/);
  assert.match(shellSource, /<ImageWorkspaceGalleryRail\b/);
  assert.match(emptyStateSource, /export function ImageWorkspaceEmptyState/);
  assert.match(routeContextHookSource, /mergeCopy/);
  assert.match(referenceAwareCountsHookSource, /resolveSeedreamMaxOutputImages/);
  assert.match(referenceAwareCountsHookSource, /buildImageCountOptionsWithinMax/);

  const lineCount = source.split('\n').length;
  assert.ok(lineCount <= 500, `ImageWorkspace should stay below 500 lines after shell extraction, got ${lineCount}`);
});
