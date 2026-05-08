"use client";

import Image from 'next/image';
import { Fragment, type DragEvent } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/admin/playlists/PlaylistStatusPill';
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
};

function DropPlaceholder({
  targetVideoId,
  placement,
  onDrop,
}: {
  targetVideoId: string | null;
  placement: DropPlacement;
  onDrop: PlaylistItemsSectionProps['onDropOnPlaceholder'];
}) {
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => onDrop(event, targetVideoId, placement)}
      className="rounded-card border-2 border-dashed border-brand/55 bg-brand/5 p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)]"
    >
      <div className="flex aspect-video items-center justify-center rounded-card border border-white/30 bg-gradient-to-br from-brand/10 to-brand/5 text-center">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand/80">Drop here</p>
          <p className="text-xs text-text-muted">New gallery position</p>
        </div>
      </div>
    </div>
  );
}

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
}: PlaylistItemsSectionProps) {
  return (
    <section className="rounded-card border border-border bg-surface p-6 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Collection items</h2>
          <p className="text-sm text-text-secondary">
            Drag clips to change the visible order, then save the gallery. Family playlists define the editorial top of the page.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onSaveItems}
          disabled={!isItemsDirty || isPending}
          className={clsx(isItemsDirty && 'shadow-card ring-2 ring-brand/20')}
        >
          Save order
        </Button>
      </div>

      {items.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" onDragOver={onDragOver} onDrop={onDropAtEnd}>
          {items.map((item, index) => (
            <Fragment key={item.videoId}>
              {draggingId && dropTargetId === item.videoId && dropPlacement === 'before' ? (
                <DropPlaceholder
                  targetVideoId={item.videoId}
                  placement="before"
                  onDrop={onDropOnPlaceholder}
                />
              ) : null}
              <article
                draggable
                onDragStart={(event) => onDragStart(event, item.videoId)}
                onDragEnd={onDragEnd}
                onDragOver={(event) => onCardDragOver(event, item.videoId)}
                onDrop={(event) => onDropOnCard(event, item.videoId)}
                className={clsx(
                  'cursor-grab overflow-hidden rounded-card border border-hairline bg-bg shadow-card transition active:cursor-grabbing',
                  draggingId === item.videoId && 'scale-[0.985] opacity-35'
                )}
              >
                <div className="relative aspect-video overflow-hidden bg-placeholder">
                  <Image
                    src={item.thumbUrl || getPlaceholderThumb(item.aspectRatio)}
                    alt={`Thumbnail for ${item.videoId}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 via-black/25 to-transparent p-3">
                    <StatusPill tone="neutral">#{index + 1}</StatusPill>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onRemoveVideo(item.videoId)}
                      disabled={isPending}
                      className="min-h-[32px] rounded-full border-white/35 bg-black/35 px-2.5 text-white hover:border-white/60 hover:bg-black/50 hover:text-white"
                      aria-label={`Remove ${item.engineLabel ?? item.videoId} from collection`}
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
                        <path d="M7.5 2.5h5a1 1 0 0 1 1 1V5H17a.75.75 0 0 1 0 1.5h-.64l-.62 9.23A2 2 0 0 1 13.75 17.5h-7.5a2 2 0 0 1-1.99-1.77L3.64 6.5H3A.75.75 0 0 1 3 5h3.5V3.5a1 1 0 0 1 1-1Zm4.5 2.5V4h-4v1h4Zm-3 3.25a.75.75 0 0 0-1.5 0v5a.75.75 0 0 0 1.5 0v-5Zm3.5-.75a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5a.75.75 0 0 1 .75-.75Z" />
                      </svg>
                    </Button>
                  </div>
                </div>

                <div className="px-4 py-4">
                  <p className="truncate text-sm font-semibold text-text-primary">{item.engineLabel ?? 'Unknown model'}</p>
                </div>
              </article>
              {draggingId && dropTargetId === item.videoId && dropPlacement === 'after' ? (
                <DropPlaceholder
                  targetVideoId={item.videoId}
                  placement="after"
                  onDrop={onDropOnPlaceholder}
                />
              ) : null}
            </Fragment>
          ))}
          {draggingId && dropAtEnd ? <DropPlaceholder targetVideoId={null} placement="after" onDrop={onDropOnPlaceholder} /> : null}
        </div>
      ) : (
        <div className="mt-5 rounded-card border border-dashed border-hairline bg-bg px-4 py-8 text-center text-sm text-text-secondary">
          This collection is empty. Use the family seed helpers or add clips from moderation, then reorder them here.
        </div>
      )}
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
        <Button type="button" size="sm" onClick={onSaveItems} disabled={isPending} className="shrink-0 shadow-card ring-2 ring-brand/20">
          Save order
        </Button>
      </div>
    </div>
  );
}
