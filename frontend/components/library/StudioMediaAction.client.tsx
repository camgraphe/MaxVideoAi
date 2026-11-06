'use client';
import Link from 'next/link';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ownedAuthFetch} from '@/lib/owned-auth-fetch';
import {resolveMediaContinuationOriginal} from '@/lib/video-continuation';
import {conversationLibraryInsertTiming} from '@/lib/studio/conversation-timeline-editing';
import {saveRecentMediaReference} from '@/lib/studio/image-library';
import type {ToolAssetRef} from '@/lib/toolbox/contract';
import {canonicalMediaAssetFields,type MediaFacts} from '@/lib/media-identity';
import type {AssetBrowserAsset} from './AssetLibraryBrowser';

type Timeline={data:{sequenceId:string;revision:number};settings:{fps:number};items:Array<{id:string;title:string;mediaKind:string;startSec:number;durationSec:number}>};
type AssetReference = Extract<ToolAssetRef, { type: 'asset' }>;
type StudioActionSource = { reference: AssetReference; output?: never }
  | { reference?: never; output: Pick<AssetBrowserAsset, 'id' | 'url' | 'kind' | 'sourceOutputId'> & { jobId: string } };

function abortWith(controller: AbortController, source: AbortSignal) {
  const abort = () => controller.abort(source.reason);
  if (source.aborted) abort();
  else source.addEventListener('abort', abort, { once: true, signal: controller.signal });
}

const copy={
 en:{open:'Use in Studio',project:'Choose a film',append:'Add at the end',replace:'Replace a clip',clip:'Choose the clip to replace',apply:'Apply to film',retry:'Retry the same edit',loading:'Loading…',error:'Studio or this media is unavailable. Try again.',changed:'The film changed. Choose the current film again before applying.',done:'Saved in the film',visit:'Open film',empty:'Create a film in Studio first',seconds:'seconds',duration:'Inserted duration',replacement:'The selected clip’s timing is preserved. The new source must cover its full duration.'},
 fr:{open:'Utiliser dans Studio',project:'Choisir un film',append:'Ajouter à la fin',replace:'Remplacer un clip',clip:'Choisir le clip à remplacer',apply:'Appliquer au film',retry:'Réessayer la même modification',loading:'Chargement…',error:'Studio ou ce média est indisponible. Réessayez.',changed:'Le film a changé. Sélectionnez sa version actuelle avant d’appliquer.',done:'Enregistré dans le film',visit:'Ouvrir le film',empty:'Créer d’abord un film dans Studio',seconds:'secondes',duration:'Durée insérée',replacement:'Le placement et la durée du clip restent identiques. La nouvelle source doit couvrir toute sa durée.'},
 es:{open:'Usar en Studio',project:'Elegir una película',append:'Añadir al final',replace:'Reemplazar un clip',clip:'Elegir el clip a reemplazar',apply:'Aplicar a la película',retry:'Reintentar la misma edición',loading:'Cargando…',error:'Studio o este medio no está disponible. Inténtalo de nuevo.',changed:'La película cambió. Selecciona su versión actual antes de aplicar.',done:'Guardado en la película',visit:'Abrir película',empty:'Primero crea una película en Studio',seconds:'segundos',duration:'Duración insertada',replacement:'Se conservan la posición y duración del clip. La nueva fuente debe cubrir toda su duración.'},
};
/** The picker works with canonical owned assets. Promote a job result only when the action opens. */
export function StudioMediaAction({reference: canonicalReference,output,locale,userId}: StudioActionSource & {locale:string;userId:string}){
 const assetId = canonicalReference?.assetId;
 const kind = canonicalReference ? canonicalReference.kind : output.kind;
 const outputId = output?.id, jobId = output?.jobId, originalUrl = output?.url, knownOutputId = output?.sourceOutputId;
 const t=copy[locale.startsWith('fr')?'fr':locale.startsWith('es')?'es':'en'];
 const [open,setOpen]=useState(false),[projects,setProjects]=useState<Array<{id:string;name:string}>>([]),[project,setProject]=useState('');
 const [media,setMedia]=useState<{reference:AssetReference;facts?:MediaFacts}|null>(null),[timeline,setTimeline]=useState<Timeline|null>(null),[mode,setMode]=useState<'insert'|'replace'>('insert'),[clipId,setClipId]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[saved,setSaved]=useState(false),[reload,setReload]=useState(0),[timelineReload,setTimelineReload]=useState(0),[uncertain,setUncertain]=useState(false);
 const lifetime=useRef<AbortController|null>(null),receipt=useRef<{path:string;body:string}|null>(null);
 const promoted=useRef<AssetReference|null>(null);
 useLayoutEffect(() => {
   const controller = new AbortController();
   lifetime.current = controller;
   return () => controller.abort();
 }, []);
 useEffect(()=>{
  if (!open || !lifetime.current) return;
  const controller = new AbortController();
  const { signal } = controller;
  abortWith(controller, lifetime.current.signal);
  const request: typeof fetch = (input, init) => {
    if (!init?.signal) return ownedAuthFetch(input, userId, { ...init, signal });
    const boundedRequest = new AbortController();
    abortWith(boundedRequest, signal);
    abortWith(boundedRequest, init.signal);
    return ownedAuthFetch(input, userId, { ...init, signal: boundedRequest.signal });
  };
  setBusy(true);
  setError(null);
  async function loadPicker() {
    let reference: AssetReference | null = assetId ? { type: 'asset', assetId, kind } : promoted.current;
    if (!reference) {
      if (!outputId || !jobId || !originalUrl) throw new Error('Missing original output');
      const original = await resolveMediaContinuationOriginal({ id: outputId, jobId, url: originalUrl, kind, source: 'gallery' }, request);
      if (original.jobId !== jobId || (knownOutputId && knownOutputId !== original.id)) throw new Error('Unexpected original output');
      const asset = await saveRecentMediaReference({ id: original.id, jobId, url: original.url, status: 'ready' }, kind, request);
      if (!('sourceOutputId' in asset) || asset.sourceOutputId !== original.id || !('jobId' in asset) || asset.jobId !== jobId) {
        throw new Error('Unexpected saved output');
      }
      const savedReference = canonicalMediaAssetFields(asset.assetId, kind).ref;
      if (savedReference?.type !== 'asset') throw new Error('Missing canonical asset');
      reference = savedReference;
    }
    const [list, resolved] = await Promise.all([
      request('/api/studio/conversation-projects').then(async response => {const data=await response.json();if(!response.ok||!data.ok)throw Error();return data.projects;}),
      request('/api/studio/media/resolve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({refs:[reference]})})
        .then(async response => {const data=await response.json();if(!response.ok||!data.ok||!data.assets?.[0])throw Error();return data.assets[0];}),
    ]);
    if (signal.aborted) return;
    if (!assetId) promoted.current = reference;
    setProjects(list);
    setMedia({ reference, facts: resolved.mediaFacts });
  }
  void loadPicker().catch(()=>{if(!signal.aborted)setError(t.error);}).finally(()=>{if(!signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[open,assetId,kind,outputId,jobId,originalUrl,knownOutputId,reload,t.error,userId]);
 useEffect(()=>{
  setTimeline(null);setClipId('');setSaved(false);if(!project||!lifetime.current)return;
  const controller = new AbortController(), { signal } = controller;
  abortWith(controller, lifetime.current.signal);
  setBusy(true);setError(null);
  void ownedAuthFetch(`/api/studio/projects/${encodeURIComponent(project)}/conversation-timeline?preview=1`,userId,{signal}).then(async response=>{const data=await response.json();if(!response.ok||!data.ok)throw Error();if(!signal.aborted)setTimeline(data.result);}).catch(()=>{if(!signal.aborted)setError(t.error);}).finally(()=>{if(!signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[project,t.error,timelineReload,userId]);
 const reference = media?.reference, mediaFacts = media?.facts;
 const duration=timeline?.items.reduce((max,item)=>Math.max(max,item.startSec+item.durationSec),0)??0;
 const sourceTiming=timeline?conversationLibraryInsertTiming({kind,mediaFacts,timelineDurationSec:kind==='audio'?0:duration,fps:timeline.settings.fps}):null;
 const timing=kind==='audio'&&timeline&&sourceTiming?{...sourceTiming,startFrame:Math.round(duration*timeline.settings.fps)}:sourceTiming;
 const selected=timeline?.items.find(item=>item.id===clipId),compatible=timeline?.items.filter(item=>kind==='audio'?item.mediaKind==='audio':['image','video'].includes(item.mediaKind))??[];
 const eligible=Boolean(reference&&timeline&&(mode==='insert'?timing:selected&&(kind==='image'||(mediaFacts?.durationSec??0)>=selected.durationSec)));
 async function apply(){
  const signal=lifetime.current?.signal;
  if(busy||!timeline||!reference||!signal||signal.aborted||(!receipt.current&&!eligible))return;
  if(!receipt.current)receipt.current={path:`/api/studio/projects/${encodeURIComponent(project)}/conversation-timeline`,body:JSON.stringify({sequenceId:timeline.data.sequenceId,expectedRevision:timeline.data.revision,idempotencyKey:crypto.randomUUID(),edit:mode==='insert'?{kind:'insert',ref:reference,...timing}:{kind:'replace',clipId,ref:reference,sourceInFrame:0}})};
  setBusy(true);setError(null);
  try{const request=receipt.current,response=await ownedAuthFetch(request.path,userId,{method:'POST',headers:{'content-type':'application/json'},body:request.body,signal});const data=await response.json();if(signal.aborted)return;
   if(!response.ok||!data.ok){if(response.status===409){receipt.current=null;setUncertain(false);setProject('');setError(t.changed);return;}if(response.status>=400&&response.status<500){receipt.current=null;setUncertain(false);}throw Error();}
   receipt.current=null;setUncertain(false);setSaved(true);
  }catch{if(!signal.aborted){setError(t.error);setUncertain(Boolean(receipt.current));}}finally{if(!signal.aborted)setBusy(false);}
 }
 return <details onToggle={event=>setOpen(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer py-3">{t.open}</summary><div className="grid min-w-0 gap-3 rounded-xl border border-border bg-surface p-4">
  {busy?<p role="status">{t.loading}</p>:null}{error?<p role="alert">{error}</p>:null}
  {media&&!projects.length&&!busy?<Link href="/app/studio" prefetch={false}>{t.empty}</Link>:null}
  {media?<label>{t.project}<select className="block min-h-11 w-full" value={project} disabled={busy||uncertain||saved} onChange={event=>setProject(event.target.value)}><option value="">—</option>{projects.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>:null}
  {timeline&&!saved?<><div className="flex flex-wrap gap-3">{(['insert','replace'] as const).map(value=><button type="button" key={value} aria-pressed={mode===value} disabled={busy||uncertain} onClick={()=>setMode(value)}>{value==='insert'?t.append:t.replace}</button>)}</div>
   {mode==='replace'?<><label>{t.clip}<select className="block min-h-11 w-full" value={clipId} disabled={busy||uncertain} onChange={event=>setClipId(event.target.value)}><option value="">—</option>{compatible.map(item=><option key={item.id} value={item.id}>{item.title} · {item.durationSec} {t.seconds}</option>)}</select></label><p>{t.replacement}</p></>:<p>{t.duration}: {timing?(timing.durationFrames/timeline.settings.fps).toFixed(2):'—'} {t.seconds}</p>}
   <button type="button" disabled={busy||(!uncertain&&!eligible)} onClick={()=>void apply()}>{uncertain?t.retry:t.apply}</button></>:null}
  {saved?<p role="status">{t.done} · <Link prefetch={false} href={`/app/studio/conversation/${encodeURIComponent(project)}`}>{t.visit}</Link></p>:null}
  {error&&!uncertain?<button type="button" disabled={busy} onClick={()=>project?setTimelineReload(value=>value+1):setReload(value=>value+1)}>{locale.startsWith('fr')?'Recharger':locale.startsWith('es')?'Volver a cargar':'Reload'}</button>:null}
 </div></details>;
}
