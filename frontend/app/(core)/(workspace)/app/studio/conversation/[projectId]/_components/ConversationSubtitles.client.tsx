'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import type {WorkspaceTimelineItem} from '../../../_shared/_lib/workspace-types';
import type {ConversationTimelineCommand} from '@/lib/studio/conversation-timeline-editing';
import {SubtitleOverlay} from '@/lib/subtitles/SubtitleOverlay';
import type {SubtitleDocument} from '@/lib/subtitles/document';
import type {ConversationTimelineView} from '../_hooks/useConversationTimeline';
import {TimelineSubtitleOverlay} from '@/lib/subtitles/TimelineSubtitleOverlay';

type Summary={id:string;revision:number;language:string;segmentCount:number};
export function ConversationSubtitlePicker({clip,busy,edit,locale}:{clip:WorkspaceTimelineItem;busy:boolean;edit:(edit:ConversationTimelineCommand['edit'])=>Promise<void>;locale:string}){
  const [documents,setDocuments]=useState<Summary[]|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(false);
  const current=useRef(clip.id);current.current=clip.id;
  useEffect(()=>{setDocuments(null);setError(false);setLoading(false);},[clip.id]);
  const t=(en:string,fr:string,es:string)=>locale==='fr'?fr:locale==='es'?es:en;
  if(!clip.ref||clip.mediaKind==='image')return null;
  async function open(){
    const id=clip.id;setLoading(true);setError(false);
    try{const response=await fetch('/api/tools/subtitles/documents?source='+encodeURIComponent(JSON.stringify(clip.ref)),{cache:'no-store'});const data=await response.json();if(!response.ok||!data.ok)throw new Error('READ_FAILED');if(current.current===id)setDocuments(data.documents);}
    catch{if(current.current===id)setError(true);}finally{if(current.current===id)setLoading(false);}
  }
  return <>
    <button disabled={busy||loading} onClick={()=>void open()}>{t('Subtitles','Sous-titres','Subtítulos')}{clip.subtitle?` · v${clip.subtitle.revision}`:''}</button>
    {documents&&<label>{t('Caption document','Document de sous-titres','Documento de subtítulos')} <select disabled={busy} value={clip.subtitle?`${clip.subtitle.documentId}:${clip.subtitle.revision}`:''} onChange={event=>{const selected=documents.find(doc=>`${doc.id}:${doc.revision}`===event.target.value);void edit({kind:'subtitles',clipId:clip.id,documentId:selected?.id??null,...selected?{revision:selected.revision}:{}});}}>
      <option value="">{t('None','Aucun','Ninguno')}</option>
      {clip.subtitle&&!documents.some(doc=>doc.id===clip.subtitle?.documentId&&doc.revision===clip.subtitle.revision)&&<option value={`${clip.subtitle.documentId}:${clip.subtitle.revision}`}>{t('Attached revision','Révision attachée','Revisión adjunta')} v{clip.subtitle.revision}</option>}
      {documents.map(doc=><option key={doc.id} value={`${doc.id}:${doc.revision}`}>{doc.language} · {doc.segmentCount} {t('captions','sous-titres','subtítulos')} · v{doc.revision}</option>)}
    </select></label>}
    {documents?.length===0&&<Link href="/app/tools/subtitles">{t('Create subtitles for this source','Créer les sous-titres de cette source','Crear subtítulos para esta fuente')}</Link>}
    {clip.subtitle&&<small>{t('Pinned revision; source captions follow trims.','Révision figée ; les sous-titres source suivent les coupes.','Revisión fija; los subtítulos siguen los recortes.')}</small>}
    {error&&<small role="alert">{t('Could not load subtitles. Retry.','Chargement impossible. Réessayez.','No se pudieron cargar. Reintenta.')}</small>}
  </>;
}
export function ConversationSubtitlePreview({items,timeMs,document}:{items:WorkspaceTimelineItem[];timeMs:number;document?:SubtitleDocument|null}){
  const element=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:0,height:0});
  useEffect(()=>{const node=element.current;if(!node)return;const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(node);return()=>observer.disconnect();},[]);
  return <div ref={element} style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:100}}>{size.width>0&&(document?<SubtitleOverlay document={document} timeMs={timeMs} {...size}/>:<TimelineSubtitleOverlay items={items} timeMs={timeMs} {...size}/>)}</div>;
}

export function ConversationSequenceSubtitles({projectId,sequenceId,revision,busy,edit,locale,attached}:{projectId:string;sequenceId:string;revision:number;busy:boolean;edit:(edit:ConversationTimelineCommand['edit'])=>Promise<void>;locale:string;attached?:ConversationTimelineView['sequenceSubtitle']}){
  const [documents,setDocuments]=useState<Summary[]|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(false);
  const current=useRef(sequenceId);current.current=sequenceId;
  useEffect(()=>{setDocuments(null);setError(false);setLoading(false);},[sequenceId]);
  const t=(en:string,fr:string,es:string)=>locale==='fr'?fr:locale==='es'?es:en;
  async function open(){
    const id=sequenceId;setLoading(true);setError(false);
    try{const response=await fetch('/api/tools/subtitles/documents?sequence='+encodeURIComponent(id),{cache:'no-store'});const data=await response.json();if(!response.ok||!data.ok)throw new Error('READ_FAILED');if(current.current===id)setDocuments(data.documents);}
    catch{if(current.current===id)setError(true);}finally{if(current.current===id)setLoading(false);}
  }
  const pinned=attached?.reference;
  return <>
    <Link href={'/app/tools/subtitles?project='+encodeURIComponent(projectId)+'&sequence='+encodeURIComponent(sequenceId)+'&sequenceRevision='+revision}>{t('Subtitle the film mix','Sous-titrer le mix du film','Subtitular la mezcla del film')}</Link>
    <button disabled={busy||loading} onClick={()=>void open()}>{t('Film subtitles','Sous-titres du film','Subtítulos del film')}{pinned?` · v${pinned.revision}`:''}</button>
    {documents&&<label>{t('Film caption document','Sous-titres de la séquence','Subtítulos de la secuencia')} <select disabled={busy} value={pinned?`${pinned.documentId}:${pinned.revision}`:''} onChange={event=>{const selected=documents.find(doc=>`${doc.id}:${doc.revision}`===event.target.value);void edit({kind:'sequence-subtitles',documentId:selected?.id??null,...selected?{revision:selected.revision}:{}});}}>
      <option value="">{t('None','Aucun','Ninguno')}</option>
      {pinned&&!documents.some(doc=>doc.id===pinned.documentId&&doc.revision===pinned.revision)&&<option value={`${pinned.documentId}:${pinned.revision}`}>{t('Attached revision','Révision attachée','Revisión adjunta')} v{pinned.revision}</option>}
      {documents.map(doc=><option key={doc.id} value={`${doc.id}:${doc.revision}`}>{doc.language} · {doc.segmentCount} · v{doc.revision}</option>)}
    </select></label>}
    {attached?.stale&&<small role="alert">{t('The audio mix changed. Create new subtitles or remove the attachment to export.','Le mix audio a changé. Créez de nouveaux sous-titres ou retirez cette attache pour exporter.','La mezcla de audio cambió. Crea nuevos subtítulos o retira el documento para exportar.')}</small>}
    {error&&<small role="alert">{t('Could not load subtitles. Retry.','Chargement impossible. Réessayez.','No se pudieron cargar. Reintenta.')}</small>}
  </>;
}
