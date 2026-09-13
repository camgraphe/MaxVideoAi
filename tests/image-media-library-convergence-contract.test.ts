import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { buildSavedAssetsKey } from '../frontend/app/(core)/(workspace)/app/library/_lib/library-page-helpers';
import { buildMediaLibraryAssetsKey } from '../frontend/lib/media-library-client';

const root = process.cwd();
const imageDir = path.join(root, 'frontend/app/(core)/(workspace)/app/image');

test('Generate Image and Media share the canonical first-page cache contract', () => {
  const sharedKey = buildMediaLibraryAssetsKey({
    userId: 'user-1',
    kind: 'image',
    source: 'all',
    limit: 30,
  });
  const mediaPageKey = buildSavedAssetsKey({
    userId: 'user-1',
    activeKind: 'image',
    activeSource: 'all',
  });

  assert.deepEqual(sharedKey, [
    '/api/media-library/assets?limit=30&kind=image',
    'user-1',
  ]);
  assert.deepEqual(mediaPageKey, sharedKey);
});

test('Generate Image paginates canonical image assets while keeping Characters specialized', () => {
  const dataHook = readFileSync(path.join(imageDir, '_hooks/useImageLibraryData.ts'), 'utf8');
  const modal = readFileSync(path.join(imageDir, '_components/ImageLibraryModal.tsx'), 'utf8');
  const picker = readFileSync(
    path.join(root, 'frontend/components/library/ReferenceLibraryPicker.client.tsx'),
    'utf8'
  );

  assert.match(dataHook, /IMAGE_LIBRARY_PAGE_SIZE = 30/);
  assert.match(dataHook, /useSWRInfinite<MediaLibraryAssetsResponse>/);
  assert.match(dataHook, /previousPageData\.nextCursor/);
  assert.match(dataHook, /fetchMediaLibraryAssets/);
  assert.match(dataHook, /\/api\/character-references\?limit=60/);
  assert.doesNotMatch(dataHook, /\/api\/user-assets/);
  assert.match(modal, /hasMore=\{!isCharacterMode && hasMore\}/);
  assert.match(modal, /onLoadMore=\{loadMore\}/);
  assert.match(picker, /const loadMoreControl = hasMore && !query\.trim\(\) && onLoadMore/);
  assert.match(picker, /app-picker-empty[\s\S]*\{loadMoreControl\}/);
});

test('preview save state and deletion use canonical account-scoped media routes', () => {
  const actions = readFileSync(path.join(imageDir, '_hooks/useImagePreviewActions.ts'), 'utf8');
  const route = readFileSync(path.join(root, 'frontend/app/api/media-library/assets/route.ts'), 'utf8');
  const listing = readFileSync(path.join(root, 'frontend/server/media-library/asset-listing.ts'), 'utf8');

  assert.match(actions, /buildMediaLibraryAssetsKey/);
  assert.match(actions, /userId: canUseWorkspace \? user\?\.id : null/);
  assert.match(actions, /originUrl: selectedPreviewUrl/);
  assert.match(actions, /\/api\/media-library\/assets\/\$\{encodeURIComponent\(savedAsset\.id\)\}/);
  assert.doesNotMatch(actions, /\/api\/user-assets/);

  assert.match(route, /const originUrl = req\.nextUrl\.searchParams\.get\('originUrl'\)/);
  assert.match(route, /findLibraryAssetByOrigin\(\{/);
  assert.match(listing, /FROM user_assets u[\s\S]*u\.user_id = \$1/);
  assert.match(listing, /u\.url = \$4 OR u\.metadata->>'originUrl' = \$4/);
});
