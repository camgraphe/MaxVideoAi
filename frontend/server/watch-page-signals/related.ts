import type { SeoWatchVideoConfig } from '@/config/video-seo-watchlist';
import type { GalleryVideo } from '@/server/videos';
import type { CandidateRow, WatchPageDerivedSignals, WatchPageRelatedLink } from './types';

export function toWatchPageRelatedCandidate(params: {
  entry: SeoWatchVideoConfig;
  video: GalleryVideo;
  signals: WatchPageDerivedSignals;
}): CandidateRow {
  const { entry, video, signals } = params;
  return {
    id: entry.id,
    title: signals.title,
    subtitle: signals.intro,
    engineLabel: signals.engineLabel,
    thumbUrl: video.thumbUrl,
    engineSlug: signals.engineSlug,
    exampleFamily: signals.exampleFamily,
    mode: signals.mode,
    primaryIntent: signals.primaryIntent,
    capabilityTags: signals.capabilityTags,
    styleTags: signals.styleTags,
  };
}

function overlapCount(left: string[], right: string[]): number {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).length;
}

export function pickRelatedWatchPages(params: {
  currentId: string;
  currentSignals: WatchPageDerivedSignals;
  candidates: CandidateRow[];
  limit?: number;
}): WatchPageRelatedLink[] {
  const { currentId, currentSignals, candidates, limit = 4 } = params;
  const scored = candidates
    .filter((candidate) => candidate.id !== currentId)
    .map((candidate) => {
      let score = 0;
      const reasons: string[] = [];

      if (candidate.exampleFamily && candidate.exampleFamily === currentSignals.exampleFamily) {
        score += 4;
        reasons.push('Same example family');
      }
      if (candidate.primaryIntent === currentSignals.primaryIntent) {
        score += 3;
        reasons.push('Same watch-page intent');
      }
      const capabilityOverlap = overlapCount(candidate.capabilityTags, currentSignals.capabilityTags);
      if (capabilityOverlap > 0) {
        score += Math.min(3, capabilityOverlap * 1.5);
        reasons.push('Shared capability');
      }
      if (candidate.engineSlug && candidate.engineSlug === currentSignals.engineSlug) {
        score += 2;
        reasons.push('Same engine');
      }
      if (candidate.mode && candidate.mode === currentSignals.mode) {
        score += 1.5;
      }
      const styleOverlap = overlapCount(candidate.styleTags, currentSignals.styleTags);
      if (styleOverlap > 0) {
        score += Math.min(2, styleOverlap);
      }

      return {
        id: candidate.id,
        href: `/video/${encodeURIComponent(candidate.id)}`,
        title: candidate.title,
        subtitle: candidate.subtitle,
        engineLabel: candidate.engineLabel,
        thumbUrl: candidate.thumbUrl,
        score,
        reason: reasons[0] ?? 'Related example',
        engineSlug: candidate.engineSlug,
        exampleFamily: candidate.exampleFamily,
      };
    })
    .filter((candidate) => candidate.score >= 3)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'en'));

  const picked: WatchPageRelatedLink[] = [];
  const engineCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();

  for (const candidate of scored) {
    if (picked.length >= limit) break;
    const engineCount = candidate.engineSlug ? engineCounts.get(candidate.engineSlug) ?? 0 : 0;
    const familyCount = candidate.exampleFamily ? familyCounts.get(candidate.exampleFamily) ?? 0 : 0;
    if (candidate.engineSlug && engineCount >= 2) continue;
    if (candidate.exampleFamily && familyCount >= 2) continue;
    picked.push(candidate);
    if (candidate.engineSlug) engineCounts.set(candidate.engineSlug, engineCount + 1);
    if (candidate.exampleFamily) familyCounts.set(candidate.exampleFamily, familyCount + 1);
  }

  return picked;
}
