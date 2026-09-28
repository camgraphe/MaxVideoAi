'use client';

import { useRef } from 'react';
import { moveCurationIdToPosition, type CurationItem } from '@/lib/admin/playlist-curation';
import { PlacementMediaCard } from './PlacementMediaCard';

type Props = {
  items: CurationItem[];
  busy: boolean;
  orderedIds?: string[];
  onOrder?: (ids: string[]) => void;
  onRemove?: (id: string) => void;
  onExclude?: (id: string) => void;
  canExclude?: (id: string) => boolean;
  canAdd?: (id: string) => boolean;
  onAdd?: (id: string) => void;
  onInspect?: (id: string) => void;
  removeLabel?: string;
};

export function PlacementMediaList({ items, orderedIds, busy, onOrder, onRemove, onExclude, onAdd, onInspect,
  canAdd, canExclude, removeLabel = 'Remove' }: Props) {
  const allIds = orderedIds ?? items.map(item => item.id);
  const dragged = useRef<string | null>(null);
  const move = (id: string, position: number) => onOrder?.(moveCurationIdToPosition(allIds, id, position));

  return <ol data-selected-grid={onOrder ? '' : undefined} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {items.map(item => {
      const index = allIds.indexOf(item.id);
      return <li key={item.id} data-curation-item={onOrder ? item.id : undefined} data-media-id={item.id}
        draggable={Boolean(onOrder) && !busy}
        onDragStart={event => {
          if (busy || !onOrder) { event.preventDefault(); return; }
          dragged.current = item.id;
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', item.id);
        }}
        onDragOver={event => { if (!busy && onOrder) event.preventDefault(); }}
        onDrop={event => {
          event.preventDefault();
          if (!busy && dragged.current && dragged.current !== item.id && allIds.includes(dragged.current))
            move(dragged.current, index + 1);
          dragged.current = null;
        }}
        onDragEnd={() => { dragged.current = null; }}
        className="min-w-0">
        <PlacementMediaCard item={item} index={index} total={allIds.length} busy={busy}
          onMove={onOrder ? position => move(item.id, position) : undefined}
          onRemove={onRemove ? () => onRemove(item.id) : undefined}
          onExclude={onExclude ? () => onExclude(item.id) : undefined}
          onAdd={onAdd ? () => onAdd(item.id) : undefined}
          onInspect={onInspect ? () => onInspect(item.id) : undefined}
          canAdd={canAdd?.(item.id)} canExclude={canExclude?.(item.id)} removeLabel={removeLabel} />
      </li>;
    })}
  </ol>;
}
