const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const b=await chromium.launch({headless:true});
 let p=await b.newPage({viewport:{width:1113,height:998}});
 const report={routes:[],legacy:[],gallery:{},errors:[],consoleErrors:[]};
 p.on('pageerror',e=>report.errors.push(e.message));
 p.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
 for(const slug of ['seedream-5-5','seedance-2-5-flash']) for(const prefix of ['/models/','/fr/modeles/','/es/modelos/']){
  const path=prefix+slug;
  const response=await p.goto('http://localhost:3116'+path,{waitUntil:'networkidle',timeout:90000});
  assert.equal(response.status(),200); assert.equal(await p.locator('h1').count(),1);
  assert.equal(await p.locator('.model-cinematic-page').count(),1);
  const canonical=await p.locator('link[rel=canonical]').getAttribute('href');
  assert.equal(canonical,'https://maxvideoai.com'+path);
  assert.equal(await p.locator('link[rel=alternate][hreflang]').count(),4);
  const schemas=await p.locator('script[type="application/ld+json"]').allTextContents();schemas.forEach(JSON.parse);
  assert(await p.locator('.cinema-spec-table th[scope=row]').count()>0);
  const href=await p.locator('.cinema-milo-bar').getAttribute('href');assert(href.includes('engine='+slug)&&href.includes('assistant=milo'));
  report.routes.push({path,status:200,canonical,alternates:4,schemas:schemas.length});
 }
 for(const slug of ['seedream-5-0-pro','seedance-2-5','kling-3-pro']){
  const response=await p.goto('http://localhost:3116/models/'+slug,{waitUntil:'networkidle',timeout:90000});
  assert.equal(response.status(),200);assert.equal(await p.locator('.model-cinematic-page').count(),0);
  report.legacy.push({slug,status:200,cinematic:false});
 }
 await p.close();p=await b.newPage({viewport:{width:1113,height:998}});
 p.on('pageerror',e=>report.errors.push(e.message));
 const requests=[];p.on('request',r=>{if(/\.mp4(?:\?|$)/.test(r.url()))requests.push(r.url())});
 await p.goto('http://localhost:3116/models/seedance-2-5-flash',{waitUntil:'networkidle',timeout:90000});
 assert.equal(requests.length,0);
 const g=p.locator('#rendered-examples');await g.scrollIntoViewIfNeeded();
 await p.waitForFunction(()=>[...document.querySelectorAll('#rendered-examples img')].every(n=>n.complete&&n.naturalWidth>0));
 assert.equal(await g.locator('figure').count(),4);assert.equal(await g.locator('video[preload=none]').count(),4);
 assert.equal(await g.locator('[aria-pressed]').count(),0);assert.equal(await g.locator('a[href*="byteplus"]').count(),0);
 const sizes=await g.locator('.cinema-gallery-image').evaluateAll(ns=>ns.map(n=>({width:n.clientWidth,height:n.clientHeight})));
 for(let i=0;i<4;i++){
  await g.locator('.cinema-prompt-trigger').nth(i).click();const d=p.locator('dialog[open]');
  assert((await d.locator('.cinema-prompt-text').innerText()).length>3000);
  const use=await d.locator('[data-analytics-cta-name=reuse_example]').getAttribute('href');assert(use.includes('videoPrompt=')&&!use.includes('from='));
  const refine=await d.locator('[data-analytics-cta-name=milo_try]').getAttribute('href');assert(refine.includes('assistant=milo'));
  await p.keyboard.press('Escape');assert.equal(await p.locator('dialog[open]').count(),0);
 }
 report.gallery={cards:4,initialVideoRequests:0,dialogs:4,noFilters:true,documentationLink:false,sizes};
 await p.setViewportSize({width:390,height:844});await g.scrollIntoViewIfNeeded();
 const rail=g.locator('.cinema-gallery-rail');await rail.evaluate(n=>n.scrollTo({left:0,behavior:'instant'}));
 await p.waitForFunction(()=>document.querySelector('[aria-label="Next examples"]')?.disabled===false);
 await g.getByRole('button',{name:'Next examples',exact:true}).click();await p.waitForTimeout(700);
 assert(await rail.evaluate(n=>n.scrollLeft)>0);assert.equal(await p.evaluate(()=>document.body.scrollWidth),390);
 report.gallery.mobileOverflow=false;report.gallery.horizontalScroll=true;
 await p.goto('http://localhost:3116/examples/seedance',{waitUntil:'networkidle',timeout:90000});
 assert((await p.locator('a[href*="review-flash-"]').count())>=4);report.gallery.familyPage=true;
 await p.goto('http://localhost:3116/video/review-flash-above-the-city',{waitUntil:'networkidle',timeout:90000});
 assert.equal(await p.locator('video').count(),1);assert((await p.locator('meta[name=robots]').getAttribute('content')).includes('noindex'));
 report.gallery.reviewWatchNoindex=true;
 fs.writeFileSync('docs/redesign/evidence/20261116-gallery/browser-qa.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
