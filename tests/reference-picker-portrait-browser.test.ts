import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit, expect } from '@playwright/test';
import { startWorkspaceReferenceFixture, referencePickerAuthModules } from './helpers/workspace-reference-browser-fixture';

type PortraitFixtureGlobal = typeof globalThis & {fixtureConfig:unknown;selectedOriginal?:string;selectedReference?:unknown};
const owner='portrait-owner',token='portrait-fixture-token';
const poster = (width: number, height: number) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#b9cfdf"/><rect width="100%" height="20%" fill="#c85849"/><rect y="80%" width="100%" height="20%" fill="#49774a"/><text x="50%" y="12%" text-anchor="middle" font-size="22">TOP</text><text x="50%" y="94%" text-anchor="middle" font-size="22">BOTTOM</text></svg>`)}`;
const assets = [[90, 160], [160, 90], [120, 120], [90, 160], [90, 160]].map(([width, height], index) => {
  const kind=index===4?'image':'video',assetId='ma_'+String(index+1).repeat(32);
  return {
    id: `media-${index}`, assetId, ref:{type:'asset',assetId,kind}, name:`Poster ${index}`,kind,
    url: `https://media.fixture.test/original-${index}.${kind==='image'?'png':'mp4'}`,
    thumbUrl: poster(width * 3, height * 3),
    width: index === 3 ? undefined : width, height: index === 3 ? undefined : height,
  };
});
const source = `
  import { useEffect, useRef, useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { ReferenceLibraryPicker } from './components/library/ReferenceLibraryPicker.client';
  import { AudioGeneratedVideoPickerModal } from './app/(core)/(workspace)/app/audio/_components/audio-generated-video-picker';
  const config = globalThis.fixtureConfig;
  const select = asset => { globalThis.selectedOriginal = asset.url; globalThis.selectedReference = asset.ref; };
  function DensePicker() {
    const [source,setSource]=useState('all');
    const dialog=useRef(null);const Host=config.native?'dialog':'div';
    useEffect(()=>{if(config.native)dialog.current.showModal();},[]);
    return <Host ref={dialog} className="app-experience app-library-picker-layer"><ReferenceLibraryPicker
      title="Select reference image" subtitle="Images · Maximum 30" assets={config.assets} assetType="image"
      source={source} availableSources={['all','upload','character']} sourceLabels={{all:'All',upload:'Uploads',character:'Character Studio'}}
      onSourceChange={setSource} onClose={()=>{}} isLoading={false} emptyLabel="Empty" emptySearchLabel="No match"
      headerActions={<button type="button">Refresh</button>} hasMore onLoadMore={()=>{}} renderAssetActions={()=>null}
      selection={{scope:'compact',ownerId:config.owner,onConfirm:select,onConfirmMany:()=>{},getEligibility:()=>({status:'usable'})}} /></Host>;
  }
  createRoot(document.getElementById('root')).render(config.reader === 'audio'
    ? <AudioGeneratedVideoPickerModal open userId={config.owner} videos={config.assets.slice(0,4).map(a=>({...a,jobId:a.id,label:a.name,createdAt:'2026-01-01T00:00:00Z'}))}
        isLoading={false} error={null} locale="en" onClose={()=>{}} onSelect={select}
        copy={{picker:{title:'Choose video',close:'Close',search:'Search',empty:'No videos',error:'Could not select'},source:{durationPending:'Duration pending'}}}/>
    : config.reader === 'dense' ? <DensePicker /> : <div className="app-experience app-library-picker-layer"><ReferenceLibraryPicker
        title="Select reference video" assets={config.assets} assetType="video" source="all" availableSources={['all']}
        sourceLabels={{all:'All'}} onSourceChange={()=>{}} onClose={()=>{}} isLoading={false}
        searchPlaceholder="Search" sourcesTitle="Source" emptyLabel="No videos" emptySearchLabel="No match"
        renderAssetActions={()=>null} renderAssetMeta={()=><span>Choose a section up to 15 s after adding.</span>}
        selection={{ownerId:config.owner,scope:'portrait-test',onConfirm:select}}/></div>);
`;

test('reference picker reserves most mobile height for media and keeps secondary filters accessible', async () => {
  const fixture=await startWorkspaceReferenceFixture({source});
  const browser=await chromium.launch();
  try {
    for(const width of [390,1440]) {
      const page=await browser.newPage({viewport:{width,height:844}});
      await page.goto(fixture.url);
      await page.evaluate(config=>{(globalThis as PortraitFixtureGlobal).fixtureConfig=config;},{reader:'dense',assets});
      await page.addScriptTag({url:`${fixture.url}/${fixture.script}`});
      await expect(page.getByRole('row')).toHaveCount(5);
      const geometry=await page.evaluate(()=>({
        modal:document.querySelector('.app-reference-picker')!.getBoundingClientRect().height,
        canvas:document.querySelector('.compact-media-canvas')!.getBoundingClientRect().height,
        overflow:document.documentElement.scrollWidth>innerWidth+1,
      }));
      assert.ok(geometry.canvas/geometry.modal>=.68,JSON.stringify(geometry));
      assert.equal(geometry.overflow,false);
      await expect(page.getByRole('combobox',{name:'Source',exact:true})).toBeHidden();
      await page.getByRole('button',{name:'Filters',exact:true}).click();
      await page.getByRole('combobox',{name:'Source',exact:true}).selectOption('character');
      await page.getByRole('combobox',{name:'Compatibility',exact:true}).selectOption('all');
      await expect(page.getByRole('button',{name:'Refresh',exact:true})).toBeVisible();
      await expect(page.getByRole('link',{name:'Character Studio',exact:true})).toHaveAttribute('href','/app/tools/character-builder');
      await page.getByRole('button',{name:'Filters',exact:true}).click();
      await expect(page.getByRole('combobox',{name:'Source',exact:true})).toBeHidden();
      await page.getByRole('row').nth(0).locator('label.compact-media-check').click();
      await expect(page.getByRole('button',{name:'Add 1 reference',exact:true})).toBeEnabled();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      await page.close();
    }
  } finally {await browser.close();await fixture.close();}
});

test('Collections opens directly inside a native picker and preserves the receiving media filters', async () => {
  const fixture=await startWorkspaceReferenceFixture({source,config:{reader:'dense',native:true,owner,assets},hostModules:referencePickerAuthModules(owner,token)});
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const requests:URL[]=[];
    await page.route('**/api/media-library/collections**',route=>route.fulfill({json:{ok:true,items:[{id:'lc-project',name:'Project references'}],hasMore:false,nextCursor:null}}));
    await page.route('**/api/media-library/browse**',route=>{requests.push(new URL(route.request().url()));return route.fulfill({json:{ok:true,assets:[{...assets[4],organization:{key:'org-image',favorite:false,collectionIds:['lc-project'],trashedAt:null}}],totalCount:1,hasMore:false,nextCursor:null}});});
    await page.goto(fixture.url);
    await page.getByRole('button',{name:'Filters',exact:true}).click();
    await page.getByRole('combobox',{name:'Source',exact:true}).selectOption('character');
    await page.getByRole('button',{name:'Filters',exact:true}).click();
    await page.getByRole('button',{name:'Collections',exact:true}).click();
    await expect(page.locator('dialog .compact-library-popover')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog')).toHaveAttribute('open','');
    await expect(page.locator('.compact-library-popover')).toHaveCount(0);
    await page.getByRole('button',{name:'Collections',exact:true}).click();
    await page.getByRole('button',{name:'Project references',exact:true}).click();
    await expect(page.locator('.compact-library-collections-trigger')).toHaveText('Project references');
    await expect.poll(()=>requests.length).toBeGreaterThan(0);
    assert.equal(requests.at(-1)!.searchParams.get('kind'),'image');
    assert.equal(requests.at(-1)!.searchParams.get('source'),'character');
    assert.equal(requests.at(-1)!.searchParams.get('collectionId'),'lc-project');
    await page.getByRole('button',{name:'Project references',exact:true}).click();
    await page.getByRole('button',{name:'All media',exact:true}).click();
    await page.getByRole('button',{name:'Filters',exact:true}).click();
    await expect(page.getByRole('combobox',{name:'Source',exact:true})).toHaveValue('character');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  } finally {await browser.close();await fixture.close();}
});

test('portrait video posters stay centered and uncropped in both reference selectors on Chromium and WebKit', async () => {
  const fixture = await startWorkspaceReferenceFixture({ source,hostModules:referencePickerAuthModules(owner,token) });
  const evidence = process.env.REFERENCE_PICKER_EVIDENCE_DIR;
  if (evidence) await mkdir(evidence, { recursive: true });
  try {
    for (const browserName of ['chromium', 'webkit']) {
      const browser = browserName === 'webkit' ? await webkit.launch() : await chromium.launch();
      try {
        for (const width of [390, 1440]) for (const reader of ['reference', 'audio']) {
          const page = await browser.newPage({ viewport: { width, height: 1000 } });
          const errors: string[] = [], originals: string[] = [],proofs:unknown[]=[];
          page.on('pageerror', error => errors.push(error.message));
          page.on('request', request => { if (/original-\d+\.mp4/.test(request.url())) originals.push(request.url()); });
          await page.route('**/api/media-library/selection/validate',route=>{
            assert.equal(route.request().method(),'POST');assert.equal(route.request().headers().authorization,'Bearer '+token);
            assert.equal(route.request().headers()['x-maxvideoai-auth-mode'],'bearer');
            const body=route.request().postDataJSON();assert.deepEqual(body,{candidates:[{reference:assets[0].ref,originalUrl:assets[0].url}]});proofs.push(body);
            return route.fulfill({json:{ok:true,results:[{reference:assets[0].ref}]}});
          });
          await page.goto(fixture.url);
          await page.evaluate(config => { (globalThis as PortraitFixtureGlobal).fixtureConfig = config; }, { reader, assets,owner });
          await page.addScriptTag({ url: `${fixture.url}/${fixture.script}` });
          const rows=page.getByRole('row'),covers=page.locator('.compact-media-cover');
          await expect(rows).toHaveCount(reader==='audio'?4:5);await expect(covers).toHaveCount(reader==='audio'?4:5);
          await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.compact-media-cover img')].every(image => image.complete && image.naturalWidth > 0));
          let referenceRatio:number|undefined;
          for (let index = 0; index < await covers.count(); index++) {
            const cover = covers.nth(index), image = cover.locator('img');
            const box = await cover.boundingBox(), imageBox = await image.boundingBox();
            assert.ok(box && imageBox&&box.width>0&&box.height>0);
            referenceRatio??=box.width/box.height;
            assert.ok(Math.abs(box.width/box.height-referenceRatio)<.02,'all media keep the same compact cover geometry');
            assert.ok(Math.abs(imageBox.y - box.y) < 1 && Math.abs(imageBox.x - box.x) < 1, `${browserName}/${reader}: poster cannot shift below the cover`);
            assert.ok(Math.abs(imageBox.height - box.height) < 1 && Math.abs(imageBox.width - box.width) < 1, 'image layout is bounded by its cover');
            assert.equal(await image.evaluate(node => getComputedStyle(node).objectFit),'contain','portrait, wide and square posters including images preserve full framing');
            assert.equal(await image.evaluate(node => getComputedStyle(node).objectPosition),'50% 50%','the full poster stays centered in its cover');
          }
          await expect(page.locator('video,audio')).toHaveCount(0);
          const selectedRow=page.getByRole('row',{name:'Poster 0',exact:true});
          await expect(selectedRow.getByRole('button',{name:'Preview Poster 0',exact:true})).toBeVisible();
          const choice=selectedRow.getByRole('checkbox');
          await expect(choice).toHaveCount(1);
          await expect(choice).toHaveAttribute('aria-label','Select Poster 0');
          await expect(choice).toHaveAccessibleName('Select Poster 0 Poster 0');
          await expect(choice).not.toBeChecked();
          await selectedRow.locator('label.compact-media-check').click();
          await expect(choice).toBeChecked();
          await expect(page.locator('.app-picker-selection')).toContainText('Poster 0');
          assert.equal(await page.evaluate(() => (globalThis as PortraitFixtureGlobal).selectedOriginal),undefined,'selection remains staged until confirmation');
          await page.getByRole('button', { name: 'Use selection', exact: true }).click();
          await expect.poll(()=>page.evaluate(() => (globalThis as PortraitFixtureGlobal).selectedOriginal)).toBe(assets[0].url);
          assert.deepEqual(await page.evaluate(() => (globalThis as PortraitFixtureGlobal).selectedReference),assets[0].ref,'selection keeps the exact canonical reference');
          assert.equal(proofs.length,1,'confirmation validates the exact original once');
          assert.deepEqual(originals, [], 'opening a picker never downloads original video bytes');
          await expect(page.locator('video,audio')).toHaveCount(0);
          assert.deepEqual(errors, []);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
          if (evidence) await page.screenshot({ path: join(evidence, `${browserName}-${reader}-${width}.png`) });
          await page.close();
        }
      } finally { await browser.close(); }
    }
  } finally { await fixture.close(); }
});
