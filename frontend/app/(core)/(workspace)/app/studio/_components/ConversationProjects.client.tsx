'use client';

import {useEffect,useId,useRef,useState,type RefObject} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArrowUpRight,Check,FolderOpen,MessageSquare,Plus,Search,X} from 'lucide-react';
import {studioProjectSummariesSchema,type StudioProjectSummary} from '@/lib/studio/conversation-projects';
import {studioProjectEntryUrl,studioConversationEntryCopy} from '../_lib/studio-conversation-entry';
import {useStudioProjectCreation} from '../_hooks/useStudioProjectCreation';
import styles from './conversation-projects.module.css';

type Props={accountKey:string;currentProjectId?:string;locale:string;disabled?:boolean};
export function ConversationProjects(props:Props) {
  const [open,setOpen]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null);
  const label=props.locale==='fr'?'Projets':'Projects';
  return <>
    <button ref={trigger} className={styles.trigger} aria-label={label} aria-haspopup="dialog" aria-expanded={open} disabled={props.disabled} onClick={()=>setOpen(true)}><FolderOpen size={15} strokeWidth={1.6}/><span>{label}</span></button>
    {open&&<ProjectDialog key={props.accountKey} {...props} trigger={trigger} onClose={()=>setOpen(false)}/>}
  </>;
}

function ProjectDialog({accountKey,currentProjectId,locale,trigger,onClose}:Props&{trigger:RefObject<HTMLButtonElement>;onClose:()=>void}) {
  const t=(en:string,fr:string)=>locale==='fr'?fr:en;
  const router=useRouter(),id=useId(),dialog=useRef<HTMLDialogElement>(null);
  const [projects,setProjects]=useState<StudioProjectSummary[]>([]),[query,setQuery]=useState(''),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  const creation=useStudioProjectCreation(accountKey,projectId=>router.push('/app/studio/conversation/'+encodeURIComponent(projectId)));
  const copy=studioConversationEntryCopy(locale);
  useEffect(()=>{const element=dialog.current,opener=trigger.current;element?.showModal();return()=>{element?.close();opener?.focus();};},[trigger]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setFailed(false);
    void fetch('/api/studio/conversation-projects',{cache:'no-store',signal:controller.signal}).then(async response=>{
      const body=await response.json(),parsed=studioProjectSummariesSchema.safeParse(body.projects);
      if(!response.ok||!body.ok||!parsed.success)throw new Error('PROJECTS_UNAVAILABLE');
      if(!controller.signal.aborted)setProjects(parsed.data);
    }).catch(()=>{if(!controller.signal.aborted)setFailed(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[accountKey,retry]);
  const visible=projects.filter(project=>project.persistenceMode==='connected'&&project.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={id} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <header><div><span className={styles.eyebrow}>STUDIO</span><h2 id={id}>{t('Your projects','Vos projets')}</h2></div><button autoFocus aria-label={t('Close projects','Fermer les projets')} onClick={onClose}><X size={18}/></button></header>
    <button className={styles.create} disabled={creation.busy} onClick={()=>void creation.create(copy.projectName)}><Plus size={17}/><span>{creation.busy?copy.opening:creation.error?copy.retry:t('New conversation','Nouvelle conversation')}</span><ArrowUpRight size={15}/></button>
    {creation.error&&<p role="alert" className={styles.error}>{copy[creation.error]}</p>}
    <label className={styles.search}><Search size={15}/><input type="search" aria-label={t('Search projects','Rechercher un projet')} placeholder={t('Find a project…','Retrouver un projet…')} value={query} onChange={event=>setQuery(event.target.value)} onInput={event=>setQuery(event.currentTarget.value)}/></label>
    <nav className={styles.list} aria-label={t('Saved projects','Projets enregistrés')} aria-busy={loading}>
      {loading?<p role="status">{t('Opening your projects…','Ouverture de vos projets…')}</p>:failed?<div role="alert"><p>{t('Your projects could not be loaded.','Vos projets n’ont pas pu être chargés.')}</p><button onClick={()=>setRetry(value=>value+1)}>{copy.retry}</button></div>:visible.length?visible.map(project=><Link key={project.id} data-project-row href={studioProjectEntryUrl(project)} prefetch={false} aria-current={project.id===currentProjectId?'page':undefined} onClick={onClose}>
        <MessageSquare size={16} strokeWidth={1.4}/><span><strong>{project.name}</strong><small>{t('Conversation','Conversation')} · {new Intl.DateTimeFormat(locale,{month:'short',day:'numeric'}).format(new Date(project.updatedAt))}</small></span>{project.id===currentProjectId?<Check size={14}/>:<ArrowUpRight size={14}/>}</Link>):<p>{query?t('No matching project.','Aucun projet correspondant.'):t('Your conversations will live here.','Vos conversations se retrouveront ici.')}</p>}
    </nav>
    <footer><small>{t('Your work stays saved as you create.','Votre travail est enregistré au fil de la création.')}</small></footer>
  </dialog>;
}
