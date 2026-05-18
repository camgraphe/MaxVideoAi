import { buildCompareRoute, isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import { resolveEngineEntry } from './engine';
import type { WatchPageDerivedSignals, WatchPageIntent } from './types';

type EngineEntry = ReturnType<typeof resolveEngineEntry>;

export function buildPromptImprovementNotes(params: {
  capabilityTags: string[];
  primaryIntent: WatchPageIntent;
  hasNegativePrompt: boolean;
}): string[] {
  const notes = [
    'Keep the subject, camera move, lighting, duration, aspect ratio and audio requirement grouped so the render has one clear production brief.',
    'Change one variable at a time when cloning this prompt: model, duration, camera motion or reference input. That makes quality and price differences easier to compare.',
  ];
  if (!params.hasNegativePrompt) {
    notes.push('Add a short negative prompt if you need to block text overlays, logos, distorted hands, face warping or unwanted camera shake.');
  } else {
    notes.push('Reuse the negative prompt when testing variants so visual artifacts are controlled across models.');
  }
  if (params.primaryIntent === 'product-ad') {
    notes.push('For product shots, keep the product name generic, describe materials and lighting, and avoid adding too many scene changes in one clip.');
  } else if (params.capabilityTags.includes('multi-shot')) {
    notes.push('For multi-shot prompts, keep each beat short and give every cut a clear start state, camera direction and landing frame.');
  }
  return Array.from(new Set(notes)).slice(0, 4);
}

export function buildCompareLinks(params: {
  engineSlug: string | null;
  engineLabel: string;
  engineEntry: EngineEntry;
}): WatchPageDerivedSignals['compareLinks'] {
  const { engineSlug, engineLabel, engineEntry } = params;
  const compareSurface = engineEntry?.surfaces.compare;
  if (!engineSlug || !compareSurface?.includeInHub) {
    return [];
  }
  const opponents = [...(compareSurface.publishedPairs ?? []), ...(compareSurface.suggestOpponents ?? [])];
  const seen = new Set<string>();
  return opponents.flatMap((opponentSlug) => {
    if (!opponentSlug || opponentSlug === engineSlug) return [];
    const route = buildCompareRoute(engineSlug, opponentSlug);
    if (seen.has(route.slug) || !isPublishedComparisonSlug(route.slug)) return [];
    seen.add(route.slug);
    const opponent = resolveEngineEntry(opponentSlug);
    const opponentLabel = opponent?.marketingName ?? opponentSlug.replace(/-/g, ' ');
    const href = route.order
      ? `/ai-video-engines/${route.slug}?order=${encodeURIComponent(route.order)}`
      : `/ai-video-engines/${route.slug}`;
    return [
      {
        href,
        label: `${engineLabel} vs ${opponentLabel}`,
        reason: 'Compare specs, pricing, prompt fit and example behavior side by side.',
      },
    ];
  }).slice(0, 3);
}
