import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createCreatorMarketingFixture } from './helpers/creator-marketing-browser-fixture';

test('creator landings remain readable on mobile and desktop with truthful schematic interactions', async () => {
  const fixture=await createCreatorMarketingFixture();
  const browser=await chromium.launch({headless:true});
  const evidence=process.env.CREATOR_MARKETING_EVIDENCE_DIR;
  if(evidence)await mkdir(evidence,{recursive:true});
  try {
    for(const locale of ['en','fr','es'])for(const id of ['subtitles','lip-sync','product-photo-editor','product-video-editor','motion-transfer'])for(const width of [390,1440]){
      const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
      const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
      try {
        await page.goto(`${fixture.url}/${locale}/${id}`);
        await page.waitForFunction(()=>!!(window as any).creatorReady);
        assert.equal(await page.locator('h1').count(),1);
        assert.equal(await page.locator('video,audio').count(),0);
        assert.equal(await page.locator('script[type="application/ld+json"]').count(),0,'unreleased design preview cannot advertise a service');
        assert.equal(await page.locator('a[href^="/app/tools"]').count(),0);
        assert.ok(await page.locator('.creator-preview-status').first().isVisible());
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`${locale}/${id}/${width} overflows`);
        if(locale==='en'&&id==='subtitles'){
          await page.getByLabel('Edit the sample caption').fill('The corrected caption.');
          assert.equal(await page.locator('[data-caption-preview]').textContent(),'The corrected caption.');
          await page.getByRole('button',{name:'High contrast',exact:true}).click();
          assert.equal(await page.locator('[data-caption-preview]').getAttribute('data-style'),'2');
        }
        if(locale==='en'&&id==='lip-sync'){
          await page.getByRole('button',{name:'Video',exact:true}).click();
          assert.equal(await page.locator('[data-source-mode]').getAttribute('data-source-mode'),'video');
        }
        if(locale==='en'&&id==='product-video-editor'){
          const control=page.getByRole('slider');await control.focus();await page.keyboard.press('ArrowRight');
          assert.equal(await control.inputValue(),'51');
        }
        if(evidence&&locale==='en')await page.screenshot({path:join(evidence,`${id}-${width}.png`),fullPage:true});
        assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>(window as any).creatorErrors),[]);
      } finally {await page.close();}
    }
    const released=await browser.newPage();
    try {
      await released.goto(`${fixture.url}/fr/subtitles?released=1`);
      assert.equal(await released.locator('a[href="/app/tools/subtitles"]').count(),2);
      const schemas=await released.locator('script[type="application/ld+json"]').evaluateAll(nodes=>nodes.map(node=>JSON.parse(node.textContent!)));
      assert.deepEqual(schemas.map(schema=>schema['@type']),['BreadcrumbList','Service']);
      assert.equal(schemas[0].itemListElement[2].item,'https://maxvideoai.com/fr/outils/subtitles');
      assert.equal(schemas[1].url,'https://maxvideoai.com/fr/outils/subtitles');
      assert.equal(schemas[1].offers,undefined);
    } finally {await released.close();}
  } finally {await browser.close();await fixture.close();}
});
