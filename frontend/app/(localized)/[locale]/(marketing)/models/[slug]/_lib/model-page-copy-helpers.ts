import type { FalEngineEntry } from '@/config/falEngines';
import { getSuggestedOpponentSlugs } from '@/lib/compare-hub/data';
import { normalizeMaxResolution } from './model-page-hero-specs';
import {
  isPending,
  isUnsupported,
} from './model-page-spec-status';
import type { KeySpecValues } from './model-page-specs-types';

export function pickCompareEngines(allEngines: FalEngineEntry[], currentSlug: string, limit = 3): FalEngineEntry[] {
  const filtered = allEngines.filter((entry) => {
    if (entry.modelSlug === currentSlug) return false;
    const modes = entry.engine?.modes ?? [];
    const hasVideoMode = modes.some((mode) => mode.endsWith('v'));
    return hasVideoMode;
  });
  const filteredBySlug = new Map(filtered.map((entry) => [entry.modelSlug, entry]));

  const selected: FalEngineEntry[] = [];
  const usedFamilies = new Set<string>();
  const usedSlugs = new Set<string>();
  const registerEngine = (entry: FalEngineEntry) => {
    if (usedSlugs.has(entry.modelSlug)) return;
    selected.push(entry);
    usedSlugs.add(entry.modelSlug);
    const familyKey = entry.family ?? entry.brandId ?? entry.provider ?? entry.modelSlug;
    usedFamilies.add(familyKey);
  };

  const priorityTargets = getSuggestedOpponentSlugs(currentSlug, limit);
  for (const targetSlug of priorityTargets) {
    const target = filteredBySlug.get(targetSlug);
    if (!target) continue;
    registerEngine(target);
    if (selected.length >= limit) return selected;
  }

  for (const entry of filtered) {
    const familyKey = entry.family ?? entry.brandId ?? entry.provider ?? entry.modelSlug;
    if (usedFamilies.has(familyKey)) continue;
    registerEngine(entry);
    if (selected.length >= limit) return selected;
  }

  for (const entry of filtered) {
    if (selected.includes(entry)) continue;
    selected.push(entry);
    if (selected.length >= limit) break;
  }

  return selected;
}

export function buildVideoBoundaries(values: KeySpecValues | null): string[] {
  if (!values) {
    return [
      'Output is short-form. For longer edits, stitch multiple clips.',
      'Resolution is capped on this tier.',
      'No video input here — start from text or a single reference image.',
      'No fixed seeds — iteration = re-run + refine.',
    ];
  }
  const items: string[] = [];
  const duration = values.maxDuration && !isPending(values.maxDuration) ? values.maxDuration : null;
  const resolution = values.maxResolution && !isPending(values.maxResolution) ? normalizeMaxResolution(values.maxResolution) : null;
  if (duration) {
    items.push(`Output is short-form (${duration}). For longer edits, stitch multiple clips.`);
  }
  if (resolution) {
    items.push(`Resolution tops out at ${resolution} for this tier.`);
  }
  if (isUnsupported(values.videoToVideo)) {
    items.push('No video input here — start from text or a single reference image.');
  }
  if (isUnsupported(values.imageToVideo)) {
    items.push('Image-to-video is not supported on this tier.');
  }
  if (isUnsupported(values.audioOutput)) {
    items.push('No native audio in this tier.');
  }
  if (!items.length) {
    items.push('No fixed seeds — iteration = re-run + refine.');
  } else if (!items.some((item) => item.toLowerCase().includes('seed'))) {
    items.push('No fixed seeds — iteration = re-run + refine.');
  }
  return items;
}
