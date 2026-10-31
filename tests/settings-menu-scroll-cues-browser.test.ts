import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit, expect, type Page } from '@playwright/test';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';
import { settingsMenuScrollCuesSource } from './helpers/settings-menu-scroll-cues-browser-source';

const text = { en: 'More options', fr: 'Plus d’options', es: 'Más opciones' };
const cue = (page: Page, direction: 'up' | 'down') => page.locator(`[data-menu-scroll-cue="${direction}"]`);
const settle = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
const scroll = async (page: Page, top: number | 'end') => {
  await page.getByRole('listbox').evaluate((node, target) => { node.scrollTop = target === 'end' ? node.scrollHeight : target; }, top);
  await settle(page);
};

test('real duration menus reveal remaining options without hover, layout movement or value changes', { timeout: 180000 }, async () => {
  const fixture = await startWorkspaceReferenceFixture({ source: settingsMenuScrollCuesSource, config: {} });
  const evidence = process.env.SETTINGS_SCROLL_CUES_EVIDENCE_DIR;
  if (evidence) await mkdir(evidence, { recursive: true });
  const measurements: unknown[] = [];
  try {
    for (const name of ['chromium', 'webkit'] as const) {
      const browser = await (name === 'chromium' ? chromium : webkit).launch({ headless: true });
      try {
        const cases = [];
        for (const width of [1440, 320, 390]) for (const locale of ['fr', 'en', 'es'] as const) {
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          const errors: string[] = [], requests: string[] = [];
          page.on('pageerror', e => errors.push(e.message));
          await page.route('**/*', route => {
            const r = route.request();
            if (r.method() !== 'GET' || new URL(r.url()).origin !== fixture.url) { requests.push(r.method()+' '+r.url()); return route.abort(); }
            return route.continue();
          });
          await page.goto(fixture.url+'/?locale='+locale);
          const trigger = page.getByRole('button', { name: new RegExp('^'+({fr:'Durée',en:'Duration',es:'Duración'}[locale])+':') });
          const bar = page.locator('[data-settings-density]');
          const closedBar = await bar.boundingBox();
          await trigger.click(); await page.mouse.move(0, 0); await settle(page);
          const list = page.getByRole('listbox');
          await expect(list.getByRole('option')).toHaveCount(13);
          const bounds = await list.evaluate(n => ({height:n.clientHeight,content:n.scrollHeight,top:n.scrollTop}));
          assert.ok(bounds.content > bounds.height, 'actual CSS produces overflow');
          if (evidence && locale === 'fr') await page.screenshot({ path: evidence+'/'+name+'-'+width+'-duration-top.png', fullPage: true });
          cases.push({page,trigger,bar,closedBar,list,name,width,locale,errors,requests,bounds});
        }
        // Capture real desktop/mobile RED evidence before checking the missing cue.
        for (const c of cases) {
          const {page,trigger,bar,closedBar,list,width,locale,errors,requests,bounds} = c;
          await expect(cue(page,'down')).toBeVisible();
          await expect(cue(page,'down')).toHaveText(text[locale]+' ↓');
          await expect(cue(page,'up')).toBeHidden();
          const initialMenu = await list.locator('..').boundingBox();
          assert.deepEqual(await bar.boundingBox(), closedBar, 'opening cues cannot grow the settings bar');
          await scroll(page, 120); await expect(cue(page,'up')).toBeVisible(); await expect(cue(page,'down')).toBeVisible();
          assert.deepEqual(await list.locator('..').boundingBox(), initialMenu, 'internal scroll cannot move or resize the portal');
          await scroll(page,'end'); await expect(cue(page,'down')).toBeHidden(); await expect(cue(page,'up')).toBeVisible();
          assert.deepEqual(await list.locator('..').boundingBox(), initialMenu);
          assert.equal(await page.locator('[data-selected]').textContent(), '6');
          if (evidence && locale==='fr') await page.screenshot({path:evidence+'/'+name+'-'+width+'-duration-end.png',fullPage:true});
          await trigger.focus(); await page.keyboard.press('Escape'); await expect(list).toHaveCount(0); await expect(trigger).toBeFocused();
          await page.keyboard.press('ArrowDown'); await expect(list).toBeVisible();
          // Opening with ArrowDown can also advance the current highlight; follow
          // the visible affordance instead of assuming a private initial index.
          for (let i=0;i<13 && await cue(page,'down').isVisible();i++) {
            await page.keyboard.press('ArrowDown'); await settle(page);
          }
          await expect(cue(page,'down')).toBeHidden(); await expect(cue(page,'up')).toBeVisible();
          await page.keyboard.press('Enter'); await expect(list).toHaveCount(0); await expect(trigger).toBeFocused();
          assert.equal(await page.locator('[data-selected]').textContent(),'15');
          assert.deepEqual(await page.evaluate(()=>globalThis.selections),[15]);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
          assert.deepEqual(errors,[]); assert.deepEqual(requests,[]);
          measurements.push({name,width,locale,bounds,initialMenu,closedBar});
        }
      } finally { await browser.close(); }
    }
  } finally {
    if (evidence) await writeFile(evidence+'/measurements.json',JSON.stringify(measurements,null,2));
    await fixture.close();
  }
});

test('the custom Audio voice picker uses the same honest cues without touching voice or sample controls', {timeout:120000}, async () => {
  const fixture=await startWorkspaceReferenceFixture({source:settingsMenuScrollCuesSource,config:{}});
  try {
    for(const name of ['chromium','webkit'] as const) {
      const browser=await(name==='chromium'?chromium:webkit).launch({headless:true});
      try {
        for(const width of [320,390,1440]) for(const locale of ['en','fr','es'] as const) {
          const page=await browser.newPage({viewport:{width,height:1000}});
          const errors:string[]=[],requests:string[]=[];
          page.on('pageerror',e=>errors.push(e.message));
          await page.route('**/*',route=>{
            const r=route.request();
            if(r.method()!=='GET'||new URL(r.url()).origin!==fixture.url){requests.push(r.method()+' '+r.url());return route.abort();}
            return route.continue();
          });
          await page.goto(fixture.url+'/?surface=voice&locale='+locale);
          const summary=page.locator('summary').first();
          await summary.focus(); await page.keyboard.press('Enter'); await page.mouse.move(0,0);
          const list=page.getByRole('listbox'), viewport=list.locator(':scope > div[class*="overflow-y-auto"]');
          await expect(cue(page,'down')).toBeVisible(); await expect(cue(page,'down')).toHaveText(text[locale]+' ↓');
          await expect(cue(page,'up')).toBeHidden();
          const bounds=await list.boundingBox();
          assert.ok(bounds && bounds.x>=0 && bounds.x+bounds.width<=width+1 && bounds.y>=0 && bounds.y+bounds.height<=1000);
          const voices=await list.getByRole('option').allTextContents();
          assert.ok(voices.length>10);
          await viewport.evaluate(n=>{n.scrollTop=120;});await settle(page);
          await expect(cue(page,'up')).toBeVisible();await expect(cue(page,'down')).toBeVisible();
          assert.deepEqual(await list.boundingBox(),bounds);
          await list.getByRole('option').last().focus(); await settle(page);
          await expect(cue(page,'down')).toBeHidden();await expect(cue(page,'up')).toBeVisible();
          assert.deepEqual(await list.boundingBox(),bounds);
          assert.deepEqual(await list.getByRole('option').allTextContents(),voices);
          assert.equal(await list.locator('[role="option"][aria-selected="true"]').count(),1);
          assert.deepEqual(await page.evaluate(()=>globalThis.selections),[]);
          await list.getByRole('option').last().press('Enter'); await expect(list).toBeHidden();
          assert.equal((await page.evaluate(()=>globalThis.selections)).length,1);
          await summary.focus();await page.keyboard.press('Space');await expect(list).toBeVisible();
          await page.keyboard.press('Space');await expect(list).toBeHidden();
          assert.equal(await page.evaluate(()=>globalThis.hostSubmissions??0),0,'summary activation never submits its host form');
          await page.getByRole('button',{name:'Toggle short options'}).click();await summary.click();
          await expect(list.getByRole('option')).toHaveCount(1);await expect(cue(page,'down')).toHaveCount(0);await expect(cue(page,'up')).toHaveCount(0);
          assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
          await page.close();
        }
      } finally {await browser.close();}
    }
  } finally {await fixture.close();}
});

test('shared Image, Audio and advanced menus keep short lists honest; filtered menus retain keyboard and disabled values', {timeout:120000}, async () => {
  const fixture=await startWorkspaceReferenceFixture({source:settingsMenuScrollCuesSource,config:{}});
  const browser=await chromium.launch({headless:true});
  try {
    for(const surface of ['image','audio','advanced','search']) {
      const page=await browser.newPage({viewport:{width:390,height:1000}});
      await page.goto(fixture.url+'/?surface='+surface+'&locale=es');
      const trigger=page.locator('button[aria-haspopup="listbox"]').first();
      await trigger.click(); await page.mouse.move(0,0);
      await expect(cue(page,'down')).toBeVisible(); await expect(cue(page,'down')).toHaveText(text.es+' ↓');
      const list=page.getByRole('listbox');
      if(surface==='search') {
        const input=page.getByPlaceholder('Search...');
        await input.fill('20'); await expect(list.getByRole('option')).toHaveCount(1);
        await expect(cue(page,'down')).toHaveCount(0); await expect(cue(page,'up')).toHaveCount(0);
        await input.fill('not-found'); await expect(list.getByRole('option')).toHaveCount(0);
        await expect(cue(page,'down')).toHaveCount(0);
        await input.fill(''); await expect(cue(page,'down')).toBeVisible();
        await input.press('ArrowDown'); await expect(input).toBeFocused();
        await input.press('Escape'); await expect(trigger).toBeFocused();
      } else { await trigger.focus(); await page.keyboard.press('Escape'); }
      await page.getByRole('button',{name:'Toggle short options'}).click();
      await trigger.click(); await expect(list.getByRole('option')).toHaveCount(3);
      await expect(cue(page,'down')).toHaveCount(0); await expect(cue(page,'up')).toHaveCount(0);
      await list.getByRole('option',{name:'2s'}).click({force:true});
      assert.deepEqual(await page.evaluate(()=>globalThis.selections),[],'disabled option cannot select');
      await trigger.focus();await page.keyboard.press('Escape');await trigger.click();await page.mouse.move(0,0);await settle(page);
      await trigger.focus(); await page.keyboard.press('ArrowDown'); await settle(page); await page.keyboard.press('Enter');
      assert.deepEqual(await page.evaluate(()=>globalThis.selections),surface==='search'?[3]:['3'],'keyboard skips disabled option');
      await expect(trigger).toBeFocused(); await page.close();
    }
  } finally {await browser.close(); await fixture.close();}
});

test('short viewports keep the first useful paint and both scroll boundaries inside the viewport', {timeout:180000}, async () => {
  const fixture=await startWorkspaceReferenceFixture({source:settingsMenuScrollCuesSource,config:{}});
  const evidence=process.env.SETTINGS_SCROLL_CUES_EVIDENCE_DIR;
  const measurements:unknown[]=[];
  try {
    for(const name of ['chromium','webkit'] as const) {
      const browser=await(name==='chromium'?chromium:webkit).launch({headless:true});
      try {
        for(const width of [320,390]) for(const surface of ['core','image','audio','advanced','search','voice']) {
          const page=await browser.newPage({viewport:{width,height:360}});
          const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
          await page.goto(fixture.url+'/?surface='+surface+'&locale=fr');
          await page.evaluate(()=>{document.body.style.minHeight='1800px';});
          const trigger=surface==='voice'?page.locator('summary').first():page.locator('button[aria-haspopup="listbox"]').first();
          for(const target of (surface==='voice'?[170,120,68]:[170,68])) {
            const rect=await trigger.boundingBox();assert.ok(rect);
            await page.evaluate(y=>window.scrollBy(0,y),rect.y-target);await settle(page);
            const closed=await trigger.boundingBox();
            await page.evaluate(()=>{
              globalThis.menuFrames=[];
              const sample=()=>{
                const list=document.querySelector('[role="listbox"]');
                const menu=list?.tagName==='UL'?list.parentElement:list;
                const details=menu?.closest('details');
                if(menu && (!details||details.open) && getComputedStyle(menu).visibility!=='hidden' && menu.getBoundingClientRect().height>0){
                  const r=menu.getBoundingClientRect(),down=document.querySelector('[data-menu-scroll-cue="down"]');
                  globalThis.menuFrames.push({top:r.top,height:r.height,down:!!down&&getComputedStyle(down).visibility!=='hidden'});
                }
                if(globalThis.menuFrames.length<6)globalThis.menuFrameRequest=requestAnimationFrame(sample);
              };globalThis.menuFrameRequest=requestAnimationFrame(sample);
            });
            await trigger.click();await page.mouse.move(0,0);
            const list=page.getByRole('listbox'),menu=surface==='voice'?list:list.locator('..');
            const viewport=surface==='voice'?list.locator(':scope > div[class*="overflow-y-auto"]'):list;
            await expect(cue(page,'down')).toBeVisible();
            await expect.poll(()=>page.evaluate(()=>globalThis.menuFrames.length)).toBeGreaterThanOrEqual(6);
            await page.evaluate(()=>cancelAnimationFrame(globalThis.menuFrameRequest));
            const frames=await page.evaluate(()=>globalThis.menuFrames);
            measurements.push({name,width,surface,target,frames});
            assert.ok(frames[0].down,'cue is present on the first useful paint: '+JSON.stringify({name,width,surface,target,frames}));
            assert.ok(frames.every(f=>f.top>=11 && f.top+f.height<=349),'every captured frame stays in viewport');
            assert.ok(frames.every(f=>Math.abs(f.top-frames[0].top)<1 && Math.abs(f.height-frames[0].height)<1),'opening cannot flash a larger menu');
            const bounds=await menu.boundingBox();assert.ok(bounds);
            assert.deepEqual(await trigger.boundingBox(),closed,surface+' anchor must not move on open');
            assert.ok((await viewport.evaluate(n=>n.clientHeight))>=44,'at least one complete setting target remains visible');
            if(surface==='voice') {
              const rowSize=await viewport.evaluate(n=>Math.max(...Array.from(n.children,c=>c.clientHeight)));
              assert.ok(await viewport.evaluate(n=>n.clientHeight)>=rowSize,'a complete voice row must fit when the other side can show it');
            }
            if(surface==='search') {
              // Two rows fit once the cue slots are removed, but not while
              // they remain reserved: filtering must break that feedback loop.
              const input=page.getByPlaceholder('Search...');await input.fill('0');
              await expect(list.getByRole('option')).toHaveCount(2);
              await expect(cue(page,'down')).toHaveCount(0);await expect(cue(page,'up')).toHaveCount(0);
              assert.equal(await viewport.evaluate(n=>n.scrollHeight>n.clientHeight+1),false);
              await input.fill('');await expect(cue(page,'down')).toBeVisible();
            }
            await viewport.evaluate(n=>{n.scrollTop=n.scrollHeight;});await settle(page);
            await expect(cue(page,'down')).toBeHidden();await expect(cue(page,'up')).toBeVisible();
            const upper=await cue(page,'up').boundingBox();assert.ok(upper && upper.y>=12);
            assert.deepEqual(await menu.boundingBox(),bounds,'boundary changes cannot move the popup');
            if(evidence && name==='chromium' && width===320 && (surface==='core'||surface==='voice')) await page.screenshot({path:evidence+'/'+name+'-'+width+'-'+surface+'-short-'+target+'.png'});
            await viewport.evaluate(n=>{n.scrollTop=0;});await settle(page);
            if(surface==='voice')await trigger.click();else{await trigger.focus();await page.keyboard.press('Escape');}
          }
          assert.deepEqual(errors,[]);await page.close();
        }
      } finally {await browser.close();}
    }
  } finally {
    if(evidence)await writeFile(evidence+'/short-viewport-measurements.json',JSON.stringify(measurements,null,2));
    await fixture.close();
  }
});
