import type { GroupedJobAction } from '@/components/GroupedJobCard';
import type { GroupSummary } from '@/types/groups';

export type { GroupedJobAction };

export type JobsSectionKey = 'video' | 'audio' | 'image' | 'character' | 'angle' | 'upscale';

export interface JobsPageSection {
  key: JobsSectionKey;
  title: string;
  empty: string;
  groups: GroupSummary[];
  hasMore: boolean;
  isInitialLoading: boolean;
  isValidating: boolean;
  error: unknown;
  forceImageGroup: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
}
