import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit, expect } from '@playwright/test';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

const source = `
import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {CoreSettingsBar} from './components/CoreSettingsBar';
import {useWorkspaceEngineModeState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState';
import {getBaseEngineIncludingHidden} from './src/lib/engines';
import {coerceFormState} from './app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import {parseStoredForm} from './app/(core)/(workspace)/app/_lib/workspace-form-state';
import {buildInitialWorkspaceFormState} from './app/(core)/(workspace)/app/_lib/workspace-hydration';
import {serializeWorkspaceModelSetup} from './app/(core)/(workspace)/app/_lib/workspace-model-setups';
import {encodeWorkspaceActiveDraft,decodeWorkspaceActiveDraft} from './app/(core)/(workspace)/app/_lib/workspace-active-draft';
import {buildWorkspacePreflightRequest} from './app/(core)/(workspace)/app/_lib/workspace-preflight-request';
const noop=()=>{};
const params=new URLSearchParams(location.search),engine=getBaseEngineIncludingHidden(params.get('engine'));
const path=params.get('path'),key='operation-refresh-fixture';
const saved=path==='active'?decodeWorkspaceActiveDraft(sessionStorage.getItem(key),'owner').current?.setup:null;
const stored=path==='legacy'?parseStoredForm(sessionStorage.getItem(key)??'null'):null;
function Main(){
 const [form,setForm]=useState(()=>saved?.form??(stored?buildInitialWorkspaceFormState({engines:[engine],storedFormRaw:stored,effectiveRequestedEngineId:null,effectiveRequestedEngineToken:'',effectiveRequestedMode:null}).form:coerceFormState(engine,'t2v',null)));
 const [assets,setAssets]=useState(saved?.inputAssets??{});
 const c=useWorkspaceEngineModeState({engines:[engine],form,setForm,inputAssets:assets,setInputAssets:setAssets,klingElements:[],shotType:'customize',setShotType:noop,effectiveRequestedEngineToken:null,authChecked:true,hydratedForScope:'owner',storageScope:'owner',preserveStoredDraftRef:useRef(false),requestedEngineOverrideIdRef:useRef(null),requestedEngineOverrideTokenRef:useRef(null),requestedModeOverrideRef:useRef(null),writeStorage:noop,uiLocale:'en',workflowCopy:{generateVideo:'Create video'},showNotice:noop});
 useEffect(()=>{
  if(path==='legacy'){sessionStorage.setItem(key,JSON.stringify(form));return;}
  const result=serializeWorkspaceModelSetup({form,inputAssets:assets,klingElements:[],prompt:'Change the background',negativePrompt:'',multiPromptEnabled:false,multiPromptScenes:[],shotType:'customize',voiceIdsInput:'',cfgScale:null});
  if(!result.ok)throw Error('Draft serialization failed');
  const encoded=encodeWorkspaceActiveDraft({current:{modelId:engine.id,updatedAt:1,setup:result.setup},recovery:null},'owner');
  if(!encoded.ok)throw Error('Draft encoding failed');sessionStorage.setItem(key,encoded.value);
 },[form,assets]);
 const quote=buildWorkspacePreflightRequest({form,selectedEngine:c.selectedEngine,submissionMode:c.submissionMode,effectiveDurationSec:8,supportsAudioToggle:c.supportsAudioToggle,voiceControlEnabled:false,inputAssets:assets,memberTier:'Member'});
 const select=()=>setAssets({video_url:[{id:'phone',assetId:'phone',fieldId:'video_url',kind:'video',name:'Phone.mov',type:'video/quicktime',size:1024,url:'https://example.invalid/phone.mov',width:720,height:1280,durationSec:5.25,status:'ready'}]});
 return <I18nProvider locale="en" dictionary={{}} fallback={{}}><main style={{padding:16,maxWidth:900}}>
 <p>Local reload regression fixture · synthetic source · no requests or generation</p><h1>{engine.label}</h1>
 <nav>{c.composerModeToggles?.map(entry=><button key={entry.mode??'create'} data-mode={entry.mode??'create'} aria-pressed={c.activeManualMode===entry.mode} onClick={()=>c.handleComposerModeToggle(entry.mode)}>{entry.label}</button>)}</nav>
 <button onClick={select}>Select portrait source</button>
 <CoreSettingsBar density="workspace" engine={c.selectedEngine} mode={c.submissionMode} caps={c.capability} durationSec={form.durationSec} durationOption={form.durationOption} onDurationChange={noop} resolution={form.resolution} onResolutionChange={noop} aspectRatio={form.aspectRatio} onAspectRatioChange={noop} fps={form.fps} onFpsChange={noop}/>
 <output data-quote hidden>{JSON.stringify(quote)}</output></main></I18nProvider>;
}createRoot(document.getElementById('root')).render(<Main/>);`;

test('Kling Modify keeps inherited timing and framing after an actual page reload', { timeout: 120000 }, async () => {
  const fixture = await startWorkspaceReferenceFixture({ source, config: {} });
  const evidence = process.env.MODIFY_REFRESH_EVIDENCE_DIR;
  if (evidence) await mkdir(evidence, { recursive: true });
  try {
    for (const name of ['chromium', 'webkit'] as const) {
      const browser = name === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true });
      try {
        for (const width of [390, 1440]) for (const engine of ['kling-o3-standard', 'kling-o3-pro', 'kling-o3-4k']) for (const path of ['active', 'legacy']) {
          const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width === 390 });
          const errors: string[] = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(fixture.url + '/?engine=' + engine + '&path=' + path);
          await page.locator('[data-mode="v2v"]').click();
          const check = async () => {
            await expect(page.locator('[data-mode="v2v"]')).toHaveAttribute('aria-pressed', 'true');
            await expect(page.getByRole('button', { name: /Output (duration|format):/ })).toHaveCount(0);
            await expect(page.getByText('Source video duration', { exact: true })).toBeVisible();
            const quote = JSON.parse((await page.locator('[data-quote]').textContent())!);
            assert.equal(quote.operation, 'kling-edit');
            assert.equal(quote.aspectRatio, undefined);
            return quote;
          };
          await check();
          await page.reload();
          await check();
          await page.getByRole('button', { name: 'Select portrait source' }).click();
          assert.equal((await check()).inputs[0].url, 'https://example.invalid/phone.mov');
          await page.reload();
          const quote = await check();
          assert.equal(quote.inputs.length, path === 'active' ? 1 : 0, 'legacy form storage does not invent saved assets');
          if (evidence && path === 'active' && engine === 'kling-o3-pro') await page.screenshot({ path: evidence + '/' + name + '-' + width + '.png', fullPage: true });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
          assert.deepEqual(errors, []);
          await page.close();
        }
      } finally { await browser.close(); }
    }
  } finally { await fixture.close(); }
});
