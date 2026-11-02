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
 const [engine,setEngine]=useState(false),[reference,setReference]=useState(false),[ratio,setRatio]=useState(false);
 const writeText=value=>{localStorage.setItem('synthetic-draft',value);setText(value);};
 const [media,setMedia]=useState(false),[text,setText]=useState(()=>localStorage.getItem('synthetic-draft')??'An original synthetic manual draft.'),[generation,setGeneration]=useState({blocked:false});
 return <main><nav>
 <button onClick={()=>setEngine(value=>!value)}>Change engine</button><button onClick={()=>setReference(value=>!value)}>Change reference</button><button onClick={()=>setRatio(value=>!value)}>Change ratio</button>
 <button onClick={()=>setMedia(true)}>Media</button><button onClick={()=>setMedia(false)}>Create workspace</button>
 <button onClick={()=>setOwner(value=>value==='owner'?'other':'owner')}>Change account</button>
 <button onClick={()=>setSurface(value=>value==='video'?'image':'video')}>Change surface</button>
 {['create','modify','extend'].map(value=><button key={value} onClick={()=>setWorkflow(value)}>Workflow {value}</button>)}
 </nav>{media?<p>Media library</p>:<>
 <PromptAssistanceComposer context={{accountKey:owner,scopeKey:JSON.stringify([owner,surface,workflow]),contextKey:'synthetic',live:{surface,workflow,engineId:engine?'wan-3':'wan-3-prime',mode:surface==='image'?'t2i':'t2v',settings:{aspectRatio:ratio?'9:16':'16:9'},references:reference?[{id:'synthetic-reference',fieldId:'image_url',kind:'image',status:'ready'}]:[]}}}
 locale="en" modelLabel="Synthetic model" draftText={text} onApplyText={writeText} onGenerationStateChange={setGeneration}>
 <textarea aria-label="Manual prompt" value={text} onChange={event=>writeText(event.target.value)}/>
 </PromptAssistanceComposer><button disabled={generation.blocked} onClick={()=>{throw Error('Media generation forbidden in local fixture');}}>Generate $1.23</button>
 </>}</main>;
}createRoot(document.getElementById('root')).render(<Fixture/>);`;

async function syntheticNetwork(page:Page){
 const sessions=new Map<string,unknown>();let posts=0;const unexpected:string[]=[];
 // No real API or external provider traffic is allowed by this harness.
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/api/')&&url.pathname!=='/api/prompt-assistance'){unexpected.push(url.pathname);return route.abort();}if(!['127.0.0.1','localhost'].includes(url.hostname)){unexpected.push(url.origin);return route.abort();}return route.continue();});
 await page.route('**/api/prompt-assistance*',async route=>{
  const url=new URL(route.request().url());
  if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:url.searchParams.has('sessionId')?sessions.get(url.searchParams.get('sessionId')!):initialStatus}});
  const body=route.request().postDataJSON();assert.equal(body.action,'message');posts++;
  const request=body.request,reply={reply:'A synthetic reply ready for review.',text:'A revised synthetic scene.'};
  sessions.set(request.sessionId,{sessionId:request.sessionId,scope:`${request.draft.surface}:${request.draft.workflow}`,status:'active',turns:[{requestId:request.requestId,message:request.message,reply:reply.reply}],pending:null,proposal:{text:reply.text,draftFingerprint:createHash('sha256').update(canonicalPromptDraft(request.draft)).digest('hex')}});
  return route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,requestId:request.requestId,draftRevision:request.draftRevision,target:'prompt',message:request.message,state:'complete',reply,assistance:initialStatus}}});
 });
 return {posts:()=>posts,unexpected};
}
const tab=(page:Page,name:'Prompt'|'AI assistant')=>page.getByRole('tab',{name,exact:true});
async function returnFromMedia(page:Page){await page.getByRole('button',{name:'Media',exact:true}).click();await expect(page.getByText('Media library',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Create workspace',exact:true}).click();}


const apply=(page:Page)=>page.locator('[data-assistance-apply]');
const generate=(page:Page)=>page.getByRole('button',{name:'Generate $1.23',exact:true});
async function sendAndApply(page:Page){
 await tab(page,'AI assistant').click();
 await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('Prepare a synthetic scene.');
 await page.getByRole('button',{name:'Send message to Milo',exact:true}).click();
 await expect(apply(page)).toBeEnabled();await apply(page).click();await tab(page,'AI assistant').click();
}
for(const browserType of [chromium,webkit])test(`applied prompt stays reapplicable after Media and reload, with fresh explicit permission (${browserType.name()})`,{timeout:60000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true}),browser=await browserType.launch();
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));const network=await syntheticNetwork(page);
  await page.goto(fixture.url);await sendAndApply(page);
  await expect(generate(page)).toBeEnabled();await expect(apply(page)).toBeEnabled();
  await expect(page.getByText('Update needed',{exact:true})).toHaveCount(0);
  assert.equal(await page.locator('[data-assistance-proposal]').evaluate(element=>element.getBoundingClientRect().height),53);
  // Identical reapplication must retain the only useful Undo, the original manual text.
  await apply(page).click();await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Manual prompt',exact:true})).toHaveValue('An original synthetic manual draft.');
  await tab(page,'AI assistant').click();await expect(generate(page)).toBeDisabled();await expect(apply(page)).toBeDisabled();
  await sendAndApply(page);
  for(const restore of [()=>returnFromMedia(page),()=>page.reload()]){
   await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('milo-composer:v2:["owner","video","create"]')??'null')?.local?.proposal?.valid)).toBe(true);
   await restore();await expect(tab(page,'AI assistant')).toHaveAttribute('aria-selected','true');
   await expect(page.getByText('A synthetic reply ready for review.',{exact:true})).toBeVisible();
   await expect(generate(page)).toBeDisabled();await expect(apply(page)).toBeEnabled();
   await expect(page.getByText('Update needed',{exact:true})).toHaveCount(0);
   assert.equal(await page.locator('[data-assistance-proposal]').evaluate(element=>element.getBoundingClientRect().height),53);
   await apply(page).click();await expect(page.getByRole('textbox',{name:'Manual prompt',exact:true})).toHaveValue('A revised synthetic scene.');
   await tab(page,'AI assistant').click();await expect(generate(page)).toBeEnabled();
  }
  if(process.env.MILO_REAPPLY_EVIDENCE_DIR)await page.screenshot({path:`${process.env.MILO_REAPPLY_EVIDENCE_DIR}/reapplied-${browserType.name()}.png`});
  const freshTab=await page.context().newPage();await syntheticNetwork(freshTab);await freshTab.goto(fixture.url);await tab(freshTab,'AI assistant').click();
  await expect(freshTab.getByText('A synthetic reply ready for review.',{exact:true})).toHaveCount(0);await expect(generate(freshTab)).toBeDisabled();await freshTab.close();
  assert.deepEqual(network.unexpected,[]);
  assert.equal(network.posts(),2,'reapplication and restoration never send another provider request');assert.deepEqual(errors,[]);
 }finally{await browser.close();await fixture.close();}
});

for(const change of ['edit','engine','reference','ratio'])test(`applied suggestion remains invalid after a reverted ${change}`,{timeout:60000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistanceLive:true}),browser=await chromium.launch();
 try{
  const page=await browser.newPage();const network=await syntheticNetwork(page);await page.goto(fixture.url);await sendAndApply(page);
  if(change==='edit'){
   await tab(page,'Prompt').click();const field=page.getByRole('textbox',{name:'Manual prompt',exact:true});await field.fill('A manual change.');await field.fill('A revised synthetic scene.');await tab(page,'AI assistant').click();
  }else{const control=page.getByRole('button',{name:`Change ${change}`,exact:true});await control.click();await control.click();}
  await expect(apply(page)).toBeDisabled();await expect(page.getByText('Update needed',{exact:true})).toBeVisible();
  // Qualified scalar settings keep existing in-memory generation permission; hard changes revoke it.
  if(change!=='ratio')await expect(generate(page)).toBeDisabled();
  await returnFromMedia(page);await expect(apply(page)).toBeDisabled();await expect(generate(page)).toBeDisabled();assert.equal(network.posts(),1);assert.deepEqual(network.unexpected,[]);
 }finally{await browser.close();await fixture.close();}
});
