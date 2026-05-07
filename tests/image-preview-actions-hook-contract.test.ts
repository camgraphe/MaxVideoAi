import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

const root = process.cwd();
const imageDir = path.join(root, 'frontend/app/(core)/(workspace)/app/image');
const workspacePath = path.join(imageDir, 'ImageWorkspace.tsx');
const hookPath = path.join(imageDir, '_hooks/useImagePreviewActions.ts');

test('image preview library actions are owned by a route-local hook', () => {
  statSync(hookPath);

  const workspaceSource = readFileSync(workspacePath, 'utf8');
  const hookSource = readFileSync(hookPath, 'utf8');

  assert.match(workspaceSource, /from '\.\/_hooks\/useImagePreviewActions'/);
  assert.match(workspaceSource, /useImagePreviewActions\(/);

  assert.doesNotMatch(workspaceSource, /const handleCopy = useCallback/);
  assert.doesNotMatch(workspaceSource, /const handleDownload = useCallback/);
  assert.doesNotMatch(workspaceSource, /savedAssetKey/);
  assert.doesNotMatch(workspaceSource, /onAddToLibrary=\{\(url\) =>/);
  assert.doesNotMatch(workspaceSource, /onRemoveFromLibrary=\{\(\) =>/);

  assert.match(hookSource, /handleCopy/);
  assert.match(hookSource, /handleDownload/);
  assert.match(hookSource, /handleAddToLibrary/);
  assert.match(hookSource, /handleRemoveFromLibrary/);
  assert.match(hookSource, /saveImageToLibrary/);
});
