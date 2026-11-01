import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import test from 'node:test';
import {chromium,expect} from '@playwright/test';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {initialStatus} from './helpers/milo-status-fixture';
import {canonicalPromptDraft} from '../frontend/src/lib/prompt-assistance/session';
const source=`import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {PromptAssistanceComposer} from './components/composer/PromptAssistanceComposer.client';
function Fixture(){const [workflow,setWorkflow]=useState('create'),[owner,setOwner]=useState('owner'),[text,setText]=useState('Old parkour prompt'),[model,setModel]=useState('seedance-2-5');
globalThis.mode=setWorkflow;globalThis.owner=setOwner;globalThis.model=setModel;
return <PromptAssistanceComposer context={{accountKey:owner,scopeKey:JSON.stringify([owner,'video',workflow]),contextKey:model,live:{surface:'video',workflow,engineId:model,mode:workflow==='create'?'t2v':'v2v',settings:{durationSec:5},references:[]}}} locale="en" modelLabel={model} draftText={text} onApplyText={setText}><textarea aria-label="Manual prompt" value={text} onChange={e=>setText(e.target.value)}/></PromptAssistanceComposer>}
createRoot(document.getElementById('root')).render(<Fixture/>);`;

test('failed user turns restore with a delivery notice and never relabel the prior proposal',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true});const browser=await chromium.launch();
 try{
  const page=await browser.newPage();let snapshot:any;const sent:any[]=[];
  await page.route('**/api/prompt-assistance*',async route=>{
   if(route.request().method()==='GET'){
    const url=new URL(route.request().url());
    if(!url.searchParams.has('sessionId'))return route.fulfill({json:{ok:true,result:initialStatus}});
    return route.fulfill({json:{ok:true,result:snapshot}});
   }
   const r=route.request().postDataJSON().request;sent.push(r);
   snapshot??={sessionId:r.sessionId,scope:'video:create',status:'active',turns:[],proposal:null,pending:null};
   if(sent.length===2){
    snapshot.turns.push({requestId:r.requestId,message:r.message,state:'failed',reply:null,error:'REQUEST_UNANSWERED'});
    return route.fulfill({json:{ok:true,result:{sessionId:r.sessionId,requestId:r.requestId,draftRevision:r.draftRevision,target:'prompt',message:r.message,state:'failed',safeToRetry:false,error:'REQUEST_UNANSWERED',assistance:initialStatus}}});
   }
   const text=sent.length===1?'A telescope turns under a twilight sky.':null,reply='A completed synthetic answer.';
   snapshot.turns.push({requestId:r.requestId,message:r.message,reply});
   if(text)snapshot.proposal={text,draftFingerprint:createHash('sha256').update(canonicalPromptDraft(r.draft)).digest('hex')};
   return route.fulfill({json:{ok:true,result:{sessionId:r.sessionId,requestId:r.requestId,draftRevision:r.draftRevision,target:'prompt',message:r.message,state:'complete',reply:{reply,text},assistance:initialStatus}}});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const message=page.getByRole('textbox',{name:'Message Milo',exact:true});
  await message.fill('An observatory visit');await page.getByRole('button',{name:'Send message to Milo'}).click();
  await expect(page.getByText('A completed synthetic answer.',{exact:true})).toBeVisible();
  await message.fill('Add a mountain observatory view.');await page.getByRole('button',{name:'Send message to Milo'}).click();
  await expect(page.locator('[data-assistance-delivery-failed]')).toHaveText('No usable reply was returned.');
  await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await expect(page.getByText('Add a mountain observatory view.',{exact:false})).toBeVisible();
  await expect(page.locator('[data-assistance-delivery-failed]')).toHaveCount(1);
  await expect(page.getByText('A completed synthetic answer.',{exact:true})).toHaveCount(1);
  await page.getByRole('button',{name:'View prompt',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Edit the proposed text',exact:true})).toHaveValue('A telescope turns under a twilight sky.');
  await page.getByRole('tab',{name:'Prompt',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Manual prompt'})).toHaveValue('Old parkour prompt');
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await message.fill('Keep the telescope.');await page.getByRole('button',{name:'Send message to Milo'}).click();
  await expect.poll(()=>sent.length).toBe(3);
  assert.equal(sent[2].activeSuggestion,'A telescope turns under a twilight sky.');
 }finally{await browser.close();await fixture.close();}
});

test('workflow chats restore, keep local drafts and suggestions, and New chat only clears the active conversation',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true});const browser=await chromium.launch();
 try{
  const page=await browser.newPage();const sessions=new Map<string,any>();const sent:any[]=[];
  await page.route('**/api/prompt-assistance*',async route=>{
   const url=new URL(route.request().url());
   if(route.request().method()==='GET'){
    if(!url.searchParams.has('sessionId'))return route.fulfill({json:{ok:true,result:initialStatus}});
    const snapshot=sessions.get(url.searchParams.get('sessionId')!);
    return route.fulfill({status:snapshot?200:404,json:snapshot?{ok:true,result:snapshot}:{ok:false,error:'SESSION_NOT_FOUND'}});
   }
   const r=route.request().postDataJSON().request;sent.push(r);
   const snapshot=sessions.get(r.sessionId)??{sessionId:r.sessionId,scope:`video:${r.draft.workflow}`,status:'active',turns:[],proposal:null,pending:null};
   const reply=`Reply for ${r.draft.workflow} ${snapshot.turns.length+1}`;
   const text=r.message==='Clarify'?null:`A dog runs behind a car in ${r.draft.workflow}.`;
   snapshot.turns.push({requestId:r.requestId,message:r.message,reply});
   if(text??r.activeSuggestion)snapshot.proposal={text:text??r.activeSuggestion,draftFingerprint:createHash('sha256').update(canonicalPromptDraft(r.draft)).digest('hex')};
   sessions.set(r.sessionId,snapshot);
   return route.fulfill({json:{ok:true,result:{sessionId:r.sessionId,requestId:r.requestId,draftRevision:r.draftRevision,target:'prompt',message:r.message,state:'complete',reply:{reply,text},assistance:initialStatus}}});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const message=page.getByRole('textbox',{name:'Message Milo',exact:true}),send=page.getByRole('button',{name:'Send message to Milo'});
  await message.fill('A dog behind a car');await send.click();await expect(page.getByText('Reply for create 1')).toBeVisible();
  await page.getByRole('button',{name:'View prompt',exact:true}).click();
  await page.getByRole('textbox',{name:'Edit the proposed text',exact:true}).fill('A red dog runs behind a car in create.');
  await message.fill('An unsent follow-up');
  await page.evaluate(()=>(globalThis as any).mode('modify'));
  await expect(page.getByRole('tab',{name:'AI assistant',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByText('Reply for create 1')).toHaveCount(0);await expect(message).toHaveValue('');
  await message.fill('Modify my video');await send.click();await expect(page.getByText('Reply for modify 1')).toBeVisible();
  assert.notEqual(sent[0].sessionId,sent[1].sessionId);
  await page.evaluate(()=>(globalThis as any).mode('create'));
  await expect(page.getByText('Reply for create 1')).toBeVisible();await expect(message).toHaveValue('An unsent follow-up');
  await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
  await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await expect(page.getByText('Reply for create 1')).toBeVisible();await expect(message).toHaveValue('An unsent follow-up');
  await message.fill('Clarify');await send.click();await expect(page.getByText('Reply for create 2')).toBeVisible();
  assert.equal(sent[2].activeSuggestion,'A red dog runs behind a car in create.');assert.equal(sent[2].sessionId,sent[0].sessionId);
  await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await expect(page.getByText('Reply for create 2')).toBeVisible();await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
  await page.evaluate(()=>(globalThis as any).model('veo-3'));await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
  await page.getByRole('button',{name:'New chat',exact:true}).click();await expect(page.getByText('Reply for create 1')).toHaveCount(0);
  await page.getByRole('tab',{name:'Prompt',exact:true}).click();await expect(page.getByRole('textbox',{name:'Manual prompt'})).toHaveValue('Old parkour prompt');
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await message.fill('New project');await send.click();await expect.poll(()=>sent.length).toBe(4);assert.notEqual(sent[3].sessionId,sent[0].sessionId);
  await page.evaluate(()=>(globalThis as any).owner('another'));await expect(page.getByRole('tab',{name:'Prompt',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.getByText('Reply for create 1')).toHaveCount(0);
 }finally{await browser.close();await fixture.close();}
});

test('reload and workflow changes recover a pending identity exactly once and fence stale restore results',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true});const browser=await chromium.launch();
 let release:(()=>void)|undefined;
 try{
  const page=await browser.newPage();let request:any,complete=false,posted=0,restores=0,delay=false;
  await page.route('**/api/prompt-assistance*',async route=>{
   const url=new URL(route.request().url());
   if(route.request().method()==='GET'){
    if(!url.searchParams.has('sessionId'))return route.fulfill({json:{ok:true,result:initialStatus}});
    restores++;
    if(delay){delay=false;await new Promise<void>(resolve=>release=resolve);}
    if(!request||request.sessionId!==url.searchParams.get('sessionId'))return route.fulfill({status:404,json:{ok:false,error:'SESSION_NOT_FOUND'}}).catch(()=>{});
    return route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,scope:'video:create',status:'active',turns:complete?[{requestId:request.requestId,message:request.message,reply:'The recovered reply'}]:[],pending:complete?null:{requestId:request.requestId},proposal:complete?{text:'A dog runs behind a car.',draftFingerprint:createHash('sha256').update(canonicalPromptDraft(request.draft)).digest('hex')}:null}}}).catch(()=>{});
   }
   const body=route.request().postDataJSON();
   if(body.action==='message'){posted++;request=body.request;return route.abort('failed');}
   assert.equal(body.action,'recover');assert.equal(body.requestId,request.requestId);complete=true;
   return route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,requestId:request.requestId,draftRevision:request.draftRevision,target:'prompt',message:request.message,state:'complete',reply:{reply:'The recovered reply',text:'A dog runs behind a car.'},assistance:initialStatus}}});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('Dog behind a car');await page.getByRole('button',{name:'Send message to Milo'}).click();
  await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'New chat',exact:true})).toBeEnabled();
  await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Check reply',exact:true}).click();
  await expect(page.getByText('The recovered reply',{exact:true})).toHaveCount(1);await expect(page.locator('[data-assistance-apply]')).toBeEnabled();assert.equal(posted,1);
  await page.evaluate(()=>(globalThis as any).mode('modify'));delay=true;
  await page.evaluate(()=>(globalThis as any).mode('create'));await expect.poll(()=>!!release).toBe(true);
  await page.evaluate(()=>(globalThis as any).owner('another'));release?.();
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.getByText('The recovered reply')).toHaveCount(0);
  assert.ok(restores>=2);assert.equal(posted,1);
 }finally{release?.();await browser.close();await fixture.close();}
});

test('an expired chat rejected on send preserves the unsent message for the new chat',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true});const browser=await chromium.launch();
 try{
  const page=await browser.newPage();
  await page.route('**/api/prompt-assistance*',route=>route.request().method()==='GET'?route.fulfill({json:{ok:true,result:initialStatus}}):route.fulfill({status:409,json:{ok:false,error:'SESSION_EXPIRED'}}));
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Message Milo',exact:true});
  await input.fill('Keep this carefully written request');await page.getByRole('button',{name:'Send message to Milo'}).click();
  await expect(input).toHaveValue('Keep this carefully written request');
  await expect(page.getByText('Start a new chat to continue.',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Send message to Milo'})).toBeDisabled();
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  await expect(input).toHaveValue('Keep this carefully written request');
 }finally{await browser.close();await fixture.close();}
});

for(const scenario of ['full recovery','failed recovery','slow restore','legacy recovery'] as const){
 test(`${scenario} preserves the pending work and local input`,{timeout:90_000},async()=>{
  const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true});const browser=await chromium.launch();let release:(()=>void)|undefined;
  try{
   const page=await browser.newPage();const sessionId=randomUUID(),requestId=randomUUID();let complete=false,posts=0,gets=0;
   const key=scenario==='legacy recovery'?'milo-composer:["owner","video"]':'milo-composer:v2:["owner","video","create"]';
   await page.addInitScript(({key,sessionId,requestId,scenario})=>sessionStorage.setItem(key,JSON.stringify({sessionId,pending:scenario==='slow restore'?null:{sessionId,requestId},local:{message:scenario==='failed recovery'?'':'Saved input',proposal:null,latestRequestId:''}})),{key,sessionId,requestId,scenario});
   await page.route('**/api/prompt-assistance*',async route=>{
    if(route.request().method()==='GET'){
     if(!new URL(route.request().url()).searchParams.has('sessionId'))return route.fulfill({json:{ok:true,result:initialStatus}});
     gets++;if(scenario==='slow restore')await new Promise<void>(resolve=>release=resolve);
     return route.fulfill({json:{ok:true,result:{sessionId,scope:'video:create',status:scenario==='full recovery'?'full':'active',turns:complete&&scenario!=='failed recovery'?[{requestId,message:'Original request',reply:'Recovered answer'}]:[],pending:complete||scenario==='slow restore'?null:{requestId},proposal:complete&&scenario!=='failed recovery'?{text:'Recovered proposal',draftFingerprint:'0'.repeat(64)}:null}}});
    }
    const body=route.request().postDataJSON();posts++;assert.equal(body.action,'recover');assert.equal(body.sessionId,sessionId);assert.equal(body.requestId,requestId);complete=true;
    return route.fulfill({json:{ok:true,result:{sessionId,requestId,state:scenario==='failed recovery'?'failed':'complete',target:'prompt',draftRevision:0,message:'Original request',safeToRetry:true,error:scenario==='failed recovery'?'ASSISTANCE_SELECTION_CHANGED':undefined,reply:scenario==='failed recovery'?undefined:{reply:'Recovered answer',text:'Recovered proposal'},assistance:initialStatus}}});
   });
   await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();const input=page.getByRole('textbox',{name:'Message Milo',exact:true});
   if(scenario==='slow restore'){
    await expect.poll(()=>!!release).toBe(true);await expect(input).not.toBeEditable();release?.();await expect(input).toBeEditable();await expect(input).toHaveValue('Saved input');assert.equal(posts,0);
   }else{
    await page.getByRole('button',{name:'Check reply',exact:true}).click();
    if(scenario==='failed recovery'){
     await expect(page.getByText('Milo changed in another tab.',{exact:false})).toBeVisible();await expect(input).toHaveValue('Original request');
    }else{
     await expect(page.getByText('Recovered answer',{exact:true})).toBeVisible();await expect(page.locator('[data-assistance-apply]')).toHaveCount(1);
     await expect(page.getByRole('button',{name:'Send message to Milo'})).toBeDisabled();await expect(page.getByRole('button',{name:'New chat',exact:true})).toBeEnabled();
    }
    assert.equal(posts,1);if(scenario==='legacy recovery')assert.equal(gets,0,'Do not restore a broad legacy transcript');
   }
  }finally{release?.();await browser.close();await fixture.close();}
 });
}

for(const scenario of ['expired','legacy','prepared'] as const){
 const legacy=scenario==='legacy';
 test(`${scenario} chat retains reference analysis recovery until it is settled`,{timeout:90_000},async()=>{
  const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true,perception:true});const browser=await chromium.launch();
  try{
   const page=await browser.newPage();const sessionId=randomUUID(),analysisId=randomUUID();let completed=false,reads=0;
   const chatKey='milo-composer:v2:["owner","video","create"]';
   const analysisKey=legacy?'milo-analysis:["owner","video"]':`milo-analysis:["owner","video","create"]:${sessionId}`;
   await page.addInitScript(({chatKey,analysisKey,legacy,sessionId,analysisId})=>{
    if(!legacy)sessionStorage.setItem(chatKey,JSON.stringify({sessionId,pending:null}));
    sessionStorage.setItem(analysisKey,JSON.stringify({sessionId,analysisId}));
   },{chatKey,analysisKey,legacy,sessionId,analysisId});
   await page.route('**/api/prompt-assistance*',route=>{
    const url=new URL(route.request().url());
    return route.fulfill({json:{ok:true,result:url.searchParams.has('sessionId')?{sessionId,scope:'video:create',status:'expired',turns:[],pending:null,proposal:null}:initialStatus}});
   });
   await page.route('**/api/prompt-assistance/analyses**',route=>{
    assert.equal(route.request().method(),'GET');assert.equal(new URL(route.request().url()).searchParams.get('sessionId'),sessionId);reads++;
    return route.fulfill({json:{ok:true,result:{sessionId,reused:false,status:{state:completed?(scenario==='prepared'?'prepared':'completed'):'unknown',error:null,chargedCredits:completed&&scenario!=='prepared'?2:null,
     quote:{analysisId,ref:{type:'asset',assetId:'test-video',kind:'video'},goal:'Inspect reference',reason:'requested',modality:'visual',startSec:0,endSec:5,maxCredits:10,policyVersion:'test',expiresAt:new Date(Date.now()+900_000).toISOString(),profile:'video-frames-v1',model:'gpt-6.1-terra',confirmationRequired:true},
     result:completed&&scenario!=='prepared'?{summary:'A dog runs behind a car.',observations:[],coverage:{startSec:0,endSec:5,sampledAtSec:[0,2,5],complete:false}}:null}}}});
   });
   await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
   await expect(page.getByRole('button',{name:'Reference analysis…'})).toBeVisible();
   await expect(page.getByRole('button',{name:'New chat',exact:true})).toBeDisabled();
   assert.equal(await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).sessionId,chatKey),sessionId);
   await page.getByRole('button',{name:'Reference analysis…'}).click();completed=true;await page.getByRole('button',{name:'Check analysis'}).click();
   if(scenario==='prepared')await expect(page.getByText('10 credits maximum',{exact:false})).toBeVisible();else await expect(page.getByText('A dog runs behind a car.',{exact:true})).toBeVisible();assert.ok(reads>=2);
   await page.getByRole('button',{name:'Close analysis'}).click();await expect(page.getByRole('button',{name:'New chat',exact:true})).toBeEnabled();
   assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),analysisKey),null);
  }finally{await browser.close();await fixture.close();}
 });
}
