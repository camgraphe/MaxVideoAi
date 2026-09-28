import { query } from '@/lib/db';
import { getExampleFamilyIds, getExampleFamilyLabel, getExampleFamilyModelSlugs } from '@/lib/model-families';
import { STARTER_MEDIA_SLUGS } from '@/lib/starter-media';
import { listCatalogPage } from '../videos-catalog-page';
import { CURATION_ELIGIBILITY, readCurationConfigurations } from './curation-service';
import { curationSchemaAvailable, getCurationAliases } from './curation-store';
import { isInactiveHistoricalCoreSlug } from './destination-protection';
import { getExamplesHubPlaylistSlug, getStarterPlaylistSlug, getFamilyPlaylistSlug, getModelPlaylistSlug, getFamilyFeedSourceSlugs } from './slugs';
import type { PlaylistDestination, PlaylistRecord } from './types';

type DestinationSpec = Pick<PlaylistDestination, 'id' | 'kind' | 'slug' | 'label' | 'path' | 'familyId' | 'modelSlug' | 'sourceSlugs'>;

function destinationSpecs(): DestinationSpec[] {
  const hub = getExamplesHubPlaylistSlug();
  const starter = getStarterPlaylistSlug();
  const families = getExampleFamilyIds();
  const spec = (id: string, kind: PlaylistDestination['kind'], slug: string, label: string, path: string): DestinationSpec =>
    ({ id, kind, slug, label, path, familyId: null, modelSlug: null, sourceSlugs: [slug] });
  return [
    { ...spec('examples', 'examples', hub, 'Examples', '/examples'), sourceSlugs: [...new Set([hub, ...families.flatMap(getFamilyFeedSourceSlugs)])] },
    spec('starter', 'starter', starter, 'Starter video', '/app?tab=starter'),
    ...families.flatMap(familyId => [
      { ...spec(`family:${familyId}`, 'family', getFamilyPlaylistSlug(familyId), getExampleFamilyLabel(familyId) ?? familyId, `/examples/${familyId}`), familyId, sourceSlugs: getFamilyFeedSourceSlugs(familyId) },
      ...getExampleFamilyModelSlugs(familyId).map(modelSlug => ({
        ...spec(`model:${modelSlug}`, 'model', getModelPlaylistSlug(modelSlug), modelSlug, `/models/${modelSlug}`), familyId, modelSlug,
      })),
    ]),
    ...Object.entries(STARTER_MEDIA_SLUGS).map(([surface, slug]) => spec(`starter:${surface}`, surface as 'image' | 'audio', slug, `Starter ${surface}`, `/app/${surface}`)),
  ];
}

/** Effective counts are keyed by runtime slug, never by the playlist display name. */
export function buildPlaylistDestinations(playlists: readonly PlaylistRecord[], effectiveCounts: ReadonlyMap<string, number>): PlaylistDestination[] {
  const bySlug = new Map(playlists.map(playlist => [playlist.slug, playlist]));
  const connected = new Set<string>();
  const destinations: PlaylistDestination[] = destinationSpecs().map(spec => {
    const playlist = bySlug.get(spec.slug);
    if (playlist) connected.add(playlist.id);
    return {
      ...spec, playlistId: playlist?.id ?? null,
      itemCount: playlist?.itemCount ?? 0,
      publicCount: effectiveCounts.get(spec.slug) ?? (playlist?.isPublic ? playlist.siteVisibleCount : 0),
      status: playlist ? 'connected' : 'missing', editable: Boolean(playlist),
      warning: playlist ? (playlist.isPublic ? null : 'This collection is private.') : `Runtime configuration expects "${spec.slug}". No playlist is connected; reconcile configuration or create the expected collection in maintenance.`,
    };
  });
  for (const playlist of playlists) {
    if (connected.has(playlist.id)) continue;
    const historical = isInactiveHistoricalCoreSlug(playlist.slug);
    destinations.push({
      id: `playlist:${playlist.id}`, kind: 'maintenance', slug: playlist.slug, playlistId: playlist.id,
      label: playlist.name, path: null, familyId: null, modelSlug: null,
      itemCount: playlist.itemCount, publicCount: playlist.isPublic ? playlist.siteVisibleCount : 0,
      sourceSlugs: [playlist.slug], status: historical ? 'historical' : 'unconnected', editable: !historical,
      warning: historical ? 'Historical collection does not match runtime configuration. Reconcile configuration before editing.' : 'No active public destination is connected to this collection.',
    });
  }
  return destinations;
}

/** Count direct model readers in one batch, including saved manual/hybrid selections. */
async function loadModelCounts(specs: DestinationSpec[]): Promise<Map<string, number>> {
  if (!process.env.DATABASE_URL) return new Map();
  const curated = await curationSchemaAvailable();
  const rows = await query<{ slug: string; total: number }>(`
    WITH specs AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS s(slug text, aliases text[])),
    sources AS (
      SELECT s.*,p.id,p.is_public,${curated ? "c.mode,c.ordered_ids,c.excluded_ids,ARRAY(SELECT jsonb_array_elements_text(NULLIF(to_jsonb(c)->'opening_ids','null'::jsonb))) AS opening_ids" : 'NULL::text AS mode,NULL::text[] AS ordered_ids,NULL::text[] AS excluded_ids,NULL::text[] AS opening_ids'}
      FROM specs s JOIN playlists p ON p.slug=s.slug
      ${curated ? 'LEFT JOIN playlist_curations c ON c.playlist_id=p.id' : ''}
    ), membership AS (
      SELECT s.slug,j.job_id FROM sources s JOIN playlist_items pi ON pi.playlist_id=s.id
      JOIN app_jobs j ON j.job_id=pi.video_id
      WHERE s.is_public=TRUE AND s.mode IS NULL AND j.visibility='public' AND COALESCE(j.indexable,TRUE)
      UNION ALL
      SELECT s.slug,j.job_id FROM sources s JOIN app_jobs j ON LOWER(j.engine_id)=ANY(s.aliases)
      WHERE s.is_public=TRUE AND s.mode IS NOT NULL
        AND j.job_id IN (SELECT job_id FROM app_jobs WHERE ${CURATION_ELIGIBILITY})
        AND NOT j.job_id=ANY(s.excluded_ids)
        AND (s.mode='hybrid' OR j.job_id=ANY(s.ordered_ids || s.opening_ids))
    ) SELECT slug,COUNT(DISTINCT job_id)::int AS total FROM membership GROUP BY slug`,
    [JSON.stringify(specs.map(spec => ({ slug: spec.slug, aliases: getCurationAliases(spec.slug) ?? [] })))],
  );
  return new Map(rows.map(row => [row.slug, Number(row.total)]));
}

export async function loadPlaylistDestinations(playlists: readonly PlaylistRecord[]): Promise<PlaylistDestination[]> {
  const specs = destinationSpecs();
  const counts = await loadModelCounts(specs.filter(spec => spec.kind === 'model'));
  const catalogSpecs = specs.filter(spec => spec.kind === 'examples' || spec.kind === 'family');
  // Bound concurrent one-card catalog reads; totals retain the public reader's precedence and deduplication.
  for (let offset = 0; offset < catalogSpecs.length; offset += 4) {
    await Promise.all(catalogSpecs.slice(offset, offset + 4).map(async spec => {
      const page = await listCatalogPage({ familyId: spec.familyId ?? undefined, sort: 'playlist', limit: 1, offset: 0 });
      counts.set(spec.slug, page.total);
    }));
  }
  for (const spec of specs.filter(spec => spec.kind === 'model')) if (!counts.has(spec.slug)) counts.set(spec.slug, 0);
  const configurations = await readCurationConfigurations(catalogSpecs.map(spec => spec.slug));
  return buildPlaylistDestinations(playlists, counts).map(destination => {
    if (configurations.has(destination.slug)) return { ...destination, sourceSlugs: [destination.slug] };
    if (destination.kind !== 'examples') return destination;
    return { ...destination, sourceSlugs: destination.sourceSlugs.filter(slug => {
      const model = specs.find(spec => spec.kind === 'model' && spec.slug === slug);
      return !model?.familyId || !configurations.has(getFamilyPlaylistSlug(model.familyId));
    }) };
  });
}
