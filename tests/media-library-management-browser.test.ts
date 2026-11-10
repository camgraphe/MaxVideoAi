import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { startWorkspaceReferenceFixture, referencePickerAuthModules } from './helpers/workspace-reference-browser-fixture';

const source = `import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {CompactLibraryBrowser} from './components/library/CompactLibraryBrowser.client';
import {LibraryMediaNavigation} from './components/library/LibraryMediaNavigation.client';
function Scene(){const[scope,setScope]=useState({view:'all',kind:'all',source:'all',sort:'recent'});
return <main style={{height:'100dvh',display:'flex',padding:12}}><CompactLibraryBrowser locale="en" title="Media" hideTitle assets={globalThis.fixtureConfig.assets} assetType="all" isLoading={false}
management={{userId:'gallery-owner',scope,onScopeChange:patch=>setScope(prev=>({...prev,...patch})),totalCount:200}}
source={scope.source} availableSources={['all','upload','generated','upscale']} sourceLabels={{all:'All',upload:'Uploads',generated:'Generated',upscale:'Upscale'}} onSourceChange={source=>setScope(prev=>({...prev,source}))}
searchPlaceholder="Search media" sourcesTitle="Source" emptyLabel="Empty" emptySearchLabel="No match" renderAssetActions={()=>null}
headerLeadingActions={<LibraryMediaNavigation locale="en" value="all" charactersEnabled onChange={()=>{}}/>}
headerActions={<button>Import</button>} renderContinuation={asset=><button data-destination={asset.id}>Use selected media</button>}/></main>};createRoot(document.getElementById('root')).render(<Scene/>);`;
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
      await page.route('**/api/media-library/collections**', route => route.fulfill({ json: { ok: true, items: [], hasMore: false, nextCursor: null } }));
      await page.route('**/api/media-library/organization', route => {
        const body = route.request().postDataJSON(); mutations.push(body);
        return route.fulfill({json:{ok:true,results:body.references.map((reference:unknown)=>({reference,status:'succeeded'})),succeededCount:body.references.length,failedCount:0,affectedCount:body.references.length}});
      });
      await page.goto(fixture.url);
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
        await page.getByRole('button', { name, exact: true }).click();
        await expect(canvas).toHaveAttribute('data-layout', mode);
        await expect(rows.first().getByRole('checkbox')).toBeChecked();
      }
      await rows.nth(1).locator('.compact-media-check').click();
      await expect(actions).toContainText('2 selected');
      await expect(actions.getByRole('button',{name:'Preview',exact:true})).toHaveCount(0);
      await actions.getByRole('button',{name:'Favorites',exact:true}).click();
      await page.getByRole('button',{name:'Favorite',exact:true}).click();
      await expect(actions).toHaveCount(0);
      assert.equal(mutations.length,1); assert.equal(mutations[0].operation,'favorite');
      assert.deepEqual(mutations[0].references,assets.slice(0,2).map(asset=>({...asset.libraryRef,sourceRevision:asset.sourceRevision})));
      await rows.first().locator('.compact-media-check').click();
      await actions.getByRole('button', { name: 'Clear selection', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Select', exact: true })).toBeFocused();
      await expect(rows.first().getByRole('checkbox')).not.toBeChecked();
      await expect(page.getByRole('combobox',{name:'Source',exact:true})).toHaveCount(0);
      await page.locator('.compact-library-heading').getByRole('button',{name:'Tools',exact:true}).click();
      await page.getByRole('button',{name:'Upscale',exact:true}).click();
      await expect(page.locator('.compact-library-tools-trigger')).toHaveText('Upscale');
      await page.getByRole('button', { name: 'All media', exact: true }).click();
      await page.locator('.compact-library-collections').getByRole('button', { name: 'All media', exact: true }).click();
      await expect(page.locator('.compact-library-tools-trigger')).toHaveText('Tools');
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
      await expect(page.getByLabel('Library view', { exact: true })).toHaveValue('all');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'no horizontal page overflow');
      assert.equal(await page.locator('main').evaluate(element => element.scrollWidth > element.clientWidth + 1), false, 'no clipped origin selector or inner horizontal scrollbar');
      assert.equal(await page.locator('.compact-media-grid').evaluate(element => element.scrollWidth > element.clientWidth + 1), false, 'no virtual canvas overflow');
      assert.deepEqual(originals, [], 'browsing never downloads originals');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); await fixture.close(); }
});
