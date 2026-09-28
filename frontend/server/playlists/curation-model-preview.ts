import type { QueryExecutor } from '@/lib/db';
import { getFalEngineBySlug } from '@/config/falEngines';
import { resolveCuration, type CurationDraft } from '@/lib/admin/playlist-curation';
import { modelExamplePlaylistKeys, projectModelPageGallery } from '../model-gallery-projection';
import { BASE_SELECT } from '../videos-query';
import { mapGalleryVideoRow, type VideoRow } from '../videos-normalization';
import { readLegacyPlaylistVideos } from './legacy-video-reader';
import { listPlaylistVideoIds } from './direct-membership';
import { listCurationCandidates } from './curation-candidates';
import { PREFERRED_MEDIA, FEATURED_EXAMPLE_MEDIA } from '../../app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media';
import { toGalleryCard } from '../../app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media';

/** Transaction-bound readers for the same final projection used by the model route. */
export async function readEffectiveModelPageGallery(
  { slug, draft }: { slug: string; draft?: CurationDraft }, db: QueryExecutor,
) {
  const modelSlug = slug.slice('examples-'.length);
  const engine = getFalEngineBySlug(modelSlug) ?? { id: modelSlug, modelSlug };
  const getPublicVideosByIds = async (ids: string[]) => {
    if (!ids.length) return new Map();
    // Match getPublicVideosByIds, including its legacy nullable-indexable behavior.
    const rows = await db.query<VideoRow>(`${BASE_SELECT} WHERE job_id=ANY($1::text[])
      AND visibility='public' AND COALESCE(indexable,TRUE)`, [ids]);
    return new Map(rows.map(row => [row.job_id, mapGalleryVideoRow(row)]));
  };
  let examples: ReturnType<typeof mapGalleryVideoRow>[] = [];
  let managed = false;
  for (const key of modelExamplePlaylistKeys(modelSlug)) {
    const [source] = await db.query<{ is_public: boolean; managed: boolean }>(
      `SELECT p.is_public,c.playlist_id IS NOT NULL AS managed FROM playlists p
       LEFT JOIN playlist_curations c ON c.playlist_id=p.id WHERE p.slug=$1`, [key],
    );
    managed = Boolean(source?.managed || (draft && key === slug));
    if (!managed) {
      examples = await readLegacyPlaylistVideos({ slug: key, limit: 200 }, db);
    } else {
      const ids = draft && key === slug
        ? source?.is_public ? resolveCuration(draft, await listCurationCandidates(key, db)).slice(0, 200).map(item => item.id) : []
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
