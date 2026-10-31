import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import test from 'node:test';
import {chromium,expect} from '@playwright/test';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {sortImageWorkspaceEngineOptions} from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-engine-options';
import {startDisposablePostgres} from './helpers/disposable-postgres';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {initialStatus} from './helpers/milo-status-fixture';
import {imageWorkspaceReloadBrowserSource as source,imageWorkspaceReloadHostModules as hostModules} from './helpers/image-workspace-reload-browser-source';

const manual='An empty synthetic sports hall in soft indoor light.';
const settings={seed:'',style:null,quality:null,numImages:1,watermark:false,background:null,resolution:'1k',aspectRatio:'1:1',outputFormat:null,thinkingLevel:'medium',enableWebSearch:false,customImageWidth:'',limitGenerations:false,customImageHeight:''};
const publicCase={draft:{mode:'t2i',text:manual,target:'prompt',surface:'image',engineId:'nano-banana-2-1',settings,workflow:'create',references:[],readOnlyText:{}},message:'A new photographic portrait of a synthetic sports referee.',reply:{text:'A natural square photographic portrait in an empty sports hall.',reply:'Review this square composition.'}};
const owner='image-reload-owner',chatKey=`milo-composer:v2:${JSON.stringify([owner,'image','create'])}`,formKey=`maxvideoai.image.composer.v1:${owner}`;

for(const variant of ['selected-model','default-catalog','custom-to-nano','unchanged-nano','custom-unchanged','custom-size-guard'])test(variant==='custom-size-guard'?'full Image workspace restores supported custom dimensions and refuses their changes':`full Image workspace preserves serialized context on reload (${variant})`,{timeout:90_000},async t=>{
 // Optional local-only replay reads request/reply facts from evidence; no private content is a repository fixture.
 const receiptPath=process.env.R07_IMAGE_RECEIPT_PATH;
 const receipt=receiptPath?JSON.parse(await readFile(receiptPath,'utf8')):null;
 const gptCase=variant==='custom-size-guard'||variant==='custom-unchanged';
 const scenario=receipt&&!gptCase?{draft:receipt.input_json.draft,message:receipt.input_json.message,reply:receipt.reply_json}:publicCase;
 const pg=await startDisposablePostgres('image-owner-reload');
 const oldDatabase=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
 const {getDb}=await import('../frontend/src/lib/db');
 t.after(async()=>{await getDb().end();if(oldDatabase===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldDatabase;await pg.cleanup();});
 // The actual read owner receives JSONB rows in its production shape, without model/provider/billing services.
 await pg.pool.query(`CREATE TABLE prompt_assistance_sessions(user_id text,id uuid,scope text,expires_at timestamptz);CREATE TABLE prompt_assistance_requests(user_id text,session_id uuid,request_id uuid,state text,input_json jsonb,reply_json jsonb,created_at timestamptz DEFAULT clock_timestamp());`);
 const {readPromptSession}=await import('../frontend/src/server/prompt-assistance/sessions');
 const all=listFalEngines(),custom=variant.startsWith('custom-');
 const selected=variant==='default-catalog'?all.filter(x=>x.category==='image'):custom?[all.find(x=>x.id==='gpt-image-2')!,all.find(x=>x.id===scenario.draft.engineId)!]:[all.find(x=>x.id===scenario.draft.engineId)!];
 const options=selected.map(entry=>({id:entry.id,name:entry.marketingName,engineCaps:entry.engine,modes:entry.modes.map(x=>x.mode).filter(x=>x==='t2i'||x==='i2i'),aliases:[entry.id],prompts:[],pricePerImage:0.07,currency:'USD'}));
 const engines=variant==='default-catalog'?sortImageWorkspaceEngineOptions(options):options;
 const fixture=await startWorkspaceReferenceFixture({source,config:{engines,query:variant==='default-catalog'?`engine=${scenario.draft.engineId}`:''},hostModules,assistanceLive:true}),browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:1000}}),requests:any[]=[],errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/prompt-assistance*',async route=>{
   const url=new URL(route.request().url());
   if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:url.searchParams.has('sessionId')?await readPromptSession(owner,url.searchParams.get('sessionId')!,'image:create'):initialStatus}});
   const body=route.request().postDataJSON();assert.equal(body.action,'message','only the simulated initial exchange is admitted');const request=body.request;requests.push(request);
   if(gptCase){assert.equal(request.draft.engineId,'gpt-image-2');assert.equal(request.draft.settings.customImageWidth,'1536');assert.equal(request.draft.settings.customImageHeight,'1024');}
   else assert.deepEqual(request.draft,scenario.draft,'the real form must produce the evidenced request shape and settings');
   await pg.pool.query("INSERT INTO prompt_assistance_sessions VALUES($1,$2,'image:create',clock_timestamp()+interval '1 day')",[owner,request.sessionId]);
   await pg.pool.query("INSERT INTO prompt_assistance_requests(user_id,session_id,request_id,state,input_json,reply_json) VALUES($1,$2,$3,'complete',$4::jsonb,$5::jsonb)",[owner,request.sessionId,request.requestId,JSON.stringify(request),JSON.stringify(scenario.reply)]);
   return route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,requestId:request.requestId,draftRevision:request.draftRevision,target:'prompt',message:request.message,state:'complete',reply:scenario.reply,assistance:initialStatus}}});
  });
  await page.route('**/api/images/estimate',route=>route.fulfill({json:{ok:true,pricing:{totalCents:7,currency:'USD'}}}));
  await page.route('**/api/images/generate*',()=>{throw Error('Media generation forbidden in local replay');});
  await page.goto(fixture.url);await expect(page.locator('form.app-image-composer')).toBeVisible();
  if(custom){
   await page.getByRole('button',{name:/^Resolution:/}).click();await page.getByRole('option',{name:/Custom/}).click();await page.getByRole('button',{name:'Options',exact:true}).click();
   await page.getByRole('spinbutton',{name:'Width',exact:true}).fill('1536');await page.getByRole('spinbutton',{name:'Height',exact:true}).fill('1024');
   await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'null')?.customImageSize,formKey)).toEqual({width:1536,height:1024});
   if(variant==='custom-to-nano'){
    await page.getByRole('button',{name:/^Change model:/}).click();await page.getByRole('searchbox',{name:'Search models',exact:true}).fill('Nano Banana 2.1');
    await page.locator('[data-model-id="nano-banana-2-1"]').getByRole('button',{name:/^Choose /}).click();
    await page.getByRole('button',{name:/^Resolution:/}).click();await page.getByRole('option',{name:/1K/}).click();
    await page.getByRole('button',{name:/^Format:/}).click();await page.getByRole('option',{name:/1:1/}).click();
   }
  }
  await page.locator('[data-workspace-prompt]').fill(scenario.draft.text);
  const form=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'null'),formKey);
  const chat=()=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)??'null'),chatKey);
  await expect.poll(async()=>(await form())?.prompt).toBe(scenario.draft.text);
  const before=await page.evaluate(()=>(globalThis as any).imageOwnerFrames.at(-1));assert.equal(before.customImageWidth,gptCase?'1536':'');assert.equal(before.customImageHeight,gptCase?'1024':'');
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill(scenario.message);await page.getByRole('button',{name:'Send message to Milo',exact:true}).click();
  await expect(page.locator('[data-assistance-apply]')).toBeEnabled();await expect.poll(async()=>!!(await chat())?.local?.proposal?.review).toBe(true);
  if(variant==='unchanged-nano'||variant==='custom-unchanged'){
   const proof=(await chat()).local.proposal.review;
   await page.reload();await expect(page.locator('form.app-image-composer')).toBeVisible();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.locator('[data-assistance-proposal]')).toBeVisible();
   const after=await page.evaluate(()=>(globalThis as any).imageOwnerFrames.at(-1));
   if(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR){const prefix=`${receipt&&!gptCase?'r07':'public'}-${variant}`;await writeFile(join(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,`${prefix}-real-owner-state.json`),JSON.stringify({before,after,serializedForm:await form(),proofBefore:proof,chatAfter:await chat()},null,2));await page.screenshot({path:join(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,`${prefix}-real-owner-after-reload.png`),fullPage:true});}
   await expect(page.getByRole('button',{name:'Use prompt',exact:true})).toBeEnabled();assert.deepEqual(after,before,'no user edit may be invented by hydration');
   await page.getByRole('button',{name:'Use prompt',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue(scenario.reply.text);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue(scenario.draft.text);assert.equal(requests.length,1);assert.deepEqual(errors,[]);return;
  }
  if(variant==='custom-size-guard'){
   await page.getByRole('tab',{name:'Prompt',exact:true}).click();await page.getByRole('spinbutton',{name:'Width',exact:true}).fill('1600');
   await expect.poll(async()=>(await form())?.customImageSize).toEqual({width:1600,height:1024});
   await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.locator('[data-assistance-apply]')).toBeDisabled();await expect(page.getByRole('button',{name:'Review & use',exact:true})).toHaveCount(0);
   await page.reload();await expect(page.locator('form.app-image-composer')).toBeVisible();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.locator('[data-assistance-proposal]')).toBeVisible();
   const after=await page.evaluate(()=>(globalThis as any).imageOwnerFrames.at(-1));
   assert.deepEqual([after.selectedEngineId,after.mode,after.resolution,after.customImageWidth,after.customImageHeight],['gpt-image-2','t2i','custom','1600','1024']);
   await expect(page.locator('[data-assistance-apply]')).toBeDisabled();await expect(page.getByRole('button',{name:'Review & use',exact:true})).toHaveCount(0);assert.equal(requests.length,1);assert.deepEqual(errors,[]);return;
  }
  await page.getByRole('button',{name:/^Format:/}).click();await page.getByRole('option',{name:/16:9/}).click();await expect(page.getByRole('button',{name:'Review & use',exact:true})).toBeEnabled();
  await expect.poll(async()=>(await form())?.aspectRatio).toBe('16:9');assert.equal((await form()).customImageSize,null);
  const proof=(await chat()).local.proposal.review;
  await page.reload();await expect(page.locator('form.app-image-composer')).toBeVisible();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.locator('[data-assistance-proposal]')).toBeVisible();
  const after=await page.evaluate(()=>(globalThis as any).imageOwnerFrames.at(-1));
  if(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR){const prefix=`${receipt?'r07':'public'}-${variant}`;await writeFile(join(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,`${prefix}-real-owner-state.json`),JSON.stringify({before,after,serializedForm:await form(),proofBefore:proof,chatAfter:await chat(),framesAfter:await page.evaluate(()=>(globalThis as any).imageOwnerFrames)},null,2));await page.screenshot({path:join(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,`${prefix}-real-owner-after-reload.png`),fullPage:true});}
  assert.deepEqual(after,{...before,aspectRatio:'16:9'},'real hydration must preserve every hard-context field before proof restoration');
  assert.equal((await chat()).local.proposal.review?.compatible,true);
  assert.equal((await page.locator('[data-assistance-proposal]').boundingBox())!.height,53);
  await page.getByRole('button',{name:'Review & use',exact:true}).click();await expect(page.locator('[data-assistance-settings-changes]')).toContainText('1:1');await expect(page.locator('[data-assistance-settings-changes]')).toContainText('16:9');
  await page.getByRole('button',{name:'Use with current settings',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue(scenario.reply.text);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue(scenario.draft.text);
  await expect(page.getByRole('button',{name:/^Format:.*16:9/})).toBeVisible();assert.equal(requests.length,1);assert.deepEqual(errors,[]);
 }finally{await browser.close();await fixture.close();}
});
