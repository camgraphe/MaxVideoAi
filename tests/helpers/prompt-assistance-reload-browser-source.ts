/** Real workspace draft hydration/persistence and composer owners; network is intercepted locally. */
export const promptAssistanceReloadBrowserSource = `
import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Composer} from './components/Composer';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {useWorkspaceRouteFormState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceRouteFormState';
import {useWorkspaceAssetState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import {useWorkspaceDraftHydration} from './app/(core)/(workspace)/app/_hooks/useWorkspaceDraftHydration';
import {useWorkspaceComposerState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceComposerState';
import {readScopedWorkspaceStorage,writeScopedWorkspaceStorage} from './app/(core)/(workspace)/app/_lib/workspace-storage';
import {composerAssistanceSettings,composerAssistanceReferences} from './src/lib/prompt-assistance/client-context';
import {videoPromptReviewKey} from './src/lib/prompt-assistance/application-review';
const config=globalThis.fixtureConfig,engines=[config.engine,config.otherEngine],noop=()=>{},jobs=[];
const readStorage=key=>readScopedWorkspaceStorage(key,'owner');
const writeStorage=(key,value)=>writeScopedWorkspaceStorage(key,'owner',value);
function Fixture(){
 const route=useWorkspaceRouteFormState('owner'),assets=useWorkspaceAssetState('owner');
 const [hydratedForScope,setHydratedForScope]=useState(null),preserveStoredDraftRef=useRef(false),hasStoredFormRef=useRef(false);
 const hydration=useWorkspaceDraftHydration({...route,...assets,engines,requestedJobId:null,fromVideoId:null,effectiveRequestedEngineId:null,effectiveRequestedEngineToken:'',effectiveRequestedMode:null,storageScope:'owner',hydratedForScope,setHydratedForScope,readStorage,readScopedStorage:readStorage,writeStorage,recentJobs:jobs,selectedPreview:null,rendersLength:0,preserveStoredDraftRef,hasStoredFormRef,setSelectedPreview:noop,hydratePendingRendersFromStorage:noop,resetRenderState:noop,authStatus:'authed',accountId:'owner',accessToken:'synthetic-local',locale:'en'});
 const c=useWorkspaceComposerState({...route,...assets,engines,effectiveRequestedEngineToken:null,authChecked:true,hydratedForScope,storageScope:'owner',preserveStoredDraftRef,requestedEngineOverrideIdRef:useRef(null),requestedEngineOverrideTokenRef:useRef(null),requestedModeOverrideRef:useRef(null),writeStorage,uiLocale:'en',workflowCopy:{generateVideo:'Create video'},showNotice:noop});
 const {form,prompt,negativePrompt,klingElements,cfgScale,shotType,voiceIdsInput,multiPromptEnabled,multiPromptScenes}=route;
 const {voiceControlEnabled,seedValue,cameraFixedValue,safetyCheckerValue}=c;
 globalThis.workspaceProbe={form,klingElements,multiPromptScenes,assets:assets.inputAssets,ready:hydration.ready};
 if(!form||!hydration.ready)return <p>Restoring workspace draft</p>;
 const context={form:{...form,prompt:undefined},klingElements,cfgScale,shotType,voiceIdsInput,voiceControlEnabled,multiPromptEnabled,seedValue,cameraFixedValue,safetyCheckerValue,draft:undefined};
 return <I18nProvider locale="en" dictionary={{}} fallback={{}}><main style={{maxWidth:900,margin:'20px auto',padding:16}}>
 <label>Aspect ratio<select aria-label="Aspect ratio" value={form.aspectRatio} onChange={e=>c.handleAspectRatioChange(e.target.value)}><option value="auto">Auto</option><option value="9:16">9:16</option></select></label>
 <Composer density="workspace" engine={c.selectedEngine} activeManualMode={c.activeManualMode} prompt={prompt} onPromptChange={route.setPrompt} negativePrompt={negativePrompt} assetFields={[]} assets={assets.inputAssets} multiPrompt={{enabled:multiPromptEnabled,scenes:multiPromptScenes}} price={1.23} currency="USD" isLoading={false} onGenerate={()=>{throw Error('Generation forbidden in local fixture');}}
 assistance={{accountKey:'owner',scopeKey:JSON.stringify(['owner','video','create']),contextKey:JSON.stringify(context),reviewKey:videoPromptReviewKey(context),live:{surface:'video',workflow:'create',engineId:c.selectedEngine.id,mode:c.submissionMode,settings:composerAssistanceSettings(c.selectedEngine,c.submissionMode,{...form,cfgScale,shotType,voiceControlEnabled,seed:seedValue,cameraFixed:cameraFixedValue,safetyChecker:safetyCheckerValue}),references:composerAssistanceReferences(c.selectedEngine,[],assets.inputAssets,c.submissionMode)}}}/>
 </main></I18nProvider>;
}createRoot(document.getElementById('root')).render(<Fixture/>);
`;
