import { query, type QueryExecutor } from '@/lib/db';
import {
  mapCreatedPlaylistRow,
  type CreatedPlaylistRow,
} from './mappers';
import { getPlaylistRecordById } from './queries';
import type { MutablePlaylistFields, PlaylistRecord } from './types';

export class LockedPlaylistError extends Error {
  constructor(message = 'This collection is locked by runtime configuration') {
    super(message);
    this.name = 'LockedPlaylistError';
  }
}

async function assertPlaylistCanEditDetails(playlistId: string): Promise<PlaylistRecord> {
  const playlist = await getPlaylistRecordById(playlistId);
  if (!playlist) {
    throw new Error('Playlist not found');
  }
  if (playlist.isLocked) {
    throw new LockedPlaylistError();
  }
  return playlist;
}

export async function createPlaylist(payload: {
  slug: string;
  name: string;
  description?: string | null;
  isPublic?: boolean;
  userId?: string | null;
}): Promise<PlaylistRecord> {
  const rows = await query<CreatedPlaylistRow>(
    `INSERT INTO playlists (slug, name, description, is_public, created_by, updated_by)
     VALUES ($1, $2, $3, COALESCE($4, TRUE), $5, $5)
     RETURNING id, slug, name, description, is_public, created_at, updated_at`,
    [payload.slug, payload.name, payload.description ?? null, payload.isPublic, payload.userId ?? null]
  );

  const row = rows[0];
  if (!row) {
    throw new Error('Failed to create playlist');
  }

  return mapCreatedPlaylistRow(row);
}

export async function updatePlaylist(playlistId: string, payload: MutablePlaylistFields): Promise<void> {
  await assertPlaylistCanEditDetails(playlistId);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (typeof payload.slug === 'string') {
    params.push(payload.slug);
    updates.push(`slug = $${params.length}`);
  }
  if (typeof payload.name === 'string') {
    params.push(payload.name);
    updates.push(`name = $${params.length}`);
  }
  if (payload.description !== undefined) {
    params.push(payload.description);
    updates.push(`description = $${params.length}`);
  }
  if (typeof payload.isPublic === 'boolean') {
    params.push(payload.isPublic);
    updates.push(`is_public = $${params.length}`);
  }

  if (!updates.length) {
    return;
  }

  const updatedByIndex = params.length + 1;
  const playlistIdIndex = params.length + 2;
  params.push(payload.userId ?? null);
  params.push(playlistId);

  await query(
    `UPDATE playlists
     SET ${updates.join(', ')}, updated_at = NOW(), updated_by = $${updatedByIndex}
     WHERE id = $${playlistIdIndex}`,
    params
  );
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  await assertPlaylistCanEditDetails(playlistId);
  await query(`DELETE FROM playlist_items WHERE playlist_id = $1`, [playlistId]);
  await query(`DELETE FROM playlists WHERE id = $1`, [playlistId]);
}

export async function appendPlaylistItem(playlistId: string, videoId: string): Promise<void> {
  await appendPlaylistItemWithExecutor({ query }, playlistId, videoId);
}

export async function removePlaylistItem(playlistId: string, videoId: string): Promise<void> {
  await query(`DELETE FROM playlist_items WHERE playlist_id = $1 AND video_id = $2`, [playlistId, videoId]);
}

export async function reorderPlaylistItems(
  playlistId: string,
  order: Array<{ videoId: string; pinned?: boolean }>
): Promise<void> {
  await query(`DELETE FROM playlist_items WHERE playlist_id = $1`, [playlistId]);
  if (!order.length) return;

  const values: unknown[] = [];
  const inserts: string[] = [];
  order.forEach((item, index) => {
    values.push(playlistId, item.videoId, index, Boolean(item.pinned));
    const base = values.length;
    inserts.push(`($${base - 3}, $${base - 2}, $${base - 1}, $${base})`);
  });

  await query(
    `INSERT INTO playlist_items (playlist_id, video_id, order_index, pinned)
     VALUES ${inserts.join(', ')}`,
    values
  );
}

async function appendPlaylistItemWithExecutor(executor: QueryExecutor, playlistId: string, videoId: string): Promise<void> {
  const rows = await executor.query<{ max: number }>(
    `SELECT COALESCE(MAX(order_index), 0) AS max FROM playlist_items WHERE playlist_id = $1`,
    [playlistId]
  );
  const nextOrder = Number(rows[0]?.max ?? 0) + 1;
  await executor.query(
    `INSERT INTO playlist_items (playlist_id, video_id, order_index)
     VALUES ($1, $2, $3)
     ON CONFLICT (playlist_id, video_id)
     DO UPDATE SET order_index = EXCLUDED.order_index, pinned = FALSE`,
    [playlistId, videoId, nextOrder]
  );
}

export function isPlaylistLockedError(error: unknown): error is LockedPlaylistError {
  return error instanceof LockedPlaylistError;
}
