import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

// Regression boundary: API names must survive the Video hook's normalization before reaching the real picker.
const source = `
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {AssetLibraryModal} from './components/library/AssetLibraryModal';
import {useWorkspaceAssetLibrary} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetLibrary';
import {buildReferenceAssetFromLibraryAsset,buildComposerAttachments} from './app/(core)/(workspace)/app/_lib/workspace-assets';
import {selectedReferenceLabel} from './components/composer/workspace-reference-mentions';
import {listFalEngines} from './src/config/falEngines';
const engine=listFalEngines().find(entry=>entry.id==='seedance-2-5').engine;
const field=[...engine.inputSchema.required,...engine.inputSchema.optional].find(field=>field.type==='image'&&(field.maxCount??0)>1);
function Fixture(){
 const [inputs,setInputs]=useState({});
 const library=useWorkspaceAssetLibrary({userId:'synthetic-owner',showNotice:message=>{throw Error(message);},setInputAssets:setInputs});
 return <I18nProvider locale="en" dictionary={{}} fallback={{}}>
  <button onClick={()=>library.setAssetPickerTarget({kind:'field',field})}>Open Video references</button>
  {library.assetPickerTarget?<AssetLibraryModal fieldLabel={field.label} assetType={library.assetLibraryKind}
   assets={library.visibleAssetLibrary} isLoading={library.isAssetLibraryLoading} error={library.assetLibraryError}
   hasMore={library.assetLibraryHasMore} isLoadingMore={library.isAssetLibraryLoadingMore} onLoadMore={library.loadMoreAssetLibrary}
   source={library.assetLibrarySource} onSourceChange={library.handleAssetLibrarySourceChange}
   onRefresh={source=>library.fetchAssetLibrary({source})} onClose={library.closeAssetLibrary} onDelete={()=>{}} deletingAssetId={null}
   onSelect={asset=>{const selected=buildReferenceAssetFromLibraryAsset(field,asset);globalThis.selected=selected;
    globalThis.attachment=buildComposerAttachments({[field.id]:[selected]})[field.id][0];
    globalThis.functionalLabel=selectedReferenceLabel(engine,field,'image',1,'en');library.closeAssetLibrary();}}/>:null}
 </I18nProvider>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`;

const poster = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"/>');
const staticAsset = {
  id: 'card-static', assetId: 'ma_' + 'a'.repeat(32), ref: { type: 'asset', assetId: 'ma_' + 'a'.repeat(32), kind: 'image' },
  name: 'watch-static.png', kind: 'image', source: 'upload', mime: 'image/png',
  url: '/original-static-hash.png', thumbUrl: poster, width: 640, height: 480, size: 2048,
};
const motionAsset = { ...staticAsset, id: 'card-motion', assetId: 'ma_' + 'b'.repeat(32),
  ref: { type: 'asset', assetId: 'ma_' + 'b'.repeat(32), kind: 'image' }, name: 'watch-motion-poster.png', url: '/original-motion-hash.png' };

test('Video Media API filenames survive hook refresh and pagination into picker search and confirmation', { timeout: 60000 }, async () => {
  const fixture = await startWorkspaceReferenceFixture({ source, config: {} });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const requests: string[] = [], errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/media-library/assets?**', route => {
      const url = new URL(route.request().url());
      requests.push(url.pathname + url.search);
      return route.fulfill({ json: url.searchParams.has('cursor')
        ? { ok: true, assets: [motionAsset], hasMore: false, nextCursor: null }
        : { ok: true, assets: [staticAsset, { ...staticAsset, id: 'unnamed', name: ' ', url: '/legacy-original.png' }], hasMore: true, nextCursor: 'page-2' } });
    });
    await page.goto(fixture.url);
    await page.getByRole('button', { name: 'Open Video references' }).click();
    const cards = page.locator('.app-picker-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('watch-static.png');
    await expect(cards.nth(1)).toContainText('Images 2');
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect.poll(() => requests.length).toBe(2);
    await expect(cards.first()).toContainText('watch-static.png');
    await page.getByRole('searchbox').fill('watch-static.png');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toHaveAccessibleName('Choose · watch-static.png · 640 × 480');
    await page.getByRole('searchbox').fill('');
    await page.getByRole('button', { name: 'Load more', exact: true }).click();
    await expect(cards).toHaveCount(3);
    await page.getByRole('searchbox').fill('watch-motion-poster.png');
    await expect(cards).toHaveCount(1);
    await cards.first().click();
    await expect(page.locator('.app-picker-selection')).toContainText('watch-motion-poster.png');
    if (process.env.VIDEO_FILENAMES_EVIDENCE) await page.screenshot({ path: process.env.VIDEO_FILENAMES_EVIDENCE });
    await page.locator('.app-picker-use').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const selected = await page.evaluate(() => ({ selected: (globalThis as any).selected, attachment: (globalThis as any).attachment, label: (globalThis as any).functionalLabel }));
    assert.equal(selected.selected.name, 'watch-motion-poster.png');
    assert.equal(selected.attachment.name, 'watch-motion-poster.png');
    assert.equal(selected.selected.id, motionAsset.id);
    assert.equal(selected.selected.url, motionAsset.url);
    assert.deepEqual(selected.selected.ref, motionAsset.ref);
    assert.equal(selected.label, 'Image 1');
    assert.deepEqual(requests, [
      '/api/media-library/assets?limit=30&kind=image',
      '/api/media-library/assets?limit=30&kind=image',
      '/api/media-library/assets?limit=30&kind=image&cursor=page-2',
    ]);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await fixture.close();
  }
});
