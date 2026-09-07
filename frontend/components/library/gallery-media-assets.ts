import type { GroupSummary } from '@/types/groups';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';

/** Never infer an input original from a display thumbnail or short preview. */
export function galleryMediaAssets(group: GroupSummary, kind: 'image' | 'video' | 'audio'): AssetBrowserAsset[] {
  return group.members.flatMap((member) => {
    if (member.status === 'pending' || member.status === 'failed') return [];
    // groupJobsIntoSummaries encodes the zero-based index within each job,
    // not the member's position across a multi-job group.
    const encodedImageIndex = member.id.match(/-image-(\d+)$/)?.[1];
    const imageIndex = member.job?.renderIds?.length === 1 ? 0 : encodedImageIndex === undefined ? undefined : Number(encodedImageIndex);
    const storedImageUrl = imageIndex === undefined ? undefined : member.job?.renderIds?.[imageIndex];
    const url = kind === 'audio' ? member.audioUrl ?? member.job?.audioUrl : kind === 'image' ? member.originalUrl ?? storedImageUrl : member.videoUrl ?? member.job?.videoUrl;
    if (!url || !/^https?:\/\//i.test(url)) return [];
    return [{ id: member.id, url, kind, thumbUrl: member.thumbUrl, jobId: member.jobId ?? member.job?.jobId ?? group.id, source: 'gallery', durationSec: member.durationSec }];
  });
}
