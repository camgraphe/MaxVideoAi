import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createCreatorMarketingFixture } from './helpers/creator-marketing-browser-fixture';

test('creator landings show responsive art and truthful interactions on mobile and desktop', async () => {
  const fixture=await createCreatorMarketingFixture();
  const browser=await chromium.launch({headless:true});
  const evidence=process.env.CREATOR_MARKETING_EVIDENCE_DIR;
  if(evidence)await mkdir(evidence,{recursive:true});
  try {
    for(const locale of ['en','fr','es'])for(const id of ['subtitles','lip-sync','product-photo-editor','product-video-editor','motion-transfer'])for(const width of [320,390,768,1440]){
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
        const heroArt = page.locator('.creator-hero-art img');
        assert.equal(await heroArt.getAttribute('loading'),'eager');
        assert.equal(await heroArt.getAttribute('fetchpriority'),'high');
        assert.equal(await page.locator('img[fetchpriority="high"]').count(),1);
        assert.ok(await heroArt.evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0),'hero art must load');
        assert.equal(await page.locator('#workflow ol li').count(),3);
        assert.equal(await page.locator('.creator-continuation ol li').count(),3);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`${locale}/${id}/${width} overflows`);
        if(locale==='en'&&id==='subtitles'){
          await page.getByLabel('Try your own words').fill('The corrected caption.');
          assert.equal(await page.locator('[data-caption-preview]').textContent(),'The corrected caption.');
          await page.getByRole('button',{name:'High contrast',exact:true}).click();
          assert.equal(await page.locator('[data-caption-preview]').getAttribute('data-style'),'2');
        }
        if(locale==='en'&&id==='lip-sync'){
          await page.getByRole('button',{name:'Video',exact:true}).click();
          assert.equal(await page.locator('[data-source-mode]').getAttribute('data-source-mode'),'video');
          assert.match(await page.locator('.creator-mode-explanation').textContent()??'',/passages of equal length/);
        }
        await page.locator('.creator-faq summary').first().click();
        assert.equal(await page.locator('.creator-faq details').first().getAttribute('open'),'');
        await page.locator('.creator-faq summary').first().click();
        assert.ok(await page.locator('.creator-demo img').evaluateAll(nodes=>nodes.every(node=>(node as HTMLImageElement).complete&&(node as HTMLImageElement).naturalWidth>0)),'below-fold artwork must load');
        await page.evaluate(()=>window.scrollTo(0,0));
        if(locale==='en'&&id==='product-video-editor'){
          const control=page.getByRole('slider');await control.focus();await page.keyboard.press('ArrowRight');
          assert.equal(await control.inputValue(),'51');
        }
        if(evidence&&locale==='en')await page.screenshot({path:join(evidence,`${id}-${width}.png`),fullPage:true});
        assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>(window as any).creatorErrors),[]);
      } finally {await page.close();}
    }
    if(evidence){
      const conceptPage=await browser.newPage({viewport:{width:1536,height:1024},reducedMotion:'reduce'});
      try{
        await conceptPage.goto(`${fixture.url}/fr/product-photo-editor`);
        await conceptPage.waitForFunction(()=>!!(window as any).creatorReady);
        await conceptPage.evaluate(()=>document.fonts.ready);
        await conceptPage.locator('.creator-hero-art img').evaluate((node:HTMLImageElement)=>node.decode());
        await conceptPage.screenshot({path:join(evidence,'product-photo-editor-fr-concept-1536.png')});
        await conceptPage.locator('#workflow').evaluate(node=>node.scrollIntoView({block:'start'}));
        await conceptPage.locator('.creator-demo img').evaluateAll(nodes=>Promise.all(nodes.map(node=>(node as HTMLImageElement).decode())));
        await conceptPage.screenshot({path:join(evidence,'product-photo-editor-fr-lower-1536.png')});
      }finally{await conceptPage.close();}
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
