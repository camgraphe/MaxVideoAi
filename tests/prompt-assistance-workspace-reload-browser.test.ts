import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {join} from 'node:path';
import {chromium,webkit,expect} from '@playwright/test';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {canonicalPromptDraft} from '../frontend/src/lib/prompt-assistance/session';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {initialStatus} from './helpers/milo-status-fixture';
import {promptAssistanceReloadBrowserSource as source} from './helpers/prompt-assistance-reload-browser-source';

const prompt='Static documentary shot of a remote weather station on a snowy ridge. A technician checks the wind gauge under flat morning light.';
const proposed='A funny, casual smartphone video. A friend celebrates a board-game win before realizing he has lost.';
const config={engine:listFalEngines().find(x=>x.id==='wan-3-prime')!.engine,otherEngine:listFalEngines().find(x=>x.id==='wan-3')!.engine};

for(const browserType of [chromium,webkit])test(`settings review survives a real workspace draft reload after clarification and a scalar change (${browserType.name()})`,{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true}),browser=await browserType.launch();
 try{
  const page=await browser.newPage({viewport:{width:browserType===webkit?390:1440,height:900}});const requests:any[]=[],errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({prompt})=>{const key='maxvideoai.generate.form.v1:owner';if(localStorage.getItem(key)===null){localStorage.setItem(key,JSON.stringify({engineId:'wan-3-prime',mode:'t2v',durationSec:6,durationOption:6,resolution:'720p',aspectRatio:'auto',audio:false}));localStorage.setItem('maxvideoai.generate.prompt.v1:owner',prompt);}}, {prompt});
  await page.route('**/api/prompt-assistance*',route=>{
   const url=new URL(route.request().url());
   if(route.request().method()==='GET'){
    if(!url.searchParams.has('sessionId'))return route.fulfill({json:{ok:true,result:initialStatus}});
    const request=requests.at(-1);assert.ok(request);assert.equal(url.searchParams.get('sessionId'),request.sessionId);
    return route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,scope:'video:create',status:'active',turns:requests.map((r,index)=>({requestId:r.requestId,message:r.message,reply:index?'Choose 9:16 in the settings.':'Reuse the existing draft or start a new idea?'})),pending:null,proposal:{text:proposed,draftFingerprint:createHash('sha256').update(canonicalPromptDraft(request.draft)).digest('hex')}}}});
   }
   const {request}=route.request().postDataJSON();requests.push(request);
   return route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,requestId:request.requestId,draftRevision:request.draftRevision,target:request.draft.target,message:request.message,state:'complete',reply:{reply:requests.length===1?'Reuse the existing draft or start a new idea?':'Choose 9:16 in the settings.',text:requests.length===1?null:proposed},assistance:initialStatus}}});
  });
  await page.goto(fixture.url);await expect(page.locator('[data-workspace-prompt]')).toHaveValue(prompt);
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  for(const [index,message] of ['A funny phone clip for TikTok','A new idea: a friend celebrates before seeing he lost the board game'].entries()){
   await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill(message);await page.getByRole('button',{name:'Send message to Milo',exact:true}).click();await expect(page.getByText(index===0?'Reuse the existing draft or start a new idea?':'Choose 9:16 in the settings.',{exact:true})).toBeVisible();
   if(index===0)await expect(page.locator('[data-assistance-proposal]')).toHaveCount(0);
  }
  assert.notEqual(requests[0].requestId,requests[1].requestId);
  await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
  await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('9:16');await page.getByRole('button',{name:'Review & use',exact:true}).click();
  await expect(page.getByRole('button',{name:'Use with current settings',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Conversation',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('milo-composer:v2:["owner","video","create"]')??'null')?.local?.proposal?.review?.compatible)).toBe(true);
  const proof=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('milo-composer:v2:["owner","video","create"]')!).local.proposal.review);
  assert.equal(proof.requestId,requests[1].requestId);assert.equal(proof.settings.aspectRatio,'auto');
  await page.reload();await expect(page.locator('[data-workspace-prompt]')).toHaveValue(prompt);await expect(page.getByRole('combobox',{name:'Aspect ratio',exact:true})).toHaveValue('9:16');
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.getByText('Choose 9:16 in the settings.',{exact:true})).toBeVisible();
  const restoredProof=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('milo-composer:v2:["owner","video","create"]')!).local.proposal.review);
  assert.ok(restoredProof,'workspace restoration must retain the modern review proof');
  assert.equal(restoredProof.compatible,true);assert.equal(restoredProof.compatibilityFingerprint,proof.compatibilityFingerprint);
  assert.equal((await page.locator('[data-assistance-proposal]').boundingBox())!.height,53);
  await page.getByRole('button',{name:'Review & use',exact:true}).click();
  await expect(page.locator('[data-assistance-settings-changes]')).toContainText('Auto');await expect(page.locator('[data-assistance-settings-changes]')).toContainText('9:16');
  await expect(page.locator('[data-workspace-prompt]')).toHaveValue(prompt);
  if(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR)await page.screenshot({path:join(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,`workspace-reload-review-${browserType.name()}.png`),fullPage:true});
  await page.getByRole('button',{name:'Use with current settings',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue(proposed);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue(prompt);await expect(page.getByRole('combobox',{name:'Aspect ratio',exact:true})).toHaveValue('9:16');
  assert.deepEqual(await page.evaluate(()=>{const {engineId,mode,durationSec,resolution,aspectRatio,audio}=(globalThis as any).workspaceProbe.form;return {engineId,mode,durationSec,resolution,aspectRatio,audio};}),{engineId:'wan-3-prime',mode:'t2v',durationSec:6,resolution:'720p',aspectRatio:'9:16',audio:false});
  if(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR)await page.screenshot({path:join(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,`workspace-reload-undo-${browserType.name()}.png`),fullPage:true});
  assert.equal(requests.length,2,'reload, review, application and Undo cannot send another paid message');assert.deepEqual(errors,[]);
 }finally{await browser.close();await fixture.close();}
});
