import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, webkit, expect } from '@playwright/test';
import { startImageRailFixture } from './helpers/image-rail-browser-fixture';

test('image rail shares video navigation and width, with usable recents and unchanged prompt', {timeout:90_000}, async()=>{
 const fixture=await startImageRailFixture();
 try {for(const browserType of [chromium,webkit]) {
  const browser=await browserType.launch({headless:true});
  try {for(const {width,fontFamily} of [...[390,768,800,1105,1440].map(width=>({width,fontFamily:undefined})),{width:768,fontFamily:'monospace'}]) {
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.route('https://media.example/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="tan"/></svg>'}));
   await page.goto(fixture.url);
   // The navigation must fit its fixed rail even with wider fallback font metrics.
   if(fontFamily) await page.evaluate(family=>{document.body.style.fontFamily=family;},fontFamily);
   const rail=page.locator('.app-image-media-rail');
   await expect(rail.locator('.app-rail-media-card').first()).toBeVisible();
   const desktop=await page.evaluate(()=>matchMedia('(min-width: 768px)').matches);
   const nav=!desktop?page.locator('.app-image-mobile-rail-navigation'):page.locator('.app-creation-topbar-rail');
   assert.equal(await page.getByRole('heading',{name:'Latest renders',exact:false}).isVisible(),false);
   assert.equal(await page.getByRole('link',{name:'View all',exact:true}).count(),1); // only one navigation is exposed at each breakpoint
   await expect(nav.getByRole('link',{name:'View all',exact:true})).toHaveAttribute('href','/app/library');
   if(desktop){
    assert.equal(Math.round((await rail.boundingBox())!.width),width<900?216:280);
    assert.equal(Math.round((await nav.boundingBox())!.x),Math.round((await rail.boundingBox())!.x),`${browserType.name()} ${width}px: rail navigation aligns with its column`);
    for(const control of await nav.locator('button,a').all()) {
     const box=(await control.boundingBox())!, boundary=(await rail.boundingBox())!;
     assert.ok(box.x>=boundary.x && box.x+box.width<=boundary.x+boundary.width+1,'rail controls stay inside the shared column');
    }
    const card=(await rail.locator('.app-rail-media-card').first().boundingBox())!;
    const preview=(await page.getByTestId('preview').boundingBox())!;
    assert.ok(Math.abs(card.y-preview.y)<=8,`first image and preview align: ${card.y}/${preview.y}`);
   }
   assert.equal(await page.evaluate(()=>globalThis.recentFetches??0),0,'recents do not add an initial page request');
   await nav.getByRole('button',{name:'Recents',exact:true}).click();
   await expect(page.getByRole('button',{name:'Use as reference · Images 1',exact:true})).toBeVisible();
   await expect(page.locator('.app-recent-kind-selector').getByRole('button')).toHaveCount(1);
   await page.getByRole('button',{name:'Use as reference · Images 1',exact:true}).click();
   await expect(page.getByTestId('reference')).toHaveText('No reference');
   await page.locator('.app-recent-insert').click();
   await expect(page.getByTestId('reference')).toHaveText('https://media.example/original.svg');
   await page.getByRole('button',{name:'Use as reference · Images 1',exact:true}).click();
   await expect(page.locator('.app-recent-insert')).toBeDisabled();
   await page.getByRole('combobox',{name:'Slot',exact:true}).selectOption('0');
   await expect(page.locator('.app-recent-insert')).toBeEnabled();
   await page.locator('.app-recent-insert').click();
   await page.getByRole('button',{name:'Activity',exact:true}).last().click();
   await expect(rail.locator('.app-rail-media-card').first()).toBeVisible();
   await expect(page.getByRole('textbox',{name:'Prompt'})).toHaveValue('Keep this image prompt.');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
   await page.close();
  }}finally{await browser.close();}
 }}finally{await fixture.close();}
});
