/** Actual menu owners with an unrelated parent update; no service, media or account. */
export const settingsMenuScrollStabilitySource = `
import {Profiler,useState} from 'react';import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {CoreSettingsBar} from './components/CoreSettingsBar';
import {SelectMenu} from './components/ui/SelectMenu';
import {AudioSelectControl} from './app/(core)/(workspace)/app/audio/_components/audio-workspace-controls';
import {AudioOptionsSection} from './app/(core)/(workspace)/app/audio/_components/audio-options-section';
import {DEFAULT_AUDIO_WORKSPACE_COPY as copy} from './app/(core)/(workspace)/app/audio/copy';
import {AUDIO_SEED_AUDIO_VOICE_VALUES} from '@/lib/audio-generation';
import {Clock3} from 'lucide-react';import {listFalEngines} from './src/config/falEngines';
const config=globalThis.fixtureConfig,noop=()=>{};
const engine=listFalEngines().find(e=>e.engine.id==='kling-o3-pro').engine;
const originalRows=Array.from({length:20},(_,i)=>({value:i+1,label:'Option '+(i+1),disabled:i===1}));
function Main(){
 const[tick,setTick]=useState(0),[value,setValue]=useState(config.initialValue??6),[rows,setRows]=useState(originalRows);
 globalThis.parentRenderCount=(globalThis.parentRenderCount??0)+1;
 globalThis.repeatParentRender=()=>setTick(v=>v+1);
 globalThis.changeSelectedValue=setValue;
 globalThis.changeOptions=kind=>setRows(current=>kind==='reverse'?[...current].reverse():kind==='disable7'?current.map(r=>r.value===7?{...r,disabled:true}:r):kind==='remove7'?current.filter(r=>r.value!==7):kind==='allDisabled'?current.map(r=>({...r,disabled:true})):kind==='relabel'?current.map(r=>({...r,label:r.label+' refreshed'})):originalRows);
 globalThis.trace?.push({type:'parent-render',tick,count:globalThis.parentRenderCount,time:performance.now()});
 const update=next=>{setValue(next);(globalThis.selections??=[]).push(next);};
 return <Profiler id="owner" onRender={()=>globalThis.trace?.push({type:'commit',count:globalThis.parentRenderCount,time:performance.now()})}><I18nProvider locale="en" dictionary={{}} fallback={{}}>
 <main style={{maxWidth:1330,margin:'850px auto 60px',padding:6}}>
 <p>Local · synthetic state · no service or generation</p><h1>{engine.label}</h1>
 {config.kind==='core'?<CoreSettingsBar density="workspace" engine={engine} mode="t2v" caps={engine.modeCaps.t2v} durationSec={value} onDurationChange={update} resolution="1080p" onResolutionChange={noop} aspectRatio="16:9" onAspectRatioChange={noop} fps={24} onFpsChange={noop}/>:null}
 {config.kind==='plain'||config.kind==='search'?<SelectMenu options={rows.map(r=>({...r}))} value={value} onChange={update} searchable={config.kind==='search'} menuPlacement="top" menuClassName="app-experience app-settings-menu"/>:null}
 {config.kind==='audio'?<AudioSelectControl label="Duration" value={value} options={rows.map(r=>({...r}))} icon={Clock3} onChange={update}/>:null}
 {config.kind==='voice'?<AudioOptionsSection copy={copy} pack="voice_only" showSeedAudioVoice seedAudioVoice={value} seedAudioVoiceOptions={AUDIO_SEED_AUDIO_VOICE_VALUES.map(v=>({value:v,label:copy.controls.seedAudioVoices[v]}))} onSeedAudioVoiceChange={update}/>:null}
 <output data-selected hidden>{String(value)}</output><output data-parent hidden>{tick}</output>
 </main></I18nProvider></Profiler>;
}createRoot(document.getElementById('root')).render(<Main/>);
`;
