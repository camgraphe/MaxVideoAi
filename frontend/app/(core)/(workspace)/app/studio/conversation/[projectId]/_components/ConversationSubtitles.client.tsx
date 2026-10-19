'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import type {WorkspaceTimelineItem} from '../../../_shared/_lib/workspace-types';
import type {ConversationTimelineCommand} from '@/lib/studio/conversation-timeline-editing';
import {TimelineSubtitleOverlay} from '@/lib/subtitles/TimelineSubtitleOverlay';

type Summary={id:string;revision:number;language:string;segmentCount:number};
export function ConversationSubtitlePicker({clip,busy,edit,locale}:{clip:WorkspaceTimelineItem;busy:boolean;edit:(edit:ConversationTimelineCommand['edit'])=>Promise<void>;locale:string}){
  const [documents,setDocuments]=useState<Summary[]|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(false);
  const current=useRef(clip.id);current.current=clip.id;
  useEffect(()=>{setDocuments(null);setError(false);},[clip.id]);
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
export function ConversationSubtitlePreview({items,timeMs}:{items:WorkspaceTimelineItem[];timeMs:number}){
  const element=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:0,height:0});
  useEffect(()=>{const node=element.current;if(!node)return;const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(node);return()=>observer.disconnect();},[]);
  return <div ref={element} style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:100}}>{size.width>0&&<TimelineSubtitleOverlay items={items} timeMs={timeMs} {...size}/>}</div>;
}
