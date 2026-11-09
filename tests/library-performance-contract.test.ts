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

  assert.match(helpersSource, /export const\s+LIBRARY_PAGE_SIZE\s*=\s*30/);
  assert.match(helpersSource, /export function buildSavedAssetsKey/);
  assert.match(helpersSource, /export function buildRecentOutputsKey/);
  assert.match(dataHookSource, /useLibraryBrowse/);
  const browseSource=fs.readFileSync('frontend/hooks/useLibraryBrowse.ts','utf8');
  assert.match(browseSource,/useSWRInfinite/);
  assert.match(browseSource,/previous\?\.nextCursor/);
  assert.match(browseSource,/query\.setSize/);
  assert.doesNotMatch(clientSource, /limit=200/);
});

test('library page avoids focus revalidation flashes for media lists', () => {
  const dataHookSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/hooks/useLibraryBrowse.ts'),
    'utf8'
  );
  const focusResyncSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/swr/focus-resync-policy.ts'),
    'utf8'
  );

  assert.match(dataHookSource, /keepPreviousData:\s*false/, 'retired account/filter/mutation pages cannot remain visible');
  assert.match(dataHookSource, /useLibraryScopePersistence/);
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

test('library keeps contextual destinations in one scrollable mobile rail', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/library/AssetLibraryBrowser.tsx'),
    'utf8'
  );

  assert.match(source, /<nav aria-label=\{toolsTitle\}/);
  assert.match(source, /scrollbar-rail[^"\n]*flex-nowrap[^"\n]*overflow-x-auto[^"\n]*overscroll-x-contain/);
  assert.match(source, /lg:block[^"\n]*lg:overflow-visible/);
});

test('virtualized library scroller does not add padding outside the measured content width', () => {
  // IAB regression: a 1096px viewport acquired 1102px scrollWidth from 3px
  // horizontal scroller padding. Keep focus breathing room on the outer canvas;
  // Virtualizer owns the full inner width. Native geometry is verified in IAB.
  const css = fs.readFileSync('frontend/components/library/compact-library.css', 'utf8');
  const rule = (selector: string) => css.slice(css.indexOf(selector + ' {')).split('}')[0];
  assert.match(rule('.compact-media-canvas'), /padding:\s*3px/);
  assert.match(rule('.compact-media-grid'), /padding:\s*0(?:px)?\s*;/);
});

test('library pagination has authored English, French and Spanish labels', () => {
  for (const [locale, label] of [['en', 'Load more'], ['fr', 'Charger plus'], ['es', 'Cargar más']]) {
    const messages = JSON.parse(fs.readFileSync(`frontend/messages/${locale}.json`, 'utf8'));
    assert.equal(messages.workspace.library.browser.loadMore, label, locale);
  }
});
