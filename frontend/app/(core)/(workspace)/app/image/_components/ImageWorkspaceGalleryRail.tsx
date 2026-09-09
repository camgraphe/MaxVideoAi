'use client';

import dynamic from 'next/dynamic';
import type { GalleryRailProps } from '@/components/GalleryRail';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import { GalleryRailSkeleton } from '../../_components/WorkspaceBootSkeletons';
import { useInfiniteJobs } from '@/lib/api';
import { StarterMediaShelf } from '@/components/starters/StarterMediaShelf.client';

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
  onUseStarterPrompt: (prompt: string) => void;
};

export function ImageWorkspaceGalleryRail({
  activeGroups,
  engineCapsList,
  isImageJob,
  onOpenGroup,
  selectedEngineCaps,
  variant,
  onUseStarterPrompt,
}: ImageWorkspaceGalleryRailProps) {
  const { stableJobs, isLoading, error } = useInfiniteJobs(24, { surface: 'image' });
  const showStarters = !isLoading && !error && !activeGroups.length && !stableJobs.some(job => !job.curated);
  const rail = (
    showStarters ? <StarterMediaShelf surface="image" onUsePrompt={onUseStarterPrompt} /> :
    <GalleryRail
      engine={selectedEngineCaps}
      engineRegistry={engineCapsList}
      feedType="image"
      feedSurface="image"
      activeGroups={activeGroups}
      jobFilter={isImageJob}
      onOpenGroup={onOpenGroup}
      variant={variant}
    />
  );

  if (variant === 'desktop') {
    return <div className="flex w-[320px] justify-end border-l border-hairline pl-2 pr-0 py-4">{rail}</div>;
  }

  return <div className="app-image-results-rail border-t border-hairline bg-surface-glass-70 px-4 py-4">{rail}</div>;
}
