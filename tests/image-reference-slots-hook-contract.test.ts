import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

const root = process.cwd();
const imageDir = path.join(root, 'frontend/app/(core)/(workspace)/app/image');
const workspacePath = path.join(imageDir, 'ImageWorkspace.tsx');
const hookPath = path.join(imageDir, '_hooks/useImageReferenceSlots.ts');
const slotStatePath = path.join(imageDir, '_lib/image-reference-slot-state.ts');

test('image reference slots are owned by a route-local hook', () => {
  statSync(hookPath);
  statSync(slotStatePath);

  const workspaceSource = readFileSync(workspacePath, 'utf8');
  const hookSource = readFileSync(hookPath, 'utf8');
  const slotStateSource = readFileSync(slotStatePath, 'utf8');

  assert.match(workspaceSource, /from '\.\/_hooks\/useImageReferenceSlots'/);
  assert.match(workspaceSource, /useImageReferenceSlots\(/);

  assert.doesNotMatch(workspaceSource, /const handleReferenceFile = useCallback/);
  assert.doesNotMatch(workspaceSource, /const handleReferenceUrl = useCallback/);
  assert.doesNotMatch(workspaceSource, /const handleLibrarySelect = useCallback/);
  assert.doesNotMatch(workspaceSource, /const toggleCharacterReference = useCallback/);
  assert.doesNotMatch(workspaceSource, /prepareImageFileForUpload/);

  assert.match(hookSource, /handleReferenceFile/);
  assert.match(hookSource, /handleReferenceUrl/);
  assert.match(hookSource, /handleLibrarySelect/);
  assert.match(hookSource, /toggleCharacterReference/);
  assert.match(hookSource, /prepareImageFileForUpload/);
  assert.match(hookSource, /from '\.\.\/_lib\/image-reference-slot-state'/);
  assert.match(slotStateSource, /export function buildPersistableReferenceSlots/);
  assert.match(slotStateSource, /export function getReferenceSizeSignature/);
  assert.match(slotStateSource, /export function getSelectedCharacterReferences/);

  const lineCount = hookSource.split('\n').length;
  assert.ok(lineCount <= 500, `useImageReferenceSlots should stay below 500 lines after selector extraction, got ${lineCount}`);
});
