import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium,webkit,expect,type Page} from '@playwright/test';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {initialStatus} from './helpers/milo-status-fixture';

const source=`import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {Composer} from './components/Composer';import {I18nProvider} from './lib/i18n/I18nProvider';
import {videoPromptReviewKey} from './src/lib/prompt-assistance/application-review';
const config=globalThis.fixtureConfig;
function Fixture(){const [text,setText]=useState('Original manual prompt'),[ratio,setRatio]=useState('auto'),[duration,setDuration]=useState(7),[model,setModel]=useState(config.engine),[owner,setOwner]=useState('owner'),[identity,setIdentity]=useState('source-a');
const form={engineId:model.id,mode:'t2v',durationSec:duration,durationOption:duration,resolution:'720p',aspectRatio:ratio,fps:30,iterations:1,audio:true,extraInputValues:{}};
const context={form,klingElements:[],voiceIdsInput:'',voiceControlEnabled:false,multiPromptEnabled:false,sourceIdentity:identity};
return <I18nProvider locale={config.locale??'en'} dictionary={{}} fallback={{}}><main style={{maxWidth:900,margin:'20px auto',padding:16}}>
<label>Aspect ratio<select aria-label="Aspect ratio" value={ratio} onChange={e=>setRatio(e.target.value)}><option value="auto">Auto</option><option value="9:16">9:16</option><option value="16:9">16:9</option></select></label>
<label>Duration<select aria-label="Duration" value={duration} onChange={e=>setDuration(Number(e.target.value))}><option value={7}>7 seconds</option><option value={8}>8 seconds</option></select></label>
<button onClick={()=>setModel(config.otherEngine)}>Change model</button><button onClick={()=>setOwner('another')}>Change account</button><button onClick={()=>setIdentity('source-b')}>Replace source</button><button onClick={()=>setIdentity('source-a')}>Restore source</button><button onClick={()=>setText('New manual work')}>Edit manual draft</button>
<Composer density="workspace" engine={model} activeManualMode="t2v" prompt={text} onPromptChange={setText} assetFields={[]} assets={{}} price={1.23} currency="USD" isLoading={false} onGenerate={()=>{globalThis.generations=(globalThis.generations??0)+1}}
assistance={{accountKey:owner,scopeKey:JSON.stringify([owner,'video','create']),contextKey:JSON.stringify(context),reviewKey:videoPromptReviewKey(context),live:{surface:'video',workflow:'create',engineId:model.id,mode:'t2v',settings:{durationSec:duration,durationOption:duration,aspectRatio:ratio,audio:true},references:[]}}}/>
</main></I18nProvider>};createRoot(document.getElementById('root')).render(<Fixture/>);`;
const config={engine:listFalEngines().find(x=>x.id==='wan-3')!.engine,otherEngine:listFalEngines().find(x=>x.id==='wan-3-prime')!.engine};
const proposed='A funny vertical seven-second phone video. One continuous shot.';
async function ask(page:Page){await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('A funny phone clip');await page.getByRole('button',{name:'Send message to Milo',exact:true}).click();}
const complete=(request:any,text:string|null=proposed)=>({ok:true,result:{sessionId:request.sessionId,requestId:request.requestId,draftRevision:request.draftRevision,target:'prompt',message:request.message,state:'complete',reply:{reply:'Choose 9:16 in the settings.',text},assistance:initialStatus}});

test('settings review uses the existing prompt view, keeps the bar compact and applies only explicitly with current settings',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true});
 try{for(const browserType of [chromium,webkit]){const browser=await browserType.launch({headless:true});try{for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});let posts=0;const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/prompt-assistance*',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:initialStatus}});posts++;return route.fulfill({json:complete(route.request().postDataJSON().request)});});
  await page.goto(fixture.url);await ask(page);await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
  const bar=page.locator('[data-assistance-proposal]');assert.equal((await bar.boundingBox())!.height,53);
  await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('9:16');
  const review=page.getByRole('button',{name:'Review & use',exact:true});await expect(review).toBeEnabled();assert.equal((await bar.boundingBox())!.height,53);
  await review.click();await expect(page.locator('[data-assistance-editor]')).toHaveValue(proposed);await expect(page.locator('[data-workspace-prompt]')).toHaveValue('Original manual prompt');
  const changes=page.locator('[data-assistance-settings-changes]');await expect(changes).toContainText('Aspect ratio');await expect(changes).toContainText('Auto');await expect(changes).toContainText('9:16');
  await page.locator('[data-assistance-editor]').fill('x'.repeat(20001));await expect(page.getByRole('button',{name:'Use with current settings',exact:true})).toBeDisabled();
  await page.locator('[data-assistance-editor]').fill('My edited vertical phone clip.');
  if(browserType===chromium){await page.keyboard.press('Tab');await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Use with current settings',exact:true})).toBeFocused();}
  await page.getByRole('button',{name:'Conversation',exact:true}).click();await review.click();
  await expect(page.getByRole('button',{name:'Use with current settings',exact:true})).toBeEnabled();
  await page.getByRole('combobox',{name:'Duration',exact:true}).selectOption('8');
  await expect(page.getByRole('button',{name:'Use with current settings',exact:true})).toBeDisabled();
  await expect(page.getByText('Settings changed again. Review them before applying.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Review changes',exact:true}).click();
  await expect(changes.getByText('Duration', {exact:true})).toHaveCount(1);await expect(changes).not.toContainText('durationOption');
  if(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR)await page.screenshot({path:process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR+`/settings-review-${browserType.name()}-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Use with current settings',exact:true}).click();
  await expect(page.locator('[data-workspace-prompt]')).toHaveValue('My edited vertical phone clip.');
  await expect(page.getByRole('combobox',{name:'Aspect ratio',exact:true})).toHaveValue('9:16');await expect(page.getByRole('combobox',{name:'Duration',exact:true})).toHaveValue('8');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue('Original manual prompt');
  await expect(page.getByRole('combobox',{name:'Aspect ratio',exact:true})).toHaveValue('9:16');await expect(page.getByRole('combobox',{name:'Duration',exact:true})).toHaveValue('8');
  assert.equal(posts,1,'review and application must not send another assistance request');assert.equal(await page.evaluate(()=>(globalThis as any).generations??0),0);
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.close();
 }}finally{await browser.close();}}}finally{await fixture.close();}
});

for(const action of ['Change model','Replace source','Edit manual draft','Change account'])test(`${action} during review cannot confirm the old proposal`,{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true});const browser=await chromium.launch();
 try{const page=await browser.newPage();await page.route('**/api/prompt-assistance*',route=>route.request().method()==='GET'?route.fulfill({json:{ok:true,result:initialStatus}}):route.fulfill({json:complete(route.request().postDataJSON().request)}));
 await page.goto(fixture.url);await ask(page);await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
 await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('9:16');await page.getByRole('button',{name:'Review & use',exact:true}).click();
 await expect(page.getByRole('button',{name:'Use with current settings',exact:true})).toBeEnabled();await page.getByRole('button',{name:action,exact:true}).click();
 if(action==='Change account'){await expect(page.getByRole('tab',{name:'Prompt',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('[data-assistance-proposal]')).toHaveCount(0);}else{
 await expect(page.getByRole('button',{name:'Use with current settings',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Review changes',exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'Prompt',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue(action==='Edit manual draft'?'New manual work':'Original manual prompt');}
 }finally{await browser.close();await fixture.close();}
});

test('a completed modern local proof survives reload without persisting the hard-context payload',{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true});const browser=await chromium.launch();
 try{const page=await browser.newPage();let request:any,posts=0;const {createHash}=await import('node:crypto');const {canonicalPromptDraft}=await import('../frontend/src/lib/prompt-assistance/session');
 await page.route('**/api/prompt-assistance*',route=>{
  const url=new URL(route.request().url());
  if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:url.searchParams.has('sessionId')?{sessionId:request.sessionId,scope:'video:create',status:'active',turns:[{requestId:request.requestId,message:request.message,reply:'Choose 9:16 in the settings.'}],pending:null,proposal:{text:proposed,draftFingerprint:createHash('sha256').update(canonicalPromptDraft(request.draft)).digest('hex')}}:initialStatus}});
  posts++;request=route.request().postDataJSON().request;return route.fulfill({json:complete(request)});
 });
 await page.goto(fixture.url);await ask(page);await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
 const saved=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('milo-composer:v2:["owner","video","create"]')??'null'));
 await expect.poll(async()=>!!(await saved())?.local?.proposal?.review).toBe(true);
 const proof=(await saved()).local.proposal.review;
 assert.deepEqual(Object.keys(proof).sort(),['version','requestId','compatibilityFingerprint','compatible','settings'].sort());assert.match(proof.compatibilityFingerprint,/^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(proof).includes('Original manual prompt'));assert.ok(!JSON.stringify(proof).includes('source-a'));
 await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
 await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('9:16');await page.getByRole('button',{name:'Review & use',exact:true}).click();
 await expect(page.getByRole('button',{name:'Use with current settings',exact:true})).toBeEnabled();assert.equal(posts,1);
 // Removing a proof emulates a historical cache: do not manufacture a baseline from a draft hash.
 await page.evaluate(()=>{const key='milo-composer:v2:["owner","video","create"]';const saved=JSON.parse(sessionStorage.getItem(key)!);delete saved.local.proposal.review;sessionStorage.setItem(key,JSON.stringify(saved));});
 await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.locator('[data-assistance-proposal]')).toBeVisible();
 await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('9:16');await expect(page.getByRole('button',{name:'Review & use',exact:true})).toHaveCount(0);await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
 }finally{await browser.close();await fixture.close();}
});

test('pending and recovery block review, and recovery on the original mounted request retains its baseline',{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true});const browser=await chromium.launch();let release:(()=>void)|undefined;
 try{const page=await browser.newPage();let request:any,posts=0;
 await page.route('**/api/prompt-assistance*',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:initialStatus}});
  const body=route.request().postDataJSON();posts++;
  if(body.action==='message'){request=body.request;if(posts===1)return route.abort('failed');await new Promise<void>(resolve=>release=resolve);}
  return route.fulfill({json:complete(request)});
 });
 await page.goto(fixture.url);await ask(page);await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();await page.getByRole('button',{name:'Check reply',exact:true}).click();
 await expect(page.locator('[data-assistance-apply]')).toBeEnabled();await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('9:16');await page.getByRole('button',{name:'Review & use',exact:true}).click();
 await expect(page.getByRole('button',{name:'Use with current settings',exact:true})).toBeEnabled();
 await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('Another refinement');await page.getByRole('button',{name:'Send message to Milo',exact:true}).click();
 await expect.poll(()=>!!release).toBe(true);await expect(page.getByRole('button',{name:'Use with current settings',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'New chat',exact:true})).toBeDisabled();release?.();await expect(page.locator('[data-assistance-apply]')).toBeEnabled();assert.equal(posts,3);
 }finally{release?.();await browser.close();await fixture.close();}
});

test('French and Spanish review actions fit the existing narrow bar',{timeout:60_000},async()=>{
 for(const [locale,assistant,send,review,confirm] of [['fr','Assistant IA','Envoyer à Milo','Vérifier et utiliser','Utiliser avec ces réglages'],['es','Asistente de IA','Enviar a Milo','Revisar y usar','Usar con estos ajustes']]){
 const fixture=await startWorkspaceReferenceFixture({source,config:{...config,locale},assistanceLive:true});const browser=await webkit.launch();
 try{const page=await browser.newPage({viewport:{width:320,height:844},isMobile:true,hasTouch:true});await page.route('**/api/prompt-assistance*',route=>route.request().method()==='GET'?route.fulfill({json:{ok:true,result:initialStatus}}):route.fulfill({json:complete(route.request().postDataJSON().request)}));
 await page.goto(fixture.url);await page.getByRole('tab',{name:assistant,exact:true}).click();await page.locator('[data-assistance-message]').fill('A funny phone clip');await page.getByRole('button',{name:send,exact:true}).click();await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
 await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('9:16');await expect(page.getByRole('button',{name:review,exact:true})).toBeEnabled();assert.equal((await page.locator('[data-assistance-proposal]').boundingBox())!.height,53);await page.getByRole('button',{name:review,exact:true}).click();await expect(page.getByRole('button',{name:confirm,exact:true})).toBeEnabled();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const confirmation=page.getByRole('button',{name:confirm,exact:true});await confirmation.focus();await expect(confirmation).toBeFocused();const box=await confirmation.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=844,'focus keeps confirmation reachable in the mobile viewport');await confirmation.press('Enter');await expect(page.locator('[data-workspace-prompt]')).toHaveValue(proposed);
 }finally{await browser.close();await fixture.close();}
 }
});


test('a clarification without text cannot lend its identity to the later reviewable proposal',{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true});const browser=await chromium.launch();
 try{const page=await browser.newPage();const requests:any[]=[];
 await page.route('**/api/prompt-assistance*',route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:initialStatus}});
  const request=route.request().postDataJSON().request;requests.push(request);const response=complete(request,requests.length===1?null:proposed);
  if(requests.length===1)response.result.reply.reply='Which comic subject do you want?';
  return route.fulfill({json:response});
 });
 await page.goto(fixture.url);await ask(page);await expect(page.getByText('Which comic subject do you want?',{exact:true})).toBeVisible();await expect(page.locator('[data-assistance-proposal]')).toHaveCount(0);
 await ask(page);await expect(page.locator('[data-assistance-apply]')).toBeEnabled();assert.notEqual(requests[0].requestId,requests[1].requestId);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('milo-composer:v2:["owner","video","create"]')??'null')?.local?.proposal?.review?.requestId)).toBe(requests[1].requestId);
 await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('9:16');await page.getByRole('button',{name:'Review & use',exact:true}).click();await page.getByRole('button',{name:'Use with current settings',exact:true}).click();
 await expect(page.locator('[data-workspace-prompt]')).toHaveValue(proposed);assert.equal(requests.length,2);
 }finally{await browser.close();await fixture.close();}
});


test('hard invalidation revokes durable eligibility synchronously and late digests cannot revive it after reload',{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true});const browser=await chromium.launch();
 try{const page=await browser.newPage();let request:any;const {createHash}=await import('node:crypto');const {canonicalPromptDraft}=await import('../frontend/src/lib/prompt-assistance/session');
 await page.route('**/api/prompt-assistance*',route=>{
  const url=new URL(route.request().url());
  if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:url.searchParams.has('sessionId')?{sessionId:request.sessionId,scope:'video:create',status:'active',turns:[{requestId:request.requestId,message:request.message,reply:'Choose 9:16 in the settings.'}],pending:null,proposal:{text:proposed,draftFingerprint:createHash('sha256').update(canonicalPromptDraft(request.draft)).digest('hex')}}:initialStatus}});
  request=route.request().postDataJSON().request;return route.fulfill({json:complete(request)});
 });
 await page.goto(fixture.url);await ask(page);await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
 const proof=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('milo-composer:v2:["owner","video","create"]')??'null')?.local?.proposal?.review);
 await expect.poll(async()=>(await proof())?.compatible).toBe(true);
 await page.evaluate(()=>{const digest=crypto.subtle.digest.bind(crypto.subtle),waiting:(()=>Promise<void>)[]=[];crypto.subtle.digest=((...args:Parameters<SubtleCrypto['digest']>)=>new Promise<ArrayBuffer>((resolve,reject)=>waiting.push(async()=>{try{resolve(await digest(...args));}catch(error){reject(error);}}))) as SubtleCrypto['digest'];(globalThis as any).releaseDigests=async()=>{const all=waiting.splice(0);await Promise.all(all.map(run=>run()));};});
 await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('An unsent message starts a delayed compatible save');
 await page.getByRole('button',{name:'Replace source',exact:true}).click();
 assert.equal((await proof()).compatible,false,'revocation must happen before any digest can complete');
 await page.getByRole('button',{name:'Restore source',exact:true}).click();await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('9:16');await expect(page.getByRole('button',{name:'Review & use',exact:true})).toHaveCount(0);
 await page.evaluate(()=>(globalThis as any).releaseDigests());assert.equal((await proof()).compatible,false,'late saves must not restore the earlier proof');
 await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.locator('[data-assistance-proposal]')).toBeVisible();
 await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('9:16');await expect(page.getByRole('button',{name:'Review & use',exact:true})).toHaveCount(0);await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
 }finally{await browser.close();await fixture.close();}
});

test('cached original settings must match the server proposal draft fingerprint',{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true});const browser=await chromium.launch();
 try{const page=await browser.newPage();let request:any;const {createHash}=await import('node:crypto');const {canonicalPromptDraft}=await import('../frontend/src/lib/prompt-assistance/session');
 await page.route('**/api/prompt-assistance*',route=>{
  const url=new URL(route.request().url());
  if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:url.searchParams.has('sessionId')?{sessionId:request.sessionId,scope:'video:create',status:'active',turns:[{requestId:request.requestId,message:request.message,reply:'Choose 9:16 in the settings.'}],pending:null,proposal:{text:proposed,draftFingerprint:createHash('sha256').update(canonicalPromptDraft(request.draft)).digest('hex')}}:initialStatus}});
  request=route.request().postDataJSON().request;return route.fulfill({json:complete(request)});
 });
 await page.goto(fixture.url);await ask(page);await expect(page.locator('[data-assistance-apply]')).toBeEnabled();await expect.poll(()=>page.evaluate(()=>!!JSON.parse(sessionStorage.getItem('milo-composer:v2:["owner","video","create"]')??'null')?.local?.proposal?.review)).toBe(true);
 await page.evaluate(()=>{const key='milo-composer:v2:["owner","video","create"]';const saved=JSON.parse(sessionStorage.getItem(key)!);saved.local.proposal.review.settings.durationSec=999;sessionStorage.setItem(key,JSON.stringify(saved));});
 await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.locator('[data-assistance-proposal]')).toBeVisible();await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('9:16');await expect(page.getByRole('button',{name:'Review & use',exact:true})).toHaveCount(0);
 }finally{await browser.close();await fixture.close();}
});
