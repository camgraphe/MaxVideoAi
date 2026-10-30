/** Real Image host/adapter, Composer and assistance hooks; only synthetic local state and external services are supplied by the fixture. */
export const imageRatioReviewBrowserSource=`
import {useEffect,useState,useMemo} from 'react';import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {ImageWorkspaceComposerSurface} from './app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface';
import {DEFAULT_COPY} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
import {useImageComposerPersistence} from './app/(core)/(workspace)/app/image/_hooks/useImageComposerPersistence';
const config=globalThis.fixtureConfig,noop=()=>{};globalThis.formRuns=[];
const setters=Object.fromEntries(['setAspectRatio','setBackground','setCustomImageHeight','setCustomImageWidth','setEnableWebSearch','setError','setLimitGenerations','setMaskUrl','setMode','setNumImagesPreset','setOutputFormat','setQuality','setResolutionPreset','setSeed','setSelectedPreviewImageIndex','setStyle','setThinkingLevel','setWatermark'].map(key=>[key,noop]));
const flags=Object.fromEntries(['AspectRatio','Background','CustomImageSize','EnableWebSearch','LimitGenerations','MaskUrl','NumImages','OutputFormat','Quality','Resolution','Seed','Style','ThinkingLevel','Watermark'].map(key=>['show'+key+'Control',false]));
const initial={owner:'owner',mode:'t2i',ratio:config.ratio??'1:1',resolution:'2k',quality:null,numImages:1,seed:'',maskUrl:'',assets:{},role:'image_urls',prompt:'Original synthetic manual image prompt.',engineId:config.engine.id,customImageWidth:'',customImageHeight:'',outputFormat:null,background:null,style:null,enableWebSearch:false,thinkingLevel:null,limitGenerations:false,watermark:false};
const engines=[config.engine,config.otherEngine].map(engine=>({id:engine.id,name:engine.label,engineCaps:engine,modes:['t2i','i2i'],aliases:[],prompts:[],currency:'USD',pricePerImage:0})),references=[];
function Fixture(){
 const [state,setState]=useState(()=>!config.realPersistence&&JSON.parse(sessionStorage.getItem('synthetic-image-draft')??'null')||{...initial,...config.initial});
 const patch=change=>setState(s=>({...s,...change}));globalThis.imageProbe=state;globalThis.changeImage=patch;
 useEffect(()=>{if(!config.realPersistence)sessionStorage.setItem('synthetic-image-draft',JSON.stringify(Object.fromEntries(Object.entries(state).reverse())));},[state]);
 const storageSetters=useMemo(()=>Object.fromEntries(['EngineId','Mode','Prompt','NumImages','AspectRatio','Resolution','CustomImageWidth','CustomImageHeight','Seed','OutputFormat','Quality','Background','Style','MaskUrl','EnableWebSearch','ThinkingLevel','LimitGenerations','Watermark','ReferenceSlots'].map(name=>{
  const key=name==='AspectRatio'?'ratio':name[0].toLowerCase()+name.slice(1);
  return ['set'+name,value=>setState(s=>{const next=typeof value==='function'?value(s[key]):value;return s[key]===next?s:{...s,[key]:next};})];
 })),[]);
 const storage=config.realPersistence?useImageComposerPersistence({...state,accountId:state.owner,aspectRatio:state.ratio,engines,persistableReferenceSlots:references,...storageSetters}):null;
 if(storage&&!storage.storageHydrated)return <p>Restoring real image draft</p>;
 const engine=state.engineId===config.engine.id?config.engine:config.otherEngine;
 const fields=[{field:{id:state.role,type:'image',label:'Images',modes:['t2i','i2i'],max:4},required:false}];
 return <I18nProvider locale="en" dictionary={{}} fallback={{}}><main style={{maxWidth:980,margin:'auto',padding:16}}>
 <label>Test ratio<select aria-label="Test ratio" value={state.ratio} onChange={e=>patch({ratio:e.target.value})}><option>1:1</option><option>16:9</option><option>9:16</option></select></label>
 <ImageWorkspaceComposerSurface {...setters} {...flags} showAspectRatioControl setAspectRatio={ratio=>patch({ratio})} assistanceAccountId={state.owner} mode={state.mode} numImages={state.numImages} resolution={state.resolution} aspectRatio={state.ratio} quality={state.quality} enableWebSearch={state.enableWebSearch} customImageWidth={state.customImageWidth} customImageHeight={state.customImageHeight}
 selectedEngineId={engine.id} engineCapsList={[config.engine,config.otherEngine]} selectedEngineCaps={engine} setEngineId={engineId=>patch({engineId})} resolvedCopy={DEFAULT_COPY} advancedSettingsTitle="Options" compositePreviewEntry={null} selectedPreviewImageIndex={0} previewEntry={undefined} copiedUrl={null} currency="USD" estimatedCostAmount={0.07}
 composerError={null} composerReferenceAssets={state.assets} referenceAssetFields={fields} prompt={state.prompt} setPrompt={prompt=>patch({prompt})} pendingGenerations={[]} statusMessage={null} imageCountOptions={[]} aspectRatioSelectOptions={['1:1','16:9','9:16'].map(value=>({value,label:value}))} booleanSelectOptions={[]} backgroundSelectOptions={[]} outputFormatSelectOptions={[]} qualitySelectOptions={[]} resolutionSelectOptions={[]} styleSelectOptions={[]} thinkingLevelSelectOptions={[]}
 background={state.background} outputFormat={state.outputFormat} style={state.style} thinkingLevel={state.thinkingLevel} seed={state.seed} maskUrl={state.maskUrl} limitGenerations={state.limitGenerations} watermark={state.watermark} isInLibrary={false} isRemovingFromLibrary={false} isSavingToLibrary={false} isResolutionLocked={false}
 handleRun={event=>{event?.preventDefault();globalThis.formRuns.push('generation');}} handleAddToLibrary={noop} handleCopy={noop} handleDownload={noop} handleEditSelectedPreview={noop} handleOpenHistoryEntry={noop} handleReferenceFile={noop} handleReferenceUrl={noop} handleRemoveFromLibrary={noop} handleRemoveReferenceSlot={noop} openLibraryForSlot={noop}/>
 </main></I18nProvider>;
}createRoot(document.getElementById('root')).render(<Fixture/>);`;

export const imageReviewHostModules={
 'next/link':`import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>;}`,
 'next/image':`import React from 'react';export default function Image({fill,priority,unoptimized,...props}){return <img {...props}/>;}`,
 'next/navigation':`export function useSearchParams(){return new URLSearchParams();}export function usePathname(){return '/app/image';}export function useRouter(){return {push(){},replace(){},prefetch(){}};}export function redirect(){throw Error('Unexpected navigation');}export const permanentRedirect=redirect;`,
};
