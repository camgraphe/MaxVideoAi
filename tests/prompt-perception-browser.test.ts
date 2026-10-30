import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {chromium,expect} from '@playwright/test';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {initialStatus} from './helpers/milo-status-fixture';
import {studioCreditTariffForModel} from '../frontend/src/lib/studio/assistance-contract';

test('reference analysis reviews an excerpt, confirms once, restores by GET and invalidates proposals',{timeout:90_000},async()=>{
 const source=`import {useState} from 'react';import {createRoot} from 'react-dom/client';
 import {PromptAssistanceComposer} from './components/composer/PromptAssistanceComposer.client';
 function Fixture(){const [refs,setRefs]=useState([{fieldId:'reference_video_urls',slot:0,label:'Video 1',ref:{type:'asset',assetId:'test-video',kind:'video'}},{fieldId:'reference_audio_urls',slot:0,label:'Audio 1',ref:{type:'asset',assetId:'test-audio',kind:'audio'}}]);
 globalThis.replaceReference=()=>setRefs(current=>current.map(ref=>({...ref,ref:{...ref.ref,assetId:'changed'}})));
 return <PromptAssistanceComposer context={{scopeKey:'perception',contextKey:'constant',live:{surface:'video',engineId:'seedance-2-5',mode:'t2v',settings:{durationSec:8},references:refs}}} locale="en" modelLabel="Seedance 2.5" draftText="Original" onApplyText={()=>{}}><textarea aria-label="Manual prompt" defaultValue="Original"/></PromptAssistanceComposer>;}
 createRoot(document.getElementById('root')).render(<Fixture/>);`;
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true,perception:true});const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const status={...initialStatus,selectedModel:'gpt-6.1-terra',tariff:studioCreditTariffForModel('gpt-6.1-terra')};
  const posts:any[]=[],messages:any[]=[];let run:any,session='',getCount=0,complete=false;
  await page.route('**/api/prompt-assistance',async route=>{
   if(route.request().method()==='GET'){await route.fulfill({json:{ok:true,result:status}});return;}
   const request=route.request().postDataJSON().request;messages.push(request);
   await route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,requestId:request.requestId,draftRevision:request.draftRevision,target:'prompt',message:request.message,state:'complete',reply:{reply:'Prompt prepared.',text:'A revised prompt.'},assistance:status}}});
  });
  await page.route('**/api/prompt-assistance/analyses**',async route=>{
   if(route.request().method()==='GET'){
    getCount++;if(complete)run={...run,state:'completed',chargedCredits:4,result:{summary:'A red sphere moves from left to right.',observations:[],coverage:{startSec:2,endSec:7,sampledAtSec:[2,4,7],complete:false}}};
   }else{
    const body=route.request().postDataJSON();posts.push(body);
    if(body.action==='prepare'){
     session=body.sessionId;
     run={state:'prepared',chargedCredits:null,error:null,result:null,quote:{analysisId:randomUUID(),ref:body.draft.references[0].ref,goal:'Inspect reference',reason:'requested',modality:body.modality,startSec:body.startSec,endSec:body.endSec??30,maxCredits:15,policyVersion:'test',expiresAt:new Date(Date.now()+900_000).toISOString(),profile:body.modality==='audio'?'audio-window-v1':'video-frames-v1',model:'gpt-6.1-terra',confirmationRequired:true}};
    }else run={...run,state:'queued'};
   }
   await route.fulfill({json:{ok:true,result:{status:run,sessionId:session,reused:false}}});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('Refine this');await page.getByRole('button',{name:'Send message to Milo'}).click();await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
  await page.getByRole('button',{name:'Analyze references',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Analyze references'});
  assert.equal(posts.length,0,'Opening must not prepare or spend');
  await dialog.getByLabel('From (seconds)').fill('2');await dialog.getByLabel('To (seconds)').fill('7');
  await dialog.getByRole('button',{name:'Review analysis cost'}).click();await expect(dialog.getByText('15 credits maximum',{exact:false})).toBeVisible();
  if(process.env.MILO_REVIEW_SCREENSHOT)await page.screenshot({path:process.env.MILO_REVIEW_SCREENSHOT});
  assert.equal(posts.length,1);assert.equal(posts[0].action,'prepare');assert.equal(posts[0].sessionId,messages[0].sessionId);
  await page.evaluate(()=>(globalThis as any).replaceReference());
  await expect(dialog.getByRole('button',{name:/^Analyze ·/})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Review analysis cost'}).click();await dialog.getByRole('button',{name:/^Analyze ·/}).click();
  await expect(dialog.getByText('Analyzing the selected excerpt… You can close this panel.')).toBeVisible();
  assert.equal(posts.filter(p=>p.action==='confirm').length,1);
  await dialog.getByRole('button',{name:'Close analysis'}).click();await expect(page.getByRole('button',{name:'Send message to Milo'})).toBeDisabled();
  complete=true;await expect(page.getByRole('button',{name:'Analyze references',exact:true})).toBeVisible({timeout:10000});await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
  await page.getByRole('button',{name:'Analyze references',exact:true}).click();await expect(dialog.getByText('A red sphere moves from left to right.')).toBeVisible();
  const size=await dialog.boundingBox();assert.ok(size&&size.width<=390);
  await dialog.getByRole('button',{name:'Close analysis'}).click();
  // Restore a pending identity without repeating confirmation or restoring hidden chat history.
  complete=false;run={...run,state:'running',result:null,chargedCredits:null};
  await page.evaluate(({session,analysisId})=>sessionStorage.setItem('milo-analysis:perception',JSON.stringify({sessionId:session,analysisId})),{session,analysisId:run.quote.analysisId});
  const count=posts.length;await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await expect(page.getByRole('button',{name:'Reference analysis…'})).toBeVisible();assert.equal(posts.length,count);assert.ok(getCount>0);
  complete=true;await expect(page.getByRole('button',{name:'Analyze references',exact:true})).toBeVisible({timeout:10000});
 }finally{await browser.close();await fixture.close();}
});
