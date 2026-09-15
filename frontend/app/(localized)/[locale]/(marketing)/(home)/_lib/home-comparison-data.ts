import { FEATURED_COMPARISON_PAIRS } from '@/config/featured-comparisons';
import { getAllCanonicalPairs, isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import { computeOverall } from '../../ai-video-engines/[slug]/_lib/compare-page-score-utils';
import type { EngineScore } from '../../ai-video-engines/[slug]/_lib/compare-page-types';
import type { HomeComparisonData, HomeComparisonModel } from '@/components/marketing/home/home-comparison-types';

const CRITERIA = ['fidelity', 'visualQuality', 'motion', 'consistency', 'anatomy', 'textRendering', 'lipsyncQuality', 'sequencingQuality', 'controllability', 'speedStability', 'pricing'] as const;
const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10;

export function buildHomeComparisonData(scores: Map<string, EngineScore>): HomeComparisonData {
  const model = (slug: string, name: string, logo: string): HomeComparisonModel => {
    const score = scores.get(slug);
    return { slug, name, logo, overall: computeOverall(score), criteriaCount: CRITERIA.filter(key => valid(score?.[key])).length,
      scores: ['fidelity', 'visualQuality', 'motion'].map(key => { const value = score?.[key as keyof EngineScore]; return valid(value) ? value : null; }) };
  };
  return {
    left: model('kling-3-pro', 'Kling 3 Pro', '/brand/partners/kling/kling-mark-light.png'),
    opponents: [
      model('seedance-2-5', 'Seedance 2.5', '/brand/partners/bytedance/bytedance-mark-dark.svg'),
      model('veo-3-1', 'Veo 3.1', '/brand/partners/google/google-mark-dark.svg'),
      model('ltx-2-5-pro', 'LTX 2.5 Pro', '/brand/partners/lightricks/lightricks-mark-dark.png'),
    ].filter(model => model.overall !== null && isPublishedComparisonSlug(`kling-3-pro-vs-${model.slug}`)),
  };
}

// Homepage promotion is curated separately from historical comparison routes.
export function buildHomeComparisonLinks() {
  const featured = FEATURED_COMPARISON_PAIRS.map(pair => pair.join('-vs-'));
  const pairs = getAllCanonicalPairs();
  return featured.flatMap(slug => {
    const pair = pairs.find(item => item.slug === slug);
    return pair && isPublishedComparisonSlug(pair.slug) ? [{ slug: pair.slug, title: pair.label }] : [];
  });
}
