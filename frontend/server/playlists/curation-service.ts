import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import {
  parseCurationDraft,
  resolveCuration,
  type CurationDraft,
  type CurationItem,
  type CurationPreview,
} from '@/lib/admin/playlist-curation';
import {
  CurationError,
  curationFingerprint,
  getCurationAliases,
  lockCuration,
  readCurationSnapshot,
} from './curation-store';
export { CurationError } from './curation-store';
export const getCurationSnapshot = readCurationSnapshot;

export const CURATION_ELIGIBILITY = `visibility='public' AND indexable IS TRUE
  AND status='completed' AND COALESCE(surface,'video')='video'
  AND NULLIF(BTRIM(video_url),'') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM job_outputs removed WHERE removed.job_id=app_jobs.job_id
    AND removed.kind='video' AND removed.status='deleted' AND COALESCE(removed.url,removed.storage_url)=app_jobs.video_url)
  AND NOT EXISTS (SELECT 1 FROM media_assets removed WHERE removed.user_id=app_jobs.user_id
    AND removed.url=app_jobs.video_url AND (removed.deleted_at IS NOT NULL OR removed.status='deleted'))`;

export async function listCurationCandidates(slug: string, db: QueryExecutor = { query }): Promise<CurationItem[]> {
  const aliases = getCurationAliases(slug);
  if (!aliases) throw new CurationError('Automatic curation is not supported for this destination', 400);
  const rows = await db.query<{
    job_id: string;
    engine_id: string;
    engine_label: string | null;
    prompt: string | null;
    thumb_url: string | null;
    video_url: string;
    created_at: string;
  }>(
    `SELECT job_id,engine_id,engine_label,prompt,thumb_url,video_url,created_at
     FROM app_jobs WHERE ${CURATION_ELIGIBILITY}
       AND LOWER(engine_id)=ANY($1::text[])
     ORDER BY created_at DESC, job_id ASC`,
    [aliases.map((alias) => alias.toLowerCase())],
  );
  return rows.map((row) => ({
    id: row.job_id,
    engineId: row.engine_id,
    engineLabel: row.engine_label,
    prompt: row.prompt ?? '',
    thumbUrl: row.thumb_url,
    videoUrl: row.video_url,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

async function buildPreview(
  playlistId: string,
  input: unknown,
  revision: string,
  db: QueryExecutor,
): Promise<CurationPreview> {
  const draft = parseCurationDraft(input);
  const snapshot = await readCurationSnapshot(playlistId, db);
  if (!snapshot.available) throw new CurationError('Site placements setup is not available yet', 503);
  if (!snapshot.supported) throw new CurationError('Curation is not supported for this destination', 400);
  if (snapshot.revision !== revision) throw new CurationError('This destination changed. Reload it before saving.');
  const candidates = await listCurationCandidates(snapshot.slug, db);
  const eligible = new Set(candidates.map((item) => item.id));
  if (draft.orderedIds.some((id) => !eligible.has(id)))
    throw new CurationError('Some selected media are no longer eligible. Reload the destination.');
  const items = snapshot.isPublic ? resolveCuration(draft, candidates) : [];
  return { items, revision, token: curationFingerprint({ revision, draft, items }) };
}
export async function previewCuration(playlistId: string, draft: unknown, revision: string) {
  return buildPreview(playlistId, draft, revision, { query });
}
export async function saveCuration(
  playlistId: string,
  input: unknown,
  revision: string,
  token: string,
  actor: string | null,
) {
  return withDbTransaction(async (db) => {
    await lockCuration(db, playlistId);
    const before = await readCurationSnapshot(playlistId, db);
    if (!before.config && before.slug.startsWith('family-')) {
      // Also guard uncoordinated source creation/deletion during first adoption.
      await db.query('LOCK TABLE playlists, playlist_items IN SHARE MODE');
    }
    const preview = await buildPreview(playlistId, input, revision, db);
    if (preview.token !== token) throw new CurationError('The preview changed. Preview the page again before saving.');
    const draft = parseCurationDraft(input);
    await db.query(
      `INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids,updated_by)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(playlist_id) DO UPDATE SET
      mode=EXCLUDED.mode,ordered_ids=EXCLUDED.ordered_ids,excluded_ids=EXCLUDED.excluded_ids,
      updated_by=EXCLUDED.updated_by,updated_at=now(),revision=playlist_curations.revision+1`,
      [playlistId, draft.mode, draft.orderedIds, draft.excludedIds, actor],
    );
    return readCurationSnapshot(playlistId, db);
  });
}

/** null means legacy behavior; [] is an explicitly managed empty destination. */
export async function resolveCuratedPlaylist(slug: string): Promise<CurationItem[] | null> {
  if (!process.env.DATABASE_URL) return null;
  let rows: Array<{ is_public: boolean; mode: CurationDraft['mode']; ordered_ids: string[]; excluded_ids: string[] }>;
  try {
    rows = await query(
      `SELECT p.is_public,c.mode,c.ordered_ids,c.excluded_ids FROM playlists p
      JOIN playlist_curations c ON c.playlist_id=p.id WHERE p.slug=$1`,
      [slug],
    );
  } catch (error) {
    if ((error as { code?: string }).code === '42P01') return null;
    throw error;
  }
  const saved = rows[0];
  if (!saved) return null;
  if (!saved.is_public || getCurationAliases(slug) === null) return [];
  return resolveCuration(
    { mode: saved.mode, orderedIds: saved.ordered_ids, excludedIds: saved.excluded_ids },
    await listCurationCandidates(slug),
  );
}

export async function hasPlaylistCuration(slug: string): Promise<boolean> {
  if (!process.env.DATABASE_URL || process.env.NEXT_PHASE === 'phase-production-build') return false;
  try {
    return (
      (await query('SELECT 1 FROM playlist_curations c JOIN playlists p ON p.id=c.playlist_id WHERE p.slug=$1', [slug]))
        .length > 0
    );
  } catch (error) {
    if ((error as { code?: string }).code === '42P01') return false;
    throw error;
  }
}
