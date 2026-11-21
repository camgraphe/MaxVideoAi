import registeredExamples from '@/config/compare-same-prompt.json';
import { isDatabaseConfigured } from '@/lib/db';
import { getSeoVideosByIds } from '@/server/videos';
import { selectSamePromptExamples, type SamePromptSelection } from './compare-same-prompt-data';
import type { EngineCatalogEntry } from './compare-page-types';

const samePromptByComparison: Record<string, SamePromptSelection[]> = registeredExamples;

export async function loadCompareSamePrompt(
  canonicalSlug: string,
  left: EngineCatalogEntry,
  right: EngineCatalogEntry
) {
  const selections = samePromptByComparison[canonicalSlug];
  if (process.env.NEXT_PHASE === 'phase-production-build' || !selections?.length || !isDatabaseConfigured()) return [];
  try {
    const videoIds = [...new Set(selections.flatMap(selection => selection.videoIds))];
    const videos = await getSeoVideosByIds(videoIds);
    return selectSamePromptExamples(selections, videos, left, right);
  } catch (error) {
    console.warn('[comparison] same-prompt examples unavailable', error);
    return [];
  }
}
