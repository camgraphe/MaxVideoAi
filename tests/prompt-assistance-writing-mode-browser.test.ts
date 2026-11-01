import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {chromium,webkit,expect,type Page} from '@playwright/test';
import {canonicalPromptDraft} from '../frontend/src/lib/prompt-assistance/session';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {initialStatus} from './helpers/milo-status-fixture';

// Real writing-mode, proposal and generation-permission owners. Only network I/O is synthetic.
const source=`
import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {PromptAssistanceComposer} from './components/composer/PromptAssistanceComposer.client';
function Fixture(){
 const query=new URLSearchParams(location.search);
 const [owner,setOwner]=useState(query.get('owner')??'owner'),[surface,setSurface]=useState(query.get('surface')??'video'),[workflow,setWorkflow]=useState(query.get('workflow')??'create');
 const [media,setMedia]=useState(false),[text,setText]=useState('An original synthetic manual draft.'),[generation,setGeneration]=useState({blocked:false});
 return <main><nav>
 <button onClick={()=>setMedia(true)}>Media</button><button onClick={()=>setMedia(false)}>Create workspace</button>
 <button onClick={()=>setOwner(value=>value==='owner'?'other':'owner')}>Change account</button>
 <button onClick={()=>setSurface(value=>value==='video'?'image':'video')}>Change surface</button>
 {['create','modify','extend'].map(value=><button key={value} onClick={()=>setWorkflow(value)}>Workflow {value}</button>)}
 </nav>{media?<p>Media library</p>:<>
 <PromptAssistanceComposer context={{accountKey:owner,scopeKey:JSON.stringify([owner,surface,workflow]),contextKey:'synthetic',live:{surface,workflow,engineId:surface==='image'?'nano-banana-2-1':'wan-3-prime',mode:surface==='image'?'t2i':'t2v',settings:{},references:[]}}}
 locale="en" modelLabel="Synthetic model" draftText={text} onApplyText={setText} onGenerationStateChange={setGeneration}>
 <textarea aria-label="Manual prompt" value={text} onChange={event=>setText(event.target.value)}/>
 </PromptAssistanceComposer><button disabled={generation.blocked} onClick={()=>{throw Error('Media generation forbidden in local fixture');}}>Generate $1.23</button>
 </>}</main>;
}createRoot(document.getElementById('root')).render(<Fixture/>);`;

async function syntheticNetwork(page:Page){
 const sessions=new Map<string,unknown>();let posts=0;
 await page.route('**/api/prompt-assistance*',async route=>{
  const url=new URL(route.request().url());
  if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:url.searchParams.has('sessionId')?sessions.get(url.searchParams.get('sessionId')!):initialStatus}});
  const body=route.request().postDataJSON();assert.equal(body.action,'message');posts++;
  const request=body.request,reply={reply:'A synthetic reply ready for review.',text:'A revised synthetic scene.'};
  sessions.set(request.sessionId,{sessionId:request.sessionId,scope:`${request.draft.surface}:${request.draft.workflow}`,status:'active',turns:[{requestId:request.requestId,message:request.message,reply:reply.reply}],pending:null,proposal:{text:reply.text,draftFingerprint:createHash('sha256').update(canonicalPromptDraft(request.draft)).digest('hex')}});
  return route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,requestId:request.requestId,draftRevision:request.draftRevision,target:'prompt',message:request.message,state:'complete',reply,assistance:initialStatus}}});
 });
 return {posts:()=>posts};
}
const tab=(page:Page,name:'Prompt'|'AI assistant')=>page.getByRole('tab',{name,exact:true});
async function returnFromMedia(page:Page){await page.getByRole('button',{name:'Media',exact:true}).click();await expect(page.getByText('Media library',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Create workspace',exact:true}).click();}

for(const browserType of [chromium,webkit])test(`writing mode survives Media return and reload without granting generation permission (${browserType.name()})`,{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true}),browser=await browserType.launch();
 try{
  const page=await browser.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));const network=await syntheticNetwork(page);
  await page.goto(fixture.url);await tab(page,'AI assistant').click();
  await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('Help with this synthetic scene.');await page.getByRole('button',{name:'Send message to Milo',exact:true}).click();
  await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
  await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('An unsent follow-up.');
  for(const restore of [()=>returnFromMedia(page),()=>page.reload()]){
   await restore();await expect(tab(page,'AI assistant')).toHaveAttribute('aria-selected','true');
   await expect(page.getByText('A synthetic reply ready for review.',{exact:true})).toBeVisible();
   await expect(page.getByRole('textbox',{name:'Message Milo',exact:true})).toHaveValue('An unsent follow-up.');
   await expect(page.getByRole('button',{name:'Generate $1.23',exact:true})).toBeDisabled();
  }
  await tab(page,'Prompt').click();await returnFromMedia(page);await expect(tab(page,'Prompt')).toHaveAttribute('aria-selected','true');
  await page.reload();await expect(tab(page,'Prompt')).toHaveAttribute('aria-selected','true');
  await tab(page,'AI assistant').click();await expect(page.locator('[data-assistance-apply]')).toBeEnabled();await page.getByRole('button',{name:'Use prompt',exact:true}).click();
  await expect(tab(page,'Prompt')).toHaveAttribute('aria-selected','true');await expect(page.getByRole('textbox',{name:'Manual prompt',exact:true})).toHaveValue('A revised synthetic scene.');
  await returnFromMedia(page);await expect(tab(page,'Prompt')).toHaveAttribute('aria-selected','true');await page.reload();await expect(tab(page,'Prompt')).toHaveAttribute('aria-selected','true');
  assert.equal(network.posts(),1,'restoring the writing mode must never resend a message');assert.deepEqual(errors,[]);
 }finally{await browser.close();await fixture.close();}
});

test('writing choices stay private to account and surface while explicit workflow switches keep the active writer',{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true}),browser=await chromium.launch();
 try{
  const page=await browser.newPage();const network=await syntheticNetwork(page);
  await page.goto(fixture.url);await tab(page,'AI assistant').click();
  for(const workflow of ['modify','extend','create']){await page.getByRole('button',{name:`Workflow ${workflow}`,exact:true}).click();await expect(tab(page,'AI assistant')).toHaveAttribute('aria-selected','true');}
  await page.getByRole('button',{name:'Workflow modify',exact:true}).click();await tab(page,'Prompt').click();
  await page.getByRole('button',{name:'Workflow extend',exact:true}).click();await expect(tab(page,'Prompt')).toHaveAttribute('aria-selected','true');
  await page.goto(`${fixture.url}?workflow=create`);await expect(tab(page,'AI assistant')).toHaveAttribute('aria-selected','true');
  await page.goto(`${fixture.url}?workflow=modify`);await expect(tab(page,'Prompt')).toHaveAttribute('aria-selected','true');
  await page.goto(`${fixture.url}?surface=image`);await expect(tab(page,'Prompt')).toHaveAttribute('aria-selected','true');await tab(page,'AI assistant').click();
  await page.getByRole('button',{name:'Change surface',exact:true}).click();await expect(tab(page,'AI assistant')).toHaveAttribute('aria-selected','true');
  await tab(page,'Prompt').click();await page.getByRole('button',{name:'Change surface',exact:true}).click();await expect(tab(page,'AI assistant')).toHaveAttribute('aria-selected','true');
  await page.getByRole('button',{name:'Change account',exact:true}).click();await expect(tab(page,'Prompt')).toHaveAttribute('aria-selected','true');
  await tab(page,'AI assistant').click();await page.getByRole('button',{name:'Change account',exact:true}).click();await expect(tab(page,'AI assistant')).toHaveAttribute('aria-selected','true');
  await tab(page,'Prompt').click();await page.goto(`${fixture.url}?owner=other&surface=image`);await expect(tab(page,'AI assistant')).toHaveAttribute('aria-selected','true');
  await page.goto(`${fixture.url}?surface=image`);await expect(tab(page,'Prompt')).toHaveAttribute('aria-selected','true');assert.equal(network.posts(),0);
 }finally{await browser.close();await fixture.close();}
});

test('an explicit Milo entry wins stored Prompt and later chat hydration respects a manual choice',{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true}),browser=await chromium.launch();let release:(()=>void)|undefined;
 try{
  const page=await browser.newPage();await syntheticNetwork(page);
  await page.goto(fixture.url);await tab(page,'AI assistant').click();await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('A synthetic scene.');await page.getByRole('button',{name:'Send message to Milo',exact:true}).click();await expect(page.locator('[data-assistance-apply]')).toBeEnabled();await tab(page,'Prompt').click();
  await page.route('**/api/prompt-assistance?*',async route=>{
   if(new URL(route.request().url()).searchParams.has('sessionId'))await new Promise<void>(resolve=>release=resolve);
   await route.fallback();
  });
  await page.goto(`${fixture.url}?assistant=milo`);await expect.poll(()=>Boolean(release)).toBe(true);await expect(tab(page,'AI assistant')).toHaveAttribute('aria-selected','true');
  await tab(page,'Prompt').click();release!();await expect(page.getByText('Restoring this conversation…',{exact:true})).toHaveCount(0);await expect(tab(page,'Prompt')).toHaveAttribute('aria-selected','true');
  await page.goto(fixture.url);await expect(tab(page,'Prompt')).toHaveAttribute('aria-selected','true');
 }finally{release?.();await browser.close();await fixture.close();}
});

test('development effect replay never saves unhydrated Prompt over a restored assistant choice',{timeout:60_000},async()=>{
 const strictSource=source.replace("import {useState} from 'react'","import {StrictMode,useState} from 'react'").replace('render(<Fixture/>)','render(<StrictMode><Fixture/></StrictMode>)');
 const fixture=await startWorkspaceReferenceFixture({source:strictSource,config:{},assistanceLive:true,assistancePreview:true}),browser=await chromium.launch();
 try{
  const page=await browser.newPage();await syntheticNetwork(page);
  await page.addInitScript(()=>{
   const key='milo-writing-mode:v1:["owner","video","create"]';sessionStorage.setItem(key,'milo');
   const original=Storage.prototype.setItem;(globalThis as any).writingModeWrites=[];
   Storage.prototype.setItem=function(name,value){if(name===key)(globalThis as any).writingModeWrites.push(value);return original.call(this,name,value);};
  });
  await page.goto(fixture.url);await expect(tab(page,'AI assistant')).toHaveAttribute('aria-selected','true');
  assert.ok(!(await page.evaluate(()=>(globalThis as any).writingModeWrites)).includes('prompt'),'an unhydrated default must never be a durable writing choice');
 }finally{await browser.close();await fixture.close();}
});

for(const storage of ['invalid','blocked'])test(`${storage} writing-mode storage leaves manual and assistant writing usable`,{timeout:60_000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true}),browser=await chromium.launch();
 try{
  const page=await browser.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await syntheticNetwork(page);
  await page.addInitScript(storage=>{
   sessionStorage.setItem('milo-writing-mode:v1:["owner","video","create"]','unrecognized');
   if(storage!=='blocked')return;
   const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
   Storage.prototype.getItem=function(key){if(key.startsWith('milo-writing-mode:'))throw Error('Storage unavailable');return get.call(this,key);};
   Storage.prototype.setItem=function(key,value){if(key.startsWith('milo-writing-mode:'))throw Error('Storage unavailable');return set.call(this,key,value);};
  },storage);
  await page.goto(fixture.url);await expect(tab(page,'Prompt')).toHaveAttribute('aria-selected','true');await tab(page,'Prompt').focus();await page.keyboard.press('End');await expect(tab(page,'AI assistant')).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('textbox',{name:'Message Milo',exact:true})).toBeEditable();await page.keyboard.press('Home');await tab(page,'Prompt').click();await expect(page.getByRole('textbox',{name:'Manual prompt',exact:true})).toBeEditable();assert.deepEqual(errors,[]);
 }finally{await browser.close();await fixture.close();}
});
