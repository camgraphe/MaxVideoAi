import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
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
  await page.getByRole('button',{name:'Review',exact:true}).click();
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
  await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'New chat',exact:true})).toBeDisabled();
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
  await expect(page.getByText('A new conversation is ready.',{exact:false})).toBeVisible();
 }finally{await browser.close();await fixture.close();}
});
