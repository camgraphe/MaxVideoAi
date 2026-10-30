import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium,expect} from '@playwright/test';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {studioCreditTariffForModel} from '../frontend/src/lib/studio/assistance-contract';

import {initialStatus} from './helpers/milo-status-fixture';

const source=`
import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {PromptAssistanceComposer} from './components/composer/PromptAssistanceComposer.client';
function Fixture(){
 const [owner,setOwner]=useState('owner'),[model,setModel]=useState('seedance-2-5'),[text,setText]=useState('Keep original detail.');
 globalThis.changeModel=()=>setModel('veo-3');globalThis.changeOwner=value=>setOwner(value);
 return <PromptAssistanceComposer context={{scopeKey:owner,contextKey:model,live:{surface:'video',engineId:model,mode:'t2v',settings:{durationSec:5},references:[]}}} locale="en" modelLabel={model} draftText={text} onApplyText={setText}>
 <textarea aria-label="Manual prompt" value={text} onChange={event=>setText(event.target.value)}/></PromptAssistanceComposer>;
}createRoot(document.getElementById('root')).render(<Fixture/>);`;

test('follow-up edits use Milo\'s latest unapplied suggestion while preserving the manual editor', {timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true});const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();const requests:any[]=[];
  await page.route('**/api/prompt-assistance',async route=>{
   if(route.request().method()==='GET'){await route.fulfill({json:{ok:true,result:initialStatus}});return;}
   const request=route.request().postDataJSON().request;requests.push(request);
   const text=requests.length===1?'A dog runs behind a car.':'A cat runs behind a car.';
   await route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,requestId:request.requestId,draftRevision:request.draftRevision,target:'prompt',message:request.message,state:'complete',reply:{reply:'Here is the revised prompt.',text},assistance:initialStatus}}});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const message=page.getByRole('textbox',{name:'Message Milo',exact:true}),send=page.getByRole('button',{name:'Send message to Milo'});
  await message.fill('A dog runs behind a car');await send.click();await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
  await message.fill('Replace the dog with a cat');await send.click();await expect.poll(()=>requests.length).toBe(2);
  assert.equal(requests[1].draft.text,'Keep original detail.');
  assert.equal(requests[1].activeSuggestion,'A dog runs behind a car.');
  await page.getByRole('tab',{name:'Prompt',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Manual prompt'})).toHaveValue('Keep original detail.');
  await page.getByRole('textbox',{name:'Manual prompt'}).fill('A manually revised scene.');
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await message.fill('Continue with my editor text');await send.click();await expect.poll(()=>requests.length).toBe(3);
  assert.equal(requests[2].draft.text,'A manually revised scene.');
  assert.equal(requests[2].activeSuggestion,undefined);
 }finally{await browser.close();await fixture.close();}
});


test('live composer sends current draft, recovers without resending, and guards late/account replies', {timeout:90_000},async()=>{
 let release:(()=>void)|undefined;
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true});const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();let status={...initialStatus};const calls:any[]=[];let request:any;let mode='clarify';
  await page.route('**/api/prompt-assistance',async route=>{
   if(route.request().method()==='GET'){await route.fulfill({json:{ok:true,result:status}});return;}
   const body=route.request().postDataJSON();calls.push(body);
   if(body.action==='choose'){status={...status,selectedModel:body.choice.action==='select_sol'?'gpt-6.1-sol':body.choice.action==='select_terra'?'gpt-6.1-terra':'gpt-6-luna',revision:status.revision+1};status.tariff=studioCreditTariffForModel(status.selectedModel);await route.fulfill({json:{ok:true,result:status}});return;}
   if(body.action==='message')request=body.request;
   if(mode==='disconnect'&&body.action==='message'){await route.abort('failed');return;}
   if(mode==='delay'&&body.action==='message')await new Promise<void>(resolve=>{release=resolve;});
   const result={sessionId:request.sessionId,requestId:request.requestId,draftRevision:request.draftRevision,target:request.draft.target,message:request.message,state:'complete',reply:{reply:mode==='clarify'?'Which setting matters most?':'I kept the original intent.',text:mode==='clarify'?null:'Revised full prompt.'},assistance:status};
   await route.fulfill({json:{ok:true,result}}).catch(()=>{});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const send=page.getByRole('button',{name:'Send message to Milo'}),message=page.getByRole('textbox',{name:'Message Milo',exact:true});
  const level=page.getByRole('button',{name:'Milo settings and credits'});
  await expect(level).toContainText('Lite');await level.click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByRole('group',{name:'Assistant model'}).getByRole('button')).toHaveCount(3);
  await dialog.getByRole('button',{name:'Standard',exact:true}).click();
  assert.equal(calls.length,0,'Viewing a level must not select it or spend credits');
  await dialog.getByRole('button',{name:'Continue with Standard',exact:true}).click();await expect(level).toContainText('Standard');
  assert.equal(calls[0].choice.action,'select_terra');
  await level.click();await dialog.getByRole('button',{name:'Max',exact:true}).click();
  await dialog.getByRole('button',{name:'Continue with Max',exact:true}).click();await expect(level).toContainText('Max');
  assert.equal(calls[1].choice.action,'select_sol');assert.ok(!calls.some(call=>call.choice?.action==='purchase_pack'));
  await message.fill('Help me refine this.');await send.click();await expect(page.getByText('Which setting matters most?')).toBeVisible();
  assert.equal(request.draft.text,'Keep original detail.');assert.equal(request.draft.engineId,'seedance-2-5');assert.equal(request.draft.settings.durationSec,5);
  await expect(page.locator('[data-assistance-apply]')).toHaveCount(0);
  mode='disconnect';await message.fill('Make the action clearer.');await send.click();
  await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();const count=calls.filter(call=>call.action==='message').length;
  await message.fill('Do not send a duplicate.');await expect(send).toBeDisabled();
  mode='reply';await page.getByRole('button',{name:'Check reply',exact:true}).click();await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
  assert.equal(calls.filter(call=>call.action==='message').length,count);assert.equal(calls.at(-1).action,'recover');
  await page.locator('[data-assistance-apply]').click();await expect(page.getByRole('textbox',{name:'Manual prompt'})).toHaveValue('Revised full prompt.');
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();mode='delay';await message.fill('A delayed improvement.');await send.click();
  await expect(page.getByRole('button',{name:'Stop waiting',exact:true})).toBeVisible();
  await page.evaluate(()=>(globalThis as any).changeModel());release?.();await expect(page.getByText('I kept the original intent.')).toHaveCount(2);
  await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
  mode='disconnect';await message.fill('Save this pending request.');await send.click();await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();
  await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();mode='reply';await page.getByRole('button',{name:'Check reply',exact:true}).click();
  await expect(page.getByText('I kept the original intent.')).toBeVisible();await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
  await page.evaluate(()=>(globalThis as any).changeOwner('another'));await expect(page.getByRole('tab',{name:'Prompt',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.getByText('I kept the original intent.')).toHaveCount(0);
 }finally{release?.();await browser.close();await fixture.close();}
});

test('every changed live context invalidates a pending suggestion even when the caller contextKey stays constant', {timeout:90_000},async()=>{
 const source=`import {useState} from 'react';import {createRoot} from 'react-dom/client';
 import {PromptAssistanceComposer} from './components/composer/PromptAssistanceComposer.client';
 function Fixture(){const [live,setLive]=useState({surface:'video',engineId:'seedance-2-5',mode:'t2v',settings:{durationSec:8,resolution:'720p',aspectRatio:'16:9',audio:true},references:[]});const [text,setText]=useState('Original prompt');
 globalThis.setContext=value=>setLive(current=>({...current,...value,settings:{...current.settings,...value.settings}}));
 return <PromptAssistanceComposer context={{scopeKey:'audit',contextKey:'constant',live}} locale="en" modelLabel={live.engineId} draftText={text} onApplyText={setText}><textarea aria-label="Manual prompt" value={text} onChange={event=>setText(event.target.value)}/></PromptAssistanceComposer>}
 createRoot(document.getElementById('root')).render(<Fixture/>);`;
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true});const browser=await chromium.launch({headless:true});
 let release:(()=>void)|undefined;
 try {
  const page=await browser.newPage();let sent:any,waiting=false;
  await page.route('**/api/prompt-assistance',async route=>{
   if(route.request().method()==='GET'){await route.fulfill({json:{ok:true,result:initialStatus}});return;}
   sent=route.request().postDataJSON().request;waiting=true;
   await new Promise<void>(resolve=>{release=resolve;});
   await route.fulfill({json:{ok:true,result:{sessionId:sent.sessionId,requestId:sent.requestId,draftRevision:sent.draftRevision,target:'prompt',message:sent.message,state:'complete',reply:{reply:'Revised for this context',text:'Proposed prompt'},assistance:initialStatus}}});waiting=false;
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const changes=[{settings:{durationSec:12}},{settings:{resolution:'1080p'}},{settings:{aspectRatio:'9:16'}},{settings:{audio:false}},
   {settings:{output_format:'mov'}},{settings:{draft:true}},{engineId:'seedance-2-0-mini'},
   {mode:'extend'},{references:[{fieldId:'video_urls',slot:0,label:'Source video',ref:{type:'asset',assetId:'prepared',kind:'video'}}]},
   {references:[]},{readOnlyText:{negativePrompt:'No lettering'}}];
  for(const [index,change] of changes.entries()){
   await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill(`Refine ${index}`);
   await page.getByRole('button',{name:'Send message to Milo'}).click();await expect.poll(()=>waiting).toBe(true);
   const revision=sent.draftRevision;
   await page.evaluate(value=>(globalThis as any).setContext(value),change);
   release?.();await expect.poll(()=>waiting).toBe(false);
   await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
   await expect(page.getByRole('tab',{name:'AI assistant',exact:true})).toHaveAttribute('aria-selected','true');
   assert.equal(sent.draftRevision,revision);
  }
  // A fresh reply can still be applied and undone after those invalidations.
  await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('Use the current settings');await page.getByRole('button',{name:'Send message to Milo'}).click();await expect.poll(()=>waiting).toBe(true);
  assert.equal(sent.draft.settings.durationSec,12);assert.equal(sent.draft.settings.resolution,'1080p');assert.equal(sent.draft.settings.aspectRatio,'9:16');assert.equal(sent.draft.settings.audio,false);
  assert.equal(sent.draft.engineId,'seedance-2-0-mini');assert.equal(sent.draft.mode,'extend');assert.equal(sent.draft.readOnlyText.negativePrompt,'No lettering');
  release?.();await expect(page.locator('[data-assistance-apply]')).toBeEnabled();await page.locator('[data-assistance-apply]').click();await expect(page.getByRole('textbox',{name:'Manual prompt'})).toHaveValue('Proposed prompt');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByRole('textbox',{name:'Manual prompt'})).toHaveValue('Original prompt');
 }finally{release?.();await browser.close();await fixture.close();}
});


test('unanswered replies unlock sending and the exposure cap does not create a false recovery loop',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true});const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();let posts=0;
  await page.route('**/api/prompt-assistance*',async route=>{
   if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:initialStatus}});
   posts++;const body=route.request().postDataJSON();assert.equal(body.action,'message');
   if(posts===2)return route.fulfill({status:409,json:{ok:false,error:'ASSISTANCE_RECOVERY_REQUIRED'}});
   const request=body.request;
   return route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,requestId:request.requestId,draftRevision:request.draftRevision,target:'prompt',message:request.message,state:'failed',safeToRetry:false,error:'REQUEST_UNANSWERED',assistance:initialStatus}}});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Message Milo',exact:true}),send=page.getByRole('button',{name:'Send message to Milo'});
  await input.fill('A slow tracking shot');await send.click();
  await expect(page.getByText('this request’s credit hold was released.',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Check reply',exact:true})).toHaveCount(0);
  await input.fill('Keep this new request');await expect(send).toBeEnabled();await send.click();
  await expect(page.getByText('Contact support before sending another message.',{exact:false})).toBeVisible();
  await expect(input).toHaveValue('Keep this new request');await expect(page.getByRole('button',{name:'Check reply',exact:true})).toHaveCount(0);
  assert.equal(posts,2);
  await page.getByRole('tab',{name:'Prompt',exact:true}).click();await expect(page.getByRole('textbox',{name:'Manual prompt'})).toHaveValue('Keep original detail.');
 }finally{await browser.close();await fixture.close();}
});
