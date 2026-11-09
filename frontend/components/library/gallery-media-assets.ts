import { imageDisplayFields } from '@/lib/image-display';
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
    const entry = kind === 'image' && imageIndex !== undefined ? member.job?.imageRenders?.[imageIndex] : undefined;
    const jobId = member.jobId ?? member.job?.jobId ?? group.id;
    const display = entry?.url === url ? imageDisplayFields(entry.imageDisplay, url, entry.previewUrl) : imageDisplayFields(member.imageDisplay, url, member.previewUrl);
    const sourceOutputId = kind === 'image' ? member.sourceOutputId ?? (entry?.url === url ? entry.sourceOutputId : undefined) ?? (imageIndex !== undefined && storedImageUrl === url ? `${jobId}:image:${imageIndex}` : undefined) : undefined;
    return [{ id: member.id, url, kind, ...display,
      ...(sourceOutputId ? { sourceOutputId, ref: { type: 'job-output' as const, jobId, outputId: sourceOutputId, kind } } : {}), thumbUrl: member.thumbUrl, jobId: member.jobId ?? member.job?.jobId ?? group.id, source: 'gallery', durationSec: member.durationSec }];
  });
}
