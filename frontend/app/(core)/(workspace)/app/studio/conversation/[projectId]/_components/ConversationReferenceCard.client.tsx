'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowUpLeft, Check, Expand, Film, Image as ImageIcon, Music2, RefreshCw, ListVideo} from 'lucide-react';
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
import type {ConversationReferencePreview} from '@/lib/studio/conversation-reference-previews';
import {MEDIA_SHELF_DRAG_TYPE,shelfTimelineAsset, type ShelfMedia} from '../_lib/conversation-media-shelf';
import type {ImageLibraryAsset} from '@/lib/studio/image-library';
import {ConversationReferenceLightbox} from './ConversationReferenceLightbox.client';
import styles from '../conversation-media-shelf.module.css';

export function ConversationReferenceCard({projectId, item, active, compact, attached, locale, onSelect, onMention, onAttach, onDetach,onInsert}: {
  projectId: string; item: ShelfMedia; active: boolean; compact: boolean; attached: boolean; locale: ConversationLocale;
  onSelect: () => void; onMention: () => void; onAttach: () => void; onDetach: () => void;
  onInsert?: (asset:ImageLibraryAsset)=>void;
}) {
  const t = (en: string, fr: string) => locale === 'fr' ? fr : en;
  const [preview, setPreview] = useState<ConversationReferencePreview | null>(null);
  const [failed, setFailed] = useState(false), [retry, setRetry] = useState(0), [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(false), [ratio, setRatio] = useState(1.25);
  const access = useRef<ConversationReferencePreview | null>(null);
  const card = useRef<HTMLElement>(null);
  const player = useRef<HTMLMediaElement | null>(null);
  const enlargeTrigger = useRef<HTMLButtonElement>(null);
  const kind = item.kind??'image';
  useEffect(() => {
    const cached = access.current;
    if (cached && (!cached.expiresAt || Date.parse(cached.expiresAt) > Date.now() + 15000)) return;
    const controller = new AbortController();
    setLoading(true); setFailed(false);
    void fetch('/api/studio/projects/' + encodeURIComponent(projectId) + '/reference-previews', {
      method: 'POST', headers: {'content-type': 'application/json'}, cache: 'no-store', signal: controller.signal,
      body: JSON.stringify({refs: [{type: 'asset', assetId: item.assetId, kind}]}),
    }).then(async response => {
      const data = await response.json(), asset = data.assets?.[0];
      if (!response.ok || !data.ok || asset?.assetId !== item.assetId || !asset.url) throw new Error('PREVIEW_UNAVAILABLE');
      if (!controller.signal.aborted) {access.current = asset; setPreview(asset);}
    }).catch(() => {if (!controller.signal.aborted) setFailed(true);})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [projectId, item.assetId, kind, retry, active, compact]);
  useEffect(() => {
    function pause() {if (document.hidden) player.current?.pause();}
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  useEffect(() => {
    if (active && !compact && window.matchMedia('(max-width: 1100px)').matches)
      card.current?.scrollIntoView({block: 'nearest', inline: 'center', behavior: 'instant'});
  }, [active, compact]);
  function failPreview() {access.current = null; setFailed(true);}
  const icon = kind === 'video' ? <Film size={22}/> : kind === 'audio' ? <Music2 size={22}/> : <ImageIcon size={22}/>;
  const imageUrl = preview && (preview.thumbUrl || (kind === 'image' ? preview.url : null));
  const showPlayer = active && !compact && preview && !failed && !loading && kind !== 'image';
  return <article ref={card} className={styles.card} data-media-card={item.assetId} data-selected={active} data-compact={compact}>
    <div className={styles.surface} style={{aspectRatio: Math.min(1.85, Math.max(.78, ratio))}} aria-busy={loading}>
      {showPlayer ? kind === 'video' ? <video key={preview.url} ref={node => {player.current = node;}} src={preview.url} poster={preview.thumbUrl ?? undefined} controls playsInline preload="none" aria-label={item.label} onError={failPreview}/> : <div className={styles.audio}>{icon}<audio key={preview.url} ref={node => {player.current = node;}} src={preview.url} controls preload="none" aria-label={item.label} onError={failPreview}/></div> :
        <button className={styles.select} aria-label={t('Preview ', 'Aperçu de ') + item.label} aria-pressed={active} onClick={onSelect} draggable
          onDragStart={event => {event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData(MEDIA_SHELF_DRAG_TYPE, item.assetId);}}>
          {imageUrl && !failed ? <img src={imageUrl} alt={item.name ?? item.label} draggable={false} onLoad={event => {const image = event.currentTarget; if (image.naturalHeight) setRatio(image.naturalWidth / image.naturalHeight);}} onError={failPreview}/> : <span className={styles.placeholder}>{icon}{!compact && <small>{loading ? t('Opening…', 'Ouverture…') : failed ? t('Preview unavailable', 'Aperçu indisponible') : item.label}</small>}</span>}
        </button>}
      {attached && <span className={styles.attachedMark} aria-label={t('Attached', 'Joint')}><Check size={11}/></span>}
    </div>
    {!compact && <div className={styles.caption}>
      <span className={styles.captionLabel} title={item.name}>{item.label}</span>
      {active && <div className={styles.actions}>
        <button onClick={onMention} aria-label={t('Mention in message', 'Citer dans le message')} title={t('Mention in message', 'Citer dans le message')}><ArrowUpLeft size={16}/></button>
        {onInsert&&<button onClick={()=>onInsert(shelfTimelineAsset(item,preview))} aria-label={t('Add to timeline','Ajouter à la timeline')} title={t('Add to timeline','Ajouter à la timeline')}><ListVideo size={16}/></button>}
        {kind === 'image' && preview && !failed && <button ref={enlargeTrigger} onClick={() => setLightbox(true)} aria-label={t('Enlarge ', 'Agrandir ') + item.label} title={t('Enlarge', 'Agrandir')}><Expand size={14}/></button>}
        <button aria-pressed={attached} aria-label={t('Include in next message', 'Joindre au prochain message')} title={t('Include in next message', 'Joindre au prochain message')} onClick={attached ? onDetach : onAttach}><Check size={15}/></button>
        {failed && <button onClick={() => {access.current = null; setRetry(value => value + 1);}} aria-label={t('Try again', 'Réessayer')}><RefreshCw size={14}/></button>}
      </div>}
    </div>}
    {lightbox && preview && <ConversationReferenceLightbox url={preview.url} label={item.label} locale={locale} trigger={enlargeTrigger} onClose={() => setLightbox(false)}/>}
  </article>;
}
