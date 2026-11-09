import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { startWorkspaceReferenceFixture, referencePickerAuthModules } from './helpers/workspace-reference-browser-fixture';

type FilenamesFixtureGlobal = typeof globalThis & {selected?:{name?:string;id:string;url:string;ref:unknown};attachment?:{name?:string};functionalLabel?:string};

// Regression boundary: common browse names must reach the real Video receiver and composer attachment.
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
 const library=useWorkspaceAssetLibrary({userId:'synthetic-owner',listingEnabled:false,showNotice:message=>{throw Error(message);},setInputAssets:setInputs});
 return <I18nProvider locale="en" dictionary={{}} fallback={{}}>
  <button onClick={()=>library.setAssetPickerTarget({kind:'field',field})}>Open Video references</button>
  {library.assetPickerTarget?<AssetLibraryModal ownerId="synthetic-owner" fieldLabel={field.label} assetType={library.assetLibraryKind}
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
  url: 'https://media.fixture.test/original-static-hash.png', thumbUrl: poster, width: 640, height: 480, size: 2048,
};
const motionAsset = { ...staticAsset, id: 'card-motion', assetId: 'ma_' + 'b'.repeat(32),
  ref: { type: 'asset', assetId: 'ma_' + 'b'.repeat(32), kind: 'image' }, name: 'watch-motion-poster.png', url: 'https://media.fixture.test/original-motion-hash.png' };

test('Video common Media filenames survive refresh, server search and pagination into exact attachments', { timeout: 60000 }, async () => {
  const token='filenames-fixture-token';
  const fixture = await startWorkspaceReferenceFixture({ source, config: {}, hostModules: referencePickerAuthModules('synthetic-owner',token) });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const requests: string[] = [], legacyRequests: string[] = [], errors: string[] = [], proofs: unknown[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\/api\/media-library\/(assets|recent-outputs)\?/.test(request.url())) legacyRequests.push(request.url()); });
    const browseAsset = (asset: typeof staticAsset) => ({ ...asset, libraryRef: asset.ref, sourceRevision: 'sr_' + asset.id,
      organization: { key: 'lo_' + asset.id, favorite: false, collectionIds: [], trashedAt: null } });
    const unnamed = { ...staticAsset, id: 'unnamed', assetId:'ma_'+'c'.repeat(32), ref:{type:'asset',assetId:'ma_'+'c'.repeat(32),kind:'image'}, name: ' ', url: 'https://media.fixture.test/legacy-original.png' };
    await page.route('**/api/media-library/browse?**', route => {
      const url = new URL(route.request().url());
      requests.push(url.pathname + url.search);
      assert.equal(url.searchParams.get('view'), 'all');
      assert.equal(url.searchParams.get('kind'), 'image');
      const q = url.searchParams.get('q');
      return route.fulfill({ json: q
        ? { ok: true, assets: [browseAsset(q === 'watch-static.png' ? staticAsset : motionAsset)], totalCount: 1, hasMore: false, nextCursor: null }
        : url.searchParams.has('cursor')
          ? { ok: true, assets: [browseAsset(motionAsset)], totalCount: 3, hasMore: false, nextCursor: null }
          : { ok: true, assets: [browseAsset(staticAsset), browseAsset(unnamed)], totalCount: 3, hasMore: true, nextCursor: 'page-2' } });
    });
    // Only the HTTP validation boundary is controlled in this UI fixture; the real client
    // must send its initiating bearer, typed ref and exact original before confirmation.
    await page.route('**/api/media-library/selection/validate', route => {
      assert.equal(route.request().method(),'POST');
      assert.equal(route.request().headers().authorization,'Bearer '+token);
      assert.equal(route.request().headers()['x-maxvideoai-auth-mode'],'bearer');
      const body=route.request().postDataJSON();
      assert.deepEqual(body,{candidates:[{reference:{...motionAsset.ref,sourceRevision:'sr_card-motion'},originalUrl:motionAsset.url}]});proofs.push(body);
      return route.fulfill({json:{ok:true,results:[{reference:motionAsset.ref}]}});
    });
    await page.goto(fixture.url);
    await page.getByRole('button', { name: 'Open Video references' }).click();
    const cards = page.getByRole('row');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('watch-static.png');
    await expect(cards.nth(1)).toContainText('Images 2');
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect.poll(() => requests.length).toBe(2);
    await expect(cards.first()).toContainText('watch-static.png');
    await page.getByRole('searchbox').fill('watch-static.png');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toHaveAccessibleName('watch-static.png');
    await expect(cards.first().getByRole('button',{name:'Preview watch-static.png',exact:true})).toBeVisible();
    const staticChoice=page.getByRole('row',{name:'watch-static.png',exact:true}).getByRole('checkbox');
    await expect(staticChoice).toHaveCount(1);await expect(staticChoice).toBeVisible();
    await expect(staticChoice).toHaveAttribute('aria-label','Select watch-static.png');
    await expect(staticChoice).toHaveAccessibleName('Select watch-static.png watch-static.png');
    await page.getByRole('searchbox').fill('');
    await page.getByRole('button', { name: 'Load more', exact: true }).click();
    await expect(cards).toHaveCount(3);
    await page.getByRole('searchbox').fill('watch-motion-poster.png');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toHaveAccessibleName('watch-motion-poster.png');
    const motionRow=page.getByRole('row',{name:'watch-motion-poster.png',exact:true});
    await expect(motionRow.getByRole('button',{name:'Preview watch-motion-poster.png',exact:true})).toBeVisible();
    const motionChoice=motionRow.getByRole('checkbox');await expect(motionChoice).toHaveCount(1);
    await expect(motionChoice).toHaveAttribute('aria-label','Select watch-motion-poster.png');
    await expect(motionChoice).toHaveAccessibleName('Select watch-motion-poster.png watch-motion-poster.png');
    await expect(motionChoice).not.toBeChecked();await motionRow.locator('label.compact-media-check').click();await expect(motionChoice).toBeChecked();
    await expect(page.locator('.app-picker-selection')).toContainText('watch-motion-poster.png');
    assert.equal(await page.evaluate(()=>(globalThis as FilenamesFixtureGlobal).selected),undefined,'Reference stays staged until confirmation');
    if (process.env.VIDEO_FILENAMES_EVIDENCE) await page.screenshot({ path: process.env.VIDEO_FILENAMES_EVIDENCE });
    await page.getByRole('button',{name:'Use selection',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const selected = await page.evaluate(() => ({ selected: (globalThis as FilenamesFixtureGlobal).selected, attachment: (globalThis as FilenamesFixtureGlobal).attachment, label: (globalThis as FilenamesFixtureGlobal).functionalLabel }));
    assert.ok(selected.selected && selected.attachment);
    assert.equal(selected.selected.name, 'watch-motion-poster.png');
    assert.equal(selected.attachment.name, 'watch-motion-poster.png');
    assert.equal(selected.selected.id, motionAsset.id);
    assert.equal(selected.selected.url, motionAsset.url);
    assert.deepEqual(selected.selected.ref, motionAsset.ref);
    assert.equal(selected.label, 'Image 1');
    assert.equal(proofs.length,1,'Confirmation passes typed validation once');
    const queries = requests.map(path => new URL(path, 'http://fixture.test').searchParams);
    assert.ok(queries.some(query => query.get('q') === 'watch-static.png'));
    assert.ok(queries.some(query => query.get('q') === 'watch-motion-poster.png'));
    assert.equal(queries.filter(query => query.get('cursor') === 'page-2').length, 1);
    assert.deepEqual(legacyRequests, [], 'the common browser must not duplicate the retired saved-only listing');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await fixture.close();
  }
});
