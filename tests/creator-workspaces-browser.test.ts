import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createCreatorWorkspaceFixture } from './helpers/creator-workspace-browser-fixture';
test('five localized workspaces expose usable empty states on mobile and desktop without any API calls',async()=>{
  const fixture=await createCreatorWorkspaceFixture(),browser=await chromium.launch({headless:true}),evidence=process.env.CREATOR_WORKSPACE_EVIDENCE_DIR;
  if(evidence)await mkdir(evidence,{recursive:true});
  try{for(const locale of ['en','fr','es'])for(const tool of ['subtitles','lip-sync','product-photo-editor','product-video-editor','motion-transfer'])for(const width of [390,1440]){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    try{
      await page.goto(`${fixture.url}/${locale}/${tool}`);await page.locator('h1').waitFor({timeout:5000}).catch(error=>{throw new Error(`${locale}/${tool}: ${errors.join('; ')} ${error.message}`);});
      assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('video,audio').count(),0);assert.equal(await page.locator('img').count(),1);assert.match(await page.locator('img').getAttribute('src') ?? '',new RegExp(`/creator-art/${tool}-`));
      await page.locator('img').evaluate(image => image.decode());
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${locale}/${tool}/${width} overflow`);
      assert.ok(await page.locator('input[type=file]').count()>0);assert.ok(await page.locator('button:disabled').count()>0);
      const controls=await page.locator('input[type=file]:visible').evaluateAll(nodes=>nodes.map(node=>({label:node.getAttribute('aria-label'),height:node.getBoundingClientRect().height})));
      for(const control of controls){assert.ok(control.label);assert.ok(control.height>=44);}
      if(locale==='en'&&tool==='lip-sync'){await page.getByRole('button',{name:'Video',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Video',exact:true}).getAttribute('aria-pressed'),'true');}
      if(locale==='en'&&tool==='product-photo-editor'){await page.getByRole('button',{name:'Lighting',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Lighting',exact:true}).getAttribute('aria-pressed'),'true');await page.locator('summary').filter({hasText:'Advanced options'}).click();assert.equal(await page.getByLabel('Image model',{exact:true}).inputValue(),'gpt-image-2-5-flare');}
      if(evidence&&locale==='fr')await page.screenshot({path:join(evidence,`${tool}-${width}.png`),fullPage:true});
      assert.deepEqual(errors,[]);
    }finally{await page.close();}
  }}finally{await browser.close();await fixture.close();}
});
