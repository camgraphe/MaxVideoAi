import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const assetLibraryModalPath = 'frontend/components/library/AssetLibraryModal.tsx';

test('asset library modal title follows the requested asset type', () => {
  const source = readFileSync(assetLibraryModalPath, 'utf8');

  assert.match(
    source,
    /const libraryTitle =\s+assetType === 'video'\s+\? \(uiLocale === 'fr'[\s\S]+?\)\s+: copyAssetLibrary\.title;/,
    'video pickers should not reuse the reference-image title'
  );
  assert.match(source, /title=\{libraryTitle\}/, 'AssetLibraryBrowser should receive the asset-type-aware title');
});
