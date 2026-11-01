import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalPromptDraft} from '../frontend/src/lib/prompt-assistance/session';
import test from 'node:test';
import {chromium,webkit,expect,type Page} from '@playwright/test';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {studioCreditTariffForModel} from '../frontend/src/lib/studio/assistance-contract';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {initialStatus} from './helpers/milo-status-fixture';
import {miloGenerationVideoSource} from './helpers/milo-generation-authorization-video-source';
import {miloGenerationAudioSource,miloGenerationImageSource,miloGenerationRealImageSource} from './helpers/milo-generation-authorization-hosts';

const OLD='A quiet cinematic shot of neon-lit Tokyo streets in the rain';
const PROPOSED='A festive Mariazell train advert with clear German narration.';
const BEFORE='Continue with Milo to prepare a prompt, or open the Prompt tab.';
const READY='Use Milo’s prompt, or open the Prompt tab to review the text to generate.';
const status={...initialStatus,selectedModel:'gpt-6.1-sol',mode:'included_sol',tariff:studioCreditTariffForModel('gpt-6.1-sol')};
const engine=listFalEngines().find(entry=>entry.id==='kling-v4')!.engine;
const config={engine,nextEngine:listFalEngines().find(entry=>entry.id==='seedance-2-5')!.engine,
 form:{engineId:'kling-v4',mode:'ref2v',durationSec:30,durationOption:30,resolution:'720p',aspectRatio:'16:9',fps:24,iterations:1,audio:true,seedLocked:false,loop:false,extraInputValues:{}},
 inputAssets:{image_urls:Array.from({length:7},(_,i)=>({id:`synthetic-${i}`,assetId:`synthetic-${i}`,fieldId:'image_urls',kind:'image',status:'ready',name:`Reference ${i}.svg`,url:`/reference-${i}.svg`,previewUrl:`/reference-${i}.svg`,type:'image/svg+xml',size:1000,width:1280,height:720}))},
 preflight:{ok:true,currency:'USD',total:707,pricing:{totalCents:707,currency:'USD'}}};
const nextHost={
 'next/link':`import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>;}`,
 'next/image':`import React from 'react';export default function Image({fill,priority,unoptimized,...props}){return <img {...props}/>;}`,
 'next/navigation':`const params=new URLSearchParams(location.search),router={push(){},replace(){},prefetch(){}};export function useSearchParams(){return params;}export function usePathname(){return '/app/audio';}export function useRouter(){return router;}export function redirect(){throw Error('Unexpected navigation');}export const permanentRedirect=redirect;`,
 '@/lib/supabaseClient':`export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'synthetic-local-token',user:{id:'owner'}}},error:null})}};`,
};
async function setup(page:Page,origin:string){
 const generated:any[]=[],milo:any[]=[],unexpected:string[]=[],errors:string[]=[];
 let reply:'failed'|'null'|'proposal'|'pending'='proposal',release:(()=>void)|undefined;
 let holdWallet=false,walletWaiting=false,releaseWallet:(()=>void)|undefined;
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==origin){unexpected.push(request.url());return route.abort('blockedbyclient');}
  if(url.pathname==='/api/prompt-assistance'){
   if(request.method()==='GET'){
    const sessionId=url.searchParams.get('sessionId'),original=milo.find(item=>item.sessionId===sessionId);
    if(original && url.searchParams.get('requestId'))return route.fulfill({json:{ok:true,result:{sessionId,requestId:original.requestId,draftRevision:original.draftRevision,target:original.draft.target,message:original.message,state:'complete',reply:{reply:'Here is the new prompt.',text:PROPOSED},assistance:status}}});
    if(original)return route.fulfill({json:{ok:true,result:{sessionId,scope:`${original.draft.surface}:${original.draft.workflow}`,status:'active',turns:[{requestId:original.requestId,message:original.message,reply:'Here is the new prompt.'}],proposal:{text:PROPOSED,draftFingerprint:createHash('sha256').update(canonicalPromptDraft(original.draft)).digest('hex')},pending:null}}});
    return route.fulfill({json:{ok:true,result:status}});
   }
   const body=request.postDataJSON();assert.equal(body.action,'message');const req=body.request;milo.push(req);
   if(reply==='pending')await new Promise<void>(resolve=>{release=resolve;});
   const result={sessionId:req.sessionId,requestId:req.requestId,draftRevision:req.draftRevision,target:req.draft.target,message:req.message,assistance:status,
    ...(reply==='failed'?{state:'failed',safeToRetry:false,error:'REQUEST_UNANSWERED'}:{state:'complete',reply:{reply:reply==='null'?'Which scene should I prepare?':'Here is the new prompt.',text:reply==='null'?null:PROPOSED}})};
   return route.fulfill({json:{ok:true,result}}).catch(()=>{});
  }
  if(url.pathname==='/api/wallet'){walletWaiting=true;if(holdWallet)await new Promise<void>(resolve=>{releaseWallet=resolve;});return route.fulfill({json:{balanceCents:10000}}).catch(()=>{});}
  if(url.pathname==='/api/audio/quote')return route.fulfill({json:{ok:true,inputKey:JSON.stringify(request.postDataJSON()),pricing:{totalCents:7,currency:'USD'},expiresAt:Date.now()+600000}});
  if(['/api/generate','/api/images/generate','/api/audio/generate'].includes(url.pathname)){generated.push({path:url.pathname,payload:request.postDataJSON(),authorization:request.headers()['authorization']});return route.fulfill({status:409,json:{error:'SYNTHETIC_CAPTURE_ONLY',message:'No job created.'}});}
  if(url.pathname.startsWith('/api/')){unexpected.push(url.pathname);return route.abort('blockedbyclient');}
  return route.continue();
 });
 return {generated,milo,errors,unexpected,delayWallet:()=>{holdWallet=true;},walletWaiting:()=>walletWaiting,releaseWallet:()=>releaseWallet?.(),setReply:(next:typeof reply)=>{reply=next;},release:()=>release?.(),
  async send(next:typeof reply='proposal'){reply=next;const field=page.getByRole('textbox',{name:'Message Milo',exact:true});await field.fill('Prepare a new festive train advert.');await field.press('Enter');
   if(next==='failed')await expect(page.getByText('this request’s credit hold was released.',{exact:false})).toBeVisible();
   else if(next==='null')await expect(page.getByText('Which scene should I prepare?',{exact:true})).toBeVisible();
   else if(next==='proposal')await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
   else await expect(page.getByRole('button',{name:'Stop waiting',exact:true})).toBeVisible();
  }};
}
async function cannotGenerate(page:Page,generated:any[]){
 const action=page.getByRole('button',{name:/^Generate/});await expect(action).toBeDisabled();
 await action.evaluate((element:HTMLButtonElement)=>element.click());await action.focus();await page.keyboard.press('Enter');await page.keyboard.press('Space');
 await page.waitForTimeout(100);assert.equal(generated.length,0,'blocked pointer and keyboard paths cannot reach generation');
}

for(const outcome of ['pending','failed','null','proposal'] as const)test(`video refuses old hidden prompt after ${outcome}, while quote and manual path remain live`,{timeout:60000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source:miloGenerationVideoSource,config,assistanceLive:true,hostModules:nextHost});const browser=await chromium.launch();
 try{const page=await browser.newPage(),wire=await setup(page,new URL(fixture.url).origin);await page.goto(fixture.url);
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await wire.send(outcome);
  await cannotGenerate(page,wire.generated);await expect(page.locator('[data-workspace-prompt]')).toBeHidden();await expect(page.locator('.app-generation-price')).toHaveText('$7.07');
  await page.evaluate(()=>(globalThis as any).changeRatio());await expect(page.locator('.app-generation-price')).toHaveText('$8.25');await cannotGenerate(page,wire.generated);
  if(outcome==='proposal'){await page.locator('[data-assistance-expand]').click();await cannotGenerate(page,wire.generated);}
  wire.release();await page.getByRole('tab',{name:'Prompt',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toBeVisible();
  await page.getByRole('button',{name:/^Generate/}).click();await expect.poll(()=>wire.generated.length).toBe(1);assert.equal(wire.generated[0].payload.prompt,OLD);
  assert.deepEqual(wire.unexpected,[]);assert.deepEqual(wire.errors,[]);
 }finally{await browser.close();await fixture.close();}
});

test('explicit application survives tab returns and ratio changes, but requests, chats, references and reverted edits revoke it',{timeout:90000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source:miloGenerationVideoSource,config,assistanceLive:true,hostModules:nextHost});const browser=await chromium.launch();
 try{for(const revoke of ['message','chat','references','edit','account','proposal-edit']){
  const page=await browser.newPage(),wire=await setup(page,new URL(fixture.url).origin);await page.goto(fixture.url);
  const chat=page.getByRole('tab',{name:'AI assistant',exact:true}),manual=page.getByRole('tab',{name:'Prompt',exact:true}),action=page.getByRole('button',{name:/^Generate/});
  await chat.click();await wire.send();await page.locator('[data-assistance-apply]').click();await expect(manual).toHaveAttribute('aria-selected','true');await expect(page.locator('[data-workspace-prompt]')).toHaveValue(PROPOSED);
  await chat.click();await expect(action).toBeEnabled();await page.evaluate(()=>(globalThis as any).changeRatio());await expect(action).toBeEnabled();await expect(page.locator('.app-generation-price')).toHaveText('$8.25');
  if(revoke==='message')await wire.send('pending');
  if(revoke==='chat')await page.getByRole('button',{name:'New chat',exact:true}).click();
  if(revoke==='references')await page.evaluate(()=>(globalThis as any).changeReferences());
  if(revoke==='edit'){await manual.click();await page.locator('[data-workspace-prompt]').fill('A different manual draft.');await page.locator('[data-workspace-prompt]').fill(PROPOSED);await chat.click();}
  if(revoke==='proposal-edit'){await page.locator('[data-assistance-expand]').click();await page.locator('[data-assistance-editor]').fill('A new proposal edit that has not been applied.');}
  if(revoke==='account'){await page.evaluate(()=>(globalThis as any).changeContext({sourceAccount:{userId:'other-owner',token:'fixture'}}));await chat.click();}
  await cannotGenerate(page,wire.generated);wire.release();await page.close();
 }}finally{await browser.close();await fixture.close();}
});

for(const browserType of [chromium,webkit])test(`blocked Generate explains itself on keyboard and touch (${browserType.name()})`,{timeout:60000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source:miloGenerationVideoSource,config,assistanceLive:true,hostModules:nextHost});const browser=await browserType.launch();
 try{const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),wire=await setup(page,new URL(fixture.url).origin);await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const action=page.getByRole('button',{name:/^Generate/});await action.focus();await expect(page.getByRole('tooltip')).toHaveText(BEFORE);await action.tap({force:true});assert.equal(wire.generated.length,0);
  await wire.send();await action.focus();await expect(page.getByRole('tooltip')).toHaveText(READY);await action.tap({force:true});assert.equal(wire.generated.length,0);
  await expect(page.locator('.app-generation-price')).toHaveText('$7.07');assert.ok(await action.evaluate(element=>getComputedStyle(element).opacity==='1'),'blocking Milo must not dim the amount');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'help must not overflow the mobile viewport');
 }finally{await browser.close();await fixture.close();}
});

test('the image owner refuses native form submission in AI assistant and still accepts the manual path',{timeout:60000},async()=>{
 const imageEngine=listFalEngines().find(entry=>entry.id==='nano-banana-2')!.engine;
 const fixture=await startWorkspaceReferenceFixture({source:miloGenerationImageSource,config:{engine:imageEngine},assistanceLive:true,hostModules:nextHost});const browser=await chromium.launch();
 try{const page=await browser.newPage(),wire=await setup(page,new URL(fixture.url).origin);await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await wire.send('null');
  await cannotGenerate(page,wire.generated);await page.locator('form.app-image-composer').evaluate((form:HTMLFormElement)=>form.requestSubmit());await page.waitForTimeout(100);assert.equal(wire.generated.length,0);
  await page.getByRole('tab',{name:'Prompt',exact:true}).click();await page.locator('form.app-image-composer').evaluate((form:HTMLFormElement)=>form.requestSubmit());await expect.poll(()=>wire.generated.length).toBe(1);assert.equal(wire.generated[0].path,'/api/images/generate');
 }finally{await browser.close();await fixture.close();}
});

test('the real audio owner blocks unapplied conversation text and accepts the explicit manual script',{timeout:60000},async()=>{
 const hostModules={...nextHost,
  '@/hooks/useRequireAuth':`const user={id:'owner'};export function useRequireAuth(){return {user};}`,
  '@/lib/api-jobs':`const result={stableJobs:[],isLoading:true,error:null,mutate:async()=>{}};export function useInfiniteJobs(){return result;}export async function hideJob(){}`,
  'next/dynamic':`export default function dynamic(){return function Deferred(){return null;};}`,
 };
 const fixture=await startWorkspaceReferenceFixture({source:miloGenerationAudioSource,config:{},assistanceLive:true,hostModules});const browser=await chromium.launch();
 try{const page=await browser.newPage(),wire=await setup(page,new URL(fixture.url).origin);await page.goto(fixture.url);await page.locator('#audio-creation-text').fill('An explicitly authored old script.');await expect(page.getByRole('button',{name:/^Generate/})).toBeEnabled();
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await wire.send();await cannotGenerate(page,wire.generated);
  await page.locator('[data-assistance-apply]').click();await expect(page.locator('#audio-creation-text')).toHaveValue(PROPOSED);await page.getByRole('button',{name:/^Generate/}).click();await expect.poll(()=>wire.generated.length).toBe(1);assert.equal(wire.generated[0].path,'/api/audio/generate');assert.equal(wire.generated[0].payload.script,PROPOSED);
 }finally{await browser.close();await fixture.close();}
});


test('application proof does not survive restoration, and repeated activation submits the applied text only once',{timeout:60000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source:miloGenerationVideoSource,config,assistanceLive:true,hostModules:nextHost});const browser=await chromium.launch();
 try{const page=await browser.newPage(),wire=await setup(page,new URL(fixture.url).origin);await page.goto(fixture.url);
  const chat=page.getByRole('tab',{name:'AI assistant',exact:true});await chat.click();await wire.send();await page.locator('[data-assistance-apply]').click();await chat.click();
  const action=page.getByRole('button',{name:/^Generate/});await expect(action).toBeEnabled();
  await action.evaluate((button:HTMLButtonElement)=>{button.click();button.click();});await expect.poll(()=>wire.generated.length).toBe(1);assert.equal(wire.generated[0].payload.prompt,PROPOSED);
  wire.generated.length=0;await page.reload();await chat.click();await expect(page.getByText('Here is the new prompt.',{exact:true})).toBeVisible();await expect(page.locator('[data-assistance-proposal]')).toHaveCount(1);
  await expect(page.locator('[data-workspace-prompt]')).toHaveValue(OLD);await cannotGenerate(page,wire.generated);assert.deepEqual(wire.errors,[]);
 }finally{await browser.close();await fixture.close();}
});


for(const [locale,hint] of [['fr','Continue avec Milo pour préparer un prompt, ou ouvre l’onglet Prompt.'],['es','Continúa con Milo para preparar un prompt, o abre la pestaña Prompt.']])test(`Generate guidance follows the ${locale} workspace locale`,{timeout:60000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source:miloGenerationVideoSource,config:{...config,locale},assistanceLive:true,hostModules:nextHost});const browser=await chromium.launch();
 try{const page=await browser.newPage(),wire=await setup(page,new URL(fixture.url).origin);await page.goto(fixture.url);await page.getByRole('tab').nth(1).click();
  const action=page.locator('.app-generation-action');await expect(action).toBeDisabled();await action.focus();await expect(page.getByRole('tooltip')).toHaveText(hint);assert.equal(wire.generated.length,0);
 }finally{await browser.close();await fixture.close();}
});


test('switching to an unauthorized assistant before wallet admission prevents the pending video POST',{timeout:60000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source:miloGenerationVideoSource,config,assistanceLive:true,hostModules:nextHost});const browser=await chromium.launch();
 try{const page=await browser.newPage(),wire=await setup(page,new URL(fixture.url).origin);await page.goto(fixture.url);wire.delayWallet();
  await page.getByRole('button',{name:/^Generate/}).click();await expect.poll(wire.walletWaiting).toBe(true);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();wire.releaseWallet();
  await page.waitForTimeout(150);assert.equal(wire.generated.length,0,'revoked permission must be checked after asynchronous wallet admission');
 }finally{await browser.close();await fixture.close();}
});


test('the real image runner rechecks Milo permission after delayed authentication',{timeout:60000},async()=>{
 const imageEngine=listFalEngines().find(entry=>entry.id==='nano-banana-2')!.engine;
 const hostModules={...nextHost,'@/lib/supabaseClient':`export const supabase={auth:{getSession:async()=>{if(globalThis.delayImageAuth){globalThis.delayImageAuth=false;await new Promise(resolve=>{globalThis.releaseImageAuth=resolve;});}return {data:{session:{access_token:'synthetic-token',user:{id:'owner'}}},error:null};}}};`};
 const fixture=await startWorkspaceReferenceFixture({source:miloGenerationRealImageSource,config:{engine:imageEngine},assistanceLive:true,hostModules});const browser=await chromium.launch();
 try{const page=await browser.newPage(),wire=await setup(page,new URL(fixture.url).origin);await page.addInitScript(()=>sessionStorage.setItem('last-known:user-id','owner'));await page.goto(fixture.url);
  await page.evaluate(()=>{(globalThis as any).delayImageAuth=true;});await page.getByRole('button',{name:/^Generate/}).click();await page.waitForFunction(()=>typeof (globalThis as any).releaseImageAuth==='function');
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await page.evaluate(()=>(globalThis as any).releaseImageAuth());await page.waitForTimeout(150);assert.equal(wire.generated.length,0,'delayed authentication cannot resurrect revoked permission');
  await page.getByRole('tab',{name:'Prompt',exact:true}).click();await page.getByRole('button',{name:/^Generate/}).click();await expect.poll(()=>wire.generated.length).toBe(1);assert.equal(wire.generated[0].path,'/api/images/generate');assert.deepEqual(wire.errors,[]);
 }finally{await browser.close();await fixture.close();}
});


test('image dispatch keeps the admitted session token without a second unguarded authentication',{timeout:60000},async()=>{
 const imageEngine=listFalEngines().find(entry=>entry.id==='nano-banana-2')!.engine;
 const hostModules={...nextHost,'@/lib/supabaseClient':`export const supabase={auth:{getSession:async()=>{const n=globalThis.imageAuthCalls=(globalThis.imageAuthCalls??0)+1;return {data:{session:{access_token:n===1?'admitted-token':'replacement-token',user:{id:'owner'}}},error:null};}}};`};
 const fixture=await startWorkspaceReferenceFixture({source:miloGenerationRealImageSource,config:{engine:imageEngine},assistanceLive:true,hostModules});const browser=await chromium.launch();
 try{const page=await browser.newPage(),wire=await setup(page,new URL(fixture.url).origin);await page.addInitScript(()=>sessionStorage.setItem('last-known:user-id','owner'));await page.goto(fixture.url);
  await page.getByRole('button',{name:/^Generate/}).click();await expect.poll(()=>wire.generated.length).toBe(1);assert.equal(wire.generated[0].authorization,'Bearer admitted-token','the guarded admission token must remain authoritative');assert.equal(await page.evaluate(()=>(globalThis as any).imageAuthCalls),1);
 }finally{await browser.close();await fixture.close();}
});

test('audio dispatch rechecks current permission after authFetch session recovery',{timeout:60000},async()=>{
 const hostModules={...nextHost,
  '@/lib/supabaseClient':`export const supabase={auth:{getSession:async()=>{if(globalThis.delayInnerAudioAuth){globalThis.delayInnerAudioAuth=false;await new Promise(resolve=>{globalThis.releaseInnerAudioAuth=resolve;});}return {data:{session:{access_token:'synthetic-token',user:{id:'owner'}}},error:null};}}};`,
  '@/hooks/useRequireAuth':`const user={id:'owner'};export function useRequireAuth(){return {user};}`,
  '@/lib/api-jobs':`const result={stableJobs:[],isLoading:true,error:null,mutate:async()=>{}};export function useInfiniteJobs(){return result;}export async function hideJob(){}`,
  'next/dynamic':`export default function dynamic(){return function Deferred(){return null;};}`,
 };
 const fixture=await startWorkspaceReferenceFixture({source:miloGenerationAudioSource,config:{},assistanceLive:true,hostModules});const browser=await chromium.launch();
 try{const page=await browser.newPage(),wire=await setup(page,new URL(fixture.url).origin);await page.addInitScript(()=>sessionStorage.setItem('last-known:user-id','owner'));await page.goto(fixture.url);await page.locator('#audio-creation-text').fill('A clear authored script.');await expect(page.getByRole('button',{name:/^Generate/})).toBeEnabled();
  await page.evaluate(()=>{(globalThis as any).delayInnerAudioAuth=true;});await page.getByRole('button',{name:/^Generate/}).click();await page.waitForFunction(()=>typeof (globalThis as any).releaseInnerAudioAuth==='function');
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.getByRole('button',{name:/^Generate/})).toBeDisabled();await page.evaluate(()=>(globalThis as any).releaseInnerAudioAuth());await page.waitForTimeout(150);assert.equal(wire.generated.length,0,'authorization must be current immediately before the actual audio POST');assert.deepEqual(wire.errors,[]);
 }finally{await browser.close();await fixture.close();}
});
