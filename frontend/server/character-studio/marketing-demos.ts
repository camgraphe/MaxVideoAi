import 'server-only';
import { CHARACTER_STUDIO_RECAST_PLAYLIST, CHARACTER_STUDIO_REVIEWED_FILMS } from '@/lib/character-studio-marketing';
import { isDatabaseConfigured } from '@/lib/db';
import { listPlaylistVideos } from '@/server/videos';
import type { GalleryVideo } from '@/server/videos-normalization';
import type { CharacterStudioMarketingFilm } from '@/components/tools/character-builder/landing/character-studio-marketing-assets';

/** Public direct playlist membership owns visibility and deletion guards; no private-job fallback. */
export async function getCharacterStudioMarketingVideos(): Promise<CharacterStudioMarketingFilm[]> {
  if (!isDatabaseConfigured()) return [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Optional proof must not hold the product page hostage to a slow catalog read.
    // The existing DB query keeps its own timeout; late settlement cannot update this response.
    const videos = await Promise.race([
      listPlaylistVideos(CHARACTER_STUDIO_RECAST_PLAYLIST, 6),
      new Promise<GalleryVideo[]>(resolve => { timer = setTimeout(() => resolve([]), 1500); }),
    ]);
    return videos.flatMap(video => {
      const key = CHARACTER_STUDIO_REVIEWED_FILMS.get(video.id);
      if (!key || !video.videoUrl || !video.thumbUrl || video.visibility !== 'public') return [];
      // Only independent admin marketing copies qualify for this new placement.
      try {
        if (!new URL(video.videoUrl).pathname.startsWith('/marketing-media/')) return [];
      } catch { return []; }
      return [{ key, video: video.videoUrl, poster: video.thumbUrl }];
    });
  } catch {
    console.warn('[character-studio-marketing] Optional public examples unavailable; showing reviewed stills.');
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}
