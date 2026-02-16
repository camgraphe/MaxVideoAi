export type JobsFeedType = 'video' | 'image' | 'all';

export function shouldUseStarterFallback(feedType: JobsFeedType, cursor: string | null): boolean {
  if (cursor) return false;
  return feedType === 'all' || feedType === 'video';
}
