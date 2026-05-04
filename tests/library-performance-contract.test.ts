import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('library page loads media in bounded pages instead of fetching hundreds upfront', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/library/page.tsx'),
    'utf8'
  );

  assert.match(source, /const\s+LIBRARY_PAGE_SIZE\s*=\s*60/);
  assert.match(source, /limit=\$\{savedAssetLimit\}/);
  assert.match(source, /limit=\$\{recentOutputLimit\}/);
  assert.doesNotMatch(source, /limit=200/);
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
