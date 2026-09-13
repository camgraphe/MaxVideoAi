import { isDatabaseConfigured, query } from '@/lib/db';
import { BUILTIN_STARTER_MEDIA, isPublicStarterMediaUrl, STARTER_MEDIA_SLUGS, type StarterMedia, type StarterMediaSurface } from '@/lib/starter-media';

/** Admin playlists override the bundled starter selection. No schema writes in this read path. */
export async function listStarterMedia(surface: StarterMediaSurface): Promise<StarterMedia[]> {
  if (!isDatabaseConfigured()) return BUILTIN_STARTER_MEDIA[surface];
  try {
    const rows = await query<StarterMedia>(`
      SELECT j.job_id AS id, COALESCE(NULLIF(j.engine_label, ''), 'Sample') AS title,
             CASE WHEN $2 = 'audio' THEN j.audio_url ELSE j.thumb_url END AS src,
             COALESCE(j.prompt, '') AS prompt
        FROM playlists p JOIN playlist_items pi ON pi.playlist_id = p.id
        JOIN app_jobs j ON j.job_id = pi.video_id
       WHERE p.slug = $1 AND p.is_public = TRUE
         AND j.visibility = 'public' AND COALESCE(j.indexable, TRUE)
         AND j.hidden IS NOT TRUE AND j.surface = $2
       ORDER BY pi.order_index ASC, pi.created_at ASC LIMIT 12
    `, [STARTER_MEDIA_SLUGS[surface], surface]);
    const media = rows.filter(item => isPublicStarterMediaUrl(item.src));
    return media.length ? media : BUILTIN_STARTER_MEDIA[surface];
  } catch {
    // Bundled public samples remain usable before the optional playlist migration.
    return BUILTIN_STARTER_MEDIA[surface];
  }
}
