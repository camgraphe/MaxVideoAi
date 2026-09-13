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
  assert.match(source, /title=\{target\?\.role \?[^\n]+: libraryTitle\}/, 'AssetLibraryBrowser should receive the asset-type-aware title');
});


test('selection is portal-scoped with a single visible heading and owner-controlled confirmation', () => {
  const modal = readFileSync(assetLibraryModalPath, 'utf8');
  const picker = readFileSync('frontend/components/library/ReferenceLibraryPicker.client.tsx', 'utf8');
  assert.match(modal, /return createPortal/);
  assert.match(modal, /headingId=\{titleId\}/);
  assert.doesNotMatch(modal, /<h2/);
  assert.match(picker, /await selection\.onConfirm/);
  assert.doesNotMatch(picker, /autoPlay|<video|<Image|asset\.id\}`/);
});
