import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import {chromium} from '@playwright/test';
import {MARKETING_NAV_DROPDOWNS,MARKETING_SITE_NAV_LINKS} from '../frontend/config/navigation';
import {createMarketingNavigationBrowserFixture} from './helpers/marketing-navigation-browser-fixture';

test('closed desktop panels keep their complete SSR link roster and render decorations on opening', async () => {
  const dictionary=JSON.parse(readFileSync('frontend/messages/en.json','utf8'));
  const translate=(key:string,fallback:string)=>key.split('.').reduce((value,part)=>value?.[part],dictionary)??fallback;
  const href=(value:any)=>typeof value==='string'?value:Object.entries(value.params??{}).reduce((path,[key,param])=>path.replace(`[${key}]`,String(param)),value.pathname);
  const expected=MARKETING_SITE_NAV_LINKS.flatMap(item=>{
    const dropdown=MARKETING_NAV_DROPDOWNS[item.key];
    if(!dropdown)return [];
    return [{id:`marketing-${item.key}-dropdown`,links:[
      {href:href(dropdown.allHref),label:translate(dropdown.allLabelKey,dropdown.allLabelFallback),badge:null,description:null},
      ...dropdown.items.map(entry=>({href:href(entry.href),label:translate(`nav.dropdown.${item.key}.items.${entry.key}`,entry.label),badge:entry.badge?translate(`nav.badges.${entry.badge}`,entry.badge):null,description:entry.description?translate(`nav.dropdown.${item.key}.descriptions.${entry.key}`,entry.description):null})),
      ...(dropdown.sections??[]).flatMap(section=>section.items.map(entry=>({href:href(entry.href),label:translate(`nav.dropdown.${item.key}.sections.${section.key}.items.${entry.key}`,entry.label),badge:null,description:null}))),
    ]}];
  });
  const fixture=await createMarketingNavigationBrowserFixture();
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    const errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(fixture.url,{waitUntil:'commit'});
    const panels=page.locator('.marketing-mega-menu');
    const roster=()=>panels.evaluateAll(nodes=>nodes.map(node=>({id:node.id,links:Array.from(node.querySelectorAll('a')).map(link=>({
      href:link.getAttribute('href'),
      label:(link.querySelector('.marketing-entry-content > span:not([aria-hidden]):not(.marketing-new-badge)')?.textContent??link.childNodes[0]?.textContent??'').trim(),
      badge:link.querySelector('.marketing-new-badge')?.textContent?.trim()??null,
      description:link.querySelector('small')?.textContent?.trim()??null,
    }))})));
    assert.deepEqual(await roster(),expected,'all destinations, translated labels, badges and descriptions must exist before JS');
    const before=await panels.evaluateAll(nodes=>({
      bytes:nodes.reduce((sum,node)=>sum+new TextEncoder().encode(node.outerHTML).length,0),
      elements:nodes.reduce((sum,node)=>sum+node.querySelectorAll('*').length,0),
      decorations:nodes.reduce((sum,node)=>sum+node.querySelectorAll('img, svg, [role="img"], .marketing-entry-picto, .marketing-entry-pair').length,0),
    }));
    const ssr=await page.evaluate(()=>({bytes:(window as any).__fixtureSSRBytes,gzipBytes:(window as any).__fixtureSSRGzipBytes,hydrated:!!(window as any).__fixtureHydrated}));
    assert.equal(ssr.hydrated,false,'the roster and decoration budget must be measured before hydration');
    assert.equal(before.decorations,0,'closed SSR desktop panels must omit their invisible decorative DOM');
    assert.equal(await page.locator('.marketing-nav-trigger > svg').count(),expected.length,'visible main triggers retain their native arrows');
    fixture.releaseHydration();
    await page.waitForFunction(()=>!!(window as any).__fixtureHydrated);
    for(const {id} of expected) {
      const trigger=page.locator(`button[aria-controls="${id}"]`);
      const panel=page.locator(`#${id}`);
      await trigger.focus();
      await page.keyboard.press('ArrowDown');
      await panel.waitFor({state:'visible'});
      assert.ok(await panel.locator('.marketing-entry-content img, .marketing-entry-content svg, .marketing-entry-content [role="img"]').count()>0,'visible panels render their original entry decoration');
      assert.ok(await panel.locator('.lucide-arrow-up-right').count()>0,'panel action arrows appear with the panel');
      assert.deepEqual(await roster(),expected,'enhancement must preserve the complete link roster');
      await page.keyboard.press('Tab');
      assert.equal(await panel.evaluate(node=>node.contains(document.activeElement)),true,'Tab enters the open panel');
      await page.keyboard.press('Escape');
      await panel.waitFor({state:'hidden'});
      assert.equal(await trigger.evaluate(node=>node===document.activeElement),true,'Escape restores trigger focus');
      assert.equal(await panel.locator('img, svg, [role="img"], .marketing-entry-picto, .marketing-entry-pair').count(),0);
    }
    assert.deepEqual(errors,[]);
    assert.deepEqual(await page.evaluate(()=>(window as any).__fixtureHydrationErrors),[]);
    if(process.env.MARKETING_NAV_EVIDENCE_DIR) {
      const {mkdir,writeFile}=await import('node:fs/promises');
      await mkdir(process.env.MARKETING_NAV_EVIDENCE_DIR,{recursive:true});
      await writeFile(join(process.env.MARKETING_NAV_EVIDENCE_DIR,'desktop-decoration.json'),JSON.stringify({before,ssr,cssBytes:fixture.cssBytes,links:expected.reduce((sum,panel)=>sum+panel.links.length,0),panels:expected.length},null,2));
    }
  } finally {await browser.close();await fixture.close()}
});

// The native mobile owner must not cause the CSS-hidden desktop model roster to
// render again. Real browser behavior also covers details/popover, absent in JSDOM.
test('mobile actions skip unchanged desktop menus while desktop state and locale still update', async () => {
  const fixture=await createMarketingNavigationBrowserFixture();
  const browser=await chromium.launch({headless:true});
  try {
    fixture.releaseHydration();
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(fixture.url);
    await page.waitForFunction(()=>!!(window as any).__fixtureHydrated);
    const countReads=()=>page.evaluate(()=>(window as any).__fixtureModelLabelReads);
    const before=await countReads();
    assert.ok(before>0,'desktop model links must be rendered initially while their panel is closed');
    await page.getByRole('button',{name:'Open menu',exact:true}).tap();
    await page.locator('[role="dialog"][aria-modal="true"]').waitFor();
    assert.equal(await countReads(),before,'opening mobile navigation must not rebuild the hidden desktop model links');
    await page.locator('summary[aria-controls="mobile-examples-panel"]').tap();
    await page.locator('#mobile-examples-panel a[href="/examples/veo"]').waitFor();
    assert.ok(await page.locator('#mobile-examples-panel a[href="/examples"]').isVisible());
    assert.ok(await page.locator('#mobile-examples-panel .marketing-entry-content img').count()>0,'mobile entries retain their decoration by default');
    assert.equal(await countReads(),before,'expanding a mobile section must leave desktop model links untouched');
    await page.getByRole('button',{name:'Close menu',exact:true}).tap();
    await page.locator('.marketing-menu-overlay').waitFor({state:'hidden'});
    assert.equal(await countReads(),before);

    await page.setViewportSize({width:1280,height:900});
    await page.locator('button[aria-controls="marketing-models-dropdown"]').click();
    assert.equal(await page.locator('#marketing-models-dropdown').getAttribute('hidden'),null);
    assert.ok(await countReads()>before,'desktop state still invalidates its own menu');
    await page.locator('#marketing-models-dropdown a[href="/models"]').first().click();
    await page.locator('#marketing-models-dropdown').waitFor({state:'hidden'});
    await page.evaluate(()=>(window as any).__fixtureSetLocale('fr'));
    await page.waitForFunction(()=>document.documentElement.lang==='fr');
    assert.match(await page.locator('button[aria-controls="marketing-models-dropdown"]').textContent()??'',/Modèles/);
    assert.ok(await page.locator('button[aria-controls="marketing-models-dropdown"]').evaluate(node=>node.classList.contains('is-active')));
    assert.deepEqual(errors,[]);
    assert.deepEqual(await page.evaluate(()=>(window as any).__fixtureHydrationErrors),[]);
  } finally {await browser.close();await fixture.close()}
});
