import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import test from 'node:test';
import {chromium,webkit} from '@playwright/test';
import {createMarketingNavigationBrowserFixture} from './helpers/marketing-navigation-browser-fixture';

test('native mobile navigation keeps a small SSR DOM and stable decoration slots', async () => {
  const fixture=await createMarketingNavigationBrowserFixture();
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await page.goto(fixture.url,{waitUntil:'commit'});
    await page.getByRole('button',{name:'Open menu',exact:true}).tap();
    const menu=page.locator('.marketing-menu-overlay');
    const before=await menu.evaluate(node=>({
      bytes:new TextEncoder().encode(node.outerHTML).length,
      elements:node.querySelectorAll('*').length,
      svgCount:node.querySelectorAll('svg').length,
      slots:Array.from(node.querySelectorAll('.marketing-menu-icon')).map(slot=>{const rect=slot.getBoundingClientRect();return [rect.width,rect.height].map(value=>Math.round(value*1000)/1000)}),
    }));
    assert.equal(before.svgCount,0,'decorative SVGs must wait for an observed opening after JS');
    assert.ok(before.elements<=70,`native SSR navigation should stay below 70 elements, got ${before.elements}`);
    assert.ok(before.bytes<=8500,`native SSR navigation should stay below 8.5KB, got ${before.bytes}`);
    assert.deepEqual(before.slots,[[21,21],[21,21],[21,21],...Array.from({length:7},()=>[18,18])]);
    assert.equal(await menu.locator('.marketing-menu-close-icon').evaluate(node=>getComputedStyle(node,'::before').content),'""');
    assert.equal(await menu.locator('.marketing-menu-chevron').first().evaluate(node=>getComputedStyle(node,'::before').content),'""');
    fixture.releaseHydration();
    await page.waitForFunction(()=>!!(window as any).__fixtureHydrated);
    await menu.locator('.marketing-menu-icon svg').first().waitFor();
    const after=await menu.evaluate(node=>({
      svgCount:node.querySelectorAll('svg').length,
      slots:Array.from(node.querySelectorAll('.marketing-menu-icon')).map(slot=>{const rect=slot.getBoundingClientRect();return [rect.width,rect.height].map(value=>Math.round(value*1000)/1000)}),
    }));
    assert.ok(after.svgCount>=11,'opening adopts the rich decorative icons and language control');
    assert.deepEqual(after.slots,before.slots,'enhancement must preserve icon geometry');
    assert.deepEqual(await page.evaluate(()=>(window as any).__fixtureHydrationErrors),[]);
    if(process.env.MARKETING_NAV_EVIDENCE_DIR) {
      await mkdir(process.env.MARKETING_NAV_EVIDENCE_DIR,{recursive:true});
      await writeFile(join(process.env.MARKETING_NAV_EVIDENCE_DIR,'ssr-menu.json'),JSON.stringify({before,after},null,2));
    }
  } finally {await browser.close();await fixture.close()}
});

// Removing the native trigger or reintroducing the pathname mount-close must fail
// this test: one trusted tap precedes loading the actual hydrateRoot bundle.
test('one early mobile tap opens navigation and stays open across delayed hydration', async () => {
  const fixture=await createMarketingNavigationBrowserFixture();
  const browser=await chromium.launch({headless:true});
  const runs:unknown[]=[];
  try {
    for(let run=0;run<3;run+=1) {
      fixture.delayHydration();
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      const page=await context.newPage();
      const errors:string[]=[];
      page.on('pageerror',error=>{errors.push(error.message);console.error(error.message)});
      page.on('console',message=>{if(message.type()==='error')console.error(message.text())});
      await page.goto(fixture.url,{waitUntil:'commit'});
      const opener=page.getByRole('button',{name:'Open menu',exact:true});
      await opener.waitFor({state:'visible'});
      await opener.tap();
      await page.waitForTimeout(150);
      const before=await page.evaluate(()=>({
        open:!!document.querySelector('.marketing-menu-overlay')?.getClientRects().length,
        hydrated:!!(window as any).__fixtureHydrated,
        tap:(window as any).__fixtureTap,
        ssrChars:document.getElementById('root')!.innerHTML.length,
        ssrBytes:(window as any).__fixtureSSRBytes,
        ssrGzipBytes:(window as any).__fixtureSSRGzipBytes,
      }));
      fixture.releaseHydration();
      await page.waitForFunction(()=>!!(window as any).__fixtureHydrated);
      await page.waitForTimeout(150);
      const after=await page.evaluate(()=>({
        open:!!document.querySelector('.marketing-menu-overlay')?.getClientRects().length,
        samples:(window as any).__fixtureOpenSamples,
        hydrationErrors:(window as any).__fixtureHydrationErrors,
        hydrationDuration:(window as any).__fixtureHydrationDuration,
        cls:(window as any).__fixtureLayoutShifts.reduce((sum:number,value:number)=>sum+value,0),
      }));
      // Separate the normal hydrated interaction from the first pre-JS gesture.
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({state:'hidden'});
      await page.waitForFunction(()=>!(document.querySelector('header') as HTMLElement)?.inert);
      await opener.tap();
      await page.getByRole('dialog').waitFor();
      await page.waitForTimeout(50);
      const normal=await page.evaluate(()=>{
        const tap=(window as any).__fixtureTap;
        const first=(window as any).__fixtureOpenSamples.find((sample:any)=>sample.open&&sample.time>=tap.time);
        return {trusted:tap.trusted,openLatencyMs:first?first.time-tap.time:null};
      });
      runs.push({run,before,after,normal,errors});
      await context.close();
    }
    const evidenceDirectory=process.env.MARKETING_NAV_EVIDENCE_DIR;
    if(evidenceDirectory) {await mkdir(evidenceDirectory,{recursive:true});await writeFile(join(evidenceDirectory,'early-tap.json'),JSON.stringify({cssBytes:fixture.cssBytes,runs},null,2))}
    for(const run of runs as any[]) {
      assert.equal(run.before.hydrated,false,'the trusted tap must precede hydration');
      assert.equal(run.before.tap?.trusted,true,'the first gesture must be a browser trusted touch');
      assert.equal(run.before.open,true,'the first tap must open the SSR menu before React runs');
      assert.equal(run.after.open,true,'hydration must preserve the native opening');
      const visibleSamples=run.after.samples.filter((sample:any)=>sample.time>run.before.tap.time+40);
      assert.ok(visibleSamples.length>3);
      assert.ok(visibleSamples.every((sample:any)=>sample.open),'the menu must never flash closed across hydration');
      assert.equal(run.normal.trusted,true);
      assert.notEqual(run.normal.openLatencyMs,null,'the normal hydrated tap must also open');
      assert.deepEqual(run.after.hydrationErrors,[]);
      assert.deepEqual(run.errors,[]);
    }
  } finally {await browser.close();await fixture.close()}
});

test('enhanced mobile navigation contains focus and restores native, CSS and route state', async () => {
  const fixture=await createMarketingNavigationBrowserFixture();
  const browser=await chromium.launch({headless:true});
  try {
    fixture.releaseHydration();
    const page=await browser.newPage({viewport:{width:390,height:620},isMobile:true,hasTouch:true});
    const errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(fixture.url);
    await page.waitForFunction(()=>!!(window as any).__fixtureHydrated);
    const opener=page.getByRole('button',{name:'Open menu',exact:true});
    const menu=page.locator('.marketing-menu-overlay');
    const dialog=page.getByRole('dialog',{name:'Main navigation'});
    const consent=page.getByRole('button',{name:'Consent fixture'});
    assert.ok(await consent.isVisible(),'SSR mounting must leave consent visible while the menu is closed');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflow),'visible');
    await opener.focus();
    await page.keyboard.press('Enter');
    await page.locator('[role="dialog"][aria-modal="true"]').waitFor();
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
    assert.equal(await consent.isVisible(),false,'the open-menu consent selector must apply');
    assert.equal(await page.locator('main').evaluate(node=>(node as HTMLElement).inert),true);
    assert.equal(await page.getByRole('button',{name:'Close menu',exact:true}).evaluate(node=>node===document.activeElement),true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.getByRole('button',{name:'Language',exact:true}).evaluate(node=>node===document.activeElement),true,'backward Tab must wrap within the panel');
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('button',{name:'Close menu',exact:true}).evaluate(node=>node===document.activeElement),true);
    await page.keyboard.press('Escape');
    await menu.waitFor({state:'hidden'});
    await page.waitForFunction(()=>!(document.querySelector('main') as HTMLElement).inert);
    assert.equal(await opener.evaluate(node=>node===document.activeElement),true,'Escape must restore focus to the menu invoker');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflow),'visible');
    assert.equal(await consent.isVisible(),true);

    await opener.tap();
    await dialog.waitFor();
    await page.locator('summary[aria-controls="mobile-examples-panel"]').tap();
    await page.locator('#mobile-examples-panel a[href="/examples/veo"]').waitFor();
    assert.ok(await menu.evaluate(node=>node.scrollHeight>node.clientHeight),'expanded sections must scroll on short screens');
    await page.locator('.marketing-menu-backdrop').tap({position:{x:385,y:10}});
    await menu.waitFor({state:'hidden'});
    await opener.tap();
    await dialog.waitFor();
    assert.equal(await page.locator('details[data-menu-section="examples"]').getAttribute('open'),null,'closing resets section disclosures');
    await page.getByRole('button',{name:'Close menu',exact:true}).tap();
    await menu.waitFor({state:'hidden'});
    await opener.tap();
    await dialog.waitFor();
    await dialog.locator('a[href="/pricing"]').click();
    assert.match(page.url(),/\/pricing$/,'the real menu link must reach its destination');
    await menu.waitFor({state:'hidden'});
    await opener.tap();
    await dialog.waitFor();
    await page.goBack();
    await menu.waitFor({state:'hidden'});
    assert.equal(new URL(page.url()).pathname,'/');
    await opener.tap();
    await dialog.waitFor();
    await page.setViewportSize({width:1280,height:900});
    await menu.waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflow),'visible');
    assert.deepEqual(errors,[]);
    assert.deepEqual(await page.evaluate(()=>(window as any).__fixtureHydrationErrors),[]);
  } finally {await browser.close();await fixture.close()}
});

test('SSR navigation and native disclosures work without JavaScript in all public locales', async () => {
  const fixture=await createMarketingNavigationBrowserFixture();
  const browser=await chromium.launch({headless:true});
  try {
    fixture.releaseHydration();
    for(const [path,openLabel,closeLabel,modelsLabel,modelsHref,pricingHref] of [
      ['/','Open menu','Close menu','Models','/models','/pricing'],
      ['/fr','Ouvrir le menu','Fermer le menu','Modèles','/fr/modeles','/fr/tarifs'],
      ['/es','Abrir menú','Cerrar menú','Modelos','/es/modelos','/es/precios'],
    ]) {
      const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      const page=await context.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(fixture.url+path);
      const opener=page.getByRole('button',{name:openLabel,exact:true});
      await opener.tap();
      const dialog=page.getByRole('dialog');
      await dialog.waitFor();
      assert.equal(await dialog.getAttribute('aria-modal'),null,'native popovers must keep their non-modal semantics before JS');
      assert.equal(await page.locator('.cookie-consent-overlay').isVisible(),false);
      await page.waitForTimeout(250); // Let the native panel entrance animation finish before the no-JS actionability check.
      await dialog.locator('summary[aria-controls="mobile-models-panel"]').tap();
      assert.equal(await dialog.locator(`a[href="${modelsHref}"]`).isVisible(),true,modelsLabel+' overview must remain native and crawlable');
      assert.equal(await dialog.locator(`a[href="${pricingHref}"]`).isVisible(),true);
      await page.getByRole('button',{name:closeLabel,exact:true}).tap();
      await dialog.waitFor({state:'hidden'});
      assert.equal(await page.locator('.cookie-consent-overlay').isVisible(),true);
      await opener.focus();
      await page.keyboard.press('Space');
      await dialog.waitFor();
      await page.keyboard.press('Escape');
      await dialog.waitFor({state:'hidden'});
      await opener.tap();
      await page.waitForTimeout(250);
      await dialog.locator(`a[href="${pricingHref}"]`).tap();
      await page.waitForURL(fixture.url+pricingHref);
      assert.equal(await page.getByRole('dialog').isVisible(),false,'a full-page native navigation must start with a closed menu');
      await context.close();
    }
  } finally {await browser.close();await fixture.close()}
});

test('the authored no-Popover CSS fallback exposes SSR links and leaves consent available', async () => {
  const fixture=await createMarketingNavigationBrowserFixture({forcePopoverFallback:true});
  const browser=await chromium.launch({headless:true});
  try {
    fixture.releaseHydration();
    const page=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});
    await page.goto(fixture.url);
    assert.equal(await page.getByRole('button',{name:'Open menu',exact:true}).isVisible(),false,'unsupported-engine fallback must avoid an inert toggle');
    const dialog=page.getByRole('dialog');
    assert.equal(await dialog.isVisible(),true,'the fallback keeps mobile destinations reachable without an API');
    assert.equal(await dialog.getAttribute('aria-modal'),null);
    await dialog.locator('summary[aria-controls="mobile-models-panel"]').click();
    assert.equal(await dialog.locator('a[href="/models"]').isVisible(),true);
    assert.equal(await page.locator('.cookie-consent-overlay').isVisible(),true,'the non-overlay fallback must leave consent available');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflow),'visible');
    await page.setViewportSize({width:1280,height:900});
    assert.equal(await dialog.isVisible(),false,'the static fallback remains mobile-only');
    const enhanced=await browser.newPage({viewport:{width:390,height:844}});
    await enhanced.addInitScript(()=>{Object.defineProperty(HTMLElement.prototype,'showPopover',{value:undefined})});
    await enhanced.goto(fixture.url);
    await enhanced.waitForFunction(()=>!!(window as any).__fixtureHydrated);
    await enhanced.getByRole('dialog').getByRole('button',{name:'Language',exact:true}).waitFor();
    assert.equal(await enhanced.getByRole('dialog').getAttribute('aria-modal'),null,'enhancing the static fallback must not make it modal');
    assert.equal(await enhanced.locator('main').evaluate(node=>(node as HTMLElement).inert),false);
    assert.equal(await enhanced.evaluate(()=>getComputedStyle(document.body).overflow),'visible');
  } finally {await browser.close();await fixture.close()}
});

// Quality CI installs Chromium; opt into the additional installed WebKit check.
if (process.env.MARKETING_NAV_WEBKIT === '1') test('WebKit preserves a trusted native opening across hydration and restores focus on Escape', async () => {
  const fixture=await createMarketingNavigationBrowserFixture();
  const browser=await webkit.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(fixture.url,{waitUntil:'commit'});
    const opener=page.getByRole('button',{name:'Open menu',exact:true});
    await opener.tap();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.getByRole('dialog').getAttribute('aria-modal'),null);
    fixture.releaseHydration();
    await page.waitForFunction(()=>!!(window as any).__fixtureHydrated);
    await page.locator('[role="dialog"][aria-modal="true"]').waitFor();
    const evidence=await page.evaluate(()=>({tap:(window as any).__fixtureTap,samples:(window as any).__fixtureOpenSamples,errors:(window as any).__fixtureHydrationErrors}));
    assert.equal(evidence.tap.trusted,true);
    assert.ok(evidence.samples.filter((sample:any)=>sample.time>evidence.tap.time+40).every((sample:any)=>sample.open));
    assert.deepEqual(evidence.errors,[]);
    assert.deepEqual(errors,[]);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.waitForFunction(()=>!(document.querySelector('main') as HTMLElement).inert);
    assert.equal(await opener.evaluate(node=>node===document.activeElement),true);
  } finally {await browser.close();await fixture.close()}
});

test('shared navigation popover keeps viewport geometry and focus outside marketing page styling', async () => {
  const fixture=await createMarketingNavigationBrowserFixture({marketingSite:false});
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    await page.goto(fixture.url,{waitUntil:'commit'});
    await page.getByRole('button',{name:'Open menu',exact:true}).tap();
    const menu=page.locator('.marketing-menu-overlay');
    assert.deepEqual(await menu.evaluate(node=>{const rect=node.getBoundingClientRect();return [rect.x,rect.y,rect.width,rect.height]}),[0,0,390,844]);
    fixture.releaseHydration();
    await page.waitForFunction(()=>!!(window as any).__fixtureHydrated);
    await page.locator('[role="dialog"][aria-modal="true"]').waitFor();
    assert.equal(await page.getByRole('button',{name:'Close menu',exact:true}).evaluate(node=>node===document.activeElement),true);
    await page.keyboard.press('Escape');
    await menu.waitFor({state:'hidden'});
    await page.waitForFunction(()=>!(document.querySelector('main') as HTMLElement).inert);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflow),'visible');
    assert.deepEqual(await page.evaluate(()=>(window as any).__fixtureHydrationErrors),[]);
  } finally {await browser.close();await fixture.close()}
});
