import type { QueryExecutor } from '@/lib/db';
import { curationItemFormat, type CurationDraft, type CurationItem, type EffectiveCurationPreview } from '@/lib/admin/playlist-curation';
import { getExampleFamilyIds } from '@/lib/model-families';
import { listCatalogPreviewPair } from '../videos-catalog-page';
import { getCurationCandidateAliases } from './curation-candidate-aliases';
import { listCurationCandidates } from './curation-candidates';
import { createCurationModelMediaReader, readEffectiveModelPageGallery, type CurationSourceState } from './curation-model-preview';
import { modelExamplePlaylistKeys } from '../model-gallery-projection';
import { curationFingerprint } from './curation-store';
import { getExamplesHubPlaylistSlug, getFamilyFeedSourceSlugs } from './slugs';

export function effectiveSourceSlugs(slug: string): string[] {
  if (slug === getExamplesHubPlaylistSlug()) return [...new Set([slug, ...getExampleFamilyIds().flatMap(getFamilyFeedSourceSlugs)])];
  return slug.startsWith('family-') ? getFamilyFeedSourceSlugs(slug.slice(7)) : modelExamplePlaylistKeys(slug.slice('examples-'.length));
}

/** Full ID sets, not hydrated media, establish exact additions/removals beyond page one. */
export async function readEffectiveCurationPreview(
  { playlistId, slug, draft, candidates: suppliedCandidates, sources }: {
    playlistId: string; slug: string; draft: CurationDraft; candidates?: CurationItem[];
    sources?: ReadonlyMap<string, CurationSourceState>;
  },
  db: QueryExecutor,
): Promise<EffectiveCurationPreview> {
  const candidates = suppliedCandidates ?? await listCurationCandidates(slug, db, getCurationCandidateAliases(slug));
  const isCatalog = slug === getExamplesHubPlaylistSlug() || slug.startsWith('family-');
  const familyId = slug.startsWith('family-') ? slug.slice(7) : undefined;
  const readMedia = createCurationModelMediaReader(db);
  type Collected = { ids: string[]; total: number; suppressedSourceSlugs: string[]; media?: Awaited<ReturnType<typeof readEffectiveModelPageGallery>> };
  let current: Collected;
  let next: Collected;
  if (isCatalog) {
    current = { ids: [], total: 0, suppressedSourceSlugs: [] };
    next = { ids: [], total: 0, suppressedSourceSlugs: [] };
    let offset = 0;
    do {
      const pair = await listCatalogPreviewPair({ familyId, sort: 'playlist', limit: 500, offset,
        curationOverride: { playlistId, draft } }, db);
      for (const [result, page] of [[current, pair.current], [next, pair.next]] as const) {
        result.ids.push(...page.ids); result.total = page.total; result.suppressedSourceSlugs = page.suppressedSourceSlugs;
      }
      if (!pair.current.ids.length && !pair.next.ids.length) break;
      offset += 500;
    } while (current.ids.length < current.total || next.ids.length < next.total);
    current.ids = current.ids.slice(0, current.total);
    next.ids = next.ids.slice(0, next.total);
  } else {
    const collect = async (override: boolean): Promise<Collected> => {
      const media = await readEffectiveModelPageGallery({slug, sources, readMedia, ...(override ? {draft, candidates} : {})},db);
      return {ids:media.map(item=>item.id),total:media.length,suppressedSourceSlugs:[],media};
    };
    // Same snapshot/locked transaction: hydrate the selection first, then reuse it for current preferred cards.
    next = await collect(true);
    current = await collect(false);
  }
  const previousIds = new Set(current.ids);
  const nextIds = new Set(next.ids);
  const removedCount = current.ids.filter(id => !nextIds.has(id)).length;
  const warnings: string[] = [];
  if (!next.ids.length) warnings.push('The public page will be empty. Add eligible videos before saving if this is unintended.');
  if (removedCount >= 24 || (removedCount > 0 && removedCount >= current.total / 2))
    warnings.push(`This change removes ${removedCount} videos from the effective page. Review the selection before saving.`);
  if (!isCatalog) warnings.push('Model pages read up to 200 playlist videos before filtering. Unmanaged pages may append featured or preferred media; adopting curation removes those additions.');
  if (next.suppressedSourceSlugs.length) warnings.push('Inherited sources listed below are suppressed by explicit curation.');
  return {
    ...(!isCatalog ? {mediaRevision:curationFingerprint({current:current.media,next:next.media})} : {}),
    total: next.ids.length, firstPageIds: next.ids.slice(0,24), currentTotal: current.total,
    addedCount: next.ids.filter(id => !previousIds.has(id)).length, removedCount,
    suppressedSourceSlugs: next.suppressedSourceSlugs,
    openingFormats: (draft.openingIds ?? []).map(id => {
      const item = candidates.find(candidate => candidate.id === id);
      return item ? curationItemFormat(item) : null;
    }), warnings,
  };
}
