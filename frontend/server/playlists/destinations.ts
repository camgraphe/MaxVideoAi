import { readEffectiveModelPageGallery } from './curation-model-preview';
import { getFalEngineBySlug } from '@/config/falEngines';
import { query } from '@/lib/db';
import { getExampleFamilyIds, getExampleFamilyLabel, getExampleFamilyModelSlugs } from '@/lib/model-families';
import { STARTER_MEDIA_SLUGS } from '@/lib/starter-media';
import { listCatalogPage } from '../videos-catalog-page';
import { readCurationConfigurations } from './curation-service';
import { curationSchemaAvailable } from './curation-store';
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
        ...spec(`model:${modelSlug}`, 'model', getModelPlaylistSlug(modelSlug), getFalEngineBySlug(modelSlug)?.marketingName ?? modelSlug, `/models/${modelSlug}`), familyId, modelSlug,
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
    const publicCount = effectiveCounts.get(spec.slug) ?? (playlist?.isPublic ? playlist.siteVisibleCount : 0);
    return {
      ...spec, playlistId: playlist?.id ?? null,
      itemCount: playlist?.itemCount ?? 0,
      publicCount,
      status: playlist ? 'connected' : 'missing', editable: Boolean(playlist),
      warning: playlist ? (playlist.isPublic ? null : 'This collection is private.') : spec.kind === 'model'
        ? `The model page currently displays ${publicCount} public videos from its editorial selections. Its editable collection "${spec.slug}" has not been created.`
        : `Runtime configuration expects "${spec.slug}". No playlist is connected; reconcile configuration or create the expected collection in maintenance.`,
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

/** Match visible model cards; at most four model projections run concurrently.
 * Each reads at most 200 playlist videos plus the finite authored featured/preferred IDs.
 */
async function loadModelCounts(specs: DestinationSpec[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!process.env.DATABASE_URL) return counts;
  const curationAvailable = await curationSchemaAvailable();
  for (let offset = 0; offset < specs.length; offset += 4) {
    await Promise.all(specs.slice(offset, offset + 4).map(async spec => {
      const cards = await readEffectiveModelPageGallery({ slug: spec.slug, curationAvailable }, { query });
      counts.set(spec.slug, cards.length);
    }));
  }
  return counts;
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
