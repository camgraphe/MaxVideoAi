import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'frontend/app/(core)/(workspace)/app/library/page.tsx';
const clientPath = 'frontend/app/(core)/(workspace)/app/library/_components/LibraryPageClient.tsx';
const helpersPath = 'frontend/app/(core)/(workspace)/app/library/_lib/library-page-helpers.ts';
const dataHookPath = 'frontend/app/(core)/(workspace)/app/library/_hooks/useLibraryPageData.ts';
const mutationHookPath = 'frontend/app/(core)/(workspace)/app/library/_hooks/useLibraryAssetMutations.ts';

test('workspace library page stays a route wrapper', () => {
  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(clientPath), true);
  assert.equal(existsSync(helpersPath), true);
  assert.equal(existsSync(dataHookPath), true);
  assert.equal(existsSync(mutationHookPath), true);

  const pageSource = readFileSync(pagePath, 'utf8');
  const pageLines = pageSource.split('\n').length;

  assert.ok(pageLines < 30, `expected library page wrapper to stay under 30 lines, got ${pageLines}`);
  assert.match(pageSource, /from '\.\/_components\/LibraryPageClient';/);
  assert.match(pageSource, /<LibraryPageClient \/>/);
  assert.doesNotMatch(pageSource, /useSWR\(/);
  assert.doesNotMatch(pageSource, /useState\(/);
  assert.doesNotMatch(pageSource, /AssetLibraryBrowser/);
});

test('workspace library client delegates data and mutation orchestration', () => {
  const clientSource = readFileSync(clientPath, 'utf8');
  const clientLines = clientSource.split('\n').length;

  assert.match(clientSource, /'use client';/);
  assert.match(clientSource, /export function LibraryPageClient/);
  assert.match(clientSource, /useLibraryPageData/);
  assert.match(clientSource, /useLibraryAssetMutations/);
  assert.match(clientSource, /<AssetLibraryBrowser/);
  assert.match(clientSource, /from '\.\.\/_lib\/library-page-helpers';/);
  assert.doesNotMatch(clientSource, /useSWR</);
  assert.doesNotMatch(clientSource, /authFetch/);
  assert.doesNotMatch(clientSource, /prepareImageFileForUpload/);
  assert.ok(clientLines < 500, `expected LibraryPageClient to stay under 500 lines, got ${clientLines}`);
});

test('workspace library data and mutation hooks own server data workflows', () => {
  const dataHookSource = readFileSync(dataHookPath, 'utf8');
  const mutationHookSource = readFileSync(mutationHookPath, 'utf8');

  assert.match(dataHookSource, /'use client';/);
  assert.match(dataHookSource, /export function useLibraryPageData/);
  assert.match(dataHookSource, /useSWR<AssetsResponse>/);
  assert.match(dataHookSource, /useSWR<RecentOutputsResponse>/);
  assert.match(dataHookSource, /dedupingInterval: 60_000/);
  assert.match(dataHookSource, /dedupingInterval: 30_000/);
  assert.match(dataHookSource, /buildSavedAssetsKey/);
  assert.match(dataHookSource, /buildRecentOutputsKey/);
  assert.match(dataHookSource, /currentAssets: activeView === 'saved'/);

  assert.match(mutationHookSource, /'use client';/);
  assert.match(mutationHookSource, /export function useLibraryAssetMutations/);
  assert.match(mutationHookSource, /handleImportChange/);
  assert.match(mutationHookSource, /handleDeleteAsset/);
  assert.match(mutationHookSource, /handleSaveRecentOutput/);
  assert.match(mutationHookSource, /prepareImageFileForUpload/);
  assert.match(mutationHookSource, /\/api\/media-library\/save-output/);
  assert.match(mutationHookSource, /\/api\/media-library\/assets\/\$\{encodeURIComponent\(assetId\)\}/);
});

test('workspace library helpers own static copy, fetchers, keys, and href helpers', () => {
  const helpersSource = readFileSync(helpersPath, 'utf8');

  assert.match(helpersSource, /export const DEFAULT_LIBRARY_COPY/);
  assert.match(helpersSource, /export const assetsFetcher/);
  assert.match(helpersSource, /export function buildSavedAssetsKey/);
  assert.match(helpersSource, /export function buildRecentOutputsKey/);
  assert.match(helpersSource, /export function getAssetJobHref/);
  assert.match(helpersSource, /export function inferKind/);
});
