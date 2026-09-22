'use client';

import Image from 'next/image';
import { type DragEvent } from 'react';
import { ArrowUp, ArrowDown, GripVertical, X } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { getPlaceholderThumb } from '@/components/admin/playlists/playlist-helpers';
import type { DropPlacement, PlaylistItemRecord } from '@/components/admin/playlists/playlist-types';

type PlaylistItemsSectionProps = {
  items: PlaylistItemRecord[];
  draggingId: string | null;
  dropAtEnd: boolean;
  dropPlacement: DropPlacement;
  dropTargetId: string | null;
  isItemsDirty: boolean;
  isPending: boolean;
  onCardDragOver: (event: DragEvent<HTMLElement>, videoId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragStart: (event: DragEvent<HTMLElement>, videoId: string) => void;
  onDropAtEnd: (event: DragEvent<HTMLElement>) => void;
  onDropOnCard: (event: DragEvent<HTMLElement>, targetVideoId: string) => void;
  onDropOnPlaceholder: (event: DragEvent<HTMLElement>, targetVideoId: string | null, placement: DropPlacement) => void;
  onRemoveVideo: (videoId: string) => void;
  onSaveItems: () => void;
  onCancelOrder: () => void;
  onMoveItem: (videoId: string, offset: number) => void;
};

export function PlaylistItemsSection({
  items,
  draggingId,
  dropAtEnd,
  dropPlacement,
  dropTargetId,
  isItemsDirty,
  isPending,
  onCardDragOver,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDropAtEnd,
  onDropOnCard,
  onDropOnPlaceholder,
  onRemoveVideo,
  onSaveItems,
  onCancelOrder,
  onMoveItem,
}: PlaylistItemsSectionProps) {
  return (
    <section className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Curated order</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Drag to arrange, or use the move buttons. Save to apply the new order.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCancelOrder}
            disabled={!isItemsDirty || isPending}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={onSaveItems} disabled={!isItemsDirty || isPending}>
            Save order
          </Button>
        </div>
      </div>
      <div className="divide-y divide-hairline border-y border-border" onDragOver={onDragOver} onDrop={onDropAtEnd}>
        {items.map((item, index) => (
          <article
            key={item.videoId}
            draggable={!isPending}
            onDragStart={(event) => onDragStart(event, item.videoId)}
            onDragEnd={onDragEnd}
            onDragOver={(event) => onCardDragOver(event, item.videoId)}
            onDrop={(event) => onDropOnCard(event, item.videoId)}
            className={clsx(
              'flex items-center gap-3 py-3',
              draggingId === item.videoId && 'opacity-40',
              dropTargetId === item.videoId &&
                (dropPlacement === 'before' ? 'border-t-2 border-t-brand' : 'border-b-2 border-b-brand')
            )}
          >
            <GripVertical className="shrink-0 cursor-grab text-text-muted" size={16} aria-hidden="true" />
            <span className="w-5 shrink-0 text-xs tabular-nums text-text-secondary">{index + 1}</span>
            <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded bg-surface-2">
              <Image
                src={item.thumbUrl || getPlaceholderThumb(item.aspectRatio)}
                alt={item.engineLabel ?? 'Media thumbnail'}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.engineLabel ?? 'Unknown model'}</p>
              <p className="mt-1 truncate text-xs text-text-secondary">
                {item.isPublishedOnSite ? 'Public' : 'Not public'}
                {item.prompt ? ` · ${item.prompt}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={index === 0 || isPending}
                onClick={() => onMoveItem(item.videoId, -1)}
                aria-label={`Move item ${index + 1} up`}
                className="rounded p-2 hover:bg-surface-2 disabled:opacity-30"
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                disabled={index === items.length - 1 || isPending}
                onClick={() => onMoveItem(item.videoId, 1)}
                aria-label={`Move item ${index + 1} down`}
                className="rounded p-2 hover:bg-surface-2 disabled:opacity-30"
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => onRemoveVideo(item.videoId)}
                aria-label={`Remove item ${index + 1} from collection`}
                className="rounded p-2 text-text-secondary hover:bg-surface-2"
              >
                <X size={16} />
              </button>
            </div>
          </article>
        ))}
        {!items.length ? (
          <p className="py-10 text-center text-sm text-text-secondary">
            No curated media. Add published media from Moderation.
          </p>
        ) : null}
        {draggingId && dropAtEnd ? (
          <div
            className="border-t-2 border-brand py-3 text-xs text-brand"
            onDragOver={onDragOver}
            onDrop={(event) => onDropOnPlaceholder(event, null, 'after')}
          >
            Drop at the end
          </div>
        ) : null}
      </div>
      <p role="status" className="mt-3 text-xs text-text-secondary">
        {isItemsDirty ? 'Unsaved order changes' : `${items.length} curated media`}
      </p>
    </section>
  );
}

export function PlaylistOrderDirtyBar({
  isPending,
  playlistName,
  onSaveItems,
}: {
  isPending: boolean;
  playlistName: string;
  onSaveItems: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-xl items-center justify-between gap-4 rounded-full border border-brand/30 bg-surface/95 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">Order changed</p>
          <p className="truncate text-xs text-text-secondary">{playlistName}</p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onSaveItems}
          disabled={isPending}
          className="shrink-0 shadow-card ring-2 ring-brand/20"
        >
          Save order
        </Button>
      </div>
    </div>
  );
}
