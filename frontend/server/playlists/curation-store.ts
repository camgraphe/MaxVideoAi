import { createHash } from 'node:crypto';
import { query, type QueryExecutor } from '@/lib/db';
import { getDiscoverableExampleEngineAliases, isDiscoverableExampleEngine } from '@/lib/examples/discovery';
import { getExampleFamilyEngineAliases, getExampleFamilyIds, getExampleModelEngineAliases } from '@/lib/model-families';
import { getExamplesHubPlaylistSlug } from './slugs';
import type { CurationDraft, CurationSnapshot } from '@/lib/admin/playlist-curation';

export class CurationError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export const curationFingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function getCurationAliases(slug: string): string[] | null {
  if (slug === getExamplesHubPlaylistSlug()) return getDiscoverableExampleEngineAliases();
  if (slug.startsWith('family-') && getExampleFamilyIds().some(id => slug === `family-${id}`)) {
    return getExampleFamilyEngineAliases(slug.slice(7));
  }
  if (slug.startsWith('examples-') && isDiscoverableExampleEngine(slug.slice(9))) {
    return getExampleModelEngineAliases(slug.slice(9));
  }
  return null;
}

export async function curationSchemaAvailable(db: QueryExecutor = { query }) {
  const rows = await db.query<{ name: string | null }>("SELECT to_regclass('public.playlist_curations')::text AS name");
  return Boolean(rows[0]?.name);
}
export async function lockCuration(db: QueryExecutor, playlistId: string) {
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`playlist-curation:${playlistId}`]);
}
export async function assertLegacyPlaylistEditable(db: QueryExecutor, playlistId: string) {
  await lockCuration(db, playlistId);
  if (!(await curationSchemaAvailable(db))) return;
  const rows = await db.query('SELECT 1 FROM playlist_curations WHERE playlist_id=$1', [playlistId]);
  if (rows.length) throw new CurationError('This destination uses Site placements. Edit its selection there.');
}

export async function readCurationSnapshot(playlistId: string, db: QueryExecutor = { query }): Promise<CurationSnapshot> {
  const [playlist] = await db.query<{ slug: string; is_public: boolean; updated_at: string }>('SELECT slug,is_public,updated_at FROM playlists WHERE id=$1', [playlistId]);
  if (!playlist) throw new CurationError('Destination not found', 404);
  const available = await curationSchemaAvailable(db);
  const [saved] = available ? await db.query<{ mode: CurationDraft['mode']; ordered_ids: string[]; excluded_ids: string[]; revision: string }>('SELECT mode,ordered_ids,excluded_ids,revision::text FROM playlist_curations WHERE playlist_id=$1', [playlistId]) : [];
  const items = await db.query<{ video_id: string; order_index: number; pinned: boolean }>('SELECT video_id,order_index,pinned FROM playlist_items WHERE playlist_id=$1 ORDER BY order_index DESC,video_id', [playlistId]);
  return {
    available, supported: getCurationAliases(playlist.slug) !== null, slug: playlist.slug, isPublic: playlist.is_public,
    config: saved ? { mode: saved.mode, orderedIds: saved.ordered_ids, excludedIds: saved.excluded_ids } : null,
    revision: curationFingerprint({ playlist, saved: saved ?? null, items }),
    legacyIds: items.map(item => item.video_id),
  };
}
