export type JobsFeedType = 'video' | 'image' | 'all';

export function shouldUseStarterFallback(feedType: JobsFeedType, cursor: string | null, surface?: string | null): boolean {
  if (cursor || (surface && surface !== 'video' && surface !== 'all')) return false;
  return feedType === 'all' || feedType === 'video';
}
