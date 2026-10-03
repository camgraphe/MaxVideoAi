'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpLeft,Check,ChevronRight,Film,Image as ImageIcon,Music2,PanelRightClose,PanelRightOpen,RefreshCw} from 'lucide-react';
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
import {MEDIA_SHELF_DRAG_TYPE,type ShelfMedia} from '../_lib/conversation-media-shelf';
import styles from '../conversation-media-shelf.module.css';

type Preview={assetId:string;kind:'image'|'video'|'audio';url:string;thumbUrl:string|null;expiresAt:string|null};
export function ConversationMediaShelf({projectId,items,selectedId,expanded,attachedIds,locale,onSelect,onToggle,onMention,onAttach,onDetach}:{
  projectId:string;items:ShelfMedia[];selectedId:string|null;expanded:boolean;attachedIds:string[];locale:ConversationLocale;
  onSelect:(id:string)=>void;onToggle:()=>void;onMention:(item:ShelfMedia)=>void;onAttach:(item:ShelfMedia)=>void;onDetach:(item:ShelfMedia)=>void;
}) {
  const t=(en:string,fr:string)=>locale==='fr'?fr:en;
  const selected=items.find(item=>item.assetId===selectedId)??items.at(-1);
  const [cache,setCache]=useState<Record<string,Preview>>({}),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0),[loading,setLoading]=useState(false);
  const previews=useRef(cache);
  const player=useRef<HTMLMediaElement|null>(null);
  const kind=selected?.kind??'image';
  const activeId=selected?.assetId;
  const preview=selected?cache[selected.assetId]:undefined;
  useEffect(()=>{
    function pause(){if(document.hidden)player.current?.pause();}
    document.addEventListener('visibilitychange',pause);
    return()=>document.removeEventListener('visibilitychange',pause);
  },[]);
  useEffect(()=>{
    if(!activeId||!expanded)return;
    const saved=previews.current[activeId];
    if(saved&&(!saved.expiresAt||Date.parse(saved.expiresAt)>Date.now()+15000)&&retry===0){setFailed(false);setLoading(false);return;}
    const controller=new AbortController();setLoading(true);setFailed(false);
    void fetch(`/api/studio/projects/${encodeURIComponent(projectId)}/reference-previews`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({refs:[{type:'asset',assetId:activeId,kind}]}),signal:controller.signal,cache:'no-store'})
      .then(async response=>{const data=await response.json();const asset=data.assets?.[0];if(!response.ok||!data.ok||asset?.assetId!==activeId||!asset.url)throw new Error('PREVIEW_UNAVAILABLE');if(!controller.signal.aborted){previews.current={...previews.current,[asset.assetId]:asset};setCache(previews.current);}})
      .catch(()=>{if(!controller.signal.aborted)setFailed(true);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[projectId,activeId,kind,expanded,retry]);
  if(!items.length||!selected)return null;
  function icon(item:ShelfMedia){return item.kind==='video'?<Film size={18}/>:item.kind==='audio'?<Music2 size={18}/>:<ImageIcon size={18}/>;}
  return <aside className={styles.shelf} data-expanded={expanded} aria-label={t('Media panel','Panneau médias')}>
    <div className={styles.heading}>
      {expanded&&<div><span className={styles.kicker}>{t('AT HAND','À PORTÉE DE MAIN')}</span><h2>{t('Media','Médias')}<span>{items.length}</span></h2></div>}
      <button onClick={onToggle} aria-label={expanded?t('Collapse media','Réduire les médias'):t('Open media','Ouvrir les médias')} aria-expanded={expanded} aria-controls="studio-media-shelf-content">{expanded?<PanelRightClose size={18}/>:<PanelRightOpen size={18}/>}</button>
    </div>
    {expanded?<div id="studio-media-shelf-content" className={styles.content}>
      <div className={styles.tiles} aria-label={t('Your references','Vos références')}>
        {items.map(item=><button key={item.assetId} draggable aria-label={t('Preview ','Aperçu de ')+item.label} aria-pressed={selected.assetId===item.assetId} onClick={()=>onSelect(item.assetId)}
          onDragStart={event=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData(MEDIA_SHELF_DRAG_TYPE,item.assetId);}}>
          {cache[item.assetId]?.thumbUrl||item.kind!=='video'&&item.kind!=='audio'&&cache[item.assetId]?.url?<img src={cache[item.assetId].thumbUrl??cache[item.assetId].url} alt="" draggable={false}/>:icon(item)}
          <span>{item.label}</span>{attachedIds.includes(item.assetId)&&<Check className={styles.attachedMark} size={13} aria-label={t('Attached','Joint')}/>}
        </button>)}
      </div>
      <div className={styles.preview} aria-busy={loading}>
        {loading?<span role="status">{t('Opening preview…','Ouverture de l’aperçu…')}</span>:failed?<div role="status"><p>{t('Preview unavailable','Aperçu indisponible')}</p><button onClick={()=>setRetry(value=>value+1)}><RefreshCw size={14}/>{t('Try again','Réessayer')}</button></div>:preview?<>
          {kind==='image'?<img key={preview.url} src={preview.url} alt={selected.name??selected.label} onError={()=>setFailed(true)}/>:kind==='video'?<video key={preview.url} ref={node=>{player.current=node;}} src={preview.url} poster={preview.thumbUrl??undefined} controls playsInline preload="none" aria-label={selected.label} onError={()=>setFailed(true)}/>:<div className={styles.audio}><Music2 size={32}/><audio key={preview.url} ref={node=>{player.current=node;}} src={preview.url} controls preload="none" aria-label={selected.label} onError={()=>setFailed(true)}/></div>}
        </>:icon(selected)}
      </div>
      <div className={styles.caption}><strong>{selected.label}</strong>{selected.name&&<span title={selected.name}>{selected.name}</span>}</div>
      <div className={styles.actions}>
        <button onClick={()=>onMention(selected)}><ArrowUpLeft size={16}/>{t('Mention in message','Citer dans le message')}<ChevronRight size={14}/></button>
        <button aria-pressed={attachedIds.includes(selected.assetId)} onClick={()=>attachedIds.includes(selected.assetId)?onDetach(selected):onAttach(selected)}><span className={styles.checkbox}>{attachedIds.includes(selected.assetId)&&<Check size={12}/>}</span>{t('Include in next message','Joindre au prochain message')}</button>
      </div>
      <p className={styles.hint}>{t('Drag a reference into your message to talk about it.','Glissez une référence dans votre message pour en parler.')}</p>
    </div>:<div className={styles.rail}>{items.slice(-3).map(item=><button key={item.assetId} aria-label={t('Preview ','Aperçu de ')+item.label} onClick={()=>{onSelect(item.assetId);onToggle();}}>{icon(item)}</button>)}</div>}
  </aside>;
}
