import { GalleryRail } from '@/components/GalleryRail';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';

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
