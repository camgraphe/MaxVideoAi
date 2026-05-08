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

const splitFiles = [
  '_components/ImageAuthGateModal.tsx',
  '_components/ImageLibraryModal.tsx',
  '_hooks/useImageComposerPersistence.ts',
  '_hooks/useImageWorkspaceHistory.ts',
  '_hooks/useImageWorkspacePricing.ts',
  '_hooks/useImageWorkspaceDesktopLayout.ts',
  '_hooks/useImageWorkspaceQueryHydration.ts',
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

  for (const file of splitFiles) {
    statSync(path.join(imageDir, file));
  }

  assert.match(source, /from '\.\/_components\/ImageLibraryModal'/);
  assert.match(source, /from '\.\/_components\/ImageAuthGateModal'/);
  assert.match(source, /from '\.\/_hooks\/useImageComposerPersistence'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceHistory'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspacePricing'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceDesktopLayout'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceQueryHydration'/);
  assert.match(source, /from '\.\/_hooks\/useImageGenerationRunner'/);
  assert.match(source, /from '\.\/_hooks\/useImageGallerySelection'/);
  assert.match(source, /from '\.\/_lib\/image-workspace-copy'/);

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
  assert.match(generationRunnerHookSource, /readBrowserSession/);
  assert.match(generationRunnerHookSource, /from '\.\.\/_lib\/image-workspace-history'/);
  assert.match(generationRunnerHookSource, /buildPendingGroup/);
  assert.match(generationRunnerHookSource, /buildCompletedGroup/);
  assert.match(gallerySelectionHookSource, /export function useImageGallerySelection/);
  assert.match(gallerySelectionHookSource, /findImageEngine/);
  assert.match(gallerySelectionHookSource, /getAspectRatioOptions/);
  assert.match(gallerySelectionHookSource, /authFetch/);
  assert.match(gallerySelectionHookSource, /const previewUrls =/);

  const lineCount = source.split('\n').length;
  assert.ok(lineCount <= 830, `ImageWorkspace should stay below 830 lines after gallery selection extraction, got ${lineCount}`);
});
