import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const facadePath = 'frontend/lib/ltx-localization.ts';
const assetCopyPath = 'frontend/lib/ltx-asset-dropzone-copy.ts';

test('LTX localization facade delegates large asset dropzone copy', () => {
  assert.equal(existsSync(facadePath), true);
  assert.equal(existsSync(assetCopyPath), true);

  const facadeSource = readFileSync(facadePath, 'utf8');
  const assetCopySource = readFileSync(assetCopyPath, 'utf8');

  assert.ok(facadeSource.split('\n').length < 420, 'ltx-localization.ts should stay under 420 lines');
  assert.match(facadeSource, /from '\.\/ltx-asset-dropzone-copy'/);
  assert.match(facadeSource, /export function getLocalizedAssetDropzoneCopy/);
  assert.doesNotMatch(facadeSource, /dropImageFile:\s*'Please drop an image file/);
  assert.doesNotMatch(facadeSource, /fileTooLarge:\s*\(size\)/);

  assert.match(assetCopySource, /export type AssetDropzoneCopy/);
  assert.match(assetCopySource, /export const ASSET_DROPZONE_COPY/);
  assert.match(assetCopySource, /dropImageFile:\s*'Please drop an image file/);
  assert.match(assetCopySource, /formatNotSupported:\s*\(value\)/);
});
