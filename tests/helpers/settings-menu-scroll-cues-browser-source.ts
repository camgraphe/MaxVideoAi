/** Actual settings owners/CSS; synthetic local state, with no generation or account. */
export const settingsMenuScrollCuesSource = `
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {Composer} from './components/Composer';
import {CoreSettingsBar} from './components/CoreSettingsBar';
import {ImageSettingsBar} from './components/ImageSettingsBar';
import {ImageAdvancedSettingsContent} from './components/image-advanced-settings/ImageAdvancedSettingsContent';
import {AudioSelectControl} from './app/(core)/(workspace)/app/audio/_components/audio-workspace-controls';
import {AudioOptionsSection} from './app/(core)/(workspace)/app/audio/_components/audio-options-section';
import {DEFAULT_AUDIO_WORKSPACE_COPY as copy} from './app/(core)/(workspace)/app/audio/copy';
import {AUDIO_SEED_AUDIO_VOICE_VALUES} from '@/lib/audio-generation';
import {SelectMenu} from './components/ui/SelectMenu';
import {Clock3} from 'lucide-react';
import {listFalEngines} from './src/config/falEngines';
const noop=()=>{};
const engine=listFalEngines().find(e=>e.engine.id==='kling-o3-standard').engine;
const params=new URLSearchParams(location.search), locale=params.get('locale')??'fr', surface=params.get('surface')??'core';
const labels={en:{duration:'Duration',resolution:'Resolution',aspect:'Format'},fr:{duration:'Durée',resolution:'Résolution',aspect:'Format'},es:{duration:'Duración',resolution:'Resolución',aspect:'Formato'}}[locale];
const options=Array.from({length:20},(_,i)=>({value:i+1,label:(i+1)+'s',disabled:i===1}));
function Main(){
 const [value,setValue]=useState(surface==='core'?6:surface==='voice'?'default':1);
 const [long,setLong]=useState(true);
 const currentOptions=long?options:options.slice(0,3);
 const update=next=>{setValue(next);globalThis.selections.push(next);};
 globalThis.selections??=[];
 const core=<CoreSettingsBar density="workspace" engine={engine} mode="t2v" caps={engine.modeCaps.t2v} durationSec={value} onDurationChange={update} resolution="720p" onResolutionChange={noop} aspectRatio="16:9" onAspectRatioChange={noop} fps={24} onFpsChange={noop}/>;
 return <I18nProvider locale={locale} dictionary={{workspace:{header:{controlLabels:labels}}}} fallback={{}}>
 <style>{'[role="listbox"]{scrollbar-width:none!important}[role="listbox"]::-webkit-scrollbar{display:none!important}'}</style>
 <main className="app-workspace-main" style={{maxWidth:900,margin:(surface==='core'?'72px':'420px')+' auto 40px',padding:6}}>
 <p style={{fontSize:12,marginBottom:16}}>Local · synthetic draft · no generation</p>
 <h1 style={{fontSize:22,marginBottom:16}}>Kling O3 Standard · {locale.toUpperCase()}</h1>
 {surface==='core'?<Composer density="workspace" engine={engine} caps={engine.modeCaps.t2v} assetFields={[]} assets={{}} prompt="A synthetic scene, preserved while exploring the settings." onPromptChange={noop} promptRequired={false} price={null} currency="USD" isLoading={false} onGenerate={()=>{throw Error('Generation is forbidden');}} settingsBar={core}/>:null}
 {surface==='image'?<ImageSettingsBar density="workspace" aspectRatio={{value:String(value),options:currentOptions,onChange:update}}/>:null}
 {surface==='advanced'?<ImageAdvancedSettingsContent thinkingLevel={{label:'Thinking level',value:String(value),options:currentOptions,onChange:update}}/>:null}
 {surface==='audio'?<AudioSelectControl label="Duration" value={value} options={currentOptions} icon={Clock3} onChange={update}/>:null}
 {surface==='voice'?<form onSubmit={event=>{event.preventDefault();globalThis.hostSubmissions=(globalThis.hostSubmissions??0)+1;}}><AudioOptionsSection copy={copy} pack="voice_only" showSeedAudioVoice seedAudioVoice={value} seedAudioVoiceOptions={(long?AUDIO_SEED_AUDIO_VOICE_VALUES:AUDIO_SEED_AUDIO_VOICE_VALUES.slice(0,1)).map(v=>({value:v,label:copy.controls.seedAudioVoices[v]}))} onSeedAudioVoiceChange={update}/></form>:null}
 {surface==='search'?<SelectMenu options={currentOptions} value={value} onChange={update} searchable portal menuPlacement="top" menuClassName="app-experience app-settings-menu"/>:null}
 <button type="button" style={{marginTop:24}} onClick={()=>setLong(!long)}>Toggle short options</button>
 <output data-selected hidden>{String(value)}</output>
 </main></I18nProvider>;
}createRoot(document.getElementById('root')).render(<Main/>);
`;
