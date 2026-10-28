import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

const source=`
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {WorkspaceComposerSurface} from './app/(core)/(workspace)/app/_components/WorkspaceComposerSurface';
const noop=()=>{};
function Fixture(){
 const engine=globalThis.fixtureConfig.engine;
 const [prompt,setPrompt]=useState('Original prompt');
 const [context,setContext]=useState({klingElements:[],shotType:'customize',voiceIdsInput:'',cfgScale:null,sourceAccount:{userId:'owner',token:'fixture'}});
 globalThis.changeContext=patch=>setContext(current=>({...current,...patch}));
 return <I18nProvider locale="en" dictionary={{}} fallback={{}}><WorkspaceComposerSurface
  selectedEngine={engine} form={{engineId:engine.id,mode:'t2v',durationSec:5,resolution:'720p',aspectRatio:'16:9',fps:24,iterations:1,audio:false,extraInputValues:{}}}
  setForm={noop} prompt={prompt} setPrompt={setPrompt} negativePrompt="" setNegativePrompt={noop}
  price={1.23} currency="USD" isPricing={false} isSubmitting={false} preflightError={null} preflight={null} startRender={()=>{globalThis.generations=(globalThis.generations??0)+1}}
  inputSchemaSummary={{assetFields:[],promotedFields:[],secondaryFields:[],promptRequired:true,negativePromptRequired:false}}
  inputAssets={{}} isUnifiedSeedance={false} isUnifiedKlingO3={true} klingO3UnsupportedVideoReason={null}
  workflowCopy={{clearReferencesToUseStartEnd:'',clearStartEndToUseReferences:'',removeAudioToUnlock:''}} guestUploadLockedReason={null} uiLocale="en"
  activeManualMode={null} handleComposerModeToggle={noop} composerWorkflowNotice={null} pendingGenerations={[]}
  handleAssetAdd={noop} handlePrepareVideoExcerpt={noop} handleVideoExcerptEditorChange={noop} handleAssetRemove={noop} handleOpenAssetLibrary={noop} showNotice={noop}
  supportsKlingV3Controls={true} supportsKlingV3VoiceControl={true} multiPromptEnabled={false} setMultiPromptEnabled={noop}
  multiPromptScenes={[]} multiPromptTotalSec={5} multiPromptActive={false} multiPromptInvalid={false} multiPromptError={null}
  handleMultiPromptAddScene={noop} handleMultiPromptRemoveScene={noop} handleMultiPromptUpdateScene={noop}
  audioWorkflowUnsupported={false} audioWorkflowLocked={false} showRetakeWorkflowAction={false} activeMode="t2v" submissionMode="t2v"
  handleDurationChange={noop} handleFramesChange={noop} handleResolutionChange={noop} handleAspectRatioChange={noop} handleFpsChange={noop}
  supportsAudioToggle={true} voiceControlEnabled={true} setCfgScale={noop} setShotType={noop} setVoiceIdsInput={noop}
  isSeedance={false} seedValue="" handleSeedChange={noop} cameraFixedValue={false} handleCameraFixedChange={noop} safetyCheckerValue={true} handleSafetyCheckerChange={noop} showSafetyCheckerControl={false}
  handleKlingElementAdd={noop} handleKlingElementRemove={noop} handleKlingElementAssetAdd={noop} handleKlingElementAssetRemove={noop} handleOpenKlingAssetLibrary={noop} setViewMode={noop} {...context}/></I18nProvider>
}
createRoot(document.getElementById('root')).render(<Fixture/>);`;

test('real video adapter invalidates suggestions and undo when subjects or external settings change', {timeout:90_000}, async()=>{
 const engine=listFalEngines().find(entry=>entry.id==='kling-o3-pro')!.engine;
 const fixture=await startWorkspaceReferenceFixture({source,assistancePreview:true,config:{engine}});
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await page.goto(fixture.url);
  const request=async()=>{
   await page.getByRole('tab',{name:'With Milo',exact:true}).click();
   await page.locator('[data-assistance-message]').fill('Refine this');await page.locator('[data-assistance-message]').press('Enter');
   await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
  };
  const subject={id:'person',frontal:{id:'portrait',kind:'image',name:'portrait.png',url:'/first.svg',previewUrl:'/first.svg',status:'ready'},video:null,references:[]};
  for(const patch of [{klingElements:[subject]},{shotType:'intelligent'},{voiceIdsInput:'new-voice'},{cfgScale:0.7}]){
   await request();await page.evaluate(patch=>(globalThis as any).changeContext(patch),patch);
   await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
  }
  await request();
  await page.evaluate(()=>(globalThis as any).changeContext({cfgScale:0.2}));
  await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
  await page.evaluate(()=>(globalThis as any).changeContext({cfgScale:0.7}));
  await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
  await page.locator('[data-assistance-message]').fill('Delayed suggestion');await page.locator('[data-assistance-message]').press('Enter');
  await page.evaluate(()=>(globalThis as any).changeContext({klingElements:[]}));
  await expect(page.getByText('Milo is writing…',{exact:true})).toHaveCount(0);
  await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
  await request();await page.locator('[data-assistance-apply]').click();
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeEnabled();
  await page.evaluate(subject=>(globalThis as any).changeContext({klingElements:[subject]}),subject);
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  await request();await page.evaluate(()=>(globalThis as any).changeContext({sourceAccount:{userId:'another',token:'fixture'}}));
  await expect(page.getByRole('tab',{name:'Prompt',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab',{name:'With Milo',exact:true}).click();
  await expect(page.locator('[data-assistance-apply]')).toHaveCount(0);
  assert.equal(await page.evaluate(()=>(globalThis as any).generations??0),0);
 }finally{await browser.close();await fixture.close();}
});
