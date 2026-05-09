import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('library page loads media in bounded pages instead of fetching hundreds upfront', () => {
  const clientSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/library/_components/LibraryPageClient.tsx'),
    'utf8'
  );
  const helpersSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/library/_lib/library-page-helpers.ts'),
    'utf8'
  );
  const dataHookSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/library/_hooks/useLibraryPageData.ts'),
    'utf8'
  );

  assert.match(helpersSource, /export const\s+LIBRARY_PAGE_SIZE\s*=\s*60/);
  assert.match(helpersSource, /export function buildSavedAssetsKey/);
  assert.match(helpersSource, /export function buildRecentOutputsKey/);
  assert.match(dataHookSource, /savedAssetLimit/);
  assert.match(dataHookSource, /recentOutputLimit/);
  assert.doesNotMatch(clientSource, /limit=200/);
});

test('library page avoids focus revalidation flashes for media lists', () => {
  const dataHookSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/library/_hooks/useLibraryPageData.ts'),
    'utf8'
  );
  const focusResyncSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/swr/SWRFocusResync.tsx'),
    'utf8'
  );

  assert.match(dataHookSource, /keepPreviousData:\s*true/);
  assert.match(dataHookSource, /revalidateOnFocus:\s*false/);
  assert.match(dataHookSource, /shouldRetryOnError:\s*false/);
  assert.match(focusResyncSource, /key\.startsWith\('\/api\/media-library\/'\)/);
  assert.match(focusResyncSource, /return false/);
});

test('library video cards use thumbnails or placeholders in the grid', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/library/AssetLibraryBrowser.tsx'),
    'utf8'
  );

  assert.doesNotMatch(source, /<video[\s\S]*src=\{asset\.url\}[\s\S]*preload="metadata"/);
  assert.match(source, /asset\.thumbUrl\s*\?/);
  assert.match(source, /<Film\s+className=/);
});
