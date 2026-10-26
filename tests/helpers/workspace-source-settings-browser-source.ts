/** Synthetic local fixture using the actual Composer, mode, asset, recall and draft owners. */
export const sourceSettingsBrowserSource = `
import {useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {Composer} from './components/Composer';
import {CoreSettingsBar} from './components/CoreSettingsBar';
import {useWorkspaceAssetState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import {useWorkspaceComposerState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceComposerState';
import {useWorkspaceVideoSettings} from './app/(core)/(workspace)/app/_hooks/useWorkspaceVideoSettings';
import {getBaseEnginesByCategory} from './src/lib/engines';
import {coerceFormState} from './app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import {summarizeWorkspaceInputSchema} from './app/(core)/(workspace)/app/_lib/workspace-input-schema';
import {getVideoWorkflowSourceField} from './lib/video-source-workflow';
import {buildWorkspacePreflightRequest} from './app/(core)/(workspace)/app/_lib/workspace-preflight-request';
import {serializeWorkspaceModelSetup} from './app/(core)/(workspace)/app/_lib/workspace-model-setups';
import {encodeWorkspaceActiveDraft,decodeWorkspaceActiveDraft} from './app/(core)/(workspace)/app/_lib/workspace-active-draft';
const noop=()=>{}, key='source-settings-synthetic-v1';
const engines=getBaseEnginesByCategory('video').filter(e=>['seedance-2-0-mini','wan-3-prime','kling-o3-pro'].includes(e.id));
const engineMap=new Map(engines.map(e=>[e.id,e]));
const saved=decodeWorkspaceActiveDraft(sessionStorage.getItem(key),'synthetic-owner').current?.setup;
function Main(){
 const mini=engines.find(e=>e.id==='seedance-2-0-mini');
 const [form,setForm]=useState(()=>saved?.form??({...coerceFormState(mini,'v2v',null),durationSec:7,durationOption:7,resolution:'480p',aspectRatio:'9:16',audio:true}));
 const [prompt,setPrompt]=useState(saved?.prompt??'Keep this synthetic prompt');
 const state=useWorkspaceAssetState('synthetic-owner');
 const initialized=useRef(false);
 useEffect(()=>{if(!initialized.current){initialized.current=true;if(saved)state.setInputAssets(saved.inputAssets);}},[]);
 const c=useWorkspaceComposerState({engines,form,setForm,inputAssets:state.inputAssets,setInputAssets:state.setInputAssets,inputAssetMutationRevision:state.inputAssetMutationRevision,klingElements:[],prompt,multiPromptEnabled:false,setMultiPromptEnabled:noop,multiPromptScenes:[],setMultiPromptScenes:noop,voiceIdsInput:'',shotType:'customize',setShotType:noop,effectiveRequestedEngineToken:null,authChecked:true,hydratedForScope:'synthetic-owner',storageScope:'synthetic-owner',preserveStoredDraftRef:useRef(false),requestedEngineOverrideIdRef:useRef(null),requestedEngineOverrideTokenRef:useRef(null),requestedModeOverrideRef:useRef(null),writeStorage:noop,uiLocale:'en',workflowCopy:{generateVideo:'Create video'},showNotice:noop});
 const recall=useWorkspaceVideoSettings({engines,engineMap,locale:'en',accountScope:'synthetic-owner',provider:'fal',fromVideoId:null,requestedJobId:null,searchString:'',sharedVideoSettings:null,authChecked:false,hydratedForScope:null,storageScope:'synthetic-owner',effectiveRequestedEngineId:null,effectiveRequestedEngineToken:null,rendersLength:0,compositeOverride:null,compositeOverrideSummary:null,focusComposer:noop,readScopedStorage:()=>null,writeScopedStorage:noop,replaceRoute:noop,setPrompt,setForm,setInputAssets:state.setInputAssets,setNegativePrompt:noop,setMemberTier:noop,setCfgScale:noop,setShotType:noop,setVoiceIdsInput:noop,setMultiPromptEnabled:noop,setMultiPromptScenes:noop,setKlingElements:noop,setSelectedPreview:noop,setCompositeOverride:noop,setCompositeOverrideSummary:noop,setSharedPrompt:noop,setSharedVideoSettings:noop,setNotice:noop});
 useEffect(()=>{
  const serialized=serializeWorkspaceModelSetup({form,prompt,inputAssets:state.inputAssets,klingElements:[],negativePrompt:'',multiPromptEnabled:false,multiPromptScenes:[],shotType:'customize',voiceIdsInput:'',cfgScale:null});
  if(!serialized.ok)return; // Like the draft owner, keep the last serializable setup during transient uploads.
  const encoded=encodeWorkspaceActiveDraft({current:{modelId:form.engineId,updatedAt:1,setup:serialized.setup},recovery:null},'synthetic-owner');
  if(!encoded.ok)throw Error('Synthetic draft encoding failed');sessionStorage.setItem(key,encoded.value);
 },[form,prompt,state.inputAssets]);
 const summary=summarizeWorkspaceInputSchema({selectedEngine:c.selectedEngine,...c,uiLocale:'en'});
 const field=getVideoWorkflowSourceField(c.selectedEngine.inputSchema,c.submissionMode);
 const select=status=>{if(!field)return;state.commitInputAssetMutation(()=>({state:{[field.id]:[{id:'synthetic-source',assetId:'synthetic-source',fieldId:field.id,kind:'video',name:'Synthetic source.mp4',type:'video/mp4',size:1024,url:location.origin+'/synthetic-source.mp4',previewUrl:location.origin+'/portrait.svg',width:1080,height:1920,durationSec:4,status}]}}));};
 const remove=()=>state.commitInputAssetMutation(()=>({state:{}}));
 const quote=buildWorkspacePreflightRequest({form,selectedEngine:c.selectedEngine,submissionMode:c.submissionMode,effectiveDurationSec:c.effectiveDurationSec,supportsAudioToggle:c.supportsAudioToggle,voiceControlEnabled:false,inputAssets:state.inputAssets,memberTier:'Member'});
 return <I18nProvider locale="en" dictionary={{}} fallback={{}}><main style={{padding:16,maxWidth:1100,margin:'auto'}}>
 <p>Local regression fixture · synthetic media · no account or generation</p>
 <label>Model <select aria-label="Model" value={form.engineId} onChange={e=>c.handleEngineChange(e.target.value)}>{engines.map(e=><option value={e.id} key={e.id}>{e.label}</option>)}</select></label>
 <div data-result-preview style={{margin:'16px 0',maxWidth:420}}><img alt="Previously generated result — not an attached source" src="/result.svg" style={{width:'100%'}}/><p>Result viewer: no source attachment implied</p></div>
 <nav>{c.composerModeToggles?.map(entry=><button key={entry.mode??'create'} data-mode={entry.mode??'create'} aria-pressed={c.activeManualMode===entry.mode} onClick={()=>c.handleComposerModeToggle(entry.mode)}>{entry.label}</button>)}</nav>
 <div style={{display:'flex',flexWrap:'wrap',gap:8,margin:'12px 0'}}>
 <button onClick={()=>select('uploading')}>Simulate upload</button><button onClick={()=>select('error')}>Simulate failed upload</button><button onClick={()=>select('ready')}>Select valid source</button><button onClick={remove}>Remove source</button>
 <button onClick={()=>recall.applyVideoSettingsSnapshot({schemaVersion:1,surface:'video',engineId:'seedance-2-0-mini',inputMode:'v2v',prompt:'Recalled synthetic prompt',core:{durationSec:7,durationOption:7,resolution:'480p',aspectRatio:'9:16',audio:true},refs:{inputs:[]}})}>Recall settings without source</button></div>
 <Composer density="workspace" engine={c.selectedEngine} caps={c.capability} activeManualMode={c.activeManualMode} prompt={prompt} onPromptChange={setPrompt} promptRequired={false} assetFields={summary.assetFields} assets={state.inputAssets} currency="USD" price={null} isLoading={false} onGenerate={()=>{throw Error('Generation forbidden in local fixture');}}
 onAssetRemove={remove} settingsBar={<CoreSettingsBar density="workspace" engine={c.selectedEngine} mode={c.submissionMode} caps={c.capability} durationSec={c.effectiveDurationSec} durationOption={form.durationOption} onDurationChange={c.handleDurationChange} resolution={form.resolution} onResolutionChange={c.handleResolutionChange} aspectRatio={form.aspectRatio} onAspectRatioChange={c.handleAspectRatioChange} fps={form.fps} onFpsChange={c.handleFpsChange} showAudioControl={c.supportsAudioToggle} audioEnabled={form.audio} onAudioChange={c.handleAudioChange}/>}/>
 <output data-state hidden>{JSON.stringify({form,mode:c.submissionMode,assets:state.inputAssets,quote})}</output>
 </main></I18nProvider>;
}createRoot(document.getElementById('root')).render(<Main/>);
`;
