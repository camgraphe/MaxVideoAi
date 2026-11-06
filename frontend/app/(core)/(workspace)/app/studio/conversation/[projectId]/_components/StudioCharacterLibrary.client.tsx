'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { LibraryImageThumbnail } from '@/components/library/LibraryImageThumbnail.client';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import type { ImageLibraryAsset } from '@/lib/studio/image-library';
import styles from './image-reference-library.module.css';

type Portrait = {url:string;thumbUrl:string};
type Character = {id:string;name:string;identity:Portrait};
type LibraryPage = {characters:(Character & {lookCount:number})[];nextCursor:string|null};
type CharacterPage = Character & {looks:(Portrait & {id:string;name:string})[];nextLookCursor:string|null};
type Selection = {lookId:string|null;name:string};

export function StudioCharacterLibrary({accountKey,projectId,locale,onSelect}: {
  accountKey:string;projectId:string;locale:'en'|'fr'|'es';onSelect:(asset:ImageLibraryAsset)=>void;
}) {
  const endpoint = '/api/studio/projects/'+encodeURIComponent(projectId)+'/characters';
  const [page,setPage] = useState<LibraryPage|null>(null);
  const [detail,setDetail] = useState<CharacterPage|null>(null);
  const [query,setQuery] = useState('');
  const [name,setName] = useState('');
  const [selection,setSelection] = useState<Selection|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState(false);
  const active = useRef<AbortController|null>(null);
  const t = (en:string,fr:string,es:string) => locale==='fr' ? fr : locale==='es' ? es : en;
  const request = useCallback(async <T,>(params:URLSearchParams,body:object|undefined,receive:(result:T)=>void) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError(false);
    try {
      const response = await ownedAuthFetch(params.size?endpoint+'?'+params:endpoint,accountKey,{
        signal:controller.signal,cache:'no-store',
        ...(body ? {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)} : {}),
      });
      const data = await response.json() as {ok:boolean;result:T};
      if (!response.ok || !data.ok) throw new Error('CHARACTER_UNAVAILABLE');
      if (!controller.signal.aborted) receive(data.result);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  },[accountKey,endpoint]);

  useEffect(() => {
    const params = new URLSearchParams(name ? {search:name} : {});
    setPage(null);
    setDetail(null);
    setSelection(null);
    void request<LibraryPage>(params,undefined,setPage);
    return () => active.current?.abort();
  },[name,request]);

  function open(characterId:string) {
    setSelection(null);
    void request<CharacterPage>(new URLSearchParams({characterId}),undefined,setDetail);
  }
  function more() {
    if (detail?.nextLookCursor) {
      void request<CharacterPage>(new URLSearchParams({characterId:detail.id,lookCursor:detail.nextLookCursor}),undefined,
        next=>setDetail({...next,looks:[...detail.looks,...next.looks]}));
    } else if (page?.nextCursor) {
      void request<LibraryPage>(new URLSearchParams({...(name?{search:name}:{}),cursor:page.nextCursor}),undefined,
        next=>setPage({...next,characters:[...page.characters,...next.characters]}));
    }
  }
  function card(name:string,portrait:Portrait,id:string,onClick:()=>void,selected?:boolean) {
    return <button type="button" className={styles.card} key={id} disabled={busy} onClick={onClick} aria-pressed={selected}>
      <span className={styles.preview}><LibraryImageThumbnail asset={{...portrait,kind:'image'}} alt="" /></span>
      <span className={styles.cardInfo}><strong title={name}>{name}</strong></span>
    </button>;
  }
  const identity = t('Saved identity','Identité sauvegardée','Identidad guardada');
  return <>
    <div className={styles.controls}>
      {detail ? <div className={styles.toolbar}>
        <button type="button" className={styles.more} disabled={busy} onClick={()=>{setDetail(null);setSelection(null);setError(false);}}>
          {t('Back to characters','Retour aux personnages','Volver a los personajes')}
        </button>
        <strong>{detail.name}</strong>
      </div> : <form className={styles.filterRow} onSubmit={event=>{
        event.preventDefault();
        const next = query.trim();
        if (next!==name) setName(next);
        else if (!page) void request<LibraryPage>(new URLSearchParams(name?{search:name}:{}),undefined,setPage);
      }}>
        <label className={styles.search}><Search size={16} aria-hidden="true" /><input aria-label={t('Character name','Nom du personnage','Nombre del personaje')}
          placeholder={t('Search by name','Rechercher par nom','Buscar por nombre')} value={query} onChange={event=>setQuery(event.target.value)} maxLength={80} /></label>
        <button type="submit" className={styles.more} disabled={busy}>{t('Search','Rechercher','Buscar')}</button>
      </form>}
    </div>
    <div className={styles.gallery} aria-busy={busy}>
      {busy && <p className={styles.status} role="status">{t('Loading saved characters…','Chargement des personnages…','Cargando personajes guardados…')}</p>}
      {error && <p className={styles.error} role="alert">{t('The character library could not complete this action. Try again.','La bibliothèque de personnages n’a pas pu terminer cette action. Réessayez.','La biblioteca de personajes no pudo completar la acción. Inténtalo de nuevo.')}</p>}
      {detail ? <div className={styles.grid}>
        {card(identity,detail.identity,'identity',()=>setSelection({lookId:null,name:detail.name}),selection?.lookId===null)}
        {detail.looks.map(look=>card(look.name,look,look.id,()=>setSelection({lookId:look.id,name:detail.name+' · '+look.name}),selection?.lookId===look.id))}
      </div> : page?.characters.length ? <div className={styles.grid}>
        {page.characters.map(character=>card(character.name,character.identity,character.id,()=>open(character.id)))}
      </div> : !busy && !error && <p className={styles.empty}>{t('No matching saved characters.','Aucun personnage sauvegardé correspondant.','No hay personajes guardados que coincidan.')}</p>}
      {(detail ? detail.nextLookCursor : page?.nextCursor) && <button type="button" className={styles.more} disabled={busy} onClick={more}>{t('Load more','Voir la suite','Cargar más')}</button>}
    </div>
    <footer className={styles.footer}>
      <div className={styles.selection} aria-live="polite">{selection?.name ?? t('Choose the identity or a saved look','Choisissez l’identité ou un look sauvegardé','Elige la identidad o un look guardado')}</div>
      <button type="button" className={styles.add} disabled={!selection||!detail||busy} onClick={()=>{
        if (selection && detail && !busy) void request<ImageLibraryAsset>(new URLSearchParams(),{characterId:detail.id,lookId:selection.lookId},onSelect);
      }}>{t('Add to conversation','Ajouter à la conversation','Añadir a la conversación')}</button>
    </footer>
  </>;
}
