import type { GroupSummary } from '@/types/groups';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';

/** Never infer an input original from a display thumbnail or short preview. */
export function galleryMediaAssets(group: GroupSummary, kind: 'image' | 'video' | 'audio'): AssetBrowserAsset[] {
  return group.members.flatMap((member, index) => {
    if (member.status === 'pending' || member.status === 'failed') return [];
    const imageIndex = Number(member.id.match(/-image-(\d+)$/)?.[1] ?? (member.job?.renderIds?.length === 1 ? 1 : index + 1)) - 1;
    const url = kind === 'audio' ? member.audioUrl ?? member.job?.audioUrl : kind === 'image' ? member.originalUrl ?? member.job?.renderIds?.[imageIndex] : member.videoUrl ?? member.job?.videoUrl;
    if (!url || !/^https?:\/\//i.test(url)) return [];
    return [{ id: member.id, url, kind, thumbUrl: member.thumbUrl, jobId: member.jobId ?? member.job?.jobId ?? group.id, source: 'gallery', durationSec: member.durationSec }];
  });
}
