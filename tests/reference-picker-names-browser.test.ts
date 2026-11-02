import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium,expect} from '@playwright/test';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
const source=`import {createRoot} from 'react-dom/client';import {ReferenceLibraryPicker} from './components/library/ReferenceLibraryPicker.client';
createRoot(document.getElementById('root')).render(<div className="app-experience"><ReferenceLibraryPicker title="Choose reference" assets={globalThis.fixtureConfig.assets} assetType="image" source="all" availableSources={['all']} sourceLabels={{all:'All'}} onSourceChange={()=>{}} onClose={()=>{}} isLoading={false} emptyLabel="Empty" emptySearchLabel="No match" renderAssetActions={()=>null} selection={{scope:'names',onConfirm:asset=>{globalThis.chosen=asset;}}}/></div>);`;
const long='A chosen watch collection poster '+ 'with a descriptive name '.repeat(12)+'.png';
const poster='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"/>');
const assets=[{id:'exact-a',name:long},{id:'exact-b',name:'  '},{id:'exact-c',name:'watch-static.png'}].map(asset=>({...asset,kind:'image',url:'/original-'+asset.id+'.png',thumbUrl:poster,width:800,height:600}));
test('desktop picker displays, searches and confirms real names with a localized fallback',{timeout:60000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{assets}}),browser=await chromium.launch();
 try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(fixture.url);
  const cards=page.locator('.app-picker-card');await expect(cards).toHaveCount(3);await expect(cards.first()).toContainText(long);await expect(cards.first()).toHaveAccessibleName(new RegExp('Choose.*A chosen watch'));
  await expect(cards.nth(1)).toContainText('Images 2');await expect(cards.nth(2)).toContainText('watch-static.png');
  await expect(cards.first().locator('[title]')).toHaveAttribute('title',long);await cards.first().click();await expect(page.locator('.app-picker-selection')).toContainText(long);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  if(process.env.REFERENCE_NAMES_EVIDENCE)await page.screenshot({path:process.env.REFERENCE_NAMES_EVIDENCE});
  await page.getByRole('searchbox').fill('watch-static');await expect(cards).toHaveCount(1);await cards.first().click();await expect(page.locator('.app-picker-selection')).toContainText('watch-static.png');
  await page.locator('.app-picker-use').click();assert.equal(await page.evaluate(()=>(globalThis as any).chosen.id),'exact-c');assert.equal(await page.evaluate(()=>(globalThis as any).chosen.url),'/original-exact-c.png');assert.deepEqual(errors,[]);
 }finally{await browser.close();await fixture.close();}
});

test('unnamed picker fallback stays consistent through dimension filtering and confirmation',{timeout:60000},async()=>{
 const filteredAssets=assets.map((asset,index)=>({...asset,width:index===1?640:800,height:index===1?480:600}));
 const fixture=await startWorkspaceReferenceFixture({source,config:{assets:filteredAssets}}),browser=await chromium.launch();
 try{const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(fixture.url);
  const cards=page.locator('.app-picker-card');await expect(cards.nth(1)).toContainText('Images 2');
  await page.getByRole('searchbox').fill('640x480');await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Images 2');await expect(cards.first()).toHaveAccessibleName('Choose · Images 2 · 640 × 480');
  await cards.first().click();await expect(page.locator('.app-picker-selection')).toContainText('Selected · Images 2 · 640 × 480');
  await page.getByRole('searchbox').fill('Images 2');await expect(cards).toHaveCount(1);await expect(cards.first()).toContainText('Images 2');
  if(process.env.REFERENCE_NAMES_REVIEW_EVIDENCE)await page.screenshot({path:process.env.REFERENCE_NAMES_REVIEW_EVIDENCE});
  await page.locator('.app-picker-use').click();assert.equal(await page.evaluate(()=>(globalThis as any).chosen.id),'exact-b');assert.equal(await page.evaluate(()=>(globalThis as any).chosen.url),'/original-exact-b.png');
 }finally{await browser.close();await fixture.close();}
});
