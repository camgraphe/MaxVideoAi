/** Actual workflow/composer/selector owners with a local network boundary and no generation. */
export const promptAssistanceModeBrowserSource=`
import {useRef,useState} from 'react';import {createRoot} from 'react-dom/client';
import {Composer} from './components/Composer';
import {ComposerWorkspaceControls} from './components/composer/ComposerWorkspaceControls.client';
import {WorkspaceComposerModel} from './components/composer/WorkspaceComposerModel.client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {useWorkspaceComposerState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceComposerState';
import {useWorkspaceAssetState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import {coerceFormState} from './app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import {summarizeWorkspaceInputSchema} from './app/(core)/(workspace)/app/_lib/workspace-input-schema';
import {videoPromptWorkflow} from './src/lib/prompt-assistance/session';
import {videoPromptReviewKey} from './src/lib/prompt-assistance/application-review';
import {composerAssistanceSettings} from './src/lib/prompt-assistance/client-context';
const config=globalThis.fixtureConfig,engines=[config.engine],noop=()=>{};
function Fixture(){
 const [owner,setOwner]=useState('owner'),[form,setForm]=useState(()=>({...coerceFormState(config.engine,'t2v',null),durationSec:6,durationOption:6,resolution:'720p',aspectRatio:'9:16',audio:false})),[prompt,setPrompt]=useState('An authored synthetic manual draft.');
 const assets=useWorkspaceAssetState(owner);
 const c=useWorkspaceComposerState({engines,form,setForm,...assets,klingElements:[],prompt,multiPromptEnabled:false,setMultiPromptEnabled:noop,multiPromptScenes:[],setMultiPromptScenes:noop,voiceIdsInput:'',shotType:'customize',setShotType:noop,effectiveRequestedEngineToken:null,authChecked:true,hydratedForScope:owner,storageScope:owner,preserveStoredDraftRef:useRef(false),requestedEngineOverrideIdRef:useRef(null),requestedEngineOverrideTokenRef:useRef(null),requestedModeOverrideRef:useRef(null),writeStorage:noop,uiLocale:'en',workflowCopy:{generateVideo:'Create video'},showNotice:noop});
 const summary=summarizeWorkspaceInputSchema({selectedEngine:c.selectedEngine,...c,uiLocale:'en'}),workflow=videoPromptWorkflow(c.activeManualMode,c.selectedEngine.id);
 const context={form,klingElements:[],voiceIdsInput:'',voiceControlEnabled:false,multiPromptEnabled:false};
 return <I18nProvider locale="en" dictionary={{}} fallback={{}}><main style={{maxWidth:980,margin:'auto',padding:16}}>
 <button type="button" onClick={()=>setOwner(value=>value==='owner'?'other':'owner')}>Change account</button>
 <button type="button" onClick={()=>{const field=summary.assetFields.find(item=>item.field.type==='video')?.field;if(field)assets.setInputAssets(previous=>({...previous,[field.id]:[{id:'local-video',assetId:'00000000-0000-4000-8000-000000000099',fieldId:field.id,previewUrl:'/source.mp4',kind:'video',name:'Synthetic source',size:1000,type:'video/mp4',durationSec:6,status:'ready'}]}));}}>Add local video</button>
 <ComposerWorkspaceControls modelControl={<WorkspaceComposerModel engines={engines} engineId={form.engineId} onEngineChange={c.handleEngineChange} mode={c.activeMode}/>}>
 <Composer density="workspace" engine={c.selectedEngine} caps={c.capability} activeManualMode={c.activeManualMode} modeToggles={c.composerModeToggles} onModeToggle={c.handleComposerModeToggle}
 prompt={prompt} onPromptChange={setPrompt} assetFields={summary.assetFields} assets={assets.inputAssets} price={1.23} currency="USD" isLoading={false} onGenerate={()=>{throw Error('Generation forbidden in local fixture');}}
 assistance={{accountKey:owner,scopeKey:JSON.stringify([owner,'video',workflow]),reviewKey:videoPromptReviewKey(context),contextKey:JSON.stringify(context),live:{surface:'video',workflow,engineId:c.selectedEngine.id,mode:c.submissionMode,settings:composerAssistanceSettings(c.selectedEngine,c.submissionMode,form),references:[]}}}/>
 </ComposerWorkspaceControls></main></I18nProvider>;
}createRoot(document.getElementById('root')).render(<Fixture/>);
`;
