import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium,webkit,expect,type Page} from '@playwright/test';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {initialStatus} from './helpers/milo-status-fixture';
import {MILO_LEVELS,STUDIO_ASSISTANCE_TERRA_TARIFF} from '../frontend/src/lib/studio/assistance-contract';
import {promptAssistanceModeBrowserSource as source} from './helpers/prompt-assistance-mode-browser-source';

const engine=listFalEngines().find(x=>x.id==='wan-3-prime')!.engine;
async function geometry(page:Page){return page.evaluate(()=>{
 const box=(element:Element|null)=>{if(!element)return null;const {x,y,width,height}=element.getBoundingClientRect();return {x,y,width,height};};
 const root=document.querySelector('[data-prompt-assistance-preview]')!,panel=root.querySelector('[role="tabpanel"]:not([hidden])')!;
 return {coarse:matchMedia('(pointer: coarse)').matches,viewport:{width:innerWidth,height:innerHeight},frame:box(root)!,input:box(root.querySelector('[data-assistance-input]')),model:box(panel.querySelector('[aria-label^="Change model:"]')),milo:box(root.querySelector('[aria-label="Milo settings and credits"]')),levelBox:box(root.querySelector('[data-assistance-level]')),feedback:[...panel.querySelectorAll('[role="status"]')].map(node=>node.textContent),level:root.querySelector('[aria-label="Milo settings and credits"]')?.textContent};
});}

for(const browserType of [chromium,webkit])test(`workflow loading keeps assistant geometry stable and preserves fresh admission (${browserType.name()})`,{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{engine},assistanceLive:true,perception:true}),browser=await browserType.launch();
 try{
  for(const width of [320,390,1440]){
   const page=await browser.newPage({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
   const held:Array<{kind:'session'|'availability';run:()=>Promise<void>}>=[];let gets=0,posts=0,failRestore=false,unauthorized=false,selectedModel=initialStatus.selectedModel;
   await page.addInitScript(()=>{for(const owner of ['owner','other'])for(const [index,workflow]of ['create','modify','extend'].entries()){const sessionId=`00000000-0000-4000-8000-${String(index+1+(owner==='other'?3:0)).padStart(12,'0')}`;sessionStorage.setItem(`milo-composer:v2:${JSON.stringify([owner,'video',workflow])}`,JSON.stringify({sessionId,pending:null}));}});
   await page.route('**/api/prompt-assistance*',async route=>{
    if(route.request().method()!=='GET'){posts++;throw Error('No model message, count, choice or media request is allowed');}
    gets++;const url=new URL(route.request().url());
    const kind=url.searchParams.has('sessionId')?'session':'availability';
    await new Promise<void>(resolve=>held.push({kind,run:async()=>{if(kind==='session')await route.fulfill(failRestore?{status:503,json:{ok:false,error:'UNAVAILABLE'}}:{json:{ok:true,result:{sessionId:url.searchParams.get('sessionId'),scope:url.searchParams.get('scope'),status:'active',turns:[],proposal:null,pending:null}}});else await route.fulfill(unauthorized?{status:401,json:{ok:false,error:'AUTH_REQUIRED'}}:{json:{ok:true,result:{...initialStatus,selectedModel,tariff:selectedModel==='gpt-6.1-terra'?STUDIO_ASSISTANCE_TERRA_TARIFF:initialStatus.tariff}}});resolve();}}));
   });
   const release=async(kind?:'session'|'availability')=>{const ready=held.filter(item=>!kind||item.kind===kind);for(const item of ready)held.splice(held.indexOf(item),1);await Promise.all(ready.map(item=>item.run()));};
   await page.goto(fixture.url);await expect.poll(()=>held.length).toBe(2);await release();
   await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.getByRole('button',{name:'Milo settings and credits',exact:true})).toContainText('Lite');
   await page.getByRole('tab',{name:'Prompt',exact:true}).click();const samples:any[]=[];
   for(const tab of ['Prompt','AI assistant']){
    await page.getByRole('tab',{name:tab,exact:true}).click();
    for(const [index,mode]of ['Modify','Extend','Create'].entries()){
     const previousLevel=tab==='AI assistant'?await page.locator('[data-assistance-level]').textContent():null;
     selectedModel=tab==='AI assistant'?[MILO_LEVELS.standard.model,MILO_LEVELS.max.model,MILO_LEVELS.lite.model][index]:MILO_LEVELS.lite.model;
     const modeButton=page.locator(`[data-composer-mode="${mode==='Modify'?'v2v':mode==='Extend'?'extend':'create'}"]`);
     if(tab==='AI assistant'&&mode==='Extend'){await modeButton.focus();await page.keyboard.press('Enter');}else await modeButton.click();await expect.poll(()=>held.length).toBe(2);
     if(tab==='AI assistant'){
      const input=page.getByRole('textbox',{name:'Message Milo',exact:true});await expect(input).toBeEditable({editable:false});await expect(page.getByRole('button',{name:'Send message to Milo',exact:true})).toBeDisabled();
      await expect(page.locator('[data-assistance-level]')).toHaveAttribute('data-verified','false');await expect(page.locator('[data-assistance-level]')).toHaveText(previousLevel!);
     }
     await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));const pending=await geometry(page);
     if(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR&&tab==='AI assistant'&&mode==='Modify')await page.screenshot({path:join(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,`mode-pending-${browserType.name()}-${width}.png`),fullPage:false});
     await release(index%2?'availability':'session');
     if(tab==='AI assistant')await expect(page.getByText(index%2?'Restoring this conversation…':'Checking Milo availability…',{exact:true})).toBeVisible();
     await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));const partial=await geometry(page);
     await release();if(tab==='AI assistant')await expect(page.getByRole('textbox',{name:'Message Milo',exact:true})).toBeEditable();
     await expect(page.getByText('Restoring this conversation…',{exact:true})).toHaveCount(0);await expect(page.getByText('Checking Milo availability…',{exact:true})).toHaveCount(0);
     const settled=await geometry(page);samples.push({tab,mode,pending,partial,settled});
     if(tab==='AI assistant'){await expect(page.locator('[data-assistance-level]')).toHaveAttribute('data-verified','true');await expect(page.locator('[data-assistance-level]')).toHaveText(index===0?'Standard':index===1?'Max':'Lite');}
    }
   }
   if(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR){await mkdir(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,`mode-geometry-${browserType.name()}-${width}.json`),JSON.stringify({width,samples,gets,posts},null,2));await page.screenshot({path:join(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,`mode-settled-${browserType.name()}-${width}.png`),fullPage:false});}
   for(const sample of samples)for(const phase of ['pending','partial']){assert.ok(Math.abs(sample[phase].frame.height-sample.settled.frame.height)<1,`${sample.tab} ${sample.mode}: ${phase} ${sample[phase].frame.height}px / settled ${sample.settled.frame.height}px`);if(sample.tab==='AI assistant'){assert.ok(Math.abs(sample[phase].levelBox.width-sample.settled.levelBox.width)<1,'Milo level slot must not collapse while checking');assert.ok(Math.abs(sample[phase].milo.width-sample.settled.milo.width)<1,'Milo trigger must not shrink its icons while checking');assert.ok(Math.abs(sample[phase].model.y-sample.settled.model.y)<1,'engine selector must not move after checking');}}
   for(const sample of samples.filter(item=>item.tab==='AI assistant'))assert.ok(Math.abs(sample.settled.frame.height-samples.find(item=>item.tab==='Prompt'&&item.mode===sample.mode).settled.frame.height)<1,'empty assistant must not reserve permanent extra height');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.equal(posts,0);assert.deepEqual(errors,[]);
   // An actual restore failure remains visible and blocks the destination workflow.
   failRestore=true;await page.locator('[data-composer-mode="v2v"]').click();await expect.poll(()=>held.length).toBeGreaterThan(0);await release();await expect(page.getByText('Could not restore this chat. Try again before continuing.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Send message to Milo',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Retry loading chat',exact:true})).toBeEnabled();
   failRestore=false;await page.getByRole('button',{name:'Retry loading chat',exact:true}).click();await expect.poll(()=>held.length).toBe(1);await release();await expect(page.getByText('Could not restore this chat. Try again before continuing.',{exact:true})).toHaveCount(0);
   await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('Unsent owner-only idea');selectedModel=MILO_LEVELS.max.model;await page.getByRole('button',{name:'Change account',exact:true}).click();
   await expect(page.getByRole('tab',{name:'Prompt',exact:true})).toHaveAttribute('aria-selected','true');await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect.poll(()=>held.length).toBe(2);await expect(page.locator('[data-assistance-level]')).toHaveText('…');await expect(page.locator('[data-assistance-level]')).toHaveAttribute('data-verified','false');await expect(page.getByRole('textbox',{name:'Message Milo',exact:true})).toHaveValue('');await expect(page.getByRole('button',{name:'Send message to Milo',exact:true})).toBeDisabled();
   await release();await expect(page.locator('[data-assistance-level]')).toHaveText('Max');await expect(page.locator('[data-assistance-level]')).toHaveAttribute('data-verified','true');
   unauthorized=true;await page.getByRole('button',{name:'Change account',exact:true}).click();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect.poll(()=>held.length).toBe(2);await release();await expect(page.locator('[data-assistance-input-notice]')).toBeVisible();await expect(page.locator('[data-assistance-level]')).toHaveText('…');await expect(page.getByRole('button',{name:'Send message to Milo',exact:true})).toBeDisabled();assert.equal(posts,0);assert.deepEqual(errors,[]);
   // Ready references legitimately add the analysis action. Retiring their account
   // may remove it; loading must stay within the settled contexts' height envelope.
   unauthorized=false;await page.getByRole('button',{name:'Change account',exact:true}).click();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect.poll(()=>held.length).toBe(2);await release();await expect(page.getByRole('textbox',{name:'Message Milo',exact:true})).toBeEditable();await page.getByRole('button',{name:'Add local video',exact:true}).click();await expect(page.getByRole('button',{name:'Analyze references',exact:true})).toBeVisible();const sourceBefore=await geometry(page);
   await page.getByRole('button',{name:'Change account',exact:true}).click();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect.poll(()=>held.length).toBe(2);const sourcePending=await geometry(page);await release('availability');await expect(page.getByText('Restoring this conversation…',{exact:true})).toBeVisible();const sourcePartial=await geometry(page);await release();await expect(page.getByRole('textbox',{name:'Message Milo',exact:true})).toBeEditable();await expect(page.getByRole('button',{name:'Analyze references',exact:true})).toHaveCount(0);const sourceSettled=await geometry(page);
   for(const phase of [sourcePending,sourcePartial])assert.ok(phase.frame.height<=Math.max(sourceBefore.frame.height,sourceSettled.frame.height)+1,'loading must not add overshoot when a real source enables an additional action');
   if(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR)await writeFile(join(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,`mode-source-geometry-${browserType.name()}-${width}.json`),JSON.stringify({width,before:sourceBefore,pending:sourcePending,partial:sourcePartial,settled:sourceSettled},null,2));
   assert.equal(posts,0);assert.deepEqual(errors,[]);
   await page.close();
  }
 }finally{await browser.close();await fixture.close();}
});

for(const browserType of [chromium,webkit])test(`cached pending recovery keeps its action during restoration (${browserType.name()})`,{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{engine},assistanceLive:true}),browser=await browserType.launch();let release:(()=>void)|undefined,restoreRelease:(()=>void)|undefined,posts=0;
 try{
  const page=await browser.newPage({viewport:{width:390,height:900}}),sessionId='00000000-0000-4000-8000-000000000071',requestId='00000000-0000-4000-8000-000000000072',key='milo-composer:v2:["owner","video","create"]';
  await page.addInitScript(({key,sessionId,requestId})=>sessionStorage.setItem(key,JSON.stringify({sessionId,pending:{sessionId,requestId}})),{key,sessionId,requestId});
  await page.route('**/api/prompt-assistance*',async route=>{
   if(route.request().method()!=='GET'){posts++;throw Error('No model message or recovery POST allowed');}
   if(new URL(route.request().url()).searchParams.has('sessionId')){await new Promise<void>(resolve=>restoreRelease=resolve);return route.fulfill({json:{ok:true,result:{sessionId,scope:'video:create',status:'active',turns:[],proposal:null,pending:{requestId}}}});}
   await new Promise<void>(resolve=>release=resolve);return route.fulfill({json:{ok:true,result:initialStatus}});
  });
  await page.goto(fixture.url);await expect.poll(()=>Boolean(release&&restoreRelease)).toBe(true);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();await expect(page.getByText('Restoring this conversation…',{exact:true})).toBeVisible();restoreRelease!();await expect(page.getByText('Check this reply before sending another message. Stopping the wait does not cancel a call already started.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Send message to Milo',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'New chat',exact:true})).toBeEnabled();
  assert.equal(await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).pending.requestId,key),requestId);release!();await expect(page.locator('[data-assistance-level]')).toHaveAttribute('data-verified','true');await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();assert.equal(posts,0);
  // Even with verified availability and nonempty input, the saved request blocks Send rather than navigation.
  await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('An unsent follow-up');
  await expect(page.getByRole('button',{name:'Send message to Milo',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'New chat',exact:true})).toBeEnabled();
  assert.equal(await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).pending.requestId,key),requestId);assert.equal(posts,0);
 }finally{restoreRelease?.();release?.();await browser.close();await fixture.close();}
});
