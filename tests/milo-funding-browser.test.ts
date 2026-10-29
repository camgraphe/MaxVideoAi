import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium,expect} from '@playwright/test';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import type {StudioAssistanceStatus} from '../frontend/src/lib/studio/assistance-contract';
import {initialStatus} from './helpers/milo-status-fixture';

const source=`import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {PromptAssistanceComposer} from './components/composer/PromptAssistanceComposer.client';
function Fixture(){const [owner,setOwner]=useState('owner');globalThis.changeOwner=()=>setOwner('another');return <PromptAssistanceComposer context={{scopeKey:owner,contextKey:'video',live:{surface:'video',engineId:'seedance-2-5',mode:'t2v',settings:{durationSec:5},references:[]}}} locale="en" modelLabel="Seedance 2.5" draftText="Original prompt" onApplyText={()=>{}}><textarea aria-label="Manual prompt" defaultValue="Original prompt"/></PromptAssistanceComposer>;}createRoot(document.getElementById('root')).render(<Fixture/>);`;

test('composer keeps a declined message editable, buys nothing, and sends once only after an explicit Lite choice',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true}),browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});let status:StudioAssistanceStatus={...initialStatus,selectedModel:'gpt-6.1-terra' as const,mode:'included_sol' as const};const calls:any[]=[];
  await page.route('**/api/prompt-assistance',async route=>{
   if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:status}});
   const body=route.request().postDataJSON();calls.push(body);
   if(body.action==='choose'){status={...status,selectedModel:'gpt-6-luna',mode:'sponsored_luna',revision:status.revision+1};return route.fulfill({json:{ok:true,result:status}});}
   const req=body.request,failed=status.selectedModel!=='gpt-6-luna';
   return route.fulfill({json:{ok:true,result:{sessionId:req.sessionId,requestId:req.requestId,draftRevision:req.draftRevision,target:'prompt',message:req.message,assistance:status,state:failed?'failed':'complete',...(failed?{error:'SPENDING_LIMIT_EXCEEDED',safeToRetry:true,nextAction:{type:'studio_assistance',reason:'included_exhausted',safeToStartNewRequest:true,completedModelCalls:0,canStartFollowup:false}}:{reply:{reply:'I kept the red coat.',text:'A red coat in soft light.'}})}}});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const message=page.getByRole('textbox',{name:'Message Milo',exact:true});
  await message.fill('Keep the coat.');await page.getByRole('button',{name:'Send message to Milo'}).click();
  await expect(message).toHaveValue('Keep the coat.');
  const lite=page.getByRole('button',{name:'Send with Lite',exact:true});await expect(lite).toBeVisible();
  await page.getByRole('button',{name:'Add credits',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Close assistance'}).click();assert.equal(calls.length,1);
  await message.fill('Keep the red coat.');await lite.dblclick();
  await expect(page.getByText('I kept the red coat.',{exact:true})).toBeVisible();
  assert.deepEqual(calls.map(x=>x.action),['message','choose','message']);
  assert.equal(calls[2].request.message,'Keep the red coat.');assert.equal(calls[2].request.assistanceModel,'gpt-6-luna');assert.equal(calls[2].request.assistanceRevision,status.revision);
  assert.equal(calls[2].request.sessionId,calls[0].request.sessionId);
  assert.notEqual(calls[2].request.requestId,calls[0].request.requestId);
  await expect(page.getByRole('button',{name:'Milo settings and credits'})).toContainText('Lite');
  await expect(lite).toHaveCount(0);
 }finally{await browser.close();await fixture.close();}
});

test('signed-out composer offers login without sending or displaying a purchase error',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true}),browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();let posts=0;await page.route('**/api/prompt-assistance',route=>{if(route.request().method()==='POST')posts++;return route.fulfill({status:401,json:{ok:false,error:'UNAUTHORIZED'}});});
 await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
 await expect(page.getByRole('link',{name:'Sign in to chat',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Send message to Milo'})).toBeDisabled();
 await page.getByRole('tab',{name:'Prompt',exact:true}).click();await expect(page.getByRole('textbox',{name:'Manual prompt'})).toBeVisible();assert.equal(posts,0);
 }finally{await browser.close();await fixture.close();}
});


test('changing accounts during the Lite choice never sends the previous account message',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true}),browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();const status:StudioAssistanceStatus={...initialStatus,selectedModel:'gpt-6.1-terra',credits:{...initialStatus.credits!,included:{...initialStatus.credits!.included,remaining:0}}};
 let choices=0,messages=0,release!:()=>void;const wait=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/prompt-assistance',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:status}});
  const body=route.request().postDataJSON();if(body.action==='message'){messages++;return route.abort();}
  choices++;await wait;await route.fulfill({json:{ok:true,result:{...status,selectedModel:'gpt-6-luna',revision:4}}}).catch(()=>{});
 });
 await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
 await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('Private owner idea');
 await page.getByRole('button',{name:'Send with Lite',exact:true}).click();await expect.poll(()=>choices).toBe(1);
 await page.evaluate(()=>{(globalThis as any).changeOwner();});release();
 await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Message Milo',exact:true})).toHaveValue('');assert.equal(messages,0);
 }finally{await browser.close();await fixture.close();}
});

test('unknown usage shows recovery even when the previously displayed balance is empty',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true}),browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();let messages=0;
 await page.route('**/api/prompt-assistance',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:{...initialStatus,selectedModel:'gpt-6.1-terra',...(messages?{credits:{...initialStatus.credits!,included:{...initialStatus.credits!.included,remaining:0}}}:{})}}});
  messages++;const req=route.request().postDataJSON().request;
  return route.fulfill({json:{ok:true,result:{...req,target:'prompt',state:'unknown',error:'USAGE_UNRESOLVED',assistance:{...initialStatus,unresolvedCalls:1}}}});
 });
 await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('A new idea');
 await page.getByRole('button',{name:'Send message to Milo'}).click();await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Send with Lite',exact:true})).toHaveCount(0);assert.equal(messages,1);
 }finally{await browser.close();await fixture.close();}
});

test('Studio funding action resumes the saved task once without buying credits',{timeout:90_000},async()=>{
 const task={requestId:'7271d631-3d61-4361-899b-6875f89db49a',profile:'standard',policyVersion:'studio-task-budget-2026-10-29-v3',model:'gpt-6.1-terra',state:'paused',phase:'paused',maxCredits:250,consumedCredits:20,reservedCredits:0,completedCalls:1,allowedCalls:4,revision:0,canContinue:true,error:'funding'};
 const taskSource=`import {createRoot} from 'react-dom/client';import {ConversationTask} from './app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ConversationTask.client';createRoot(document.getElementById('root')).render(<ConversationTask liteAvailable={true} task={globalThis.fixtureConfig} projectId="project" accountKey="owner" locale="en" onChanged={()=>{}} onSimplify={()=>{}} onAssistance={()=>{globalThis.openedCredits=true}}/>);`;
 const fixture=await startWorkspaceReferenceFixture({source:taskSource,config:task}),browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();const calls:any[]=[];await page.route('**/api/studio/projects/project/conversation-tasks/*',async route=>{calls.push(route.request().postDataJSON());await route.fulfill({json:{ok:true,result:{...task,model:'gpt-6-luna',state:'queued',phase:'queued',revision:1,allowedCalls:8,canContinue:false,error:null}}});});
 await page.goto(fixture.url);await page.getByRole('button',{name:'Add credits',exact:true}).click();assert.equal(calls.length,0);
 await page.getByRole('button',{name:'Continue with Lite',exact:true}).dblclick();await expect.poll(()=>calls.length).toBe(1);
 assert.equal(calls[0].action,'continue_lite');assert.equal(calls[0].requestId,task.requestId);assert.equal(calls[0].maxCredits,250);assert.equal(calls[0].expectedRevision,0);assert.ok(calls[0].approvalId);
 }finally{await browser.close();await fixture.close();}
});

test('reload then recover restores a safely rejected message for editing',{timeout:90_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true}),browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();let request:any;const status={...initialStatus,selectedModel:'gpt-6.1-terra'};
 await page.route('**/api/prompt-assistance',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:status}});
  const body=route.request().postDataJSON();if(body.action==='message'){request=body.request;return route.abort();}
  return route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,requestId:request.requestId,message:request.message,target:'prompt',draftRevision:0,state:'failed',safeToRetry:true,error:'SPENDING_LIMIT_EXCEEDED',assistance:status,nextAction:{type:'studio_assistance',reason:'included_exhausted',safeToStartNewRequest:true}}}});
 });
 await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('Keep the blue coat.');await page.getByRole('button',{name:'Send message to Milo'}).click();
 await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await page.getByRole('button',{name:'Check reply',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Message Milo',exact:true})).toHaveValue('Keep the blue coat.');await expect(page.getByRole('button',{name:'Send with Lite',exact:true})).toBeVisible();
 }finally{await browser.close();await fixture.close();}
});


test('a paused Studio task does not promise free Lite without confirmed availability',{timeout:90_000},async()=>{
 const task={requestId:'7271d631-3d61-4361-899b-6875f89db49a',profile:'standard',policyVersion:'studio-task-budget-2026-10-29-v3',model:'gpt-6.1-terra',state:'paused',phase:'paused',maxCredits:250,consumedCredits:20,reservedCredits:0,completedCalls:1,allowedCalls:4,revision:0,canContinue:true,error:'funding'};
 const taskSource=`import {createRoot} from 'react-dom/client';import {ConversationTask} from './app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ConversationTask.client';createRoot(document.getElementById('root')).render(<ConversationTask liteAvailable={false} task={globalThis.fixtureConfig} projectId="project" accountKey="owner" locale="en" onChanged={()=>{}} onSimplify={()=>{}} onAssistance={()=>{}}/>);`;
 const fixture=await startWorkspaceReferenceFixture({source:taskSource,config:task}),browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();await page.goto(fixture.url);await expect(page.getByRole('button',{name:'Continue with Lite',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Add credits',exact:true})).toBeVisible();await expect(page.getByText(/Free Lite is unavailable right now/)).toBeVisible();}
 finally{await browser.close();await fixture.close();}
});
