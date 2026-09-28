import { expandCatalogAliases } from './curation-eligibility';
import { guardCurationSave } from './curation-save-guard';
import { effectiveSourceSlugs, readEffectiveCurationPreview } from './curation-effective-preview';
import { assertDestinationWritable, DestinationWriteError } from './destination-protection';
import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import {
  parseCurationDraft,
  resolveCuration,
  validateCurationOpening,
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

export { CURATION_ELIGIBILITY } from './curation-eligibility';

export { listCurationCandidates } from './curation-candidates';
import { listCurationCandidates } from './curation-candidates';

async function buildPreview(
  playlistId: string,
  input: unknown,
  revision: string,
  db: QueryExecutor,
): Promise<CurationPreview> {
  try { await assertDestinationWritable(db, playlistId); }
  catch (error) {
    if (error instanceof DestinationWriteError) throw new CurationError(error.message, error.status);
    throw error;
  }
  const draft = parseCurationDraft(input);
  const snapshot = await readCurationSnapshot(playlistId, db);
  if (!snapshot.available) throw new CurationError('Site placements setup is not available yet', 503);
  if (!snapshot.supported) throw new CurationError('Curation is not supported for this destination', 400);
  if (snapshot.revision !== revision) throw new CurationError('This destination changed. Reload it before saving.');
  const candidates = await listCurationCandidates(snapshot.slug, db);
  const eligible = new Set(candidates.map((item) => item.id));
  if (draft.orderedIds.some((id) => !eligible.has(id)))
    throw new CurationError('Some selected media are no longer eligible. Reload the destination.');
  if (draft.openingIds && !snapshot.openingAvailable) throw new CurationError('The four-video opening is not available yet', 503);
  if (!snapshot.config && snapshot.slug.startsWith('family-')) {
    if (!snapshot.openingAvailable) throw new CurationError('The four-video opening is not available yet', 503);
    if (!draft.openingIds) throw new CurationError('Choose all four opening videos before adopting this family.');
  }
  try { validateCurationOpening(draft, candidates); }
  catch (error) { throw new CurationError((error as Error).message); }
  const items = snapshot.isPublic ? resolveCuration(draft, candidates) : [];
  // Catalog families include historical aliases beyond the direct model reader. Bind their
  // media too, without changing candidate selection or the public model reader's semantics.
  const eligibleMedia = snapshot.slug.startsWith('family-')
    ? await listCurationCandidates(snapshot.slug, db, expandCatalogAliases(getCurationAliases(snapshot.slug) ?? []))
    : candidates;
  const effective = await readEffectiveCurationPreview({ playlistId, slug: snapshot.slug, draft, candidates }, db);
  // Bind every source, including suppressed sources and off-page membership, to the preview.
  const sources = await db.query(`SELECT p.*,to_jsonb(c) AS curation,
    (SELECT jsonb_agg(to_jsonb(pi) ORDER BY pi.video_id) FROM playlist_items pi WHERE pi.playlist_id=p.id) AS membership
    FROM playlists p LEFT JOIN playlist_curations c ON c.playlist_id=p.id
    WHERE p.slug=ANY($1::text[]) ORDER BY p.slug`, [effectiveSourceSlugs(snapshot.slug)]);
  return { items, revision, effective, token: curationFingerprint({ revision, draft, eligibleMedia, effective, sources }) };
}
export async function previewCuration(playlistId: string, draft: unknown, revision: string) {
  return withDbTransaction(async db => {
    await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    return buildPreview(playlistId, draft, revision, db);
  });
}
export async function saveCuration(
  playlistId: string,
  input: unknown,
  revision: string,
  token: string,
  actor: string | null,
) {
  return withDbTransaction(async (transaction) => {
    await lockCuration(transaction, playlistId);
    const before = await readCurationSnapshot(playlistId, transaction);
    if (!before.available) throw new CurationError('Site placements setup is not available yet', 503);
    const db = await guardCurationSave(transaction);
    const preview = await buildPreview(playlistId, input, revision, db);
    if (preview.token !== token) throw new CurationError('The preview changed. Preview the page again before saving.');
    const draft = parseCurationDraft(input);
    const hasOpening = before.openingAvailable;
    await db.query(
      `INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids,updated_by${hasOpening ? ',opening_ids' : ''})
      VALUES($1,$2,$3,$4,$5${hasOpening ? ',$6' : ''}) ON CONFLICT(playlist_id) DO UPDATE SET
      mode=EXCLUDED.mode,ordered_ids=EXCLUDED.ordered_ids,excluded_ids=EXCLUDED.excluded_ids,
      updated_by=EXCLUDED.updated_by,updated_at=now(),revision=playlist_curations.revision+1
      ${hasOpening ? ',opening_ids=EXCLUDED.opening_ids' : ''}`,
      [playlistId, draft.mode, draft.orderedIds, draft.excludedIds, actor, ...(hasOpening ? [draft.openingIds ?? null] : [])],
    );
    return readCurationSnapshot(playlistId, db);
  }).catch(error => {
    if (['55P03', '57014'].includes((error as { code?: string }).code ?? ''))
      throw new CurationError('Media is changing or validation took too long. Preview again and retry saving.');
    throw error;
  });
}

export type CurationConfiguration = {
  is_public: boolean;
  mode: CurationDraft['mode'];
  ordered_ids: string[];
  excluded_ids: string[];
  opening_ids?: CurationDraft['openingIds'];
};

/** Read only requested destinations; missing schema retains the legacy fallback. */
export async function readCurationConfigurations(slugs: string[]): Promise<Map<string, CurationConfiguration>> {
  if (!process.env.DATABASE_URL || !slugs.length) return new Map();
  try {
    const rows = await query<CurationConfiguration & { slug: string }>(
      `SELECT p.slug,p.is_public,c.mode,c.ordered_ids,c.excluded_ids,to_jsonb(c)->'opening_ids' AS opening_ids FROM playlists p
      JOIN playlist_curations c ON c.playlist_id=p.id WHERE p.slug=ANY($1::text[])`,
      [slugs],
    );
    return new Map(rows.map(row => [row.slug, row]));
  } catch (error) {
    if ((error as { code?: string }).code === '42P01') return new Map();
    throw error;
  }
}

async function readCurationConfiguration(slug: string): Promise<CurationConfiguration | null> {
  try {
    const rows = await query<CurationConfiguration>(
      `SELECT p.is_public,c.mode,c.ordered_ids,c.excluded_ids,to_jsonb(c)->'opening_ids' AS opening_ids FROM playlists p
      JOIN playlist_curations c ON c.playlist_id=p.id WHERE p.slug=$1`,
      [slug],
    );
    return rows[0] ?? null;
  } catch (error) {
    if ((error as { code?: string }).code === '42P01') return null;
    throw error;
  }
}

/** null means legacy behavior; [] is an explicitly managed empty destination. */
export async function resolveCuratedPlaylist(
  slug: string,
  readConfiguration: typeof readCurationConfiguration = readCurationConfiguration,
): Promise<CurationItem[] | null> {
  if (!process.env.DATABASE_URL) return null;
  const saved = await readConfiguration(slug);
  if (!saved) return null;
  if (!saved.is_public || getCurationAliases(slug) === null) return [];
  return resolveCuration(
    { mode: saved.mode, orderedIds: saved.ordered_ids, excludedIds: saved.excluded_ids, openingIds: saved.opening_ids },
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
