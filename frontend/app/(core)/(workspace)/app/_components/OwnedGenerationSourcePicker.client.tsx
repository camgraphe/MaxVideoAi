'use client';
import { useEffect, useRef, useState } from 'react';
import type { OwnedGenerationSourceOperation, OwnedGenerationSourceOption, OwnedGenerationSourcePage } from '@/lib/owned-generation-source';
import { AppGlyph } from '@/components/app/AppGlyph';
import { WorkspaceReferencePopup } from '@/components/composer/WorkspaceReferencePopup.client';
import { workspaceReferenceCopy } from '@/components/composer/workspace-reference-copy';
import { videoExtensionCopy } from '@/lib/video-extension';

export function OwnedGenerationSourcePicker({account,operation,sourceJobId,locale,onSelect,compact=false,authAction}:{
  account:{userId:string;token:string}|null;operation:OwnedGenerationSourceOperation;sourceJobId:string;locale:string;
  onSelect:(source:OwnedGenerationSourceOption|null)=>void;
  compact?:boolean;authAction?:{href:string};
}) {
  const fr=locale.startsWith('fr'),es=locale.startsWith('es');
  const copy=fr ? {choose:'Choisir une génération dans Médias',empty:'Aucune génération éligible. Les vidéos importées ne peuvent pas servir de source ici.',loading:'Chargement…',more:'Afficher les précédentes',prepare:'Préparer ce Draft pour Enhance',preparing:'Vérification du cache…',unavailable:'Cette source n’est plus éligible. L’original reste dans Médias.',hint:'Choisissez une génération terminée de votre compte. Le prix exact sera calculé avant confirmation.',none:'Sélectionner une vidéo',clear:'Retirer la source',error:'Impossible de charger les sources. Réessayez.'}
    : es ? {choose:'Elegir una generación de Medios',empty:'No hay generaciones compatibles. Los vídeos importados no pueden usarse aquí.',loading:'Cargando…',more:'Mostrar anteriores',prepare:'Preparar este Draft para Enhance',preparing:'Comprobando caché…',unavailable:'Esta fuente ya no es compatible. El original sigue en Medios.',hint:'Elige una generación completada de tu cuenta. El precio exacto se calculará antes de confirmar.',none:'Seleccionar vídeo',clear:'Quitar fuente',error:'No se pueden cargar las fuentes. Inténtalo de nuevo.'}
    : {choose:'Choose an owned generation from Media',empty:'No eligible generations. Uploaded videos cannot be used for this operation.',loading:'Loading…',more:'Show older generations',prepare:'Prepare this Draft for Enhance',preparing:'Checking the paired cache…',unavailable:'This source is no longer eligible. The original remains in Media.',hint:'Choose a completed generation from your account. The exact price is calculated before confirmation.',none:'Select a video',clear:'Remove source',error:'Unable to load sources. Try again.'};
  const [sources,setSources]=useState<OwnedGenerationSourceOption[]>([]);
  const [open,setOpen]=useState(false);
  const referenceCopy=workspaceReferenceCopy(locale);
  const sourceLabel=operation==='luma-extend' ? videoExtensionCopy(locale).source
    : fr?'Draft à améliorer':es?'Draft para mejorar':'Draft to enhance';
  const sourceHint=operation==='luma-extend'
    ? fr?'Luma Extend nécessite une génération Ray 3.2 terminée de votre compte. Les vidéos importées ne sont pas compatibles.'
      : es?'Luma Extend requiere una generación Ray 3.2 completada de tu cuenta. Los vídeos subidos no son compatibles.'
      : 'Luma Extend requires a completed Ray 3.2 generation from your account. Uploaded videos are not supported.'
    : copy.hint;
  const signIn=fr?'Connectez-vous pour choisir une vidéo':es?'Inicia sesión para elegir un vídeo':'Sign in to choose a video';
  const [cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  const [candidate,setCandidate]=useState<OwnedGenerationSourceOption|null>(null);
  const epoch=useRef<object>({});
  const selectionRevision=useRef(0);
  const expectedParentSource=useRef(sourceJobId);
  const selectionRef=useRef(sourceJobId);
  selectionRef.current=sourceJobId;
  const controller=useRef<AbortController|null>(null);
  const context=`${account?.userId??''}:${operation}`;
  const currentContext=useRef(context);
  if(currentContext.current!==context){currentContext.current=context;epoch.current={};}

  async function request(url:string,method='GET') {
    const response=await fetch(url,{method,signal:controller.current?.signal,headers:account?{Authorization:`Bearer ${account.token}`}:{}});
    const data=await response.json();
    if(!response.ok||data.ok!==true)throw new Error('Source unavailable');
    return data;
  }
  async function load(next?:string) {
    if(!account)return;
    const active=epoch.current, revision=selectionRevision.current;
    const requestedSource=selectionRef.current;
    setBusy(true);setError(false);
    try {
      const base=`/api/jobs/source-options?operation=${operation}`;
      const page:OwnedGenerationSourcePage=await request(base+(next?`&cursor=${encodeURIComponent(next)}`:''));
      if(!next&&requestedSource&&!page.sources.some(source=>source.sourceJobId===requestedSource)) {
        const selected:OwnedGenerationSourcePage=await request(`${base}&sourceJobId=${encodeURIComponent(requestedSource)}`);
        page.sources.push(...selected.sources);
      }
      if(epoch.current!==active)return;
      setSources(previous=>next?[...previous,...page.sources.filter(source=>!previous.some(old=>old.sourceJobId===source.sourceJobId))]:page.sources);
      setCursor(page.nextCursor);
      if (!next && requestedSource && selectionRevision.current === revision && selectionRef.current === requestedSource) {
        const selected = page.sources.find(source => source.sourceJobId === requestedSource);
        if (selected?.preparation !== 'ready') {
          setCandidate(selected?.preparation === 'prepare' ? selected : null);
          expectedParentSource.current = '';
          onSelect(null);
        }
      }
    } catch {if(epoch.current===active)setError(true);}
    finally{if(epoch.current===active)setBusy(false);}
  }
  useEffect(()=>{
    const active={};epoch.current=active;controller.current=new AbortController();setSources([]);setCandidate(null);setCursor(null);void load();
    return()=>{controller.current?.abort();if(epoch.current===active)epoch.current={};};
    // Each account/operation owns its requests; selection changes use the current callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[context]);
  useEffect(() => {
    if (expectedParentSource.current === sourceJobId) return;
    expectedParentSource.current = sourceJobId;
    selectionRevision.current++;
    setCandidate(null);
    void load();
    // External recall/removal invalidates an in-flight selection; own selections retain pending preparation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceJobId]);
  function select(source:OwnedGenerationSourceOption|null) {
    selectionRevision.current++;
    setCandidate(source);
    const ready = source?.preparation === 'ready' ? source : null;
    expectedParentSource.current = ready?.sourceJobId ?? '';
    onSelect(ready);
  }
  async function prepare() {
    const selected=candidate??sources.find(source=>source.sourceJobId===sourceJobId);
    if(!selected||selected.preparation!=='prepare'||!account||busy)return;
    const active=epoch.current, revision=selectionRevision.current;setBusy(true);setError(false);
    try {
      const result=await request(`/api/jobs/${encodeURIComponent(selected.sourceJobId)}/draft-cache`,'POST');
      if(epoch.current!==active||selectionRevision.current!==revision)return;
      if(!result.enhanceable)throw new Error('Cache missing');
      const ready={...selected,preparation:'ready' as const};setSources(previous=>previous.map(source=>source.sourceJobId===ready.sourceJobId?ready:source));setCandidate(ready);expectedParentSource.current=ready.sourceJobId;onSelect(ready);
    } catch {if(epoch.current===active&&selectionRevision.current===revision){setError(true);expectedParentSource.current='';onSelect(null);}}
    finally {if(epoch.current===active)setBusy(false);}
  }
  const selected=candidate??sources.find(source=>source.sourceJobId===sourceJobId)??null;
  const content = <section data-testid="owned-generation-source-picker" data-operation={operation} className={compact?'space-y-3':'space-y-2 rounded-2xl border border-border p-3'}>
    {compact ? <p className="text-sm text-text-secondary">{sourceHint}</p> : null}
    {compact && !account ? <a className="app-reference-signin" href={authAction?.href ?? '/login?mode=signin&next=%2Fapp'}>{signIn}</a> : <>
    <label className="block text-sm font-medium">{copy.choose}
      <select aria-label={copy.choose} className="mt-2 block w-full rounded-lg border border-border bg-surface p-2" disabled={!account||busy}
        value={selected?.sourceJobId??''} onChange={event=>void select(sources.find(source=>source.sourceJobId===event.target.value)??null)}>
        <option value="">{copy.none}</option>
        {sources.map(source=><option key={source.sourceJobId} value={source.sourceJobId} disabled={source.preparation==='unavailable'}>{source.label} · {new Date(source.createdAt).toLocaleDateString(locale)}{source.durationSec?` · ${source.durationSec}s`:''}{source.preparation==='unavailable'?` · ${fr?'Indisponible':es?'No disponible':'Unavailable'}`:''}</option>)}
      </select>
    </label>
    <p className="text-xs text-text-secondary">{copy.hint}</p>
    {account&&!busy&&!sources.length?<p role="status">{copy.empty}</p>:null}
    {busy?<p role="status">{candidate?.preparation==='prepare'?copy.preparing:copy.loading}</p>:null}
    {error?<p role="alert">{candidate?copy.unavailable:copy.error}</p>:null}
    <div className="flex flex-wrap gap-3">
      {selected?.preparation==='prepare'?<button data-testid="prepare-owned-draft" type="button" disabled={busy} onClick={()=>void prepare()}>{copy.prepare}</button>:null}
      {selected?<button type="button" disabled={busy} onClick={()=>void select(null)}>{copy.clear}</button>:null}
      {cursor||error?<button type="button" disabled={busy} onClick={()=>void load(cursor??undefined)}>{copy.more}</button>:null}
    </div>
    </>}
  </section>;
  if(!compact)return content;
  return <div className="app-workspace-references" data-compact-references>
    <button type="button" className="app-reference-command" data-owned-source-trigger={operation}
      aria-haspopup="dialog" aria-expanded={open} onClick={event=>{event.currentTarget.focus();setOpen(true);}}>
      <span className="app-reference-command-media"><AppGlyph name="video" /></span>
      <span className="app-reference-command-label">{sourceLabel}</span>
      <small>{sourceJobId?'1/1':referenceCopy.required}</small>
    </button>
    {open ? <WorkspaceReferencePopup singleRole title={sourceLabel} closeLabel={referenceCopy.close} onClose={()=>setOpen(false)}>
      {content}
    </WorkspaceReferencePopup> : null}
  </div>;
}
