import { query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';

export type PlaylistRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
};

export type PlaylistItemRecord = {
  playlistId: string;
  videoId: string;
  orderIndex: number;
  pinned: boolean;
  createdAt: string;
};

export async function listPlaylists(): Promise<PlaylistRecord[]> {
  await ensureBillingSchema();
  const rows = await query<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    is_public: boolean;
    created_at: string;
    updated_at: string;
    item_count: string;
  }>(
    `SELECT p.id, p.slug, p.name, p.description, p.is_public, p.created_at, p.updated_at,
            COALESCE(pi.count, '0') AS item_count
       FROM playlists p
       LEFT JOIN (
         SELECT playlist_id, COUNT(*)::text AS count
         FROM playlist_items
         GROUP BY playlist_id
       ) pi ON pi.playlist_id = p.id
       ORDER BY p.updated_at DESC`
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    itemCount: Number(row.item_count ?? '0'),
  }));
}

export async function getPlaylistItems(playlistId: string): Promise<PlaylistItemRecord[]> {
  await ensureBillingSchema();
  const rows = await query<{
    playlist_id: string;
    video_id: string;
    order_index: number;
    pinned: boolean;
    created_at: string;
  }>(
    `SELECT playlist_id, video_id, order_index, pinned, created_at
       FROM playlist_items
       WHERE playlist_id = $1
       ORDER BY order_index ASC, created_at ASC`,
    [playlistId]
  );

  return rows.map((row) => ({
    playlistId: row.playlist_id,
    videoId: row.video_id,
    orderIndex: row.order_index,
    pinned: row.pinned,
    createdAt: row.created_at,
  }));
}

export async function createPlaylist(payload: {
  slug: string;
  name: string;
  description?: string | null;
  isPublic?: boolean;
  userId?: string | null;
}): Promise<PlaylistRecord> {
  await ensureBillingSchema();
  const rows = await query<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    is_public: boolean;
    created_at: string;
    updated_at: string;
  }>(
    `INSERT INTO playlists (slug, name, description, is_public, created_by, updated_by)
     VALUES ($1, $2, $3, COALESCE($4, TRUE), $5, $5)
     RETURNING id, slug, name, description, is_public, created_at, updated_at`,
    [payload.slug, payload.name, payload.description ?? null, payload.isPublic, payload.userId ?? null]
  );

  const row = rows[0];
  if (!row) {
    throw new Error('Failed to create playlist');
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    itemCount: 0,
  };
}

export async function updatePlaylist(
  playlistId: string,
  payload: Partial<{ slug: string; name: string; description: string | null; isPublic: boolean; userId: string | null }>
): Promise<void> {
  await ensureBillingSchema();

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
  await ensureBillingSchema();
  await query(`DELETE FROM playlist_items WHERE playlist_id = $1`, [playlistId]);
  await query(`DELETE FROM playlists WHERE id = $1`, [playlistId]);
}

export async function appendPlaylistItem(playlistId: string, videoId: string): Promise<void> {
  await ensureBillingSchema();
  const rows = await query<{ max: number }>(
    `SELECT COALESCE(MAX(order_index), 0) AS max FROM playlist_items WHERE playlist_id = $1`,
    [playlistId]
  );
  const nextOrder = Number(rows[0]?.max ?? 0) + 1;
  await query(
    `INSERT INTO playlist_items (playlist_id, video_id, order_index)
     VALUES ($1, $2, $3)
     ON CONFLICT (playlist_id, video_id)
     DO UPDATE SET order_index = EXCLUDED.order_index, pinned = FALSE`,
    [playlistId, videoId, nextOrder]
  );
}

export async function removePlaylistItem(playlistId: string, videoId: string): Promise<void> {
  await ensureBillingSchema();
  await query(
    `DELETE FROM playlist_items WHERE playlist_id = $1 AND video_id = $2`,
    [playlistId, videoId]
  );
}

export async function reorderPlaylistItems(
  playlistId: string,
  order: Array<{ videoId: string; pinned?: boolean }>
): Promise<void> {
  await ensureBillingSchema();
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
