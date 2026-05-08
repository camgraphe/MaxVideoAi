import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'frontend/app/(core)/(workspace)/app/library/page.tsx';
const clientPath = 'frontend/app/(core)/(workspace)/app/library/_components/LibraryPageClient.tsx';
const helpersPath = 'frontend/app/(core)/(workspace)/app/library/_lib/library-page-helpers.ts';

test('workspace library page stays a route wrapper', () => {
  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(clientPath), true);
  assert.equal(existsSync(helpersPath), true);

  const pageSource = readFileSync(pagePath, 'utf8');
  const pageLines = pageSource.split('\n').length;

  assert.ok(pageLines < 30, `expected library page wrapper to stay under 30 lines, got ${pageLines}`);
  assert.match(pageSource, /from '\.\/_components\/LibraryPageClient';/);
  assert.match(pageSource, /<LibraryPageClient \/>/);
  assert.doesNotMatch(pageSource, /useSWR\(/);
  assert.doesNotMatch(pageSource, /useState\(/);
  assert.doesNotMatch(pageSource, /AssetLibraryBrowser/);
});

test('workspace library client owns browser state and rendering', () => {
  const clientSource = readFileSync(clientPath, 'utf8');

  assert.match(clientSource, /'use client';/);
  assert.match(clientSource, /export function LibraryPageClient/);
  assert.match(clientSource, /useSWR<AssetsResponse>/);
  assert.match(clientSource, /<AssetLibraryBrowser/);
  assert.match(clientSource, /from '\.\.\/_lib\/library-page-helpers';/);
});

test('workspace library helpers own static copy, fetchers, and href helpers', () => {
  const helpersSource = readFileSync(helpersPath, 'utf8');

  assert.match(helpersSource, /export const DEFAULT_LIBRARY_COPY/);
  assert.match(helpersSource, /export const assetsFetcher/);
  assert.match(helpersSource, /export function getAssetJobHref/);
  assert.match(helpersSource, /export function inferKind/);
});
