'use client';
import { useEffect, useRef, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import type { SubtitleSource } from '@/lib/subtitles/document';
import { creatorWorkspaceCopy } from './creator-workspace-copy';
import styles from './creator-workspace.module.css';
type DocumentSummary = {id:string;revision:number;language:string;segmentCount:number;source:SubtitleSource};
export function SubtitleRecentDocuments({userId,locale,disabled,onOpen}: {userId?:string;locale:string;disabled:boolean;onOpen(id:string):void}) {
  const copy=creatorWorkspaceCopy(locale), [documents,setDocuments]=useState<DocumentSummary[] | null>(null), [busy,setBusy]=useState(false), [failed,setFailed]=useState(false);
  const active=useRef(true), lock=useRef(false);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  async function load() {
    if(!userId || lock.current)return;
    lock.current=true;setBusy(true);setFailed(false);
    try {
      const response=await authFetch('/api/tools/subtitles/documents?limit=30'),data=await response.json();
      if(!response.ok || !data.ok || !Array.isArray(data.documents))throw new Error('DOCUMENTS_UNAVAILABLE');
      if(active.current)setDocuments(data.documents);
    }catch{if(active.current)setFailed(true);}
    finally{lock.current=false;if(active.current)setBusy(false);}
  }
  if(!userId)return null;
  return <section className={styles.documentList}>
    <button type="button" disabled={busy || disabled} onClick={()=>void load()}>{busy?copy.loading:copy.recentDocuments}</button>
    {failed?<p role="alert">{copy.error}</p>:null}
    {documents?.length===0?<p role="status">{copy.noDocuments}</p>:null}
    {documents?.length?<ul>{documents.map(document=><li key={document.id}><button type="button" disabled={disabled || busy} onClick={()=>onOpen(document.id)}>
      {copy.openDocument} · {document.language.toUpperCase()} · {copy.savedRevision} {document.revision}<br/>
      <small>{document.source.ref.kind==='audio'?copy.audio:copy.video} · {Math.round(document.source.durationMs/1000)} {copy.seconds} · {document.segmentCount} {copy.transcript.toLowerCase()}</small>
    </button></li>)}</ul>:null}
  </section>;
}
