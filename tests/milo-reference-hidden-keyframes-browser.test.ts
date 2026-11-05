import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium,expect} from '@playwright/test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {miloGenerationVideoSource} from './helpers/milo-generation-authorization-video-source';
import {initialStatus} from './helpers/milo-status-fixture';

for(const engineId of ['flux-3','luma-ray-3-2'])test(`${engineId} missing keyframe identity opens its existing dedicated owner`,{timeout:90000},async()=>{
 const mode=engineId==='flux-3'?'ref2v':'v2v',fieldId=engineId==='flux-3'?'reference_image_urls':'edit_keyframe_urls';
 const asset={id:'legacy',fieldId,kind:'image',status:'ready',name:'reference.png',url:'/first.svg',previewUrl:'/first.svg',type:'image/png',size:1024,width:1280,height:720};
 const engine=getFalEngineById(engineId)!.engine;
 const config={engine,nextEngine:getFalEngineById('wan-3-prime')!.engine,form:{engineId,mode,durationSec:5,durationOption:5,resolution:'720p',aspectRatio:'16:9',fps:24,iterations:1,audio:true,seedLocked:false,loop:false,
   extraInputValues:engineId==='flux-3'?{keyframe_slot_indexes:'0:0,1:119'}:{edit_keyframe_slot_indexes:'0:0,1:119'}},
  inputAssets:{[fieldId]:[{...asset,id:'kept',ref:{type:'asset',assetId:'ma_'+'a'.repeat(32),kind:'image'}},{...asset,id:'missing'}],
   ...(mode==='v2v'?{video_url:[{id:'source',assetId:'ma_'+'b'.repeat(32),fieldId:'video_url',kind:'video',status:'ready',name:'original.mp4',url:'/source.mp4',previewUrl:'/source.mp4',thumbnailUrl:'/first.svg',type:'video/mp4',size:1024,width:1280,height:720,durationSec:5}]}:{})},
  preflight:{ok:true,currency:'USD',total:707,pricing:{totalCents:707,currency:'USD'}}};
 const source=miloGenerationVideoSource.replace("useState('ref2v')",`useState('${mode}')`).replace('activeManualMode={null}',`activeManualMode="${mode}"`)
  .replace('const rendersRef=useRef([]);',`globalThis.restoreKeyframeModel=()=>{setEngine(config.engine);setMode('${mode}');};globalThis.readReferenceState=()=>JSON.stringify({form,inputAssets,prompt});const rendersRef=useRef([]);`);
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true}),browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:1000}});let posts=0;
  await page.route('**/api/prompt-assistance*',route=>{if(route.request().method()==='POST')posts++;return route.fulfill({json:{ok:true,result:initialStatus}});});
  await page.goto(fixture.url);await expect(page.getByTestId('video-keyframe-editor')).toBeVisible();
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Message Milo',exact:true});await input.fill('Keep the source, inspect the second image.');await input.press('Enter');
  await expect(page.getByText(/Image 2.*isn’t ready for Milo/)).toBeVisible();assert.equal(posts,0);
  const before=await page.evaluate(()=>(globalThis as any).readReferenceState());
  await page.getByRole('button',{name:'Manage Image 2',exact:true}).click();
  await expect(page.getByTestId('video-keyframe-editor').getByRole('button',{name:'Select keyframe 2',exact:true})).toBeFocused();
  assert.equal(await page.evaluate(()=>(globalThis as any).readReferenceState()),before,'Selecting the existing owner must not mutate references or settings.');
  await expect(input).toHaveValue('Keep the source, inspect the second image.');assert.equal(posts,0);
  await page.evaluate(()=>(globalThis as any).changeModel());await expect(page.getByTestId('video-keyframe-editor')).toHaveCount(0);
  await page.evaluate(()=>(globalThis as any).restoreKeyframeModel());await expect(page.getByTestId('video-keyframe-editor')).toBeVisible();
  await expect(page.getByTestId('video-keyframe-editor').getByRole('button',{name:'Select keyframe 2',exact:true})).not.toBeFocused();
  assert.equal(posts,0,'Returning to a model cannot replay an old reference-management request.');
 }finally{await browser.close();await fixture.close();}
});

for(const fieldId of ['reference_image_urls','unknown_reference'])test(`no Manage action is offered for ${fieldId} without a mounted reference owner`,{timeout:90000},async()=>{
 const engine=getFalEngineById('flux-3')!.engine;
 const source=`import{useState}from'react';import{createRoot}from'react-dom/client';import{Composer}from'./components/Composer';import{I18nProvider}from'./lib/i18n/I18nProvider';const config=globalThis.fixtureConfig;
 function Fixture(){const[prompt,setPrompt]=useState('Keep draft.');return <I18nProvider locale="en" dictionary={{}} fallback={{}}><Composer engine={config.engine} density="workspace" prompt={prompt} onPromptChange={setPrompt} promptRequired={false} price={1} currency="USD" isLoading={false} assetFields={[]} assets={{}}
 assistance={{accountKey:'owner',scopeKey:'unmanaged',contextKey:'unmanaged',live:{surface:'video',workflow:'create',engineId:config.engine.id,mode:'ref2v',settings:{},references:[{fieldId:config.fieldId,slot:0,label:'Image 1',ref:null}]}}}/></I18nProvider>;}createRoot(document.getElementById('root')).render(<Fixture/>);`;
 const fixture=await startWorkspaceReferenceFixture({source,config:{engine,fieldId},assistanceLive:true}),browser=await chromium.launch();
 try{const page=await browser.newPage();let posts=0;await page.route('**/api/prompt-assistance*',route=>{if(route.request().method()==='POST')posts++;return route.fulfill({json:{ok:true,result:initialStatus}});});
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();const input=page.getByRole('textbox',{name:'Message Milo',exact:true});await input.fill('Keep unsent.');await input.press('Enter');
  await expect(page.getByText(/Image 1.*isn’t ready for Milo/)).toBeVisible();await expect(page.getByRole('button',{name:'Manage Image 1',exact:true})).toHaveCount(0);assert.equal(posts,0);await expect(input).toHaveValue('Keep unsent.');
 }finally{await browser.close();await fixture.close();}
});
