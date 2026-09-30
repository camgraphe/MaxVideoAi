import { revalidatePath } from 'next/cache';
import { buildVideoWatchPath } from '@/lib/video-seo-canonical';

type WatchIdentifier = { id: string; canonicalSlug?: string | null };

/** Run after a successful editorial write so direct readers match the uncached popup. */
export function revalidateVideoSeoPages(current: WatchIdentifier, previous?: WatchIdentifier | null) {
  const paths = new Set([
    buildVideoWatchPath(current.id),
    buildVideoWatchPath(current.id, current.canonicalSlug),
    ...(previous ? [buildVideoWatchPath(previous.id, previous.canonicalSlug)] : []),
    '/sitemap-video.xml', '/sitemap-video-pages.xml',
    '/api/sitemap-video', '/api/sitemap-video-pages',
  ]);
  for (const path of paths) revalidatePath(path);
}
