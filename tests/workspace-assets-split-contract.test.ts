import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const assetsHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssets.ts';
const assetLibraryHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetLibrary.ts';
const referenceAssetsHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceReferenceAssets.ts';
const klingAssetsHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceKlingElementAssets.ts';

test('workspace asset library, field assets, and Kling element assets are split from the assets orchestrator', () => {
  assert.equal(existsSync(assetLibraryHookPath), true);
  assert.equal(existsSync(referenceAssetsHookPath), true);
  assert.equal(existsSync(klingAssetsHookPath), true);

  const assetsHookSource = readFileSync(assetsHookPath, 'utf8');
  const assetLibrarySource = readFileSync(assetLibraryHookPath, 'utf8');
  const referenceAssetsSource = readFileSync(referenceAssetsHookPath, 'utf8');
  const klingAssetsSource = readFileSync(klingAssetsHookPath, 'utf8');

  assert.match(assetsHookSource, /useWorkspaceAssetLibrary\(\{/);
  assert.match(assetsHookSource, /useWorkspaceReferenceAssets\(\{/);
  assert.match(assetsHookSource, /useWorkspaceKlingElementAssets\(\{/);

  assert.doesNotMatch(assetsHookSource, /const fetchAssetLibrary = useCallback/);
  assert.doesNotMatch(assetsHookSource, /const handleSelectLibraryAsset = useCallback/);
  assert.doesNotMatch(assetsHookSource, /const handleAssetAdd = useCallback/);
  assert.doesNotMatch(assetsHookSource, /const handleKlingElementAssetAdd = useCallback/);
  assert.doesNotMatch(assetsHookSource, /prepareImageFileForUpload/);
  assert.doesNotMatch(assetsHookSource, /authFetch/);

  assert.match(assetLibrarySource, /export function useWorkspaceAssetLibrary/);
  assert.match(assetLibrarySource, /const fetchAssetLibrary = useCallback/);
  assert.match(assetLibrarySource, /const handleDeleteLibraryAsset = useCallback/);
  assert.match(assetLibrarySource, /buildAssetLibraryUrl/);

  assert.match(referenceAssetsSource, /export function useWorkspaceReferenceAssets/);
  assert.match(referenceAssetsSource, /const handleSelectLibraryAsset = useCallback/);
  assert.match(referenceAssetsSource, /const handleAssetAdd = useCallback/);
  assert.match(referenceAssetsSource, /prepareImageFileForUpload/);
  assert.match(referenceAssetsSource, /insertReferenceAsset/);

  assert.match(klingAssetsSource, /export function useWorkspaceKlingElementAssets/);
  assert.match(klingAssetsSource, /const handleKlingElementAssetAdd = useCallback/);
  assert.match(klingAssetsSource, /const handleKlingElementAssetRemove = useCallback/);
  assert.match(klingAssetsSource, /insertKlingLibraryAsset/);
});
