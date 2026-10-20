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
        assert.equal(await page.locator('video,audio').count(),id === 'subtitles' ? 1 : ['lip-sync','product-video-editor','motion-transfer'].includes(id) ? 2 : 0);
        assert.equal(await page.locator('script[type="application/ld+json"]').count(),0,'unreleased design preview cannot advertise a service');
        assert.equal(await page.locator('a[href^="/app/tools"]').count(),2);
        assert.equal(await page.locator('.creator-preview-status').count(),0);
        const heroArt = page.locator('.creator-hero-art img');
        if (id === 'subtitles' || id === 'lip-sync') {
          assert.equal(await heroArt.getAttribute('loading'),'eager');
          assert.equal(await heroArt.getAttribute('fetchpriority'),'high');
          assert.ok(await heroArt.evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0),'hero art must load');
        } else {
          assert.equal(await heroArt.count(),0,'real demo pages do not repeat conceptual hero artwork');
        }
        assert.equal(await page.locator('img[fetchpriority="high"],link[rel="preload"][as="image"][fetchpriority="high"]').count(),1);
        assert.equal(await page.locator('#workflow ol li').count(),3);
        assert.equal(await page.locator('.creator-continuation ol li').count(),3);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`${locale}/${id}/${width} overflows`);
        assert.ok(await page.locator('.creator-related a').evaluateAll(links=>links.every(link=>{
          const card=link.getBoundingClientRect(),art=link.querySelector('.creator-tool-mark')!.getBoundingClientRect(),label=link.querySelector('span')!.getBoundingClientRect();
          return label.top>=art.bottom&&label.bottom<=card.bottom+1;
        })),`${locale}/${id}/${width} related labels must remain within their cards`);
        if(locale==='en'&&id==='subtitles'){
          assert.equal(await page.getByRole('button',{name:'Pop',exact:true}).getAttribute('aria-pressed'),'true');
          await page.getByRole('button',{name:'Contrast',exact:true}).click();
          assert.match(await page.locator('video').getAttribute('src')??'',/high-contrast/);
          assert.equal(await page.locator('video').getAttribute('preload'),'none');
        }
        if(locale==='en'&&id==='lip-sync'){
          assert.equal(await page.locator('audio').getAttribute('preload'),'none');
          assert.equal(await page.locator('video').getAttribute('preload'),'none');
          assert.match(await page.locator('.creator-lip-voice').textContent()??'',/last train tonight/);
        }
        await page.locator('.creator-faq summary').first().click();
        assert.equal(await page.locator('.creator-faq details').first().getAttribute('open'),'');
        await page.locator('.creator-faq summary').first().click();
        assert.ok(await page.locator('.creator-demo img').evaluateAll(nodes=>nodes.every(node=>(node as HTMLImageElement).complete&&(node as HTMLImageElement).naturalWidth>0)),'below-fold artwork must load');
        await page.evaluate(()=>window.scrollTo(0,0));
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
        await conceptPage.locator('.creator-photo-diptych img').evaluateAll(nodes=>Promise.all(nodes.map(node=>(node as HTMLImageElement).decode())));
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

test('recorded comparisons defer every MP4 until Play and download the exact generated result', async () => {
  const fixture = await createCreatorMarketingFixture();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const id of ['lip-sync', 'product-video-editor', 'motion-transfer']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      const videoRequests: string[] = [];
      page.on('request', request => { if (/\.(?:mp4|mp3|wav)(?:\?|$)/.test(request.url())) videoRequests.push(request.url()); });
      try {
        await page.goto(`${fixture.url}/en/${id}`);
        await page.waitForFunction(() => !!(window as any).creatorReady);
        await page.locator('.creator-demo').scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
        assert.deepEqual(videoRequests, [], `${id} must not transfer video before a gesture`);
        const players = page.locator('.creator-result-video');
        for (let index = 0; index < await players.count(); index += 1) {
          const player = players.nth(index), video = player.locator('video');
          const src = await video.getAttribute('src');
          await player.getByRole('button', { name: /^Play — / }).click();
          await page.waitForFunction((label) => {
            const video = document.querySelector(`video[aria-label="${label}"]`) as HTMLVideoElement | null;
            return !!video && video.readyState >= 2 && video.videoWidth > 0 && video.currentTime > 0.05;
          }, await video.getAttribute('aria-label'));
          assert.ok(videoRequests.some(url => url.endsWith(src!)), 'Play requests this original');
          assert.equal(await video.getAttribute('src'), src, 'comparison remains on Original');
          await player.getByRole('button', { name: /^Pause — / }).click();
          assert.equal(await video.evaluate(node => (node as HTMLVideoElement).paused), true);
        }
        if (id === 'lip-sync') {
          const voice = page.locator('audio');
          await voice.evaluate(node => (node as HTMLAudioElement).play());
          await page.waitForFunction(() => (document.querySelector('audio')?.currentTime ?? 0) > 0.05);
          assert.ok(await voice.evaluate(node => (node as HTMLAudioElement).duration) >= 8);
          await players.first().getByRole('button', { name: /^Play — / }).click();
          await page.waitForFunction(() => document.querySelector('audio')?.paused === true);
          assert.ok(await players.first().locator('video').evaluate(node => (node as HTMLVideoElement).duration) >= 8);
          await players.first().getByRole('button', { name: /^Pause — / }).click();
        }
        const resultSrc = await players.last().locator('video').getAttribute('src');
        const download = page.locator('.creator-result-download');
        assert.equal(await download.getAttribute('href'), resultSrc);
        const response = await page.request.get(`${fixture.url}${resultSrc}`, { headers: { Range: 'bytes=0-1023' } });
        assert.equal(response.status(), 206);
        assert.equal(response.headers()['content-type'], 'video/mp4');
        assert.equal((await response.body()).length, 1024);
        assert.match(response.headers()['content-range'], /^bytes 0-1023\/\d+$/);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); await fixture.close(); }
});
