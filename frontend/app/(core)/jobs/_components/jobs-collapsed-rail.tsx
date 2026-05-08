'use client';

import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AudioWaveformThumb } from '@/components/ui/AudioWaveformThumb';
import { isPlaceholderMediaUrl } from '@/lib/media';
import {
  resolveJobsRailAudio,
  resolveJobsRailPlaceholderThumb,
  resolveJobsRailThumb,
  resolveJobsRailVideo,
} from '@/lib/jobs-rail-thumb';
import type { GroupSummary } from '@/types/groups';

const COLLAPSED_RAIL_ITEM_WIDTH = 220;

function RailThumb({ src, videoSrc, fallbackSrc }: { src: string; videoSrc?: string | null; fallbackSrc: string }) {
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const [imageFailed, setImageFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setResolvedSrc(src);
    setImageFailed(false);
    setVideoFailed(false);
  }, [src, videoSrc]);

  const showVideo = Boolean(videoSrc && (isPlaceholderMediaUrl(resolvedSrc) || imageFailed) && !videoFailed);

  if (showVideo) {
    return (
      <video
        src={videoSrc ?? undefined}
        poster={fallbackSrc}
        className="absolute inset-0 h-full w-full object-cover"
        muted
        playsInline
        loop
        autoPlay
        preload="metadata"
        onError={() => {
          setVideoFailed(true);
          setResolvedSrc(fallbackSrc);
        }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
      loading="lazy"
      onError={() => {
        setImageFailed(true);
        if (!videoSrc && resolvedSrc !== fallbackSrc) {
          setResolvedSrc(fallbackSrc);
        }
      }}
    />
  );
}

export function CollapsedGroupRailSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={`jobs-rail-skeleton-${index}`}
          className="relative shrink-0 overflow-hidden rounded-card border border-border bg-surface-glass-60"
          style={{ width: COLLAPSED_RAIL_ITEM_WIDTH }}
          aria-hidden
        >
          <div className="relative" style={{ aspectRatio: '16 / 9' }}>
            <div className="skeleton absolute inset-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CollapsedGroupRail({
  groups,
  onOpen,
  onSaveToLibrary,
  savingIds,
  addLabel,
  savingLabel,
}: {
  groups: GroupSummary[];
  onOpen: (group: GroupSummary) => void;
  onSaveToLibrary: (group: GroupSummary) => void;
  savingIds: Set<string>;
  addLabel: string;
  savingLabel: string;
}) {
  const items = groups.slice(0, 12);
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {items.map((group) => {
        const thumb = resolveJobsRailThumb(group);
        const fallbackThumb = resolveJobsRailPlaceholderThumb(group.hero.aspectRatio ?? group.previews[0]?.aspectRatio ?? null);
        const video = resolveJobsRailVideo(group);
        const audio = resolveJobsRailAudio(group);
        const isSaving = savingIds.has(group.id);
        return (
          <div
            key={group.id}
            className="group relative block h-auto min-h-0 shrink-0 overflow-hidden rounded-card border border-border bg-surface p-0 shadow-card transition hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            style={{ width: COLLAPSED_RAIL_ITEM_WIDTH }}
          >
            <button
              type="button"
              onClick={() => onOpen(group)}
              className="block w-full"
              aria-label="Open render"
            >
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
                {video ? (
                  <RailThumb src={thumb} videoSrc={video} fallbackSrc={fallbackThumb} />
                ) : audio ? (
                  <AudioWaveformThumb
                    seed={audio}
                    thumbSrc={thumb !== fallbackThumb ? thumb : null}
                    label={null}
                    active={false}
                  />
                ) : (
                  <RailThumb src={thumb} videoSrc={video} fallbackSrc={fallbackThumb} />
                )}
                {group.count > 1 ? (
                  <div className="absolute bottom-2 right-2 rounded-full bg-surface-on-media-dark-55 px-2 py-0.5 text-xs font-semibold text-on-inverse">
                    ×{group.count}
                  </div>
                ) : null}
              </div>
            </button>
            <button
              type="button"
              onClick={() => onSaveToLibrary(group)}
              disabled={isSaving}
              title={isSaving ? savingLabel : addLabel}
              aria-label={isSaving ? savingLabel : addLabel}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/90 text-black/80 shadow-md backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
