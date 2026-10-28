import type { GroupedJobAction } from '@/components/GroupedJobCard';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import type { GalleryFeedType, GalleryVariant } from './gallery-rail-utils';

export interface GalleryFeedState {
  visibleGroups: GroupSummary[];
  sampleOnly: boolean;
}

export interface GalleryRailProps {
  engine: EngineCaps;
  engineRegistry?: EngineCaps[];
  feedType?: GalleryFeedType;
  feedSurface?: GalleryFeedType;
  activeGroups?: GroupSummary[];
  selectedGroupId?: string | null;
  onOpenGroup?: (group: GroupSummary) => void;
  onGroupAction?: (group: GroupSummary, action: GroupedJobAction, options?: { autoPlayPreview?: boolean }) => void;
  onFeedStateChange?: (state: GalleryFeedState) => void;
  jobFilter?: (job: Job) => boolean;
  variant?: GalleryVariant;
  hideDesktopHeader?: boolean;
}
