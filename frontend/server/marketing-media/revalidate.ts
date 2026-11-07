import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import {
  CHARACTER_STUDIO_ARTICLE_SLUGS,
  CHARACTER_STUDIO_RECAST_PLAYLIST,
  CHARACTER_STUDIO_REVIEWED_FILMS,
} from '@/lib/character-studio-marketing';
import { LOCALES, localizePathFromEnglish, normalizePathSegments } from '@/lib/i18n/paths';
import { revalidateVideoSeoPages } from '@/server/video-seo-revalidation';
import { getResolvedVideoSeoEditorialEntry } from '@/server/video-seo-editorial';

function revalidateCharacterStudioPages() {
  const englishPaths = [
    '/', '/tools/character-builder', '/examples',
    ...CHARACTER_STUDIO_ARTICLE_SLUGS.map(slug => `/blog/${slug}`),
  ];
  const paths = new Set<string>();
  for (const locale of LOCALES) {
    for (const path of englishPaths) {
      const localized = localizePathFromEnglish(locale, path);
      paths.add(localized);
      // Cover the underlying ISR route as well. Blog params keep their localized slug.
      if (locale === 'en' || !path.startsWith('/blog/')) paths.add(normalizePathSegments(locale, path));
    }
  }
  for (const path of paths) revalidatePath(path);
}

/** Preserve the existing canonical owner while refreshing its media after an admin write. */
export async function revalidateMarketingPublication(videoId: string) {
  const editorial = await getResolvedVideoSeoEditorialEntry(videoId);
  revalidateVideoSeoPages({ id: videoId, canonicalSlug: editorial?.canonicalSlug });
  if (CHARACTER_STUDIO_REVIEWED_FILMS.has(videoId)) revalidateCharacterStudioPages();
}

/** Direct playlist mutations can add, hide, or reorder proof without touching a publication row. */
export async function revalidateMarketingPlaylist(playlistId: string) {
  const [match] = await query('SELECT 1 FROM playlists WHERE id=$1 AND slug=$2', [
    playlistId, CHARACTER_STUDIO_RECAST_PLAYLIST,
  ]);
  if (match) revalidateCharacterStudioPages();
}
