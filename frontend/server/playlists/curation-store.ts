import { assertDestinationWritable, DestinationWriteError } from './destination-protection';
import { createHash } from 'node:crypto';
import { query, type QueryExecutor } from '@/lib/db';
import { getDiscoverableExampleEngineAliases, isDiscoverableExampleEngine } from '@/lib/examples/discovery';
import { getExampleFamilyEngineAliases, getExampleFamilyIds, getExampleModelEngineAliases } from '@/lib/model-families';
import { getExamplesHubPlaylistSlug, getFamilyFeedSourceSlugs } from './slugs';
import type { CurationDraft, CurationSnapshot } from '@/lib/admin/playlist-curation';

export class CurationError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export const curationFingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function getCurationAliases(slug: string): string[] | null {
  if (slug === getExamplesHubPlaylistSlug()) return getDiscoverableExampleEngineAliases();
  if (slug.startsWith('family-') && getExampleFamilyIds().some((id) => slug === `family-${id}`)) {
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
  // Serialize curated and legacy selection writers, including inherited sources.
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended('playlist-curation-writers', 0))");
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`playlist-curation:${playlistId}`]);
}
export async function assertLegacyPlaylistEditable(db: QueryExecutor, playlistId: string) {
  await lockCuration(db, playlistId);
  try { await assertDestinationWritable(db, playlistId); }
  catch (error) {
    if (error instanceof DestinationWriteError) throw new CurationError(error.message, error.status);
    throw error;
  }
  if (!(await curationSchemaAvailable(db))) return;
  const rows = await db.query('SELECT 1 FROM playlist_curations WHERE playlist_id=$1', [playlistId]);
  if (rows.length) throw new CurationError('This destination uses Site placements. Edit its selection there.');
}

export type SavedCurationRow = { mode: CurationDraft['mode']; ordered_ids: string[]; excluded_ids: string[]; revision: string; opening_ids: CurationDraft['openingIds'] };
type SnapshotItem = { video_id: string; order_index: number; pinned: boolean };
export type CurationSnapshotState = {
  available: boolean; openingAvailable: boolean;
  playlist: { slug: string; is_public: boolean; updated_at: string };
  saved: SavedCurationRow | null; items: SnapshotItem[]; inherited: unknown;
};

/** Preserve the historical JSON property order: existing preview tokens bind these exact bytes. */
function normalizeSavedCuration(row: SavedCurationRow): SavedCurationRow {
  return { mode: row.mode, ordered_ids: row.ordered_ids, excluded_ids: row.excluded_ids,
    revision: row.revision, opening_ids: row.opening_ids ?? null };
}

export function snapshotFromCurationState(state: CurationSnapshotState): CurationSnapshot {
  const { available, openingAvailable, playlist, saved, items, inherited } = state;
  return {
    available, openingAvailable, supported: getCurationAliases(playlist.slug) !== null,
    slug: playlist.slug, isPublic: playlist.is_public,
    config: saved ? { mode: saved.mode, orderedIds: saved.ordered_ids, excludedIds: saved.excluded_ids, openingIds: saved.opening_ids ?? null } : null,
    revision: curationFingerprint({ playlist, saved, items, inherited }), legacyIds: items.map(item => item.video_id),
  };
}

/** Only use with the row actually returned by the write while the source tables remain locked. */
export function snapshotAfterCurationSave(state: CurationSnapshotState, saved: SavedCurationRow): CurationSnapshot {
  return snapshotFromCurationState({ ...state, saved: normalizeSavedCuration(saved), inherited: null });
}

export async function readCurationSnapshotState(
  playlistId: string, db: QueryExecutor, options: { curationTableLocked?: true } = {},
): Promise<CurationSnapshotState> {
  // A successful SHARE table lock establishes existence. Do not reuse a pre-lock
  // snapshot: opening-column availability and all row facts are still read below.
  const available = options.curationTableLocked === true || await curationSchemaAvailable(db);
  const [row] = await db.query<CurationSnapshotState['playlist'] & SavedCurationRow & { items: SnapshotItem[]; opening_available: boolean }>(
    `SELECT p.slug,p.is_public,p.updated_at,
      ${available ? "c.mode,c.ordered_ids,c.excluded_ids,c.revision::text,to_jsonb(c)->'opening_ids' AS opening_ids" : 'NULL AS mode,NULL AS ordered_ids,NULL AS excluded_ids,NULL AS revision,NULL AS opening_ids'},
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
        AND table_name='playlist_curations' AND column_name='opening_ids') AS opening_available,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('video_id',pi.video_id,'order_index',pi.order_index,'pinned',pi.pinned)
        ORDER BY pi.order_index DESC,pi.video_id) FROM playlist_items pi WHERE pi.playlist_id=p.id),'[]'::jsonb) AS items
      FROM playlists p ${available ? 'LEFT JOIN playlist_curations c ON c.playlist_id=p.id' : ''} WHERE p.id=$1`, [playlistId],
  );
  if (!row) throw new CurationError('Destination not found', 404);
  const playlist = { slug: row.slug, is_public: row.is_public, updated_at: row.updated_at };
  const saved = row.mode ? normalizeSavedCuration(row) : null;
  const items = row.items.map(item => ({ video_id: item.video_id, order_index: item.order_index, pinned: item.pinned }));
  let inherited: unknown = null;
  if (!saved && playlist.slug.startsWith('family-') && getCurationAliases(playlist.slug) !== null) {
    const slugs = getFamilyFeedSourceSlugs(playlist.slug.slice(7));
    const sources = await db.query(
      'SELECT id,slug,is_public,updated_at FROM playlists WHERE slug=ANY($1::text[]) ORDER BY slug',
      [slugs],
    );
    const sourceItems = await db.query(
      'SELECT pi.playlist_id,pi.video_id,pi.order_index,pi.pinned FROM playlist_items pi JOIN playlists p ON p.id=pi.playlist_id WHERE p.slug=ANY($1::text[]) ORDER BY p.slug,pi.order_index DESC,pi.video_id',
      [slugs],
    );
    const sourceCurations = available
      ? await db.query(
          'SELECT c.* FROM playlist_curations c JOIN playlists p ON p.id=c.playlist_id WHERE p.slug=ANY($1::text[]) ORDER BY p.slug',
          [slugs],
        )
      : [];
    inherited = { sources, sourceItems, sourceCurations };
  }
  return { available, openingAvailable: available && row.opening_available === true, playlist, saved, items, inherited };
}

export async function readCurationSnapshot(playlistId: string, db: QueryExecutor = { query }): Promise<CurationSnapshot> {
  return snapshotFromCurationState(await readCurationSnapshotState(playlistId, db));
}
