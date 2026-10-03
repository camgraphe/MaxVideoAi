'use client';

import {Layers3, Minus, Plus} from 'lucide-react';
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
import type {ShelfMedia} from '../_lib/conversation-media-shelf';
import {ConversationReferenceCard} from './ConversationReferenceCard.client';
import styles from '../conversation-media-shelf.module.css';

export function ConversationMediaShelf({projectId, items, selectedId, expanded, attachedIds, locale, onSelect, onToggle, onMention, onAttach, onDetach}: {
  projectId: string; items: ShelfMedia[]; selectedId: string | null; expanded: boolean; attachedIds: string[]; locale: ConversationLocale;
  onSelect: (id: string) => void; onToggle: () => void; onMention: (item: ShelfMedia) => void; onAttach: (item: ShelfMedia) => void; onDetach: (item: ShelfMedia) => void;
}) {
  const t = (en: string, fr: string) => locale === 'fr' ? fr : en;
  if (!items.length) return null;
  // Selection never rearranges visible references. Older media remain reachable.
  const selected = items.find(item => item.assetId === selectedId) ?? items.at(-1)!;
  const visible = items.slice(-4);
  if (!visible.some(item => item.assetId === selected.assetId)) visible[0] = selected;
  return <aside className={styles.shelf} data-expanded={expanded} aria-label={t('Media panel', 'Panneau médias')}>
    <div className={styles.heading}>
      {items.length > 4 ? <label className={styles.picker}><Layers3 size={13}/><select aria-label={t('Choose a reference', 'Choisir une référence')} value={selected.assetId} onChange={event => {onSelect(event.target.value); if (!expanded) onToggle();}}>{items.map(item => <option key={item.assetId} value={item.assetId}>{item.label}{item.name ? ' · ' + item.name : ''}</option>)}</select></label> : <span>{items.length} {t('references', 'références')}</span>}
      <button onClick={onToggle} aria-label={expanded ? t('Collapse media', 'Réduire les médias') : t('Open media', 'Ouvrir les médias')} aria-expanded={expanded} aria-controls="studio-media-shelf-content">{expanded ? <Minus size={15}/> : <Plus size={15}/>}</button>
    </div>
    <div id="studio-media-shelf-content" className={styles.content}>
      {visible.map(item => <ConversationReferenceCard key={item.assetId} projectId={projectId} item={item} active={item.assetId === selected.assetId} compact={!expanded} attached={attachedIds.includes(item.assetId)} locale={locale}
        onSelect={() => {onSelect(item.assetId); if (!expanded) onToggle();}} onMention={() => onMention(item)} onAttach={() => onAttach(item)} onDetach={() => onDetach(item)}/>)}
    </div>
  </aside>;
}
