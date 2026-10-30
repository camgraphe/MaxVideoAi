import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium,expect} from '@playwright/test';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {initialStatus} from './helpers/milo-status-fixture';

const source=`import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {PromptAssistanceComposer} from './components/composer/PromptAssistanceComposer.client';
function Fixture(){const [text,setText]=useState('Quiet forest');return <PromptAssistanceComposer context={{accountKey:'owner',scopeKey:JSON.stringify(['owner','video','create']),contextKey:'seedance',live:{surface:'video',workflow:'create',engineId:'seedance-2-5',mode:'t2v',settings:{durationSec:5},references:[]}}} locale="en" modelLabel="Seedance" draftText={text} onApplyText={setText}><textarea aria-label="Manual prompt" value={text} onChange={e=>setText(e.target.value)}/></PromptAssistanceComposer>};createRoot(document.getElementById('root')).render(<Fixture/>);`;

test('authentication failure during recovery retains the pending identity until recovery succeeds',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true});const browser=await chromium.launch();
 try{
  const page=await browser.newPage();let original:any;let recoveries=0;let messages=0;
  await page.route('**/api/prompt-assistance*',async route=>{
   const url=new URL(route.request().url());
   if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:url.searchParams.has('sessionId')?{sessionId:original.sessionId,scope:'video:create',status:'active',turns:[],pending:recoveries<2?{requestId:original.requestId}:null,proposal:null}:initialStatus}});
   const body=route.request().postDataJSON();
   if(body.action==='message'){messages++;original=body.request;return route.abort('failed');}
   recoveries++;assert.equal(body.requestId,original.requestId);
   if(recoveries===1)return route.fulfill({status:401,json:{ok:false,error:'AUTH_REQUIRED'}});
   return route.fulfill({json:{ok:true,result:{sessionId:original.sessionId,requestId:original.requestId,draftRevision:original.draftRevision,target:'prompt',message:original.message,state:'failed',error:'REQUEST_UNANSWERED',assistance:initialStatus}}});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await page.getByRole('textbox',{name:'Message Milo'}).fill('Add mist');await page.getByRole('button',{name:'Send message to Milo'}).click();
  await page.getByRole('button',{name:'Check reply'}).click();
  await expect(page.getByRole('link',{name:'Sign in to chat'})).toBeVisible();
  const key='milo-composer:v2:["owner","video","create"]';
  await expect.poll(()=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).pending?.requestId,key)).toBe(original.requestId);
  await expect(page.getByRole('button',{name:'New chat',exact:true})).toBeDisabled();
  await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await page.getByRole('button',{name:'Check reply'}).click();
  await expect(page.getByText('this request’s credit hold was released.',{exact:false})).toBeVisible();assert.equal(messages,1);assert.equal(recoveries,2);
 }finally{await browser.close();await fixture.close();}
});

test('expired authentication during chat restoration prompts sign-in and keeps recovery identity',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true});const browser=await chromium.launch();
 try{
  const page=await browser.newPage();const sessionId='1b278e01-30cc-4bf4-9163-8589899de4c4',requestId='54e7b4b6-c71c-4291-9a08-308918984dfd';const key='milo-composer:v2:["owner","video","create"]';let authorized=false;
  await page.addInitScript(({key,sessionId,requestId})=>sessionStorage.setItem(key,JSON.stringify({sessionId,pending:{sessionId,requestId}})),{key,sessionId,requestId});
  await page.route('**/api/prompt-assistance*',route=>{
   const url=new URL(route.request().url());
   if(!url.searchParams.has('sessionId'))return route.fulfill({json:{ok:true,result:initialStatus}});
   return authorized?route.fulfill({json:{ok:true,result:{sessionId,scope:'video:create',status:'active',turns:[],pending:{requestId},proposal:null}}}):route.fulfill({status:401,json:{ok:false,error:'UNAUTHORIZED'}});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await expect(page.getByRole('link',{name:'Sign in to chat'})).toBeVisible();
  assert.equal(await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).pending.requestId,key),requestId);
  await expect(page.getByRole('button',{name:'New chat',exact:true})).toBeDisabled();
  authorized=true;await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.getByRole('button',{name:'Check reply'})).toBeVisible();
 }finally{await browser.close();await fixture.close();}
});

test('stopping the local wait retains recovery and serializes checks until a terminal reply',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true});const browser=await chromium.launch();
 let finishOriginal:(()=>void)|undefined,finishRecovery:(()=>void)|undefined;
 try{
  const page=await browser.newPage();let original:any;let messages=0,recoveries=0;let originalFinished=false;
  await page.route('**/api/prompt-assistance*',async route=>{
   if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:initialStatus}});
   const body=route.request().postDataJSON();
   if(body.action==='message'){
    messages++;original=body.request;
    await new Promise<void>(resolve=>{finishOriginal=resolve;});
    await route.fulfill({json:{ok:true,result:{sessionId:original.sessionId,requestId:original.requestId,draftRevision:original.draftRevision,target:'prompt',message:original.message,state:'complete',reply:{reply:'Late original reply',text:'Late original proposal'},assistance:initialStatus}}}).catch(()=>{});originalFinished=true;return;
   }
   assert.equal(body.action,'recover');assert.equal(body.sessionId,original.sessionId);assert.equal(body.requestId,original.requestId);recoveries++;
   const state=recoveries===1?'pending':recoveries===2?'unknown':'complete';
   if(recoveries===1)await new Promise<void>(resolve=>{finishRecovery=resolve;});
   return route.fulfill({json:{ok:true,result:{sessionId:original.sessionId,requestId:original.requestId,draftRevision:original.draftRevision,target:'prompt',message:original.message,state,reply:state==='complete'?{reply:'Recovered terminal reply',text:'Recovered proposal'}:undefined,assistance:initialStatus}}});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Message Milo'}),send=page.getByRole('button',{name:'Send message to Milo'}),newChat=page.getByRole('button',{name:'New chat',exact:true});
  await input.fill('Add mist');await send.click();await expect(page.getByRole('button',{name:'Stop waiting',exact:true})).toBeVisible();
  await input.fill('New writing must wait');await expect(send).toBeDisabled();await expect(newChat).toBeDisabled();
  await page.getByRole('button',{name:'Stop waiting',exact:true}).click();
  const check=page.getByRole('button',{name:'Check reply',exact:true});await expect(check).toBeVisible();
  await expect(page.getByText('Stopping the wait does not cancel a call already started.',{exact:false})).toBeVisible();
  const key='milo-composer:v2:["owner","video","create"]';
  const storedRequest=()=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).pending?.requestId,key);
  assert.equal(await storedRequest(),original.requestId);
  await check.evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});await expect.poll(()=>recoveries).toBe(1);
  await expect(page.getByRole('button',{name:'Stop waiting',exact:true})).toBeVisible();await expect(send).toBeDisabled();await expect(newChat).toBeDisabled();
  finishRecovery?.();await expect(check).toBeVisible();assert.equal(await storedRequest(),original.requestId);
  await check.click();await expect.poll(()=>recoveries).toBe(2);await expect(check).toBeVisible();assert.equal(await storedRequest(),original.requestId);
  await expect(send).toBeDisabled();await expect(newChat).toBeDisabled();await expect(input).toHaveValue('New writing must wait');
  await check.click();await expect(page.getByText('Recovered terminal reply',{exact:true})).toBeVisible();
  await expect(check).toHaveCount(0);await expect(send).toBeEnabled();await expect(newChat).toBeEnabled();assert.equal(await storedRequest(),undefined);
  finishOriginal?.();await expect.poll(()=>originalFinished).toBe(true);await expect(page.getByText('Late original reply',{exact:true})).toHaveCount(0);
  assert.equal(messages,1);assert.equal(recoveries,3);
  await page.getByRole('tab',{name:'Prompt',exact:true}).click();await expect(page.getByRole('textbox',{name:'Manual prompt'})).toHaveValue('Quiet forest');
 }finally{finishOriginal?.();finishRecovery?.();await browser.close();await fixture.close();}
});
