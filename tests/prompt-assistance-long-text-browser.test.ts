import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium,webkit,expect} from '@playwright/test';
import {startWorkspaceReferenceFixture,workspaceReferenceFixtureSource} from './helpers/workspace-reference-browser-fixture';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {initialStatus} from './helpers/milo-status-fixture';
import {promptAssistanceRequestSchema} from '../frontend/src/lib/prompt-assistance/contract';
import {parsePromptProviderReply} from '../frontend/src/server/prompt-assistance/reply-format';

const brief='Begin creative brief.\n'+'É'.repeat(49973)+'\nEnd.';
const manual='Keep the manual editor exactly.';
const source=workspaceReferenceFixtureSource;
const config={engine:listFalEngines().find(entry=>entry.id==='wan-3-prime')!.engine,locale:'en',fields:[],assets:{},prompt:manual,assistance:{accountKey:'synthetic-owner',scopeKey:JSON.stringify(['synthetic-owner','video','create']),contextKey:'wan-3-prime',live:{surface:'video',workflow:'create',engineId:'wan-3-prime',mode:'t2v',settings:{durationSec:6,aspectRatio:'16:9',audio:false},references:[]}}};

for(const browserType of [chromium,webkit])test(`long brief and complete advice send, render and restore exactly (${browserType.name()})`,{timeout:120_000},async()=>{
 assert.equal(brief.length,50000);
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true}),browser=await browserType.launch();
 try{
  const page=await browser.newPage({viewport:{width:browserType===webkit?390:1440,height:900}}),sent:any[]=[],replies:string[]=[],errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  const snapshots=new Map<string,any>();
  await page.route('**/api/prompt-assistance*',async route=>{
   const url=new URL(route.request().url());
   if(route.request().method()==='GET'){
    if(!url.searchParams.has('sessionId'))return route.fulfill({json:{ok:true,result:initialStatus}});
    const snapshot=snapshots.get(url.searchParams.get('sessionId')!);
    return route.fulfill({status:snapshot?200:404,json:snapshot?{ok:true,result:snapshot}:{ok:false,error:'SESSION_NOT_FOUND'}});
   }
   const body=route.request().postDataJSON();assert.equal(body.action,'message');
   const input=promptAssistanceRequestSchema.parse(body.request);sent.push(input);
   const length=[6081,6452,50000][sent.length-1];assert.ok(length);
   const answer='Advice begins.\n'+'é'.repeat(length-28)+'\nAdvice ends.';
   assert.equal(answer.length,length);replies.push(answer);
   const reply=parsePromptProviderReply(JSON.stringify({kind:'conversation',reply:answer,text:null}),{replyFormat:'destination-v1'});
   const snapshot=snapshots.get(input.sessionId)??{sessionId:input.sessionId,scope:'video:create',status:'active',turns:[],proposal:null,pending:null};
   snapshot.turns.push({requestId:input.requestId,message:input.message,reply:answer});snapshots.set(input.sessionId,snapshot);
   return route.fulfill({json:{ok:true,result:{sessionId:input.sessionId,requestId:input.requestId,draftRevision:input.draftRevision,target:'prompt',message:input.message,state:'complete',reply,assistance:initialStatus}}});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const message=page.locator('[data-assistance-message]'),send=page.getByRole('button',{name:'Send message to Milo',exact:true});
  await message.fill(brief);await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await expect.poll(async()=>await message.inputValue()===brief).toBe(true);
  let inputHeight:number|undefined;
  for(let index=0;index<3;index++){
   if(index)await message.fill(`Continue plan ${index+1}.`);
   await send.click();await expect(page.getByRole('log').locator(':scope > div')).toHaveCount((index+1)*2);
   assert.equal(await page.getByRole('log').locator(':scope > div').nth(index*2+1).textContent(),replies[index]);
   await expect(page.locator('[data-assistance-proposal]')).toHaveCount(0);
   await expect(page.getByRole('button',{name:'Stop waiting',exact:true})).toHaveCount(0);
   const height=(await page.locator('[data-assistance-input]').boundingBox())!.height;
   if(inputHeight===undefined)inputHeight=height;else assert.equal(height,inputHeight,'longer complete advice does not change the fixed input bar');
  }
  assert.equal(sent[0].message,brief);assert.equal(sent[0].draft.engineId,'wan-3-prime');
  await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await expect(page.getByRole('log').locator(':scope > div')).toHaveCount(6);
  assert.equal(await page.getByRole('log').locator(':scope > div').first().textContent(),brief);
  for(let index=0;index<3;index++)assert.equal(await page.getByRole('log').locator(':scope > div').nth(index*2+1).textContent(),replies[index]);
  await expect(page.locator('[data-assistance-proposal]')).toHaveCount(0);
  await page.getByRole('tab',{name:'Prompt',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue(manual);
  assert.equal(sent.length,3,'restoration never sends or regenerates a message');assert.equal(await page.evaluate(()=>(globalThis as any).submissions??0),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
 }finally{await browser.close();await fixture.close();}
});

test('oversized human brief stays editable with an explicit limit and cannot be sent or silently cut',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true}),browser=await chromium.launch();
 try{
  const page=await browser.newPage();let posts=0;
  await page.route('**/api/prompt-assistance*',route=>{if(route.request().method()==='POST')posts++;return route.fulfill({json:{ok:true,result:initialStatus}});});
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const input=page.locator('[data-assistance-message]'),send=page.getByRole('button',{name:'Send message to Milo',exact:true});
  for(const oversized of ['B'+'x'.repeat(50000),' '+brief+' ']){
   await input.fill(oversized);await expect.poll(async()=>await input.inputValue()===oversized).toBe(true);await expect(input).toBeEditable();
   await expect(send).toBeDisabled();await expect(page.getByRole('status').filter({hasText:'50,000'})).toBeVisible();
   await input.press('Enter');assert.equal(posts,0);
  }
  await input.fill(brief);await expect(send).toBeEnabled();await expect(page.getByRole('status').filter({hasText:'50,000'})).toHaveCount(0);
 }finally{await browser.close();await fixture.close();}
});

test('an overlimit unsent message warns before reload and preserves history and the pending request identity',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true}),browser=await chromium.launch();
 try{
  const page=await browser.newPage();let snapshot:any;const sent:any[]=[];
  await page.route('**/api/prompt-assistance*',route=>{
   const url=new URL(route.request().url());
   if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:url.searchParams.has('sessionId')?snapshot:initialStatus}});
   const body=route.request().postDataJSON();assert.equal(body.action,'message');const input=body.request;sent.push(input);
   snapshot??={sessionId:input.sessionId,scope:'video:create',status:'active',turns:[],proposal:null,pending:null};
   const complete=sent.length===1;
   if(complete)snapshot.turns.push({requestId:input.requestId,message:input.message,reply:'The saved first reply.'});
   else snapshot.pending={requestId:input.requestId};
   return route.fulfill({json:{ok:true,result:{sessionId:input.sessionId,requestId:input.requestId,draftRevision:input.draftRevision,target:'prompt',message:input.message,assistance:initialStatus,
    ...(complete?{state:'complete',reply:{reply:'The saved first reply.',text:null}}:{state:'pending',phase:'calling'})}}});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const input=page.locator('[data-assistance-message]'),send=page.getByRole('button',{name:'Send message to Milo',exact:true});
  await input.fill('The first idea.');await send.click();await expect(page.getByText('The saved first reply.',{exact:true})).toBeVisible();
  await input.fill('The pending continuation.');await send.click();await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();
  await input.fill('B'+'x'.repeat(50000));
  await expect(page.getByRole('status').filter({hasText:'cannot be restored after reload'})).toBeVisible();
  await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await expect(page.getByText('The saved first reply.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();
  await expect(input).toHaveValue('');await expect(send).toBeDisabled();assert.equal(sent.length,2);
  const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('milo-composer:v2:["synthetic-owner","video","create"]')!));
  assert.equal(saved.sessionId,sent[0].sessionId);assert.deepEqual(saved.pending,{sessionId:sent[1].sessionId,requestId:sent[1].requestId});
 }finally{await browser.close();await fixture.close();}
});
