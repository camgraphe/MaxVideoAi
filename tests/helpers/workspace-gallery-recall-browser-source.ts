/** Synthetic gallery reads with the production draft/composer/schema/action hook chain. */
export const galleryRecallBrowserSource = `
import {createRoot} from 'react-dom/client';
import {useGalleryRecallHarness} from '../tests/helpers/workspace-gallery-recall-harness';
import {groupJobsIntoSummaries} from './lib/job-groups';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {Composer} from './components/Composer';
import {CoreSettingsBar} from './components/CoreSettingsBar';
function Main() {
 const h=useGalleryRecallHarness(), c=h.composer, form=h.form;
 const groups=globalThis.fixtureConfig.jobs.map(job=>groupJobsIntoSummaries([job],{includeSinglesAsGroups:true}).groups[0]);
 const remove=(field,index)=>h.setInputAssets(previous=>({...previous,[field.id]:previous[field.id].map((asset,i)=>i===index?null:asset)}));
 return <I18nProvider locale="en" dictionary={{}} fallback={{}}><main style={{padding:20,maxWidth:1000,margin:'auto'}}>
 <p style={{fontSize:12,marginBottom:16}}>Local gallery recall regression · synthetic data · generation disabled</p>
 <h1 style={{fontSize:24}}>Recall video settings</h1>
 <nav aria-label="Gallery actions" style={{display:'flex',gap:10,flexWrap:'wrap',margin:'20px 0'}}>{groups.map(group=><button key={group.id} onClick={()=>h.gallery.handleGalleryGroupAction(group,'open')}>Open {group.hero.engineLabel}</button>)}</nav>
 {form&&c.selectedEngine&&<><p data-model>{c.selectedEngine.label}</p>
 <nav style={{display:'flex',gap:12,margin:'16px 0'}}>{c.composerModeToggles?.map(entry=><button key={entry.mode??'create'} data-mode={entry.mode??'create'} aria-pressed={c.activeManualMode===entry.mode} onClick={()=>c.handleComposerModeToggle(entry.mode)}>{entry.label}</button>)}</nav>
 <Composer density="workspace" engine={c.selectedEngine} caps={c.capability} activeManualMode={c.activeManualMode}
 prompt={h.prompt} onPromptChange={h.setPrompt} promptRequired={false} assetFields={h.schema.inputSchemaSummary.assetFields}
 assets={h.inputAssets} currency="USD" price={null} isLoading={false} isPricing={h.settings.recallPending} error={h.settings.recallError} onAssetRemove={remove}
 onGenerate={()=>{throw Error('Generation forbidden in local recall fixture');}}
 settingsBar={<CoreSettingsBar density="workspace" engine={c.selectedEngine} mode={c.submissionMode} caps={c.capability}
 durationSec={c.effectiveDurationSec} durationOption={form.durationOption} onDurationChange={c.handleDurationChange}
 resolution={form.resolution} onResolutionChange={c.handleResolutionChange} aspectRatio={form.aspectRatio}
 onAspectRatioChange={c.handleAspectRatioChange} fps={form.fps} onFpsChange={c.handleFpsChange}
 showAudioControl={c.supportsAudioToggle} audioEnabled={form.audio} onAudioChange={value=>h.setForm(previous=>({...previous,audio:value}))}/>}/></>}
 <output data-state hidden>{JSON.stringify({form,prompt:h.prompt,mode:c.submissionMode,assets:h.inputAssets,notice:h.notice,recallPending:h.settings.recallPending,recallBlocked:h.settings.recallBlocked,recallError:h.settings.recallError})}</output>
 </main></I18nProvider>;
}
createRoot(document.getElementById('root')).render(<Main/>);
`;
