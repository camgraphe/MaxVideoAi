'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {authFetch} from '@/lib/authFetch';
import {conversationLibraryInsertTiming} from '@/lib/studio/conversation-timeline-editing';
import type {ToolAssetRef} from '@/lib/toolbox/contract';
import type {MediaFacts} from '@/lib/media-identity';

type Timeline={data:{sequenceId:string;revision:number};settings:{fps:number};items:Array<{id:string;title:string;mediaKind:string;startSec:number;durationSec:number}>};
const copy={
 en:{open:'Use in Studio',project:'Choose a film',append:'Add at the end',replace:'Replace a clip',clip:'Choose the clip to replace',apply:'Apply to film',retry:'Retry the same edit',loading:'Loading…',error:'Studio or this media is unavailable. Try again.',changed:'The film changed. Choose the current film again before applying.',done:'Saved in the film',visit:'Open film',empty:'Create a film in Studio first',seconds:'seconds',duration:'Inserted duration',replacement:'The selected clip’s timing is preserved. The new source must cover its full duration.'},
 fr:{open:'Utiliser dans Studio',project:'Choisir un film',append:'Ajouter à la fin',replace:'Remplacer un clip',clip:'Choisir le clip à remplacer',apply:'Appliquer au film',retry:'Réessayer la même modification',loading:'Chargement…',error:'Studio ou ce média est indisponible. Réessayez.',changed:'Le film a changé. Sélectionnez sa version actuelle avant d’appliquer.',done:'Enregistré dans le film',visit:'Ouvrir le film',empty:'Créer d’abord un film dans Studio',seconds:'secondes',duration:'Durée insérée',replacement:'Le placement et la durée du clip restent identiques. La nouvelle source doit couvrir toute sa durée.'},
 es:{open:'Usar en Studio',project:'Elegir una película',append:'Añadir al final',replace:'Reemplazar un clip',clip:'Elegir el clip a reemplazar',apply:'Aplicar a la película',retry:'Reintentar la misma edición',loading:'Cargando…',error:'Studio o este medio no está disponible. Inténtalo de nuevo.',changed:'La película cambió. Selecciona su versión actual antes de aplicar.',done:'Guardado en la película',visit:'Abrir película',empty:'Primero crea una película en Studio',seconds:'segundos',duration:'Duración insertada',replacement:'Se conservan la posición y duración del clip. La nueva fuente debe cubrir toda su duración.'},
};
/** Only owned canonical assets enter this picker; all mutations use Studio's revisioned command owner. */
export function StudioMediaAction({reference,locale}:{reference:Extract<ToolAssetRef,{type:'asset'}>;locale:string}){
 const assetId=reference.assetId,kind=reference.kind;
 const t=copy[locale.startsWith('fr')?'fr':locale.startsWith('es')?'es':'en'];
 const [open,setOpen]=useState(false),[projects,setProjects]=useState<Array<{id:string;name:string}>>([]),[project,setProject]=useState('');
 const [mediaFacts,setMediaFacts]=useState<MediaFacts>(),[timeline,setTimeline]=useState<Timeline|null>(null),[mode,setMode]=useState<'insert'|'replace'>('insert'),[clipId,setClipId]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[saved,setSaved]=useState(false),[reload,setReload]=useState(0),[uncertain,setUncertain]=useState(false);
 const alive=useRef(true),receipt=useRef<{path:string;body:string}|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(!open)return;const controller=new AbortController();setBusy(true);setError(null);
  void Promise.all([
   authFetch('/api/studio/conversation-projects',{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok||!data.ok)throw Error();return data.projects;}),
   authFetch('/api/studio/media/resolve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({refs:[{type:'asset',assetId,kind}]}),signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok||!data.ok||!data.assets?.[0])throw Error();return data.assets[0];}),
  ]).then(([list,media])=>{if(!controller.signal.aborted){setProjects(list);setMediaFacts(media.mediaFacts);}}).catch(()=>{if(!controller.signal.aborted)setError(t.error);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[open,assetId,kind,reload,t.error]); // Identity comes from the keyed parent, never a client URL.
 useEffect(()=>{
  setTimeline(null);setClipId('');setSaved(false);if(!project)return;
  const controller=new AbortController();setBusy(true);setError(null);
  void authFetch(`/api/studio/projects/${encodeURIComponent(project)}/conversation-timeline?preview=1`,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok||!data.ok)throw Error();if(!controller.signal.aborted)setTimeline(data.result);}).catch(()=>{if(!controller.signal.aborted)setError(t.error);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[project,t.error]);
 const duration=timeline?.items.reduce((max,item)=>Math.max(max,item.startSec+item.durationSec),0)??0;
 const timing=timeline?conversationLibraryInsertTiming({kind:reference.kind,mediaFacts,timelineDurationSec:duration,fps:timeline.settings.fps}):null;
 const selected=timeline?.items.find(item=>item.id===clipId),compatible=timeline?.items.filter(item=>reference.kind==='audio'?item.mediaKind==='audio':['image','video'].includes(item.mediaKind))??[];
 const eligible=Boolean(timeline&&(mode==='insert'?timing:selected&&(reference.kind==='image'||(mediaFacts?.durationSec??0)>=selected.durationSec)));
 async function apply(){
  if(busy||!timeline||(!receipt.current&&!eligible))return;
  if(!receipt.current)receipt.current={path:`/api/studio/projects/${encodeURIComponent(project)}/conversation-timeline`,body:JSON.stringify({sequenceId:timeline.data.sequenceId,expectedRevision:timeline.data.revision,idempotencyKey:crypto.randomUUID(),edit:mode==='insert'?{kind:'insert',ref:reference,...timing}:{kind:'replace',clipId,ref:reference,sourceInFrame:0}})};
  setBusy(true);setError(null);
  try{const request=receipt.current,response=await authFetch(request.path,{method:'POST',headers:{'content-type':'application/json'},body:request.body});const data=await response.json();if(!alive.current)return;
   if(!response.ok||!data.ok){if(response.status===409){receipt.current=null;setUncertain(false);setProject('');setError(t.changed);return;}if(response.status>=400&&response.status<500){receipt.current=null;setUncertain(false);}throw Error();}
   receipt.current=null;setUncertain(false);setSaved(true);
  }catch{if(alive.current){setError(t.error);setUncertain(Boolean(receipt.current));}}finally{if(alive.current)setBusy(false);}
 }
 return <details onToggle={event=>setOpen(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer py-3">{t.open}</summary><div className="grid min-w-0 gap-3 rounded-xl border border-border bg-surface p-4">
  {busy?<p role="status">{t.loading}</p>:null}{error?<p role="alert">{error}</p>:null}
  {!projects.length&&!busy?<Link href="/app/studio" prefetch={false}>{t.empty}</Link>:null}
  <label>{t.project}<select className="block min-h-11 w-full" value={project} disabled={busy||uncertain||saved} onChange={event=>setProject(event.target.value)}><option value="">—</option>{projects.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
  {timeline&&!saved?<><div className="flex flex-wrap gap-3">{(['insert','replace'] as const).map(value=><button type="button" key={value} aria-pressed={mode===value} disabled={busy||uncertain} onClick={()=>setMode(value)}>{value==='insert'?t.append:t.replace}</button>)}</div>
   {mode==='replace'?<><label>{t.clip}<select className="block min-h-11 w-full" value={clipId} disabled={busy||uncertain} onChange={event=>setClipId(event.target.value)}><option value="">—</option>{compatible.map(item=><option key={item.id} value={item.id}>{item.title} · {item.durationSec} {t.seconds}</option>)}</select></label><p>{t.replacement}</p></>:<p>{t.duration}: {timing?(timing.durationFrames/timeline.settings.fps).toFixed(2):'—'} {t.seconds}</p>}
   <button type="button" disabled={busy||(!uncertain&&!eligible)} onClick={()=>void apply()}>{uncertain?t.retry:t.apply}</button></>:null}
  {saved?<p role="status">{t.done} · <Link prefetch={false} href={`/app/studio/conversation/${encodeURIComponent(project)}`}>{t.visit}</Link></p>:null}
  {error&&!uncertain&&!project?<button type="button" disabled={busy} onClick={()=>setReload(value=>value+1)}>{locale.startsWith('fr')?'Recharger':locale.startsWith('es')?'Volver a cargar':'Reload'}</button>:null}
 </div></details>;
}
