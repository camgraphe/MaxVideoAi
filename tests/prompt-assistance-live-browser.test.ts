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
