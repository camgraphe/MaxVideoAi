import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('workspace asset workflow is owned by a route-local hook', () => {
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/AppClient.tsx'),
    'utf8'
  );
  const hookPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssets.ts'
  );
  assert.equal(fs.existsSync(hookPath), true);

  const hookSource = fs.readFileSync(hookPath, 'utf8');

  assert.match(appSource, /import \{ useWorkspaceAssets \} from '\.\/_hooks\/useWorkspaceAssets';/);
  assert.match(appSource, /useWorkspaceAssets\(\{/);
  assert.doesNotMatch(appSource, /const fetchAssetLibrary = useCallback/);
  assert.doesNotMatch(appSource, /const handleAssetAdd = useCallback/);
  assert.doesNotMatch(appSource, /const handleKlingElementAssetAdd = useCallback/);

  assert.match(hookSource, /export function useWorkspaceAssets/);
  assert.match(hookSource, /const fetchAssetLibrary = useCallback/);
  assert.match(hookSource, /const handleAssetAdd = useCallback/);
  assert.match(hookSource, /const handleKlingElementAssetAdd = useCallback/);
  assert.match(hookSource, /return \{/);
});
