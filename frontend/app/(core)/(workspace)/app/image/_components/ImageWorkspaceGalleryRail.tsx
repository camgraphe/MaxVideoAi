'use client';

import dynamic from 'next/dynamic';
import type { GalleryRailProps } from '@/components/GalleryRail';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import { GalleryRailSkeleton } from '../../_components/WorkspaceBootSkeletons';

const GalleryRail = dynamic<GalleryRailProps>(
  () => import('@/components/GalleryRail').then((mod) => mod.GalleryRail),
  {
    ssr: false,
    loading: () => <GalleryRailSkeleton />,
  }
);

type ImageWorkspaceGalleryRailProps = {
  activeGroups: GroupSummary[];
  engineCapsList: EngineCaps[];
  isImageJob: (job: Job) => boolean;
  onOpenGroup: (group: GroupSummary) => void;
  selectedEngineCaps: EngineCaps;
  variant: 'desktop' | 'mobile';
};

export function ImageWorkspaceGalleryRail({
  activeGroups,
  engineCapsList,
  isImageJob,
  onOpenGroup,
  selectedEngineCaps,
  variant,
}: ImageWorkspaceGalleryRailProps) {
  const rail = (
    <GalleryRail
      engine={selectedEngineCaps}
      engineRegistry={engineCapsList}
      feedType="image"
      activeGroups={activeGroups}
      jobFilter={isImageJob}
      onOpenGroup={onOpenGroup}
      variant={variant}
    />
  );

  if (variant === 'desktop') {
    return <div className="flex w-[320px] justify-end pl-2 pr-0 py-4">{rail}</div>;
  }

  return <div className="border-t border-hairline bg-surface-glass-70 px-4 py-4">{rail}</div>;
}
