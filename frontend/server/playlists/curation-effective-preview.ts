import type { QueryExecutor } from '@/lib/db';
import { curationItemFormat, type CurationDraft, type CurationItem, type EffectiveCurationPreview } from '@/lib/admin/playlist-curation';
import { getExampleFamilyIds } from '@/lib/model-families';
import { listCatalogPreviewIds } from '../videos-catalog-page';
import { getCurationCandidateAliases } from './curation-candidate-aliases';
import { listCurationCandidates } from './curation-candidates';
import { readEffectiveModelPageGallery } from './curation-model-preview';
import { modelExamplePlaylistKeys } from '../model-gallery-projection';
import { curationFingerprint } from './curation-store';
import { getExamplesHubPlaylistSlug, getFamilyFeedSourceSlugs } from './slugs';

export function effectiveSourceSlugs(slug: string): string[] {
  if (slug === getExamplesHubPlaylistSlug()) return [...new Set([slug, ...getExampleFamilyIds().flatMap(getFamilyFeedSourceSlugs)])];
  return slug.startsWith('family-') ? getFamilyFeedSourceSlugs(slug.slice(7)) : modelExamplePlaylistKeys(slug.slice('examples-'.length));
}

/** Full ID sets, not hydrated media, establish exact additions/removals beyond page one. */
export async function readEffectiveCurationPreview(
  { playlistId, slug, draft, candidates: suppliedCandidates }: { playlistId: string; slug: string; draft: CurationDraft; candidates?: CurationItem[] },
  db: QueryExecutor,
): Promise<EffectiveCurationPreview> {
  const candidates = suppliedCandidates ?? await listCurationCandidates(slug, db, getCurationCandidateAliases(slug));
  const isCatalog = slug === getExamplesHubPlaylistSlug() || slug.startsWith('family-');
  const familyId = slug.startsWith('family-') ? slug.slice(7) : undefined;
  const collect = async (override: boolean) => {
    if (!isCatalog) {
      const media = await readEffectiveModelPageGallery({slug,...(override ? {draft} : {})},db);
      return {ids:media.map(item=>item.id),total:media.length,suppressedSourceSlugs:[] as string[],media};
    }
    const ids: string[] = [];
    let total = 0;
    let suppressedSourceSlugs: string[] = [];
    do {
      const page = await listCatalogPreviewIds({ familyId, sort: 'playlist', limit: 500, offset: ids.length,
        ...(override ? { curationOverride: { playlistId, draft } } : {}) }, db);
      ids.push(...page.ids);
      total = page.total;
      if ('suppressedSourceSlugs' in page) suppressedSourceSlugs = page.suppressedSourceSlugs as string[];
      if (!page.ids.length) break;
    } while (ids.length < total);
    return { ids: ids.slice(0,total), total, suppressedSourceSlugs, media: undefined };
  };
  const current = await collect(false);
  const next = await collect(true);
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
