'use client';

import type { Ref } from 'react';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import type { GalleryFeedType } from './gallery-rail-utils';

interface GalleryRailCardsProps {
  backgroundWarmCount: number;
  engineMap: ReadonlyMap<string, EngineCaps>;
  feedType: GalleryFeedType;
  groups: GroupSummary[];
  isFetchingMore: boolean;
  isInitialLoading: boolean;
  onCardAction: (group: GroupSummary, action: GroupedJobAction) => void;
  onCardOpen: (group: GroupSummary) => void;
  resolveAspectRatioLabel: (group: GroupSummary) => string | null;
  sentinelRef: Ref<HTMLDivElement>;
}

export function GalleryRailCards({
  backgroundWarmCount,
  engineMap,
  feedType,
  groups,
  isFetchingMore,
  isInitialLoading,
  onCardAction,
  onCardOpen,
  resolveAspectRatioLabel,
  sentinelRef,
}: GalleryRailCardsProps) {
  return (
    <>
      {groups.map((group, index) => {
        const engineId = group.hero.engineId;
        const engineEntry = engineId ? engineMap.get(engineId) ?? null : null;
        return (
          <GroupedJobCard
            key={group.id}
            group={group}
            engine={engineEntry ?? undefined}
            onOpen={onCardOpen}
            onAction={onCardAction}
            allowRemove={false}
            metaLabel={feedType === 'image' ? resolveAspectRatioLabel(group) : undefined}
            menuVariant={feedType === 'video' ? 'gallery' : 'gallery-image'}
            openLabel={feedType === 'video' ? 'Preview' : undefined}
            showOpenOverlay={false}
            eagerPreview={feedType === 'video' && index < backgroundWarmCount}
            warmOnVisible={false}
          />
        );
      })}
      {(isInitialLoading || isFetchingMore) &&
        Array.from({ length: isInitialLoading ? 4 : 2 }).map((_, index) => (
          <div key={`rail-skeleton-${index}`} className="rounded-card border border-border bg-surface-glass-60 p-0" aria-hidden>
            <div className="relative overflow-hidden rounded-card">
              <div className="relative" style={{ aspectRatio: '16 / 9' }}>
                <div className="skeleton absolute inset-0" />
              </div>
            </div>
            <div className="border-t border-border bg-surface-glass-70 px-3 py-2">
              <div className="h-3 w-24 rounded-full bg-skeleton" />
            </div>
          </div>
        ))}
      <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
    </>
  );
}
