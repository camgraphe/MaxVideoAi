import { query } from '@/lib/db';
import {
  mapPlaylistItemRow,
  mapPlaylistRow,
  type PlaylistItemRow,
  type PlaylistSummaryRow,
} from './mappers';
import { comparePlaylists } from './runtime-meta';
import type { PlaylistItemRecord, PlaylistRecord } from './types';

export async function listPlaylistRows(whereClause = '', params?: ReadonlyArray<unknown>): Promise<PlaylistSummaryRow[]> {
  return query<PlaylistSummaryRow>(
    `SELECT
        p.id,
        p.slug,
        p.name,
        p.description,
        p.is_public,
        p.created_at,
        p.updated_at,
        COALESCE(stats.item_count, '0') AS item_count,
        COALESCE(stats.site_visible_count, '0') AS site_visible_count,
        COALESCE(stats.with_video_asset_count, '0') AS with_video_asset_count,
        stats.last_added_at
      FROM playlists p
      LEFT JOIN (
        SELECT
          pi.playlist_id,
          COUNT(*)::text AS item_count,
          COUNT(*) FILTER (
            WHERE aj.visibility = 'public'
              AND COALESCE(aj.indexable, TRUE) = TRUE
          )::text AS site_visible_count,
          COUNT(*) FILTER (
            WHERE COALESCE(aj.video_url, '') <> ''
          )::text AS with_video_asset_count,
          MAX(pi.created_at) AS last_added_at
        FROM playlist_items pi
        LEFT JOIN app_jobs aj ON aj.job_id = pi.video_id
        GROUP BY pi.playlist_id
      ) stats ON stats.playlist_id = p.id
      ${whereClause ? `WHERE ${whereClause}` : ''}
      ORDER BY p.slug ASC`,
    params
  );
}

export async function getPlaylistRecordById(playlistId: string): Promise<PlaylistRecord | null> {
  const rows = await listPlaylistRows('p.id = $1', [playlistId]);
  const row = rows[0];
  return row ? mapPlaylistRow(row) : null;
}

export async function getPlaylistRecordBySlug(slug: string): Promise<PlaylistRecord | null> {
  const rows = await listPlaylistRows('LOWER(p.slug) = LOWER($1)', [slug]);
  const row = rows[0];
  return row ? mapPlaylistRow(row) : null;
}

export async function listPlaylists(): Promise<PlaylistRecord[]> {
  const rows = await listPlaylistRows();
  return rows.map(mapPlaylistRow).sort(comparePlaylists);
}

export async function getPlaylist(playlistId: string): Promise<PlaylistRecord | null> {
  return getPlaylistRecordById(playlistId);
}

export async function getPlaylistBySlug(slug: string): Promise<PlaylistRecord | null> {
  return getPlaylistRecordBySlug(slug);
}

export async function getPlaylistItems(playlistId: string): Promise<PlaylistItemRecord[]> {
  const rows = await query<PlaylistItemRow>(
    `SELECT
        pi.playlist_id,
        pi.video_id,
        pi.order_index,
        pi.pinned,
        pi.created_at,
        j.thumb_url,
        j.video_url,
        j.engine_label,
        j.aspect_ratio,
        j.prompt,
        j.duration_sec,
        j.visibility,
        j.indexable
      FROM playlist_items pi
      LEFT JOIN app_jobs j ON j.job_id = pi.video_id
      WHERE pi.playlist_id = $1
      ORDER BY pi.order_index ASC, pi.created_at ASC`,
    [playlistId]
  );

  return rows.map(mapPlaylistItemRow);
}
