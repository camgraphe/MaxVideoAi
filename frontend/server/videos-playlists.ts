import { query } from '@/lib/db';
import { isLocalPublicExamplesEnabled, listLocalModelExamples } from './local-public-examples';
import { mapGalleryVideoRow, type GalleryVideo, type VideoRow } from './videos-normalization';
import { BASE_SELECT } from './videos-query';
import { readLegacyPlaylistVideos } from './playlists/legacy-video-reader';
import {
  resolveCuratedPlaylist,
  readCurationConfigurations,
  CURATION_ELIGIBILITY,
  type CurationConfiguration,
} from './playlists/curation-service';


export type CurationReadScope = { resolve: (slug: string) => ReturnType<typeof resolveCuratedPlaylist> };

/** One loader invocation only; retain null/empty results, but allow failed reads to retry. */
export function createCurationReadScope(): CurationReadScope {
  const resolutions = new Map<string, ReturnType<typeof resolveCuratedPlaylist>>();
  let scheduled = false;
  let requested = new Map<string, {
    resolve: (config: CurationConfiguration | null) => void;
    reject: (error: unknown) => void;
  }>();
  const readConfiguration = (slug: string) => new Promise<CurationConfiguration | null>((resolve, reject) => {
    requested.set(slug, { resolve, reject });
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      const wave = [...requested];
      requested = new Map();
      scheduled = false;
      // Small batches bound large ID-array responses; later waves never wait for earlier batches.
      for (let offset = 0; offset < wave.length; offset += 4) {
        const batch = wave.slice(offset, offset + 4);
        void readCurationConfigurations(batch.map(([key]) => key)).then(
          configs => { for (const [key, pending] of batch) pending.resolve(configs.get(key) ?? null); },
          error => { for (const [, pending] of batch) pending.reject(error); },
        );
      }
    });
  });
  return {
    resolve(slug) {
      let pending = resolutions.get(slug);
      if (!pending) {
        pending = resolveCuratedPlaylist(slug, readConfiguration).catch(error => {
          resolutions.delete(slug);
          throw error;
        });
        resolutions.set(slug, pending);
      }
      return pending;
    },
  };
}

export async function listCuratedGalleryVideos(
  slug: string,
  options: {limit?: number; engineAliases?: string[] | null} = {},
  curationScope?: CurationReadScope,
): Promise<GalleryVideo[] | null> {
  const curated = await (curationScope ? curationScope.resolve(slug) : resolveCuratedPlaylist(slug));
  if (curated === null) return null;
  const aliases = options.engineAliases ? new Set(options.engineAliases.map(id => id.toLowerCase())) : null;
  const eligible = curated.filter(item => !aliases || aliases.has(item.engineId.toLowerCase()));
  const ids = (options.limit === undefined ? eligible : eligible.slice(0, options.limit)).map(item => item.id);
  if (!ids.length) return [];
  // A shared resolution must not retain access after the playlist becomes private.
  const publicPlaylist = curationScope
    ? 'AND EXISTS (SELECT 1 FROM playlists p WHERE p.slug=$2 AND p.is_public=TRUE)'
    : '';
  const rows = await query<VideoRow>(
    `${BASE_SELECT} WHERE job_id=ANY($1::text[]) AND ${CURATION_ELIGIBILITY} ${publicPlaylist}`,
    curationScope ? [ids, slug] : [ids],
  );
  const mapped = new Map(rows.map(row => [row.job_id,mapGalleryVideoRow(row)]));
  return ids.flatMap(id => mapped.has(id) ? [mapped.get(id)!] : []);
}
type PlaylistVideoQueryOptions = {
  slug: string;
  limit?: number;
  engineAliases?: string[] | null;
};

export async function listPlaylistVideosWithOptions({
  slug,
  limit,
  engineAliases,
}: PlaylistVideoQueryOptions, curationScope?: CurationReadScope): Promise<GalleryVideo[]> {
  if (isLocalPublicExamplesEnabled()) {
    return slug.startsWith('examples-') ? listLocalModelExamples(slug.slice('examples-'.length), limit) : [];
  }
  const curated = await listCuratedGalleryVideos(slug, {limit, engineAliases}, curationScope);
  if (curated !== null) return curated;
  return readLegacyPlaylistVideos({ slug, limit, engineAliases });
}


export { listPlaylistVideoIds } from './playlists/direct-membership';
