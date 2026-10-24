import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit, expect } from '@playwright/test';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

const source = `
import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {CoreSettingsBar} from './components/CoreSettingsBar';
import {useWorkspaceAssetState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import {useWorkspaceComposerState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceComposerState';
import {getBaseEngineIncludingHidden} from './src/lib/engines';
import {coerceFormState} from './app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import {buildWorkspacePreflightRequest} from './app/(core)/(workspace)/app/_lib/workspace-preflight-request';
const noop=()=>{};
function Main(){
 const engine=getBaseEngineIncludingHidden(globalThis.fixtureConfig.engineId);
 const [form,setForm]=useState({...coerceFormState(engine,'v2v',null),durationSec:8,durationOption:8,aspectRatio:'16:9',audio:true});
 const state=useWorkspaceAssetState('owner');
 const c=useWorkspaceComposerState({engines:[engine],form,setForm,inputAssets:state.inputAssets,setInputAssets:state.setInputAssets,inputAssetMutationRevision:state.inputAssetMutationRevision,klingElements:[],prompt:'Keep the person',multiPromptEnabled:false,setMultiPromptEnabled:noop,multiPromptScenes:[],setMultiPromptScenes:noop,voiceIdsInput:'',shotType:'customize',setShotType:noop,effectiveRequestedEngineToken:null,authChecked:true,hydratedForScope:'owner',storageScope:'owner',preserveStoredDraftRef:useRef(false),requestedEngineOverrideIdRef:useRef(null),requestedEngineOverrideTokenRef:useRef(null),requestedModeOverrideRef:useRef(null),writeStorage:noop,uiLocale:'fr',workflowCopy:{generateVideo:'Créer'},showNotice:noop});
 const quote=buildWorkspacePreflightRequest({form,selectedEngine:c.selectedEngine,submissionMode:c.submissionMode,effectiveDurationSec:c.effectiveDurationSec,supportsAudioToggle:c.supportsAudioToggle,voiceControlEnabled:false,inputAssets:state.inputAssets,memberTier:'Member'});
 const select=()=>state.commitInputAssetMutation(()=>({state:{video_url:[{id:'phone',assetId:'phone',fieldId:'video_url',kind:'video',name:'Phone.mov',type:'video/quicktime',size:1024,url:'https://example.invalid/phone',width:1080,height:1920,durationSec:4,status:'ready'}]}}));
 return <I18nProvider locale="fr" dictionary={{}} fallback={{}}><main style={{padding:16,maxWidth:900}}>
 <h1>Modifier une vidéo</h1><button onClick={select}>Choisir la vidéo portrait de 4 secondes</button>
 <nav>{c.composerModeToggles?.map(entry=><button key={entry.mode??'create'} data-mode={entry.mode??'create'} aria-pressed={c.activeManualMode===entry.mode} onClick={()=>c.handleComposerModeToggle(entry.mode)}>{entry.label}</button>)}</nav>
 <CoreSettingsBar density="workspace" engine={c.selectedEngine} mode={c.submissionMode} caps={c.capability} durationSec={c.effectiveDurationSec} durationOption={form.durationOption} onDurationChange={c.handleDurationChange} resolution={form.resolution} onResolutionChange={c.handleResolutionChange} aspectRatio={form.aspectRatio} onAspectRatioChange={c.handleAspectRatioChange} fps={form.fps} onFpsChange={c.handleFpsChange} showAudioControl={c.supportsAudioToggle} audioEnabled={form.audio} onAudioChange={c.handleAudioChange}/>
 <output data-quote hidden>{JSON.stringify(quote)}</output></main></I18nProvider>;
}createRoot(document.getElementById('root')).render(<Main/>);`;

test('mobile and desktop Modify uses source defaults, exposes real choices and leaves its source out of Create', {timeout:120000}, async()=>{
 const fixture=await startWorkspaceReferenceFixture({source});
 const evidence=process.env.MODIFY_MOBILE_EVIDENCE_DIR;
 if(evidence)await mkdir(evidence,{recursive:true});
 try{for(const [name,type] of [['chromium',chromium],['webkit',webkit]] as const){
  const browser=await type.launch({headless:true});
  try{for(const width of [390,1440])for(const engineId of ['wan-3','wan-3-prime']){
   const page=await browser.newPage({viewport:{width,height:844},hasTouch:width===390});const errors:string[]=[];
   page.on('pageerror',error=>errors.push(error.message));await page.goto(fixture.url);
   await page.evaluate(engineId=>{(globalThis as any).fixtureConfig={engineId};},engineId);
   await page.addScriptTag({url:fixture.url+'/'+fixture.script});
   await page.getByRole('button',{name:'Choisir la vidéo portrait de 4 secondes'}).click();
   await expect(page.getByRole('button',{name:/Durée du résultat:.*4s/})).toBeVisible();
   await expect(page.getByRole('button',{name:/Format du résultat:.*9:16/})).toBeVisible();
   await expect(page.getByRole('button',{name:/Audio généré:/})).toBeVisible();
   let quote=JSON.parse((await page.locator('[data-quote]').textContent())!);assert.equal(quote.durationSec,4);assert.equal(quote.aspectRatio,'9:16');assert.ok(quote.inputs.length);
   await page.locator('[data-mode="create"]').click();
   await expect(page.locator('[data-mode="create"]')).toHaveAttribute('aria-pressed','true');
   quote=JSON.parse((await page.locator('[data-quote]').textContent())!);assert.equal(quote.mode,'t2v');assert.equal(quote.inputs.length,0);
   await page.locator('[data-mode="v2v"]').click();
   quote=JSON.parse((await page.locator('[data-quote]').textContent())!);assert.equal(quote.mode,'v2v');assert.ok(quote.inputs.length);
   if(evidence)await page.screenshot({path:evidence+'/'+name+'-'+engineId+'-'+width+'.png',fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);await page.close();
  }}finally{await browser.close();}
 }}finally{await fixture.close();}
});
