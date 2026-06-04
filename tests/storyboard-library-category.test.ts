import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const helpersPath = join(root, 'frontend/app/(core)/(workspace)/app/library/_lib/library-page-helpers.ts');
const clientPath = join(root, 'frontend/app/(core)/(workspace)/app/library/_components/LibraryPageClient.tsx');
const dataHookPath = join(root, 'frontend/app/(core)/(workspace)/app/library/_hooks/useLibraryPageData.ts');
const assetBrowserPath = join(root, 'frontend/components/library/AssetLibraryBrowser.tsx');
const imageLibraryModalPath = join(root, 'frontend/app/(core)/(workspace)/app/image/_components/ImageLibraryModal.tsx');
const sharedAssetModalPath = join(root, 'frontend/components/library/AssetLibraryModal.tsx');
const billingTypesPath = join(root, 'frontend/types/billing.ts');
const jobSurfaceNormalizePath = join(root, 'frontend/src/lib/job-surface-normalize.ts');

test('workspace library exposes storyboard as a saved image source', async () => {
  const module = await import('../frontend/app/(core)/(workspace)/app/library/_lib/library-page-helpers.ts');
  const copy = module.DEFAULT_LIBRARY_COPY as {
    tabs: Record<string, string>;
    assets: Record<string, string>;
  };

  assert.equal(copy.tabs.storyboard, 'Storyboard assets');
  assert.match(copy.assets.emptyStoryboard, /storyboard/i);
  assert.equal(
    module.buildSavedAssetsKey({
      userId: 'user_1',
      activeKind: 'image',
      activeSource: 'storyboard',
      limit: 60,
    }),
    '/api/media-library/assets?limit=60&kind=image&source=storyboard'
  );
});

test('library and image asset pickers include storyboard source when tools are enabled', () => {
  const helpersSource = readFileSync(helpersPath, 'utf8');
  const clientSource = readFileSync(clientPath, 'utf8');
  const dataHookSource = readFileSync(dataHookPath, 'utf8');
  const assetBrowserSource = readFileSync(assetBrowserPath, 'utf8');
  const imageLibraryModalSource = readFileSync(imageLibraryModalPath, 'utf8');
  const sharedAssetModalSource = readFileSync(sharedAssetModalPath, 'utf8');
  const billingTypesSource = readFileSync(billingTypesPath, 'utf8');
  const jobSurfaceNormalizeSource = readFileSync(jobSurfaceNormalizePath, 'utf8');

  assert.match(helpersSource, /export type SavedAssetSource =[\s\S]+?'storyboard'/);
  assert.match(helpersSource, /emptyStoryboard/);
  assert.match(helpersSource, /source === 'storyboard'/);
  assert.match(helpersSource, /tool=storyboard/);

  assert.match(clientSource, /\['all', 'upload', 'generated', 'storyboard', 'character', 'angle', 'upscale'\]/);
  assert.match(clientSource, /emptyStoryboard/);
  assert.match(clientSource, /\/app\/tools\/storyboard/);

  assert.match(dataHookSource, /asset\.source !== 'storyboard'/);
  assert.match(assetBrowserSource, /'storyboard'/);
  assert.match(imageLibraryModalSource, /'storyboard'/);
  assert.match(sharedAssetModalSource, /'storyboard'/);
  assert.match(billingTypesSource, /JOB_SURFACE_VALUES = \[[\s\S]+?'storyboard'/);
  assert.match(billingTypesSource, /USER_ASSET_SOURCE_VALUES = \[[\s\S]+?'storyboard'/);
  assert.match(jobSurfaceNormalizeSource, /normalized === 'storyboard'/);
});
