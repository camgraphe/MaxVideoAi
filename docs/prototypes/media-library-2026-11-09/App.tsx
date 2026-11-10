import { createRoot } from 'react-dom/client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Clapperboard, FolderOpen, Grid2X2, ImagePlus, Layers, ListChecks, Menu, Moon, Plus, Settings2, Sparkles, Sun, Upload, X } from 'lucide-react';
import { CompactMediaGrid } from './components/PrototypeMediaGrid';
import { Collections } from './components/Collections';
import { Toolbar, KindTabs } from './components/Toolbar';
import { SelectionBar } from './components/SelectionBar';
import { Viewer } from './components/Viewer';
import { Sheet, Field, Popup } from './components/Primitives';
import { CreateDraft, initialDraft, type CreationDraft } from './components/CreateDraft';
import { Activity, ActivityDetails } from './components/Activity';
import { ToolHandoff, type ToolIntent } from './components/ToolHandoff';
import { makeActivity, type DemoActivity } from './activity-fixtures';
import { defaultScope, filterAssets, initialCollections, isEligible, makeAssets, sources, displayMediaLabel, type Collection, type DemoAsset, type Scope } from './fixtures';

const params = new URLSearchParams(location.search);
const numberParam = (key: string, fallback: number) => Math.max(0, Math.min(10_000, Number(params.get(key)) || fallback));
function App() {
  const [count, setCount] = useState(numberParam('count',96));
  const [assets, setAssets] = useState(() => makeAssets(count));
  const [collections, setCollections] = useState<Collection[]>(() => params.get('collections') === '1000' ? Array.from({length:1000},(_,i) => ({id:`collection-${i}`,name:`Collection de démonstration ${String(i+1).padStart(4,'0')}`})) : initialCollections);
  const [libraryScope, setLibraryScope] = useState<Scope>(defaultScope);
  const [pickerScope, setPickerScope] = useState<Scope>({...defaultScope,kind:'image'});
  const [libraryLoaded, setLibraryLoaded] = useState(params.get('loaded') === 'all' ? 10_000 : 60);
  const [pickerLoaded, setPickerLoaded] = useState(60);
  const [scenario, setScenario] = useState(params.get('state') ?? 'ready');
  const [density, setDensity] = useState(() => {try {return Number(localStorage.getItem('media-design:density')) || (innerWidth <= 700 ? 136 : 128);} catch {return innerWidth <= 700 ? 136 : 128;}});
  const [displayMode,setDisplayMode] = useState<'mosaic'|'grid'|'list'>(()=>{try{const value=localStorage.getItem('media-design:view');return value==='grid'||value==='list'?value:'mosaic';}catch{return 'mosaic';}});
  const [librarySelected, setLibrarySelected] = useState(new Set<string>());
  const [pickerSelected, setPickerSelected] = useState(new Set<string>());
  const [page, setPage] = useState(params.has('picker')?'create':'library');
  const [picker, setPicker] = useState(params.has('picker'));
  const [scope,setScope] = picker ? [pickerScope,setPickerScope] : [libraryScope,setLibraryScope];
  const [selected,setSelected] = picker ? [pickerSelected,setPickerSelected] : [librarySelected,setLibrarySelected];
  const [loaded,setLoaded] = picker ? [pickerLoaded,setPickerLoaded] : [libraryLoaded,setLibraryLoaded];
  const [replaceSlot, setReplaceSlot] = useState<number | undefined>();
  const [references, setReferences] = useState<DemoAsset[]>([]);
  const [draft,setDraft] = useState<CreationDraft>(initialDraft);
  const activities=useMemo(()=>makeActivity(assets),[assets]);
  const [activityDetail,setActivityDetail]=useState<DemoActivity|null>(null);
  const [activityOutputs,setActivityOutputs]=useState<DemoActivity|null>(null);
  const [viewer, setViewer] = useState<DemoAsset | null>(null);
  const [toast, setToast] = useState('');
  const [tool, setTool] = useState<ToolIntent | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [partial, setPartial] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const notify = (message: string) => {setToast(message);clearTimeout(toastTimer.current);toastTimer.current = setTimeout(() => setToast(''),5500);};
  const navigate=(next:string)=>{setPage(next);if(next==='library')setActivityOutputs(null);};
  const openTool=(name:string)=>setTool({name,assets:[]});
  const showResults=(event:DemoActivity)=>{setActivityOutputs(event);setLibraryScope({...defaultScope,folder:assets.filter(a=>event.outputIds.includes(a.id)).every(a=>a.trashed)?'trash':'all'});setLibrarySelected(new Set());setLibraryLoaded(60);setScenario('ready');setActivityDetail(null);setViewer(null);setPage('library');};
  const resumeActivity=(event:DemoActivity)=>{
    setActivityDetail(null);
    if(event.tool){setTool({name:event.tool,assets:assets.filter(a=>event.outputIds.includes(a.id)),activity:event});return;}
    setDraft({prompt:event.prompt,model:event.model,kind:event.kind,resumed:true});setReferences([]);setPage('create');
  };
  const useMedia=(name:string)=>{
    if(!viewer)return;
    if(name==='Créer une vidéo'||name==='Créer une image'){
      if(references.length>=10&&!references.some(a=>a.id===viewer.id)){notify('La capacité de 10 références est atteinte.');return;}
      setReferences(previous=>previous.some(a=>a.id===viewer.id)?previous:[...previous,viewer]);
      setDraft(previous=>({...previous,kind:name==='Créer une image'?'image':'video',model:'Modèle à choisir',resumed:false}));setViewer(null);setPage('create');return;
    }
    setTool({name,assets:[viewer]});setViewer(null);
  };
  const patch = (change: Partial<Scope>) => {
    setScope(current => ({...current,...change}));setLoaded(60);setViewer(null);setPartial(null);
    if (!picker && Object.keys(change).some(key => key !== 'sort')) {setSelected(new Set());if(selected.size)notify('Sélection effacée après le changement des filtres.');}
  };
  const filtered = useMemo(() => scenario === 'empty' ? [] : filterAssets(!picker&&activityOutputs?assets.filter(a=>activityOutputs.outputIds.includes(a.id)):assets,scope,picker),[assets,scope,picker,scenario,activityOutputs]);
  const visible = filtered.slice(0,loaded);
  const disabledKeys = useMemo(() => new Set(picker ? visible.filter(a => !isEligible(a)).map(a => a.id) : []),[visible,picker]);
  const changeSelection = (keys: Set<string> | 'all') => {
    const next = keys === 'all' ? new Set(visible.filter(a => !picker || isEligible(a)).map(a => a.id)) : keys;
    const max = replaceSlot !== undefined ? 1 : 10 - references.length;
    // The mock picker preserves selection across pages/filters, in click order.
    if (picker) {const nextAll = replaceSlot !== undefined ? new Set(next) : new Set(selected);if(replaceSlot===undefined){for(const asset of visible)if(!next.has(asset.id))nextAll.delete(asset.id);for(const id of next)nextAll.add(id);}if(nextAll.size>max){notify(`Maximum ${max} référence${max>1?'s':''} disponible${max>1?'s':''} pour cette destination.`);return;}setSelected(nextAll);} else setSelected(new Set(next));
  };
  const openPicker = (slot?: number) => {setReplaceSlot(slot);setPickerScope({...defaultScope,kind:'image'});setPickerSelected(new Set());setPickerLoaded(60);setScenario('ready');setPicker(true);};
  const closePicker = () => {setPicker(false);setPickerSelected(new Set());setViewer(null);};
  const confirm = (choices: DemoAsset[]) => {
    if (!choices.length || choices.some(a => !isEligible(a))) {notify('Cette destination accepte uniquement les images.');return;}
    if (replaceSlot !== undefined) setReferences(previous => previous.map((a,i) => i === replaceSlot ? choices[0] : a));
    else if (references.length + choices.length <= 10) setReferences(previous => [...previous,...choices]);
    else {notify('La capacité de 10 références est atteinte.');return;}
    setPage('create');closePicker();notify(replaceSlot !== undefined ? 'Référence remplacée dans le brouillon local.' : `${choices.length} référence${choices.length>1?'s':''} ajoutée${choices.length>1?'s':''} au brouillon local.`);
  };
  const run = (operation: string, collectionId?: string) => {
    const ids = [...selected];
    const confirmed = new Set(scenario === 'partial' ? ids.slice(0,Math.max(1,Math.floor(ids.length/2))) : ids);
    setAssets(current => current.map(asset => !confirmed.has(asset.id) ? asset : {...asset,
      ...(operation === 'favorite' ? {favorite:true} : operation === 'unfavorite' ? {favorite:false} : operation === 'trash' ? {trashed:true} : operation === 'restore' ? {trashed:false} : operation === 'add' ? {collections:[...new Set([...asset.collections,collectionId!])]} : operation === 'remove' ? {collections:asset.collections.filter(id => id !== collectionId)} : {}),
    }));
    setSelected(new Set(ids.filter(id => !confirmed.has(id))));
    if(scenario === 'partial' && ids.length > confirmed.size)setPartial(`${confirmed.size} confirmés · ${ids.length-confirmed.size} échecs simulés. La sélection restante est conservée.`);
    else {setPartial(null);notify(`${confirmed.size.toLocaleString('fr')} média(s) mis à jour dans la démo.`);}
  };
  const reorder = (id: string, offset: number) => {const ids = [...selected];const index = ids.indexOf(id);[ids[index],ids[index+offset]]=[ids[index+offset],ids[index]];setSelected(new Set(ids));};
  const refresh = () => {setScenario('loading');setTimeout(() => setScenario('ready'),650);};
  useEffect(() => {const handle = (event: KeyboardEvent) => {if(event.key === '/' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)){event.preventDefault();document.querySelector<HTMLInputElement>(picker ? '.picker-sheet .main-search input' : page==='activity' ? '.activity-filters input[type=search]' : '.workspace .main-search input')?.focus();}};document.addEventListener('keydown',handle);return () => document.removeEventListener('keydown',handle);},[picker,page]);
  useEffect(() => () => clearTimeout(toastTimer.current),[]);
  const totalLabel = `${filtered.length.toLocaleString('fr')} média${filtered.length>1?'s':''}`;
  const library = (isPicker: boolean) => <section className={`library ${isPicker ? 'in-picker' : ''}`} aria-label={isPicker ? 'Choisir depuis les médias' : 'Bibliothèque médias'}>
    {!isPicker&&activityOutputs?<div className="activity-context"><button className="text-button" onClick={()=>setPage('activity')}><ArrowLeft size={16}/>Activité</button><span>Résultats · {activityOutputs.tool||activityOutputs.model}</span><button className="icon-button" aria-label="Afficher tous les médias" onClick={()=>setActivityOutputs(null)}><X size={17}/></button></div>:null}
    <div className="library-heading"><Collections items={collections} folder={scope.folder} onChoose={folder => patch({folder})} onChange={setCollections} notify={notify}/><span className="library-count">{scenario === 'loading' ? 'Chargement…' : totalLabel}</span>{!isPicker && scenario==='ready' && filtered.length>visible.length ? <button className="text-button mobile-load" aria-label="Charger 60 médias de plus" onClick={()=>setLoaded(n=>n+60)}><span>{visible.length}/{filtered.length.toLocaleString('fr')}</span><Plus size={14}/></button> : null}<div className="heading-kinds"><KindTabs scope={scope} patch={patch}/></div><button className="control import-main" onClick={() => setImportOpen(true)}><Upload size={17}/><span>Importer</span></button></div>
    <Toolbar displayMode={displayMode} setDisplayMode={value=>{setDisplayMode(value);try{localStorage.setItem('media-design:view',value);}catch{}}} scope={scope} patch={patch} density={density} setDensity={n => {setDensity(n);try{localStorage.setItem('media-design:density',String(n));}catch{}}} picker={isPicker} onImport={() => setImportOpen(true)} onRefresh={refresh} onSelect={all => {setSelected(new Set((all?filtered:visible).map(a=>a.id)));notify(all?`Tous les ${filtered.length.toLocaleString('fr')} résultats sont sélectionnés dans la démo.`:`${visible.length} médias chargés sélectionnés.`);}} onTool={openTool}/>
    <div className="results-caption"><span>{isPicker ? replaceSlot === undefined ? `Références image · ${10-references.length} places disponibles` : `Remplacer l’image ${replaceSlot+1} · un seul média` : scope.folder === 'trash' ? 'Restaurez vos médias depuis la corbeille' : `${visible.length} sur ${filtered.length.toLocaleString('fr')} affichés`}</span>{isPicker ? <button className="text-button" onClick={() => openTool('Character Studio')}>Character Studio<Sparkles size={14}/></button> : filtered.length>visible.length ? <button className="text-button" onClick={()=>setLoaded(n=>n+60)}>Charger plus</button> : <span className="subtle">Formats entiers</span>}</div>
    {partial ? <div className="status-error" role="alert"><p>{partial}</p><button onClick={() => {setScenario('ready');setPartial(null);notify('Démo rétablie. La sélection restante est conservée ; relancez votre action.');}}>Reprendre avec les médias restants</button></div> : null}
    {scenario === 'error' ? <div className="empty-state" role="alert"><FolderOpen size={32}/><h3>Impossible de charger vos médias</h3><p>Votre sélection est conservée. Réessayez pour reprendre.</p><button className="control" onClick={refresh}>Réessayer</button></div> : scenario === 'loading' ? <div className="skeleton-grid" aria-label="Chargement des médias" aria-busy="true">{Array.from({length:12},(_,i) => <div key={i}/>)}</div> : filtered.length ? <>
      <CompactMediaGrid getAssetName={displayMediaLabel} displayMode={displayMode} userId="synthetic-design-owner" locale="fr" assets={visible} selectedKeys={selected} onSelectionChange={changeSelection} onOpen={asset => isPicker ? confirm([asset as DemoAsset]) : setViewer(asset as DemoAsset)} onPreview={isPicker ? asset => setViewer(asset as DemoAsset) : undefined} openActionLabel={isPicker ? 'Ajouter' : 'Aperçu'} density={density} selectionMode={isPicker && replaceSlot !== undefined ? 'single' : 'multiple'} selectionDisabledKeys={isPicker ? disabledKeys : undefined} renderAssetMeta={asset => isPicker && !isEligible(asset as DemoAsset) ? <span>Image requise · aperçu disponible</span> : <span aria-label={'Provenance : '+(sources[asset.source as keyof typeof sources]??asset.source)}>{sources[asset.source as keyof typeof sources]??asset.source}</span>}/>
      {isPicker && filtered.length > visible.length ? <div className="load-row"><span>{visible.length} sur {filtered.length.toLocaleString('fr')}</span><button className="control" onClick={() => setLoaded(n => n+60)}>Charger 60 médias de plus</button></div> : null}
    </> : <div className="empty-state"><ImagePlus size={32}/><h3>{scope.query ? 'Aucun média trouvé' : scope.folder !== 'all' ? 'Cet emplacement est vide' : 'Votre bibliothèque commence ici'}</h3><p>{scope.query ? 'Essayez un mot du prompt, un modèle ou un repère personnel.' : 'Importez un média ou retrouvez vos créations au même endroit.'}</p><button className="control" onClick={() => {setScenario('ready');setScope(defaultScope);}}>Voir tous les médias</button><button className="text-button" onClick={() => setImportOpen(true)}>Importer des médias</button></div>}
    <SelectionBar selected={selected} items={assets} picker={isPicker} folder={scope.folder} collections={collections} onClear={() => setSelected(new Set())} onRun={run} onReorder={reorder} onRemove={id => setSelected(previous=>new Set([...previous].filter(key=>key!==id)))} onConfirm={() => confirm([...selected].map(id=>assets.find(a=>a.id===id)!))}/>
  </section>;
  return <div className={`prototype ${dark?'dark':''}`}>
    <a className="skip-link" href="#main">Aller au contenu</a>
    <aside className="app-rail" aria-label="Navigation principale"><div className="brand-mark"><Clapperboard size={27}/></div><button aria-label="Créer" aria-pressed={page === 'create'} onClick={() => navigate('create')}><Plus size={23}/><span>Créer</span></button><button aria-label="Médias" aria-pressed={page === 'library'} onClick={() => navigate('library')}><Grid2X2 size={21}/><span>Médias</span></button><button aria-label="Activité" aria-pressed={page==='activity'} onClick={()=>navigate('activity')}><ListChecks size={21}/><span>Activité</span></button><button aria-label="Outils" onClick={() => openTool('Outils')}><Sparkles size={21}/><span>Outils</span></button><button aria-label="Studio" onClick={() => openTool('Studio')}><Layers size={21}/><span>Studio</span></button><button className="appearance" aria-label="Changer le thème" onClick={() => setDark(!dark)}>{dark?<Sun size={20}/>:<Moon size={20}/>}</button></aside>
    <main id="main" className="workspace"><header className="app-header"><div className="wordmark">MaxVideoAI<span>/</span><strong>{page === 'library'?'Médias':page==='activity'?'Activité':'Créer'}</strong></div><span className="workspace-badge">Espace personnel</span><Popup label="Navigation" icon={<Menu size={19}/>} className="mobile-navigation">{close=><nav className="menu-options" aria-label="Navigation mobile">{[['create','Créer'],['library','Médias'],['activity','Activité']].map(([key,label])=><button key={key} aria-current={page===key?'page':undefined} onClick={()=>{navigate(key);close();}}>{label}</button>)}{['Outils','Studio'].map(name=><button key={name} onClick={()=>{close();openTool(name);}}>{name}</button>)}</nav>}</Popup></header>{page==='library'?library(false):page==='create'?<CreateDraft draft={draft} onPrompt={prompt=>setDraft(previous=>({...previous,prompt}))} onBack={()=>setPage('library')} references={references} onOpen={openPicker} onRemove={index=>setReferences(previous=>previous.filter((_,i)=>i!==index))}/>:null}<div className="activity-surface" hidden={page!=='activity'}><Activity events={activities} onDetails={setActivityDetail} onResults={showResults}/></div></main>
    <Sheet label={replaceSlot === undefined ? 'Choisir des références' : `Remplacer la référence ${replaceSlot+1}`} open={picker} onClose={closePicker} className="picker-sheet">{library(true)}</Sheet>
    <Viewer onSource={viewer&&activities.some(e=>e.outputIds.includes(viewer.id))?()=>{setActivityDetail(activities.find(e=>e.outputIds.includes(viewer!.id))!);setViewer(null);setPage('activity');}:undefined} onFavoriteChange={()=>{if(!viewer)return;const id=viewer.id;const favorite=!viewer.favorite;setAssets(previous=>previous.map(a=>a.id===id?{...a,favorite}:a));setReferences(previous=>previous.map(a=>a.id===id?{...a,favorite}:a));setViewer(a=>a?.id===id?{...a,favorite}:a);}} onLabelChange={value=>{if(!viewer)return;const id=viewer.id;setAssets(previous=>previous.map(a=>a.id===id?{...a,userLabel:value}:a));setReferences(previous=>previous.map(a=>a.id===id?{...a,userLabel:value}:a));setViewer(a=>a?.id===id?{...a,userLabel:value}:a);notify('Repère personnel enregistré dans la démo.');}} asset={viewer} picker={picker} onClose={()=>setViewer(null)} onNavigate={offset=>{const index=filtered.findIndex(a=>a.id===viewer?.id);setViewer(filtered[(index+offset+filtered.length)%filtered.length]);}} onConfirm={()=>viewer&&confirm([viewer])} onTool={useMedia} notify={notify}/>
    <ActivityDetails event={activityDetail} assets={assets} onClose={()=>setActivityDetail(null)} onResults={showResults} onResume={resumeActivity} onProject={event=>{setActivityDetail(null);setTool({name:'Studio',assets:assets.filter(a=>event.outputIds.includes(a.id)),activity:event,projectOnly:true});}}/>
    {tool?<ToolHandoff key={`${tool.name}-${tool.assets.map(a=>a.id).join(',')}-${tool.activity?.id}`} intent={tool} onClose={()=>setTool(null)} onLibrary={()=>{setTool(null);navigate('library');notify('Ouvrez un média puis choisissez un outil dans sa fiche.');}}/>:null}
    <Sheet label="Importer des médias" open={importOpen} onClose={()=>setImportOpen(false)}><div className="editor"><Upload size={30}/><h3>Images, vidéos et audio</h3><p>Simulation d’un import multiple : les fichiers restent fictifs.</p><button className="primary" onClick={()=>{setAssets(current=>[{...makeAssets(1)[0],id:`demo-import-${Date.now()}`,name:'Import de démonstration',kind:'image',source:'upload',prompt:undefined,model:undefined,durationSec:undefined,saved:true,collections:[],trashed:false},...current]);setImportOpen(false);notify('1 import fictif ajouté à la démo.');}}>Simuler un import</button></div></Sheet>
    <div className="demo-bar"><span className="demo-label"><span/>Prototype · données fictives</span><Popup label="Scénarios" icon={<Settings2 size={15}/>}>{close=><div className="filter-menu"><h3>Tester le prototype</h3><Field label="État"><select value={scenario} onChange={e=>{setScenario(e.target.value);close();}}><option value="ready">Normal</option><option value="loading">Chargement</option><option value="empty">Vide</option><option value="error">Erreur de chargement</option><option value="partial">Échec partiel d’action groupée</option></select></Field><Field label="Volume de médias"><select value={count} onChange={e=>{const n=Number(e.target.value);setCount(n);setAssets(makeAssets(n));setSelected(new Set());setLoaded(60);close();}}><option value={96}>96 médias</option><option value={10000}>10 000 médias</option></select></Field><button onClick={()=>{setPage('create');openPicker();close();}}>Tester le sélecteur de références</button></div>}</Popup></div>
    <div role="status" className={`toast ${toast?'visible':''}`} aria-live="polite">{toast}</div>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
