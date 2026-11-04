import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {chromium,expect} from '@playwright/test';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {initialStatus} from './helpers/milo-status-fixture';
import {studioCreditTariffForModel} from '../frontend/src/lib/studio/assistance-contract';

const source=`import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {PromptAssistanceComposer} from './components/composer/PromptAssistanceComposer.client';
function Fixture(){const [asset,setAsset]=useState('audio-original');
globalThis.replaceReference=()=>setAsset('audio-replacement');
return <PromptAssistanceComposer context={{scopeKey:'inline-analysis',contextKey:'constant',live:{surface:'video',engineId:'seedance-2-5',mode:'t2v',settings:{durationSec:8},references:[{fieldId:'reference_audio_urls',slot:0,label:'Audio 1',ref:{type:'asset',assetId:asset,kind:'audio'}}]}}} locale="en" modelLabel="Seedance 2.5" draftText="Original draft" onApplyText={()=>{}}><textarea aria-label="Manual prompt" defaultValue="Original draft"/></PromptAssistanceComposer>;}
createRoot(document.getElementById('root')).render(<Fixture/>);`;

async function setup(options:{lite?:boolean;expires?:number}={}){
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true,perception:true});
 const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844}});
 const selectedModel=options.lite?'gpt-6-luna':'gpt-6.1-terra';
 const status={...initialStatus,selectedModel,tariff:studioCreditTariffForModel(selectedModel)};
 const posts:any[]=[],messages:any[]=[],choices:any[]=[];let run:any,session='';
 await page.route('**/api/prompt-assistance',async route=>{
  if(route.request().method()==='GET'){await route.fulfill({json:{ok:true,result:status}});return;}
  const body=route.request().postDataJSON();
  if(!body.request){choices.push(body);await route.fulfill({json:{ok:true,result:status}});return;}
  const request=body.request;messages.push(request);
  await route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,requestId:request.requestId,draftRevision:request.draftRevision,target:'prompt',message:request.message,state:'complete',reply:{reply:'I can inspect the selected sound excerpt here.',text:null,analysisRequest:{fieldId:'reference_audio_urls',slot:0,modality:'audio',startSec:2,endSec:7,ref:{type:'asset',assetId:'audio-original',kind:'audio'}}},assistance:status}}});
 });
 await page.route('**/api/prompt-assistance/analyses**',async route=>{
  const body=route.request().postDataJSON();posts.push(body);
  if(body.action==='prepare'){
   session=body.sessionId;
   run={state:'prepared',chargedCredits:null,error:null,result:null,quote:{analysisId:randomUUID(),ref:body.draft.references[0].ref,goal:'Inspect reference',reason:'requested',modality:body.modality,startSec:body.startSec,endSec:body.endSec,maxCredits:15,policyVersion:'test',expiresAt:new Date(Date.now()+(options.expires??900_000)).toISOString(),profile:'audio-window-v1',model:'gpt-6.1-terra',confirmationRequired:true}};
  }else run={...run,state:'completed',chargedCredits:4,result:{summary:'A short rhythmic drum pattern.',observations:[],coverage:{startSec:2,endSec:7,sampledAtSec:[],complete:false}}};
  await route.fulfill({json:{ok:true,result:{status:run,sessionId:session,reused:false}}});
 });
 await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
 await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('listen to this first');await page.getByRole('button',{name:'Send message to Milo'}).click();
 return {page,posts,messages,choices,card:page.locator('[data-assistance-transcript]').getByRole('region',{name:'Analyze references'}),close:async()=>{await browser.close();await fixture.close();}};
}

test('Milo recommends an inline excerpt, requires confirmation and preserves the unsent message',{timeout:60_000},async()=>{
 const f=await setup();try{
  await expect(f.card).toBeVisible();await expect(f.card.getByLabel('From (seconds)')).toHaveValue('2');await expect(f.card.getByLabel('To (seconds)')).toHaveValue('7');
  assert.equal(f.posts.length,0);assert.equal(f.messages.length,1);
  await f.card.getByRole('button',{name:'Review analysis cost'}).click();await expect(f.card.getByText('15 credits maximum',{exact:false})).toBeVisible();
  assert.deepEqual(f.posts.map(p=>p.action),['prepare']);
  await f.page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('Keep my next instruction');
  await f.card.getByRole('button',{name:/^Analyze ·/}).click();await expect(f.card.getByText('A short rhythmic drum pattern.')).toBeVisible();
  assert.deepEqual(f.posts.map(p=>p.action),['prepare','confirm']);assert.equal(f.messages.length,1,'Analysis must not silently send a paid writing call');
  await f.card.getByRole('button',{name:'Close analysis'}).click();
  await expect(f.page.getByRole('button',{name:'Analyze references',exact:true})).toBeFocused();
  await f.page.getByRole('button',{name:'Analyze references',exact:true}).click();
  await f.card.getByRole('button',{name:'Continue with this analysis'}).click();
  await expect(f.page.getByRole('textbox',{name:'Message Milo',exact:true})).toHaveValue('Keep my next instruction');
  assert.equal(f.messages.length,1);assert.equal(f.choices.length,0);
 }finally{await f.close();}
});

test('a replaced reference cannot silently inherit the assistant recommendation',{timeout:60_000},async()=>{
 const f=await setup();try{
  await expect(f.card).toBeVisible();await f.page.evaluate(()=>(globalThis as any).replaceReference());
  await expect(f.card.getByRole('button',{name:'Review analysis cost'})).toBeDisabled();
  await expect(f.card.getByText('The reference Milo suggested has changed. Review the current reference before continuing.')).toBeVisible();
  assert.equal(f.posts.length,0);
  await f.card.getByRole('button',{name:'Use current reference'}).click();await f.card.getByRole('button',{name:'Review analysis cost'}).click();
  await expect(f.card.getByRole('button',{name:/^Analyze ·/})).toBeEnabled();assert.equal(f.posts[0].draft.references[0].ref.assetId,'audio-replacement');
 }finally{await f.close();}
});

test('an expired estimate requires a fresh review without another user state change',{timeout:60_000},async()=>{
 const f=await setup({expires:800});try{
  await expect(f.card).toBeVisible();await f.card.getByRole('button',{name:'Review analysis cost'}).click();
  await expect(f.card.getByRole('button',{name:/^Analyze ·/})).toBeEnabled();
  await expect(f.card.getByRole('button',{name:/^Analyze ·/})).toHaveCount(0,{timeout:5000});
  await expect(f.card.getByRole('button',{name:'Review analysis cost'})).toBeEnabled();assert.deepEqual(f.posts.map(p=>p.action),['prepare']);
 }finally{await f.close();}
});

test('Lite offers settings inside the chat without choosing a level or starting analysis',{timeout:60_000},async()=>{
 const f=await setup({lite:true});try{
  await expect(f.card).toBeVisible();await expect(f.card.getByRole('button',{name:'Review analysis cost'})).toBeDisabled();
  await f.card.getByRole('button',{name:'Milo settings',exact:true}).click();
  await expect(f.page.getByRole('dialog')).toBeVisible();assert.equal(f.choices.length,0);assert.equal(f.posts.length,0);
 }finally{await f.close();}
});


test('a historical recommendation preserves the completed paid analysis recovered by GET',{timeout:60_000},async()=>{
 const identity={sessionId:'10000000-0000-4000-8000-000000000001',analysisId:'20000000-0000-4000-8000-000000000001'};
 const ref={type:'asset',assetId:'audio-synthetic',kind:'audio'};
 const source=`import {useState} from 'react';import {createRoot} from 'react-dom/client';import {PromptReferenceAnalysis} from './components/composer/PromptReferenceAnalysis.client';const ref=${JSON.stringify(ref)};const recommendation={id:'restored-assistant',request:{fieldId:'reference_audio_urls',slot:0,modality:'audio',startSec:2,endSec:7,ref}};function Fixture(){const[open,setOpen]=useState(false);return <PromptReferenceAnalysis scopeKey="review-recovery" draft={{surface:'video',engineId:'seedance-2-5',mode:'t2v',settings:{},text:'Draft',target:'prompt',references:[{fieldId:'reference_audio_urls',slot:0,label:'Audio 1',ref}]}} model="gpt-6.1-terra" session={()=>'${identity.sessionId}'} blocked={false} onBusy={()=>{}} onCompleted={()=>{}} open={open} onOpenChange={setOpen} recommendation={recommendation} onSettings={()=>{}} onContinue={()=>{}}/>}createRoot(document.getElementById('root')).render(<Fixture/>);`;
 const fixture=await startWorkspaceReferenceFixture({source,config:{},perception:true,assistanceLive:true});const browser=await chromium.launch();
 try{
  const page=await browser.newPage();let gets=0,posts=0;
  await page.addInitScript(({identity})=>sessionStorage.setItem('milo-analysis:review-recovery',JSON.stringify(identity)),{identity});
  await page.route('**/api/prompt-assistance/analyses**',async route=>{if(route.request().method()==='GET')gets++;else posts++;await route.fulfill({json:{ok:true,result:{sessionId:identity.sessionId,reused:false,status:{state:'completed',chargedCredits:4,error:null,result:{summary:'Synthetic paid analysis recovered.',observations:[],coverage:{startSec:2,endSec:7,sampledAtSec:[],complete:false}},quote:{analysisId:identity.analysisId,ref,goal:'Inspect reference',reason:'requested',modality:'audio',startSec:2,endSec:7,maxCredits:15,policyVersion:'test',expiresAt:new Date(Date.now()+900000).toISOString(),profile:'audio-window-v1',model:'gpt-6.1-terra',confirmationRequired:true}}}}});});
  await page.goto(fixture.url);
  await expect(page.getByText('Synthetic paid analysis recovered.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Review analysis cost'})).toHaveCount(0);
  assert.equal(gets,1);assert.equal(posts,0);
 }finally{await browser.close();await fixture.close();}
});
