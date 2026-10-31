import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit,expect,type Page,type Locator} from '@playwright/test';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {settingsMenuScrollStabilitySource} from './helpers/settings-menu-scroll-stability-browser-source';

async function settle(viewport:Locator){
  await viewport.evaluate(n=>new Promise<void>(resolve=>{const start=performance.now();let old='',stable=0;const frame=()=>{const next=n.scrollTop+':'+scrollY;stable=old===next?stable+1:0;old=next;if(performance.now()-start>140&&stable>=5)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);}));
}
async function prepare(page:Page,url:string,kind:string){
  await page.goto(url);await page.evaluate(()=>{document.body.style.minHeight='3200px';});
  const trigger=kind==='voice'?page.locator('summary').first():page.locator('button[aria-haspopup="listbox"]').first();
  const box=await trigger.boundingBox();assert.ok(box);await page.evaluate(y=>scrollTo(0,y),box.y-600);
  await trigger.click();await page.mouse.move(0,0);
  const list=page.getByRole('listbox'),viewport=kind==='voice'?list.locator(':scope > div[class*="overflow-y-auto"]'):list;
  await settle(viewport);
  return{trigger,list,viewport};
}
async function nativeBoundary(page:Page,viewport:Locator,end:'top'|'bottom'){
  for(let i=0;i<20;i++){
    const reached=await viewport.evaluate((n,e)=>e==='top'?n.scrollTop<=1:n.scrollTop>=n.scrollHeight-n.clientHeight-1,end);if(reached)break;
    const box=await viewport.boundingBox();assert.ok(box);await page.mouse.move(box.x+12,box.y+box.height/2);await page.mouse.wheel(0,end==='top'?-320:320);await settle(viewport);
  }
}
async function instrument(viewport:Locator){
  await viewport.evaluate(n=>{
    const descriptor=Object.getOwnPropertyDescriptor(Element.prototype,'scrollTop')!;
    const state=()=>({top:n.scrollTop,page:scrollY,focus:document.activeElement?.getAttribute('role')??document.activeElement?.tagName,hover:n.querySelector(':hover')?.textContent,count:globalThis.parentRenderCount});
    globalThis.mark=(name:string)=>globalThis.trace.push({type:'mark',name,...state(),time:performance.now()});
    Object.defineProperty(n,'scrollTop',{configurable:true,get(){return descriptor.get!.call(this);},set(value){globalThis.trace.push({type:'JS-scrollTop',to:value,...state(),time:performance.now()});descriptor.set!.call(this,value);}});
    for(const type of ['wheel','pointerover','focusin','keydown','scroll'])document.addEventListener(type,e=>{if(e.target===n||n.contains(e.target as Node))globalThis.trace.push({type,key:(e as KeyboardEvent).key,delta:(e as WheelEvent).deltaY,trusted:e.isTrusted,...state(),time:performance.now()});},{capture:true,passive:true});
  });
}

test('real Core manual endpoints survive hover, native wheel and an identical parent render', {timeout:180000},async()=>{
  const evidence=process.env.SETTINGS_SCROLL_STABILITY_EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true});
  const cases:unknown[]=[],failures:string[]=[];
  try{
    for(const name of ['chromium','webkit'] as const){
      const browser=await(name==='chromium'?chromium:webkit).launch({headless:true});
      try{for(const width of [1740,390])for(const end of ['bottom','top'] as const){
        const initialValue=end==='bottom'?6:15;
        const fixture=await startWorkspaceReferenceFixture({source:settingsMenuScrollStabilitySource,config:{kind:'core',initialValue}});
        const page=await browser.newPage({viewport:{width,height:width===1740?1105:844}}),errors:string[]=[],external:string[]=[];
        page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>globalThis.trace=[]);
        await page.route('**/*',r=>{if(r.request().method()!=='GET'||new URL(r.request().url()).origin!==fixture.url){external.push(r.request().url());return r.abort();}return r.continue();});
        try{
          const{list,viewport}=await prepare(page,fixture.url,'core');await instrument(viewport);
          await expect(list.getByRole('option')).toHaveCount(13);await nativeBoundary(page,viewport,end);
          const box=await viewport.boundingBox();assert.ok(box);
          await page.mouse.move(box.x+box.width/2,box.y+(end==='bottom'?112:22));await settle(viewport);
          const before=await viewport.evaluate(n=>({top:n.scrollTop,page:scrollY,max:n.scrollHeight-n.clientHeight}));
          assert.ok(before.max>1,'the real duration list must overflow before the gesture');
          assert.ok(Math.abs(before.top-(end==='top'?0:before.max))<=1,'native wheel setup must reach the requested '+end+' boundary');
          await page.evaluate(()=>globalThis.mark('hover-only'));await page.mouse.wheel(0,end==='bottom'?640:-640);await settle(viewport);
          assert.equal(await viewport.evaluate(n=>n.scrollTop),before.top,'wheel alone retains its reached endpoint');
          await page.evaluate(()=>globalThis.mark('wheel-only'));
          await page.evaluate(()=>globalThis.repeatParentRender());await settle(viewport);await page.evaluate(()=>globalThis.mark('parent-rerender'));
          const after=await viewport.evaluate(n=>({top:n.scrollTop,page:scrollY}));
          if(Math.abs(after.top-before.top)>1)failures.push(name+'/'+width+'/'+end+': '+before.top+' → '+after.top);
          assert.equal(after.page,before.page);assert.equal(await page.locator('[data-selected]').textContent(),String(initialValue));
          const trace=await page.evaluate(()=>globalThis.trace);cases.push({name,width,end,initialValue,before,after,trace});
          if(evidence)await page.screenshot({path:evidence+'/'+name+'-'+width+'-'+end+'.png'});
          assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
        }finally{await page.close();await fixture.close();}
      }}finally{await browser.close();}
    }
    assert.deepEqual(failures,[],'semantically identical parent props cannot reset manual browsing');
  }finally{if(evidence)await writeFile(evidence+'/manual-endpoints.json',JSON.stringify({failures,cases},null,2));}
});

test('native Tab/Enter uses the focused option, and keyboard highlight survives an equivalent parent render', {timeout:120000},async()=>{
  const fixture=await startWorkspaceReferenceFixture({source:settingsMenuScrollStabilitySource,config:{kind:'plain',initialValue:6}});
  try{for(const type of [chromium,webkit]){const browser=await type.launch({headless:true});try{
    const page=await browser.newPage({viewport:{width:390,height:900}});
    const{trigger,list,viewport}=await prepare(page,fixture.url,'plain');await trigger.focus();
    // This WebKit port's default Tab mode skips buttons; Option/Alt+Tab traverses them.
    const tab=type.name()==='webkit'?'Alt+Tab':'Tab';await page.keyboard.press(tab);
    await expect(list.getByRole('option',{name:'Option 1',exact:true})).toBeFocused();
    await page.keyboard.press(tab);await expect(list.getByRole('option',{name:'Option 3',exact:true})).toBeFocused();
    await page.keyboard.press('Enter');assert.equal(await page.locator('[data-selected]').textContent(),'3','Tab skips disabled2; Enter must choose focused3, not selected6');
    await page.evaluate(()=>globalThis.changeSelectedValue(6));await trigger.click();await page.mouse.move(0,0);await settle(viewport);
    await trigger.focus();await page.keyboard.press('ArrowDown');await settle(viewport);await page.evaluate(()=>globalThis.repeatParentRender());await settle(viewport);
    await page.keyboard.press('Enter');assert.equal(await page.locator('[data-selected]').textContent(),'7','the highlighted choice survives an equivalent options array');
    await expect(trigger).toBeFocused();
  }finally{await browser.close();}}}finally{await fixture.close();}
});

test('reordering, removal, disabling and filtering keep the current option valid; custom Audio has no identity reset', {timeout:180000},async()=>{
  for(const type of [chromium,webkit]){const browser=await type.launch({headless:true});try{
    for(const mutation of ['reverse','relabel','disable7','remove7','allDisabled']){
      const fixture=await startWorkspaceReferenceFixture({source:settingsMenuScrollStabilitySource,config:{kind:'plain',initialValue:6}});
      try{const page=await browser.newPage({viewport:{width:390,height:900}});const{trigger,viewport}=await prepare(page,fixture.url,'plain');
        await trigger.focus();await page.keyboard.press('ArrowDown');await settle(viewport);await page.evaluate(kind=>globalThis.changeOptions(kind),mutation);await settle(viewport);await page.keyboard.press('Enter');
        assert.deepEqual(await page.evaluate(()=>globalThis.selections??[]),mutation==='allDisabled'?[]:[mutation==='reverse'||mutation==='relabel'?7:6]);
        await page.close();
      }finally{await fixture.close();}
    }
    for(const kind of ['search','audio','voice']){
      const fixture=await startWorkspaceReferenceFixture({source:settingsMenuScrollStabilitySource,config:{kind,initialValue:kind==='voice'?'default':6}});
      try{const page=await browser.newPage({viewport:{width:390,height:900}});const{list,viewport}=await prepare(page,fixture.url,kind);
        await nativeBoundary(page,viewport,'bottom');const box=await viewport.boundingBox();assert.ok(box);await page.mouse.move(box.x+12,box.y+box.height/2);await settle(viewport);
        const before=await viewport.evaluate(n=>n.scrollTop);await page.evaluate(()=>globalThis.repeatParentRender());await settle(viewport);
        assert.equal(await viewport.evaluate(n=>n.scrollTop),before,kind+' must retain manual scroll on equivalent parent props');
        if(kind==='search'){
          await page.getByPlaceholder('Search...').fill('12');await expect(list.getByRole('option')).toHaveCount(1);await expect(page.locator('[data-menu-scroll-cue]')).toHaveCount(0);
          const option=list.getByRole('option',{name:'Option 12'});await option.focus();await option.press('Enter');assert.equal(await page.locator('[data-selected]').textContent(),'12');
        }
        await page.close();
      }finally{await fixture.close();}
    }
  }finally{await browser.close();}}
});
