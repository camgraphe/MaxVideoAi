import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

const root = process.cwd();
const imageDir = path.join(root, 'frontend/app/(core)/(workspace)/app/image');
const workspacePath = path.join(imageDir, 'ImageWorkspace.tsx');

const splitFiles = [
  '_components/ImageLibraryModal.tsx',
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

  for (const file of splitFiles) {
    statSync(path.join(imageDir, file));
  }

  assert.match(source, /from '\.\/_components\/ImageLibraryModal'/);
  assert.match(source, /from '\.\/_hooks\/useImageWorkspaceDesktopLayout'/);
  assert.match(source, /from '\.\/_lib\/image-workspace-copy'/);
  assert.match(source, /from '\.\/_lib\/image-workspace-history'/);
  assert.match(source, /from '\.\/_lib\/image-workspace-persistence'/);
  assert.match(source, /from '\.\/_lib\/image-workspace-utils'/);

  assert.doesNotMatch(source, /const DEFAULT_COPY: ImageWorkspaceCopy =/);
  assert.doesNotMatch(source, /function ImageLibraryModal\(/);
  assert.doesNotMatch(source, /function parsePersistedImageComposerState\(/);
  assert.doesNotMatch(source, /function mapJobToHistoryEntry\(/);
  assert.doesNotMatch(source, /function buildPendingGroup\(/);
  assert.doesNotMatch(source, /function buildCompletedGroup\(/);
});
