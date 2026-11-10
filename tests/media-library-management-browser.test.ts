import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { startWorkspaceReferenceFixture, referencePickerAuthModules } from './helpers/workspace-reference-browser-fixture';

const source = `import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {CompactLibraryBrowser} from './components/library/CompactLibraryBrowser.client';
import {LibraryMediaNavigation} from './components/library/LibraryMediaNavigation.client';
import {LibraryStorageUsage} from './components/library/LibraryStorageUsage.client';
import {invalidateLibraryMedia} from './hooks/useLibraryCacheRevision';
window.refreshStorage=()=>invalidateLibraryMedia('gallery-owner');
function Scene(){const[scope,setScope]=useState({view:'all',kind:'all',source:'all',sort:'recent'});
const[failed,setFailed]=useState(false); window.failBrowse=()=>setFailed(true);
return <main style={{height:'100dvh',display:'flex',padding:12}}><CompactLibraryBrowser locale="en" title="Media" hideTitle assets={globalThis.fixtureConfig.assets} assetType="all" isLoading={false}
management={{userId:'gallery-owner',scope,onScopeChange:patch=>setScope(prev=>({...prev,...patch})),totalCount:200}}
source={scope.source} availableSources={['all','upload','generated','upscale']} sourceLabels={{all:'All',upload:'Uploads',generated:'Generated',upscale:'Upscale'}} onSourceChange={source=>setScope(prev=>({...prev,source}))}
error={failed?'Paging unavailable':null} onRetry={()=>{setFailed(false);window.retryCount=(window.retryCount??0)+1}}
searchPlaceholder="Search media" sourcesTitle="Source" emptyLabel="Empty" emptySearchLabel="No match" renderAssetActions={()=>null}
headerLeadingActions={<LibraryMediaNavigation locale="en" value={scope.kind} charactersEnabled onChange={kind=>setScope(prev=>({...prev,kind}))}/>}
headerActions={<button className="compact-library-import" aria-label="Import"><span className="compact-library-import-label">Import</span></button>}
footerContent={<LibraryStorageUsage userId="gallery-owner" locale="en"/>} hasMore loadMoreLabel="Load more" onLoadMore={()=>{window.loadMoreCount=(window.loadMoreCount??0)+1}}
renderContinuation={asset=><button data-destination={asset.id}>Use selected media</button>}/></main>};createRoot(document.getElementById('root')).render(<Scene/>);`;
const assets = Array.from({ length: 200 }, (_, index) => ({
  id: `asset-${index}`, name: `Image ${index}`, kind: 'image', source: 'upload',
  width: index % 2 ? 1600 : 600, height: index % 2 ? 900 : 1000,
  url: `https://media.fixture.test/original-${index}.png`, thumbUrl: `/poster-${index}.svg`,
  libraryRef: { type: 'asset', assetId: `ma_${String(index).padStart(32, '0')}`, kind: 'image' },
  sourceRevision: `revision-${index}`, organization: { key: `canonical-${index}`, favorite: false, trashedAt: null, collectionIds: [] },
}));

test('real media browser keeps compact commands, visible selection and contained posters in every display mode', { timeout: 90000 }, async () => {
  const fixture = await startWorkspaceReferenceFixture({ source, config: { assets }, hostModules: referencePickerAuthModules('gallery-owner', 'fixture-only') });
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors: string[] = [], originals: string[] = [], mutations: any[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.url().includes('/original-')) originals.push(request.url()); });
      const collections = [{id:'lc-project',name:'Project launch'}];
      await page.route('**/api/media-library/collections**', route => {
        if(route.request().method()==='POST') {
          const collection={id:'lc-new',name:route.request().postDataJSON().name}; collections.push(collection);
          return route.fulfill({json:{ok:true,collection}});
        }
        return route.fulfill({ json: { ok: true, items: collections, hasMore: false, nextCursor: null } });
      });
      await page.route('**/api/media-library/organization', route => {
        const body = route.request().postDataJSON(); mutations.push(body);
        return route.fulfill({json:{ok:true,results:body.references.map((reference:unknown)=>({reference,status:'succeeded'})),succeededCount:body.references.length,failedCount:0,affectedCount:body.references.length}});
      });
      const usage={recordedBytes:2_000_000_000,measuredFiles:8,totalFiles:10,limitBytes:null,enforcement:false,pendingDeletionFiles:0,sharedDeletionFiles:0};
      await page.route('**/api/media-library/storage', route => route.fulfill({json:{ok:true,usage}}));
      await page.goto(fixture.url);
      if (width === 390) {
        const types = page.getByRole('combobox', { name: 'Media type', exact: true });
        await expect(types).toBeVisible();
        await expect(types.locator('option')).toHaveCount(5);
        await types.selectOption('image');
        await expect(types).toHaveValue('image');
        await types.selectOption('all');
        const navigation = page.locator('.library-media-navigation');
        assert.ok(await navigation.evaluate(node => node.scrollWidth <= node.clientWidth), 'mobile type navigation does not scroll sideways');
        assert.equal(await page.locator('.compact-media-grid').evaluate(node => getComputedStyle(node).scrollbarWidth), 'none');
        const heading = await page.locator('.compact-library-heading').boundingBox();
        const toolbar = await page.locator('.compact-library-toolbar').boundingBox();
        const footer = await page.locator('.compact-library-footer').boundingBox();
        assert.ok(heading && heading.height <= 46 && toolbar && toolbar.height <= 44, 'mobile browse commands use two compact rows');
        assert.ok(footer && footer.height <= 44, 'storage and pagination share one touch-sized row');
        const scroll = page.locator('.compact-media-grid');
        assert.equal(await page.evaluate(()=>window.loadMoreCount??0),0,'browsing does not download the entire library upfront');
        await scroll.evaluate(node=>node.scrollTop=node.scrollHeight);
        await expect.poll(()=>page.evaluate(()=>window.loadMoreCount)).toBe(1);
        await scroll.evaluate(node=>node.dispatchEvent(new Event('scroll')));
        assert.equal(await page.evaluate(()=>window.loadMoreCount),1,'repeated end events do not queue duplicate pages');
        await scroll.evaluate(node=>node.scrollTop=0);
        await page.getByRole('button',{name:'Storage · 2 GB',exact:true}).click();
        await expect(page.getByRole('dialog',{name:'Storage · 2 GB',exact:true})).toContainText('No storage quota');
        await page.keyboard.press('Escape');
      }
      const canvas = page.locator('.compact-media-canvas');
      await expect(canvas).toHaveAttribute('data-layout', 'mosaic');
      const rows = page.locator('[data-media-key]');
      await expect(rows.first()).toBeVisible();
      assert.ok(await rows.count() < 200, 'bounded virtualization');
      await rows.first().locator('.compact-media-check').click();
      await expect(rows.first().getByRole('checkbox')).toBeChecked();
      const actions = page.getByRole('group', {name:'Selection actions',exact:true});
      await expect(actions).toBeVisible();
      await expect(actions.getByRole('button',{name:'Preview',exact:true})).toBeVisible();
      await expect(actions.getByRole('button',{name:'Trash',exact:true})).toBeVisible();
      await actions.getByRole('button',{name:'Use in…',exact:true}).click();
      await expect(page.locator('[data-destination]')).toHaveAttribute('data-destination','asset-0');
      await page.keyboard.press('Escape');
      const mark = rows.first().locator('.compact-media-check-mark');
      await expect(mark.locator('svg')).toBeVisible();
      const hit = await rows.first().locator('.compact-media-check').boundingBox();
      assert.ok(hit && hit.width >= 44 && hit.height >= 44, 'small mark retains a comfortable hit target');
      for (const theme of ['light', 'dark']) {
        await page.locator('html').evaluate((element, theme) => element.setAttribute('data-theme', theme), theme);
        const paint = await mark.evaluate(element => { const style = getComputedStyle(element); return { ink: style.color, fill: style.backgroundColor }; });
        assert.notEqual(paint.ink, paint.fill, 'the checked icon must contrast with its background');
      }
      for (const [name, mode] of [['List', 'list'], ['Grid', 'grid'], ['Mosaic', 'mosaic']]) {
        if (width === 390) {
          await page.getByRole('button', { name: 'Filters', exact: true }).click();
          await page.getByRole('combobox', { name: 'Display', exact: true }).selectOption(mode);
          await page.keyboard.press('Escape');
        } else await page.getByRole('button', { name, exact: true }).click();
        await expect(canvas).toHaveAttribute('data-layout', mode);
        await expect(rows.first().getByRole('checkbox')).toBeChecked();
      }
      await rows.nth(1).locator('.compact-media-check').click();
      await expect(actions).toContainText('2 selected');
      await expect(actions.getByRole('button',{name:'Preview',exact:true})).toHaveCount(0);
      await actions.getByRole('button',{name:'Add to favorites',exact:true}).click();
      await expect(actions).toHaveCount(0);
      assert.equal(mutations.length,1); assert.equal(mutations[0].operation,'favorite');
      assert.deepEqual(mutations[0].references,assets.slice(0,2).map(asset=>({...asset.libraryRef,sourceRevision:asset.sourceRevision})));
      await rows.first().locator('.compact-media-check').click();
      await actions.getByRole('button',{name:'Add to collection',exact:true}).click();
      await page.getByRole('button',{name:'Project launch',exact:true}).click();
      await expect(actions).toHaveCount(0);
      assert.equal(mutations[1].operation,'add-to-collection'); assert.equal(mutations[1].collectionId,'lc-project');
      await rows.first().locator('.compact-media-check').click();
      await actions.getByRole('button',{name:'Add to collection',exact:true}).click();
      await page.getByRole('button',{name:'New collection',exact:true}).click();
      await page.getByLabel('Collection name',{exact:true}).fill('Scene references');
      await page.getByRole('button',{name:'Create and add',exact:true}).click();
      await expect(actions).toHaveCount(0);
      assert.equal(mutations[2].operation,'add-to-collection'); assert.equal(mutations[2].collectionId,'lc-new');
      await rows.first().locator('.compact-media-check').click();
      await actions.getByRole('button', { name: 'Clear selection', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeFocused();
      await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveCount(0);
      await expect(rows.first().getByRole('checkbox')).not.toBeChecked();
      await expect(page.getByRole('combobox',{name:'Source',exact:true})).toHaveCount(0);
      if (width === 390) {
        await page.getByRole('button', { name: 'Filters', exact: true }).click();
        await page.getByRole('combobox',{name:'Source',exact:true}).selectOption('upscale');
        await page.keyboard.press('Escape');
      } else {
        await page.locator('.compact-library-heading').getByRole('button',{name:'Tools',exact:true}).click();
        await page.getByRole('button',{name:'Upscale',exact:true}).click();
        await expect(page.locator('.compact-library-tools-trigger')).toHaveText('Upscale');
      }
      await page.getByRole('button', { name: 'Collections', exact: true }).click();
      await page.locator('.compact-library-collections').getByRole('button', { name: 'All media', exact: true }).click();
      await expect(page.locator('.compact-library-tools-trigger')).toHaveText('Upscale');
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
      if (width === 390) await expect(page.getByRole('combobox',{name:'Source',exact:true})).toHaveValue('upscale');
      await expect(page.getByLabel('Library view', { exact: true })).toHaveValue('all');
      await page.getByRole('button',{name:'Select loaded',exact:true}).click();
      await expect(actions).toContainText('200 selected');
      await actions.getByRole('button',{name:'Clear selection',exact:true}).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'no horizontal page overflow');
      assert.equal(await page.locator('main').evaluate(element => element.scrollWidth > element.clientWidth + 1), false, 'no clipped origin selector or inner horizontal scrollbar');
      assert.equal(await page.locator('.compact-media-grid').evaluate(element => element.scrollWidth > element.clientWidth + 1), false, 'no virtual canvas overflow');
      assert.deepEqual(originals, [], 'browsing never downloads originals');
      if (width === 390) {
        usage.pendingDeletionFiles=12; usage.sharedDeletionFiles=3;
        await page.evaluate(()=>window.refreshStorage());
        await expect(page.locator('.library-storage-usage')).toContainText('12 pending deletion');
        await expect(page.locator('.library-storage-usage')).toContainText('3 shared files retained');
        await page.evaluate(()=>window.failBrowse());
        for (const narrowWidth of [390,360]) {
          await page.setViewportSize({width:narrowWidth,height:900});
          assert.ok(await page.locator('.compact-library-footer').evaluate(node=>node.scrollWidth<=node.clientWidth), 'cleanup state wraps inside the compact footer');
          const retry=page.locator('.compact-library-footer').getByRole('button',{name:'Retry',exact:true});
          await expect(retry).toBeVisible();
          const more=await retry.boundingBox();
          assert.ok(more && more.x>=0 && more.x+more.width<=narrowWidth, 'pagination remains visible during pending/shared cleanup');
        }
        await page.locator('.compact-library-footer').getByRole('button',{name:'Retry',exact:true}).click();
        assert.equal(await page.evaluate(()=>window.retryCount),1,'automatic pagination retains an explicit recovery action');
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); await fixture.close(); }
});

test('recent thumbnails survive return scrolling without refetching private no-store images and remain bounded', {timeout:90000}, async () => {
  const fixture=await startWorkspaceReferenceFixture({source,config:{assets},imageCacheControl:'private,no-store',hostModules:referencePickerAuthModules('gallery-owner','fixture-only')});
  const browser=await chromium.launch();
  try {
    for(const mode of ['List','Grid','Mosaic']) {
      const page=await browser.newPage({viewport:{width:1111,height:844}});
      const requests:string[]=[];
      page.on('request',request=>{if(request.url().includes('/poster-')) requests.push(request.url());});
      await page.route('**/api/media-library/collections**',route=>route.fulfill({json:{ok:true,items:[],hasMore:false,nextCursor:null}}));
      await page.route('**/api/media-library/storage',route=>route.fulfill({json:{ok:true,usage:{recordedBytes:0,measuredFiles:0,totalFiles:0,limitBytes:null,enforcement:false}}}));
      await page.goto(fixture.url);
      await page.getByRole('button',{name:mode,exact:true}).click();
      const first=page.locator('[data-media-key]').first().locator('img');
      await expect.poll(()=>first.evaluate((image:HTMLImageElement)=>image.complete && image.naturalWidth>0)).toBe(true);
      const firstUrl=await first.getAttribute('src');
      const before=requests.filter(url=>url.endsWith(firstUrl!)).length;
      const canvas=page.locator('.compact-media-grid');
      await canvas.evaluate(element=>element.scrollTop=element.clientHeight*2);
      await expect.poll(()=>canvas.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
      await expect(page.locator('[data-media-key]')).not.toHaveCount(200);
      await canvas.evaluate(element=>element.scrollTop=0);
      await expect(first).toBeVisible();
      await expect.poll(()=>first.evaluate((image:HTMLImageElement)=>image.complete)).toBe(true);
      assert.equal(requests.filter(url=>url.endsWith(firstUrl!)).length,before,`${mode}: no repeated private thumbnail request`);
      await canvas.evaluate(element=>element.scrollTop=element.scrollHeight);
      await expect.poll(()=>page.locator('[data-media-key]').count()).toBeLessThanOrEqual(96);
      assert.equal(requests.some(url=>url.includes('/original-')),false);
      await page.close();
    }
  } finally {await browser.close();await fixture.close();}
});

const paginatedSource = `import {createRoot} from 'react-dom/client';
import {CompactLibraryBrowser} from './components/library/CompactLibraryBrowser.client';
import {SWRProvider} from './components/swr/SWRProvider';
import {useLibraryBrowse} from './hooks/useLibraryBrowse';
const scope={view:'all',kind:'all',source:'all',sort:'recent'};
function Scene(){const library=useLibraryBrowse({userId:'gallery-owner',scope});
return <main data-loaded={library.assets.length} style={{height:'100dvh',display:'flex',padding:12}}>
<CompactLibraryBrowser locale="en" title="Media" assets={library.assets} assetType="all"
 management={{userId:'gallery-owner',scope,onScopeChange:()=>{},totalCount:library.totalCount}}
 isLoading={library.isLoading} isLoadingMore={library.isLoadingMore} hasMore={library.hasMore}
 onLoadMore={library.loadMore} error={library.error?.message} onRetry={library.revalidate}
 searchPlaceholder="Search media" sourcesTitle="Source" emptyLabel="Empty" emptySearchLabel="No match"
 renderAssetActions={()=>null}/></main>}
createRoot(document.getElementById('root')).render(<SWRProvider><Scene/></SWRProvider>);`;

test('automatic cursor pages keep mosaic card identity while recycled image and video posters receive fresh decoders', {timeout:90000}, async () => {
  const paginatedAssets = assets.slice(0, 180).map((asset, index) => index % 3 === 1
    ? {...asset, kind:'video', url:asset.url.replace('.png', '.mp4'), libraryRef:{...asset.libraryRef, kind:'video'}}
    : asset);
  const fixture = await startWorkspaceReferenceFixture({
    source:paginatedSource, config:{}, imageCacheControl:'private,no-store',
    hostModules:{...referencePickerAuthModules('gallery-owner','fixture-only'),
      'next/navigation':"export const usePathname=()=>'/app/library';"},
  });
  const browser = await chromium.launch();
  try {
    for (const width of [1111, 390]) {
      const page = await browser.newPage({viewport:{width,height:844}});
      const errors:string[] = [], originals:string[] = [], cursors:number[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {if(request.url().includes('/original-')) originals.push(request.url());});
      await page.route('**/api/media-library/collections**', route => route.fulfill({json:{ok:true,items:[],hasMore:false,nextCursor:null}}));
      await page.route('**/api/media-library/browse**', route => {
        const offset = Number(new URL(route.request().url()).searchParams.get('cursor') ?? 0);
        cursors.push(offset);
        const next = offset + 30;
        return route.fulfill({json:{ok:true,assets:paginatedAssets.slice(offset,next),
          totalCount:paginatedAssets.length,hasMore:next<paginatedAssets.length,
          nextCursor:next<paginatedAssets.length?String(next):null}});
      });
      await page.goto(fixture.url);
      await expect(page.locator('main')).toHaveAttribute('data-loaded','30');
      await expect(page.locator('[data-media-key="canonical-0"] img')).toBeVisible();
      await page.evaluate(() => {window.galleryImageOwners = new WeakMap();});
      const remember = async () => {
        const result = await page.evaluate(() => {
          const errors:string[] = [];
          const cards = [...document.querySelectorAll<HTMLElement>('[data-media-key]')];
          for (const card of cards) {
            const key = card.dataset.mediaKey!, image = card.querySelector('img');
            if(!image) continue;
            const previous = window.galleryImageOwners.get(image);
            if(previous && previous !== key) errors.push(previous+' became '+key);
            window.galleryImageOwners.set(image,key);
            const expected='/poster-'+key.slice('canonical-'.length)+'.svg';
            if(new URL(image.src).pathname !== expected) errors.push(key+' has the wrong poster');
            if(image.complete && image.currentSrc && new URL(image.currentSrc).pathname !== expected) errors.push(key+' has a stale decoded poster');
          }
          return {errors,count:cards.length};
        });
        assert.deepEqual(result.errors, [], 'a recycled row must never inherit another media image decoder');
        assert.ok(result.count <= 96, 'recent cards remain bounded across appended pages');
      };
      await remember();
      const canvas = page.locator('.compact-media-grid');
      for(let count=60;count<=180;count+=30) {
        await canvas.evaluate(element => {element.scrollTop=element.scrollHeight;});
        await expect(page.locator('main')).toHaveAttribute('data-loaded',String(count));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await remember();
      }
      assert.deepEqual(cursors,[0,30,60,90,120,150], 'scroll loads each cursor once and stops at the final page');
      for(const fraction of [0,0.2,0.4,0.6,0.8,1,0]) {
        await canvas.evaluate((element,fraction) => {element.scrollTop=(element.scrollHeight-element.clientHeight)*fraction;},fraction);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await remember();
      }
      await expect(page.locator('[data-media-key="canonical-0"] img')).toBeVisible();
      await expect.poll(()=>page.locator('[data-media-key="canonical-0"] img').evaluate((image:HTMLImageElement)=>image.complete && image.naturalWidth>0)).toBe(true);
      await remember();
      assert.deepEqual(originals, [], 'image and video browsing requests only their stored posters');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {await browser.close();await fixture.close();}
});
