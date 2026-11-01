export const miloGenerationImageSource = `import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {ImageWorkspaceComposerSurface} from './app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface';
import {DEFAULT_COPY} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
const config=globalThis.fixtureConfig,noop=()=>{};globalThis.formRuns=[];
const setters=Object.fromEntries(['setAspectRatio','setBackground','setCustomImageHeight','setCustomImageWidth','setEnableWebSearch','setError','setLimitGenerations','setMaskUrl','setMode','setNumImagesPreset','setOutputFormat','setQuality','setResolutionPreset','setSeed','setSelectedPreviewImageIndex','setStyle','setThinkingLevel','setWatermark'].map(key=>[key,noop]));
const flags=Object.fromEntries(['AspectRatio','Background','CustomImageSize','EnableWebSearch','LimitGenerations','MaskUrl','NumImages','OutputFormat','Quality','Resolution','Seed','Style','ThinkingLevel','Watermark'].map(key=>['show'+key+'Control',false]));
function Fixture(){const [prompt,setPrompt]=useState('An authored synthetic portrait with a nonempty image prompt.');return <I18nProvider locale="en" dictionary={{}} fallback={{}}><main style={{maxWidth:980,margin:'auto',padding:16}}>
<ImageWorkspaceComposerSurface {...setters} {...flags} assistanceAccountId="owner" mode="t2i" numImages={1} resolution="2k" aspectRatio="1:1" quality={null} enableWebSearch={false} customImageWidth="" customImageHeight=""
 selectedEngineId={config.engine.id} engineCapsList={[config.engine]} selectedEngineCaps={config.engine} setEngineId={noop} resolvedCopy={DEFAULT_COPY} advancedSettingsTitle="Options" compositePreviewEntry={null} selectedPreviewImageIndex={0} previewEntry={undefined} copiedUrl={null} currency="USD" estimatedCostAmount={0.07}
 composerError={null} composerReferenceAssets={{}} referenceAssetFields={[]} prompt={prompt} setPrompt={setPrompt} pendingGenerations={[]} statusMessage={null} imageCountOptions={[]} aspectRatioSelectOptions={[]} booleanSelectOptions={[]} backgroundSelectOptions={[]} outputFormatSelectOptions={[]} qualitySelectOptions={[]} resolutionSelectOptions={[]} styleSelectOptions={[]} thinkingLevelSelectOptions={[]}
 background={null} outputFormat={null} style={null} thinkingLevel={null} seed="" maskUrl="" limitGenerations={false} watermark={false} isInLibrary={false} isRemovingFromLibrary={false} isSavingToLibrary={false} isResolutionLocked={false}
 handleRun={event=>{event?.preventDefault();globalThis.formRuns.push({source:event?'submit':'generate'});void fetch('/api/images/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt})});}} handleAddToLibrary={noop} handleCopy={noop} handleDownload={noop} handleEditSelectedPreview={noop} handleOpenHistoryEntry={noop} handleReferenceFile={noop} handleReferenceUrl={noop} handleRemoveFromLibrary={noop} handleRemoveReferenceSlot={noop} openLibraryForSlot={noop}/>
</main></I18nProvider>};createRoot(document.getElementById('root')).render(<Fixture/>);`;

export const miloGenerationAudioSource = `import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import AudioCreationWorkspace from './app/(core)/(workspace)/app/audio/AudioCreationWorkspace';
createRoot(document.getElementById('root')).render(<I18nProvider locale="en" dictionary={{}} fallback={{}}><AudioCreationWorkspace/></I18nProvider>);`;

/** Uses the real image runner as well as its real form owner; auth is controlled at the host boundary. */
export const miloGenerationRealImageSource=miloGenerationImageSource
 .replace("const config=globalThis.fixtureConfig,noop=()=>{};",`import {useImageGenerationRunner} from './app/(core)/(workspace)/app/image/_hooks/useImageGenerationRunner';
const config=globalThis.fixtureConfig,noop=()=>{};`)
 .replace("return <I18nProvider locale=",`const generation=useImageGenerationRunner({
  aspectRatio:null,background:null,combinedReferenceUrls:[],customImageHeight:'',customImageWidth:'',enableWebSearch:false,
  hasAspectRatioField:false,hasBackgroundField:false,hasEnableWebSearchField:false,hasLimitGenerationsField:false,hasMaskUrlField:false,hasOutputFormatField:false,hasQualityField:false,hasSeedField:false,hasStyleField:false,hasThinkingLevelField:false,hasWatermarkField:false,
  limitGenerations:false,maskUrl:'',mode:'t2i',mutateJobs:async()=>{},numImages:1,outputFormat:null,prompt,pricingSnapshot:{totalCents:7,currency:'USD'},quality:null,readyReferenceSizes:[],readyReferenceUrls:[],referenceMinRequired:0,resolution:null,resolvedCopy:DEFAULT_COPY,seed:'',selectedCharacterReferences:[],selectedEngine:{id:config.engine.id,name:config.engine.label,engineCaps:config.engine},style:null,
  setAuthModalOpen:noop,setError:noop,setLocalHistory:noop,setPendingGroups:noop,setSelectedPreviewEntryId:noop,setSelectedPreviewImageIndex:noop,setStatusMessage:noop,thinkingLevel:null,watermark:false,
 });return <I18nProvider locale=`)
 .replace(/handleRun=\{event=>\{event\?\.preventDefault\(\);globalThis\.formRuns\.push\(\{source:event\?'submit':'generate'\}\);void fetch\('\/api\/images\/generate',\{method:'POST',headers:\{'content-type':'application\/json'\},body:JSON\.stringify\(\{prompt\}\)\}\);\}\}/,'handleRun={generation}');
