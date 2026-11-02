import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {chromium,webkit,expect,type Page} from '@playwright/test';
import {canonicalPromptDraft} from '../frontend/src/lib/prompt-assistance/session';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {initialStatus} from './helpers/milo-status-fixture';

// Real writing-mode, proposal and generation-permission owners. Only network I/O is synthetic.
const source=`
import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {Composer} from './components/Composer';import {I18nProvider} from './lib/i18n/I18nProvider';
import {videoPromptReviewKey} from './src/lib/prompt-assistance/application-review';
function Fixture(){
 const [media,setMedia]=useState(false),[ratio,setRatio]=useState('9:16'),[text,setText]=useState(()=>localStorage.getItem('synthetic-draft')??'An old yoga draft.');
 const writeText=value=>{localStorage.setItem('synthetic-draft',value);setText(value);};
 const model=globalThis.fixtureConfig.engine;
 const form={engineId:model.id,mode:'t2v',durationSec:4,resolution:'480p',aspectRatio:ratio,audio:false};
 const context={form,klingElements:[],voiceIdsInput:'',voiceControlEnabled:false,multiPromptEnabled:false};
 return <I18nProvider locale="en" dictionary={{}} fallback={{}}><main style={{maxWidth:900,margin:'20px auto'}}><nav>
 <button onClick={()=>setMedia(true)}>Media</button><button onClick={()=>setMedia(false)}>Create workspace</button><button onClick={()=>setRatio(value=>value==='9:16'?'16:9':'9:16')}>Change ratio</button>
 </nav>{media?<p>Media library</p>:<Composer density="workspace" engine={model} activeManualMode="t2v" prompt={text} onPromptChange={writeText} assetFields={[]} assets={{}} price={1.23} currency="USD" isLoading={false} onGenerate={()=>{throw Error('Media generation forbidden in local fixture');}}
 assistance={{accountKey:'owner',scopeKey:JSON.stringify(['owner','video','create']),contextKey:JSON.stringify(context),reviewKey:videoPromptReviewKey(context),live:{surface:'video',workflow:'create',engineId:model.id,mode:'t2v',settings:{durationSec:4,resolution:'480p',aspectRatio:ratio,audio:false},references:[]}}}/>}</main></I18nProvider>;
}createRoot(document.getElementById('root')).render(<Fixture/>);`;
const config={engine:listFalEngines().find(entry=>entry.id==='seedance-2-5')!.engine};

async function syntheticNetwork(page:Page){
 const sessions=new Map<string,unknown>();let posts=0;const unexpected:string[]=[];
 // No real API or external provider traffic is allowed by this harness.
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/api/')&&url.pathname!=='/api/prompt-assistance'){unexpected.push(url.pathname);return route.abort();}if(!['127.0.0.1','localhost'].includes(url.hostname)){unexpected.push(url.origin);return route.abort();}return route.continue();});
 await page.route('**/api/prompt-assistance*',async route=>{
  const url=new URL(route.request().url());
  if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:url.searchParams.has('sessionId')?sessions.get(url.searchParams.get('sessionId')!):initialStatus}});
  const body=route.request().postDataJSON();assert.equal(body.action,'message');posts++;
  const request=body.request,reply={reply:'A synthetic reply ready for review.',text:'A bakery scene with croissants.'};
  sessions.set(request.sessionId,{sessionId:request.sessionId,scope:`${request.draft.surface}:${request.draft.workflow}`,status:'active',turns:[{requestId:request.requestId,message:request.message,reply:reply.reply}],pending:null,proposal:{text:reply.text,draftFingerprint:createHash('sha256').update(canonicalPromptDraft(request.draft)).digest('hex')}});
  return route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,requestId:request.requestId,draftRevision:request.draftRevision,target:'prompt',message:request.message,state:'complete',reply,assistance:initialStatus}}});
 });
 return {posts:()=>posts,unexpected};
}
const tab=(page:Page,name:'Prompt'|'AI assistant')=>page.getByRole('tab',{name,exact:true});
async function returnFromMedia(page:Page){await page.getByRole('button',{name:'Media',exact:true}).click();await expect(page.getByText('Media library',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Create workspace',exact:true}).click();}


const apply=(page:Page)=>page.locator('[data-assistance-apply]');
const generate=(page:Page)=>page.getByRole('button',{name:/^Generate/});
async function sendAndApply(page:Page){
 await tab(page,'AI assistant').click();
 await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill('Prepare a synthetic scene.');
 await page.getByRole('button',{name:'Send message to Milo',exact:true}).click();
 await expect(apply(page)).toBeEnabled();await apply(page).click();await tab(page,'AI assistant').click();
}
for(const browserType of [chromium,webkit])for(const remount of [false,true])test(`settings review after ${remount?'Media and explicit reapplication':'application'} uses applied text (${browserType.name()})`,{timeout:60000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true}),browser=await browserType.launch();
 try{
  const page=await browser.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));const network=await syntheticNetwork(page);
  await page.goto(fixture.url);await sendAndApply(page);await expect(generate(page)).toBeEnabled();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('milo-composer:v2:["owner","video","create"]')??'null')?.local?.proposal?.valid)).toBe(true);
  assert.equal(await page.evaluate(()=>Object.hasOwn(JSON.parse(sessionStorage.getItem('milo-composer:v2:["owner","video","create"]')!).local.proposal,'appliedReview')),false,'applied review baseline must remain memory-only');
  if(remount){
   await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('milo-composer:v2:["owner","video","create"]')??'null')?.local?.proposal?.valid)).toBe(true);
   await returnFromMedia(page);await expect(generate(page)).toBeDisabled();await expect(apply(page)).toBeEnabled();await apply(page).click();await tab(page,'AI assistant').click();await expect(generate(page)).toBeEnabled();
  }
  if(!remount)await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Change ratio',exact:true}).click();
  const review=page.getByRole('button',{name:'Review & use',exact:true});await expect(review).toBeEnabled();
  assert.equal(await page.locator('[data-assistance-proposal]').evaluate(element=>element.getBoundingClientRect().height),53);
  await review.click();await expect(page.locator('[data-assistance-settings-changes]')).toContainText('9:16');await expect(page.locator('[data-assistance-settings-changes]')).toContainText('16:9');
  await expect(page.locator('[data-assistance-editor]')).toHaveValue('A bakery scene with croissants.');
  await page.getByRole('button',{name:'Use with current settings',exact:true}).click();
  await expect(page.locator('[data-workspace-prompt]')).toHaveValue('A bakery scene with croissants.');
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toHaveCount(0);
  assert.equal(network.posts(),1);assert.deepEqual(network.unexpected,[]);assert.deepEqual(errors,[]);
 }finally{await browser.close();await fixture.close();}
});
