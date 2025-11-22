import { DEFAULT_INDEXABLE_PLAYLIST_SLUGS } from '@/config/playlists';
import { query } from '@/lib/db';

function parseSlugList(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  const parts = raw
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  parts.forEach((slug) => {
    const normalized = slug.toLowerCase();
    if (seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(slug);
  });
  return result;
}

export function getIndexablePlaylistSlugs(): string[] {
  const multi = parseSlugList(process.env.INDEXABLE_PLAYLIST_SLUGS);
  if (multi.length) {
    return multi;
  }
  const fallbackList = parseSlugList(process.env.EXAMPLES_PLAYLIST_SLUG);
  if (fallbackList.length) {
    return fallbackList;
  }
  return Array.from(new Set(DEFAULT_INDEXABLE_PLAYLIST_SLUGS));
}

export async function removeVideosFromIndexablePlaylists(videoIds: string[]): Promise<number> {
  const slugs = getIndexablePlaylistSlugs();
  if (!slugs.length) {
    return 0;
  }
  const uniqueIds = Array.from(new Set(videoIds.filter((value) => typeof value === 'string' && value.trim().length)));
  if (!uniqueIds.length) {
    return 0;
  }

  const rows = await query<{ count: string }>(
    `
      WITH deleted AS (
        DELETE FROM playlist_items
        WHERE video_id = ANY($1::text[])
          AND playlist_id IN (
            SELECT id FROM playlists WHERE slug = ANY($2::text[])
          )
        RETURNING 1
      )
      SELECT COUNT(*)::text AS count FROM deleted
    `,
    [uniqueIds, slugs]
  );

  return Number(rows[0]?.count ?? '0');
}

export async function removeUserVideosFromIndexablePlaylists(userId: string): Promise<number> {
  const slugs = getIndexablePlaylistSlugs();
  if (!slugs.length) {
    return 0;
  }

  const rows = await query<{ count: string }>(
    `
      WITH deleted AS (
        DELETE FROM playlist_items
        WHERE playlist_id IN (
          SELECT id FROM playlists WHERE slug = ANY($2::text[])
        )
          AND video_id IN (
            SELECT job_id FROM app_jobs WHERE user_id = $1
          )
        RETURNING 1
      )
      SELECT COUNT(*)::text AS count FROM deleted
    `,
    [userId, slugs]
  );

  return Number(rows[0]?.count ?? '0');
}
