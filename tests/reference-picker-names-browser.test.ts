import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium,expect} from '@playwright/test';
import {startWorkspaceReferenceFixture,referencePickerAuthModules} from './helpers/workspace-reference-browser-fixture';
type NamesFixtureGlobal = typeof globalThis & {chosen?:{id:string;url:string;ref:unknown}};
const owner='names-owner',token='names-fixture-token';
const source=`import {createRoot} from 'react-dom/client';import {ReferenceLibraryPicker} from './components/library/ReferenceLibraryPicker.client';
createRoot(document.getElementById('root')).render(<div className="app-experience"><ReferenceLibraryPicker title="Choose reference" assets={globalThis.fixtureConfig.assets} assetType="image" source="all" availableSources={['all']} sourceLabels={{all:'All'}} onSourceChange={()=>{}} onClose={()=>{}} isLoading={false} emptyLabel="Empty" emptySearchLabel="No match" renderAssetActions={()=>null} selection={{ownerId:globalThis.fixtureConfig.owner,scope:'names',onConfirm:asset=>{globalThis.chosen=asset;}}}/></div>);`;
const long='A chosen watch collection poster '+ 'with a descriptive name '.repeat(12)+'.png';
const poster='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"/>');
const assets=[{id:'exact-a',name:long},{id:'exact-b',name:'  '},{id:'exact-c',name:'watch-static.png'}].map((asset,index)=>{
 const assetId='ma_'+String(index+1).repeat(32);
 return {...asset,assetId,ref:{type:'asset',assetId,kind:'image'},kind:'image',url:'https://media.fixture.test/original-'+asset.id+'.png',thumbUrl:poster,width:800,height:600};
});

test('desktop picker displays, searches and confirms real names with a localized fallback',{timeout:60000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{assets,owner},hostModules:referencePickerAuthModules(owner,token)}),browser=await chromium.launch();
 try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[],proofs:unknown[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/media-library/selection/validate',route=>{
   assert.equal(route.request().method(),'POST');assert.equal(route.request().headers().authorization,'Bearer '+token);assert.equal(route.request().headers()['x-maxvideoai-auth-mode'],'bearer');
   const body=route.request().postDataJSON();assert.deepEqual(body,{candidates:[{reference:assets[2].ref,originalUrl:assets[2].url}]});proofs.push(body);
   return route.fulfill({json:{ok:true,results:[{reference:assets[2].ref}]}});
  });
  await page.goto(fixture.url);
  const cards=page.getByRole('row');await expect(cards).toHaveCount(3);await expect(cards.first()).toContainText(long);await expect(cards.first()).toHaveAccessibleName(long);
  await expect(cards.first().getByRole('button',{name:'Preview '+long,exact:true})).toBeVisible();
  await expect(cards.nth(1)).toContainText('Images 2');await expect(cards.nth(2)).toContainText('watch-static.png');
  await expect(cards.first().locator('.compact-media-name')).toHaveAttribute('title',long);
  const longChoice=page.getByRole('row',{name:long,exact:true}).getByRole('checkbox');await expect(longChoice).toHaveCount(1);
  await expect(longChoice).toHaveAttribute('aria-label','Select '+long);await expect(longChoice).toHaveAccessibleName('Select '+long+' '+long);
  await longChoice.check();await expect(longChoice).toBeChecked();await expect(page.locator('.app-picker-selection')).toContainText(long);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  if(process.env.REFERENCE_NAMES_EVIDENCE)await page.screenshot({path:process.env.REFERENCE_NAMES_EVIDENCE});
  await page.getByRole('searchbox').fill('watch-static');await expect(cards).toHaveCount(1);await expect(cards.first()).toHaveAccessibleName('watch-static.png');
  const namedRow=page.getByRole('row',{name:'watch-static.png',exact:true});await expect(namedRow.getByRole('button',{name:'Preview watch-static.png',exact:true})).toBeVisible();
  const namedChoice=namedRow.getByRole('checkbox');await expect(namedChoice).toHaveCount(1);
  await expect(namedChoice).toHaveAttribute('aria-label','Select watch-static.png');await expect(namedChoice).toHaveAccessibleName('Select watch-static.png watch-static.png');
  await namedChoice.check();await expect(namedChoice).toBeChecked();await expect(page.locator('.app-picker-selection')).toContainText('watch-static.png');
  assert.equal(await page.evaluate(()=>(globalThis as NamesFixtureGlobal).chosen),undefined,'Choice stays staged before confirmation');
  await page.getByRole('button',{name:'Use selection',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(globalThis as NamesFixtureGlobal).chosen?.id)).toBe('exact-c');
  const chosen=await page.evaluate(()=>(globalThis as NamesFixtureGlobal).chosen);assert.ok(chosen);assert.equal(chosen.url,assets[2].url);assert.deepEqual(chosen.ref,assets[2].ref);assert.equal(proofs.length,1);assert.deepEqual(errors,[]);
 }finally{await browser.close();await fixture.close();}
});

test('unnamed picker fallback stays consistent through dimension filtering and confirmation',{timeout:60000},async()=>{
 const filteredAssets=assets.map((asset,index)=>({...asset,width:index===1?640:800,height:index===1?480:600}));
 const fixture=await startWorkspaceReferenceFixture({source,config:{assets:filteredAssets,owner},hostModules:referencePickerAuthModules(owner,token)}),browser=await chromium.launch();
 try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),proofs:unknown[]=[];
  await page.route('**/api/media-library/selection/validate',route=>{
   assert.equal(route.request().method(),'POST');assert.equal(route.request().headers().authorization,'Bearer '+token);assert.equal(route.request().headers()['x-maxvideoai-auth-mode'],'bearer');
   const body=route.request().postDataJSON();assert.deepEqual(body,{candidates:[{reference:assets[1].ref,originalUrl:assets[1].url}]});proofs.push(body);
   return route.fulfill({json:{ok:true,results:[{reference:assets[1].ref}]}});
  });
  await page.goto(fixture.url);
  const cards=page.getByRole('row');await expect(cards.nth(1)).toContainText('Images 2');
  await page.getByRole('searchbox').fill('640x480');await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Images 2');await expect(cards.first()).toHaveAccessibleName('Images 2');
  await expect(cards.first().getByRole('button',{name:'Preview Images 2',exact:true})).toBeVisible();
  const fallbackChoice=page.getByRole('row',{name:'Images 2',exact:true}).getByRole('checkbox');await expect(fallbackChoice).toHaveCount(1);
  await expect(fallbackChoice).toHaveAttribute('aria-label','Select Images 2');await expect(fallbackChoice).toHaveAccessibleName('Select Images 2 Images 2');
  await fallbackChoice.check();await expect(fallbackChoice).toBeChecked();await expect(page.locator('.app-picker-selection')).toContainText('Selected · Images 2 · 640 × 480');
  assert.equal(await page.evaluate(()=>(globalThis as NamesFixtureGlobal).chosen),undefined,'Fallback stays staged before confirmation');
  await page.getByRole('searchbox').fill('Images 2');await expect(cards).toHaveCount(1);await expect(cards.first()).toContainText('Images 2');
  if(process.env.REFERENCE_NAMES_REVIEW_EVIDENCE)await page.screenshot({path:process.env.REFERENCE_NAMES_REVIEW_EVIDENCE});
  await page.getByRole('button',{name:'Use selection',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(globalThis as NamesFixtureGlobal).chosen?.id)).toBe('exact-b');
  const chosen=await page.evaluate(()=>(globalThis as NamesFixtureGlobal).chosen);assert.ok(chosen);assert.equal(chosen.url,assets[1].url);assert.deepEqual(chosen.ref,assets[1].ref);assert.equal(proofs.length,1);
 }finally{await browser.close();await fixture.close();}
});
