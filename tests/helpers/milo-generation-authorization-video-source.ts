/** Real video generation owners; external APIs are intercepted by the browser tests. */
export const miloGenerationVideoSource = `
import {useState,useRef,useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {WorkspaceComposerSurface} from './app/(core)/(workspace)/app/_components/WorkspaceComposerSurface';
import {useWorkspaceGenerationRunner} from './app/(core)/(workspace)/app/_hooks/useWorkspaceGenerationRunner';
import {summarizeWorkspaceInputSchema} from './app/(core)/(workspace)/app/_lib/workspace-input-schema';
import {DEFAULT_PROMPT} from './app/(core)/(workspace)/app/_lib/workspace-client-helpers';
const noop=()=>{};
function Fixture(){
 const [engine,setEngine]=useState(globalThis.fixtureConfig.engine), [mode,setMode]=useState('ref2v');
 globalThis.changeModel=()=>{setEngine(globalThis.fixtureConfig.nextEngine);setMode('i2v');};
 const [prompt,setPrompt]=useState(DEFAULT_PROMPT);
 const [context,setContext]=useState({klingElements:[],shotType:'customize',voiceIdsInput:'',cfgScale:null,sourceAccount:{userId:'owner',token:'fixture'}});
 globalThis.changeContext=patch=>setContext(current=>({...current,...patch}));
 const config=globalThis.fixtureConfig; const [form,setForm]=useState(config.form),[inputAssets,setAssets]=useState(config.inputAssets),[price,setPrice]=useState(7.07);
 globalThis.changeRatio=()=>{setForm(current=>({...current,aspectRatio:'9:16'}));setPrice(8.25);};
 globalThis.changeReferences=()=>setAssets(current=>({image_urls:[...current.image_urls,{...current.image_urls[0],id:'synthetic-extra',assetId:'synthetic-extra',url:'/extra.svg',previewUrl:'/extra.svg'}]}));
 globalThis.changeText=setPrompt;
 const preflight=useMemo(()=>({...config.preflight,total:Math.round(price*100),pricing:{...config.preflight.pricing,totalCents:Math.round(price*100)}}),[price]);
 const schema=summarizeWorkspaceInputSchema({selectedEngine:engine,activeMode:mode,allowsUnifiedVeoFirstLast:false,isUnifiedHappyHorse:false,isUnifiedSeedance:false,isUnifiedGeminiOmni:false,uiLocale:'en'});
 const rendersRef=useRef([]);
 const extraInputFields=[...schema.promotedFields,...schema.secondaryFields];
 const generation=useWorkspaceGenerationRunner({
  form,selectedEngine:engine,activeMode:mode,submissionMode:mode,effectivePrompt:prompt,effectiveDurationSec:30,negativePrompt:'',
  preflight,accessToken:'synthetic-local-token',authChecked:true,memberTier:'Member',
  audioWorkflowUnsupported:false,klingO3UnsupportedVideoReason:null,
  inputSchemaSummary:schema,extraInputFields,inputAssets,
  showComposerError:message=>{globalThis.reproErrors=(globalThis.reproErrors??[]).concat(message);},
  writeScopedStorage:noop,mutateLatestJobs:async()=>{},setAuthModalOpen:noop,setPreflightError:noop,setTopUpModal:noop,
  setActiveGroupId:noop,setActiveBatchId:noop,setBatchHeroes:noop,setRenders:noop,onRenderStarted:noop,setSelectedPreview:noop,setViewMode:noop,rendersRef,
  uiLocale:'en',workflowCopy:{audioUnsupported:'Unsupported',addReferenceMediaBeforeAudio:'Add references',addSourceVideo:()=> 'Add source'},
  workspaceCopy:{wallet:{insufficient:'Insufficient',insufficientWithAmount:'Insufficient {amount}'}},
  capability:undefined,cfgScale:null,formatTakeLabel:(a,b)=>a+'/'+b,primaryAssetFieldLabel:'Reference images',
  primaryAssetFieldIds:new Set(schema.assetFields.filter(x=>x.role==='primary').map(x=>x.field.id)),
  referenceAssetFieldIds:new Set(schema.assetFields.filter(x=>x.role==='reference').map(x=>x.field.id)),
  genericImageFieldIds:new Set(schema.assetFields.filter(x=>x.field.type==='image').map(x=>x.field.id)),
  frameAssetFieldIds:new Set(schema.assetFields.filter(x=>x.role==='frame').map(x=>x.field.id)),
  referenceAudioFieldIds:new Set(schema.assetFields.filter(x=>x.field.type==='audio').map(x=>x.field.id)),
  allowsUnifiedVeoFirstLast:false,hasLastFrameInput:false,supportsAudioToggle:true,multiPromptActive:false,multiPromptInvalid:false,multiPromptError:null,multiPromptScenes:[],
  supportsKlingV3Controls:false,supportsKlingV3VoiceControl:false,isSeedance:false,isUnifiedSeedance:false,
  promptLength:prompt.length,promptCharLimitExceeded:false,promptMaxChars:engine.inputLimits.promptMaxChars??null,
  voiceIds:[],voiceControlEnabled:false,shotType:'customize',klingElements:[],
 });
 return <I18nProvider locale={globalThis.fixtureConfig.locale??"en"} dictionary={{}} fallback={{}}><main style={{maxWidth:1050,margin:'30px auto',padding:16}}><p>Synthetic video workspace — no provider or payment</p><WorkspaceComposerSurface
  selectedEngine={engine} form={form}
  setForm={setForm} prompt={prompt} setPrompt={setPrompt} negativePrompt="" setNegativePrompt={noop}
  price={price} currency="USD" isPricing={false} isSubmitting={generation.isSubmitting} preflightError={null} preflight={preflight} startRender={generation.startRender}
  inputSchemaSummary={schema}
  inputAssets={inputAssets} isUnifiedSeedance={false} isUnifiedKlingO3={false} klingO3UnsupportedVideoReason={null}
  workflowCopy={{clearReferencesToUseStartEnd:'',clearStartEndToUseReferences:'',removeAudioToUnlock:''}} guestUploadLockedReason={null} uiLocale={globalThis.fixtureConfig.locale??"en"}
  activeManualMode={null} handleComposerModeToggle={noop} composerWorkflowNotice={null} pendingGenerations={[]}
  handleAssetAdd={noop} handlePrepareVideoExcerpt={noop} handleVideoExcerptEditorChange={noop} handleAssetRemove={noop} handleOpenAssetLibrary={noop} showNotice={noop}
  supportsKlingV3Controls={false} supportsKlingV3VoiceControl={false} multiPromptEnabled={false} setMultiPromptEnabled={noop}
  multiPromptScenes={[]} multiPromptTotalSec={30} multiPromptActive={false} multiPromptInvalid={false} multiPromptError={null}
  handleMultiPromptAddScene={noop} handleMultiPromptRemoveScene={noop} handleMultiPromptUpdateScene={noop}
  audioWorkflowUnsupported={false} audioWorkflowLocked={false} showRetakeWorkflowAction={false} activeMode={mode} submissionMode={mode}
  handleDurationChange={noop} handleFramesChange={noop} handleResolutionChange={noop} handleAspectRatioChange={noop} handleFpsChange={noop}
  supportsAudioToggle={true} voiceControlEnabled={false} setCfgScale={noop} setShotType={noop} setVoiceIdsInput={noop}
  isSeedance={false} seedValue="" handleSeedChange={noop} cameraFixedValue={false} handleCameraFixedChange={noop} safetyCheckerValue={true} handleSafetyCheckerChange={noop} showSafetyCheckerControl={false}
  handleKlingElementAdd={noop} handleKlingElementRemove={noop} handleKlingElementAssetAdd={noop} handleKlingElementAssetRemove={noop} handleOpenKlingAssetLibrary={noop} setViewMode={noop} {...context}/></main></I18nProvider>
}
createRoot(document.getElementById('root')).render(<Fixture/>);`;
