'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight,Check,MessageSquare,Pencil,X} from 'lucide-react';
import type {StudioProjectSummary} from '@/lib/studio/conversation-projects';
import {studioProjectNameSchema} from '@/lib/studio/conversation-project-title';
import {authFetch} from '@/lib/authFetch';
import {studioProjectEntryUrl} from '../_lib/studio-conversation-entry';
import styles from './conversation-projects.module.css';

type Saved={projectId:string;name:string;updatedAt:string};
export function ConversationProjectRow({project,current,locale,onOpen,onSaved}:{project:StudioProjectSummary;current:boolean;locale:string;onOpen:()=>void;onSaved:(result:Saved)=>void}){
  const t=(en:string,fr:string)=>locale==='fr'?fr:en;
  const [editing,setEditing]=useState(false),[value,setValue]=useState(project.name),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  const opener=useRef<HTMLButtonElement>(null),wasEditing=useRef(false),field=useRef<HTMLInputElement>(null),mounted=useRef(true),active=useRef<AbortController|null>(null),attempt=useRef<{name:string;idempotencyKey:string}|null>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current?.abort();active.current=null;};},[]);
  useEffect(()=>{if(editing){field.current?.focus();field.current?.select();}else if(wasEditing.current)opener.current?.focus();wasEditing.current=editing;},[editing]);
  function cancel(){active.current?.abort();active.current=null;setBusy(false);setEditing(false);setError(false);}
  async function save(){
    if(active.current)return;
    const parsed=studioProjectNameSchema.safeParse(value);if(!parsed.success){setError(true);return;}
    if(attempt.current?.name!==parsed.data)attempt.current={name:parsed.data,idempotencyKey:'studio-rename-'+crypto.randomUUID()};
    const controller=new AbortController();active.current=controller;setBusy(true);setError(false);
    const timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await authFetch('/api/studio/conversation-projects',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:project.id,...attempt.current}),signal:controller.signal});
      const body=await response.json();
      if(!response.ok||!body.ok||body.result?.projectId!==project.id||!studioProjectNameSchema.safeParse(body.result.name).success||!Number.isFinite(Date.parse(body.result.updatedAt)))throw new Error('RENAME_UNAVAILABLE');
      if(mounted.current&&active.current===controller){onSaved(body.result);setEditing(false);attempt.current=null;}
    }catch{if(mounted.current&&active.current===controller)setError(true);}
    finally{clearTimeout(timeout);if(mounted.current&&active.current===controller){active.current=null;setBusy(false);}}
  }
  return <div className={styles.projectRow}>
    {editing?<form className={styles.rename} onSubmit={event=>{event.preventDefault();void save();}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();}}}>
      <input ref={field} aria-label={t('Project name','Nom du projet')} maxLength={200} value={value} disabled={busy} onChange={event=>setValue(event.target.value)} onInput={event=>setValue(event.currentTarget.value)}/>
      <button type="submit" disabled={busy||!value.trim()} aria-label={t('Save project name','Enregistrer le nom')}><Check size={16}/></button>
      <button type="button" onClick={cancel} aria-label={t('Cancel renaming','Annuler le renommage')}><X size={16}/></button>
      {error&&<small role="alert">{t('Could not save this name. Use a single line and try again.','Impossible d’enregistrer ce nom. Utilisez une seule ligne puis réessayez.')}</small>}
    </form>:<>
      <Link data-project-row href={studioProjectEntryUrl(project)} prefetch={false} aria-current={current?'page':undefined} onClick={onOpen}>
        <MessageSquare size={16} strokeWidth={1.4}/><span><strong>{project.name}</strong><small>{t('Conversation','Conversation')} · {new Intl.DateTimeFormat(locale,{month:'short',day:'numeric'}).format(new Date(project.updatedAt))}</small></span>{current?<Check size={14}/>:<ArrowUpRight size={14}/>}
      </Link>
      <button ref={opener} className={styles.renameButton} aria-label={t('Rename '+project.name,'Renommer '+project.name)} onClick={()=>{setValue(project.name);setEditing(true);setError(false);}}><Pencil size={14} strokeWidth={1.5}/></button>
    </>}
  </div>;
}
