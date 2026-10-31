import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit, expect, type Page, type Locator } from '@playwright/test';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';
import { settingsMenuScrollCuesSource } from './helpers/settings-menu-scroll-cues-browser-source';

async function settled(viewport: Locator) {
  await viewport.evaluate(node => new Promise<void>(resolve => {
    const start=performance.now();let previous='',stable=0;
    const frame=()=>{
      const value=node.scrollTop+':'+scrollY;
      stable=value===previous?stable+1:0;previous=value;
      if((performance.now()-start>=140&&stable>=5)||performance.now()-start>1500)resolve();else requestAnimationFrame(frame);
    };requestAnimationFrame(frame);
  }));
}

async function snapshot(viewport: Locator) {
  return viewport.evaluate(n=>({top:n.scrollTop,height:n.clientHeight,content:n.scrollHeight,pageY:scrollY,pageMax:document.documentElement.scrollHeight-innerHeight,
    overscroll:getComputedStyle(n).overscrollBehaviorY,selection:document.querySelector('[data-selected]')?.textContent}));
}

async function wheel(page: Page, viewport: Locator, deltaY: number, point?: {x:number;y:number}) {
  const box=await viewport.boundingBox();assert.ok(box);
  const at=point??{x:box.x+Math.min(12,box.width/2),y:box.y+box.height/2};
  await page.mouse.move(at.x,at.y);await settled(viewport);
  const before=await snapshot(viewport);
  const hit=await viewport.evaluate((n,p)=>n.contains(document.elementFromPoint(p.x,p.y)),at);
  await page.mouse.wheel(0,deltaY);await settled(viewport);
  return {point:at,deltaY,hit,before,after:await snapshot(viewport)};
}

async function prepare(page: Page, url: string, surface: string) {
  await page.goto(url+'/?surface='+surface+'&locale=en');
  await page.evaluate(()=>{document.body.style.minHeight='3200px';document.querySelector('main')!.style.marginTop='850px';});
  const trigger=surface==='voice'?page.locator('summary').first():page.locator('button[aria-haspopup="listbox"]').first();
  const rect=await trigger.boundingBox();assert.ok(rect);
  await page.evaluate(y=>scrollTo(0,y),rect.y-600);
  await trigger.click();await page.mouse.move(0,0);
  const list=page.getByRole('listbox');
  const viewport=surface==='voice'?list.locator(':scope > div[class*="overflow-y-auto"]'):list;
  await settled(viewport);
  await viewport.evaluate(n=>{
    n.setAttribute('data-wheel-viewport','');globalThis.menuWheelEvents=[];
    document.addEventListener('wheel',event=>{globalThis.menuWheelEvents.push({trusted:event.isTrusted,deltaY:event.deltaY,x:event.clientX,y:event.clientY,inside:n.contains(event.target as Node)});},{passive:true,capture:true});
  });
  return {trigger,list,viewport};
}

test('native wheel stays in overflowing settings and voice lists at both boundaries, with page room in both directions', {timeout:180000}, async () => {
  const fixture=await startWorkspaceReferenceFixture({source:settingsMenuScrollCuesSource,config:{}});
  const evidence=process.env.SETTINGS_MENU_WHEEL_EVIDENCE_DIR;
  if(evidence)await mkdir(evidence,{recursive:true});
  const observations:unknown[]=[],failures:string[]=[];
  try {
    for(const name of ['chromium','webkit'] as const){
      const browser=await(name==='chromium'?chromium:webkit).launch({headless:true});
      try{
        for(const width of [1440,390])for(const surface of ['core','voice']){
          const page=await browser.newPage({viewport:{width,height:900}}),errors:string[]=[],external:string[]=[];
          page.on('pageerror',e=>errors.push(e.message));
          await page.route('**/*',route=>{const r=route.request();if(r.method()!=='GET'||new URL(r.url()).origin!==fixture.url){external.push(r.method()+' '+r.url());return route.abort();}return route.continue();});
          const {trigger,viewport}=await prepare(page,fixture.url,surface);
          const initial=await snapshot(viewport);
          assert.ok(initial.pageY>250&&initial.pageMax-initial.pageY>600,'the document can really scroll both ways');
          assert.ok(initial.content>initial.height);
          const steps=[];
          for(let i=0;i<12;i++){
            const s=await snapshot(viewport);if(s.top>=s.content-s.height-1)break;
            steps.push(await wheel(page,viewport,320));
          }
          const end=await snapshot(viewport);assert.ok(end.top>=end.content-end.height-1);
          await expect(page.locator('[data-menu-scroll-cue="down"]')).toBeHidden();await expect(page.locator('[data-menu-scroll-cue="up"]')).toBeVisible();
          await page.evaluate(y=>scrollTo(0,y),initial.pageY);await settled(viewport);
          const bottom=await wheel(page,viewport,160);
          assert.ok(bottom.hit,'the native wheel begins inside the options viewport');
          assert.ok(Math.abs(bottom.after.top-bottom.before.top)<=1,'a downward boundary wheel retains the lower endpoint');
          if(Math.abs(bottom.after.pageY-bottom.before.pageY)>1)failures.push(name+'/'+width+'/'+surface+': bottom chained '+(bottom.after.pageY-bottom.before.pageY)+'px');
          await page.evaluate(y=>scrollTo(0,y),initial.pageY);await settled(viewport);
          for(let i=0;i<12;i++){
            if((await snapshot(viewport)).top<=1)break;
            steps.push(await wheel(page,viewport,-320));
          }
          assert.ok((await snapshot(viewport)).top<=1);
          await expect(page.locator('[data-menu-scroll-cue="up"]')).toBeHidden();await expect(page.locator('[data-menu-scroll-cue="down"]')).toBeVisible();
          await page.evaluate(y=>scrollTo(0,y),initial.pageY);await settled(viewport);
          const top=await wheel(page,viewport,-160);
          assert.ok(top.hit);
          assert.ok(Math.abs(top.after.top-top.before.top)<=1,'an upward boundary wheel retains the upper endpoint');
          if(Math.abs(top.after.pageY-top.before.pageY)>1)failures.push(name+'/'+width+'/'+surface+': top chained '+(top.after.pageY-top.before.pageY)+'px');
          assert.equal(top.after.selection,initial.selection,'wheel never selects an option');
          await page.evaluate(y=>scrollTo(0,y),initial.pageY);await settled(viewport);
          if(evidence)await page.screenshot({path:evidence+'/'+name+'-'+width+'-'+surface+'-top.png'});
          // These separate cue slots are not the options scroll viewport.
          const cue=await page.locator('[data-menu-scroll-cue="down"]').boundingBox();assert.ok(cue);
          const cueWheel=await wheel(page,viewport,160,{x:cue.x+cue.width/2,y:cue.y+cue.height/2});
          assert.equal(cueWheel.hit,false);assert.ok(cueWheel.after.pageY>cueWheel.before.pageY,'visual cue band does not lock the document');
          await page.evaluate(y=>scrollTo(0,y),initial.pageY);await settled(viewport);
          const outside=await wheel(page,viewport,160,{x:width-24,y:876});
          assert.equal(outside.hit,false);assert.ok(outside.after.pageY>outside.before.pageY,'background outside popup remains scrollable');
          await page.evaluate(y=>scrollTo(0,y),initial.pageY);await settled(viewport);
          await trigger.focus();
          const keyBefore=await page.evaluate(()=>scrollY);
          if(surface==='core'){await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');await expect(trigger).toBeFocused();}
          else{await page.keyboard.press('Space');await expect(page.getByRole('listbox')).toBeHidden();}
          assert.equal(await page.evaluate(()=>scrollY),keyBefore,'keyboard does not move the background');
          const events=await page.evaluate(()=>globalThis.menuWheelEvents);
          assert.ok(events.length>0&&events.every(e=>e.trusted),'wheel events come from browser input, not dispatchEvent');
          observations.push({name,width,surface,initial,steps,bottom,top,cueWheel,outside,events});
          assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
          await page.close();
        }
      }finally{await browser.close();}
    }
    assert.deepEqual(failures,[],'native boundary wheel must not chain into the document');
  }finally{if(evidence)await writeFile(evidence+'/wheel-observations.json',JSON.stringify({failures,observations},null,2));await fixture.close();}
});

test('a short settings list keeps its choices and has no false scroll cues', {timeout:60000}, async () => {
  const fixture=await startWorkspaceReferenceFixture({source:settingsMenuScrollCuesSource,config:{}});
  try{
    for(const type of [chromium,webkit]){
      const browser=await type.launch({headless:true});
      try{
        const page=await browser.newPage({viewport:{width:390,height:900}});
        const {trigger,viewport}=await prepare(page,fixture.url,'search');
        await trigger.press('Escape');await page.getByRole('button',{name:'Toggle short options'}).click();await trigger.click();
        await expect(viewport.getByRole('option')).toHaveCount(3);await expect(page.locator('[data-menu-scroll-cue]')).toHaveCount(0);
        const before=await snapshot(viewport);assert.equal(before.content,before.height);
        await wheel(page,viewport,160);await wheel(page,viewport,-160);
        assert.equal((await snapshot(viewport)).selection,before.selection);
        await expect(page.locator('[data-menu-scroll-cue]')).toHaveCount(0);
      }finally{await browser.close();}
    }
  }finally{await fixture.close();}
});
