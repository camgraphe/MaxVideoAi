import type { QueryExecutor } from '@/lib/db';
import { getFalEngineBySlug } from '@/config/falEngines';
import { resolveCuration, type CurationDraft, type CurationItem } from '@/lib/admin/playlist-curation';
import { modelExamplePlaylistKeys, projectModelPageGallery } from '../model-gallery-projection';
import { BASE_SELECT } from '../videos-query';
import { mapGalleryVideoRow, type VideoRow } from '../videos-normalization';
import { readLegacyPlaylistVideos } from './legacy-video-reader';
import { listPlaylistVideoIds } from './direct-membership';
import { listCurationCandidates } from './curation-candidates';
import { PREFERRED_MEDIA, FEATURED_EXAMPLE_MEDIA } from '../../app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media';
import { toGalleryCard } from '../../app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media';

export type CurationSourceState = { is_public: boolean; managed: boolean };

async function readPublicMedia(db: QueryExecutor, ids: string[]) {
  if (!ids.length) return new Map<string, ReturnType<typeof mapGalleryVideoRow>>();
  // Match getPublicVideosByIds, including its legacy nullable-indexable behavior.
  const rows = await db.query<VideoRow>(`${BASE_SELECT} WHERE job_id=ANY($1::text[])
    AND visibility='public' AND COALESCE(indexable,TRUE)`, [ids]);
  return new Map(rows.map(row => [row.job_id, mapGalleryVideoRow(row)]));
}

/** One preview transaction only. Cache misses too; every lookup uses the same public predicate. */
export function createCurationModelMediaReader(db: QueryExecutor) {
  const media = new Map<string, ReturnType<typeof mapGalleryVideoRow>>();
  const queried = new Set<string>();
  return async (ids: string[]) => {
    const missing = [...new Set(ids)].filter(id => !queried.has(id));
    if (missing.length) {
      const rows = await readPublicMedia(db, missing);
      for (const id of missing) queried.add(id);
      for (const [id, row] of rows) media.set(id, row);
    }
    return new Map(ids.flatMap(id => media.has(id) ? [[id, media.get(id)!] as const] : []));
  };
}

/** Transaction-bound readers for the same final projection used by the model route. */
export async function readEffectiveModelPageGallery(
  { slug, draft, curationAvailable = true, sources, candidates, readMedia }: {
    slug: string; draft?: CurationDraft; curationAvailable?: boolean;
    sources?: ReadonlyMap<string, CurationSourceState>; candidates?: CurationItem[];
    readMedia?: ReturnType<typeof createCurationModelMediaReader>;
  }, db: QueryExecutor,
) {
  const modelSlug = slug.slice('examples-'.length);
  const engine = getFalEngineBySlug(modelSlug) ?? { id: modelSlug, modelSlug };
  const getPublicVideosByIds = readMedia ?? ((ids: string[]) => readPublicMedia(db, ids));
  let examples: ReturnType<typeof mapGalleryVideoRow>[] = [];
  let managed = false;
  for (const key of modelExamplePlaylistKeys(modelSlug)) {
    const source = sources ? sources.get(key) : (await db.query<CurationSourceState>(
      `SELECT p.is_public,${curationAvailable ? 'c.playlist_id IS NOT NULL' : 'false'} AS managed FROM playlists p
       ${curationAvailable ? 'LEFT JOIN playlist_curations c ON c.playlist_id=p.id' : ''} WHERE p.slug=$1`, [key],
    ))[0];
    managed = Boolean(source?.managed || (draft && key === slug));
    if (!managed) {
      examples = await readLegacyPlaylistVideos({ slug: key, limit: 200 }, db);
    } else {
      const ids = draft && key === slug
        ? source?.is_public ? resolveCuration(draft, candidates ?? await listCurationCandidates(key, db)).slice(0, 200).map(item => item.id) : []
        : (await listPlaylistVideoIds(key, { offset: 0, limit: 200 }, db)).ids;
      const media = await getPublicVideosByIds(ids);
      examples = ids.flatMap(id => media.get(id) ?? []);
    }
    if (examples.length || managed) break;
  }
  return (await projectModelPageGallery({
    engine, examples, managed,
    preferred: PREFERRED_MEDIA[modelSlug] ?? { hero: null, demo: null },
    featuredIds: FEATURED_EXAMPLE_MEDIA[modelSlug] ?? [],
    getPublicVideosByIds, toCard: video => toGalleryCard(video),
  })).galleryVideos;
}
