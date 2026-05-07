import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

const root = process.cwd();
const imageDir = path.join(root, 'frontend/app/(core)/(workspace)/app/image');
const workspacePath = path.join(imageDir, 'ImageWorkspace.tsx');
const composerPersistenceHookPath = path.join(imageDir, '_hooks/useImageComposerPersistence.ts');

const splitFiles = [
  '_components/ImageAuthGateModal.tsx',
  '_components/ImageLibraryModal.tsx',
  '_hooks/useImageComposerPersistence.ts',
  '_hooks/useImageWorkspaceHistory.ts',
  '_hooks/useImageWorkspacePricing.ts',
  '_hooks/useImageWorkspaceDesktopLayout.ts',
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

  for (const file of splitFiles) {
    statSync(path.join(imageDir, file));
  }

  assert.match(source, /from '\.\/_components\/ImageLibraryModal'/);
  assert.match(source, /from '\.\/_components\/ImageAuthGateModal'/);
  assert.match(source, /from '\.\/_hooks\/useImageComposerPersistence'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceHistory'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspacePricing'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceDesktopLayout'/);
  assert.match(source, /from '\.\/_lib\/image-workspace-copy'/);
  assert.match(source, /from '\.\/_lib\/image-workspace-history'/);
  assert.match(source, /from '\.\/_lib\/image-workspace-utils'/);

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

  assert.match(composerPersistenceHookSource, /export function useImageComposerPersistence/);
  assert.match(composerPersistenceHookSource, /parsePersistedImageComposerState/);
  assert.match(composerPersistenceHookSource, /IMAGE_COMPOSER_STORAGE_DEBOUNCE_MS/);
  assert.match(composerPersistenceHookSource, /localStorage\.getItem\(IMAGE_COMPOSER_STORAGE_KEY\)/);
  assert.match(composerPersistenceHookSource, /localStorage\.setItem\(IMAGE_COMPOSER_STORAGE_KEY, serialized\)/);

  const lineCount = source.split('\n').length;
  assert.ok(lineCount <= 1300, `ImageWorkspace should stay below 1300 lines after composer persistence extraction, got ${lineCount}`);
});
