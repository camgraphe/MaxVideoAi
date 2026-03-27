import { query, type QueryExecutor } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';
import { getIndexablePlaylistSlugs } from '@/server/indexing';

export type PlaylistKind = 'core' | 'model' | 'draft';

class LockedPlaylistError extends Error {
  constructor(message = 'This collection is locked by runtime configuration') {
    super(message);
    this.name = 'LockedPlaylistError';
  }
}

export type PlaylistRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  siteVisibleCount: number;
  withVideoAssetCount: number;
  lastAddedAt: string | null;
  kind: PlaylistKind;
  isLocked: boolean;
  usageTargets: string[];
};

export type PlaylistItemRecord = {
  playlistId: string;
  videoId: string;
  orderIndex: number;
  pinned: boolean;
  createdAt: string;
  thumbUrl?: string | null;
  videoUrl?: string | null;
  engineLabel?: string | null;
  aspectRatio?: string | null;
  prompt?: string | null;
  durationSec?: number | null;
  visibility: 'public' | 'private';
  indexable: boolean;
  isPublishedOnSite: boolean;
};

export type PlaylistCandidateRecord = {
  id: string;
  engineId: string | null;
  engineLabel: string | null;
  prompt: string;
  createdAt: string;
  thumbUrl: string | null;
  videoUrl: string | null;
  aspectRatio: string | null;
};

type PlaylistSummaryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  item_count: string;
  site_visible_count: string;
  with_video_asset_count: string;
  last_added_at: string | null;
};

type PlaylistItemRow = {
  playlist_id: string;
  video_id: string;
  order_index: number;
  pinned: boolean;
  created_at: string;
  thumb_url: string | null;
  video_url: string | null;
  engine_label: string | null;
  aspect_ratio: string | null;
  prompt: string | null;
  duration_sec: number | null;
  visibility: string | null;
  indexable: boolean | null;
};

type MutablePlaylistFields = Partial<{
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  userId: string | null;
}>;

function getStarterPlaylistSlug(): string {
  const slug = process.env.STARTER_PLAYLIST_SLUG?.trim();
  return slug?.length ? slug : 'starter';
}

function compareDatesDescending(a?: string | null, b?: string | null) {
  const aTime = a ? Date.parse(a) : Number.NaN;
  const bTime = b ? Date.parse(b) : Number.NaN;
  const safeA = Number.isFinite(aTime) ? aTime : 0;
  const safeB = Number.isFinite(bTime) ? bTime : 0;
  return safeB - safeA;
}

function getPlaylistUsageTargets(slug: string): string[] {
  const targets: string[] = [];
  const starterSlug = getStarterPlaylistSlug().toLowerCase();
  const normalizedSlug = slug.trim().toLowerCase();
  const indexableSlugs = new Set(getIndexablePlaylistSlugs().map((entry) => entry.trim().toLowerCase()));

  if (normalizedSlug === starterSlug) {
    targets.push('starter-tab');
  }
  if (indexableSlugs.has(normalizedSlug)) {
    targets.push('examples-hub');
  }
  if (normalizedSlug.startsWith('examples-')) {
    targets.push(`model-page:${normalizedSlug.slice('examples-'.length)}`);
  }

  return targets;
}

function isLockedPlaylistSlug(slug: string): boolean {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return false;
  if (normalizedSlug === getStarterPlaylistSlug().toLowerCase()) {
    return true;
  }
  if (getIndexablePlaylistSlugs().some((entry) => entry.trim().toLowerCase() === normalizedSlug)) {
    return true;
  }
  return normalizedSlug.startsWith('examples-');
}

function getPlaylistKind(slug: string, itemCount: number): PlaylistKind {
  const normalizedSlug = slug.trim().toLowerCase();
  if (normalizedSlug === getStarterPlaylistSlug().toLowerCase()) {
    return 'core';
  }
  if (getIndexablePlaylistSlugs().some((entry) => entry.trim().toLowerCase() === normalizedSlug)) {
    return 'core';
  }
  if (normalizedSlug.startsWith('examples-') && itemCount > 0) {
    return 'model';
  }
  return 'draft';
}

function mapPlaylistRow(row: PlaylistSummaryRow): PlaylistRecord {
  const itemCount = Number(row.item_count ?? '0');
  const slug = row.slug;

  return {
    id: row.id,
    slug,
    name: row.name,
    description: row.description,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    itemCount,
    siteVisibleCount: Number(row.site_visible_count ?? '0'),
    withVideoAssetCount: Number(row.with_video_asset_count ?? '0'),
    lastAddedAt: row.last_added_at ?? null,
    kind: getPlaylistKind(slug, itemCount),
    isLocked: isLockedPlaylistSlug(slug),
    usageTargets: getPlaylistUsageTargets(slug),
  };
}

function getPlaylistPriority(playlist: Pick<PlaylistRecord, 'kind' | 'slug' | 'usageTargets'>): number {
  if (playlist.usageTargets.includes('starter-tab')) {
    return 0;
  }
  if (playlist.usageTargets.includes('examples-hub')) {
    return 1;
  }
  return 2;
}

function comparePlaylists(a: PlaylistRecord, b: PlaylistRecord) {
  const kindWeight: Record<PlaylistKind, number> = { core: 0, model: 1, draft: 2 };
  if (kindWeight[a.kind] !== kindWeight[b.kind]) {
    return kindWeight[a.kind] - kindWeight[b.kind];
  }
  const priorityDelta = getPlaylistPriority(a) - getPlaylistPriority(b);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }
  if (a.itemCount !== b.itemCount) {
    return b.itemCount - a.itemCount;
  }
  const lastAddedDelta = compareDatesDescending(a.lastAddedAt, b.lastAddedAt);
  if (lastAddedDelta !== 0) {
    return lastAddedDelta;
  }
  return a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
}

async function listPlaylistRows(whereClause = '', params?: ReadonlyArray<unknown>): Promise<PlaylistSummaryRow[]> {
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

async function getPlaylistRecordById(playlistId: string): Promise<PlaylistRecord | null> {
  const rows = await listPlaylistRows('p.id = $1', [playlistId]);
  const row = rows[0];
  return row ? mapPlaylistRow(row) : null;
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

export async function listPlaylists(): Promise<PlaylistRecord[]> {
  const rows = await listPlaylistRows();
  return rows.map(mapPlaylistRow).sort(comparePlaylists);
}

export async function getPlaylist(playlistId: string): Promise<PlaylistRecord | null> {
  return getPlaylistRecordById(playlistId);
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

  return rows.map((row) => {
    const visibility = row.visibility === 'private' ? 'private' : 'public';
    const indexable = Boolean(row.indexable ?? true);
    return {
      playlistId: row.playlist_id,
      videoId: row.video_id,
      orderIndex: row.order_index,
      pinned: row.pinned,
      createdAt: row.created_at,
      thumbUrl: normalizeMediaUrl(row.thumb_url) ?? row.thumb_url ?? null,
      videoUrl: normalizeMediaUrl(row.video_url) ?? row.video_url ?? null,
      engineLabel: row.engine_label ?? null,
      aspectRatio: row.aspect_ratio ?? null,
      prompt: row.prompt ?? null,
      durationSec: row.duration_sec ?? null,
      visibility,
      indexable,
      isPublishedOnSite: visibility === 'public' && indexable,
    };
  });
}

export async function createPlaylist(payload: {
  slug: string;
  name: string;
  description?: string | null;
  isPublic?: boolean;
  userId?: string | null;
}): Promise<PlaylistRecord> {
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
    siteVisibleCount: 0,
    withVideoAssetCount: 0,
    lastAddedAt: null,
    kind: getPlaylistKind(row.slug, 0),
    isLocked: isLockedPlaylistSlug(row.slug),
    usageTargets: getPlaylistUsageTargets(row.slug),
  };
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

export async function searchPlaylistCandidates(options: {
  q?: string | null;
  engine?: string | null;
  limit?: number;
}): Promise<PlaylistCandidateRecord[]> {
  const q = options.q?.trim() ?? '';
  const engine = options.engine?.trim() ?? '';
  const limit = Number.isFinite(options.limit) ? Math.min(Math.max(Number(options.limit), 1), 40) : 18;
  const params: unknown[] = [];
  const clauses = [
    `COALESCE(hidden, FALSE) = FALSE`,
    `visibility = 'public'`,
    `COALESCE(indexable, TRUE) = TRUE`,
    `COALESCE(video_url, '') <> ''`,
    `COALESCE(thumb_url, '') <> ''`,
  ];

  if (q.length) {
    params.push(`%${q}%`);
    const qIndex = params.length;
    clauses.push(`(
      job_id ILIKE $${qIndex}
      OR prompt ILIKE $${qIndex}
      OR COALESCE(engine_id, '') ILIKE $${qIndex}
      OR COALESCE(engine_label, '') ILIKE $${qIndex}
    )`);
  }

  if (engine.length) {
    params.push(`%${engine}%`);
    const engineIndex = params.length;
    clauses.push(`(
      COALESCE(engine_id, '') ILIKE $${engineIndex}
      OR COALESCE(engine_label, '') ILIKE $${engineIndex}
    )`);
  }

  params.push(limit);
  const limitIndex = params.length;

  const rows = await query<{
    job_id: string;
    engine_id: string | null;
    engine_label: string | null;
    prompt: string | null;
    created_at: string;
    thumb_url: string | null;
    video_url: string | null;
    aspect_ratio: string | null;
  }>(
    `SELECT job_id, engine_id, engine_label, prompt, created_at, thumb_url, video_url, aspect_ratio
       FROM app_jobs
      WHERE ${clauses.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${limitIndex}`,
    params
  );

  return rows.map((row) => ({
    id: row.job_id,
    engineId: row.engine_id ?? null,
    engineLabel: row.engine_label ?? null,
    prompt: row.prompt?.trim() || 'Untitled render',
    createdAt: row.created_at,
    thumbUrl: normalizeMediaUrl(row.thumb_url) ?? row.thumb_url ?? null,
    videoUrl: normalizeMediaUrl(row.video_url) ?? row.video_url ?? null,
    aspectRatio: row.aspect_ratio ?? null,
  }));
}

export function isPlaylistLockedError(error: unknown): error is LockedPlaylistError {
  return error instanceof LockedPlaylistError;
}
