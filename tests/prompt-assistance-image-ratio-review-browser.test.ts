import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {join} from 'node:path';
import {chromium,webkit,expect,type Page} from '@playwright/test';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {canonicalPromptDraft} from '../frontend/src/lib/prompt-assistance/session';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {initialStatus} from './helpers/milo-status-fixture';
import {imageRatioReviewBrowserSource as source,imageReviewHostModules as hostModules} from './helpers/image-ratio-review-browser-source';

const config={engine:listFalEngines().find(x=>x.id==='nano-banana-2-1')!.engine,otherEngine:listFalEngines().find(x=>x.id==='gpt-image-2')!.engine};
const proposed='A carefully composed square image of a synthetic weather station.';
const cacheKey='milo-composer:v2:["owner","image","create"]';
async function selectRatio(page:Page,value:string){await page.getByRole('button',{name:/^Format:/}).click();await page.getByRole('option',{name:`Format: ${value}`,exact:true}).click();}
async function ask(page:Page){await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('Compose a new image.');await page.getByRole('button',{name:'Send message to Milo',exact:true}).click();await expect(page.locator('[data-assistance-apply]')).toBeEnabled();}
async function mockServices(page:Page,waitForReply?:()=>Promise<void>){
 const requests:any[]=[];
 await page.route('**/api/prompt-assistance*',async route=>{
  const url=new URL(route.request().url());
  if(route.request().method()==='GET'){
   if(!url.searchParams.has('sessionId'))return route.fulfill({json:{ok:true,result:initialStatus}});
   const request=requests.at(-1);assert.ok(request);
   return route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,scope:'image:create',status:'active',turns:[{requestId:request.requestId,message:request.message,reply:'Review the composition.'}],pending:null,proposal:{text:proposed,draftFingerprint:createHash('sha256').update(canonicalPromptDraft(request.draft)).digest('hex')}}}});
  }
  const body=route.request().postDataJSON();assert.equal(body.action,'message','only the synthetic initial assistance exchange is admitted');requests.push(body.request);
  await waitForReply?.();
  const request=body.request;return route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,requestId:request.requestId,draftRevision:request.draftRevision,target:'prompt',message:request.message,state:'complete',reply:{reply:'Review the composition.',text:proposed},assistance:initialStatus}}});
 });
 return requests;
}
const change=(page:Page,patch:Record<string,unknown>)=>page.evaluate(patch=>(globalThis as any).changeImage(patch),patch);
const saved=(page:Page)=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)??'null'),cacheKey);

for(const browserType of [chromium,webkit])test(`real Image ratio-only review survives reload and applies exact edited text with Undo (${browserType.name()})`,{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,hostModules,assistanceLive:true}),browser=await browserType.launch();
 try{
  const page=await browser.newPage({viewport:{width:browserType===webkit?390:1440,height:1000}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const requests=await mockServices(page);
  await page.goto(fixture.url);await ask(page);
  await expect.poll(async()=>!!(await saved(page))?.local?.proposal?.review).toBe(true);
  assert.deepEqual((await saved(page)).local.proposal.review.settings,{aspectRatio:'1:1'});
  await selectRatio(page,'16:9');
  await expect(page.getByRole('button',{name:'Use prompt',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Review & use',exact:true})).toBeEnabled();
  await page.reload();await expect(page.getByRole('combobox',{name:'Test ratio',exact:true})).toHaveValue('16:9');await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const review=page.getByRole('button',{name:'Review & use',exact:true});await expect(review).toBeEnabled();
  assert.equal((await page.locator('[data-assistance-proposal]').boundingBox())!.height,53);
  await review.click();const changes=page.locator('[data-assistance-settings-changes]');await expect(changes).toContainText('1:1');await expect(changes).toContainText('16:9');
  await expect(page.locator('[data-workspace-prompt]')).toHaveValue('Original synthetic manual image prompt.');
  await page.locator('[data-assistance-editor]').fill('Exact human-reviewed wide image composition.');
  const confirmation=page.getByRole('button',{name:'Use with current settings',exact:true});await expect(confirmation).toBeEnabled();
  await change(page,{ratio:'9:16'});await expect(confirmation).toBeDisabled();await page.getByRole('button',{name:'Review changes',exact:true}).click();
  await expect(changes).toContainText('9:16');await expect(confirmation).toBeEnabled();
  if(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR)await page.screenshot({path:join(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,`image-ratio-review-${browserType.name()}.png`),fullPage:true});
  await confirmation.click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue('Exact human-reviewed wide image composition.');
  assert.deepEqual(await page.evaluate(()=>{const s=(globalThis as any).imageProbe;return [s.ratio,s.resolution,s.numImages,s.engineId,s.mode];}),['9:16','2k',1,config.engine.id,'t2i']);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue('Original synthetic manual image prompt.');
  await expect(page.getByRole('combobox',{name:'Test ratio',exact:true})).toHaveValue('9:16');assert.equal(requests.length,1);assert.deepEqual(await page.evaluate(()=>(globalThis as any).formRuns),[]);assert.deepEqual(errors,[]);
 }finally{await browser.close();await fixture.close();}
});

test('initial Image edit, mask or selected references never gain a ratio-review proof',{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,hostModules,assistanceLive:true}),browser=await chromium.launch();
 try{for(const initial of [{mode:'i2i'},{maskUrl:'/synthetic-mask.svg'},{assets:{image_urls:[{id:'synthetic-selected',name:'Selected reference',url:'/synthetic-reference.svg',kind:'image',status:'ready',assetId:'synthetic-selected'}]}},{assets:{image_urls:[{id:'synthetic-pending',name:'Pending reference',url:'/synthetic-reference.svg',kind:'image',status:'uploading'}]}}]){
  const page=await browser.newPage();const requests=await mockServices(page);await page.goto(fixture.url);await change(page,initial);await ask(page);
  await change(page,{ratio:'16:9'});await expect(page.locator('[data-assistance-apply]')).toBeDisabled();await expect(page.getByRole('button',{name:'Review & use',exact:true})).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>Object.entries(sessionStorage).some(([key,value])=>key.startsWith('milo-composer:v2:')&&JSON.parse(value).local?.proposal?.text))).toBe(true);
  // Edit has a separate cache; all mounted variants must remain without a proof.
  assert.equal(await page.evaluate(()=>Object.entries(sessionStorage).some(([key,value])=>key.startsWith('milo-composer:v2:')&&!!JSON.parse(value).local?.proposal?.review)),false);
  assert.equal(requests.length,1);assert.deepEqual(await page.evaluate(()=>(globalThis as any).formRuns),[]);await page.close();
 }}finally{await browser.close();await fixture.close();}
});

test('a late Image reply keeps its original ratio baseline and cannot cross a reverted hard change',{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,hostModules,assistanceLive:true}),browser=await chromium.launch();let release:(()=>void)|undefined;
 try{for(const hardChange of [false,true]){
  const page=await browser.newPage();const requests=await mockServices(page,()=>new Promise<void>(resolve=>{release=resolve;}));
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('Compose a new image.');await page.getByRole('button',{name:'Send message to Milo',exact:true}).click();
  await expect.poll(()=>requests.length).toBe(1);await change(page,{ratio:'16:9'});
  if(hardChange){await change(page,{resolution:'4k'});await expect.poll(()=>page.evaluate(()=>(globalThis as any).imageProbe.resolution)).toBe('4k');await change(page,{resolution:'2k'});}
  release?.();await expect(page.locator('[data-assistance-proposal]')).toBeVisible();
  if(hardChange){await expect(page.locator('[data-assistance-apply]')).toBeDisabled();await expect(page.getByRole('button',{name:'Review & use',exact:true})).toHaveCount(0);}
  else{await page.getByRole('button',{name:'Review & use',exact:true}).click();await expect(page.locator('[data-assistance-settings-changes]')).toContainText('1:1');await expect(page.locator('[data-assistance-settings-changes]')).toContainText('16:9');}
  assert.equal(requests.length,1);assert.deepEqual(await page.evaluate(()=>(globalThis as any).formRuns),[]);await page.close();
 }}finally{release?.();await browser.close();await fixture.close();}
});

test('Image missing persisted review proof never acquires a current baseline',{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,hostModules,assistanceLive:true}),browser=await chromium.launch();
 try{const page=await browser.newPage();const requests=await mockServices(page);await page.goto(fixture.url);await ask(page);await expect.poll(async()=>!!(await saved(page))?.local?.proposal?.review).toBe(true);
  await change(page,{ratio:'16:9'});await expect(page.getByRole('button',{name:'Review & use',exact:true})).toBeEnabled();
  await page.evaluate(key=>{const cache=JSON.parse(sessionStorage.getItem(key)!);delete cache.local.proposal.review;sessionStorage.setItem(key,JSON.stringify(cache));},cacheKey);
  await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.locator('[data-assistance-proposal]')).toBeVisible();
  await expect(page.getByRole('button',{name:'Review & use',exact:true})).toHaveCount(0);await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
  assert.equal((await saved(page)).local.proposal.review,undefined);assert.equal(requests.length,1);
 }finally{await browser.close();await fixture.close();}
});

test('restored Image proof cannot extend ratio permission to another setting or another request',{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,hostModules,assistanceLive:true}),browser=await chromium.launch();
 try{for(const corruption of ['nonratio','request','digest','original-ratio']){
  const page=await browser.newPage();const requests=await mockServices(page);await page.goto(fixture.url);await ask(page);await expect.poll(async()=>!!(await saved(page))?.local?.proposal?.review).toBe(true);
  await change(page,{ratio:'16:9'});await expect(page.getByRole('button',{name:'Review & use',exact:true})).toBeEnabled();
  await page.evaluate(({key,corruption})=>{const cache=JSON.parse(sessionStorage.getItem(key)!);const proof=cache.local.proposal.review;
   if(corruption==='nonratio')proof.settings.resolution='4k';
   if(corruption==='request')proof.requestId='99999999-9999-4999-8999-999999999999';
   if(corruption==='digest')proof.compatibilityFingerprint='f'.repeat(64);
   if(corruption==='original-ratio')proof.settings.aspectRatio='9:16';
   sessionStorage.setItem(key,JSON.stringify(cache));
  },{key:cacheKey,corruption});
  await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.locator('[data-assistance-proposal]')).toBeVisible();
  await expect(page.getByRole('button',{name:'Review & use',exact:true})).toHaveCount(0);await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
  assert.equal(requests.length,1,corruption);await page.close();
 }}finally{await browser.close();await fixture.close();}
});

test('ratio-only review survives the real Image draft hydration and persistence owners',{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{...config,realPersistence:true},hostModules,assistanceLive:true}),browser=await chromium.launch();
 try{const page=await browser.newPage();const requests=await mockServices(page);
  await page.addInitScript(engineId=>{const key='maxvideoai.image.composer.v1:owner';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:5,engineId,mode:'t2i',prompt:'Original synthetic manual image prompt.',numImages:1,aspectRatio:'1:1',resolution:'2k',seed:null,outputFormat:null,quality:null,background:null,style:null,maskUrl:null,enableWebSearch:false,thinkingLevel:null,limitGenerations:false,watermark:false,referenceSlots:[]}));},config.engine.id);
  await page.goto(fixture.url);await ask(page);await expect.poll(async()=>!!(await saved(page))?.local?.proposal?.review).toBe(true);
  const original=await page.evaluate(()=>(globalThis as any).imageProbe);
  await selectRatio(page,'16:9');await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('maxvideoai.image.composer.v1:owner')!).aspectRatio)).toBe('16:9');
  await page.reload();await expect(page.getByRole('combobox',{name:'Test ratio',exact:true})).toHaveValue('16:9');
  const restored=await page.evaluate(()=>(globalThis as any).imageProbe);assert.deepEqual(restored,{...original,ratio:'16:9'},'real hydration must leave all hard-context fields exact');
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await page.getByRole('button',{name:'Review & use',exact:true}).click();
  await page.getByRole('button',{name:'Use with current settings',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue(proposed);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue(original.prompt);
  assert.equal(requests.length,1);assert.deepEqual(await page.evaluate(()=>(globalThis as any).formRuns),[]);
 }finally{await browser.close();await fixture.close();}
});

test('real Image adapter refuses strong changes during review, including revert and reload',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,hostModules,assistanceLive:true}),browser=await chromium.launch();
 try{for(const [name,patch] of Object.entries({model:{engineId:config.otherEngine.id},mode:{mode:'i2i'},source:{maskUrl:'/synthetic-mask-a.svg'},reference:{assets:{image_urls:[{id:'synthetic-reference',name:'Synthetic image',url:'/synthetic-reference.svg',kind:'image',status:'ready',assetId:'synthetic-reference'}]}},role:{role:'other_image_role'},editor:{prompt:'Later human work'},account:{owner:'other'},resolution:{resolution:'4k'},quality:{quality:'high'},count:{numImages:2},seed:{seed:'42'}})){
  const page=await browser.newPage();const requests=await mockServices(page);await page.goto(fixture.url);await ask(page);await change(page,{ratio:'16:9'});await page.getByRole('button',{name:'Review & use',exact:true}).click();
  const confirmation=page.getByRole('button',{name:'Use with current settings',exact:true});await expect(confirmation).toBeEnabled();await change(page,patch);
  if(name==='account'||name==='mode')await expect(confirmation).toHaveCount(0);else await expect(confirmation).toBeDisabled();
  await expect(page.getByRole('button',{name:'Review changes',exact:true})).toHaveCount(0);
  if(name!=='account'&&name!=='mode'){
   await change(page,{engineId:config.engine.id,maskUrl:'',assets:{},role:'image_urls',prompt:'Original synthetic manual image prompt.',resolution:'2k',quality:null,numImages:1,seed:''});
   await expect(confirmation).toBeDisabled();await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.getByRole('button',{name:'Review & use',exact:true})).toHaveCount(0);
  }
  assert.equal(requests.length,1,name);assert.deepEqual(await page.evaluate(()=>(globalThis as any).formRuns),[],name);await page.close();
 }}finally{await browser.close();await fixture.close();}
});
