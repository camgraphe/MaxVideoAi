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
  const assetLibraryHookPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetLibrary.ts'
  );
  const referenceAssetsHookPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceReferenceAssets.ts'
  );
  const klingAssetsHookPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceKlingElementAssets.ts'
  );
  assert.equal(fs.existsSync(hookPath), true);
  assert.equal(fs.existsSync(assetLibraryHookPath), true);
  assert.equal(fs.existsSync(referenceAssetsHookPath), true);
  assert.equal(fs.existsSync(klingAssetsHookPath), true);

  const hookSource = fs.readFileSync(hookPath, 'utf8');
  const assetLibraryHookSource = fs.readFileSync(assetLibraryHookPath, 'utf8');
  const referenceAssetsHookSource = fs.readFileSync(referenceAssetsHookPath, 'utf8');
  const klingAssetsHookSource = fs.readFileSync(klingAssetsHookPath, 'utf8');

  assert.match(appSource, /import \{ useWorkspaceAssets \} from '\.\/_hooks\/useWorkspaceAssets';/);
  assert.match(appSource, /useWorkspaceAssets\(\{/);
  assert.doesNotMatch(appSource, /const fetchAssetLibrary = useCallback/);
  assert.doesNotMatch(appSource, /const handleAssetAdd = useCallback/);
  assert.doesNotMatch(appSource, /const handleKlingElementAssetAdd = useCallback/);

  assert.match(hookSource, /export function useWorkspaceAssets/);
  assert.match(hookSource, /useWorkspaceAssetLibrary\(\{/);
  assert.match(hookSource, /useWorkspaceReferenceAssets\(\{/);
  assert.match(hookSource, /useWorkspaceKlingElementAssets\(\{/);
  assert.match(hookSource, /return \{/);

  assert.match(assetLibraryHookSource, /const fetchAssetLibrary = useCallback/);
  assert.match(referenceAssetsHookSource, /const handleAssetAdd = useCallback/);
  assert.match(klingAssetsHookSource, /const handleKlingElementAssetAdd = useCallback/);
});
