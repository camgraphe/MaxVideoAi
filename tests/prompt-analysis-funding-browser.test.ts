import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {chromium,expect} from '@playwright/test';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';

const sessionId='57df1ec4-6d45-4898-b499-95ddfd3f5185';
const source=`import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {PromptReferenceAnalysis} from './components/composer/PromptReferenceAnalysis.client';
function Fixture(){const[busy,setBusy]=useState(false),[settings,setSettings]=useState(false);return <>
<output data-analysis-busy>{String(busy)}</output><button type="button" disabled={busy}>Composer action</button>
<PromptReferenceAnalysis scopeKey="funding-review" draft={{surface:'video',engineId:'seedance-2-5',mode:'ref2v',target:'prompt',text:'',settings:{durationSec:5},references:[{fieldId:'reference_video_urls',slot:0,label:'Video 1',ref:{type:'asset',assetId:'synthetic-video',kind:'video'}}]}} model={globalThis.fixtureConfig.model} session={()=>'${sessionId}'} blocked={false} onBusy={setBusy} onCompleted={()=>{throw Error('No completed analysis expected');}} open={true} onOpenChange={()=>{}} onSettings={()=>setSettings(true)} onContinue={()=>{}}/>
{settings&&<div role="dialog" aria-label="Milo settings">Existing credits and levels</div>}</>;}
createRoot(document.getElementById('root')).render(<Fixture/>);`;

test('failed duration verification never locks recovery or implies a paid analysis started',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{model:'gpt-6.1-terra'}}),browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage(),actions:string[]=[];
  await page.route('**/api/prompt-assistance/analyses**',async route=>{actions.push(route.request().postDataJSON().action);return route.fulfill({status:503,json:{ok:false,error:'REFERENCE_DURATION_UNKNOWN'}});});
  await page.goto(fixture.url);await page.getByRole('button',{name:'Review analysis cost'}).click();
  await expect(page.getByRole('alert')).toContainText('No analysis started. Keep the original selected and retry verification');
  await expect(page.locator('[data-analysis-busy]')).toHaveText('false');
  await expect(page.getByRole('button',{name:'Composer action'})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Check analysis',exact:true})).toHaveCount(0);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('milo-analysis:funding-review')),null);
  assert.deepEqual(actions,['prepare']);
 }finally{await browser.close();await fixture.close();}
});

for(const [model,httpStatus] of [['gpt-6.1-terra',402],['gpt-6.1-sol',409]] as const)test(`known ${httpStatus} analysis funding rejection keeps the quote and unlocks ${model} settings`,{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{model}}),browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage(),actions:string[]=[];
  const quote={analysisId:randomUUID(),ref:{type:'asset',assetId:'synthetic-video',kind:'video'},goal:'Inspect reference',reason:'requested',modality:'visual',startSec:0,endSec:5,maxCredits:15,policyVersion:'test',expiresAt:new Date(Date.now()+900_000).toISOString(),profile:'video-frames-v1',model,confirmationRequired:true};
  await page.route('**/api/prompt-assistance/analyses**',async route=>{
   const body=route.request().postDataJSON();actions.push(body.action);
   if(body.action==='prepare')return route.fulfill({json:{ok:true,result:{sessionId,status:{state:'prepared',quote,chargedCredits:null,result:null,error:null}}}});
   assert.equal(body.action,'confirm');assert.equal(body.confirmation.analysisId,quote.analysisId);
   return route.fulfill({status:httpStatus,json:{ok:false,error:'SPENDING_LIMIT_EXCEEDED',message:'This analysis exceeds your available Milo credits.'}});
  });
  await page.goto(fixture.url);await page.getByRole('button',{name:'Review analysis cost'}).click();
  await page.getByRole('button',{name:'Analyze · 15 credits max',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('This analysis exceeds your available Milo credits.');
  await expect(page.locator('[data-analysis-busy]')).toHaveText('false');
  await expect(page.getByRole('button',{name:'Composer action'})).toBeEnabled();
  await expect(page.getByText('15 credits maximum',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Check analysis',exact:true})).toHaveCount(0);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('milo-analysis:funding-review')),null,'a proven nonstarted confirmation must not persist a pending-work lock');
  await page.getByRole('button',{name:'Milo settings',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Milo settings'})).toBeVisible();
  assert.deepEqual(actions,['prepare','confirm'],'reading funding options never retries confirmation or starts new work');
 }finally{await browser.close();await fixture.close();}
});

for(const outcome of ['network loss','unknown server outcome'] as const)test(`analysis confirmation with ${outcome} keeps recovery and its pending-work lock`,{timeout:90_000},async()=>{
 const model='gpt-6.1-terra',fixture=await startWorkspaceReferenceFixture({source,config:{model}}),browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage(),actions:string[]=[];
  const quote={analysisId:randomUUID(),ref:{type:'asset',assetId:'synthetic-video',kind:'video'},goal:'Inspect reference',reason:'requested',modality:'visual',startSec:0,endSec:5,maxCredits:15,policyVersion:'test',expiresAt:new Date(Date.now()+900_000).toISOString(),profile:'video-frames-v1',model,confirmationRequired:true};
  await page.route('**/api/prompt-assistance/analyses**',async route=>{
   const body=route.request().postDataJSON();actions.push(body.action);
   if(body.action==='prepare')return route.fulfill({json:{ok:true,result:{sessionId,status:{state:'prepared',quote,chargedCredits:null,result:null,error:null}}}});
   return outcome==='network loss'?route.abort('failed'):route.fulfill({status:503,json:{ok:false,error:'SPENDING_LIMIT_EXCEEDED'}});
  });
  await page.goto(fixture.url);await page.getByRole('button',{name:'Review analysis cost'}).click();
  await page.getByRole('button',{name:'Analyze · 15 credits max',exact:true}).click();
  await expect(page.getByRole('button',{name:'Check analysis',exact:true})).toBeVisible();
  await expect(page.locator('[data-analysis-busy]')).toHaveText('true');
  await expect(page.getByRole('button',{name:'Composer action'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Milo settings',exact:true})).toHaveCount(0);
  assert.deepEqual(JSON.parse((await page.evaluate(()=>sessionStorage.getItem('milo-analysis:funding-review')))! ),{sessionId,analysisId:quote.analysisId});
  assert.deepEqual(actions,['prepare','confirm'],'a lost confirmation must never be retried automatically');
 }finally{await browser.close();await fixture.close();}
});
