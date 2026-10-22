import { revalidateVideoSeoPages } from '@/server/video-seo-revalidation';
import { getResolvedVideoSeoEditorialEntry } from '@/server/video-seo-editorial';

/** Preserve the existing canonical owner while refreshing its media after an admin write. */
export async function revalidateMarketingPublication(videoId: string) {
  const editorial = await getResolvedVideoSeoEditorialEntry(videoId);
  revalidateVideoSeoPages({ id: videoId, canonicalSlug: editorial?.canonicalSlug });
}
