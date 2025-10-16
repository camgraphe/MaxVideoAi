'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { EngineCaps } from '@/types/engines';
import type { VideoGroup } from '@/types/video-groups';
import { AspectBox } from '@/components/ui/AspectBox';
import { GroupCard, type GroupCardAction } from '@/components/groups/GroupCard';

interface GroupGalleryProps {
  groups: VideoGroup[];
  engineMap?: Map<string, EngineCaps>;
  onOpenGroup?: (group: VideoGroup) => void;
  onGroupAction?: (group: VideoGroup, action: GroupCardAction) => void;
  allowRemove?: (group: VideoGroup) => boolean;
  className?: string;
  emptyState?: ReactNode;
  isLoading?: boolean;
  loadingCount?: number;
  variant?: 'grid' | 'list';
}

function SkeletonCard() {
  return (
    <div className="rounded-card border border-border bg-white/60 p-0" aria-hidden>
      <AspectBox aspectRatio="16:9" className="rounded-card">
        <div className="aspect-box__overlay skeleton" />
      </AspectBox>
      <div className="border-t border-border bg-white/70 px-3 py-2">
        <div className="h-3 w-24 rounded-full bg-neutral-200" />
      </div>
    </div>
  );
}

export function GroupGallery({
  groups,
  engineMap,
  onOpenGroup,
  onGroupAction,
  allowRemove,
  className,
  emptyState,
  isLoading = false,
  loadingCount = 4,
  variant = 'grid',
}: GroupGalleryProps) {
  if (!isLoading && groups.length === 0) {
    return <div className={clsx('w-full', className)}>{emptyState ?? null}</div>;
  }

  const enginesById = engineMap ?? new Map<string, EngineCaps>();
  const baseLayoutClass =
    variant === 'list' ? 'grid gap-4 grid-cols-1' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <div className={clsx(baseLayoutClass, className)}>
      {groups.map((group) => {
        const engineId = String(group.paramsSnapshot?.engineId ?? '');
        const engine =
          (engineId && enginesById.get(engineId)) ||
          (typeof group.paramsSnapshot?.engineLabel === 'string'
            ? Array.from(enginesById.values()).find(
                (candidate) => candidate.label.toLowerCase() === String(group.paramsSnapshot?.engineLabel).toLowerCase()
              )
            : undefined);
        return (
          <GroupCard
            key={group.id}
            group={group}
            engine={engine}
            onOpen={onOpenGroup}
            onAction={onGroupAction}
            allowRemove={allowRemove ? allowRemove(group) : false}
          />
        );
      })}
      {isLoading
        ? Array.from({ length: loadingCount }).map((_, index) => <SkeletonCard key={`group-skeleton-${index}`} />)
        : null}
    </div>
  );
}
