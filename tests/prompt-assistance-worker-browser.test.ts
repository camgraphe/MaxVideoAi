import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {chromium,expect,type Page,type Route} from '@playwright/test';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {canonicalPromptDraft} from '../frontend/src/lib/prompt-assistance/session';
import {initialStatus} from './helpers/milo-status-fixture';

const source=`import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {PromptAssistanceComposer} from './components/composer/PromptAssistanceComposer.client';
function Fixture(){const [owner,setOwner]=useState('owner'),[workflow,setWorkflow]=useState('create'),[text,setText]=useState('Quiet forest'),[generation,setGeneration]=useState({blocked:true}),[duration,setDuration]=useState(5);globalThis.duration=setDuration;globalThis.owner=setOwner;globalThis.workflow=setWorkflow;
return <><PromptAssistanceComposer context={{accountKey:owner,scopeKey:JSON.stringify([owner,'video',workflow]),contextKey:'seedance',reviewKey:'seedance',live:{surface:'video',workflow,engineId:'seedance-2-5',mode:'t2v',settings:{durationSec:duration},references:[]}}} locale="en" modelLabel="Seedance" draftText={text} onApplyText={setText} onGenerationStateChange={setGeneration}><textarea aria-label="Manual prompt" value={text} onChange={e=>setText(e.target.value)}/></PromptAssistanceComposer><button disabled={generation.blocked} onClick={()=>globalThis.generated=true}>Generate $1.23</button></>};createRoot(document.getElementById('root')).render(<Fixture/>);`;
const chatKey='milo-composer:v2:["owner","video","create"]';
const message=(page:Page)=>page.getByRole('textbox',{name:'Message Milo',exact:true});
const send=(page:Page)=>page.getByRole('button',{name:'Send message to Milo',exact:true});
async function open(page:Page,url:string){await page.goto(url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(message(page)).toBeEditable();}
async function submit(page:Page){await message(page).fill('An observatory above the clouds');await send(page).click();}
function result(r:any,state='pending',extra:object={}){return {sessionId:r.sessionId,requestId:r.requestId,draftRevision:r.draftRevision??0,target:'prompt',message:r.message??'Original brief',state,phase:'calling',deadlineAt:new Date(Date.now()+600_000).toISOString(),assistance:initialStatus,...extra};}
function complete(r:any){return result(r,'complete',{reply:{reply:'Original isolated answer',text:'A telescope turns under twilight.'}});}
async function withFixture(run:(page:Page,url:string)=>Promise<void>){const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true});const browser=await chromium.launch();try{await run(await browser.newPage(),fixture.url);}finally{await browser.close();await fixture.close();}}
async function wire(page:Page,handler:(route:Route)=>Promise<unknown>){await page.route('**/api/prompt-assistance*',async route=>{const url=new URL(route.request().url());if(route.request().method()==='GET'&&!url.searchParams.has('sessionId'))return route.fulfill({json:{ok:true,result:initialStatus}});return handler(route);});}

test('saved admission polls beyond the former 90 seconds with one POST and never applies or generates',{timeout:90_000},()=>withFixture(async(page,url)=>{
 let r:any,posts=0,gets=0,done=false;
 await page.clock.install();
 await wire(page,async route=>{if(route.request().method()==='POST'){posts++;r=route.request().postDataJSON().request;return route.fulfill({json:{ok:true,result:result(r)}});}gets++;return route.fulfill({json:{ok:true,result:done?complete(r):result(r)}});});
 await open(page,url);await submit(page);await expect.poll(()=>gets).toBeGreaterThan(0);
 await page.clock.fastForward(91_000);done=true;await page.clock.runFor(2_100);
 await expect(page.getByText('Original isolated answer',{exact:true})).toBeVisible();assert.equal(posts,1);
 await expect(page.getByRole('button',{name:'Generate $1.23'})).toBeDisabled();
 await page.getByRole('tab',{name:'Prompt',exact:true}).click();await expect(page.getByRole('textbox',{name:'Manual prompt'})).toHaveValue('Quiet forest');
}));

test('slow GETs never overlap and Stop waiting then Check reply reuses only the admitted identity',{timeout:90_000},()=>withFixture(async(page,url)=>{
 let r:any,posts=0,recoveries=0,gets=0,inflight=0,max=0;let release:(()=>void)|undefined;let done=false;
 await page.clock.install();
 await wire(page,async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.action==='message'){posts++;r=body.request;}else{recoveries++;assert.equal(body.requestId,r.requestId);}return route.fulfill({json:{ok:true,result:result(r)}});}gets++;inflight++;max=Math.max(max,inflight);if(!done)await new Promise<void>(resolve=>release=resolve);inflight--;return route.fulfill({json:{ok:true,result:done?complete(r):result(r)}}).catch(()=>{});});
 await open(page,url);await submit(page);await expect.poll(()=>gets).toBe(1);await page.clock.runFor(8_000);assert.equal(gets,1);assert.equal(max,1);
 await page.getByRole('button',{name:'Stop waiting',exact:true}).click();await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();
 done=true;release?.();await page.getByRole('button',{name:'Check reply',exact:true}).click();await page.clock.runFor(2_100);
 await expect(page.getByText('Original isolated answer',{exact:true})).toBeVisible();assert.equal(posts,1);assert.equal(recoveries,1);assert.equal(max,1);
}));

test('New chat during polling preserves unsent input synchronously and previous reply stays read-only after reload',{timeout:90_000},()=>withFixture(async(page,url)=>{
 let r:any,posts=0,done=false;
 await wire(page,async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.action==='message'){posts++;r=body.request;}else{assert.equal(body.sessionId,r.sessionId);assert.equal(body.requestId,r.requestId);}return route.fulfill({json:{ok:true,result:done?complete(r):result(r)}});}const u=new URL(route.request().url());return route.fulfill({json:{ok:true,result:u.searchParams.has('requestId')?(done?complete(r):result(r)):{sessionId:u.searchParams.get('sessionId'),scope:'video:create',status:'active',turns:[],pending:null,proposal:null}}});});
 await open(page,url);await submit(page);await message(page).fill('My next unsent creative brief');
 const newChat=page.getByRole('button',{name:'New chat',exact:true});await expect(newChat).toBeEnabled();await newChat.click();
 await expect(message(page)).toHaveValue('My next unsent creative brief');
 const saved=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!),chatKey);assert.notEqual(saved.sessionId,r.sessionId);assert.equal(saved.local.message,'My next unsent creative brief');
 await expect(send(page)).toBeDisabled();await expect(page.getByText('Original isolated answer',{exact:true})).toHaveCount(0);
 await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(message(page)).toHaveValue('My next unsent creative brief');
 done=true;await page.getByRole('button',{name:'Check previous reply',exact:true}).click();
 const panel=page.getByRole('region',{name:'Previous Milo reply',exact:true});await expect(panel.getByText('Original isolated answer',{exact:true})).toBeVisible();await expect(panel.getByText('A telescope turns under twilight.',{exact:true})).toBeVisible();
 await expect(panel.getByRole('textbox')).toHaveCount(0);await expect(panel.getByRole('button',{name:/Use prompt|Generate|Review/})).toHaveCount(0);await expect(page.locator('[data-assistance-apply]')).toHaveCount(0);
 await page.getByRole('button',{name:'Close previous reply',exact:true}).click();await expect(message(page)).toHaveValue('My next unsent creative brief');await expect(send(page)).toBeEnabled();assert.equal(posts,1);
 await expect(page.getByRole('button',{name:'Generate $1.23'})).toBeDisabled();
}));

test('late callbacks after New chat, workflow or account change never hydrate the new chat',{timeout:90_000},()=>withFixture(async(page,url)=>{
 let r:any,gets=0;let release:(()=>void)|undefined;
 await wire(page,async route=>{if(route.request().method()==='POST'){r=route.request().postDataJSON().request;return route.fulfill({json:{ok:true,result:result(r)}});}gets++;await new Promise<void>(resolve=>release=resolve);return route.fulfill({json:{ok:true,result:complete(r)}}).catch(()=>{});});
 await open(page,url);await submit(page);await expect.poll(()=>gets).toBe(1);await page.getByRole('button',{name:'New chat',exact:true}).click();await message(page).fill('New chat text');release?.();
 await expect(message(page)).toHaveValue('New chat text');await expect(page.getByText('Original isolated answer',{exact:true})).toHaveCount(0);
 await page.evaluate(()=>(globalThis as any).workflow('modify'));await expect(page.getByRole('button',{name:'Check previous reply',exact:true})).toBeVisible();
 await page.evaluate(()=>(globalThis as any).owner('another'));await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.getByRole('button',{name:'Check previous reply',exact:true})).toHaveCount(0);await expect(page.getByText('Original isolated answer',{exact:true})).toHaveCount(0);
}));

for(const state of ['unknown','failed','deadline'] as const)test(`${state} preserves an honest recovery path and never applies`,{timeout:90_000},()=>withFixture(async(page,url)=>{
 let r:any,gets=0;
 await page.clock.install();
 await wire(page,async route=>{if(route.request().method()==='POST'){r=route.request().postDataJSON().request;return route.fulfill({json:{ok:true,result:result(r,'pending',{deadlineAt:new Date(Date.now()+1_000).toISOString()})}});}gets++;return route.fulfill({json:{ok:true,result:state==='deadline'?result(r,'pending',{deadlineAt:new Date(Date.now()+1_000).toISOString()}):result(r,state,{safeToRetry:state==='failed',error:state==='failed'?'REQUEST_UNANSWERED':'USAGE_UNRESOLVED',deadlineAt:undefined})}});});
 await open(page,url);await submit(page);await expect.poll(()=>gets).toBeGreaterThan(0);if(state==='deadline')await page.clock.runFor(32_000);
 if(state!=='failed')await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();else await expect(message(page)).toHaveValue('An observatory above the clouds');
 await expect(page.getByRole('button',{name:'New chat',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Generate $1.23'})).toBeDisabled();
}));

test('another-chat REQUEST_PENDING preserves rejected brief and checks the private pointer without resend',{timeout:90_000},()=>withFixture(async(page,url)=>{
 const original={sessionId:randomUUID(),requestId:randomUUID()};let posts=0;
 await wire(page,async route=>{if(route.request().method()==='POST'){posts++;const body=route.request().postDataJSON();if(body.action==='message')return route.fulfill({status:409,json:{ok:false,error:'REQUEST_PENDING',pendingRequest:{...original,scope:'image:create',phase:'calling',deadlineAt:new Date(Date.now()+600_000).toISOString()}}});assert.equal(body.action,'recover');assert.equal(body.sessionId,original.sessionId);assert.equal(body.requestId,original.requestId);return route.fulfill({json:{ok:true,result:complete(original)}});}return route.fulfill({json:{ok:true,result:complete(original)}});});
 await open(page,url);await submit(page);await expect(message(page)).toHaveValue('An observatory above the clouds');await expect(send(page)).toBeDisabled();const pointer=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('milo-previous-reply:v1:"owner"')!));assert.equal(pointer.scopeKey,'["owner","image","create"]');await page.getByRole('button',{name:'Check previous reply',exact:true}).click();
 await expect(page.getByRole('region',{name:'Previous Milo reply'}).getByText('Original isolated answer',{exact:true})).toBeVisible();assert.equal(posts,2);await expect(message(page)).toHaveValue('An observatory above the clouds');await expect(page.locator('[data-assistance-apply]')).toHaveCount(0);
}));

test('storage failure retains in-memory previous recovery without disabling navigation',{timeout:90_000},()=>withFixture(async(page,url)=>{
 let r:any;
 await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('storage unavailable');};});
 await wire(page,async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.action==='message'){r=body.request;return route.fulfill({json:{ok:true,result:result(r)}});}assert.equal(body.requestId,r.requestId);return route.fulfill({json:{ok:true,result:complete(r)}});}return route.fulfill({json:{ok:true,result:result(r)}});});
 await open(page,url);await submit(page);await message(page).fill('Keep this next brief');await page.getByRole('button',{name:'New chat',exact:true}).click();await expect(message(page)).toHaveValue('Keep this next brief');await expect(page.locator('[data-assistance-persistence-warning]')).toBeVisible();await page.getByRole('button',{name:'Check previous reply',exact:true}).click();await expect(page.getByRole('region',{name:'Previous Milo reply'}).getByText('Original isolated answer',{exact:true})).toBeVisible();
}));

test('slow review digest preserves the admitting pointer and synchronous input without reviving a replaced chat',{timeout:90_000},()=>withFixture(async(page,url)=>{
 let r:any,posts=0;
 await wire(page,async route=>{if(route.request().method()==='POST'){posts++;r=route.request().postDataJSON().request;return route.fulfill({json:{ok:true,result:result(r)}});}return route.fulfill({json:{ok:true,result:result(r)}});});
 await open(page,url);
 await page.evaluate(()=>{const digest=crypto.subtle.digest.bind(crypto.subtle);(globalThis as any).releaseDigests=[];crypto.subtle.digest=(...args:Parameters<SubtleCrypto['digest']>)=>new Promise(resolve=>{(globalThis as any).releaseDigests.push(()=>digest(...args).then(resolve));});});
 await message(page).fill('Keep this exact input before hashing');
 assert.equal(await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).local.message,chatKey),'Keep this exact input before hashing');
 await send(page).click();assert.equal(posts,0);
 await message(page).fill('My new unsent input');await page.getByRole('button',{name:'New chat',exact:true}).click();
 await page.evaluate(()=>(globalThis as any).releaseDigests.forEach((release:()=>void)=>release()));await expect(message(page)).toHaveValue('My new unsent input');assert.equal(posts,0);
 const pointer=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('milo-previous-reply:v1:"owner"')!));
 assert.equal(pointer.status,'admitting');assert.deepEqual(Object.keys(pointer).sort(),['requestId','scopeKey','serverScope','sessionId','status','version']);
}));

test('admission and recovery HTTP waits stop at 15 seconds and retain the same pointer',{timeout:90_000},()=>withFixture(async(page,url)=>{
 let r:any,posts=0;const releases:Array<()=>void>=[];
 await page.clock.install();
 await wire(page,async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();posts++;if(body.action==='message')r=body.request;else assert.equal(body.requestId,r.requestId);await new Promise<void>(resolve=>releases.push(resolve));return route.fulfill({json:{ok:true,result:complete(r)}}).catch(()=>{});}return route.fulfill({json:{ok:true,result:result(r)}});});
 try{await open(page,url);await submit(page);await expect.poll(()=>posts).toBe(1);await page.clock.runFor(15_001);await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Check reply',exact:true}).click();await expect.poll(()=>posts).toBe(2);await page.clock.runFor(15_001);await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();
 assert.equal(await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).pending.requestId,chatKey),r.requestId);await expect(page.getByText('Original isolated answer',{exact:true})).toHaveCount(0);
 }finally{releases.forEach(release=>release());}
}));

test('reload resumes an active saved identity without resending a brief or granting generation',{timeout:90_000},()=>withFixture(async(page,url)=>{
 let r:any,posts=0,recoveries=0,done=false;
 await wire(page,async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.action==='message'){posts++;r=body.request;}else{recoveries++;assert.equal(body.requestId,r.requestId);}return route.fulfill({json:{ok:true,result:done?complete(r):result(r)}});}const u=new URL(route.request().url());return route.fulfill({json:{ok:true,result:u.searchParams.has('requestId')?(done?complete(r):result(r)):{sessionId:r.sessionId,scope:'video:create',status:'active',turns:done?[{requestId:r.requestId,message:r.message,reply:'Original isolated answer'}]:[],pending:done?null:{requestId:r.requestId},proposal:done?{text:'A telescope turns under twilight.',draftFingerprint:'0'.repeat(64)}:null}}});});
 await open(page,url);await submit(page);await expect.poll(()=>posts).toBe(1);await page.getByRole('button',{name:'Stop waiting',exact:true}).click();await message(page).fill('Keep my follow-up');await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(message(page)).toHaveValue('Keep my follow-up');done=true;
 await page.getByRole('button',{name:'Check reply',exact:true}).click();await expect(page.getByText('Original isolated answer',{exact:true})).toBeVisible();assert.equal(posts,1);assert.equal(recoveries,1);await expect(page.getByRole('button',{name:'Generate $1.23'})).toBeDisabled();
}));

test('an invalid terminal identity keeps recovery and draft edits only make the original proposal stale',{timeout:90_000},()=>withFixture(async(page,url)=>{
 let r:any,wrong=true;
 await wire(page,async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.action==='message')r=body.request;return route.fulfill({json:{ok:true,result:body.action==='recover'?complete(r):result(r)}});}return route.fulfill({json:{ok:true,result:wrong?complete({...r,requestId:randomUUID()}):complete(r)}});});
 await open(page,url);await submit(page);await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();assert.equal(await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).pending.requestId,chatKey),r.requestId);
 await page.getByRole('tab',{name:'Prompt',exact:true}).click();await page.getByRole('textbox',{name:'Manual prompt'}).fill('Changed draft');await page.getByRole('tab',{name:'AI assistant',exact:true}).click();wrong=false;await page.getByRole('button',{name:'Check reply',exact:true}).click();await expect(page.getByText('Original isolated answer',{exact:true})).toBeVisible();await expect(page.locator('[data-assistance-apply]')).toBeDisabled();await expect(page.getByRole('button',{name:'Generate $1.23'})).toBeDisabled();
}));

test('a slow status read is aborted at the immutable deadline plus grace',{timeout:90_000},()=>withFixture(async(page,url)=>{
 let r:any,gets=0;let release:(()=>void)|undefined;
 await page.clock.install();
 await wire(page,async route=>{if(route.request().method()==='POST'){r=route.request().postDataJSON().request;return route.fulfill({json:{ok:true,result:result(r,'pending',{deadlineAt:new Date(Date.now()-29_000).toISOString()})}});}gets++;await new Promise<void>(resolve=>release=resolve);return route.fulfill({json:{ok:true,result:complete(r)}}).catch(()=>{});});
 try{await open(page,url);await submit(page);await expect.poll(()=>gets).toBe(1);await page.clock.runFor(1_100);await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();await expect(page.getByText('Original isolated answer',{exact:true})).toHaveCount(0);}finally{release?.();}
}));

test('late restored digest and previous-view replies cannot cross New chat or account ownership',{timeout:90_000},()=>withFixture(async(page,url)=>{
 const old={sessionId:randomUUID(),requestId:randomUUID()};let restoring=0,release:(()=>void)|undefined;
 await page.addInitScript(({chatKey,old})=>{sessionStorage.setItem(chatKey,JSON.stringify({sessionId:old.sessionId,pending:null,local:{message:'Old saved input',proposal:null,latestRequestId:''}}));const digest=crypto.subtle.digest.bind(crypto.subtle);(globalThis as any).releaseDigests=[];crypto.subtle.digest=(...args:Parameters<SubtleCrypto['digest']>)=>new Promise(resolve=>{(globalThis as any).releaseDigests.push(()=>digest(...args).then(resolve));});},{chatKey,old});
 await wire(page,async route=>{if(route.request().method()==='POST'){await new Promise<void>(resolve=>release=resolve);return route.fulfill({json:{ok:true,result:complete(old)}}).catch(()=>{});}restoring++;return route.fulfill({json:{ok:true,result:{sessionId:old.sessionId,scope:'video:create',status:'active',turns:[{requestId:old.requestId,message:'Old human brief',reply:'Old completed response'}],pending:{requestId:old.requestId},proposal:null}}});});
 await page.goto(url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect.poll(()=>restoring).toBe(1);await expect.poll(()=>page.evaluate(()=>(globalThis as any).releaseDigests.length)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'New chat',exact:true}).click();await expect(message(page)).toHaveValue('Old saved input');await message(page).fill('Preserve new chat draft');await page.evaluate(()=>(globalThis as any).releaseDigests.forEach((fn:()=>void)=>fn()));await expect(message(page)).toHaveValue('Preserve new chat draft');await expect(page.getByText('Old completed response',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Check previous reply',exact:true}).click();await expect.poll(()=>!!release).toBe(true);await page.evaluate(()=>(globalThis as any).owner('another'));await page.getByRole('tab',{name:'AI assistant',exact:true}).click();release?.();await expect(page.getByRole('region',{name:'Previous Milo reply'})).toHaveCount(0);await expect(page.getByText('Original isolated answer',{exact:true})).toHaveCount(0);
}));

test('a terminal reply still unlocks explicit sending when storage fails after admission',{timeout:90_000},()=>withFixture(async(page,url)=>{
 let r:any,posts=0,done=false;
 await wire(page,async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.action==='message'){posts++;r=body.request;}return route.fulfill({json:{ok:true,result:done?complete(r):result(r)}});}return route.fulfill({json:{ok:true,result:result(r)}});});
 await open(page,url);await submit(page);await expect.poll(()=>posts).toBe(1);await page.getByRole('button',{name:'Stop waiting',exact:true}).click();
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('storage unavailable');};Storage.prototype.removeItem=()=>{throw Error('storage unavailable');};});done=true;
 await page.getByRole('button',{name:'Check reply',exact:true}).click();await expect(page.getByText('Original isolated answer',{exact:true})).toBeVisible();await message(page).fill('Another explicit request');await send(page).click();await expect.poll(()=>posts).toBe(2);await expect(page.getByText('Original isolated answer',{exact:true})).toHaveCount(2);await message(page).fill('Third explicit request');await expect(send(page)).toBeEnabled();
 const warnings=page.locator('[data-assistance-persistence-warning]');await expect(warnings).toBeVisible();
}));

test('a failed later brief reloads intact without lending its review proof to the earlier proposal',{timeout:90_000},()=>withFixture(async(page,url)=>{
 const sent:any[]=[];let snapshot:any;
 await wire(page,async route=>{if(route.request().method()==='POST'){const r=route.request().postDataJSON().request;sent.push(r);snapshot??={sessionId:r.sessionId,scope:'video:create',status:'active',turns:[],pending:null,proposal:null};if(sent.length===1){snapshot.turns.push({requestId:r.requestId,message:r.message,reply:'Original isolated answer'});snapshot.proposal={text:'A telescope turns under twilight.',draftFingerprint:createHash('sha256').update(canonicalPromptDraft(r.draft)).digest('hex')};return route.fulfill({json:{ok:true,result:complete(r)}});}snapshot.turns.push({requestId:r.requestId,message:r.message,state:'failed',reply:null,error:'REQUEST_UNANSWERED'});return route.fulfill({json:{ok:true,result:result(r,'failed',{safeToRetry:false,error:'REQUEST_UNANSWERED'})}});}return route.fulfill({json:{ok:true,result:snapshot}});});
 await open(page,url);await submit(page);await expect(page.getByText('Original isolated answer',{exact:true})).toBeVisible();await page.evaluate(()=>(globalThis as any).duration(8));await message(page).fill('My long later brief with the complete observatory action');await send(page).click();await expect(page.locator('[data-assistance-delivery-failed]')).toHaveCount(1);
 await page.evaluate(key=>{const saved=JSON.parse(sessionStorage.getItem(key)!);delete saved.local.proposal.review;sessionStorage.setItem(key,JSON.stringify(saved));},chatKey);
 await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.getByText('My long later brief with the complete observatory action',{exact:false})).toBeVisible();await expect(page.locator('[data-assistance-delivery-failed]')).toHaveCount(1);await expect(page.getByText('Original isolated answer',{exact:true})).toHaveCount(1);await page.evaluate(()=>(globalThis as any).duration(8));await expect(page.getByRole('button',{name:'Review & use',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Generate $1.23'})).toBeDisabled();
 const saved=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!),chatKey);assert.equal(saved.local.latestRequestId,sent[0].requestId);assert.notEqual(saved.local.latestRequestId,sent[1].requestId);
}));

test('a blocker admitted in the same session still opens an isolated previous-reply check',{timeout:90_000},()=>withFixture(async(page,url)=>{
 let original:any,posts=0;
 await wire(page,async route=>{const body=route.request().method()==='POST'?route.request().postDataJSON():undefined;if(body?.action==='message'){posts++;original={sessionId:body.request.sessionId,requestId:randomUUID()};return route.fulfill({status:409,json:{ok:false,error:'REQUEST_PENDING',pendingRequest:{...original,scope:'video:create',phase:'calling',deadlineAt:new Date(Date.now()+600_000).toISOString()}}});}if(body){posts++;assert.equal(body.requestId,original.requestId);}return route.fulfill({json:{ok:true,result:complete(original)}});});
 await open(page,url);await submit(page);await expect(message(page)).toHaveValue('An observatory above the clouds');await expect(page.getByRole('button',{name:'Check previous reply',exact:true})).toBeVisible();await page.getByRole('button',{name:'Check previous reply',exact:true}).click();await expect(page.getByRole('region',{name:'Previous Milo reply'}).getByText('Original isolated answer',{exact:true})).toBeVisible();assert.equal(posts,2);await expect(page.locator('[data-assistance-apply]')).toHaveCount(0);
}));

test('a real reload with blocked storage discovers the private blocker from the existing authenticated status GET',{timeout:90_000},()=>withFixture(async(page,url)=>{
 let r:any,messages=0,recoveries=0,statusReads=0,done=false;
 await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('storage unavailable');};Storage.prototype.setItem=()=>{throw Error('storage unavailable');};Storage.prototype.removeItem=()=>{throw Error('storage unavailable');};});
 await page.route('**/api/prompt-assistance*',async route=>{
  const u=new URL(route.request().url());
  if(route.request().method()==='GET'&&!u.searchParams.has('sessionId')){statusReads++;return route.fulfill({json:{ok:true,result:{...initialStatus,unresolvedCalls:r&&!done?1:0},...(r&&!done?{pendingRequest:{sessionId:r.sessionId,requestId:r.requestId,scope:'video:create',phase:'calling',deadlineAt:new Date(Date.now()+600_000).toISOString()}}:{})}});}
  if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.action==='message'){messages++;r=body.request;return route.fulfill({json:{ok:true,result:result(r)}});}recoveries++;assert.equal(body.action,'recover');assert.equal(body.sessionId,r.sessionId);assert.equal(body.requestId,r.requestId);done=true;return route.fulfill({json:{ok:true,result:complete(r)}});}
  assert.equal(u.searchParams.get('sessionId'),r.sessionId);assert.equal(u.searchParams.get('requestId'),r.requestId);return route.fulfill({json:{ok:true,result:result(r)}});
 });
 await open(page,url);await submit(page);await expect.poll(()=>messages).toBe(1);await expect(page.getByRole('button',{name:'Stop waiting',exact:true})).toBeVisible();const beforeReload=statusReads;
 await page.evaluate(()=>(globalThis as any).bootMarker='old module state');await page.reload();assert.equal(await page.evaluate(()=>(globalThis as any).bootMarker),undefined);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(message(page)).toBeEditable();await message(page).fill('My new brief after the reload');await expect(send(page)).toBeDisabled();
 await expect(page.getByRole('button',{name:'Check previous reply',exact:true})).toBeVisible();assert.equal(statusReads-beforeReload,1,'reuse the existing credits status GET instead of another discovery fetch');assert.equal(messages,1);assert.equal(recoveries,0,'status discovery never starts recovery or resends');
 await page.getByRole('button',{name:'Check previous reply',exact:true}).click();const panel=page.getByRole('region',{name:'Previous Milo reply'});await expect(panel.getByText('Original isolated answer',{exact:true})).toBeVisible();await expect(panel.getByRole('textbox')).toHaveCount(0);await expect(panel.getByRole('button',{name:/Use prompt|Review|Generate/})).toHaveCount(0);await expect(page.locator('[data-assistance-apply]')).toHaveCount(0);await expect(message(page)).toHaveValue('My new brief after the reload');await expect(page.getByRole('button',{name:'Generate $1.23'})).toBeDisabled();
 await page.getByRole('button',{name:'Close previous reply',exact:true}).click();await expect(message(page)).toHaveValue('My new brief after the reload');await expect(send(page)).toBeEnabled();assert.equal(messages,1);assert.equal(recoveries,1);
}));

for(const failure of ['unauthenticated','invalid status','old account'] as const)test(`status discovery ignores ${failure} metadata`,{timeout:90_000},()=>withFixture(async(page,url)=>{
 const pendingRequest={sessionId:randomUUID(),requestId:randomUUID(),scope:'video:create',phase:'calling',deadlineAt:new Date(Date.now()+600_000).toISOString()};let reads=0,posts=0,release:(()=>void)|undefined;
 await page.route('**/api/prompt-assistance*',async route=>{if(route.request().method()==='POST'){posts++;return route.abort();}reads++;
  if(failure==='old account'&&reads===1){await new Promise<void>(resolve=>release=resolve);return route.fulfill({json:{ok:true,result:{...initialStatus,unresolvedCalls:1},pendingRequest}}).catch(()=>{});}
  if(failure==='unauthenticated')return route.fulfill({status:401,json:{ok:false,error:'AUTH_REQUIRED',result:initialStatus,pendingRequest}});
  if(failure==='invalid status')return route.fulfill({json:{ok:true,result:{enabled:true},pendingRequest}});
  return route.fulfill({json:{ok:true,result:initialStatus}});
 });
 try{await page.goto(url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();if(failure==='old account'){await expect.poll(()=>!!release).toBe(true);await page.evaluate(()=>(globalThis as any).owner('another'));await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect.poll(()=>reads).toBe(2);release?.();}else await expect.poll(()=>reads).toBe(1);
  if(failure==='unauthenticated')await expect(page.getByRole('link',{name:'Sign in to chat'})).toBeVisible();await expect(page.getByRole('button',{name:'Check previous reply',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'Previous Milo reply'})).toHaveCount(0);assert.equal(posts,0);
 }finally{release?.();}
}));
