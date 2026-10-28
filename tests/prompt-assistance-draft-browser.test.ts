import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, webkit, expect } from '@playwright/test';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

const source = `
import {useState} from 'react'; import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {WorkspaceComposerSurface} from './app/(core)/(workspace)/app/_components/WorkspaceComposerSurface';
const noop=()=>{};
function Fixture(){
 const [engineId,setEngineId]=useState('seedance-2-5'), [mode,setMode]=useState('t2v');
 const [prompt,setPrompt]=useState('Keep my prompt.'), [selected,setSelected]=useState(false), [live,setLive]=useState(false);
 const [form,setForm]=useState({engineId,mode,durationSec:4,resolution:'720p',aspectRatio:'16:9',fps:24,iterations:1,audio:false,extraInputValues:{}});
 const engine=globalThis.fixtureConfig.engines.find(e=>e.id===engineId);
 return <I18nProvider locale="en" dictionary={{}} fallback={{}}><main style={{padding:12,maxWidth:900}}>
  <button onClick={()=>setMode('v2v')}>Modify fixture</button><button onClick={()=>setMode('extend')}>Extend fixture</button>
  <button onClick={()=>setEngineId('seedance-2-0-mini')}>Other model fixture</button>
  <button onClick={()=>setForm(v=>({...v,iterations:2}))}>Multiple outputs fixture</button>
  <button onClick={()=>setLive(true)}>Enable workflow fixture</button>
  <WorkspaceComposerSurface selectedEngine={engine} form={{...form,engineId,mode}} setForm={setForm} prompt={prompt} setPrompt={setPrompt}
   localDraftPreview={live?{available:true,selected,phase:'setup',live:true,toggle:()=>{setSelected(v=>!v);setForm(v=>({...v,resolution:selected?'720p':'480p'}));},generate:noop}:undefined}
   negativePrompt="" setNegativePrompt={noop} price={selected?0.25:1} currency="USD" isPricing={false} isSubmitting={false}
   preflightError={null} preflight={null} startRender={()=>{throw Error('Unexpected generation')}}
   inputSchemaSummary={{assetFields:[],promotedFields:[],secondaryFields:[],promptRequired:true,negativePromptRequired:false}} inputAssets={{}}
   isUnifiedSeedance={true} isUnifiedKlingO3={false} klingO3UnsupportedVideoReason={null} workflowCopy={{}} guestUploadLockedReason={null}
   uiLocale="en" activeManualMode={mode} handleComposerModeToggle={noop} composerWorkflowNotice={null} pendingGenerations={[]}
   handleAssetAdd={noop} handleAssetRemove={noop} handleOpenAssetLibrary={noop} showNotice={noop}
   supportsKlingV3Controls={false} supportsKlingV3VoiceControl={false} multiPromptEnabled={false} setMultiPromptEnabled={noop}
   multiPromptScenes={[]} multiPromptTotalSec={4} multiPromptActive={false} multiPromptInvalid={false} multiPromptError={null}
   handleMultiPromptAddScene={noop} handleMultiPromptRemoveScene={noop} handleMultiPromptUpdateScene={noop}
   audioWorkflowUnsupported={false} audioWorkflowLocked={false} showRetakeWorkflowAction={false} activeMode={mode} submissionMode={mode}
   handleDurationChange={noop} handleFramesChange={noop} handleResolutionChange={noop} handleAspectRatioChange={noop} handleFpsChange={noop}
   supportsAudioToggle={false} voiceControlEnabled={false} cfgScale={null} setCfgScale={noop} shotType="customize" setShotType={noop}
   voiceIdsInput="" setVoiceIdsInput={noop} isSeedance={true} seedValue="" handleSeedChange={noop} cameraFixedValue={false} handleCameraFixedChange={noop}
   safetyCheckerValue={true} handleSafetyCheckerChange={noop} showSafetyCheckerControl={false}
   klingElements={[]} handleKlingElementAdd={noop} handleKlingElementRemove={noop} handleKlingElementAssetAdd={noop} handleKlingElementAssetRemove={noop} handleOpenKlingAssetLibrary={noop} setViewMode={noop}/>
  <output data-resolution>{form.resolution}</output>
 </main></I18nProvider>;
}createRoot(document.getElementById('root')).render(<Fixture/>);`;

test('Draft remains discoverable in the composer preview without enabling execution, and live controls keep working', {timeout:90_000}, async()=>{
 const engines=getBaseEngines().filter(e=>['seedance-2-5','seedance-2-0-mini'].includes(e.id));
 const fixture=await startWorkspaceReferenceFixture({source,config:{engines},assistancePreview:true});
 try {for(const launch of [()=>chromium.launch({headless:true}),()=>webkit.launch({headless:true})]) {
  const browser=await launch();
  try {for(const width of [390,1440]) {
   const page=await browser.newPage({viewport:{width,height:900}});await page.goto(fixture.url);
   const draft=page.getByRole('checkbox',{name:'Enable Draft · 480p → final 1080p',exact:true});
   for(const mode of ['Create','Modify','Extend']) {
    if(mode!=='Create') await page.getByRole('button',{name:mode+' fixture',exact:true}).click();
    for(const tab of ['Prompt','AI assistant']) {
     await page.getByRole('tab',{name:tab,exact:true}).click();
     await expect(draft).toBeVisible();await expect(draft).toBeDisabled();await expect(draft).not.toBeChecked();
     await expect(draft).toHaveAccessibleDescription(/not enabled in this local preview/);
     await expect(page.locator('[data-resolution]')).toHaveText('720p');
     await expect(page.locator('.app-generation-label')).not.toHaveText('Draft 480p');
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    }
   }
   await page.getByRole('button',{name:'Enable workflow fixture',exact:true}).click();
   await expect(draft).toBeEnabled();await draft.check();
   await expect(page.locator('.app-generation-label')).toHaveText('Draft 480p');
   await expect(page.locator('[data-resolution]')).toHaveText('480p');
   await draft.uncheck();await expect(page.locator('[data-resolution]')).toHaveText('720p');
   await expect(page.locator('[data-workspace-prompt]')).toHaveValue('Keep my prompt.');
   await page.reload();await page.getByRole('button',{name:'Multiple outputs fixture',exact:true}).click();await expect(draft).toHaveCount(0);
   await page.reload();await page.getByRole('button',{name:'Other model fixture',exact:true}).click();await expect(draft).toHaveCount(0);
   await page.close();
  }}finally{await browser.close();}
 }}finally{await fixture.close();}
});

test('ordinary workspace keeps Draft hidden when the server has not enabled it', async()=>{
 const engines=getBaseEngines().filter(e=>e.id==='seedance-2-5');
 const fixture=await startWorkspaceReferenceFixture({source,config:{engines}});
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();await page.goto(fixture.url);
  const draft=page.getByRole('checkbox',{name:'Enable Draft · 480p → final 1080p',exact:true});
  await expect(page.locator('[data-workspace-prompt]')).toBeVisible();
  await expect(draft).toHaveCount(0);
  await page.getByRole('button',{name:'Enable workflow fixture',exact:true}).click();
  await expect(draft).toBeVisible();await expect(draft).toBeEnabled();
  await draft.check();await expect(page.locator('.app-generation-label')).toHaveText('Draft 480p');
 }finally{await browser.close();await fixture.close();}
});
