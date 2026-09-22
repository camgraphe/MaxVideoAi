'use client';
import Image from 'next/image';
import { useRef } from 'react';
import type { CurationItem } from '@/lib/admin/playlist-curation';

type Props = {
  items: CurationItem[];
  busy: boolean;
  onOrder?: (ids: string[]) => void;
  onRemove?: (id: string) => void;
  onExclude?: (id: string) => void;
  onAdd?: (id: string) => void;
  removeLabel?: string;
};
export function PlacementMediaList({
  items,
  busy,
  onOrder,
  onRemove,
  onExclude,
  onAdd,
  removeLabel = 'Remove',
}: Props) {
  const dragged = useRef<string | null>(null);
  const move = (id: string, index: number) => {
    const next = items.map((item) => item.id).filter((value) => value !== id);
    next.splice(index, 0, id);
    onOrder?.(next);
  };
  return (
    <ol className="divide-y divide-border">
      {items.map((item, index) => (
        <li
          key={item.id}
          data-curation-item={onOrder ? item.id : undefined}
          draggable={Boolean(onOrder) && !busy}
          onDragStart={(event) => {
            if (busy || !onOrder) {
              event.preventDefault();
              return;
            }
            dragged.current = item.id;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item.id);
          }}
          onDragOver={(event) => {
            if (!busy && onOrder) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (
              !busy &&
              dragged.current &&
              dragged.current !== item.id &&
              items.some((value) => value.id === dragged.current)
            )
              move(dragged.current, index);
            dragged.current = null;
          }}
          onDragEnd={() => {
            dragged.current = null;
          }}
          className="flex flex-wrap items-center gap-3 py-3"
        >
          {onOrder ? (
            <span title="Drag to reorder" className="cursor-grab text-xs tabular-nums text-text-muted">
              ⠿ {index + 1}
            </span>
          ) : null}
          {item.thumbUrl ? (
            <Image
              src={item.thumbUrl}
              width={64}
              height={40}
              unoptimized
              alt=""
              className="h-10 w-16 rounded object-cover"
            />
          ) : (
            <span className="h-10 w-16 rounded bg-surface-2" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.prompt || item.id}</p>
            <p className="truncate text-xs text-text-muted">
              {item.engineLabel ?? item.engineId} · {item.id}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {onOrder ? (
              <>
                <button
                  type="button"
                  disabled={busy || index === 0}
                  aria-label={`Move item ${index + 1} up`}
                  onClick={() => move(item.id, index - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={busy || index === items.length - 1}
                  aria-label={`Move item ${index + 1} down`}
                  onClick={() => move(item.id, index + 1)}
                >
                  ↓
                </button>
              </>
            ) : null}
            {onAdd ? (
              <button type="button" disabled={busy} onClick={() => onAdd(item.id)}>
                Add to selection
              </button>
            ) : null}
            {onRemove ? (
              <button type="button" disabled={busy} onClick={() => onRemove(item.id)}>
                {removeLabel}
              </button>
            ) : null}
            {onExclude ? (
              <button type="button" disabled={busy} onClick={() => onExclude(item.id)}>
                Exclude from this page
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
