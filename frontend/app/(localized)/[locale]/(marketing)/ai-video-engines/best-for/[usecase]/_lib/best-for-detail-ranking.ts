import { getModelGuidance } from './best-for-model-guidance';
import type { AppLocale } from '@/i18n/locales';
import { isRuntimeModelPublicCurrent, listRuntimeModels, type RuntimeModelEntry } from '@/config/model-runtime';
import { ENGINE_BY_SLUG, ENGINE_CATALOG, type BestForDetailCopy, type BestForEntry, type RankedPick } from './best-for-detail-config';

type BestForRankingSources = {
  models?: readonly RuntimeModelEntry[];
  catalog?: readonly (typeof ENGINE_CATALOG)[number][];
};

// Authored editorial order, reviewed against current capabilities. Historical
// manual scores are neither an eligibility gate nor a fallback quality ranking.
export function resolveTopPicks(entry: BestForEntry, sources: BestForRankingSources = {}): string[] {
  const models = sources.models ?? listRuntimeModels();
  const catalog = sources.catalog ?? ENGINE_CATALOG;
  const publicCurrentSlugs = new Set(models.filter(isRuntimeModelPublicCurrent).map(model => model.slug));
  const catalogSlugs = new Set(catalog.map(engine => engine.modelSlug));
  return [...new Set(entry.topPicks ?? [])].filter(slug => publicCurrentSlugs.has(slug) && catalogSlugs.has(slug));
}

export function buildRankedPick({ usecaseSlug, modelSlug, rank, copy, locale }: {
  usecaseSlug: string;
  modelSlug: string;
  rank: number;
  copy: BestForDetailCopy;
  locale: AppLocale;
}): RankedPick {
  const engine = ENGINE_BY_SLUG.get(modelSlug);
  const guidance = getModelGuidance(modelSlug, locale, usecaseSlug);
  return {
    slug: modelSlug,
    engine,
    rank,
    criterion: guidance?.tag ?? copy.fit,
    accent: getEngineAccent(modelSlug),
    reason: guidance?.reason ?? '',
    limitation: guidance?.limit ?? '',
    bullets: [],
  };
}

function getEngineAccent(slug: string) {
  if (slug.includes('kling')) return '#7c3aed';
  if (slug.includes('seedance')) return '#0ea5e9';
  if (slug.includes('veo') || slug.includes('gemini')) return '#16a34a';
  if (slug.includes('ltx')) return '#d97706';
  if (slug.includes('minimax')) return '#ea580c';
  if (slug.includes('flux')) return '#be185d';
  if (slug.includes('luma')) return '#0891b2';
  return '#6366f1';
}
