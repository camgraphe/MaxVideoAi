import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium,webkit,expect,type Browser} from '@playwright/test';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';

// Only remote/account boundaries are synthetic. The draft, mode, source guards,
// quote card and both global/module styles come from the assembled application.
const source=`
import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {Composer} from './components/Composer';
import {CoreSettingsBar} from './components/CoreSettingsBar';
import {useWorkspaceAssetState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import {useWorkspaceComposerState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceComposerState';
import {useWorkspaceActiveDraft} from './app/(core)/(workspace)/app/_hooks/useWorkspaceActiveDraft';
import {getBaseEnginesByCategory} from './src/lib/engines';
import {coerceFormState} from './app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import {summarizeWorkspaceInputSchema} from './app/(core)/(workspace)/app/_lib/workspace-input-schema';
import {getVideoWorkflowSourceField} from './lib/video-source-workflow';
import {getLocalizedWorkflowCopy} from './lib/ltx-localization';
import {serializeWorkspaceModelSetup} from './app/(core)/(workspace)/app/_lib/workspace-model-setups';
import {encodeWorkspaceActiveDraft,workspaceActiveDraftKey} from './app/(core)/(workspace)/app/_lib/workspace-active-draft';
import {stageGuestCreation} from './lib/guest-creation-continuation';
import {ImageQuoteCard} from './app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ImageQuoteCard.client';
import studioStyles from './app/(core)/(workspace)/app/studio/conversation/[projectId]/image-conversation.module.css';
const locale=new URLSearchParams(location.search).get('locale')||'en';
const noop=()=>{};
const engines=getBaseEnginesByCategory('video').filter(e=>['seedance-2-0-mini','wan-3-prime','kling-v4'].includes(e.id));
const requests=[];globalThis.integrationRequests=requests;
globalThis.fetch=async(...args)=>{requests.push(String(args[0]));throw Error('Remote request forbidden in integration fixture');};
const turn={requestId:'synthetic-request',message:'Synthetic request',reply:'',references:[],state:'ready',retryable:false,createdAt:'2026-10-26T00:00:00Z',
 quote:{quoteId:'synthetic-quote',state:'accepted',requestHash:'synthetic-hash',expiresAt:'2099-01-01T00:00:00Z',modelLabel:'Gemini Omni Flash 1.1',fundingMode:'wallet',confirmationRequired:true,price:{amountCents:45,currency:'USD'},
 summary:{schemaVersion:1,surface:'video',engineId:'gemini-omni-flash',mode:'t2v',prompt:'A calm lake.',references:[],settings:{durationSec:10,resolution:'360p',aspectRatio:'16:9',audio:false},outputCount:1}},
 generation:{jobId:'synthetic-failed',surface:'video',status:'failed',progress:null,message:'Google blocked this request during safety checks. Review the prompt and reference media before trying again.',priceCents:45,currency:'USD',paymentStatus:'refunded_wallet',result:null,retryAfterSeconds:null}};
function Workspace({auth,remount,setAuth,onReturn}){
 const engine=engines.find(e=>e.id==='kling-v4');
 const [form,setForm]=useState(()=>coerceFormState(engine,'v2v',null));
 const [prompt,setPrompt]=useState(remount?'':'Synthetic guest request');
 const assets=useWorkspaceAssetState('integration-owner');
 const [negativePrompt,setNegativePrompt]=useState('');
 const [multiPromptEnabled,setMultiPromptEnabled]=useState(false),[multiPromptScenes,setMultiPromptScenes]=useState([]);
 const [klingElements,setKlingElements]=useState([]),[shotType,setShotType]=useState('customize');
 const [voiceIdsInput,setVoiceIdsInput]=useState(''),[cfgScale,setCfgScale]=useState(null);
 const current={form,prompt,inputAssets:assets.inputAssets,negativePrompt,multiPromptEnabled,multiPromptScenes,klingElements,shotType,voiceIdsInput,cfgScale};
 const setters={setForm,setPrompt,setInputAssets:assets.setInputAssets,setNegativePrompt,setMultiPromptEnabled,setMultiPromptScenes,setKlingElements,setShotType,setVoiceIdsInput,setCfgScale};
 const draft=useWorkspaceActiveDraft({...setters,authStatus:auth,accountId:auth==='authed'?'integration-owner':null,accessToken:auth==='authed'?'synthetic-token':null,current,engines,locale,requestKey:'',legacyReady:true,storageReady:true,markLegacyReady:noop});
 const c=useWorkspaceComposerState({engines,form,setForm,inputAssets:assets.inputAssets,setInputAssets:assets.setInputAssets,inputAssetMutationRevision:assets.inputAssetMutationRevision,klingElements,prompt,multiPromptEnabled,setMultiPromptEnabled,multiPromptScenes,setMultiPromptScenes,voiceIdsInput,shotType,setShotType,effectiveRequestedEngineToken:null,authChecked:auth==='authed',hydratedForScope:auth==='authed'?'integration-owner':null,storageScope:'integration-owner',preserveStoredDraftRef:useRef(false),requestedEngineOverrideIdRef:useRef(null),requestedEngineOverrideTokenRef:useRef(null),requestedModeOverrideRef:useRef(null),writeStorage:noop,uiLocale:locale,workflowCopy:getLocalizedWorkflowCopy(locale),showNotice:noop});
 const summary=summarizeWorkspaceInputSchema({selectedEngine:c.selectedEngine,...c,uiLocale:locale});
 const field=getVideoWorkflowSourceField(c.selectedEngine.inputSchema,c.submissionMode);
 const select=status=>{if(field)assets.commitInputAssetMutation(()=>({state:{[field.id]:[{id:'synthetic-source',assetId:'synthetic-source',fieldId:field.id,kind:'video',name:'Synthetic source',type:'video/mp4',size:1000,url:location.origin+'/synthetic.mp4',previewUrl:location.origin+'/portrait.svg',width:720,height:1280,durationSec:4,status}]}}));};
 const remove=()=>assets.commitInputAssetMutation(()=>({state:{}}));
 const stage=()=>{
  const result=serializeWorkspaceModelSetup(current);if(!result.ok)throw Error(result.error);
  const previous={...result.setup,prompt:'Previous synthetic account setup',inputAssets:{}};
  const encoded=encodeWorkspaceActiveDraft({current:{modelId:form.engineId,updatedAt:1,setup:previous},recovery:null},'integration-owner');
  if(!encoded.ok)throw Error(encoded.error);sessionStorage.setItem(workspaceActiveDraftKey('integration-owner'),encoded.value);
  if(!stageGuestCreation(sessionStorage,'/app',JSON.stringify(result.setup),'integration-guest'))throw Error('Guest staging failed');
  history.replaceState({},'','/app?continueDraft=integration-guest');setAuth('pending');
 };
 globalThis.integrationState=()=>({form,prompt,mode:c.submissionMode,assets:assets.inputAssets,ready:draft.ready,recovery:draft.recoverySetup?.setup,fields:summary.assetFields.map(f=>({id:f.id,required:f.required})),memoryOnly:draft.memoryOnly,error:draft.error});
 return <>
 <nav aria-label="Synthetic fixture controls" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
 <button onClick={()=>select('uploading')}>Uploading source</button><button onClick={()=>select('error')}>Failed source</button><button onClick={()=>select('ready')}>Ready source</button><button onClick={remove}>Remove source</button>
 <button onClick={stage}>Stage sign-in</button><button onClick={()=>setAuth('authed')}>Confirm synthetic account</button><button onClick={onReturn}>Route return</button>
 </nav>
 <label>Model <select aria-label="Model" value={form.engineId} onChange={e=>c.handleEngineChange(e.target.value)}>{engines.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
 <div data-workspace>
 <Composer density="workspace" engine={c.selectedEngine} caps={c.capability} modeToggles={c.composerModeToggles} activeManualMode={c.activeManualMode} onModeToggle={c.handleComposerModeToggle}
 prompt={prompt} onPromptChange={setPrompt} promptRequired={false} assetFields={summary.assetFields} assets={assets.inputAssets} currency="USD" price={null} isLoading={false}
 onGenerate={()=>{throw Error('Generation forbidden');}} onAssetRemove={remove} onOpenLibrary={noop}
 settingsBar={<CoreSettingsBar density="workspace" engine={c.selectedEngine} mode={c.submissionMode} caps={c.capability} durationSec={c.effectiveDurationSec} durationOption={form.durationOption} onDurationChange={c.handleDurationChange} resolution={form.resolution} onResolutionChange={c.handleResolutionChange} aspectRatio={form.aspectRatio} onAspectRatioChange={c.handleAspectRatioChange} fps={form.fps} onFpsChange={c.handleFpsChange} showAudioControl={c.supportsAudioToggle} audioEnabled={form.audio} onAudioChange={c.handleAudioChange}/>}/>
 </div>
 <output data-draft-status>{auth} / {draft.ready?'ready':'pending'} / {draft.recoverySetup?'previous draft recoverable':''}</output>
 </>;
}
function App(){
 const [auth,setAuth]=useState('loggedOut'),[revision,setRevision]=useState(0);
 return <I18nProvider locale={locale} dictionary={globalThis.fixtureConfig.dictionaries[locale]} fallback={{}}>
 <main style={{maxWidth:1100,margin:'auto',padding:16}}>
 <h1>Local integration · synthetic records · no service calls</h1>
 <Workspace key={revision} remount={revision} auth={auth} setAuth={setAuth} onReturn={()=>setRevision(v=>v+1)}/>
 <section className={studioStyles.studio} style={{height:'auto',padding:16,marginTop:24}} data-studio-failure>
 <ImageQuoteCard turn={turn} busy={false} locale={locale} onConfirm={()=>{throw Error('Confirm forbidden');}} onRenew={()=>{throw Error('Renew forbidden');}} onRefresh={()=>{throw Error('Refresh forbidden');}}/>
 </section>
 </main></I18nProvider>;
}createRoot(document.getElementById('root')).render(<App/>);
`;

test('assembled app keeps guest mode/source state, source guards and localized safety help compatible', {timeout:180000}, async()=>{
  const evidence=process.env.APP_INTEGRATION_EVIDENCE_DIR;
  const dictionaries=Object.fromEntries(await Promise.all(['en','fr','es'].map(async locale=>[locale,JSON.parse(await readFile(join(process.cwd(),'frontend/messages',locale+'.json'),'utf8'))])));
  const fixture=await startWorkspaceReferenceFixture({source,config:{dictionaries}});
  const observations=[];
  const browsers:Browser[]=[];
  if(evidence)await mkdir(evidence,{recursive:true});
  try{
    for(const name of ['chromium','webkit'] as const){
      const browser=await (name==='chromium'?chromium:webkit).launch({headless:true});browsers.push(browser);
      for(const locale of ['en','fr','es'] as const)for(const width of [390,1440]){
        const context=await browser.newContext({viewport:{width,height:1100},hasTouch:width===390,reducedMotion:'reduce'});
        const page=await context.newPage();const errors:string[]=[],blocked:string[]=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.route('**/*',route=>{
          const r=route.request();if(r.method()!=='GET'||new URL(r.url()).origin!==fixture.url){blocked.push(r.method()+' '+r.url());return route.abort();}
          return route.continue();
        });
        const state=()=>page.evaluate(()=>(globalThis as unknown as {integrationState:()=>{form:{engineId:string};prompt:string;mode:string;assets:Record<string,Array<{id:string;status:string}>>;ready:boolean;recovery:{prompt:string};fields:Array<{required:boolean}>}}).integrationState());
        const capture=async(label:string)=>{
          const selected=(name==='chromium'&&((locale==='en'&&width===1440)||(locale==='fr'&&width===390)||(locale==='es'&&width===390)))||(name==='webkit'&&locale==='fr'&&width===390);
          if(evidence&&selected)await page.screenshot({path:join(evidence,`${name}-${locale}-${width}-${label}.png`),fullPage:true});
        };
        await page.goto(fixture.url+'/?locale='+locale);
        const dark=name==='chromium'&&locale==='fr'&&width===390;
        await page.evaluate(dark=>{
          document.documentElement.setAttribute('data-theme',dark?'dark':'light');
          document.documentElement.classList.toggle('dark',dark);
        },dark);
        await page.addStyleTag({url:fixture.url+'/'+fixture.script.replace(/\.js$/,'.css')});
        const composer=page.locator('[data-workspace]');const settings=composer.locator('[data-settings-density]');
        const modify=composer.locator('[data-composer-mode="v2v"]');
        await expect(modify).toHaveAttribute('aria-pressed','true');
        await expect(settings).toHaveCount(0);
        await expect(modify.locator('svg')).toHaveCount(1);
        for(const action of ['Uploading source','Failed source']){await page.getByRole('button',{name:action,exact:true}).click();await expect(settings).toHaveCount(0);}
        await page.getByRole('button',{name:'Ready source',exact:true}).click();await expect(settings).toBeVisible();
        const prompt='Synthetic guest '+locale+' retained';await composer.locator('textarea').fill(prompt);
        const sourceBefore=(await state()).assets;
        await page.getByRole('button',{name:'Stage sign-in',exact:true}).click();
        await expect(page.locator('[data-draft-status]')).toContainText('pending');
        assert.ok(await page.evaluate(()=>sessionStorage.getItem('maxvideoai:guest-creation:v1')));
        await page.getByRole('button',{name:'Confirm synthetic account',exact:true}).click();
        await expect(page.locator('[data-draft-status]')).toContainText('authed / ready');
        await page.getByRole('button',{name:'Route return',exact:true}).click();
        await expect(page.locator('[data-draft-status]')).toContainText('authed / ready');
        await expect(composer.locator('textarea')).toHaveValue(prompt);await expect(modify).toHaveAttribute('aria-pressed','true');
        await expect(settings).toBeVisible();
        assert.deepEqual((await state()).assets,sourceBefore);
        assert.equal((await state()).recovery.prompt,'Previous synthetic account setup');
        assert.equal(await page.evaluate(()=>sessionStorage.getItem('maxvideoai:guest-creation:v1')),null);
        const reference=composer.locator('[data-reference-command]').first();await reference.click();
        const dialog=page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('[data-modal-initial-focus]')).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);await expect(reference).toBeFocused();
        await capture('restored');
        assert.deepEqual(await composer.locator('[data-composer-mode]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-composer-mode'))),['t2v','i2v','ref2v','v2v'],'Kling keeps its four native modes and does not acquire Extend');
        await composer.locator('[data-composer-mode="t2v"]').click();await expect(settings).toBeVisible();
        assert.equal((await state()).mode,'t2v');
        await page.getByLabel('Model',{exact:true}).selectOption('seedance-2-0-mini');
        await composer.locator('[data-composer-mode="create"]').click();await expect(settings).toBeVisible();
        assert.equal((await state()).mode,'t2v');assert.ok((await state()).fields.some(f=>!f.required),'Unified Create keeps optional reference capabilities');
        await expect(composer.locator('[data-reference-command]')).not.toHaveCount(0);
        await capture('create');
        for(const id of ['seedance-2-0-mini','wan-3-prime','kling-v4']){
          await page.getByLabel('Model',{exact:true}).selectOption(id);
          const mode=composer.locator('[data-composer-mode="v2v"]');
          if(await mode.getAttribute('aria-pressed')!=='true')await mode.click();
          await page.getByRole('button',{name:'Remove source',exact:true}).click();await expect(settings).toHaveCount(0);
          await page.getByRole('button',{name:'Ready source',exact:true}).click();await expect(settings).toBeVisible();
          await page.getByRole('button',{name:'Remove source',exact:true}).click();await expect(settings).toHaveCount(0);
        }
        const failure=page.locator('[data-studio-failure]');
        await expect(failure.getByRole('status')).toContainText(locale==='fr'?/Google.*modération/:locale==='es'?/Google.*moderación/:/Google.*safety/);
        await expect(failure.getByRole('button')).toHaveCount(0);
        const help=failure.locator('[data-safety-guidance]');await help.locator('summary').focus();await page.keyboard.press('Enter');
        await expect(help).toHaveAttribute('open','');
        for(const paragraph of await help.locator('p').all())await expect(paragraph).toBeVisible();
        await capture('safety-help');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
        assert.deepEqual(await page.evaluate(()=>(globalThis as unknown as {integrationRequests:string[]}).integrationRequests),[]);
        observations.push({browser:name,locale,width,theme:dark?'dark':'light',restoredActualDraftIntoActualComposer:true,sourceIdentityPreserved:true,klingNativeFourModes:true,optionalCreateReferences:true,sourceGuards:['seedance-2-0-mini','wan-3-prime','kling-v4'],popupFocus:true,studioSafetyWithGlobalCss:true,serviceCalls:0});
        await context.close();
      }
    }
    if(evidence)await writeFile(join(evidence,'observations.json'),JSON.stringify({scope:'Real integrated components/hooks and production CSS with synthetic account/media records; no real sign-in, payment, upload or generation.',documentOnlyOversizeReloadClaimed:false,observations},null,2)+'\n');
  }finally{for(const b of browsers)await b.close();await fixture.close();}
});
