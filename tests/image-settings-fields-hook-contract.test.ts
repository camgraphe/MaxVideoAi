import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

const root = process.cwd();
const imageDir = path.join(root, 'frontend/app/(core)/(workspace)/app/image');
const workspacePath = path.join(imageDir, 'ImageWorkspace.tsx');
const hookPath = path.join(imageDir, '_hooks/useImageSettingsFields.ts');

test('image settings field derivation is owned by a route-local hook', () => {
  statSync(hookPath);

  const workspaceSource = readFileSync(workspacePath, 'utf8');
  const hookSource = readFileSync(hookPath, 'utf8');

  assert.match(workspaceSource, /from '\.\/_hooks\/useImageSettingsFields'/);
  assert.match(workspaceSource, /useImageSettingsFields\(/);

  assert.doesNotMatch(workspaceSource, /const imageCountField = useMemo/);
  assert.doesNotMatch(workspaceSource, /const aspectRatioField = useMemo/);
  assert.doesNotMatch(workspaceSource, /const outputFormatField = useMemo/);
  assert.doesNotMatch(workspaceSource, /const imageCountOptions = useMemo/);
  assert.doesNotMatch(workspaceSource, /const aspectRatioSelectOptions = useMemo/);
  assert.doesNotMatch(workspaceSource, /const booleanSelectOptions = useMemo/);

  assert.match(hookSource, /getImageInputField/);
  assert.match(hookSource, /getImageFieldValues/);
  assert.match(hookSource, /formatAspectRatioLabel/);
  assert.match(hookSource, /formatSupportedImageFormatsLabel/);
});
